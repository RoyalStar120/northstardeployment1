import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { ApifyClient } from 'apify-client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { spawn } from 'child_process';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

import fs from 'fs';
import crypto from 'crypto';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NORTHSTAR_AI_DIR =
  process.env.NORTHSTAR_AI_DIR ||
  path.resolve(__dirname, 'northstar-ai');

const venvPython = process.platform === 'win32'
  ? path.join(NORTHSTAR_AI_DIR, '.venv', 'Scripts', 'python.exe')
  : path.join(NORTHSTAR_AI_DIR, '.venv', 'bin', 'python');

const defaultPython = fs.existsSync(venvPython)
  ? venvPython
  : (process.platform === 'win32' ? 'python' : 'python3');

const NORTHSTAR_AI_PYTHON =
  process.env.NORTHSTAR_AI_PYTHON || defaultPython;

const NORTHSTAR_RESUME_PIPELINE =
  path.join(NORTHSTAR_AI_DIR, 'scripts', 'resume_pipeline_api.py');

const NORTHSTAR_CHAT_SCRIPT =
  path.join(NORTHSTAR_AI_DIR, 'scripts', 'chat_api.py');


const supabaseUrl = process.env.SUPABASE_URL || '';
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

// Startup validation — warn clearly if Supabase credentials are missing, never print key values
if (!supabaseUrl) {
  console.warn('⚠️  [Supabase] SUPABASE_URL is not set. Supabase features will be disabled.');
} else if (!supabasePublishableKey) {
  console.warn('⚠️  [Supabase] SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY) is not set. Frontend Supabase features will be unavailable.');
} else {
  console.log(`✅ [Supabase] Configured — project: ${supabaseUrl}`);
}

if (supabaseServiceKey) {
  console.log('✅ [Supabase] Service key present — server-side admin DB operations enabled.');
} else {
  console.warn('⚠️  [Supabase] SUPABASE_SECRET_KEY not set — admin DB operations will fall back to in-memory.');
}

// Admin client for server-side operations (deliveries, jobs persistence) — never exposed to browser
const supabase = (supabaseUrl && supabaseServiceKey) ? createClient(supabaseUrl, supabaseServiceKey) : null;

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Explicit HTML page routes so every URL and symlink resolves reliably
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});
app.get(['/index.html', '/login.html', '/signup.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});
app.get(['/jobs.html', '/opportunities.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'opportunities.html'));
});
app.get(['/progress.html', '/profile.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'progress.html'));
});
app.get(['/map.html', '/resource-map.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'resource-map.html'));
});
app.get('/seeker-dashboard.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'seeker-dashboard.html'));
});
app.get(['/helper-dashboard.html', '/volunteer-dashboard.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'helper-dashboard.html'));
});

// The Expo Go wrapper (expo-app/) lives in this folder but isn't part of the website
app.use('/expo-app', (req, res) => res.status(404).end());

// The site is served from the repo root, so keep server code, local data, backups, git
// metadata, AI model files and tooling out of reach. Only the public web assets are served.
const BLOCKED_STATIC = [
  /(^|\/)\./,                                // .git, .env, .agents, any dot-segment
  /^\/(data|northstar-ai|node_modules|docs|refs|scripts|launch-video|e2e|expo-app|northstar|dist|src)(\/|$)/i,
  /^\/(server|tsconfig|package|package-lock|skills-lock)[^/]*$/i,
  /\.(before|redesign-backup|pre-settings-merge)[^/]*$/i,
  /\.(md|py|sh|map|jsx|ts|tsx|csv|safetensors|log|save)$/i
];
app.use((req, res, next) => {
  let p = req.path;
  try { p = decodeURIComponent(p); } catch (e) { return res.status(400).end(); }
  if (BLOCKED_STATIC.some(re => re.test(p))) return res.status(404).end();
  next();
});
app.use(express.static(__dirname, { dotfiles: 'deny' }));

const apify = new ApifyClient({ token: process.env.APIFY_TOKEN });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
const stripeKey = process.env.STRIPE_SECRET_KEY || '';
const stripe = stripeKey ? new Stripe(stripeKey) : null;

let activeDeliveries = [];

// Real Craigslist gigs only (from the Apify scrape). Saved to Supabase Storage so a restart
// doesn't lose them; nothing is made up while the list is empty.
let activeGigs = [];
let gigsScrapedAt = 0;
const GIGS_MAX_AGE_MS = 12 * 60 * 60 * 1000;

// Database for Job & Work Opportunities (Populated dynamically when posted)
const inMemoryJobs = [];

// Scrape Craigslist using Apify cloud crawler and filter with Gemini (with fallback)
async function fetchAndVetGigs() {
  console.log('🚀 Running real Apify Craigslist Scraper for low-barrier cash gigs...');
  let items = [];

  try {
    const run = await apify.actor('automation-lab/craigslist-scraper').call({
      city: 'seattle',
      category: 'gigs',
      searchQueries: ['cash in hand', 'same day cash', 'cash daily', 'casual labor cash', 'immediate cash hire', 'day labor cash'],
      maxResults: 10,
      includeDetails: true
    });

    const dataset = await apify.dataset(run.defaultDatasetId).listItems();
    items = dataset.items || [];
    console.log(`📥 Apify extracted ${items.length} live listings with direct URLs.`);
  } catch (apifyErr) {
    console.warn('⚠️ Apify cloud scraper notice:', apifyErr.message);
  }

  const newlyApproved = [];
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  for (const item of items) {
    let itemUrl = item.url || item.link || '';
    const itemTitle = item.title || item.name || '';
    
    // CRITICAL URL RULE (NEW 2026 FORMAT):
    // - A valid individual listing URL ALWAYS contains "/view/d/" and ends with an alphanumeric hash ID.
    // - Do NOT append ".html" to the end of the URL.
    // - FORBIDDEN: NEVER use search URLs containing "/search/"
    if (!itemUrl || itemUrl.includes('/search/')) continue;
    if (!itemUrl.includes('/view/d/') && !itemUrl.includes('/d/')) continue;
    
    // Strip trailing .html if present to enforce 2026 format
    itemUrl = itemUrl.replace(/\.html$/i, '');

    // STRICT FILTER: Exclude Cash Surveys, Card Pay, Visa Cards, Checks, etc.
    if (/survey|study|panel|questionnaire|gift\s*card|debit\s*card|visa|check\s*pay/i.test(itemTitle)) continue;

    const prompt = `Analyze this Craigslist gig:
Title: ${itemTitle}
Description: ${item.description || item.text || itemTitle}

CRITICAL RULES:
1. Is this casual, same-day/daily paid labor, handyman, moving, or helper work?
2. Does it pay CASH IN HAND? (ABSOLUTELY EXCLUDE gift cards, prepaid visa/debit cards, check payments, direct deposit waiting periods, or crypto!)
3. Does it require formal government ID, W-2 paperwork, or background checks?
4. ABSOLUTELY EXCLUDE any paid online surveys, cash surveys, scams, or study panels!

Return JSON ONLY:
{
  "is_valid": true/false,
  "is_cash_payment": true/false,
  "is_survey": true/false,
  "no_gov_info_needed": true/false,
  "clean_title": "Clean Title",
  "pay_rate": "Extracted Cash Pay (e.g. $150 Cash or $25/hr Cash)",
  "short_summary": "1 sentence description"
}`;

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text().replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(text);

      if (parsed.is_valid && parsed.is_cash_payment && !parsed.is_survey && parsed.no_gov_info_needed) {
        let payStr = parsed.pay_rate || item.price || '';
        if (payStr && !/cash/i.test(payStr)) payStr = `${payStr} Cash`;
        newlyApproved.push({
          id: item.listingId || item.id || String(Date.now() + Math.random()),
          title: parsed.clean_title,
          pay: payStr,
          summary: parsed.short_summary,
          safety: parsed.no_gov_info_needed ? 'Verified casual labor requiring no government ID or W-2 paperwork.' : 'Verification or ID may be requested.',
          url: itemUrl,
          postedAt: item.postedAt || new Date().toISOString(),
          isCash: true,
          noIdRequired: !!parsed.no_gov_info_needed
        });
      }
    } catch (geminiErr) {
      console.error('Gemini parse/quota notice:', geminiErr.message.slice(0, 80));
      if (!/survey|study|panel|card|check/i.test(itemTitle) && /cash|mover|labor|help|clean|yard|paint|unload|handyman/i.test(itemTitle)) {
        newlyApproved.push({
          id: item.listingId || item.id || String(Date.now() + Math.random()),
          title: itemTitle.replace(/\s*-\s*\$\d+.*$/, '').slice(0, 45),
          pay: item.price || '',
          summary: String(item.description || item.text || '').replace(/\s+/g, ' ').trim().slice(0, 140),
          safety: '',
          url: itemUrl,
          postedAt: item.postedAt || new Date().toISOString(),
          isCash: true
        });
      }
    }
    await sleep(1500);
  }

  if (newlyApproved.length > 0) {
    const existingUrls = new Set(activeGigs.map(g => g.url || g.title));
    const uniqueNew = newlyApproved.filter(g => !existingUrls.has(g.url || g.title));
    activeGigs = [...uniqueNew, ...activeGigs];
  }

  // Filter activeGigs to strictly enforce direct URLs
  activeGigs = activeGigs.filter(gig => gig.url && gig.url.includes('/d/') && !gig.url.includes('/search/'));

  // Prioritize Cash pay gigs at the top of activeGigs array
  activeGigs.sort((a, b) => {
    const aIsCash = /cash/i.test(a.pay || '') || /cash/i.test(a.summary || '') || a.isCash;
    const bIsCash = /cash/i.test(b.pay || '') || /cash/i.test(b.summary || '') || b.isCash;
    if (aIsCash && !bIsCash) return -1;
    if (!aIsCash && bIsCash) return 1;
    return 0;
  });

  // Drop listings older than two weeks; they're usually gone
  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
  activeGigs = activeGigs.filter(g => !g.postedAt || new Date(g.postedAt).getTime() > cutoff).slice(0, 60);
  gigsScrapedAt = Date.now();
  saveGigsCache();
  console.log(`✅ Stored ${activeGigs.length} vetted gigs with strict direct permalinks prioritizing cash pay.`);
}

// REST Endpoints
app.get('/api/config', (req, res) => {
  // NOTE: Only send the public/publishable key to the browser — never the service role key.
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '',
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY || '',
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || '',
    supportEmail: process.env.SUPPORT_EMAIL || ''
  });
});

app.get('/api/gigs', (req, res) => res.json({ success: true, count: activeGigs.length, gigs: activeGigs }));
// Each scrape spends paid Apify + Gemini quota and the button is public, so at most one manual
// scrape starts every 10 minutes; other callers wait for it or get the current list.
const SCRAPE_MIN_INTERVAL_MS = 10 * 60 * 1000;
let scrapeInFlight = null;
let lastManualScrapeAt = 0;
app.get('/api/trigger-scrape', async (req, res) => {
  const now = Date.now();
  if (!scrapeInFlight && now - lastManualScrapeAt >= SCRAPE_MIN_INTERVAL_MS) {
    lastManualScrapeAt = now;
    scrapeInFlight = fetchAndVetGigs()
      .catch(err => console.warn('Manual scrape warning:', err?.message || err))
      .finally(() => { scrapeInFlight = null; });
  }
  if (scrapeInFlight) await scrapeInFlight;
  res.json({ success: true, count: activeGigs.length, gigs: activeGigs });
});

// Google Transit Directions Proxy API
app.get('/api/transit-directions', async (req, res) => {
  const { origin, destination } = req.query;
  // mode=walking for "Walk only"; anything else asks for bus + walk
  const wantWalking = String(req.query.mode || '').toLowerCase() === 'walking';
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;

  if (!origin || !destination) {
    return res.status(400).json({ success: false, error: 'Origin and destination coordinates are required.' });
  }

  if (!apiKey) {
    return res.status(500).json({ success: false, error: 'Google Maps API Key is missing in environment.' });
  }

  try {
    const axios = (await import('axios')).default;
    const ask = (mode) => axios.get('https://maps.googleapis.com/maps/api/directions/json', {
      timeout: 12000,
      params: mode === 'walking'
        ? { origin, destination, mode: 'walking', key: apiKey }
        : { origin, destination, mode: 'transit', transit_mode: 'bus', departure_time: 'now', key: apiKey }
    });

    let modeUsed = wantWalking ? 'walking' : 'transit';
    let response = await ask(modeUsed);
    // No bus route (late at night, or too close for a bus): fall back to walking directions
    if (modeUsed === 'transit' && response.data.status === 'ZERO_RESULTS') {
      modeUsed = 'walking';
      response = await ask('walking');
    }

    if (response.data.status === 'OK' && response.data.routes.length > 0) {
      const route = response.data.routes[0];
      const leg = route.legs[0];

      const steps = leg.steps.map(step => {
        const item = {
          travel_mode: step.travel_mode,
          duration: step.duration.text,
          distance: step.distance.text,
          // Google puts extra notes in <div>s ("Pass by Chase Bank"); keep them as separate sentences
          instructions: step.html_instructions.replace(/<div[^>]*>/gi, '. ').replace(/<[^>]*>?/gm, '').replace(/\s+\./g, '.').replace(/\s+/g, ' ').trim(),
          polyline: step.polyline ? step.polyline.points : '',
          start_location: step.start_location,
          end_location: step.end_location
        };

        if (step.transit_details) {
          const td = step.transit_details;
          item.transit = {
            line_name: td.line.short_name || td.line.name,
            vehicle: td.line.vehicle.name,
            icon: td.line.vehicle.icon || '',
            departure_stop: td.departure_stop.name,
            arrival_stop: td.arrival_stop.name,
            departure_time: td.departure_time.text,
            arrival_time: td.arrival_time.text,
            num_stops: td.num_stops,
            departure_location: td.departure_stop.location,
            arrival_location: td.arrival_stop.location
          };
        }
        return item;
      });

      return res.json({
        success: true,
        mode_used: modeUsed,
        summary: {
          departure_time: leg.departure_time ? leg.departure_time.text : 'Now',
          arrival_time: leg.arrival_time ? leg.arrival_time.text : '',
          duration: leg.duration.text,
          distance: leg.distance.text,
          start_address: leg.start_address,
          end_address: leg.end_address,
          overview_polyline: route.overview_polyline ? route.overview_polyline.points : ''
        },
        steps
      });
    } else {
      return res.json({ success: false, error: response.data.error_message || `No transit routes found (${response.data.status})` });
    }
  } catch (err) {
    console.error('Transit directions error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to fetch transit directions.' });
  }
});


// ------------------------------------------------------------
// Chatbot-only normalized job context
// Does NOT change the existing /api/jobs behavior.
// ------------------------------------------------------------
app.get('/api/chat/jobs', (req, res) => {
  try {
    const normalizedGigs = activeGigs.map(gig => ({
      id: gig.id || '',
      title: gig.title || '',
      company: '',
      location: '',
      pay: gig.pay || '',
      requirements: [],
      description: gig.summary || '',
      safety: gig.safety || '',
      url: gig.url || '',
      postedAt: gig.postedAt || '',
      source: 'vetted_gig'
    }));

    const normalizedPostedJobs = inMemoryJobs.map(job => ({
      id: job.id || '',
      title: job.title || '',
      company: job.company || '',
      location: job.location || '',
      pay: job.pay || '',
      requirements: Array.isArray(job.requirements)
        ? job.requirements
        : (job.requirements ? [job.requirements] : []),
      description: job.description || '',
      safety: '',
      url: job.url || '',
      postedAt: job.postedAt || '',
      source: 'northstar_posted_job'
    }));

    const jobs = [
      ...normalizedPostedJobs,
      ...normalizedGigs
    ];

    res.json({
      success: true,
      count: jobs.length,
      jobs
    });

  } catch (err) {
    console.error('Chat job context error:', err);

    res.status(500).json({
      success: false,
      error: 'Could not load current job context.'
    });
  }
});

// API Endpoint: Get active job opportunities (Optionally filtered by user_id for volunteers)
app.get('/api/jobs', async (req, res) => {
  const userId = req.query.userId || req.query.user_id;
  const isVolunteer = req.query.role === 'volunteer';
  const viewerId = tokenUserId(req);
  // Others see an opaque poster key (for blocking), never the author's account id
  const shape = (j) => ({ ...j, poster_key: posterKey(j.authorId), authorId: viewerId && viewerId === j.authorId ? j.authorId : undefined });
  const visible = (j) => !isHiddenContent('job', j.id);

  if (supabase) {
    try {
      let query = supabase.from('jobs').select('*').order('created_at', { ascending: false });
      if (isVolunteer) {
        if (!userId) {
          return res.json({ success: true, jobs: [] });
        }
        query = query.eq('author_id', userId);
      }
      const { data, error } = await query;
      if (!error && data) {
        const formattedJobs = data.map(j => ({
          id: j.id,
          title: j.title,
          company: j.company || '',
          location: j.location || '',
          type: j.type || '',
          pay: j.pay || '',
          requirements: typeof j.requirements === 'string' ? JSON.parse(j.requirements) : (Array.isArray(j.requirements) ? j.requirements : []),
          description: j.description || '',
          contact: j.contact || '',
          authorId: j.author_id,
          postedAt: j.created_at
        }));
        return res.json({ success: true, jobs: formattedJobs.filter(visible).map(shape) });
      }
    } catch (err) {
      console.warn('Supabase fetch jobs error, falling back to memory:', err.message);
    }
  }

  let filteredJobs = inMemoryJobs;
  if (isVolunteer) {
    if (!userId) {
      filteredJobs = [];
    } else {
      filteredJobs = inMemoryJobs.filter(j => j.authorId === userId);
    }
  }

  res.json({ success: true, jobs: filteredJobs.filter(visible).map(shape) });
});

// API Endpoint: Post a new job opportunity (Helper Funnel) with Supabase persistence

// Runs one resume generation. Resolves to { status, body } (never rejects).
async function runResumeGeneration(confirmed) {
  try {
    const northstarAiUrl = String(process.env.NORTHSTAR_AI_URL || '').trim().replace(/\/+$/, '');

    // ── Remote HTTP path ──────────────────────────────────────────────────
    if (northstarAiUrl) {
      if (!process.env.NORTHSTAR_AI_KEY) {
        console.error('Error: NORTHSTAR_AI_URL is set but NORTHSTAR_AI_KEY is missing.');
        return { status: 500, body: { success: false, error: 'Remote AI service is not configured correctly.' } };
      }

      console.log(`🌐 [Resume] Forwarding to remote AI service: ${northstarAiUrl}/resume`);

      const controller = new AbortController();
      const resumeTimeout = setTimeout(() => controller.abort(), 360000); // 360 s

      let aiResponse;
      try {
        aiResponse = await fetch(`${northstarAiUrl}/resume`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-NorthStar-AI-Key': process.env.NORTHSTAR_AI_KEY
          },
          body: JSON.stringify(confirmed),
          signal: controller.signal
        });
      } catch (fetchErr) {
        clearTimeout(resumeTimeout);
        if (fetchErr.name === 'AbortError') {
          return { status: 504, body: { success: false, error: 'NorthStar AI took too long to respond. Please try again.' } };
        }
        // DNS failure, refused connection, dead tunnel: the AI service is offline
        console.error('Resume AI service unreachable:', fetchErr.cause?.code || fetchErr.message);
        return { status: 503, body: { success: false, error: 'The resume writer is offline right now. Your answers are kept, so please try again later.' } };
      }
      clearTimeout(resumeTimeout);

      let result;
      try {
        result = await aiResponse.json();
      } catch (parseErr) {
        // Tunnels answer with an HTML error page when the AI app behind them is down
        console.error(`Resume AI service returned HTTP ${aiResponse.status} without JSON`);
        return { status: 503, body: { success: false, error: 'The resume writer is offline right now. Your answers are kept, so please try again later.' } };
      }

      if (!result.success) {
        return {
          status: 422,
          body: { success: false, error: 'The generated resume did not pass factuality validation.', validation: result.validation }
        };
      }

      return {
        status: 200,
        body: { success: true, resume: result.resume, repairs: result.repairs, validation: result.validation }
      };
    }

    // ── Local Python spawn fallback ────────────────────────────────────────
    return await new Promise((resolve) => {
      let settled = false;
      const done = (status, body) => { if (!settled) { settled = true; resolve({ status, body }); } };

      const child = spawn(NORTHSTAR_AI_PYTHON, [NORTHSTAR_RESUME_PIPELINE], { cwd: NORTHSTAR_AI_DIR });

      let stdout = '';
      let stderr = '';

      // Timeout to prevent hanging forever
      const timeout = setTimeout(() => {
        console.error('Resume AI process timed out. Killing child process.');
        child.kill('SIGKILL');
        done(504, { success: false, error: 'NorthStar AI took too long to respond. Please try again.' });
      }, 115000);

      child.stdout.on('data', (data) => { stdout += data.toString(); });
      child.stderr.on('data', (data) => { stderr += data.toString(); });

      child.on('error', (err) => {
        clearTimeout(timeout);
        console.error('Resume AI process error:', err);
        done(500, { success: false, error: 'Could not start NorthStar AI.' });
      });

      child.on('close', (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
          console.error('Resume AI stderr:', stderr);
          return done(500, { success: false, error: 'NorthStar AI resume generation failed.' });
        }
        try {
          const result = JSON.parse(stdout);
          if (!result.success) {
            return done(422, { success: false, error: 'The generated resume did not pass factuality validation.', validation: result.validation });
          }
          return done(200, { success: true, resume: result.resume, repairs: result.repairs, validation: result.validation });
        } catch (parseError) {
          console.error('Resume AI JSON parse error:', parseError);
          console.error('Raw output:', stdout);
          return done(500, { success: false, error: 'NorthStar AI returned an invalid response.' });
        }
      });

      child.stdin.write(JSON.stringify(confirmed));
      child.stdin.end();
    });
  } catch (error) {
    console.error('Resume endpoint error:', error);
    return { status: 500, body: { success: false, error: 'Resume generation failed.' } };
  }
}

app.post('/api/generate-resume', async (req, res) => {
  console.log('✅ /api/generate-resume called');
  // Resume answers are personal (name, phone, history); never write them to the logs
  const { status, body } = await runResumeGeneration(req.body);
  if (!res.headersSent) res.status(status).json(body);
});

// ── Background resume jobs ───────────────────────────────────────────────
// The resume keeps being written on the server even if the person leaves the
// Resume page. The app polls the job and picks up the result from any page.
const resumeJobs = new Map();
const RESUME_JOB_KEEP_MS = 60 * 60 * 1000; // keep finished results for an hour

function pruneResumeJobs() {
  const now = Date.now();
  for (const [id, job] of resumeJobs) {
    if (job.finishedAt && now - job.finishedAt > RESUME_JOB_KEEP_MS) resumeJobs.delete(id);
    else if (!job.finishedAt && now - job.startedAt > 2 * RESUME_JOB_KEEP_MS) resumeJobs.delete(id);
  }
}

app.post('/api/resume-jobs', (req, res) => {
  pruneResumeJobs();
  const confirmed = req.body;
  if (!confirmed || typeof confirmed !== 'object' || !confirmed.name) {
    return res.status(400).json({ success: false, error: 'Please enter your name.' });
  }
  const id = 'rj_' + crypto.randomBytes(12).toString('hex');
  const job = { id, status: 'running', startedAt: Date.now(), finishedAt: null, httpStatus: null, result: null };
  resumeJobs.set(id, job);
  console.log(`✅ [Resume] Background job ${id} started`);
  runResumeGeneration(confirmed).then(({ status, body }) => {
    job.status = body && body.success ? 'done' : 'failed';
    job.httpStatus = status;
    job.result = body;
    job.finishedAt = Date.now();
    console.log(`✅ [Resume] Background job ${id} ${job.status}`);
  });
  res.status(202).json({ success: true, jobId: id, status: job.status });
});

app.get('/api/resume-jobs/:id', (req, res) => {
  const job = resumeJobs.get(String(req.params.id || ''));
  if (!job) return res.status(404).json({ success: false, status: 'missing', error: 'That resume job was not found.' });
  res.set('Cache-Control', 'no-store');
  res.json({ success: true, jobId: job.id, status: job.status, startedAt: job.startedAt, result: job.result });
});



app.post('/api/jobs', async (req, res) => {
  try {
    const { title, company, location, type, pay, requirements, description, contact } = req.body || {};
    if (!title || !contact) {
      return res.status(400).json({ error: 'Title and contact details are required.' });
    }
    if (hasObjectionable(title, company, location, type, pay, requirements, description, contact)) {
      return res.status(400).json({ error: 'Please remove offensive words and try again.' });
    }
    // The author is whoever the session token proves, never a name sent in the body
    const authorId = tokenUserId(req) || 'anonymous_volunteer';

    // Only what the poster typed (same shape GET /api/jobs returns); no invented pay or company
    const newJob = {
      id: `job-${Date.now()}`,
      title,
      company: company || '',
      location: location || '',
      type: type || '',
      pay: pay || '',
      requirements: Array.isArray(requirements) ? requirements.filter(Boolean) : (requirements ? [requirements] : []),
      description: description || '',
      contact,
      authorId,
      postedAt: new Date().toISOString()
    };

    inMemoryJobs.unshift(newJob);

    if (supabase) {
      try {
        const { error: sbErr } = await supabase.from('jobs').insert([{
          id: newJob.id,
          title: newJob.title,
          company: newJob.company,
          location: newJob.location,
          type: newJob.type,
          pay: newJob.pay,
          requirements: newJob.requirements,
          description: newJob.description,
          contact: newJob.contact,
          author_id: newJob.authorId || null,
          created_at: newJob.postedAt
        }]);
        if (!sbErr) {
          console.log('⚡ Saved new job to Supabase database table!');
        } else {
          console.warn('Supabase DB insertion notice:', sbErr.message);
        }
      } catch (sbErr) {
        console.warn('Supabase DB insertion notice:', sbErr.message);
      }
    }

    console.log('✅ New Job Posted:', newJob.title);
    res.json({ success: true, job: newJob, total: inMemoryJobs.length });
  } catch (err) {
    console.error('Error posting job:', err);
    res.status(500).json({ error: 'Failed to post job opportunity.' });
  }
});

// API Endpoint: Delete a job opportunity (Helper/Volunteer Funnel). Only the signed-in author can.
app.delete('/api/jobs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = tokenUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: 'Please log in again.' });

    let found = false;
    const index = inMemoryJobs.findIndex(j => j.id === id);
    if (index !== -1) {
      if (inMemoryJobs[index].authorId !== userId) return res.status(403).json({ success: false, error: 'You can only delete jobs you posted.' });
      inMemoryJobs.splice(index, 1);
      found = true;
    }

    if (supabase) {
      try {
        const { data, error } = await supabase.from('jobs').delete().eq('id', id).eq('author_id', userId).select('id');
        if (error) throw error;
        if (data && data.length) found = true;
        else if (!found) {
          const { data: other } = await supabase.from('jobs').select('id').eq('id', id).maybeSingle();
          if (other) return res.status(403).json({ success: false, error: 'You can only delete jobs you posted.' });
        }
      } catch (sbErr) {
        console.warn('Supabase DB delete notice:', sbErr.message);
      }
    }

    if (!found) return res.status(404).json({ success: false, error: 'Job not found.' });
    res.json({ success: true, message: 'Job deleted successfully.' });
  } catch (err) {
    console.error('Error deleting job:', err);
    res.status(500).json({ error: 'Failed to delete job.' });
  }
});

// ============================================================
// Accounts and per-user data (Supabase)
// Accounts live in the `profiles` table (scrypt password hash). Each person's app data
// (resume, progress, saved places, chats) is one private JSON file in Supabase Storage,
// readable only through these endpoints with the signed token handed out at login.
const USER_BUCKET = 'northstar-user-data';
const APP_BUCKET_PATH = 'app/gigs.json';
const TOKEN_SECRET = crypto.createHmac('sha256', String(supabaseServiceKey || process.env.SESSION_SECRET || 'northstar-dev'))
  .update('northstar-session-v1').digest();
// Tokens slide forward via /api/auth/refresh while the person is active. The app logs out
// after 5 minutes idle; the token gets a small margin past that so a last save still lands.
const TOKEN_TTL_MS = 7 * 60 * 1000;
let userBucketReady = null;

function ensureUserBucket() {
  if (!supabase) return Promise.resolve(false);
  if (!userBucketReady) {
    userBucketReady = (async () => {
      const { data } = await supabase.storage.getBucket(USER_BUCKET);
      if (data) return true;
      const { error } = await supabase.storage.createBucket(USER_BUCKET, { public: false, fileSizeLimit: 2 * 1024 * 1024 });
      if (error && !/exists/i.test(error.message)) throw error;
      return true;
    })().catch(err => { userBucketReady = null; console.warn('User data bucket notice:', err.message); return false; });
  }
  return userBucketReady;
}

async function readStorageJson(objectPath) {
  if (!(await ensureUserBucket())) return null;
  const { data, error } = await supabase.storage.from(USER_BUCKET).download(objectPath);
  if (error || !data) return null;
  try { return JSON.parse(await data.text()); } catch (e) { return null; }
}

async function writeStorageJson(objectPath, value) {
  if (!(await ensureUserBucket())) throw new Error('storage unavailable');
  const body = Buffer.from(JSON.stringify(value), 'utf8');
  const { error } = await supabase.storage.from(USER_BUCKET).upload(objectPath, body, { contentType: 'application/json', upsert: true });
  if (error) throw error;
}

async function loadGigsCache() {
  try {
    const cached = await readStorageJson(APP_BUCKET_PATH);
    if (cached && Array.isArray(cached.gigs)) {
      activeGigs = cached.gigs;
      gigsScrapedAt = Number(cached.scrapedAt) || 0;
      console.log(`📦 Loaded ${activeGigs.length} gigs from the last scrape.`);
    }
  } catch (e) {}
}

function saveGigsCache() {
  writeStorageJson(APP_BUCKET_PATH, { scrapedAt: gigsScrapedAt, gigs: activeGigs })
    .catch(err => console.warn('Gig cache save notice:', err.message));
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 32).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function checkPassword(password, stored) {
  if (!stored) return false;
  const pw = String(password);
  if (stored.startsWith('scrypt$')) {
    const [, salt, hash] = stored.split('$');
    const test = crypto.scryptSync(pw, salt, 32);
    const expected = Buffer.from(hash, 'hex');
    return expected.length === test.length && crypto.timingSafeEqual(expected, test);
  }
  // Older accounts: plain SHA-256 (upgraded to scrypt on their next login)
  const legacy = crypto.createHash('sha256').update(pw).digest('hex');
  return legacy === stored;
}

function signToken(userId) {
  const now = Date.now();
  const payload = Buffer.from(JSON.stringify({ id: userId, iat: now, exp: now + TOKEN_TTL_MS })).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  if (!sig || sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const now = Date.now();
    return data && data.id && data.iat && (now - data.iat) < TOKEN_TTL_MS && data.exp > now ? data : null;
  } catch (e) {
    return null;
  }
}

// The account id proven by a valid session token in the Authorization header, or null
function tokenUserId(req) {
  const auth = req.headers.authorization || '';
  const data = verifyToken(auth.startsWith('Bearer ') ? auth.slice(7) : '');
  return data ? data.id : null;
}

function requireUser(req, res) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : (req.body && req.body.token);
  const data = verifyToken(token);
  if (!data || data.id !== req.params.id) {
    res.status(401).json({ success: false, error: 'Please log in again.' });
    return null;
  }
  return data.id;
}

// ---- Safety for posts people share with each other (App Review Guideline 1.2) ----------------
// Jobs and pickup requests are written by volunteers and shown to others, so posts are filtered,
// anyone signed in can report one, three different reporters hide it until a moderator looks,
// and each poster has an opaque key that people can block.
const BLOCKED_TERMS = /\b(f+u+c+k+\w*|sh+i+t+\w*|cunts?|bitch\w*|whores?|sluts?|porn\w*|nudes?|n+i+g+g+(a|er)s?|fag(got)?s?|retards?|kys)\b/i;
function hasObjectionable(...values) {
  return values.flat().some(v => typeof v === 'string' && BLOCKED_TERMS.test(v));
}
const REPORTS_TO_HIDE = 3;
const MODERATION_PATH = 'app/moderation.json';
let moderation = { hidden: {}, reporters: {} };
const contentKey = (kind, id) => `${kind}:${id}`;
const isHiddenContent = (kind, id) => !!moderation.hidden[contentKey(kind, id)];
async function loadModeration() {
  try {
    const saved = await readStorageJson(MODERATION_PATH);
    if (saved && typeof saved === 'object') moderation = { hidden: saved.hidden || {}, reporters: saved.reporters || {} };
  } catch (e) {}
}
async function saveModeration() {
  try { await writeStorageJson(MODERATION_PATH, moderation); } catch (e) { console.warn('Moderation save notice:', e.message); }
}
// Stable, non-reversible id for blocking a poster without exposing their account id
function posterKey(userId) {
  return userId ? crypto.createHmac('sha256', TOKEN_SECRET).update('poster:' + userId).digest('hex').slice(0, 16) : null;
}
function moderatorAllowed(req) {
  const key = process.env.MODERATION_KEY || '';
  const given = String(req.headers['x-moderation-key'] || '');
  return key.length >= 16 && given.length === key.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(key));
}

app.post('/api/reports', async (req, res) => {
  const reporter = tokenUserId(req);
  if (!reporter) return res.status(401).json({ success: false, error: 'Please log in to report a post.' });
  const kind = req.body && req.body.kind;
  const id = String((req.body && req.body.id) || '').slice(0, 80);
  const reason = String((req.body && req.body.reason) || '').replace(/\s+/g, ' ').trim().slice(0, 500);
  if (!['job', 'delivery'].includes(kind) || !id) return res.status(400).json({ success: false, error: 'Choose a post to report.' });
  const key = contentKey(kind, id);
  const reporters = new Set(moderation.reporters[key] || []);
  reporters.add(reporter);
  moderation.reporters[key] = [...reporters];
  if (reporters.size >= REPORTS_TO_HIDE) moderation.hidden[key] = { at: new Date().toISOString(), by: 'reports' };
  const record = { kind, id, reason, reporter, createdAt: new Date().toISOString() };
  console.log(`🚩 Report on ${key} (${reporters.size} reporter${reporters.size === 1 ? '' : 's'})`);
  try {
    await writeStorageJson(`reports/${Date.now()}-${crypto.randomBytes(4).toString('hex')}.json`, record);
  } catch (e) {
    console.warn('Report save notice:', e.message);
  }
  await saveModeration();
  res.json({ success: true, hidden: !!moderation.hidden[key] });
});

// Moderators (MODERATION_KEY) review reports and hide or restore posts
app.get('/api/moderation', async (req, res) => {
  if (!moderatorAllowed(req)) return res.status(403).json({ success: false });
  let reports = [];
  try {
    const { data } = await supabase.storage.from(USER_BUCKET).list('reports', { limit: 200, sortBy: { column: 'name', order: 'desc' } });
    reports = await Promise.all((data || []).slice(0, 100).map(f => readStorageJson(`reports/${f.name}`)));
  } catch (e) {}
  res.set('Cache-Control', 'no-store');
  res.json({ success: true, hidden: moderation.hidden, reports: reports.filter(Boolean) });
});
app.post('/api/moderation', async (req, res) => {
  if (!moderatorAllowed(req)) return res.status(403).json({ success: false });
  const { kind, id, hidden } = req.body || {};
  if (!['job', 'delivery'].includes(kind) || !id) return res.status(400).json({ success: false });
  const key = contentKey(kind, String(id));
  if (hidden) moderation.hidden[key] = { at: new Date().toISOString(), by: 'moderator' };
  else { delete moderation.hidden[key]; delete moderation.reporters[key]; }
  await saveModeration();
  res.json({ success: true });
});

// ---- Account deletion (App Review Guideline 5.1.1(v)) ----------------------------------------
// Removes the account, its saved app data and the posts it made. Pickups other people are
// already handling are kept but no longer linked to the deleted account.
app.delete('/api/account', async (req, res) => {
  const userId = tokenUserId(req);
  if (!userId) return res.status(401).json({ success: false, error: 'Please log in again.' });
  if (!supabase) return res.status(503).json({ success: false, error: 'Accounts are unavailable right now. Try again soon.' });
  try {
    await supabase.from('jobs').delete().eq('author_id', userId);
    await supabase.from('deliveries').delete().eq('donor_id', userId).eq('status', 'pending_driver');
    await supabase.from('deliveries').update({ donor_id: null, contactNotes: null }).eq('donor_id', userId);
    await supabase.from('deliveries').update({ driver_id: null, driverName: null, status: 'pending_driver' })
      .eq('driver_id', userId).in('status', ['driver_assigned', 'in_transit']);
    await supabase.from('deliveries').update({ driver_id: null, driverName: null }).eq('driver_id', userId);
    if (await ensureUserBucket()) await supabase.storage.from(USER_BUCKET).remove([`users/${userId}.json`]);
    const { error } = await supabase.from('profiles').delete().eq('id', userId);
    if (error) throw error;
    for (let i = inMemoryJobs.length - 1; i >= 0; i--) if (inMemoryJobs[i].authorId === userId) inMemoryJobs.splice(i, 1);
    activeDeliveries = activeDeliveries.filter(d => !(d.donor_id === userId && d.status === 'pending_driver'));
    console.log('🗑️  Account deleted:', userId);
    res.json({ success: true });
  } catch (err) {
    console.warn('Account deletion error:', err.message);
    res.status(500).json({ success: false, error: 'Couldn’t delete your account right now. Please try again.' });
  }
});

function cleanUsername(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 60);
}

function publicProfile(p) {
  return { id: p.id, username: p.username, full_name: p.username, role: p.role === 'volunteer' ? 'volunteer' : 'seeker' };
}

async function findProfilesByUsername(username) {
  // Case-insensitive exact match (escape LIKE wildcards)
  const pattern = username.replace(/[\\%_]/g, ch => '\\' + ch);
  const { data, error } = await supabase.from('profiles').select('id, username, role, pass_hash').ilike('username', pattern).limit(10);
  if (error) throw error;
  return data || [];
}

app.post('/api/auth/signup', async (req, res) => {
  if (!supabase) return res.status(503).json({ success: false, error: 'Accounts are unavailable right now. Try again soon.' });
  const username = cleanUsername(req.body && req.body.username);
  const password = String((req.body && req.body.password) || '');
  const role = req.body && req.body.role === 'volunteer' ? 'volunteer' : 'seeker';
  if (username.length < 2) return res.status(400).json({ success: false, error: 'Please enter your name.' });
  if (password.length < 4) return res.status(400).json({ success: false, error: 'Password must be at least 4 characters.' });
  try {
    const existing = await findProfilesByUsername(username);
    if (existing.length) return res.status(409).json({ success: false, error: 'That username is already taken. Try logging in instead.' });
    const id = 'user_' + username.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 30) + '_' + crypto.randomBytes(3).toString('hex');
    const row = { id, username, role, pass_hash: hashPassword(password), updated_at: new Date().toISOString() };
    const { error } = await supabase.from('profiles').insert(row);
    if (error) throw error;
    res.json({ success: true, user: publicProfile(row), token: signToken(id) });
  } catch (err) {
    console.warn('Signup error:', err.message);
    res.status(500).json({ success: false, error: 'Couldn’t create your account. Check your connection and try again.' });
  }
});

// Brute-force protection. Passwords can be as short as 4 characters and older accounts can be
// claimed with their id, so failed guesses are capped per username and per IP address.
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILS_PER_NAME = 8;
const LOGIN_MAX_FAILS_PER_IP = 50;
const loginFailures = new Map(); // key -> { count, resetAt }

function isLoopback(ip) {
  return ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1';
}
function loginKeys(req, username) {
  const keys = [{ key: 'name:' + username.toLowerCase(), max: LOGIN_MAX_FAILS_PER_NAME }];
  if (!isLoopback(req.ip)) keys.push({ key: 'ip:' + req.ip, max: LOGIN_MAX_FAILS_PER_IP });
  return keys;
}
function loginBlocked(req, username) {
  const now = Date.now();
  return loginKeys(req, username).some(({ key, max }) => {
    const entry = loginFailures.get(key);
    if (entry && entry.resetAt <= now) { loginFailures.delete(key); return false; }
    return !!entry && entry.count >= max;
  });
}
function recordLoginFailure(req, username) {
  const now = Date.now();
  if (loginFailures.size > 10000) {
    for (const [k, v] of loginFailures) if (v.resetAt <= now) loginFailures.delete(k);
  }
  for (const { key } of loginKeys(req, username)) {
    const entry = loginFailures.get(key);
    if (!entry || entry.resetAt <= now) loginFailures.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    else entry.count++;
  }
}

app.post('/api/auth/login', async (req, res) => {
  if (!supabase) return res.status(503).json({ success: false, error: 'Accounts are unavailable right now. Try again soon.' });
  const username = cleanUsername(req.body && req.body.username);
  const password = String((req.body && req.body.password) || '');
  if (!username || !password) return res.status(400).json({ success: false, error: 'Enter your username and password.' });
  if (loginBlocked(req, username)) {
    return res.status(429).json({ success: false, error: 'Too many tries. Wait 15 minutes, then try again.' });
  }
  // Any response other than a successful login counts as a failed guess
  const origJson = res.json.bind(res);
  res.json = (body) => {
    if (body && body.success) loginFailures.delete('name:' + username.toLowerCase());
    else if (res.statusCode === 401 || res.statusCode === 404 || res.statusCode === 409) recordLoginFailure(req, username);
    return origJson(body);
  };
  try {
    const matches = await findProfilesByUsername(username);
    if (!matches.length) return res.status(404).json({ success: false, error: 'No account found with that username.' });
    let profile = matches.find(p => checkPassword(password, p.pass_hash));
    if (!profile) {
      // Accounts from the phone-only build have no password stored here yet. The phone that
      // made the account proves it (its saved record matched this password and id), and the
      // password is stored from now on.
      const legacyId = String((req.body && req.body.legacyId) || '');
      const unclaimed = legacyId && matches.find(p => !p.pass_hash && p.id === legacyId);
      if (unclaimed) {
        const { error } = await supabase.from('profiles').update({ pass_hash: hashPassword(password), updated_at: new Date().toISOString() }).eq('id', unclaimed.id).is('pass_hash', null);
        if (error) throw error;
        return res.json({ success: true, user: publicProfile(unclaimed), token: signToken(unclaimed.id) });
      }
      if (matches.every(p => !p.pass_hash)) {
        return res.status(409).json({ success: false, error: 'This account was made before passwords were saved online. Log in once on the phone you made it on, or create a new account.' });
      }
      return res.status(401).json({ success: false, error: 'Wrong password. Please try again.' });
    }
    if (!profile.pass_hash.startsWith('scrypt$')) {
      supabase.from('profiles').update({ pass_hash: hashPassword(password), updated_at: new Date().toISOString() }).eq('id', profile.id)
        .then(({ error }) => { if (error) console.warn('Password upgrade notice:', error.message); });
    }
    res.json({ success: true, user: publicProfile(profile), token: signToken(profile.id) });
  } catch (err) {
    console.warn('Login error:', err.message);
    res.status(500).json({ success: false, error: 'Couldn’t log in. Check your connection and try again.' });
  }
});

const USER_ID_RE = /^[A-Za-z0-9_.@-]{3,120}$/;

// Sliding session: while the person is active the app swaps its token for a fresh one.
// After 5 minutes with no activity the token expires and they must log in again.
app.post('/api/auth/refresh', (req, res) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : (req.body && req.body.token);
  const data = verifyToken(token);
  if (!data) return res.status(401).json({ success: false, error: 'Please log in again.' });
  res.json({ success: true, token: signToken(data.id) });
});

app.get('/api/user-data/:id', async (req, res) => {
  if (!USER_ID_RE.test(req.params.id)) return res.status(400).json({ success: false });
  const id = requireUser(req, res);
  if (!id) return;
  const doc = await readStorageJson(`users/${id}.json`);
  res.json({ success: true, updatedAt: (doc && doc.updatedAt) || 0, data: (doc && doc.data) || {} });
});

app.put('/api/user-data/:id', async (req, res) => {
  if (!USER_ID_RE.test(req.params.id)) return res.status(400).json({ success: false });
  const id = requireUser(req, res);
  if (!id) return;
  const data = req.body && req.body.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return res.status(400).json({ success: false, error: 'Nothing to save.' });
  // Only string values (they mirror the phone's saved keys)
  const clean = {};
  for (const [k, v] of Object.entries(data)) {
    if (typeof k === 'string' && k.length <= 80 && (typeof v === 'string' || v === null)) clean[k] = v;
  }
  try {
    const updatedAt = Date.now();
    await writeStorageJson(`users/${id}.json`, { updatedAt, data: clean });
    res.json({ success: true, updatedAt });
  } catch (err) {
    console.warn('User data save notice:', err.message);
    res.status(500).json({ success: false, error: 'Couldn’t save right now.' });
  }
});

// User Profiles API: only the signed-in owner can read or change their own profile,
// and the password hash never leaves the server.
app.get('/api/profiles/:id', async (req, res) => {
  const userId = tokenUserId(req);
  if (!userId || userId !== req.params.id) return res.status(401).json({ success: false, error: 'Please log in again.' });
  if (supabase) {
    try {
      const { data, error } = await supabase.from('profiles').select('id, username, role, theme').eq('id', userId).single();
      if (!error && data) {
        return res.json({ success: true, profile: { ...publicProfile(data), theme: data.theme || null } });
      }
    } catch (err) {
      console.warn('Supabase fetch profile notice:', err.message);
    }
  }
  res.status(404).json({ success: false, error: 'Profile not found' });
});

app.post('/api/profiles', async (req, res) => {
  const { id, role, theme } = req.body || {};
  if (!id) return res.status(400).json({ success: false, error: 'User id is required' });
  const userId = tokenUserId(req);
  if (!userId || userId !== id) return res.status(401).json({ success: false, error: 'Please log in again.' });
  if (!supabase) return res.status(503).json({ success: false, error: 'Accounts are unavailable right now.' });

  // Usernames are set at signup (where uniqueness is checked); here only preferences change
  const payload = { updated_at: new Date().toISOString() };
  if (role === 'seeker' || role === 'volunteer') payload.role = role;
  if (typeof theme === 'string' && theme.length <= 20) payload.theme = theme;
  try {
    const { data, error } = await supabase.from('profiles').update(payload).eq('id', userId).select('id, username, role, theme').single();
    if (error) throw error;
    return res.json({ success: true, profile: { ...publicProfile(data), theme: data.theme || null } });
  } catch (err) {
    console.warn('Supabase profile update notice:', err.message);
    return res.status(500).json({ success: false, error: 'Couldn’t save right now.' });
  }
});

// API Endpoint: Create Stripe Checkout Session for Donations
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const rawAmount = parseFloat(req.body.amount);
    const amount = !isNaN(rawAmount) && rawAmount > 0 ? rawAmount : 25;
    const amountInCents = Math.round(amount * 100);

    if (!stripe) {
      // No pretend checkout: say plainly that card donations aren't available
      return res.status(503).json({ success: false, error: 'Card donations aren’t set up yet. Nothing was charged.' });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Northstar Community Donation',
              description: 'Direct financial support for local shelters and emergency food initiatives.',
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${req.protocol}://${req.get('host')}/donate.html?status=success&session_id={CHECKOUT_SESSION_ID}&amount=${amount}`,
      cancel_url: `${req.protocol}://${req.get('host')}/donate.html?status=cancel`,
    });

    res.json({ success: true, id: session.id, url: session.url });
  } catch (err) {
    console.error('⚠️ Stripe Checkout Notice:', err.message);
    res.status(502).json({ success: false, error: 'We couldn’t open checkout. Nothing was charged. Try again in a moment.' });
  }
});

// API Endpoints: Food Delivery Pickup Queue & Uber Tracking
// Pickup requests are listed for every volunteer, but the donor's account id and free-text
// contact notes are only shown to that donor and to the volunteer who claimed the pickup.
function redactDelivery(d, viewerId) {
  if (!d) return d;
  const involved = viewerId && (d.donor_id === viewerId || d.driver_id === viewerId);
  const withKey = { ...d, poster_key: posterKey(d.donor_id) };
  return involved ? withKey : { ...withKey, donor_id: null, contactNotes: null };
}
const visibleDelivery = (d) => d && !isHiddenContent('delivery', d.id);

app.get('/api/deliveries', async (req, res) => {
  const viewerId = tokenUserId(req);
  if (supabase) {
    try {
      const { data, error } = await supabase.from('deliveries').select('*').order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
        const formatted = data.map(d => ({
          id: d.id,
          items: typeof d.items === 'string' ? (d.items.startsWith('[') ? JSON.parse(d.items) : [d.items]) : (Array.isArray(d.items) ? d.items : [d.items]),
          bags: d.bags || 1,
          donorArea: d.donorArea || 'Seattle Area',
          destination: d.destination || 'St. Jude Community Refuge',
          timeWindow: d.timeWindow || 'ASAP',
          status: d.status || 'pending_driver',
          driverName: d.driverName || null,
          driver_id: d.driver_id || null,
          donor_id: d.donor_id || null,
          etaMinutes: d.etaMinutes || 20,
          contactNotes: d.contactNotes || 'Contact donor upon arrival',
          created_at: d.created_at,
          claimed_at: d.claimed_at,
          updated_at: d.updated_at
        }));
        activeDeliveries = formatted;
        return res.json({ success: true, deliveries: formatted.filter(visibleDelivery).map(d => redactDelivery(d, viewerId)) });
      }
    } catch (err) {
      console.warn('Supabase fetch deliveries failed, falling back to memory', err);
    }
  }
  res.json({ success: true, deliveries: activeDeliveries.filter(visibleDelivery).map(d => redactDelivery(d, viewerId)) });
});

app.get('/api/deliveries/:id', async (req, res) => {
  const viewerId = tokenUserId(req);
  if (supabase) {
    try {
      const { data, error } = await supabase.from('deliveries').select('*').eq('id', req.params.id).single();
      if (!error && data) {
        const d = data;
        const formatted = {
          id: d.id,
          items: typeof d.items === 'string' ? (d.items.startsWith('[') ? JSON.parse(d.items) : [d.items]) : (Array.isArray(d.items) ? d.items : [d.items]),
          bags: d.bags || 1,
          donorArea: d.donorArea || 'Seattle Area',
          destination: d.destination || 'St. Jude Community Refuge',
          timeWindow: d.timeWindow || 'ASAP',
          status: d.status || 'pending_driver',
          driverName: d.driverName || null,
          driver_id: d.driver_id || null,
          donor_id: d.donor_id || null,
          etaMinutes: d.etaMinutes || 20,
          contactNotes: d.contactNotes || 'Contact donor upon arrival',
          created_at: d.created_at,
          claimed_at: d.claimed_at,
          updated_at: d.updated_at
        };
        return res.json({ success: true, delivery: redactDelivery(formatted, viewerId) });
      }
    } catch (err) {
      console.warn('Supabase fetch delivery failed, falling back to memory', err);
    }
  }
  const delivery = activeDeliveries.find(d => d.id === req.params.id);
  if (!delivery) {
    return res.status(404).json({ error: 'Delivery not found' });
  }
  res.json({ success: true, delivery: redactDelivery(delivery, viewerId) });
});

app.post('/api/deliveries', async (req, res) => {
  try {
    const { items, bags, donorArea, destination, timeWindow, contactNotes } = req.body;
    if (hasObjectionable(items, donorArea, timeWindow, contactNotes)) {
      return res.status(400).json({ success: false, error: 'Please remove offensive words and try again.' });
    }
    // The donor comes from the sign-in token (never the request body); guests donate anonymously
    const donor_id = tokenUserId(req);
    const newDelivery = {
      id: `del-${Date.now()}`,
      items: Array.isArray(items) ? items : [items || 'Food Items'],
      bags: bags || 1,
      donorArea: donorArea || 'Seattle Area',
      destination: destination || 'St. Jude Community Refuge',
      timeWindow: timeWindow || 'Morning (9am - 12pm)',
      status: 'pending_driver',
      driverName: null,
      driver_id: null,
      donor_id: donor_id || null,
      etaMinutes: 20,
      contactNotes: contactNotes || 'Contact donor upon arrival',
      created_at: new Date().toISOString()
    };
    
    if (supabase) {
      const supabaseDelivery = { 
        id: newDelivery.id,
        items: newDelivery.items,
        bags: newDelivery.bags,
        donorArea: newDelivery.donorArea,
        destination: newDelivery.destination,
        timeWindow: newDelivery.timeWindow,
        status: newDelivery.status,
        driverName: null,
        driver_id: null,
        donor_id: donor_id || null,
        etaMinutes: newDelivery.etaMinutes,
        contactNotes: newDelivery.contactNotes,
        created_at: newDelivery.created_at
      };
      const { error } = await supabase.from('deliveries').insert(supabaseDelivery);
      if (!error) {
        console.log('📦 New Real Food Pickup Request Added to Supabase:', newDelivery.id);
        activeDeliveries.unshift(newDelivery);
        return res.json({ success: true, delivery: newDelivery });
      }
      console.warn('Supabase insert delivery error:', error.message);
    }
    
    activeDeliveries.unshift(newDelivery);
    console.log('📦 New Real Food Pickup Request Added to memory:', newDelivery.id);
    res.json({ success: true, delivery: newDelivery, total: activeDeliveries.length });
  } catch (err) {
    console.error('Error adding delivery request:', err);
    res.status(500).json({ error: 'Failed to create delivery request.' });
  }
});

app.post('/api/deliveries/:id/claim', async (req, res) => {
  try {
    const { id } = req.params;
    const { driverName } = req.body || {};
    // The volunteer claiming is whoever the session token proves
    const driver_id = tokenUserId(req);
    if (!driver_id) {
      return res.status(401).json({ success: false, error: 'Sign in to claim a pickup.' });
    }
    
    const takenByOther = (d) => d && d.status !== 'pending_driver' && !(driver_id && d.driver_id === driver_id);

    if (supabase) {
      const { data: existing, error: getErr } = await supabase.from('deliveries').select('*').eq('id', id).single();
      if (!getErr && existing && takenByOther(existing)) {
        return res.status(409).json({ success: false, error: 'This pickup was already claimed by another volunteer.' });
      }
      if (!getErr && existing) {
        const updates = { 
          status: 'driver_assigned', 
          driverName: driverName || 'Volunteer Driver', 
          driver_id: driver_id || null,
          claimed_at: new Date().toISOString()
        };
        const { error: updErr } = await supabase.from('deliveries').update(updates).eq('id', id);
        if (!updErr) {
          console.log('🚚 Volunteer Claimed Delivery Route in Supabase:', id);
          const rawItems = existing.items;
          const parsedItems = typeof rawItems === 'string' ? (rawItems.startsWith('[') ? JSON.parse(rawItems) : [rawItems]) : (Array.isArray(rawItems) ? rawItems : [rawItems]);
          const updatedDel = {
            ...existing,
            ...updates,
            items: parsedItems
          };
          const idx = activeDeliveries.findIndex(d => d.id === id);
          if (idx !== -1) {
            activeDeliveries[idx] = { ...activeDeliveries[idx], ...updates };
          }
          return res.json({ success: true, delivery: updatedDel });
        } else {
          console.warn('Supabase update delivery claim error:', updErr.message);
        }
      }
    }
    
    const delivery = activeDeliveries.find(d => d.id === id);
    if (!delivery) {
      return res.status(404).json({ error: 'Delivery request not found.' });
    }
    if (takenByOther(delivery)) {
      return res.status(409).json({ success: false, error: 'This pickup was already claimed by another volunteer.' });
    }
    delivery.status = 'driver_assigned';
    delivery.driverName = driverName || 'Volunteer Driver';
    delivery.driver_id = driver_id || null;
    delivery.claimedAt = new Date().toISOString();
    console.log('🚚 Volunteer Claimed Delivery Route in memory:', id);
    res.json({ success: true, delivery });
  } catch (err) {
    console.error('Error claiming delivery:', err);
    res.status(500).json({ error: 'Failed to claim delivery.' });
  }
});

app.post('/api/deliveries/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    const VALID_DELIVERY_STATUSES = ['pending_driver', 'driver_assigned', 'in_transit', 'delivered', 'completed'];
    if (!status || !VALID_DELIVERY_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, error: `Invalid status. Use one of: ${VALID_DELIVERY_STATUSES.join(', ')}` });
    }
    // Only the volunteer who claimed this pickup can move it along
    const userId = tokenUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: 'Please log in again.' });

    if (supabase) {
      const { data: existing, error: getErr } = await supabase.from('deliveries').select('id, driver_id').eq('id', id).maybeSingle();
      if (!getErr && existing) {
        if (existing.driver_id !== userId) return res.status(403).json({ success: false, error: 'Only the volunteer who claimed this pickup can update it.' });
        const { error } = await supabase.from('deliveries').update({ status, updated_at: new Date().toISOString() }).eq('id', id).eq('driver_id', userId);
        if (!error) {
          console.log(`📦 Delivery ${id} status updated to: ${status} in Supabase`);
          const idx = activeDeliveries.findIndex(d => d.id === id);
          if (idx !== -1) {
            activeDeliveries[idx].status = status;
          }
          return res.json({ success: true, delivery: { id, status } });
        }
      }
    }

    const delivery = activeDeliveries.find(d => d.id === id);
    if (!delivery) {
      return res.status(404).json({ success: false, error: 'Delivery request not found.' });
    }
    if (delivery.driver_id !== userId) return res.status(403).json({ success: false, error: 'Only the volunteer who claimed this pickup can update it.' });
    delivery.status = status;
    delivery.updatedAt = new Date().toISOString();
    console.log(`📦 Delivery ${id} status updated to: ${delivery.status} in memory`);
    res.json({ success: true, delivery });
  } catch (err) {
    console.error('Error updating delivery status:', err);
    res.status(500).json({ error: 'Failed to update delivery status.' });
  }
});
// --- Companion chat (NorthStar V5 model, with a Gemini backup) ---
//
// Order: Gemini answers first (about 1-2 s, grounded in the verified places and jobs
// below). If Gemini is unavailable or out of free quota, the NorthStar V5 model
// (remote NORTHSTAR_AI_URL, or the local Python script) answers instead, so Companion
// always replies. Set COMPANION_PROVIDER=northstar to ask the NorthStar model first.

// Verified places (same list and ids as the Map) used to ground place questions
let VERIFIED_PLACES = [];
try {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'src', 'data', 'resources.json'), 'utf8'));
  VERIFIED_PLACES = Array.isArray(raw) ? raw : (Array.isArray(raw.resources) ? raw.resources : []);
} catch (err) {
  console.warn('Companion: could not load src/data/resources.json:', err.message);
}

// ---- Spoken job tips (Gigs headphones button), voiced by ElevenLabs --------------------
// To keep credits low, the voice reads the tips for the kind of job only (no job titles), so
// there are just a few recordings in total. Each is made once, then served from disk or from
// Supabase Storage. Changing a tip in src/data/job-tips.json makes a new recording for it.
const TTS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL'; // "Sarah": warm, calm
const TTS_MODEL = process.env.ELEVENLABS_MODEL || 'eleven_flash_v2_5';       // lowest credit cost
const TTS_CACHE_DIR = path.join(__dirname, '.cache', 'tts');
const ttsInFlight = new Map();
let JOB_TIPS = { intro: '', payNote: '', kinds: [] };
try {
  JOB_TIPS = JSON.parse(fs.readFileSync(path.join(__dirname, 'src', 'data', 'job-tips.json'), 'utf8'));
} catch (err) {
  console.warn('Job tips: could not load src/data/job-tips.json:', err.message);
}

// The Gigs page reads the tip texts from here; src/ itself is not served.
app.get('/api/job-tips', (req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  res.json(JOB_TIPS);
});

function spokenTip(kind) {
  const tip = (JOB_TIPS.kinds || []).find(k => k.id === kind);
  return tip ? [JOB_TIPS.intro, tip.text, JOB_TIPS.payNote].filter(Boolean).join(' ') : null;
}

async function tipAudio(kind) {
  const text = spokenTip(kind);
  if (!text) return null;
  const hash = crypto.createHash('sha1').update(`${TTS_VOICE_ID}|${TTS_MODEL}|${text}`).digest('hex').slice(0, 12);
  const name = `${kind}-${hash}.mp3`;
  const file = path.join(TTS_CACHE_DIR, name);
  if (fs.existsSync(file)) return fs.readFileSync(file);
  if (ttsInFlight.has(name)) return ttsInFlight.get(name);

  const job = (async () => {
    // Made before (on another server or before a restart)?
    if (supabase && (await ensureUserBucket())) {
      const { data } = await supabase.storage.from(USER_BUCKET).download(`tts/${name}`);
      if (data) {
        const buf = Buffer.from(await data.arrayBuffer());
        fs.mkdirSync(TTS_CACHE_DIR, { recursive: true });
        fs.writeFileSync(file, buf);
        return buf;
      }
    }
    if (!process.env.ELEVENLABS_API_KEY) throw new Error('ELEVENLABS_API_KEY not set');
    const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${TTS_VOICE_ID}?output_format=mp3_44100_64`, {
      method: 'POST',
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({
        text,
        model_id: TTS_MODEL,
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true, speed: 0.95 }
      })
    });
    if (!resp.ok) throw new Error(`ElevenLabs ${resp.status}: ${(await resp.text()).slice(0, 160)}`);
    const buf = Buffer.from(await resp.arrayBuffer());
    fs.mkdirSync(TTS_CACHE_DIR, { recursive: true });
    fs.writeFileSync(file, buf);
    if (supabase && (await ensureUserBucket())) {
      supabase.storage.from(USER_BUCKET).upload(`tts/${name}`, buf, { contentType: 'audio/mpeg', upsert: true })
        .then(({ error }) => { if (error) console.warn('Tip audio backup notice:', error.message); });
    }
    console.log(`🔊 Made tip audio "${kind}" (${text.length} characters)`);
    return buf;
  })().finally(() => ttsInFlight.delete(name));
  ttsInFlight.set(name, job);
  return job;
}

app.get('/api/tips-audio/:kind', async (req, res) => {
  const kind = String(req.params.kind || '').toLowerCase();
  if (!/^[a-z]{2,20}$/.test(kind) || !spokenTip(kind)) return res.status(404).end();
  try {
    const audio = await tipAudio(kind);
    res.set({ 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=86400' });
    res.send(audio);
  } catch (err) {
    console.warn('Tip audio unavailable:', err.message);
    res.status(503).json({ success: false, error: 'Voice is unavailable right now.' });
  }
});

app.get('/api/resources', (req, res) => {
  res.json({ success: true, resources: VERIFIED_PLACES });
});

function detectPlaceCategory(lower) {
  if (/\b(shelter|bed|beds|place to stay|sleep|sleeping|stay tonight)\b/.test(lower)) return 'shelter';
  if (/\b(food|meal|meals|eat|hungry|pantry|food bank|lunch|dinner|breakfast)\b/.test(lower)) return 'food';
  if (/\b(shower|showers|restroom|bathroom|toilet|hygiene|laundry)\b/.test(lower)) return 'restroom';
  if (/\b(charge|charging|outlet)\b/.test(lower)) return 'charging';
  if (/\b(wifi|wi-fi|internet|library|computer)\b/.test(lower)) return 'wifi';
  if (/\b(day center|drop-in|laundry|mail|lockers)\b/.test(lower)) return 'daycenter';
  return null;
}

const COMPANION_REMOTE_TIMEOUT_MS = Number(process.env.COMPANION_REMOTE_TIMEOUT_MS) || 45000;
const COMPANION_GEMINI_MODELS = (process.env.GEMINI_CHAT_MODELS ||
  'gemini-3.5-flash-lite,gemini-flash-lite-latest,gemini-3.5-flash,gemini-flash-latest')
  .split(',').map(s => s.trim()).filter(Boolean);

async function askNorthstarRemote(chatPayload) {
  const url = (process.env.NORTHSTAR_AI_URL || '').replace(/\/+$/, '');
  if (!url || !process.env.NORTHSTAR_AI_KEY) throw new Error('remote NorthStar AI not configured');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), COMPANION_REMOTE_TIMEOUT_MS);
  try {
    const aiResponse = await fetch(`${url}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-NorthStar-AI-Key': process.env.NORTHSTAR_AI_KEY },
      body: JSON.stringify(chatPayload),
      signal: controller.signal
    });
    const type = aiResponse.headers.get('content-type') || '';
    if (!aiResponse.ok || !type.includes('json')) throw new Error(`remote NorthStar AI returned HTTP ${aiResponse.status}`);
    const result = await aiResponse.json();
    if (!result.success || !result.reply) throw new Error(result.error || 'remote NorthStar AI returned no reply');
    return { reply: result.reply, mode: result.mode || 'northstar_v5' };
  } catch (err) {
    if (err.name === 'AbortError') throw new Error(`remote NorthStar AI took longer than ${COMPANION_REMOTE_TIMEOUT_MS / 1000}s`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function askNorthstarLocal(chatPayload) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(NORTHSTAR_CHAT_SCRIPT)) return reject(new Error('local NorthStar AI script not found'));
    const child = spawn(NORTHSTAR_AI_PYTHON, [NORTHSTAR_CHAT_SCRIPT], { cwd: NORTHSTAR_AI_DIR, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('local NorthStar AI timed out')); }, 120000);
    child.stdout.on('data', c => { stdout += c.toString(); });
    child.stderr.on('data', c => { stderr += c.toString(); });
    child.on('error', err => { clearTimeout(timer); reject(err); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`local NorthStar AI exited with code ${code}: ${stderr.slice(-300)}`));
      try {
        const result = JSON.parse(stdout.trim());
        if (!result.success || !result.reply) return reject(new Error(result.error || 'local NorthStar AI returned no reply'));
        resolve({ reply: result.reply, mode: 'northstar_v5' });
      } catch (e) {
        reject(new Error('local NorthStar AI output was not valid JSON'));
      }
    });
    child.stdin.write(JSON.stringify(chatPayload));
    child.stdin.end();
  });
}

function companionSystemPrompt(role) {
  const who = role === 'volunteer'
    ? 'The person is a volunteer who wants to help (donate money or food, deliver food pickups, post jobs).'
    : 'The person may be experiencing homelessness and is looking for help.';
  // So "is it open today?" can be answered against the hours in the verified data
  const now = new Date();
  const seattleNow = now.toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles', weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit'
  });
  return [
    `Right now it is ${seattleNow} in Seattle. Use this when someone asks what is open today or now, and compare it with the hours in VERIFIED APP DATA.`,
    'You are Companion, the assistant inside Northstar, a free app for the Seattle area. Northstar helps people experiencing homelessness find shelter, food, showers and work and build a resume, and helps volunteers give food, money and time.',
    who,
    'How to reply:',
    '- Plain, warm, respectful and short: 2 to 5 sentences, under 90 words. Use simple words. No markdown headings, no bold, no emojis. A short list with "- " is fine.',
    '- Only mention places, addresses, phone numbers, hours, jobs or pay that appear in VERIFIED APP DATA. Never invent them. If the data does not cover it, say so and point to the right part of the app.',
    '- Places: if verified places are given, name the best 1 to 3 with address and hours. If the user location is not known, say these are verified places in the area and suggest the Map tab to see which is closest and get directions.',
    '- A bed tonight: they can also call 211 (free, confidential, connects to local shelters and services). Danger right now: call 911. If someone mentions suicide or hurting themselves: call or text 988.',
    '- Jobs: use VERIFIED APP DATA current_jobs. If a resume is provided, match their real skills and experience to those jobs. Never promise they will be hired.',
    '- App tabs you can point to: Home (a shelter open tonight, nearby places, call 211), Map (shelters, food, showers, wifi, saving places, directions), Gigs (day gigs and jobs posted by volunteers), Companion (this chat) and Me (their resume, first steps and settings). The resume builder opens from Me: answer a few questions, then print or copy the resume. Volunteers also have a Donate tab (donate money, post a food donation, claim and deliver food pickups) and can post jobs from the Gigs tab.',
    '- You cannot book beds, call anyone, send applications or see their location unless it is in the data. Do not pretend to.'
  ].join('\n');
}

async function askGemini(chatPayload) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not set');

  const contents = (chatPayload.history || [])
    .filter(t => t && typeof t.content === 'string' && t.content.trim())
    .slice(-10)
    .map(t => ({ role: t.role === 'assistant' ? 'model' : 'user', parts: [{ text: t.content.slice(0, 2000) }] }));
  let userText = chatPayload.message;
  if (chatPayload.context) {
    userText += `\n\nVERIFIED APP DATA (JSON):\n${JSON.stringify(chatPayload.context).slice(0, 14000)}`;
  }
  contents.push({ role: 'user', parts: [{ text: userText }] });

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: companionSystemPrompt(chatPayload.role) + (chatPayload.voice ? VOICE_STYLE_NOTE : '') }] },
    contents,
    generationConfig: { temperature: 0.4, maxOutputTokens: 500 }
  });

  const failures = [];
  for (const model of COMPANION_GEMINI_MODELS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(`HTTP ${r.status} ${(data.error && data.error.message || '').slice(0, 80)}`);
      const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
      if (!text) throw new Error('empty reply');
      return { reply: text.replace(/\*\*(.+?)\*\*/g, '$1'), mode: `gemini:${model}` };
    } catch (err) {
      failures.push(`${model}: ${err.name === 'AbortError' ? 'timed out' : err.message}`);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`all Gemini models failed (${failures.join(' | ')})`);
}

// ---- Voice Companion: talk to Companion, hear it answer (ElevenLabs) ---------------------
// Listen: the phone's own speech recognition when it has one; otherwise a short recording is
// sent here and ElevenLabs speech-to-text turns it into words. Think: /api/chat (voice: true asks
// for 2-3 spoken sentences). Speak: ElevenLabs Flash, streamed so it starts talking right away.
// Recordings are never stored. Each phone gets a fair-use limit so a loop can't drain credits.
const VOICE_STYLE_NOTE = '\n\nVOICE MODE: your answer will be read aloud. Answer in 2 or 3 short, plain sentences (under 60 words). No lists, links, symbols, emoji or markdown. Say names, times and distances the way a person would say them.';
const VOICE_MAX_CHARS = 400;
const voiceSpeech = new Map(); // id -> { text, at }
const voiceUse = new Map();    // ip -> { count, reset }

function voiceAllowed(req) {
  const ip = req.ip || 'x';
  const now = Date.now();
  const u = voiceUse.get(ip);
  if (!u || now > u.reset) { voiceUse.set(ip, { count: 1, reset: now + 10 * 60 * 1000 }); return true; }
  u.count += 1;
  return u.count <= 80; // listens + replies per 10 minutes
}

// A reply as it should sound: no markdown, links or lists, cut at a sentence near the limit
function toSpoken(text) {
  let t = String(text || '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[*_`#>]+/g, '')
    .replace(/^\s*(?:[-•]|\d+[.)])\s+/gm, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\s*\n+\s*/g, '. ')
    .replace(/\.\s*\./g, '.')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (t.length > VOICE_MAX_CHARS) {
    const cut = t.slice(0, VOICE_MAX_CHARS);
    const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
    t = end > 120 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, '') + '.';
  }
  return t;
}

// The phone app uploads its recording as one multipart file; take that file's bytes and type
function voiceUploadFile(buf, contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '');
  if (!m) return null;
  const boundary = Buffer.from(`--${m[1] || m[2]}`);
  const CRLF2 = Buffer.from([13, 10, 13, 10]);
  let at = buf.indexOf(boundary);
  while (at !== -1) {
    const next = buf.indexOf(boundary, at + boundary.length);
    if (next === -1) break;
    const part = buf.subarray(at + boundary.length, next);
    const headEnd = part.indexOf(CRLF2);
    if (headEnd !== -1) {
      const head = part.subarray(0, headEnd).toString('utf8');
      if (/filename=/i.test(head)) {
        const type = (/content-type:[ \t]*([^;\s]+)/i.exec(head) || [])[1] || 'audio/mp4';
        return { audio: part.subarray(headEnd + 4, part.length - 2), type: type.trim() }; // drop trailing CRLF
      }
    }
    at = next;
  }
  return null;
}

app.post('/api/voice/listen', express.raw({ type: ['audio/*', 'video/*', 'application/octet-stream', 'multipart/form-data'], limit: '12mb' }), async (req, res) => {
  if (!aiConsentGiven(req)) return res.status(403).json(AI_CONSENT_REQUIRED);
  if (!process.env.ELEVENLABS_API_KEY) return res.status(503).json({ success: false, error: 'Voice is not set up.' });
  if (!voiceAllowed(req)) return res.status(429).json({ success: false, error: 'Voice limit reached. Please type for a few minutes.' });
  let audio = req.body;
  let type = String(req.headers['content-type'] || 'audio/webm').split(';')[0];
  if (type === 'multipart/form-data' && Buffer.isBuffer(audio)) {
    const file = voiceUploadFile(audio, req.headers['content-type']);
    audio = file ? file.audio : null;
    type = file ? file.type : type;
  }
  if (!Buffer.isBuffer(audio) || audio.length < 800) return res.json({ success: true, text: '' });
  try {
    const ext = type.includes('mp4') || type.includes('m4a') || type.includes('aac') ? 'm4a' : type.includes('3gp') ? '3gp' : type.includes('ogg') ? 'ogg' : type.includes('wav') ? 'wav' : 'webm';
    const form = new FormData();
    form.append('model_id', 'scribe_v1');
    form.append('tag_audio_events', 'false');
    form.append('file', new Blob([audio], { type }), `speech.${ext}`);
    const r = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY },
      body: form
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${JSON.stringify(data).slice(0, 160)}`);
    const text = String(data.text || '').replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
    res.json({ success: true, text });
  } catch (err) {
    console.warn('Voice listen failed:', err.message);
    res.status(502).json({ success: false, error: 'Couldn’t hear that. Please try again.' });
  }
});

// Step 1: hand over the text, get an id. Step 2: the audio element plays /api/voice/speak/<id>,
// which streams from ElevenLabs as it is made (a plain GET, so playback starts immediately).
app.post('/api/voice/speak', (req, res) => {
  if (!aiConsentGiven(req)) return res.status(403).json(AI_CONSENT_REQUIRED);
  if (!process.env.ELEVENLABS_API_KEY) return res.status(503).json({ success: false, error: 'Voice is not set up.' });
  if (!voiceAllowed(req)) return res.status(429).json({ success: false, error: 'Voice limit reached.' });
  const text = toSpoken(req.body && req.body.text);
  if (!text) return res.status(400).json({ success: false, error: 'Nothing to say.' });
  const now = Date.now();
  for (const [k, v] of voiceSpeech) if (now - v.at > 5 * 60 * 1000) voiceSpeech.delete(k);
  const id = crypto.randomBytes(9).toString('hex');
  voiceSpeech.set(id, { text, at: now });
  res.json({ success: true, id });
});

app.get('/api/voice/speak/:id', async (req, res) => {
  const item = voiceSpeech.get(String(req.params.id || ''));
  if (!item) return res.status(404).end();
  const text = item.text;
  // Short lines ("One moment") are made once and kept
  const short = text.length <= 80;
  const hash = crypto.createHash('sha1').update(`${TTS_VOICE_ID}|${TTS_MODEL}|${text}`).digest('hex').slice(0, 16);
  const file = path.join(TTS_CACHE_DIR, `line-${hash}.mp3`);
  res.set({ 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' });
  if (short && fs.existsSync(file)) return res.send(fs.readFileSync(file));
  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${TTS_VOICE_ID}/stream?output_format=mp3_44100_64`, {
      method: 'POST',
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({
        text,
        model_id: TTS_MODEL,
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true, speed: 1.0 }
      })
    });
    if (!r.ok || !r.body) throw new Error(`ElevenLabs ${r.status}: ${(await r.text()).slice(0, 160)}`);
    const chunks = [];
    for await (const chunk of r.body) {
      res.write(chunk);
      if (short) chunks.push(Buffer.from(chunk));
    }
    res.end();
    if (short) {
      fs.mkdirSync(TTS_CACHE_DIR, { recursive: true });
      fs.writeFileSync(file, Buffer.concat(chunks));
    }
  } catch (err) {
    console.warn('Voice speak failed:', err.message);
    if (!res.headersSent) res.status(502).end(); else res.end();
  }
});

// Companion sends messages to Google (Gemini) and voice to ElevenLabs only after the person agrees
function aiConsentGiven(req) {
  return (req.body && req.body.aiConsent === true) || String(req.headers['x-ns-ai-consent'] || '') === 'yes';
}
const AI_CONSENT_REQUIRED = { success: false, error: 'consent_required', message: 'Companion needs your OK before it sends anything to its AI services.' };

app.post('/api/chat', async (req, res) => {
  try {
    if (!aiConsentGiven(req)) return res.status(403).json(AI_CONSENT_REQUIRED);
    const { message, role, context, history, voice } = req.body || {};

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, error: 'Message is required.' });
    }

    const userRole = role === 'volunteer' ? 'volunteer' : 'seeker';
    const lowerMessage = message.toLowerCase();
    // Message text is not written to server logs (privacy); only the role and length
    console.log(`🤖 [Companion] ${userRole} message (${message.length} chars)`);

    // Current listings when the question (or the conversation just before it) is about jobs,
    // so follow-ups like "which one pays the most?" still have the listings
    const jobWords = /\b(job|jobs|gig|gigs|work|hiring|employ|pay|pays|paid|wage|shift)/;
    const recentUserTurns = (Array.isArray(history) ? history : [])
      .filter(t => t && t.role === 'user' && typeof t.content === 'string')
      .slice(-2)
      .map(t => t.content.toLowerCase());
    const needsJobContext =
      (jobWords.test(lowerMessage) &&
        /\b(best|match|fit|find|which|recommend|current|available|for me|apply|near|today|open|any|most|pay|pays)\b/.test(lowerMessage)) ||
      (recentUserTurns.some(t => /\b(job|jobs|gig|gigs|hiring)\b/.test(t)) &&
        /\b(which|what|how much|pay|pays|most|best|that|it|one)\b/.test(lowerMessage));

    const verifiedContext = context && typeof context === 'object' ? { ...context } : {};

    if (needsJobContext) {
      verifiedContext.current_jobs = activeGigs.slice(0, 20).map(gig => ({
        id: gig.id || '',
        title: gig.title || '',
        pay: gig.pay || '',
        description: gig.summary || '',
        safety: gig.safety || '',
        url: gig.url || '',
        source: 'vetted_gig'
      }));
      verifiedContext.jobs_source = 'northstar_current_vetted_gigs';
    }

    // Place questions: when the phone couldn't give a nearest place, include the verified list
    const category = detectPlaceCategory(lowerMessage);
    const lookup = verifiedContext.resource_lookup;
    const lookupOk = lookup && lookup.resource_lookup_status === 'success';
    let fallbackPlaces = [];
    if (category && !lookupOk) {
      // No location: walk-in places open to everyone first, then the rest
      const inCat = p => (Array.isArray(p.categories) && p.categories.length ? p.categories : [p.category]).includes(category);
      const openToAll = p => /^(all|anyone|public)\b/i.test(p.population || '');
      fallbackPlaces = VERIFIED_PLACES
        .filter(p => inCat(p) && !p.referralOnly && !p.closedNote && typeof p.lat === 'number')
        .sort((a, b) => (openToAll(b) - openToAll(a)) || (b.is24Seven - a.is24Seven))
        .slice(0, 6)
        .map(p => ({
          id: p.id, name: p.name, address: p.address, hours: p.hours, phone: p.phone,
          who_it_is_for: p.population || '', id_required: p.idRequired === true, description: p.description
        }));
      if (fallbackPlaces.length) {
        verifiedContext.verified_places = fallbackPlaces;
        verifiedContext.user_location_known = false;
      }
    }

    const chatPayload = {
      message: message.trim(),
      role: userRole,
      context: Object.keys(verifiedContext).length ? verifiedContext : null,
      history: Array.isArray(history) ? history.slice(-10) : [],
      voice: voice === true
    };

    const northstar = () => (process.env.NORTHSTAR_AI_URL ? askNorthstarRemote(chatPayload) : askNorthstarLocal(chatPayload));
    // Voice waits on the answer before it can speak, so voice asks the fastest model first
    const providers = (process.env.COMPANION_PROVIDER || '').toLowerCase() === 'northstar' && voice !== true
      ? [['northstar', northstar], ['gemini', () => askGemini(chatPayload)]]
      : [['gemini', () => askGemini(chatPayload)], ['northstar', northstar]];

    let result = null;
    for (const [name, ask] of providers) {
      const started = Date.now();
      try {
        result = await ask();
        console.log(`✅ [Companion] answered by ${result.mode} in ${((Date.now() - started) / 1000).toFixed(1)}s`);
        break;
      } catch (err) {
        console.warn(`⚠️ [Companion] ${name} unavailable after ${((Date.now() - started) / 1000).toFixed(1)}s: ${err.message}`);
      }
    }

    if (!result) {
      return res.status(503).json({ success: false, error: 'Companion is unavailable right now.' });
    }

    const responsePayload = { success: true, reply: result.reply, mode: result.mode };
    if (voice === true) responsePayload.spoken = toSpoken(result.reply);
    if (needsJobContext) {
      responsePayload.action = { type: 'navigate', destination: 'jobs', label: 'See jobs' };
    } else if (fallbackPlaces.length) {
      // Link the place the answer is actually about (named in the question or the reply)
      const text = `${message} ${result.reply}`.toLowerCase();
      const key = name => String(name || '').toLowerCase().replace(/\([^)]*\)/g, '').split(/[^a-z0-9']+/).filter(w => w.length > 2).slice(0, 2).join(' ');
      const named = fallbackPlaces.find(p => key(p.name) && text.includes(key(p.name)));
      const target = named || fallbackPlaces[0];
      responsePayload.action = { type: 'navigate', destination: 'map', resourceId: target.id, label: 'Show on map' };
    }
    return res.json(responsePayload);
  } catch (err) {
    console.error('Companion chat error:', err);
    return res.status(500).json({ success: false, error: 'Companion is unavailable right now.' });
  }
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, '0.0.0.0', () => {
  const actualPort = server.address().port;
  console.log(`✅ Northstar App Ready at http://localhost:${actualPort}`);
  console.log(`🚀 Server running on http://0.0.0.0:${actualPort} (${activeGigs.length} vetted gigs ready)`);

  loadModeration();

  // Gigs: last real scrape from storage, then refresh it if it's old
  loadGigsCache().then(() => {
    const stale = !gigsScrapedAt || (Date.now() - gigsScrapedAt) > GIGS_MAX_AGE_MS;
    if (stale && process.env.APIFY_TOKEN) {
      fetchAndVetGigs().catch(err => console.warn('Gig refresh warning:', err?.message || err));
    }
  });

  // Run Apify scraper on startup only if explicitly enabled (otherwise use pre-seeded gigs & on-demand /api/trigger-scrape)
  if (process.env.ENABLE_STARTUP_SCRAPE === 'true') {
    setTimeout(() => {
      fetchAndVetGigs().catch((err) => {
        console.warn('Background Apify scrape warning:', err?.message || err);
      });
    }, 1500);
  }

  // Daily automated refresh mechanism (every 24 hours / 86400000 ms)
  const DAILY_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;
  setInterval(async () => {
    console.log('⏰ Executing scheduled daily automated Craigslist refresh...');
    try {
      await fetchAndVetGigs();
    } catch (err) {
      console.error('Scheduled daily refresh error:', err);
    }
  }, DAILY_REFRESH_INTERVAL_MS);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`⚠️ Port ${PORT} is in use. Trying another available port...`);
    server.close();
    server.listen(0);
  } else {
    console.error('Server error:', err);
  }
});
