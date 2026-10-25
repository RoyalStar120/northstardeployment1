/**
 * NorthStar Work Opportunities & Job Listings Module
 * Handles job fetching, synchronous persistent cache re-hydration, instant rendering on tab switch,
 * DOM reconciliation, and silent background polling.
 */

(function () {
  const BACKGROUND_POLL_INTERVAL_MS = 30000; // 30 seconds
  // v3: card markup changed (cache stores rendered HTML). Volunteers get their own
  // cache because their cards carry Delete controls instead of Apply.
  const JOBS_CACHE_STORAGE_KEY = 'northstar_cached_jobs_items_v3';
  let jobsPollingTimer = null;
  let isFetchInProgress = false;


  function extractPay(text) {
    if (!text) return null;
    const match = text.match(/\$[\d,]+(\.\d{2})?(\s*-\s*\$[\d,]+(\.\d{2})?)?(\s*\/\s*(hr|hour|h|gig|day|week))?/i);
    return match ? match[0] : null;
  }

  function esc(value) {
    if (typeof window.nsEscape === 'function') return window.nsEscape(value);
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // encodeURIComponent leaves ' alone, which would break the inline onclick='...' strings
  function encArg(value) {
    return encodeURIComponent(String(value == null ? '' : value)).replace(/'/g, '%27');
  }

  // Scraped titles can carry emoji; show them plainly
  function stripEmoji(text) {
    return String(text || '')
      .replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}️‍⃣]/gu, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  function cleanJobTitle(title) {
    if (!title) return '';
    let cleaned = stripEmoji(title).replace(/^[-\s|]+|[-\s|]+$/g, '').trim();
    cleaned = cleaned.replace(/\bResiden\b/i, 'Residential');
    // "START TODAY" -> "Start Today" (short tokens like "HR", "ID" and prices stay as they are)
    cleaned = cleaned.replace(/\b[A-Z]{4,}\b/g, w => w.charAt(0) + w.slice(1).toLowerCase());
    return cleaned;
  }
  window.nsCleanJobTitle = cleanJobTitle;

  function formatPay(pay, title, desc) {
    let p = pay ? String(pay).trim() : '';
    if (!p || p === '0' || p === '$0' || p === '$0.00' || p === '0.00' || p === 'Flexible Pay') {
      return extractPay(`${title || ''} ${desc || ''}`) || '';
    }
    return p;
  }

  // "$25.00 / hr Cash" -> { amount: "$25.00 / hr", cash: true }
  function splitPay(payText, isCashFlag) {
    const text = String(payText || '');
    const cash = !!isCashFlag || /\bcash\b/i.test(text);
    const amount = text.replace(/\b(instant\s+)?cash(\s+daily)?\b/ig, '').replace(/\s{2,}/g, ' ').trim();
    return { amount, cash };
  }

  function payBlockHtml(payText, isCashFlag) {
    const { amount, cash } = splitPay(payText, isCashFlag);
    return {
      amountHtml: amount
        ? `<span class="job-pay ns-pay text-[16px] font-bold leading-tight tracking-tight">${esc(amount)}</span>${cash ? '<span class="block text-[12px] font-semibold text-muted mt-1">Cash</span>' : ''}`
        : `<span class="job-pay block text-[13px] font-semibold text-muted">Pay not listed</span>`,
      cash
    };
  }

  function getCategoryIcon(titleStr) {
    const t = (titleStr || '').toLowerCase();
    if (t.includes('move') || t.includes('mover') || t.includes('haul') || t.includes('freight') || t.includes('unload') || t.includes('lift')) return 'local_shipping';
    if (t.includes('yard') || t.includes('rake') || t.includes('landscaping') || t.includes('outdoor')) return 'yard';
    if (t.includes('prep') || t.includes('food') || t.includes('kitchen') || t.includes('cook') || t.includes('catering') || t.includes('meal')) return 'restaurant';
    if (t.includes('warehouse') || t.includes('box') || t.includes('inventory') || t.includes('organiz') || t.includes('storage')) return 'inventory_2';
    if (t.includes('clean') || t.includes('wash') || t.includes('housekeeping') || t.includes('linen')) return 'cleaning_services';
    if (t.includes('handyman') || t.includes('demo') || t.includes('repair')) return 'handyman';
    if (t.includes('driver') || t.includes('delivery')) return 'directions_car';
    if (t.includes('digital') || t.includes('data') || t.includes('micro')) return 'laptop_mac';
    if (t.includes('event') || t.includes('setup') || t.includes('stage')) return 'event_seat';
    return 'work';
  }

  function deduplicate(items) {
    const seen = new Set();
    const seenIds = new Set();
    return items.filter(item => {
      const id = item && item.id != null ? String(item.id) : '';
      if (id) {
        if (seenIds.has(id)) return false;
        seenIds.add(id);
      }
      const key = `${item.title || item.rawTitle || ''}|${item.summary || item.description || ''}`.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function filterOutSurveys(items) {
    return items.filter(item => {
      const text = `${item.title || ''} ${item.rawTitle || ''} ${item.summary || ''} ${item.description || ''}`.toLowerCase();
      return !/survey|study|panel|questionnaire/i.test(text);
    });
  }

  function isDirectListingUrl(url) {
    return typeof url === 'string' && /^https?:\/\//i.test(url) && !url.includes('/search/');
  }

  function listingSource(url) {
    try {
      const host = new URL(url).hostname.replace(/^www\./, '');
      return /craigslist\.org$/i.test(host) ? 'Craigslist' : host;
    } catch (e) {
      return '';
    }
  }

  // Only claim "No ID needed" when the listing data says so explicitly
  function saysNoIdNeeded(g) {
    if (g.noIdRequired === true || g.no_id_required === true) return true;
    if (g.noIdRequired === false || g.no_id_required === false) return false;
    const s = String(g.safety || '');
    if (/ID required|W-?2 required|background check/i.test(s) && !/\bno (formal )?ID\b/i.test(s)) return false;
    return /\bno (formal )?ID\b|without (an )?ID/i.test(s);
  }

  function badgesHtml(list) {
    const items = list.filter(Boolean);
    return items.length ? `<div class="job-tags-container flex flex-wrap gap-2 mt-3">${items.join('')}</div>` : '';
  }

  const primerButtonHtml = title => `
              <button type="button" onclick="playAudioPrepPrimer('${encArg(title)}')" class="audio-primer-btn ns-icon-btn ns-icon-btn--sm" aria-label="Listen to tips for this job" title="Listen to tips">
                  <span class="material-symbols-outlined" aria-hidden="true">headphones</span>
              </button>`;

  function generateGigCardHtml(g, key, idx = 0) {
    const rawTitle = g.title || g.rawTitle || '';
    const title = cleanJobTitle(rawTitle) || 'Job listing';
    const pay = payBlockHtml(formatPay(g.pay || g.estPay, rawTitle, g.summary || g.description), g.isCash);
    const iconName = getCategoryIcon(rawTitle);
    const descriptionText = stripEmoji(g.summary || g.description || '');
    const id = g.id || `gig-${encodeURIComponent(rawTitle || Math.random())}`;
    const link = g.url || g.link;
    const hasLink = isDirectListingUrl(link);
    const source = hasLink ? listingSource(link) : '';

    const applyHtml = hasLink
      ? `<a href="${esc(link)}" target="_blank" rel="noopener noreferrer" class="apply-cta-btn ns-btn ns-btn--secondary ns-btn--sm flex-1">
                  View listing <span class="material-symbols-outlined" aria-hidden="true">open_in_new</span>
              </a>`
      : `<span class="apply-cta-btn ns-btn ns-btn--ghost ns-btn--sm flex-1 !text-muted" aria-disabled="true">Link not available</span>`;

    return `
      <article data-job-id="${esc(id)}" data-job-key="${esc(key)}" data-job-kind="gig" class="job-card ns-card">
          <div class="flex items-start gap-3">
              <span class="ns-tile ns-tile--sm" aria-hidden="true"><span class="material-symbols-outlined">${iconName}</span></span>
              <div class="min-w-0 flex-1">
                  <h3 class="job-title ns-card-title break-words">${esc(title)}</h3>
                  ${source ? `<p class="ns-card-sub mt-0.5">On ${esc(source)}</p>` : ''}
              </div>
              <div class="job-pay-col">${pay.amountHtml}</div>
          </div>
          ${descriptionText ? `<p class="job-description">${esc(descriptionText)}</p>` : ''}
          ${badgesHtml([
            saysNoIdNeeded(g) ? `<span class="ns-badge ns-badge--leaf"><span class="material-symbols-outlined" aria-hidden="true">check</span>Listing says no ID needed</span>` : ''
          ])}
          <div class="card-divider">
              ${applyHtml}
              ${primerButtonHtml(title)}
          </div>
      </article>
    `.trim();
  }

  function contactAction(contact) {
    const c = String(contact || '').trim();
    if (/^https?:\/\//i.test(c)) return { label: 'View listing', icon: 'open_in_new' };
    if (c.includes('@')) return { label: 'Email', icon: 'mail' };
    if (/\(?\d{3}\)?[-. ]?\d{3}[-. ]?\d{4}/.test(c)) return { label: 'Call', icon: 'call' };
    return { label: 'How to apply', icon: 'info' };
  }

  function generateStandardJobCardHtml(j, key, currentRole, idx = 0) {
    const title = cleanJobTitle(j.title) || 'Job';
    const pay = payBlockHtml(formatPay(j.pay, j.title, j.description), false);
    const iconName = getCategoryIcon(j.title);
    const id = j.id || `job-${encodeURIComponent(j.title || Math.random())}`;
    const where = [j.company, j.location].filter(Boolean).map(stripEmoji).join(', ');
    const reqs = (Array.isArray(j.requirements) ? j.requirements : []).map(stripEmoji).filter(Boolean);
    const action = contactAction(j.contact);

    const footer = currentRole === 'volunteer'
      ? `<p class="ns-card-sub flex-1 min-w-0 truncate">${esc(j.contact || '')}</p>
              <button type="button" onclick="deleteVolunteerJob('${encArg(j.id)}')" class="ns-btn ns-btn--ghost ns-btn--sm !text-danger">
                  <span class="material-symbols-outlined" aria-hidden="true">delete</span> Delete
              </button>`
      : `<button type="button" onclick="handleJobContactClick('${encArg(j.contact)}')" class="apply-cta-btn ns-btn ns-btn--secondary ns-btn--sm flex-1">
                  <span class="material-symbols-outlined" aria-hidden="true">${action.icon}</span> ${action.label}
              </button>
              ${primerButtonHtml(title)}
              <button type="button" onclick="nsReportPost('job', '${encArg(j.id)}', '${encArg(j.poster_key || '')}')" class="ns-icon-btn ns-icon-btn--sm" aria-label="Report or block this post" title="Report or block">
                  <span class="material-symbols-outlined" aria-hidden="true">flag</span>
              </button>`;

    return `
      <article data-job-id="${esc(id)}" data-job-key="${esc(key)}" data-job-kind="posted" class="job-card ns-card">
          <div class="flex items-start gap-3">
              <span class="ns-tile ns-tile--sm" aria-hidden="true"><span class="material-symbols-outlined">${iconName}</span></span>
              <div class="min-w-0 flex-1">
                  <h3 class="job-title ns-card-title break-words">${esc(title)}</h3>
                  ${where ? `<p class="ns-card-sub mt-0.5">${esc(where)}</p>` : ''}
              </div>
              <div class="job-pay-col">${pay.amountHtml}</div>
          </div>
          ${j.description ? `<p class="job-description">${esc(stripEmoji(j.description))}</p>` : ''}
          ${reqs.length ? `<p class="ns-hint">Asks for: ${esc(reqs.join(', '))}</p>` : ''}
          <div class="card-divider">
              ${footer}
          </div>
      </article>
    `.trim();
  }

  /**
   * Retrieves cached job items synchronously from memory or localStorage
   * (real listings from the last load; nothing made up when there are none).
   */
  function currentJobsRole() {
    const rawRole = (typeof getRole === 'function') ? getRole() : (localStorage.getItem('northstar_user_role') || 'seeker');
    return (rawRole === 'volunteer' || rawRole === 'donater' || rawRole === 'helper' || rawRole === 'employer') ? 'volunteer' : 'seeker';
  }

  function jobsCacheKey() {
    return currentJobsRole() === 'volunteer' ? `${JOBS_CACHE_STORAGE_KEY}_volunteer` : JOBS_CACHE_STORAGE_KEY;
  }

  function getCachedJobsItems() {
    if (Array.isArray(window._northstarJobsCache) && window._northstarJobsCache.length > 0) {
      return window._northstarJobsCache;
    }
    try {
      const raw = localStorage.getItem(jobsCacheKey());
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          window._northstarJobsCache = parsed;
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to parse cached jobs from localStorage:', e);
    }
    return [];
  }

  function saveCachedJobsItems(itemsList) {
    if (!Array.isArray(itemsList) || itemsList.length === 0) return;
    window._northstarJobsCache = itemsList;
    try {
      localStorage.setItem(jobsCacheKey(), JSON.stringify(itemsList));
    } catch (e) {
      // Ignore quota errors
    }
  }

  function clearCachedJobsItems() {
    window._northstarJobsCache = [];
    try { localStorage.removeItem(jobsCacheKey()); } catch (e) {}
  }

  /**
   * Finds the target job feed container in the current DOM.
   */
  function getJobsFeedContainer() {
    return (
      document.getElementById('opportunities-feed') ||
      document.getElementById('jobs-feed') ||
      document.getElementById('jobs-container') ||
      document.getElementById('jobs-list')
    );
  }

  /**
   * Synchronously renders cached or seed job listings into the feed container immediately.
   * Ensures zero blank state on initial page load or tab switch before async fetch resolves.
   * @param {boolean} [force=false] - If true, repopulates even if children exist.
   */
  function renderJobsInstant(force = false) {
    const feed = getJobsFeedContainer();
    if (!feed) return false;

    const existingCards = feed.querySelectorAll('[data-job-id]');
    if (!force && existingCards.length > 0) {
      updateActiveJobsCount(existingCards.length);
      return true;
    }

    const cachedItems = getCachedJobsItems();
    if (cachedItems && cachedItems.length > 0) {
      feed.innerHTML = cachedItems.map(item => item.html).join('');
      updateActiveJobsCount(cachedItems.length);
      return true;
    }
    return false;
  }
  window.renderJobsInstant = renderJobsInstant;

  /**
   * Reconciles the feed DOM elements without full-page re-renders or scroll interruption.
   */
  function reconcileFeedDOM(feed, itemsList) {
    const scrollContainer = document.querySelector('main');
    const prevScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;

    const existingCardMap = new Map();
    const existingCards = Array.from(feed.querySelectorAll('[data-job-id]'));
    existingCards.forEach(el => {
      existingCardMap.set(el.getAttribute('data-job-id'), el);
    });

    const newIdsSet = new Set(itemsList.map(item => item.id));

    // 1. Remove elements that no longer exist
    existingCards.forEach(el => {
      const id = el.getAttribute('data-job-id');
      if (!newIdsSet.has(id)) {
        el.remove();
      }
    });

    // 2. Reconcile or insert each item in correct sequence
    let prevSibling = null;
    itemsList.forEach((item, index) => {
      let cardEl = existingCardMap.get(item.id);

      if (cardEl) {
        // If content changed, update it in place
        if (cardEl.getAttribute('data-job-key') !== item.key) {
          const wrapper = document.createElement('div');
          wrapper.innerHTML = item.html;
          const updatedEl = wrapper.firstElementChild;
          cardEl.replaceWith(updatedEl);
          cardEl = updatedEl;
        }
      } else {
        // Brand new card: create and insert
        const wrapper = document.createElement('div');
        wrapper.innerHTML = item.html;
        cardEl = wrapper.firstElementChild;
      }

      // Ensure proper DOM order without destroying other elements
      if (index === 0) {
        if (feed.firstElementChild !== cardEl) {
          feed.prepend(cardEl);
        }
      } else if (prevSibling) {
        if (prevSibling.nextElementSibling !== cardEl) {
          prevSibling.after(cardEl);
        }
      }
      prevSibling = cardEl;
    });

    // Restore scroll position silently
    if (scrollContainer && scrollContainer.scrollTop !== prevScrollTop) {
      scrollContainer.scrollTop = prevScrollTop;
    }
    updateActiveJobsCount(itemsList.length);
  }

  /**
   * Updates the active jobs counter pill dynamically across all supported selectors.
   * @param {number} [explicitCount] - Explicit count of visible jobs, or omitted to dynamically read DOM.
   */
  function updateActiveJobsCount(explicitCount) {
    let count = explicitCount;
    if (typeof count !== 'number') {
      const feed = getJobsFeedContainer();
      if (feed) {
        const visibleCards = feed.querySelectorAll('[data-job-id]:not([style*="display: none"]):not(.hidden)');
        count = visibleCards.length;
      } else {
        count = 0;
      }
    }
    const badges = document.querySelectorAll('#active-jobs-count, #jobs-count-badge, .active-badge');
    badges.forEach(badge => {
      badge.textContent = `${count} Active`;
    });
    updateJobsHeader();
  }
  window.updateActiveJobsCount = updateActiveJobsCount;

  // ---- Page chrome on opportunities.html: header count + filter -------------------
  let activeJobsFilter = 'all';

  function applyJobsFilter() {
    const feed = getJobsFeedContainer();
    if (!feed) return;
    feed.querySelectorAll('[data-job-id]').forEach(card => {
      const kind = card.getAttribute('data-job-kind');
      card.classList.toggle('hidden', activeJobsFilter !== 'all' && kind !== activeJobsFilter);
    });
  }

  function updateJobsHeader() {
    const feed = getJobsFeedContainer();
    if (!feed) return;
    const cards = Array.from(feed.querySelectorAll('[data-job-id]'));
    const gigs = cards.filter(c => c.getAttribute('data-job-kind') === 'gig').length;
    const posted = cards.filter(c => c.getAttribute('data-job-kind') === 'posted').length;
    const total = cards.length;
    const isVolunteer = currentJobsRole() === 'volunteer';

    const meta = document.getElementById('jobs-header-meta');
    const stateEl = feed.querySelector('[data-jobs-state]');
    const addPostBtn = document.getElementById('jobs-add-post-btn');
    if (addPostBtn) addPostBtn.classList.toggle('hidden', !(isVolunteer && total > 0));
    if (meta && total > 0) {
      meta.textContent = isVolunteer
        ? `${total} ${total === 1 ? 'job' : 'jobs'} you posted`
        : `${total} ${total === 1 ? 'listing' : 'listings'} open`;
    } else if (meta && stateEl && stateEl.getAttribute('data-jobs-state') !== 'loading') {
      const state = stateEl.getAttribute('data-jobs-state');
      meta.textContent = state === 'error'
        ? 'Couldn’t load listings'
        : (isVolunteer ? 'No jobs posted yet' : 'No listings right now');
    }

    // The filter only makes sense when both kinds of listing are on screen
    const filter = document.getElementById('jobs-filter');
    if (filter) {
      const showFilter = !isVolunteer && gigs > 0 && posted > 0;
      filter.classList.toggle('hidden', !showFilter);
      if (!showFilter) activeJobsFilter = 'all';
      filter.querySelectorAll('button[data-filter]').forEach(btn => {
        const on = btn.getAttribute('data-filter') === activeJobsFilter;
        btn.classList.toggle('is-active', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }
    applyJobsFilter();
  }

  window.setJobsFilter = function setJobsFilter(kind) {
    activeJobsFilter = (kind === 'gig' || kind === 'posted') ? kind : 'all';
    updateJobsHeader();
  };

  const STALE_NOTE = 'Couldn’t refresh. These listings were saved on this phone earlier.';

  function setJobsStatus(message) {
    const el = document.getElementById('jobs-status');
    if (!el) return;
    if (message) {
      const text = el.querySelector('[data-jobs-status-text]');
      if (text) text.textContent = message;
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  }

  function feedStateHtml(state) {
    const isVolunteer = currentJobsRole() === 'volunteer';
    if (state === 'error') {
      return `
        <div data-jobs-state="error" class="ns-empty">
          <p class="ns-empty__title">Couldn’t load jobs</p>
          <p class="ns-empty__sub">Check your connection and try again.</p>
          <button type="button" onclick="loadOpportunities()" class="ns-btn ns-btn--ghost ns-btn--sm mt-4">Try again</button>
        </div>`;
    }
    return isVolunteer
      ? `
        <div data-jobs-state="empty" class="ns-empty">
          <img class="ns-empty__art" src="assets/illustrations/clipboard-add.svg" alt="">
          <p class="ns-empty__title">No posts yet</p>
          <p class="ns-empty__sub">Jobs you post show up here and in the Gigs list for people looking for work.</p>
          <button type="button" onclick="openModal('post-job-modal')" class="ns-btn ns-btn--primary ns-btn--sm mt-4">
            <span class="material-symbols-outlined" aria-hidden="true">add</span> Post a job
          </button>
        </div>`
      : `
        <div data-jobs-state="empty" class="ns-empty">
          <p class="ns-empty__title">No jobs listed right now</p>
          <p class="ns-empty__sub">Check back later.</p>
        </div>`;
  }

  /**
   * Main loadOpportunities function with synchronous state re-hydration + background refresh support.
   * @param {boolean} isSilent - If true, runs in background without UI flicker or scroll reset.
   */
  window.loadOpportunities = async function loadOpportunities(isSilent = false) {
    const feed = getJobsFeedContainer();
    if (!feed) return;

    // Synchronously hydrate the container immediately if it is currently empty!
    // This guarantees the user NEVER sees a blank screen on initial load or tab switch.
    if (feed.querySelectorAll('[data-job-id]').length === 0) {
      renderJobsInstant(true);
    }

    // Mark Job Matcher milestone as explored when user visits Jobs view
    try {
      localStorage.setItem('northstar_jobs_explored', 'true');
      if (typeof window.updateMilestone === 'function') {
        window.updateMilestone('jobMatcher', true);
      }
    } catch (e) {}

    if (isFetchInProgress) return;
    isFetchInProgress = true;

    // Role Gate: Show Post Job UI only to Volunteers / Employers
    const currentRole = currentJobsRole();
    const session = (typeof getSession === 'function') ? getSession() : JSON.parse(localStorage.getItem('northstar_session') || '{}');
    const userId = session.id || session.email || '';

    const postBtn = document.getElementById('post-job-header-btn');
    if (postBtn) { postBtn.classList.add('hidden'); postBtn.classList.remove('flex'); }
    const postBanner = document.getElementById('post-job-volunteer-banner');

    if (currentRole === 'volunteer') {
      if (postBanner) { postBanner.classList.remove('hidden'); }
    } else {
      if (postBanner) { postBanner.classList.add('hidden'); }
    }
    // Resume matching is for people looking for work
    const matchBtn = document.getElementById('ai-match-trigger');
    if (matchBtn) matchBtn.classList.toggle('hidden', currentRole === 'volunteer');
    const sectionTitle = document.getElementById('jobs-section-title');
    if (sectionTitle) sectionTitle.textContent = currentRole === 'volunteer' ? 'Your posts' : 'Listings';

    try {
      const jobsApiUrl = `/api/jobs?role=${currentRole}&userId=${encodeURIComponent(userId)}`;
      const [gigsRes, jobsRes] = await Promise.all([
        (currentRole === 'seeker')
          ? fetch('/api/gigs').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).catch(() => ({ gigs: [], failed: true }))
          : Promise.resolve({ gigs: [] }),
        fetch(jobsApiUrl).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).catch(() => ({ jobs: [], failed: true }))
      ]);
      // Nothing reachable: keep whatever is on screen and say so, rather than pretending it's fresh
      const fetchFailed = currentRole === 'seeker' ? !!(gigsRes.failed && jobsRes.failed) : !!jobsRes.failed;

      let localJobs = [];
      try {
        localJobs = JSON.parse(localStorage.getItem('northstar_custom_posted_jobs') || '[]');
      } catch (_) {}

      const combinedJobsList = Array.isArray(localJobs) && localJobs.length > 0 
        ? [...localJobs, ...(jobsRes.jobs || [])]
        : (jobsRes.jobs || []);
        
      // Posts from people this person blocked are left out
      const hidden = typeof window.nsHiddenPost === 'function' ? (j) => window.nsHiddenPost('job', j) : () => false;
      const standardJobs = filterOutSurveys(deduplicate(combinedJobsList)).filter(j => !hidden(j));

      // Re-acquire feed reference in case DOM swapped during async fetch
      const currentFeed = getJobsFeedContainer();
      if (!currentFeed) return;

      if (fetchFailed && standardJobs.length === 0) {
        if (currentFeed.querySelectorAll('[data-job-id]').length > 0) {
          setJobsStatus(STALE_NOTE);
          updateActiveJobsCount();
        } else {
          window._currentJobsFingerprint = 'error';
          currentFeed.innerHTML = feedStateHtml('error');
          updateActiveJobsCount(0);
        }
        return;
      }
      setJobsStatus('');

      // If volunteer with 0 jobs, display empty state
      if (currentRole === 'volunteer' && standardJobs.length === 0) {
        window._currentJobsFingerprint = 'empty-volunteer';
        clearCachedJobsItems();
        currentFeed.innerHTML = feedStateHtml('empty');
        updateActiveJobsCount(0);
        return;
      }

      // Live gigs from /api/gigs (Apify scrape); keep only ones with a direct listing link
      const approvedGigs = filterOutSurveys(deduplicate(gigsRes.gigs || []))
        .filter(g => isDirectListingUrl(g.url || g.link));

      // Build item objects with unique IDs, content keys, and HTML
      const itemsList = [];

      approvedGigs.forEach((g, idx) => {
        const id = g.id || `seed-${idx}`;
        const key = `${id}|${g.title || g.rawTitle || ''}|${g.pay || g.estPay || ''}|${g.summary || g.description || ''}`;
        itemsList.push({
          id,
          key,
          html: generateGigCardHtml(g, key, idx)
        });
      });

      standardJobs.forEach((j, idx) => {
        const id = j.id || `job-${idx}`;
        const key = `${id}|${j.title || ''}|${j.pay || ''}|${j.company || ''}|${j.description || ''}`;
        itemsList.push({
          id,
          key,
          html: generateStandardJobCardHtml(j, key, currentRole, idx)
        });
      });

      if (itemsList.length === 0) {
        window._currentJobsFingerprint = 'empty';
        clearCachedJobsItems();
        currentFeed.innerHTML = feedStateHtml('empty');
        updateActiveJobsCount(0);
        return;
      }

      // Persist latest items list to cache so tab switches are instant
      saveCachedJobsItems(itemsList);

      // Dynamically reflect real-time count of visible rendered jobs
      updateActiveJobsCount(itemsList.length);

      // Fingerprint to check whether anything changed
      const newFingerprint = itemsList.map(item => item.key).join(':::');

      if (isSilent && window._currentJobsFingerprint === newFingerprint && currentFeed.querySelectorAll('[data-job-id]').length > 0) {
        updateActiveJobsCount(itemsList.length);
        return;
      }

      if (!currentFeed.querySelectorAll('[data-job-id]').length || !window._currentJobsFingerprint) {
        currentFeed.innerHTML = itemsList.map(i => i.html).join('');
      } else {
        reconcileFeedDOM(currentFeed, itemsList);
      }

      updateActiveJobsCount(itemsList.length);
      window._currentJobsFingerprint = newFingerprint;
    } catch (e) {
      console.error('Error loading opportunities:', e);
      // Ensure fallback cache is displayed if fetch failed
      renderJobsInstant();
      const errFeed = getJobsFeedContainer();
      if (errFeed && !errFeed.querySelector('[data-job-id]')) {
        errFeed.innerHTML = feedStateHtml('error');
        updateActiveJobsCount(0);
      } else {
        setJobsStatus(STALE_NOTE);
      }
    } finally {
      isFetchInProgress = false;
    }
  };

  // Fallback contact handler for pages that don't define their own (e.g. index.html)
  if (typeof window.handleJobContactClick !== 'function') {
    window.handleJobContactClick = function (encodedContact) {
      const contact = decodeURIComponent(encodedContact || '');
      const phoneMatch = contact.match(/\(?\d{3}\)?[-. ]?\d{3}[-. ]?\d{4}/);
      if (/^https?:\/\//i.test(contact)) {
        window.open(contact, '_blank', 'noopener,noreferrer');
      } else if (contact.includes('@')) {
        window.location.href = `mailto:${contact.split('|')[0].trim()}`;
      } else if (phoneMatch) {
        window.location.href = `tel:${phoneMatch[0].replace(/[^0-9]/g, '')}`;
      } else {
        alert(`Contact: ${contact}`);
      }
    };
  }

  // Expose convenient aliases expected by any router or view hook
  window.renderJobs = window.loadOpportunities;
  window.loadJobsList = window.loadOpportunities;
  window.populateJobs = window.loadOpportunities;

  /**
   * Starts silent background polling every 30 seconds.
   */
  window.startJobsAutoRefresh = function startJobsAutoRefresh() {
    if (jobsPollingTimer) clearInterval(jobsPollingTimer);
    jobsPollingTimer = setInterval(() => {
      if (typeof window.loadOpportunities === 'function' && getJobsFeedContainer()) {
        window.loadOpportunities(true);
      }
    }, BACKGROUND_POLL_INTERVAL_MS);
  };

  window.stopJobsAutoRefresh = function stopJobsAutoRefresh() {
    if (jobsPollingTimer) {
      clearInterval(jobsPollingTimer);
      jobsPollingTimer = null;
    }
  };

  /**
   * Direct Match Action: Opens persistent chatbot drawer and appends match action
   * directly into chat log without setting or polluting text input state.
   */
  // Opens the Companion tab with the question already asked
  window.handleMatchClick = function handleMatchClick(event) {
    if (event && typeof event.stopPropagation === 'function') {
      event.stopPropagation();
    }
    const question = 'Which of these jobs fit my resume?';
    if (typeof window.sendQuickChatMessage === 'function') {
      window.sendQuickChatMessage(question);
    } else {
      window.location.href = 'companion.html?q=' + encodeURIComponent(question);
    }
  };

  window.triggerAIMatchAssistant = window.handleMatchClick;

  /**
   * Binds click listener to #ai-match-trigger button.
   */
  function initAIMatchTrigger() {
    const triggerBtn = document.getElementById('ai-match-trigger');
    if (!triggerBtn) return;
    if (triggerBtn._hasAIMatchListener) return;
    triggerBtn._hasAIMatchListener = true;

    triggerBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.triggerAIMatchAssistant(e);
    });
  }

  /**
   * Unified initialization hook executed on page load, DOMContentLoaded, and SPA tab switches.
   */
  function initializeJobsView() {
    initAIMatchTrigger();
    if (getJobsFeedContainer()) {
      renderJobsInstant();
      window.loadOpportunities();
      window.startJobsAutoRefresh();
    }
  }

  // ---- Inside the Northstar phone app: open listings in the app's step-by-step guide ----
  // The app (expo-app/) shows the listing with an arrow that points at what to tap next.
  // It gets a short reply message written from the person's resume, ready to paste.
  function replyMessageFor(jobTitle) {
    let resume = null;
    try { resume = JSON.parse(localStorage.getItem('northstar_latest_resume_data') || 'null'); } catch (e) {}
    const session = typeof getSession === 'function' ? getSession() : {};
    const c = (resume && resume.contact_info) || {};
    const name = c.name || (!session.isGuest && (session.full_name || session.username)) || '';
    const phone = c.phone || '';
    const skills = [];
    if (resume && resume.skills) {
      ['practical_skills', 'certifications'].forEach(k => (resume.skills[k] || []).forEach(s => { if (s && skills.length < 3) skills.push(String(s).toLowerCase()); }));
    }
    const lines = [
      `Hi, I saw your post${jobTitle ? ` "${jobTitle}"` : ''} and I'm interested.`,
      `I'm a hard worker, I show up on time, and I can start right away.${skills.length ? ` I have experience with ${skills.join(', ')}.` : ''}`,
      phone ? `You can call or text me at ${phone}.` : 'Please reply here and let me know when and where to come.',
      name ? `Thank you,\n${name}` : 'Thank you!'
    ];
    return lines.join('\n\n');
  }

  // Name, phone, email and city for the guide's "Fill in for me" on employer websites
  function applyProfile() {
    let resume = null;
    try { resume = JSON.parse(localStorage.getItem('northstar_latest_resume_data') || 'null'); } catch (e) {}
    const session = typeof getSession === 'function' ? getSession() : {};
    const c = (resume && resume.contact_info) || {};
    const contact = String(c.contact || '');
    return {
      name: c.name || (!session.isGuest && (session.full_name || session.username)) || '',
      phone: c.phone || '',
      email: /@/.test(contact) ? (contact.match(/[^\s@]+@[^\s@]+\.[^\s@]+/) || [''])[0] : '',
      city: c.location || ''
    };
  }

  document.addEventListener('click', (e) => {
    if (!window.ReactNativeWebView) return;
    const link = e.target.closest && e.target.closest('a.apply-cta-btn[href]');
    if (!link) return;
    const card = link.closest('.job-card');
    const title = card ? (card.querySelector('.job-title') || {}).textContent || '' : '';
    const pay = card ? (card.querySelector('.job-pay') || {}).textContent || '' : '';
    e.preventDefault();
    e.stopPropagation();
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'job-guide',
      url: link.href,
      title: title.trim(),
      pay: pay.trim(),
      message: replyMessageFor(title.trim()),
      profile: applyProfile()
    }));
  }, true);

  // Warm up cache immediately on script load
  getCachedJobsItems();

  // Execute immediately if DOM is already interactive/complete, plus bind DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeJobsView);
  } else {
    initializeJobsView();
  }

  // Listen for SPA navigation / tab switches and browser back/forward navigation
  window.addEventListener('pageshow', initializeJobsView);
  window.addEventListener('popstate', initializeJobsView);
  window.addEventListener('northstar:tabSwitched', initializeJobsView);
})();
