/**
 * Northstar Interactive Web Application Module
 * Architecture & Dual-Funnel Role Navigation Engine
 */

document.addEventListener('DOMContentLoaded', () => {
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  const session = getSession();

  // Index launch view
  if (currentPath === 'index.html' || currentPath === '') {
    const mainLayout = document.getElementById('main-app-layout');
    if (mainLayout) { mainLayout.classList.remove('hidden'); mainLayout.style.display = 'flex'; }
  }

  // Fetch the persisted role from Supabase for signed-in users
  if (session && !session.isGuest && session.id && window.supabaseClient) {
    window.supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', session.id)
      .single()
      .then(({ data }) => {
        if (data && data.role) {
          localStorage.setItem('northstar_user_role', data.role);
          cachedSupabaseRole = data.role;
        }
      })
      .catch(err => console.warn('Supabase init fetch failed:', err));
  }

  // Automatic Trigger: browsing jobs ("Save a place" is detected from real bookmarks in getUserData)
  if (currentPath === 'opportunities.html' || currentPath === 'jobs.html') {
    updateMilestone('jobMatcher', true);
  }

  initThemeToggle();
  initClock();
  initRoleNavigation();
  initDonationForm();
  initResourceMapFilter();
  initHelpModal();
  initCallModal();
  initTaskClaiming();
  initInstantPageTransitions();
  renderBottomNav();
  renderProgressPage();
  syncDashboardProgressWidget();
  checkGuestLockAccess();
  checkDashboardJobMatchLock();
  renderAccountHeaderAvatar();
});

// Small helpers shared by the templates below
function nsEscape(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
window.nsEscape = nsEscape;

// JSON headers plus the signed-in account's session token. The server works out who is
// posting, claiming or deleting from this token, never from ids in the request body.
function nsAuthHeaders(extra) {
  const headers = Object.assign({ 'Content-Type': 'application/json' }, extra || {});
  try {
    const s = JSON.parse(localStorage.getItem('northstar_session') || 'null');
    if (s && !s.isGuest && s.token) headers.Authorization = `Bearer ${s.token}`;
  } catch (e) {}
  return headers;
}
window.nsAuthHeaders = nsAuthHeaders;

function nsDisplayName() {
  const session = getSession();
  if (!session || session.isGuest) return '';
  const name = (session.user_metadata && session.user_metadata.full_name)
    || session.full_name
    || (session.username && session.username !== 'Guest' ? session.username : null);
  return name ? String(name).trim() : '';
}
window.nsDisplayName = nsDisplayName;

// Fill the round account button (#profile-btn) in the page header with the user's initial
function renderAccountHeaderAvatar() {
  const session = getSession();
  const isGuest = !session || session.isGuest;
  const name = nsDisplayName();
  const role = getRole();
  const initial = (isGuest ? 'G' : (name.charAt(0) || (role === 'volunteer' ? 'V' : 'S'))).toUpperCase();
  document.querySelectorAll('#profile-btn').forEach(btn => {
    btn.textContent = initial;
    btn.title = name ? `Signed in as ${name}. Open settings` : 'Open settings';
    btn.setAttribute('aria-label', 'Open settings');
    btn.onclick = window.openSettingsModal;
  });
}

// ---- Light / dark mode --------------------------------------------------------
// js/ns-boot.js owns the theme (window.nsTheme). Here: the one-tap sun/moon button
// next to the avatar on every page that has one, and Light / Dark / Auto in Settings.
const THEME_ICONS = {
  // Shown in light mode: tap for dark
  moon: '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 14.2A8.5 8.5 0 1 1 9.8 3.5a6.8 6.8 0 0 0 10.7 10.7Z"/></svg>',
  // Shown in dark mode: tap for light
  sun: '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>'
};

function currentTheme() {
  return window.nsTheme ? window.nsTheme.current() : (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
}

function syncHeaderThemeIcons() {
  const dark = currentTheme() === 'dark';
  document.querySelectorAll('.ns-theme-btn').forEach(btn => {
    btn.innerHTML = dark ? THEME_ICONS.sun : THEME_ICONS.moon;
    btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    btn.title = dark ? 'Light mode' : 'Dark mode';
    btn.setAttribute('aria-pressed', String(dark));
  });
}

function initThemeToggle() {
  // One per header, right before the avatar
  document.querySelectorAll('#profile-btn').forEach(profileBtn => {
    const actions = profileBtn.parentElement;
    // Compact top bars (back · title · avatar) have no room; Settings has the choice there
    if (!actions || actions.classList.contains('ns-topbar') || actions.querySelector('.ns-theme-btn')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ns-icon-btn ns-theme-btn';
    btn.addEventListener('click', () => window.toggleTheme());
    actions.insertBefore(btn, profileBtn);
  });
  syncHeaderThemeIcons();
}

window.setThemeMode = function (choice) {
  if (window.nsTheme) window.nsTheme.set(choice);
};

window.toggleTheme = function () {
  if (window.nsTheme) window.nsTheme.toggle();
};

function updateSettingsThemeUI() {
  const choice = window.nsTheme ? window.nsTheme.choice() : 'system';
  document.querySelectorAll('[data-theme-choice]').forEach(btn => {
    const on = btn.dataset.themeChoice === choice;
    btn.classList.toggle('is-active', on);
    btn.setAttribute('aria-pressed', String(on));
  });
}

window.addEventListener('ns:theme', () => {
  syncHeaderThemeIcons();
  updateSettingsThemeUI();
});

// Initialize Supabase Client dynamically from server config
async function initSupabaseClient() {
  try {
    const res = await fetch('/api/config');
    const config = await res.json();
    if (config.supabaseUrl && config.supabaseAnonKey && window.supabase && window.supabase.createClient) {
      window.supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
      console.log('⚡ Supabase Client Connected:', config.supabaseUrl);
    }
  } catch (e) {
    console.warn('Supabase initialization warning:', e);
  }
}
initSupabaseClient();

// Auth Gateway State & Handlers
let authMode = 'login';
let authSelectedRole = 'seeker';

window.switchAuthTab = function (mode) {
  authMode = mode;
  const tabLogin = document.getElementById('tab-login');
  const tabSignup = document.getElementById('tab-signup');
  const roleContainer = document.getElementById('role-selection-container');
  const submitBtn = document.getElementById('auth-submit-btn');

  if (mode === 'login') {
    if (tabLogin) tabLogin.className = 'flex-1 h-10 text-xs sm:text-sm font-extrabold rounded-lg bg-slate-950 text-white shadow-sm transition-all duration-200';
    if (tabSignup) tabSignup.className = 'flex-1 h-10 text-xs sm:text-sm font-bold rounded-lg text-slate-600 hover:text-slate-950 transition-all duration-200';
    if (roleContainer) roleContainer.classList.add('hidden');
    if (submitBtn) submitBtn.textContent = 'Sign In';
  } else {
    if (tabSignup) tabSignup.className = 'flex-1 h-10 text-xs sm:text-sm font-extrabold rounded-lg bg-slate-950 text-white shadow-sm transition-all duration-200';
    if (tabLogin) tabLogin.className = 'flex-1 h-10 text-xs sm:text-sm font-bold rounded-lg text-slate-600 hover:text-slate-950 transition-all duration-200';
    if (roleContainer) roleContainer.classList.remove('hidden');
    if (submitBtn) submitBtn.textContent = 'Create Account';
  }
};

window.setAuthRole = function (role) {
  authSelectedRole = role;
  const seekerBtn = document.getElementById('role-btn-seeker');
  const volunteerBtn = document.getElementById('role-btn-volunteer');

  if (role === 'seeker') {
    if (seekerBtn) seekerBtn.className = 'h-11 px-3 text-xs sm:text-sm font-extrabold rounded-xl border border-amber-400 bg-amber-500/15 text-amber-900 flex items-center justify-center gap-1.5 transition-all';
    if (volunteerBtn) volunteerBtn.className = 'h-11 px-3 text-xs sm:text-sm font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-700 flex items-center justify-center gap-1.5 transition-all';
  } else {
    if (volunteerBtn) volunteerBtn.className = 'h-11 px-3 text-xs sm:text-sm font-extrabold rounded-xl border border-amber-400 bg-amber-500/15 text-amber-900 flex items-center justify-center gap-1.5 transition-all';
    if (seekerBtn) seekerBtn.className = 'h-11 px-3 text-xs sm:text-sm font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-700 flex items-center justify-center gap-1.5 transition-all';
  }
};

// Auth handlers are strictly managed by js/auth.js


window.signOutUser = async function () {
  if (window.supabaseClient) {
    try {
      await window.supabaseClient.auth.signOut();
    } catch (e) {
      console.warn('Supabase signout warning:', e);
    }
  }

  if (typeof window.nsClearSession === 'function') {
    window.nsClearSession();
  } else {
    localStorage.removeItem('northstar_session');
    localStorage.removeItem('northstar_user_role');
    localStorage.removeItem('northstar_full_name');
    localStorage.removeItem('northstar_username');
    try { sessionStorage.removeItem('ns_session_active'); } catch (e) {}
  }
  showNotification('Signed out successfully.', 'info');

  // Hard navigate back to index.html so Auth Gateway is presented cleanly
  window.location.href = 'index.html';
};

// Active Tab State & Routing Controller
const TAB_ROUTES = {
  dashboard: 'seeker-dashboard.html',
  progress: 'progress.html',
  me: 'progress.html',
  companion: 'companion.html',
  jobs: 'opportunities.html',
  map: 'resource-map.html',
  resume: 'resume-builder.html',
  v_dashboard: 'helper-dashboard.html',
  v_jobs: 'opportunities.html',
  v_donate: 'donate.html'
};

function isMapActiveView(tabOverride) {
  if (tabOverride) return tabOverride === 'map';
  if (window.activeTab === 'map') return true;
  const path = (window.location.pathname || '').toLowerCase();
  return path.includes('resource-map') || path.endsWith('/map.html') || path.endsWith('map');
}

function syncChatbotFABVisibility(tabOverride) {
  const isMap = isMapActiveView(tabOverride);
  const fab = document.getElementById('chat-fab');
  document.body.setAttribute('data-active-tab', isMap ? 'map' : (tabOverride || window.activeTab || 'dashboard'));
  document.body.classList.toggle('map-page', isMap);
  if (isMap) {
    if (window.isChatOpen) closeAIChatbotWindow();
  } else if (!fab && typeof initGlobalAIChatbot === 'function') {
    initGlobalAIChatbot();
  }
}
window.syncChatbotFABVisibility = syncChatbotFABVisibility;

window.setActiveTab = function (tabId) {
  const cleanTab = (tabId || 'dashboard').toLowerCase();
  window.activeTab = cleanTab;
  syncChatbotFABVisibility(cleanTab);
  document.querySelectorAll('.ns-nav .ns-nav__item').forEach(el => {
    const isMatch = el.getAttribute('data-nav-tab') === cleanTab;
    el.classList.toggle('is-active', isMatch);
    if (isMatch) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  });
};

// Every in-app page change goes through here so it gets the same short branded transition.
function nsGo(url, opts) {
  if (typeof window.nsNavigate === 'function') window.nsNavigate(url, opts);
  else if (opts && opts.replace) window.location.replace(url);
  else window.location.href = url;
}
window.nsGo = nsGo;

window.navigateTo = function (tabOrUrl) {
  const key = (tabOrUrl || '').toLowerCase().replace('.html', '');
  const targetUrl = TAB_ROUTES[key] || (tabOrUrl.endsWith('.html') ? tabOrUrl : `${tabOrUrl}.html`);
  nsGo(targetUrl);
};

// Page transitions: intercept same-origin page links and route them through the transition.
function initInstantPageTransitions() {
  if (window._nsLinkTransitionsBound) return;
  window._nsLinkTransitionsBound = true;

  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const link = e.target.closest('a[href]');
    if (!link || link.target === '_blank' || link.hasAttribute('download')) return;

    const href = link.getAttribute('href') || '';
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('tel:') || href.startsWith('mailto:')) return;

    let url;
    try { url = new URL(href, window.location.href); } catch (_) { return; }
    if (url.origin !== window.location.origin || !/\.html$/.test(url.pathname)) return;

    const samePage = url.pathname === window.location.pathname && url.search === window.location.search;
    e.preventDefault();
    if (!samePage) nsGo(url.pathname.split('/').pop() + url.search + url.hash);
  });
}

// Kept for older callers: now a regular navigation with the branded transition.
function navigateToPageInstant(url, pushState = true) {
  nsGo(url, { replace: pushState === false });
}
window.navigateToPageInstant = navigateToPageInstant;

// Update Status Bar Clock
function initClock() {
  const clockElems = document.querySelectorAll('.status-clock');
  const updateTime = () => {
    const now = new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    hours = hours % 12 || 12;
    const timeStr = `${hours}:${minutes}`;
    clockElems.forEach(el => el.textContent = timeStr);
  };
  updateTime();
  setInterval(updateTime, 30000);
}

// Global Role Management (Seeker vs Volunteer) with Supabase & Cache
let cachedSupabaseRole = null;

async function fetchSupabaseUserRole(userId) {
  if (cachedSupabaseRole) return cachedSupabaseRole;
  if (window.supabase) {
    try {
      const { data, error } = await window.supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
      if (!error && data?.role) {
        cachedSupabaseRole = data.role;
        localStorage.setItem('northstar_user_role', data.role);
        return data.role;
      }
    } catch (e) {
      console.warn('Supabase role fetch failed, falling back to local state:', e);
    }
  }
  return localStorage.getItem('northstar_user_role') || 'seeker';
}

function getRole() {
  return cachedSupabaseRole || localStorage.getItem('northstar_user_role') || 'seeker';
}

function setRole(role) {
  if (role !== 'seeker' && role !== 'volunteer') role = 'seeker';
  cachedSupabaseRole = role;
  localStorage.setItem('northstar_user_role', role);
  // The saved role on the account is updated by switchUserRole() through /api/profiles,
  // which checks the session token. The browser never writes the profiles table directly.

  window.userRole = role;
  renderBottomNav();
  renderRoleHeaderToggle();
  enforceFeatureGate();
  if (typeof window.updateLandingRoleCards === 'function') {
    window.updateLandingRoleCards();
  }
}

// Feature Gate Component: Restrict access based on role
function enforceFeatureGate() {
  const role = getRole();
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';

  // Seeker-only routes: resume-builder.html, progress.html
  // Volunteer-only routes: helper-dashboard.html, donate.html
  // Shared / accessible routes: opportunities.html, resource-map.html, call-shelter.html
  const seekerOnlyRoutes = ['resume-builder.html'];
  const volunteerOnlyRoutes = ['helper-dashboard.html', 'donate.html'];

  if (role === 'seeker' && volunteerOnlyRoutes.includes(currentPath)) {
    showNotification('Restricted area. Redirecting to Seeker Dashboard...', 'warning');
    if (typeof navigateToPageInstant === 'function') {
      navigateToPageInstant('seeker-dashboard.html');
    } else {
      window.location.href = 'seeker-dashboard.html';
    }
  } else if (role === 'volunteer' && seekerOnlyRoutes.includes(currentPath)) {
    showNotification('Restricted area. Redirecting to Volunteer Dashboard...', 'warning');
    if (typeof navigateToPageInstant === 'function') {
      navigateToPageInstant('helper-dashboard.html');
    } else {
      window.location.href = 'helper-dashboard.html';
    }
  }
}

// Dynamic Navigation Engine based on Funnel Architecture
function initRoleNavigation() {
  renderRoleHeaderToggle();
  renderBottomNav();
  enforceFeatureGate();
}

function renderRoleHeaderToggle() {
  // Remove the header role toggle if it exists. Role switching is now exclusively in the Settings modal.
  const toggleDiv = document.getElementById('role-header-toggle');
  if (toggleDiv) {
    toggleDiv.remove();
  }
}

// ---- Switching between Find help and Give help ------------------------------------
// A short full-screen splash for each direction, then that side's Home.
//   Give help: yellow fills the screen from the tap, a hand rises and a heart lifts out of it.
//   Find help: the dark Northstar color fills the screen, a path draws up to the North Star.
const ROLE_SPLASH = {
  volunteer: {
    tone: 'give',
    title: 'Giving help',
    sub: 'Thanks for showing up for your neighbors.',
    art: `<svg viewBox="0 0 200 200" fill="none" stroke="#111" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <g class="rs-heart"><path d="M100 98 C 84 86 66 74 66 58 C 66 47 75 40 84 40 C 91 40 96 44 100 50 C 104 44 109 40 116 40 C 125 40 134 47 134 58 C 134 74 116 86 100 98 Z" fill="#fff"/></g>
      <g class="rs-hand"><path d="M28 138 H 50 L 78 128 H 108 C 118 128 118 142 108 142 L 142 126 C 152 121 160 132 152 139 L 118 166 H 28 Z" fill="#fff"/><path d="M108 142 H 86"/></g>
      <path class="rs-spark rs-spark--1" d="M156 52 Q156 62 166 62 Q156 62 156 72 Q156 62 146 62 Q156 62 156 52 Z" fill="#111" stroke-width="3"/>
      <path class="rs-spark rs-spark--2" d="M42 70 Q42 78 50 78 Q42 78 42 86 Q42 78 34 78 Q42 78 42 70 Z" fill="#111" stroke-width="3"/>
      <path class="rs-spark rs-spark--3" d="M150 96 Q150 101 155 101 Q150 101 150 106 Q150 101 145 101 Q150 101 150 96 Z" fill="#111" stroke-width="2"/>
    </svg>`
  },
  seeker: {
    tone: 'find',
    title: 'Finding help',
    sub: 'Beds, meals and gigs near you.',
    art: `<svg viewBox="0 0 200 200" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path class="rs-path" d="M60 182 C 60 150 120 150 112 118 C 106 96 96 92 100 74" stroke="#FFD43B" stroke-width="5" stroke-dasharray="2 12"/>
      <circle class="rs-pin" cx="60" cy="182" r="7" fill="#fff"/>
      <circle class="rs-glow" cx="100" cy="52" r="34" stroke="#FFD43B" stroke-width="3"/>
      <path class="rs-star" d="M100 14 C 102 34 106 44 112 48 C 118 54 128 56 146 58 C 128 60 118 62 112 68 C 106 72 102 82 100 102 C 98 82 94 72 88 68 C 82 62 72 60 54 58 C 72 56 82 54 88 48 C 94 44 98 34 100 14 Z" fill="#FFD43B"/>
      <circle class="rs-twinkle rs-twinkle--1" cx="40" cy="40" r="3" fill="#fff"/>
      <circle class="rs-twinkle rs-twinkle--2" cx="164" cy="104" r="2.5" fill="#fff"/>
      <circle class="rs-twinkle rs-twinkle--3" cx="158" cy="26" r="2" fill="#fff"/>
    </svg>`
  }
};

function playRoleSplash(role, origin) {
  const cfg = ROLE_SPLASH[role];
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return new Promise(resolve => {
    if (!cfg) { resolve(); return; }
    document.querySelectorAll('.ns-role-splash').forEach(el => el.remove());
    const host = document.querySelector('.app-frame') || document.body;
    const box = host.getBoundingClientRect();
    const x = origin && Number.isFinite(origin.x) ? origin.x - box.left : box.width / 2;
    const y = origin && Number.isFinite(origin.y) ? origin.y - box.top : box.height / 2;
    const el = document.createElement('div');
    el.className = `ns-role-splash ns-role-splash--${cfg.tone}${reduce ? ' is-reduced' : ''}`;
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    // The color grows out of the tap as a scaled circle (transform only, so phones keep it smooth)
    const r = Math.ceil(Math.hypot(Math.max(x, box.width - x), Math.max(y, box.height - y)));
    el.style.setProperty('--rs-x', `${x}px`);
    el.style.setProperty('--rs-y', `${y}px`);
    el.style.setProperty('--rs-r', `${r}px`);
    el.innerHTML = `
      <span class="ns-role-splash__fill" aria-hidden="true"></span>
      <div class="ns-role-splash__art">${cfg.art}</div>
      <p class="ns-role-splash__title">${cfg.title}</p>
      <p class="ns-role-splash__sub">${cfg.sub}</p>`;
    host.appendChild(el);
    setTimeout(resolve, reduce ? 450 : 1650);
  });
}
window.playRoleSplash = playRoleSplash;

let _roleSwitching = false;
async function switchUserRole(role, event) {
  if (role !== 'seeker' && role !== 'volunteer') return;
  if (_roleSwitching) return;
  if (getRole() === role) {
    if (typeof closeModal === 'function') closeModal('settings-modal');
    return;
  }
  _roleSwitching = true;
  const origin = event && Number.isFinite(event.clientX) && event.clientX > 0 ? { x: event.clientX, y: event.clientY } : null;
  if (typeof closeModal === 'function') closeModal('settings-modal');

  // Splash first: changing the role can redirect pages that belong to the other side
  await playRoleSplash(role, origin);

  window.userRole = role;
  window.activeTab = role === 'volunteer' ? 'v_dashboard' : 'dashboard';
  setRole(role);

  // Remember the choice on the account itself: the stored session (ns-boot reads session.role on the
  // next page) and the server profile (login hands back the role saved there)
  try {
    const raw = localStorage.getItem('northstar_session');
    const sess = raw ? JSON.parse(raw) : null;
    if (sess && typeof sess === 'object') {
      sess.role = role;
      localStorage.setItem('northstar_session', JSON.stringify(sess));
      if (!sess.isGuest && sess.id && sess.token) {
        fetch('/api/profiles', {
          method: 'POST',
          keepalive: true,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sess.token}` },
          body: JSON.stringify({ id: sess.id, role })
        }).catch(() => {});
      }
    }
  } catch (_) {}

  // Land on that side's Home. Skip the usual cream page cover: the art fades, the color stays,
  // and Home opens under the same color and fades it away (js/ns-boot.js), so nothing flashes.
  const home = role === 'volunteer' ? 'helper-dashboard.html' : 'seeker-dashboard.html';
  const splash = document.querySelector('.ns-role-splash');
  if (splash) splash.classList.add('is-leaving');
  try { sessionStorage.setItem('ns_role_arrive', ROLE_SPLASH[role].tone); } catch (_) {}
  setTimeout(() => window.location.replace(home), splash && !splash.classList.contains('is-reduced') ? 220 : 0);
  setTimeout(() => { _roleSwitching = false; }, 4000);
}
window.switchUserRole = switchUserRole;

function renderDynamicNav() {
  renderBottomNav();
  return;

  nav.className = "absolute bottom-0 left-0 w-full z-40 flex justify-around items-center px-2 py-2 bg-white border-t border-slate-200 shadow-sm";
  nav.style.display = 'flex';
  nav.classList.remove('hidden');

  const role = getRole();
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';

  let navItems = [];

  if (role === 'seeker') {
    // Seeker Funnel Tabs: [Dashboard, Progress, Jobs, Map, Resume, Settings]
    navItems = [
      { href: 'seeker-dashboard.html', label: 'Dashboard', icon: 'dashboard' },
      { href: 'progress.html', label: 'Profile', icon: 'person' },
      { href: 'opportunities.html', label: 'Jobs', icon: 'work' },
      { href: 'resource-map.html', label: 'Map', icon: 'map' },
      { href: 'resume-builder.html', label: 'Resume', icon: 'description' },
      { href: '#', label: 'Settings', icon: 'settings', action: 'openSettingsModal()' }
    ];
  } else {
    // Volunteer Funnel Tabs: [Dashboard, Jobs, Donate Food, Settings]
    navItems = [
      { href: 'helper-dashboard.html', label: 'Dashboard', icon: 'dashboard' },
      { href: 'opportunities.html', label: 'Jobs', icon: 'work' },
      { href: 'donate.html', label: 'Donate Food', icon: 'restaurant' },
      { href: '#', label: 'Settings', icon: 'settings', action: 'openSettingsModal()' }
    ];
  }

  // Smooth item swap animation
  nav.classList.add('transition-opacity', 'duration-150');
  nav.innerHTML = navItems.map(item => {
    const isActive = currentPath === item.href || (currentPath === '' && item.href === 'index.html');
    const activeClass = isActive && !item.action
      ? 'bg-[#FFE855] text-slate-950 rounded-2xl px-2.5 py-1 shadow-sm font-bold animate-switch-pop'
      : 'text-slate-500 hover:text-slate-900 px-1.5 py-1 font-medium';

    const fillStyle = isActive && !item.action ? "style=\"font-variation-settings: 'FILL' 1;\"" : "";

    if (item.action) {
      return `
        <button onclick="${item.action}" class="flex flex-col items-center justify-center transition-all ${activeClass}">
          <span class="material-symbols-outlined text-xl" ${fillStyle}>${item.icon}</span>
          <span class="text-[10px] sm:text-[11px] leading-tight">${item.label}</span>
        </button>
      `;
    }

    return `
      <a class="flex flex-col items-center justify-center transition-all ${activeClass}" href="${item.href}">
        <span class="material-symbols-outlined text-xl" ${fillStyle}>${item.icon}</span>
        <span class="text-[10px] sm:text-[11px] leading-tight">${item.label}</span>
      </a>
    `;
  }).join('');
}

// Donation Form Page Logic
function initDonationForm() {
  const amountBtns = document.querySelectorAll('.donation-amount-btn');
  const customInput = document.getElementById('custom-amount-input');
  const freqBtns = document.querySelectorAll('.freq-btn');
  const donateSubmitBtn = document.getElementById('donate-submit-btn');

  let selectedAmount = '25';

  if (amountBtns.length > 0) {
    amountBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        amountBtns.forEach(b => {
          b.classList.remove('bg-primary-container', 'text-secondary-fixed', 'border-secondary-fixed', 'shadow-md');
          b.classList.add('bg-surface-container-lowest', 'text-on-surface', 'border-slate-200');
        });
        btn.classList.remove('bg-surface-container-lowest', 'text-on-surface', 'border-slate-200');
        btn.classList.add('bg-primary-container', 'text-secondary-fixed', 'border-secondary-fixed', 'shadow-md');
        selectedAmount = btn.dataset.amount || '25';
        if (customInput) customInput.value = '';
      });
    });
  }

  if (customInput) {
    customInput.addEventListener('input', (e) => {
      if (e.target.value) {
        amountBtns.forEach(b => {
          b.classList.remove('bg-primary-container', 'text-secondary-fixed', 'border-secondary-fixed', 'shadow-md');
          b.classList.add('bg-surface-container-lowest', 'text-on-surface', 'border-slate-200');
        });
        selectedAmount = e.target.value;
      }
    });
  }

  if (freqBtns.length > 0) {
    freqBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        freqBtns.forEach(b => {
          b.classList.remove('bg-primary', 'text-on-primary', 'shadow');
          b.classList.add('bg-surface-container', 'text-on-surface-variant');
        });
        btn.classList.remove('bg-surface-container', 'text-on-surface-variant');
        btn.classList.add('bg-primary', 'text-on-primary', 'shadow');
      });
    });
  }

  if (donateSubmitBtn) {
    donateSubmitBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const amount = customInput && customInput.value ? customInput.value : selectedAmount;
      showNotification(`Thank you for your $${amount} donation.`, 'success');
    });
  }
}

// Resource Map Filters & Sheet
function initResourceMapFilter() {
  const filterPills = document.querySelectorAll('.map-filter-pill');
  const mapCards = document.querySelectorAll('.resource-card');

  if (filterPills.length > 0) {
    filterPills.forEach(pill => {
      pill.addEventListener('click', () => {
        filterPills.forEach(p => {
          p.classList.remove('bg-primary', 'text-on-primary', 'shadow-md');
          p.classList.add('bg-surface-container-lowest', 'text-on-surface-variant', 'border', 'border-slate-200');
        });
        pill.classList.remove('bg-surface-container-lowest', 'text-on-surface-variant', 'border', 'border-slate-200');
        pill.classList.add('bg-primary', 'text-on-primary', 'shadow-md');

        const filter = pill.dataset.filter;
        mapCards.forEach(card => {
          if (filter === 'all' || card.dataset.category === filter) {
            card.style.display = 'flex';
          } else {
            card.style.display = 'none';
          }
        });
        updateMilestone('firstStep', true);
      });
    });
  }
}

// Help Request Modal
function initHelpModal() {
  const requestHelpBtns = document.querySelectorAll('.trigger-help-modal');
  requestHelpBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openModal('help-request-modal');
    });
  });
}

// Call Hotline Modal Trigger
function initCallModal() {
  const callBtns = document.querySelectorAll('.trigger-call-modal');
  callBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const shelterName = btn.dataset.shelter || '211';
      const phoneNum = btn.dataset.phone || '211';

      const modalNameEl = document.getElementById('call-modal-name');
      const modalPhoneEl = document.getElementById('call-modal-phone');

      if (modalNameEl) modalNameEl.textContent = shelterName;
      if (modalPhoneEl) modalPhoneEl.textContent = phoneNum;

      updateMilestone('connected', true);
      openModal('call-overlay-modal');
    });
  });
}

// Volunteer Task Claiming
function initTaskClaiming() {
  const claimBtns = document.querySelectorAll('.claim-task-btn');
  claimBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.classList.contains('claimed')) {
        btn.classList.remove('claimed', 'bg-emerald-600', 'text-white');
        btn.classList.add('bg-primary', 'text-on-primary');
        btn.innerHTML = '<span class="material-symbols-outlined text-sm">handshake</span> Claim Task';
        showNotification('Task unassigned.', 'info');
      } else {
        btn.classList.add('claimed', 'bg-emerald-600', 'text-white');
        btn.classList.remove('bg-primary', 'text-on-primary');
        btn.innerHTML = '<span class="material-symbols-outlined text-sm">check_circle</span> Task Claimed!';
        showNotification('Awesome! Task assigned to your volunteer queue. Thank you for stepping up!', 'success');
      }
    });
  });
}

// Modal Helpers
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    modal.querySelectorAll('.ns-sheet-backdrop').forEach(b => { b.style.transition = ''; b.style.opacity = ''; });
    setTimeout(() => {
      const drawer = modal.querySelector('.modal-drawer');
      if (drawer) drawer.classList.remove('translate-y-full');
    }, 10);
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    const drawer = modal.querySelector('.modal-drawer');
    if (drawer) drawer.classList.add('translate-y-full');
    modal.querySelectorAll('.ns-sheet-backdrop').forEach(b => { b.style.transition = 'opacity 0.25s ease'; b.style.opacity = '0'; });
    setTimeout(() => {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }, 300);
  }
}

// ---------------------------------------------------------------------------
// Swipe down to close any bottom sheet (.ns-sheet). Works with touch and mouse.
// It only takes over when the sheet's content is scrolled to the top, ignores
// sideways swipes and form fields, and closes through the sheet's own backdrop
// handler so each page's close logic (closeModal, closeTransitModal, …) still runs.
// ---------------------------------------------------------------------------
(function initSheetSwipe() {
  let drag = null;

  function scrolledAncestor(el, sheet) {
    for (let n = el; n && n !== sheet.parentElement; n = n.parentElement) {
      if (n.scrollTop > 0 && n.scrollHeight > n.clientHeight) return n;
      if (n === sheet) break;
    }
    return null;
  }

  function start(target, x, y, isTouch) {
    const sheet = target.closest && target.closest('.ns-sheet');
    if (!sheet || !sheet.closest('.ns-sheet-wrap')) return;
    if (target.closest('input, textarea, select, [contenteditable="true"], .leaflet-container, .no-sheet-drag')) return;
    drag = {
      sheet, isTouch, startX: x, startY: y, lastY: y, lastT: performance.now(), v: 0, dy: 0,
      active: false, fromHandle: !!target.closest('.ns-sheet__handle'),
      blocked: !!scrolledAncestor(target, sheet)
    };
  }

  function move(x, y, evt) {
    if (!drag) return;
    const dy = y - drag.startY;
    const dx = x - drag.startX;
    if (!drag.active) {
      if (Math.abs(dy) < 8 && Math.abs(dx) < 8) return;
      // sideways, pulling up, or content that is still scrolled: leave it to the browser
      if (Math.abs(dx) > Math.abs(dy) || dy < 0 || (drag.blocked && !drag.fromHandle)) { drag = null; return; }
      drag.active = true;
      drag.sheet.style.transition = 'none';
      drag.backdrop = drag.sheet.parentElement.querySelector('.ns-sheet-backdrop');
    }
    drag.dy = Math.max(0, dy);
    drag.sheet.style.transform = `translateY(${drag.dy}px)`;
    if (drag.backdrop) drag.backdrop.style.opacity = String(Math.max(0.25, 1 - drag.dy / (drag.sheet.offsetHeight || 400)));
    const now = performance.now();
    drag.v = 0.8 * ((y - drag.lastY) / Math.max(1, now - drag.lastT)) + 0.2 * drag.v;
    drag.lastY = y;
    drag.lastT = now;
    if (evt && evt.cancelable) evt.preventDefault();
  }

  function end() {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (!d.active) return;
    const sheet = d.sheet;
    const shouldClose = d.dy > Math.min(140, sheet.offsetHeight * 0.3) || d.v > 0.6;
    // a drag must not also count as a tap on whatever was under the finger
    const swallow = (e) => { e.stopPropagation(); e.preventDefault(); };
    sheet.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => sheet.removeEventListener('click', swallow, { capture: true }), 350);

    sheet.style.transition = 'transform 0.26s cubic-bezier(0.22, 0.8, 0.24, 1)';
    if (shouldClose) {
      sheet.style.transform = 'translateY(110%)';
      setTimeout(() => {
        if (d.backdrop) d.backdrop.click();
        requestAnimationFrame(() => { sheet.style.transform = ''; sheet.style.transition = ''; });
      }, 220);
    } else {
      sheet.style.transform = 'translateY(0)';
      if (d.backdrop) { d.backdrop.style.transition = 'opacity 0.26s ease'; d.backdrop.style.opacity = ''; }
      setTimeout(() => { sheet.style.transform = ''; sheet.style.transition = ''; }, 280);
    }
  }

  document.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) start(e.target, e.touches[0].clientX, e.touches[0].clientY, true);
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (drag && drag.isTouch && e.touches.length === 1) move(e.touches[0].clientX, e.touches[0].clientY, e);
  }, { passive: false });
  document.addEventListener('touchend', end);
  document.addEventListener('touchcancel', end);

  document.addEventListener('mousedown', (e) => { if (e.button === 0) start(e.target, e.clientX, e.clientY, false); });
  window.addEventListener('mousemove', (e) => { if (drag && !drag.isTouch) move(e.clientX, e.clientY, e); });
  window.addEventListener('mouseup', () => { if (drag && !drag.isTouch) end(); });
})();

// Settings sheet
// ---- Companion AI consent (App Review Guideline 5.1.2(i)) ----------------------------------
// Nothing is sent to Companion's AI services until the person agrees here. The choice is kept on
// this phone (and with the account, via js/user-data.js) and can be changed in Settings.
const AI_CONSENT_KEY = 'northstar_ai_consent';
function nsAiConsent() {
  try { return localStorage.getItem(AI_CONSENT_KEY) === 'yes'; } catch (e) { return false; }
}
function nsSetAiConsent(on) {
  try { localStorage.setItem(AI_CONSENT_KEY, on ? 'yes' : 'no'); } catch (e) {}
}
window.nsAiConsent = nsAiConsent;
window.nsSetAiConsent = nsSetAiConsent;

window.nsEnsureAiConsent = function () {
  if (nsAiConsent()) return Promise.resolve(true);
  return new Promise((resolve) => {
    document.getElementById('ai-consent-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'ai-consent-modal';
    modal.className = 'ns-sheet-wrap hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'ai-consent-title');
    modal.innerHTML = `
      <div class="ns-sheet-backdrop" data-ai-consent="no"></div>
      <div class="modal-drawer ns-sheet translate-y-full">
        <div class="ns-sheet__handle"></div>
        <h2 id="ai-consent-title" class="ns-sheet__title">Before you talk to Companion</h2>
        <p class="ns-card-sub mt-3">Companion is an AI helper. To answer you, Northstar sends what you type or say, and your recent messages in this chat, to <strong>Google’s Gemini</strong> AI service.</p>
        <p class="ns-card-sub mt-3">If you use your voice, your recording is sent to <strong>ElevenLabs</strong> to turn it into words, and Companion’s answers are sent to ElevenLabs to be read out loud.</p>
        <p class="ns-card-sub mt-3">Please don’t share things you want to keep private, like ID numbers or health details. You can turn this off any time in Settings. <a href="privacy.html" class="underline">Privacy policy</a></p>
        <div class="mt-6 flex flex-col gap-3">
          <button type="button" class="ns-btn ns-btn--primary" data-ai-consent="yes">Allow and continue</button>
          <button type="button" class="ns-btn ns-btn--ghost" data-ai-consent="no">Not now</button>
        </div>
      </div>`;
    (document.querySelector('.app-frame') || document.body).appendChild(modal);
    modal.addEventListener('click', (e) => {
      const choice = e.target.closest('[data-ai-consent]');
      if (!choice) return;
      const ok = choice.getAttribute('data-ai-consent') === 'yes';
      if (ok) nsSetAiConsent(true);
      closeModal('ai-consent-modal');
      setTimeout(() => modal.remove(), 400);
      resolve(ok);
    });
    openModal('ai-consent-modal');
    setTimeout(() => modal.querySelector('[data-ai-consent="yes"]')?.focus(), 50);
  });
};

// ---- Report and block posts (App Review Guideline 1.2) --------------------------------------
// Jobs and pickup requests are written by people. Anyone signed in can report one; the reporter
// stops seeing it right away, and can also hide everything from that poster (block).
const BLOCKED_POSTERS_KEY = 'northstar_blocked_posters';
const REPORTED_POSTS_KEY = 'northstar_reported_posts';
function nsReadList(key) {
  try { const v = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; }
}
function nsAddToList(key, value) {
  if (!value) return;
  const list = nsReadList(key);
  if (!list.includes(value)) { list.push(value); try { localStorage.setItem(key, JSON.stringify(list)); } catch (e) {} }
}
window.nsIsBlockedPoster = (posterKey) => !!posterKey && nsReadList(BLOCKED_POSTERS_KEY).includes(posterKey);
window.nsIsReportedPost = (kind, id) => nsReadList(REPORTED_POSTS_KEY).includes(`${kind}:${id}`);
window.nsHiddenPost = (kind, post) => !!post && (window.nsIsBlockedPoster(post.poster_key) || window.nsIsReportedPost(kind, post.id));

window.nsReportPost = function (kind, encId, encPosterKey) {
  const id = decodeURIComponent(encId || '');
  const posterKey = decodeURIComponent(encPosterKey || '');
  const session = getSession();
  document.getElementById('report-modal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'report-modal';
  modal.className = 'ns-sheet-wrap hidden';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'report-title');
  const what = kind === 'job' ? 'job post' : 'pickup request';
  modal.innerHTML = session.isGuest ? `
      <div class="ns-sheet-backdrop" onclick="closeModal('report-modal')"></div>
      <div class="modal-drawer ns-sheet translate-y-full">
        <div class="ns-sheet__handle"></div>
        <h2 id="report-title" class="ns-sheet__title">Report this ${what}</h2>
        <p class="ns-card-sub mt-3">Please sign in to report a post, so we can follow up if needed.</p>
        <div class="mt-6 flex flex-col gap-3">
          <button type="button" class="ns-btn ns-btn--primary" onclick="redirectToAuthGateway()">Sign in or create an account</button>
          <button type="button" class="ns-btn ns-btn--ghost" onclick="closeModal('report-modal')">Cancel</button>
        </div>
      </div>` : `
      <div class="ns-sheet-backdrop" onclick="closeModal('report-modal')"></div>
      <form class="modal-drawer ns-sheet translate-y-full" id="report-form">
        <div class="ns-sheet__handle"></div>
        <h2 id="report-title" class="ns-sheet__title">Report this ${what}</h2>
        <p class="ns-card-sub mt-1">You won’t see it again. Our team reviews every report.</p>
        <fieldset class="ns-list mt-4">
          <legend class="ns-label">What’s wrong?</legend>
          ${[['offensive', 'Offensive or hateful'], ['unsafe', 'Scam, unsafe or illegal'], ['spam', 'Spam or fake'], ['other', 'Something else']].map(([v, t], i) => `
          <label class="ns-row cursor-pointer"><span class="ns-row__body"><span class="ns-row__title block">${t}</span></span>
            <input type="radio" name="report-reason" value="${v}" ${i === 0 ? 'checked' : ''}></label>`).join('')}
        </fieldset>
        ${posterKey ? `<label class="ns-row cursor-pointer mt-2" for="report-block">
          <span class="ns-row__body"><span class="ns-row__title block">Also hide posts from this person</span>
          <span class="ns-row__sub block">Blocks them for you. You can’t undo this yet.</span></span>
          <input type="checkbox" id="report-block" class="ns-switch"></label>` : ''}
        <p id="report-status" class="ns-card-sub mt-3" role="status"></p>
        <div class="mt-5 flex flex-col gap-3">
          <button type="submit" class="ns-btn ns-btn--primary">Send report</button>
          <button type="button" class="ns-btn ns-btn--ghost" onclick="closeModal('report-modal')">Cancel</button>
        </div>
      </form>`;
  (document.querySelector('.app-frame') || document.body).appendChild(modal);
  const form = modal.querySelector('#report-form');
  if (form) form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = modal.querySelector('#report-status');
    const btn = form.querySelector('[type="submit"]');
    const reason = (form.querySelector('input[name="report-reason"]:checked') || {}).value || 'other';
    const block = !!(form.querySelector('#report-block') || {}).checked;
    btn.disabled = true;
    try {
      const res = await fetch('/api/reports', { method: 'POST', headers: nsAuthHeaders(), body: JSON.stringify({ kind, id, reason }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Couldn’t send the report. Please try again.');
      nsAddToList(REPORTED_POSTS_KEY, `${kind}:${id}`);
      if (block) nsAddToList(BLOCKED_POSTERS_KEY, posterKey);
      document.querySelectorAll(`[data-job-id="${CSS.escape(id)}"]`).forEach(el => el.remove());
      if (typeof window.notifyDeliveriesChanged === 'function') window.notifyDeliveriesChanged();
      if (typeof window.loadOpportunities === 'function' && kind === 'job') window.loadOpportunities(true);
      status.textContent = 'Thanks. Your report was sent and the post is hidden for you.';
      setTimeout(() => closeModal('report-modal'), 1600);
    } catch (err) {
      status.textContent = err.message;
      btn.disabled = false;
    }
  });
  openModal('report-modal');
};

let _nsSupportEmail = null;
async function nsSupportEmail() {
  if (_nsSupportEmail !== null) return _nsSupportEmail;
  try {
    const cfg = await (await fetch('/api/config')).json();
    _nsSupportEmail = String(cfg.supportEmail || '');
  } catch (e) { _nsSupportEmail = ''; }
  return _nsSupportEmail;
}

// Account deletion (App Review Guideline 5.1.1(v)): two steps, then everything is removed
window.nsDeleteAccount = async function (confirmed) {
  const box = document.getElementById('settings-delete-box');
  if (!box) return;
  if (!confirmed) {
    box.innerHTML = `
      <p class="ns-card-title">Delete your account?</p>
      <p class="ns-card-sub mt-1">This removes your account, your saved places, resume and progress, and the jobs and pickup requests you posted. It can’t be undone.</p>
      <p id="settings-delete-error" class="mt-2 text-[15px] font-semibold" role="alert" style="display:none;color:var(--danger)"></p>
      <div class="mt-4 flex flex-col gap-3">
        <button type="button" class="ns-btn ns-btn--danger" onclick="nsDeleteAccount(true)">Delete my account</button>
        <button type="button" class="ns-btn ns-btn--ghost" onclick="openSettingsModal()">Cancel</button>
      </div>`;
    box.querySelector('.ns-btn--danger')?.focus();
    return;
  }
  const btn = box.querySelector('.ns-btn--danger');
  if (btn) { btn.disabled = true; btn.textContent = 'Deleting…'; }
  try {
    const res = await fetch('/api/account', { method: 'DELETE', headers: nsAuthHeaders() });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || !out.success) throw new Error(out.error || 'Couldn’t delete your account right now. Please try again.');
    try {
      Object.keys(localStorage).filter(k => /^(northstar_|ns_)/.test(k)).forEach(k => localStorage.removeItem(k));
      sessionStorage.clear();
    } catch (e) {}
    window.location.replace('index.html?deleted=1');
  } catch (err) {
    const msg = document.getElementById('settings-delete-error');
    if (msg) { msg.textContent = err.message; msg.style.display = 'block'; }
    if (btn) { btn.disabled = false; btn.textContent = 'Delete my account'; }
  }
};

function settingsAuthMarkup(session) {
  if (session.isGuest) {
    return `
      <button type="button" onclick="redirectToAuthGateway()" class="ns-btn ns-btn--primary">
        Sign in or create an account
      </button>`;
  }
  return `
    <button type="button" onclick="logout()" class="ns-btn ns-btn--ghost">
      <span class="material-symbols-outlined">logout</span>
      Sign out
    </button>
    <div id="settings-delete-box" class="mt-6">
      <button type="button" onclick="nsDeleteAccount(false)" class="ns-btn ns-btn--danger">
        <span class="material-symbols-outlined">delete</span>
        Delete account
      </button>
    </div>`;
}

window.openSettingsModal = function () {
  let modal = document.getElementById('settings-modal');
  const session = getSession();
  const name = nsDisplayName();

  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'settings-modal';
    modal.className = 'ns-sheet-wrap hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'settings-title');
    modal.innerHTML = `
      <div class="ns-sheet-backdrop" onclick="closeModal('settings-modal')"></div>
      <div class="modal-drawer ns-sheet translate-y-full">
        <div class="ns-sheet__handle"></div>
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 id="settings-title" class="ns-sheet__title">Settings</h2>
            <p id="settings-account-line" class="ns-card-sub mt-1"></p>
          </div>
          <button type="button" class="ns-icon-btn ns-icon-btn--sm" onclick="closeModal('settings-modal')" aria-label="Close settings">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <div class="mt-6">
          <span class="ns-label" id="settings-role-label">I’m using Northstar to</span>
          <div class="ns-segment" role="group" aria-labelledby="settings-role-label">
            <button type="button" id="settings-role-seeker" onclick="switchUserRole('seeker', event)">Find help</button>
            <button type="button" id="settings-role-volunteer" onclick="switchUserRole('volunteer', event)">Give help</button>
          </div>
          <p class="ns-hint">Switching changes your home screen and tabs.</p>
        </div>

        <div class="mt-6">
          <span class="ns-label" id="settings-theme-label">Appearance</span>
          <div class="ns-segment" role="group" aria-labelledby="settings-theme-label">
            <button type="button" data-theme-choice="light" onclick="setThemeMode('light')">Light</button>
            <button type="button" data-theme-choice="dark" onclick="setThemeMode('dark')">Dark</button>
            <button type="button" data-theme-choice="system" onclick="setThemeMode('system')">Auto</button>
          </div>
          <p class="ns-hint">Auto matches your phone. You can also tap the moon or sun at the top of a page.</p>
        </div>

        <div class="ns-list mt-6">
          <label class="ns-row cursor-pointer" for="settings-ai-consent">
            <span class="ns-row__body">
              <span class="ns-row__title block">Companion AI</span>
              <span class="ns-row__sub block">Sends your chat to Google Gemini and your voice to ElevenLabs. Off turns Companion off.</span>
            </span>
            <input type="checkbox" id="settings-ai-consent" class="ns-switch" onchange="nsSetAiConsent(this.checked)">
          </label>
          <a class="ns-row" href="privacy.html">
            <span class="ns-row__body"><span class="ns-row__title block">Privacy policy</span>
            <span class="ns-row__sub block">What Northstar collects and who it shares it with</span></span>
            <span class="material-symbols-outlined" aria-hidden="true">chevron_right</span>
          </a>
          <a class="ns-row hidden" id="settings-contact" href="#">
            <span class="ns-row__body"><span class="ns-row__title block">Contact us</span>
            <span class="ns-row__sub block" id="settings-contact-sub">Report a problem or ask a question</span></span>
            <span class="material-symbols-outlined" aria-hidden="true">mail</span>
          </a>
        </div>

        <div class="mt-6" id="settings-auth-container"></div>
      </div>
    `;
    const appFrame = document.querySelector('.app-frame') || document.body;
    appFrame.appendChild(modal);
  }

  const accountLine = document.getElementById('settings-account-line');
  if (accountLine) {
    accountLine.textContent = session.isGuest
      ? 'You’re using Northstar without an account.'
      : `Signed in as ${name || session.username}`;
  }

  const authContainer = document.getElementById('settings-auth-container');
  if (authContainer) authContainer.innerHTML = settingsAuthMarkup(session);

  const role = getRole();
  const seekerBtn = document.getElementById('settings-role-seeker');
  const volunteerBtn = document.getElementById('settings-role-volunteer');
  if (seekerBtn) {
    seekerBtn.classList.toggle('is-active', role !== 'volunteer');
    seekerBtn.setAttribute('aria-pressed', String(role !== 'volunteer'));
  }
  if (volunteerBtn) {
    volunteerBtn.classList.toggle('is-active', role === 'volunteer');
    volunteerBtn.setAttribute('aria-pressed', String(role === 'volunteer'));
  }

  const aiSwitch = document.getElementById('settings-ai-consent');
  if (aiSwitch) aiSwitch.checked = nsAiConsent();
  nsSupportEmail().then((email) => {
    const link = document.getElementById('settings-contact');
    if (!link || !email) return;
    link.href = `mailto:${email}`;
    link.classList.remove('hidden');
    const sub = document.getElementById('settings-contact-sub');
    if (sub) sub.textContent = email;
  });

  updateSettingsThemeUI();
  openModal('settings-modal');
};

// Global Toast Notification System (Disabled per user request)
function showNotification(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (container) container.remove();
  return;
}// --- Auth Entry Functions ---

function loginAsGuest() {
  const session = { username: 'Guest', role: 'seeker', isGuest: true, loggedInAt: Date.now() };
  try { sessionStorage.setItem('ns_session_active', '1'); } catch (e) {}
  localStorage.setItem('northstar_session', JSON.stringify(session));
  localStorage.removeItem('northstar_data_Guest'); // Clean slate every time for Guest!

  if (typeof navigateToPageInstant === 'function') {
    navigateToPageInstant('seeker-dashboard.html');
  } else {
    window.location.href = 'seeker-dashboard.html';
  }
}

function loginAsUser(username, mode) {
  if (!username || !username.trim()) {
    showNotification('Please enter a username to continue.', 'error');
    return;
  }

  const role = currentGatewayMode || 'seeker';
  const session = { username: username.trim(), role, isGuest: false, mode, loggedInAt: Date.now() };
  try { sessionStorage.setItem('ns_session_active', '1'); } catch (e) {}
  localStorage.setItem('northstar_session', JSON.stringify(session));

  // Ensure initial data structure exists for user account
  const key = `northstar_data_${session.username.trim()}`;
  if (!localStorage.getItem(key)) {
    const newUserData = {
      isGuest: false,
      username: session.username.trim(),
      resumeData: null,
      progress: {
        firstStep: false,
        safePlace: false,
        basicNeeds: false,
        connected: false,
        movingForward: false,
      }
    };
    localStorage.setItem(key, JSON.stringify(newUserData));
  }

  // Hide the welcome-gateway overlay
  const gateway = document.getElementById('welcome-gateway');
  if (gateway) gateway.style.display = 'none';

  // Also hide the auth-gateway-view if present
  const authView = document.getElementById('auth-gateway-view');
  if (authView) { authView.classList.add('hidden'); authView.style.display = 'none'; }

  // Show main app layout
  const mainLayout = document.getElementById('main-app-layout');
  if (mainLayout) { mainLayout.classList.remove('hidden'); mainLayout.style.display = 'flex'; }

  console.log(`Logged in as ${username} (${mode}, role: ${role})`);
}

// Expose globally for HTML handlers
window.openModal = openModal;
window.closeModal = closeModal;
window.showNotification = showNotification;
window.switchUserRole = switchUserRole;
window.setRole = setRole;
window.getRole = getRole;
window.loginAsGuest = loginAsGuest;
window.loginAsUser = loginAsUser;
window.saveResumeData = saveResumeData;
window.setGatewayMode = setGatewayMode;
window.handleGatewayLogin = window.handleAuthFormSubmit;
window.logout = logout;
window.redirectToAuthGateway = function () {
  if (typeof window.closeModal === 'function') window.closeModal('settings-modal');
  if (typeof window.nsClearSession === 'function') {
    window.nsClearSession();
  } else {
    localStorage.removeItem('northstar_session');
    localStorage.removeItem('northstar_user_role');
    try { sessionStorage.removeItem('ns_session_active'); } catch (e) {}
  }
  // Show the onboarding overlay and go back to step 1
  const overlay = document.getElementById('onboarding-overlay');
  if (overlay) {
    overlay.style.display = 'flex';
    overlay.style.opacity = '1';
    overlay.style.transform = '';
    if (typeof window.showOnboardingStep === 'function') window.showOnboardingStep(1);
  } else {
    // Fallback: reload index to show onboarding
    window.location.href = 'index.html';
  }
};
window.renderAccountHeaderAvatar = renderAccountHeaderAvatar;

// --- Guest Feature Locking Engine ---
function checkGuestLockAccess() {
  const session = getSession();
  const appFrame = document.querySelector('.app-frame') || document.body;
  const mainContent = appFrame.querySelector('main') || appFrame;

  if (!session || !session.isGuest) {
    const existingOverlay = document.getElementById('guest-lock-overlay');
    if (existingOverlay) existingOverlay.remove();

    if (mainContent && mainContent !== appFrame) {
      mainContent.style.filter = '';
      mainContent.style.pointerEvents = '';
      mainContent.style.userSelect = '';
      mainContent.style.opacity = '';
    }
    return;
  }

  const path = window.location.pathname.toLowerCase();
  const currentFileName = path.split('/').pop() || 'index.html';
  const isDashboardOrHome = currentFileName === 'index.html' || currentFileName === 'seeker-dashboard.html' || currentFileName === 'helper-dashboard.html' || currentFileName === 'resource-map.html' || currentFileName === 'call-shelter.html' || currentFileName === 'companion.html';

  if (!isDashboardOrHome) {
    // Soften the page behind the prompt so it reads as locked
    if (mainContent && mainContent !== appFrame) {
      mainContent.style.filter = 'blur(10px)';
      mainContent.style.pointerEvents = 'none';
      mainContent.style.userSelect = 'none';
      mainContent.style.opacity = '0.45';
    }

    let overlay = document.getElementById('guest-lock-overlay');
    if (overlay) overlay.remove();

    const homeUrl = getRole() === 'volunteer' ? 'helper-dashboard.html' : 'seeker-dashboard.html';
    overlay = document.createElement('div');
    overlay.id = 'guest-lock-overlay';
    overlay.className = 'absolute inset-x-0 top-0 z-[120] flex items-center justify-center px-5 animate-fade-in';
    overlay.style.bottom = 'var(--nav-h)';
    overlay.innerHTML = `
      <div class="ns-card ns-card--pad w-full max-w-[340px] text-center animate-fade-in-up">
        <span class="ns-tile mx-auto"><span class="material-symbols-outlined">lock</span></span>
        <h3 class="text-[20px] font-bold mt-4">Create a free account to use this</h3>
        <p class="ns-card-sub mt-2">Your resume and progress are saved to your account so they’re here next time.</p>
        <div class="mt-5 flex flex-col gap-3">
          <button type="button" onclick="redirectToAuthGateway()" class="ns-btn ns-btn--primary">Sign in or create an account</button>
          <a href="${homeUrl}" class="ns-btn ns-btn--ghost">Back to home</a>
        </div>
      </div>
    `;
    appFrame.appendChild(overlay);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkGuestLockAccess);
} else {
  checkGuestLockAccess();
}

// --- Progress State Management ---

let currentGatewayMode = 'seeker';

function setGatewayMode(mode) {
  currentGatewayMode = mode;
  const pill = document.getElementById('gateway-pill');
  const btnSeeker = document.getElementById('gateway-btn-seeker');
  const btnVolunteer = document.getElementById('gateway-btn-volunteer');

  if (pill) {
    if (mode === 'volunteer') {
      pill.style.transform = 'translateX(100%)';
      if (btnSeeker) { btnSeeker.classList.remove('text-white'); btnSeeker.classList.add('text-slate-500'); }
      if (btnVolunteer) { btnVolunteer.classList.remove('text-slate-500'); btnVolunteer.classList.add('text-white'); }
    } else {
      pill.style.transform = 'translateX(0)';
      if (btnSeeker) { btnSeeker.classList.remove('text-slate-500'); btnSeeker.classList.add('text-white'); }
      if (btnVolunteer) { btnVolunteer.classList.remove('text-white'); btnVolunteer.classList.add('text-slate-500'); }
    }
  }
}

function handleGatewayLogin(mode) {
  if (typeof window.handleAuthFormSubmit === 'function') {
    return window.handleAuthFormSubmit();
  }
}

function logout() {
  if (typeof window.nsClearSession === 'function') {
    window.nsClearSession();
  } else {
    localStorage.removeItem('northstar_session');
    localStorage.removeItem('northstar_user_role');
    localStorage.removeItem('northstar_full_name');
    localStorage.removeItem('northstar_username');
    try { sessionStorage.removeItem('ns_session_active'); } catch (e) {}
  }
  window.location.href = 'index.html';
}

function getSession() {
  if (typeof window.nsGetValidSession === 'function') {
    const valid = window.nsGetValidSession();
    if (valid) return valid;
  } else {
    try {
      const s = JSON.parse(localStorage.getItem('northstar_session') || 'null');
      const last = s ? Math.max(Number(s.lastActiveAt) || 0, Number(s.loggedInAt) || 0) : 0;
      const age = last ? (Date.now() - last) : Infinity;
      if (s && age >= -60000 && age < 5 * 60 * 1000) return s;
      localStorage.removeItem('northstar_session');
      localStorage.removeItem('northstar_user_role');
    } catch (e) {}
  }
  return { role: 'seeker', isGuest: true, username: 'Guest' };
}

const CORE_MILESTONES = [
  {
    id: 'appExplorer',
    icon: 'explore',
    title: 'Look around',
    desc: 'Open a few different parts of the app.',
    actionUrl: 'resource-map.html',
    actionLabel: 'Explore'
  },
  {
    id: 'aiCompanion',
    icon: 'chat_bubble',
    title: 'Ask Companion a question',
    desc: 'Get answers about shelters, food, jobs or your resume.',
    actionUrl: 'companion.html',
    actionLabel: 'Ask'
  },
  {
    id: 'savedLocation',
    icon: 'bookmark',
    title: 'Save a place',
    desc: 'Bookmark a shelter or service on the map.',
    actionUrl: 'resource-map.html',
    actionLabel: 'Open map'
  },
  {
    id: 'resumeBuilder',
    icon: 'description',
    title: 'Build your resume',
    desc: 'Turn the work you’ve done into a resume in a few steps.',
    actionUrl: 'resume-builder.html',
    actionLabel: 'Start'
  },
  {
    id: 'jobMatcher',
    icon: 'work',
    title: 'Browse jobs',
    desc: 'See gigs and jobs that are hiring near you.',
    actionUrl: 'opportunities.html',
    actionLabel: 'View jobs'
  }
];

// Nothing counts as done until the person has actually done it.
const defaultUserData = {
  isGuest: true,
  username: 'Guest',
  resumeData: null,
  progress: {
    appExplorer: false,
    aiCompanion: false,
    savedLocation: false,
    resumeBuilder: false,
    jobMatcher: false
  }
};

function getUserData() {
  const session = getSession();
  const storageKey = session.isGuest ? 'northstar_guest_progress_data' : `northstar_data_${session.username}`;
  let data;
  try {
    const raw = localStorage.getItem(storageKey);
    data = raw ? JSON.parse(raw) : null;
  } catch (e) {
    data = null;
  }
  if (!data || typeof data !== 'object') data = JSON.parse(JSON.stringify(defaultUserData));
  if (!data.progress) data.progress = {};

  CORE_MILESTONES.forEach(m => {
    if (typeof data.progress[m.id] !== 'boolean') data.progress[m.id] = false;
  });

  // Detections from real app usage
  if (localStorage.getItem('northstar_app_explored') === 'true') {
    data.progress.appExplorer = true;
  }
  const savedRes = localStorage.getItem('northstar_saved_resources');
  if (savedRes) {
    try {
      const parsed = JSON.parse(savedRes);
      if (Array.isArray(parsed) && parsed.length > 0) data.progress.savedLocation = true;
    } catch (e) { }
  }
  if (data.resumeData || localStorage.getItem('northstar_resume_saved') === 'true') {
    data.progress.resumeBuilder = true;
  }
  if (localStorage.getItem('northstar_jobs_explored') === 'true') {
    data.progress.jobMatcher = true;
  }
  if (localStorage.getItem('northstar_ai_used') === 'true') {
    data.progress.aiCompanion = true;
  }

  return data;
}

function saveUserData(userData) {
  const session = getSession();
  const storageKey = session.isGuest ? 'northstar_guest_progress_data' : `northstar_data_${session.username}`;
  localStorage.setItem(storageKey, JSON.stringify(userData));
}

function getProgressSummary() {
  const state = getUserData().progress || {};
  const completedCount = CORE_MILESTONES.filter(m => state[m.id] === true).length;
  return {
    state,
    completedCount,
    percentage: Math.round((completedCount / CORE_MILESTONES.length) * 100),
    nextPending: CORE_MILESTONES.find(m => !state[m.id]) || null
  };
}
window.getProgressSummary = getProgressSummary;

function syncDashboardProgressWidget() {
  const { completedCount, percentage, nextPending } = getProgressSummary();
  const total = CORE_MILESTONES.length;

  const tasksTextEl = document.getElementById('dashboard-progress-tasks-text');
  if (tasksTextEl) {
    tasksTextEl.textContent = nextPending
      ? `${completedCount} of ${total} done`
      : 'All done';
  }

  const nextMilestoneEl = document.getElementById('dashboard-next-milestone-label');
  if (nextMilestoneEl) {
    nextMilestoneEl.textContent = nextPending ? nextPending.title : 'You’re all set up';
  }

  const nextLink = document.getElementById('dashboard-next-step-link');
  if (nextLink) {
    nextLink.setAttribute('href', nextPending ? nextPending.actionUrl : 'progress.html');
  }

  const pctEl = document.getElementById('dashboard-progress-pct');
  if (pctEl) pctEl.textContent = `${percentage}%`;

  const barEl = document.getElementById('dashboard-progress-bar');
  if (barEl) barEl.style.width = `${percentage}%`;
}
window.syncDashboardProgressWidget = syncDashboardProgressWidget;
window.updateProgressUI = function () {
  renderProgressPage();
  syncDashboardProgressWidget();
};

function updateMilestone(milestoneKey, isCompleted) {
  localStorage.setItem('northstar_progress_customized', 'true');
  const userData = getUserData();
  if (!userData.progress) userData.progress = {};
  userData.progress[milestoneKey] = isCompleted;
  saveUserData(userData);
  renderProgressPage();
  syncDashboardProgressWidget();
}

window.toggleMilestoneCompletion = function (milestoneKey, event) {
  if (event) event.stopPropagation();
  // Milestones update only from real actions (updateMilestone), never by tapping.
  return false;
};

function saveResumeData(data) {
  if (typeof window.matchAndRenderJobs === 'function') window.matchAndRenderJobs(data);
  localStorage.setItem('northstar_resume_saved', 'true');
  const userData = getUserData();
  userData.resumeData = data;
  userData.progress.resumeBuilder = true;
  saveUserData(userData);
  syncDashboardProgressWidget();
}

// Track page exploration automatically
(function trackAppNavigation() {
  try {
    const path = window.location.pathname.split('/').pop() || 'index.html';
    const visitedRaw = localStorage.getItem('northstar_visited_pages');
    const visited = visitedRaw ? JSON.parse(visitedRaw) : [];
    if (!visited.includes(path)) {
      visited.push(path);
      localStorage.setItem('northstar_visited_pages', JSON.stringify(visited));
    }
    const appPages = visited.filter(p => p !== 'index.html' && p !== '');
    if (appPages.length >= 3) {
      localStorage.setItem('northstar_app_explored', 'true');
    }
    if (path.includes('jobs') || path.includes('opportunities')) {
      localStorage.setItem('northstar_jobs_explored', 'true');
    }
  } catch (e) { }
})();

// Progress list on the Me page (progress.html)
function renderProgressPage() {
  const listContainer = document.getElementById('journey-list-container');
  if (!listContainer) return;

  const session = getSession();
  const { state, completedCount, percentage } = getProgressSummary();
  const total = CORE_MILESTONES.length;

  const accountLabel = document.getElementById('progress-account-label');
  if (accountLabel) {
    accountLabel.textContent = session.isGuest
      ? 'Using Northstar without an account'
      : `Signed in as ${session.full_name || session.username}`;
  }

  const progressText = document.getElementById('journey-progress-text');
  if (progressText) progressText.textContent = `${completedCount} of ${total} done`;

  const pctBadge = document.getElementById('journey-pct-badge');
  if (pctBadge) pctBadge.textContent = `${percentage}%`;

  const progressBar = document.getElementById('journey-progress-bar');
  if (progressBar) progressBar.style.width = `${percentage}%`;

  const stepperContainer = document.getElementById('stepper-nodes');
  if (stepperContainer) {
    stepperContainer.innerHTML = CORE_MILESTONES.map(m => {
      const done = !!state[m.id];
      return `<span title="${m.title}" class="block h-2 flex-1 rounded-full ${done ? 'bg-amber' : 'bg-sand'}"></span>`;
    }).join('');
  }

  listContainer.innerHTML = CORE_MILESTONES.map(m => {
    const done = !!state[m.id];
    const tile = done
      ? `<span class="ns-tile ns-tile--leaf"><span class="material-symbols-outlined">check</span></span>`
      : `<span class="ns-tile ns-tile--plain"><span class="material-symbols-outlined">${m.icon}</span></span>`;
    const end = done
      ? `<span class="ns-badge ns-badge--leaf">Done</span>`
      : `<span class="material-symbols-outlined ns-chevron" aria-label="${m.actionLabel}">chevron_right</span>`;
    const inner = `
      ${tile}
      <span class="ns-row__body">
        <span class="ns-row__title block ${done ? 'text-ink-2' : ''}">${m.title}</span>
        <span class="ns-row__sub block">${m.desc}</span>
      </span>
      <span class="ns-row__end">${end}</span>`;
    return done
      ? `<div class="ns-row" data-milestone-id="${m.id}">${inner}</div>`
      : `<a class="ns-row" href="${m.actionUrl}" data-milestone-id="${m.id}">${inner}</a>`;
  }).join('');
}
window.renderProgress = renderProgressPage;
window.renderProgressPage = renderProgressPage;

// Bottom navigation. Seekers: Home, Map, Jobs, Resume, Me. Volunteers: Home, Jobs, Donate, Me.
// Settings stay one tap away from the round account button in each header.
function renderBottomNav() {
  const path = (window.location.pathname || '').toLowerCase();
  const isLanding = (path.endsWith('/index.html') || path.endsWith('/login.html') || path.endsWith('/signup.html') || path === '/');
  if (isLanding && (document.getElementById('onboarding-step-1') || document.getElementById('simple-login-name'))) {
    return;
  }

  const appFrame = document.querySelector('.app-frame') || document.querySelector('.phone-frame');
  if (!appFrame) return;

  let nav = appFrame.querySelector('nav.bottom-nav') || appFrame.querySelector('nav');
  if (!nav) {
    nav = document.createElement('nav');
    appFrame.appendChild(nav);
  }

  const userRole = getRole();
  const isVolunteer = userRole === 'volunteer';
  document.documentElement.classList.toggle('ns-volunteer', isVolunteer);

  const isDashboard = path.includes('dashboard') || path.includes('call-shelter');
  const isResume = path.includes('resume');
  // Volunteers have no Resume tab; the builder is seeker-only anyway
  const isMe = path.includes('progress') || path.includes('profile') || (isVolunteer && isResume);
  const isJobs = path.includes('opportunities') || path.includes('jobs');
  const isMap = path.includes('map');
  const isCompanion = path.includes('companion');
  const isDonate = path.includes('donate');

  const currentActiveTab = isVolunteer
    ? (isDonate ? 'v_donate' : isJobs ? 'v_jobs' : isCompanion ? 'companion' : isMe ? 'me' : 'v_dashboard')
    : (isMap ? 'map' : isResume ? 'resume' : isMe ? 'me' : isJobs ? 'jobs' : isCompanion ? 'companion' : 'dashboard');

  window.activeTab = currentActiveTab;
  syncChatbotFABVisibility(currentActiveTab);

  const NAV_CONFIG = {
    seeker: [
      { id: 'dashboard', label: 'Home', icon: 'home', href: 'seeker-dashboard.html', active: isDashboard },
      { id: 'map', label: 'Map', icon: 'map', href: 'resource-map.html', active: isMap },
      { id: 'jobs', label: 'Gigs', icon: 'work', href: 'opportunities.html', active: isJobs },
      { id: 'resume', label: 'Resume', icon: 'description', href: 'resume-builder.html', active: isResume },
      { id: 'companion', label: 'Companion', icon: 'chat_bubble', href: 'companion.html', active: isCompanion },
      { id: 'me', label: 'Profile', icon: 'person', href: 'progress.html', active: isMe }
    ],
    volunteer: [
      { id: 'v_dashboard', label: 'Home', icon: 'home', href: 'helper-dashboard.html', active: isDashboard },
      { id: 'v_jobs', label: 'Gigs', icon: 'work', href: 'opportunities.html', active: isJobs },
      { id: 'v_donate', label: 'Donate', icon: 'volunteer_activism', href: 'donate.html', active: isDonate },
      { id: 'companion', label: 'Companion', icon: 'chat_bubble', href: 'companion.html', active: isCompanion },
      { id: 'me', label: 'Me', icon: 'person', href: 'progress.html', active: isMe }
    ]
  };

  const tabs = NAV_CONFIG[isVolunteer ? 'volunteer' : 'seeker'];

  nav.className = `bottom-nav ns-nav${tabs.length > 5 ? ' ns-nav--dense' : ''}`;
  nav.removeAttribute('style');
  nav.setAttribute('aria-label', 'Main');
  nav.innerHTML = tabs.map(tab => {
    const cls = `ns-nav__item${tab.active ? ' is-active' : ''}`;
    const inner = `<span class="material-symbols-outlined" aria-hidden="true">${tab.icon}</span><span>${tab.label}</span>`;
    if (tab.action) {
      return `<button type="button" onclick="${tab.action}" data-nav-tab="${tab.id}" class="${cls}">${inner}</button>`;
    }
    return `<a href="${tab.href}" data-nav-tab="${tab.id}" class="${cls}"${tab.active ? ' aria-current="page"' : ''}>${inner}</a>`;
  }).join('');
}
window.renderBottomNav = renderBottomNav;

window.fetchUnifiedDeliveries = async function() {
  try {
    const res = await fetch('/api/deliveries', { headers: nsAuthHeaders() });
    if (res.ok) {
      const data = await res.json();
      // Requests from blocked people, or ones this person reported, are left out
      const deliveries = (Array.isArray(data.deliveries) ? data.deliveries : []).filter(d => !window.nsHiddenPost('delivery', d));
      try { localStorage.setItem('northstar_cached_deliveries', JSON.stringify(deliveries)); } catch(_) {}
      return deliveries;
    }
  } catch (err) {
    console.warn('Deliveries API unavailable, using the last saved list:', err);
  }
  // Offline or server error: show the last list we saw
  try {
    const local = JSON.parse(localStorage.getItem('northstar_cached_deliveries') || '[]');
    return Array.isArray(local) ? local : [];
  } catch (_) {
    return [];
  }
};

window.notifyDeliveriesChanged = function() {
  if (typeof window.renderVolunteerFoodDonationsQueue === 'function') {
    window.renderVolunteerFoodDonationsQueue();
  }
  if (typeof window.renderAvailableDeliveriesModalContent === 'function') {
    window.renderAvailableDeliveriesModalContent();
  }
  try { window.dispatchEvent(new CustomEvent('northstar_deliveries_updated')); } catch(_) {}
};

window.addEventListener('northstar_deliveries_updated', () => {
  if (typeof window.renderVolunteerFoodDonationsQueue === 'function') {
    window.renderVolunteerFoodDonationsQueue();
  }
  if (typeof window.renderAvailableDeliveriesModalContent === 'function') {
    window.renderAvailableDeliveriesModalContent();
  }
});
window.addEventListener('storage', (e) => {
  if (e.key === 'northstar_cached_deliveries' || e.key === 'northstar_last_delivery_id') {
    window.notifyDeliveriesChanged();
  }
});

async function renderVolunteerFoodDonationsQueue() {
  const container = document.getElementById('dashboard-deliveries-queue');
  const viewAllLink = document.getElementById('volunteer-view-all-pickups');
  const totalDonationsEl = document.getElementById('volunteer-total-donations');

  // Money donated from this device (stored locally by the donate flow)
  if (totalDonationsEl) {
    try {
      const storedDonations = JSON.parse(localStorage.getItem('northstar_donations') || '[]');
      const sum = Array.isArray(storedDonations)
        ? storedDonations.reduce((acc, item) => acc + (Number(item?.amount) || 0), 0)
        : 0;
      totalDonationsEl.textContent = `$${sum.toLocaleString()}`;
    } catch (_) {
      totalDonationsEl.textContent = '$0';
    }
  }

  if (!container) return;

  const emptyStateHTML = `
    <div class="ns-empty">
      <img class="ns-empty__art" src="assets/illustrations/box.svg" alt="">
      <p class="ns-empty__title">No pickups waiting</p>
      <p class="ns-empty__sub">When someone posts a food donation, it shows up here for you to claim.</p>
    </div>
  `;

  try {
    const allDeliveries = await window.fetchUnifiedDeliveries();
    const deliveries = (allDeliveries || []).filter(d => !['claimed', 'driver_assigned', 'in_transit', 'delivered'].includes(d.status));

    if (deliveries.length === 0) {
      if (viewAllLink) viewAllLink.classList.add('hidden');
      container.innerHTML = emptyStateHTML;
      return;
    }

    if (viewAllLink) viewAllLink.classList.remove('hidden');

    container.innerHTML = `<div class="ns-card px-4">${deliveries.slice(0, 5).map(d => {
      const id = nsEscape(d.id);
      const itemLabel = nsEscape(Array.isArray(d.items) ? d.items.join(', ') : (d.items || 'Food donation'));
      const bags = Number(d.bags) || 0;
      const route = [d.donorArea, d.destination].filter(Boolean).map(nsEscape).join(' → ');
      const meta = [bags ? `${bags} ${bags === 1 ? 'bag' : 'bags'}` : '', nsEscape(d.timeWindow || '')].filter(Boolean).join(' · ');
      return `
        <div class="ns-row">
          <span class="ns-art-tile"><img src="assets/illustrations/icons/deliver.svg" alt=""></span>
          <div class="ns-row__body">
            <p class="ns-row__title truncate">${itemLabel}</p>
            ${route ? `<p class="ns-row__sub truncate">${route}</p>` : ''}
            ${meta ? `<p class="ns-row__sub truncate">${meta}</p>` : ''}
          </div>
          <button type="button" onclick="nsReportPost('delivery', '${encodeURIComponent(d.id)}', '${encodeURIComponent(d.poster_key || '')}')" class="ns-icon-btn ns-icon-btn--sm" aria-label="Report or block this pickup request" title="Report or block">
            <span class="material-symbols-outlined" aria-hidden="true">flag</span>
          </button>
          <button type="button" onclick="window.claimAndTrackDelivery('${id}')" class="ns-btn ns-btn--primary ns-btn--sm">Claim</button>
        </div>`;
    }).join('')}</div>`;
  } catch (err) {
    console.error('Error fetching dashboard deliveries:', err);
    if (viewAllLink) viewAllLink.classList.add('hidden');
    container.innerHTML = emptyStateHTML;
  }
}
window.renderVolunteerFoodDonationsQueue = renderVolunteerFoodDonationsQueue;

// ── Delivery claiming & tracking ─────────────────────────────────────────────
window.claimAndTrackDelivery = async function(id) {
  try {
    const sessionRaw = localStorage.getItem('northstar_session');
    const sessionObj = sessionRaw ? JSON.parse(sessionRaw) : {};
    const driverId = sessionObj.id || null;
    const driverName = sessionObj.full_name || sessionObj.username || sessionObj.name || 'Volunteer';

    const claimRes = await fetch(`/api/deliveries/${encodeURIComponent(id)}/claim`, {
      method: 'POST',
      headers: nsAuthHeaders(),
      body: JSON.stringify({ driverName: driverName, driver_id: driverId })
    });
    if (claimRes.status === 409) {
      showNotification('Another volunteer already claimed this pickup.', 'error');
      window.notifyDeliveriesChanged();
      return;
    }
    if (!claimRes.ok) {
      // Not claimed: leave the pickup in the queue so it can be tried again
      showNotification('Couldn’t claim this pickup right now.', 'error');
      window.notifyDeliveriesChanged();
      return;
    }

    try { localStorage.setItem('northstar_last_delivery_id', id); } catch(_) {}

    // Update local cache status
    try {
      const cached = JSON.parse(localStorage.getItem('northstar_cached_deliveries') || '[]');
      const target = cached.find(d => d.id === id);
      if (target) {
        target.status = 'driver_assigned';
        target.driverName = driverName;
        if (driverId) target.driver_id = driverId;
        localStorage.setItem('northstar_cached_deliveries', JSON.stringify(cached));
      }
    } catch(_) {}

    showNotification('Pickup claimed.', 'success');
    window.openUberTrackingModal(id);
    window.notifyDeliveriesChanged();
  } catch (err) {
    // Network failure: the claim never reached the server, so don't pretend it did
    console.error('Error claiming delivery:', err);
    showNotification('Couldn’t claim this pickup right now.', 'error');
    window.notifyDeliveriesChanged();
  }
};

window.updateDeliveryStatusDirect = async function(id, status) {
  try {
    await fetch(`/api/deliveries/${encodeURIComponent(id)}/status`, {
      method: 'POST',
      headers: nsAuthHeaders(),
      body: JSON.stringify({ status: status })
    });
    const res = await fetch(`/api/deliveries/${encodeURIComponent(id)}`, { headers: nsAuthHeaders() });
    const data = await res.json();
    if (data.delivery) {
      window.updateUberTrackingUI(data.delivery);
    }
    try {
      const cached = JSON.parse(localStorage.getItem('northstar_cached_deliveries') || '[]');
      const target = cached.find(d => d.id === id);
      if (target) {
        target.status = status;
        localStorage.setItem('northstar_cached_deliveries', JSON.stringify(cached));
      }
    } catch(_) {}

    showNotification(status === 'delivered' ? 'Marked as delivered.' : 'Marked as on the way.', 'success');
    window.notifyDeliveriesChanged();
  } catch (err) {
    console.warn('Status update notice:', err);
  }
};

function closeDeliveryTracker() {
  clearInterval(window._uberTrackingInterval);
  const modal = document.getElementById('uber-tracking-modal');
  if (!modal) return;
  const sheet = modal.querySelector('.modal-drawer');
  if (sheet) sheet.classList.add('translate-y-full');
  const backdrop = modal.querySelector('.ns-sheet-backdrop');
  if (backdrop) { backdrop.style.transition = 'opacity 0.25s ease'; backdrop.style.opacity = '0'; }
  setTimeout(() => modal.remove(), 300);
}
window.closeDeliveryTracker = closeDeliveryTracker;

const DELIVERY_STEPS = [
  { key: 'posted', label: 'Posted' },
  { key: 'claimed', label: 'Claimed' },
  { key: 'on_the_way', label: 'On the way' },
  { key: 'delivered', label: 'Delivered' }
];

window.openUberTrackingModal = function(deliveryId) {
  const existing = document.getElementById('uber-tracking-modal');
  if (existing) existing.remove();

  const safeId = nsEscape(deliveryId);
  const isVolunteer = getRole() === 'volunteer';
  const modal = document.createElement('div');
  modal.id = 'uber-tracking-modal';
  modal.className = 'ns-sheet-wrap flex';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'uber-status-title');
  modal.innerHTML = `
    <div class="ns-sheet-backdrop" onclick="closeDeliveryTracker()"></div>
    <div class="modal-drawer ns-sheet translate-y-full">
      <div class="ns-sheet__handle"></div>
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="ns-card-sub">Food delivery</p>
          <h2 id="uber-status-title" class="ns-sheet__title mt-1"><span id="uber-status-badge">Loading…</span></h2>
        </div>
        <button type="button" class="ns-icon-btn ns-icon-btn--sm" onclick="closeDeliveryTracker()" aria-label="Close">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <div class="mt-6 grid grid-cols-4 gap-2" aria-label="Delivery progress">
        ${DELIVERY_STEPS.map((s, i) => `
          <div class="flex flex-col items-center gap-2 text-center">
            <span id="step-node-${i + 1}" class="w-9 h-9 rounded-full grid place-items-center bg-paper border-2 border-line text-muted text-[13px] font-bold">${i + 1}</span>
            <span id="step-label-${i + 1}" class="text-[12px] font-semibold text-muted leading-tight">${s.label}</span>
          </div>`).join('')}
      </div>
      <div class="ns-progress mt-4"><span id="uber-progress-bar-fill" style="width: 0%"></span></div>

      <div class="mt-6 ns-card px-4">
        <div class="ns-row"><span class="ns-row__body ns-row__sub !mt-0">Items</span><span id="uber-items-text" class="ns-row__end">–</span></div>
        <div class="ns-row"><span class="ns-row__body ns-row__sub !mt-0">Pickup area</span><span id="uber-area-text" class="ns-row__end">–</span></div>
        <div class="ns-row"><span class="ns-row__body ns-row__sub !mt-0">Going to</span><span id="uber-dest-text" class="ns-row__end">–</span></div>
        <div class="ns-row"><span class="ns-row__body ns-row__sub !mt-0">Volunteer</span><span id="uber-driver-name" class="ns-row__end">–</span></div>
      </div>

      ${isVolunteer ? `
      <div id="uber-volunteer-controls" class="mt-6 grid grid-cols-2 gap-3 hidden">
        <button type="button" onclick="window.updateDeliveryStatusDirect('${safeId}', 'in_transit')" class="ns-btn ns-btn--secondary">On my way</button>
        <button type="button" onclick="window.updateDeliveryStatusDirect('${safeId}', 'delivered')" class="ns-btn ns-btn--primary">Delivered</button>
      </div>` : ''}
    </div>
  `;
  const appFrame = document.querySelector('.app-frame') || document.body;
  appFrame.appendChild(modal);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const sheet = modal.querySelector('.modal-drawer');
    if (sheet) sheet.classList.remove('translate-y-full');
  }));

  if (window._uberTrackingInterval) clearInterval(window._uberTrackingInterval);

  const fetchAndUpdate = async () => {
    let shown = false;
    try {
      const res = await fetch(`/api/deliveries/${encodeURIComponent(deliveryId)}`, { headers: nsAuthHeaders() });
      const data = res.ok ? await res.json() : null;
      if (data && data.delivery) { window.updateUberTrackingUI(data.delivery); shown = true; }
    } catch (e) {
      console.warn('Tracking poll notice:', e);
    }
    if (shown) return;
    // Offline or not found on the server: show the last state we have for this pickup
    try {
      const cached = JSON.parse(localStorage.getItem('northstar_cached_deliveries') || '[]');
      const local = Array.isArray(cached) ? cached.find(d => d && d.id === deliveryId) : null;
      if (local) window.updateUberTrackingUI(local);
    } catch (_) {}
  };

  fetchAndUpdate();
  window._uberTrackingInterval = setInterval(fetchAndUpdate, 4000);
};

window.updateUberTrackingUI = function(d) {
  const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };

  const items = Array.isArray(d.items) && d.items.length ? d.items.join(', ') : (typeof d.items === 'string' && d.items.trim() ? d.items : 'Food donation');
  set('uber-items-text', items);
  set('uber-area-text', d.donorArea || 'Not given');
  set('uber-dest-text', d.destination || 'Not given');
  set('uber-driver-name', d.driverName || 'Not claimed yet');

  let stepIndex = 0;
  let title = 'Waiting for a volunteer';
  if (d.status === 'driver_assigned' || d.status === 'claimed') { stepIndex = 1; title = 'A volunteer claimed it'; }
  else if (d.status === 'in_transit') { stepIndex = 2; title = 'On the way'; }
  else if (d.status === 'delivered') { stepIndex = 3; title = 'Delivered'; }
  set('uber-status-badge', title);

  const fill = document.getElementById('uber-progress-bar-fill');
  if (fill) fill.style.width = `${Math.round((stepIndex / 3) * 100)}%`;

  DELIVERY_STEPS.forEach((s, i) => {
    const node = document.getElementById(`step-node-${i + 1}`);
    const label = document.getElementById(`step-label-${i + 1}`);
    if (!node) return;
    const done = i < stepIndex || (i === stepIndex && d.status === 'delivered');
    const current = i === stepIndex && !done;
    node.className = 'w-9 h-9 rounded-full grid place-items-center text-[13px] font-bold border-2 transition-colors '
      + (done ? 'bg-amber border-amber text-ink' : current ? 'bg-ink border-ink text-cream' : 'bg-paper border-line text-muted');
    node.innerHTML = done ? '<span class="material-symbols-outlined text-[18px]">check</span>' : String(i + 1);
    if (label) label.className = 'text-[12px] leading-tight ' + (done || current ? 'font-bold text-ink' : 'font-semibold text-muted');
  });

  const controls = document.getElementById('uber-volunteer-controls');
  if (controls) {
    // Only the volunteer who claimed this delivery can update it
    const me = getSession();
    const isMine = !!(d.driver_id && me && me.id && d.driver_id === me.id);
    controls.classList.toggle('hidden', d.status === 'delivered' || !isMine);
  }
};

window.matchAndRenderJobs = async function (resumeData) {
  const container = document.getElementById('matched-jobs-container');
  if (!container || !resumeData) return;

  try {
    const res = await fetch('/api/jobs');
    const data = await res.json();
    if (!data.jobs || data.jobs.length === 0) return;

    const userKeywords = [];
    if (resumeData.skills) {
      if (resumeData.skills.certifications) userKeywords.push(...resumeData.skills.certifications);
      if (resumeData.skills.practical_skills) userKeywords.push(...resumeData.skills.practical_skills);
      if (resumeData.skills.core_strengths) userKeywords.push(...resumeData.skills.core_strengths);
    }
    if (resumeData.experience) {
      resumeData.experience.forEach(exp => {
        if (exp.role) userKeywords.push(exp.role);
      });
    }

    const scoredJobs = data.jobs.map(job => {
      const jobText = (job.title + ' ' + (job.requirements || []).join(' ')).toLowerCase();
      const matched = userKeywords.filter(kw => kw && jobText.includes(String(kw).toLowerCase()));
      return { ...job, matched, score: matched.length };
    }).filter(j => j.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);

    if (scoredJobs.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = `
      <div class="ns-section-head"><h2>Jobs that fit your resume</h2></div>
      <div class="flex flex-col gap-3">
      ${scoredJobs.map(job => {
        const parts = String(job.contact || '').split(' | ');
        const email = (parts[0] || '').trim();
        const phone = (parts[1] || '').replace(/[^0-9]/g, '');
        return `
        <div class="ns-card ns-card--pad">
          <p class="ns-card-title">${nsEscape(job.title)}</p>
          <p class="ns-card-sub mt-1">${[job.company, job.pay].filter(Boolean).map(nsEscape).join(' · ')}</p>
          ${job.description ? `<p class="text-[14px] text-ink-2 mt-3 leading-relaxed">${nsEscape(job.description)}</p>` : ''}
          <p class="ns-hint">Matches: ${job.matched.slice(0, 3).map(nsEscape).join(', ')}</p>
          <div class="mt-4 grid grid-cols-2 gap-3">
            ${email.includes('@') ? `<a href="mailto:${nsEscape(email)}" class="ns-btn ns-btn--ghost ns-btn--sm w-full">Email</a>` : ''}
            ${phone ? `<a href="tel:${phone}" class="ns-btn ns-btn--primary ns-btn--sm w-full">Call</a>` : ''}
          </div>
        </div>`;
      }).join('')}
      </div>
    `;
  } catch (err) {
    console.error('Error matching jobs:', err);
  }
};

// --- Dashboard: job matches need an account and a resume ---
function checkDashboardJobMatchLock() {
  const container = document.getElementById('ai-job-matches-container');
  if (!container) return;

  const session = getSession();
  const userData = getUserData();
  const hasResume = !!(userData && userData.resumeData);

  if (session.isGuest) {
    container.innerHTML = `
      <div class="ns-empty">
        <p class="ns-empty__title">Job matches need an account</p>
        <p class="ns-empty__sub">Create a free account and we’ll match jobs to your skills.</p>
        <button type="button" onclick="redirectToAuthGateway()" class="ns-btn ns-btn--primary ns-btn--sm mt-4">Sign in or create an account</button>
      </div>
    `;
    return;
  }

  if (!hasResume) {
    container.innerHTML = `
      <div class="ns-empty">
        <p class="ns-empty__title">Build a resume to see matches</p>
        <p class="ns-empty__sub">We use your skills and past work to find jobs that fit.</p>
        <a href="resume-builder.html" class="ns-btn ns-btn--primary ns-btn--sm mt-4">Build your resume</a>
      </div>
    `;
  }
}

// ============================================================
// GLOBAL AI CHATBOT WIDGET (SEEKER & HELPER / VOLUNTEER)
// ============================================================
// Companion lives on its own tab (companion.html). Other screens open it, optionally
// with a question (?q=). Conversations are saved on this phone, per account, so people
// can come back to a chat, start a new one, or delete them ("Your chats" sheet).
const COMPANION_PAGE = 'companion.html';
const COMPANION_TRANSCRIPT_KEY = 'ns_companion_transcript'; // legacy (session-only), migrated once
const COMPANION_HISTORY_KEY = 'ns_companion_history';       // legacy
const COMPANION_CHAT_LIMIT = 30;

function isCompanionPage() {
  return !!document.getElementById('companion-page');
}

function readSession(key, fallback) {
  try {
    const v = JSON.parse(sessionStorage.getItem(key) || 'null');
    return v == null ? fallback : v;
  } catch (e) {
    return fallback;
  }
}

function writeSession(key, value) {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
}

// ---- Saved chats (localStorage, one list per account on this phone) ----
function chatStoreKey() {
  const s = getSession();
  const who = s && !s.isGuest && (s.id || s.username) ? String(s.id || s.username) : 'guest';
  return `ns_companion_chats_${who}`;
}

function readChats() {
  try {
    const v = JSON.parse(localStorage.getItem(chatStoreKey()) || 'null');
    if (v && Array.isArray(v.chats)) return v;
  } catch (e) {}
  return { chats: [], activeId: null };
}

function writeChats(store) {
  store.chats.sort((a, b) => b.updatedAt - a.updatedAt);
  store.chats = store.chats.slice(0, COMPANION_CHAT_LIMIT);
  if (store.activeId && !store.chats.some(c => c.id === store.activeId)) store.activeId = null;
  try { localStorage.setItem(chatStoreKey(), JSON.stringify(store)); } catch (e) {}
}

function activeChat(store) {
  return store.chats.find(c => c.id === store.activeId) || null;
}

// One-time move of the old session-only conversation into the saved list
function migrateLegacyChat() {
  const legacy = readSession(COMPANION_TRANSCRIPT_KEY, []);
  if (!legacy.length) return;
  const store = readChats();
  const now = Date.now();
  const firstUser = legacy.find(i => i.who === 'user');
  const chat = {
    id: `c${now}`,
    title: firstUser ? String(firstUser.text).slice(0, 60) : 'Chat',
    createdAt: now,
    updatedAt: now,
    transcript: legacy.slice(-60),
    history: readSession(COMPANION_HISTORY_KEY, [])
  };
  store.chats.unshift(chat);
  store.activeId = chat.id;
  writeChats(store);
  try {
    sessionStorage.removeItem(COMPANION_TRANSCRIPT_KEY);
    sessionStorage.removeItem(COMPANION_HISTORY_KEY);
  } catch (e) {}
}

// Draw a saved conversation into the message list
function renderCompanionConversation(chat) {
  const list = document.getElementById('chatbot-messages-list');
  if (!list) return;
  list.querySelectorAll('.chat-msg-incoming, .chat-msg-outgoing, #chatbot-typing-bubble').forEach(el => el.remove());
  window.northstarChatHistory = chat && Array.isArray(chat.history) ? chat.history.slice(-10) : [];
  (chat ? chat.transcript : []).forEach(item => {
    if (item.who === 'user') appendUserMessageBubble(item.text, { restore: true });
    else appendAssistantMessageBubble(item.text, !!item.error, item.action || null, { restore: true });
  });
  updateCompanionEmptyState();
  updateCompanionHeader(chat);
  list.scrollTop = list.scrollHeight;
}

function updateCompanionHeader(chat) {
  const meta = document.getElementById('companion-meta');
  // Always the tagline: chat titles are just the first message ("hi") and live in the chats list.
  if (meta) meta.textContent = 'Ask about beds, meals, gigs or your resume';
  const count = document.getElementById('companion-chats-count');
  if (count) {
    const n = readChats().chats.length;
    count.textContent = n > 9 ? '9+' : String(n);
    count.classList.toggle('hidden', n === 0);
  }
}

function initGlobalAIChatbot() {
  // No floating button any more: Companion is a tab
  document.querySelectorAll('#chat-fab').forEach(el => el.remove());
  if (!isCompanionPage() || window._companionReady) return;
  window._companionReady = true;

  migrateLegacyChat();
  const store = readChats();
  renderCompanionConversation(activeChat(store));
  updateChatbotSuggestionChips();

  const q = new URLSearchParams(window.location.search).get('q');
  if (q) {
    window.history.replaceState({}, document.title, window.location.pathname);
    // A question from another screen starts its own chat
    startNewCompanionChat({ keepSheet: true });
    dispatchChatMessage(q);
  } else {
    const chat = activeChat(store);
    if (chat && chat.transcript && chat.transcript.length > 0) {
      const lastMsg = chat.transcript[chat.transcript.length - 1];
      if (lastMsg.who === 'user') {
        // AI never replied before tab was closed/changed, resume processing
        setTimeout(() => {
          dispatchChatMessage(lastMsg.text, true);
        }, 100);
      }
    }
  }
}

// The empty-state welcome shows until the first message
function updateCompanionEmptyState() {
  const empty = document.getElementById('companion-empty');
  const list = document.getElementById('chatbot-messages-list');
  if (!empty || !list) return;
  const hasMessages = !!list.querySelector('.chat-msg-incoming, .chat-msg-outgoing');
  empty.classList.toggle('hidden', hasMessages);
}

window.isChatOpen = false;

function openAIChatbotWindow() {
  if (isCompanionPage()) {
    const input = document.getElementById('chatbot-input-field');
    if (input) input.focus();
    return;
  }
  nsGo(COMPANION_PAGE);
}

function closeAIChatbotWindow() { window.isChatOpen = false; }

function toggleAIChatbotWindow() { openAIChatbotWindow(); }

window.openAIChatbotWindow = openAIChatbotWindow;
window.closeAIChatbotWindow = closeAIChatbotWindow;
window.openChatDrawer = openAIChatbotWindow;
window.closeChatDrawer = closeAIChatbotWindow;

function updateChatbotSuggestionChips() {
  const container = document.getElementById('chatbot-suggestion-chips');
  if (!container) return;

  const rawRole = getRole();
  const isHelperRole = (rawRole === 'volunteer' || rawRole === 'donater' || rawRole === 'helper' || rawRole === 'employer');
  const chips = isHelperRole
    ? [
      ['Food pickups', 'How do food pickup claims work?'],
      ['Post a job', 'How do I post a new job opportunity?'],
      ['Ways to help', 'How can I volunteer today?']
    ]
    : [
      ['A bed tonight', 'I need a bed tonight.'],
      ['Food near me', 'Where can I get food near me?'],
      ['Gigs for me', 'Find the best job for me based on my resume.'],
      ['Resume help', 'How do I make a resume?']
    ];

  container.innerHTML = chips.map(([label, question]) =>
    `<button type="button" class="ns-chip ns-chip--sm" data-question="${nsEscape(question)}">${nsEscape(label)}</button>`
  ).join('');
  container.querySelectorAll('button[data-question]').forEach(btn => {
    btn.onclick = (e) => sendQuickChatMessage(btn.getAttribute('data-question'), e);
  });
}

// Canonical in-memory history array for the Companion chat
window.northstarChatHistory = window.northstarChatHistory || [];

function sendQuickChatMessage(msg, event) {
  if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
  if (!isCompanionPage()) {
    nsGo(`${COMPANION_PAGE}?q=${encodeURIComponent(msg)}`);
    return;
  }
  dispatchChatMessage(msg);
}

function appendChatMessage(msgObj) {
  const text = typeof msgObj === 'string' ? msgObj : (msgObj && msgObj.text ? msgObj.text : '');
  if (text) sendQuickChatMessage(text);
  else openAIChatbotWindow();
}

// Save a message into the open chat (creates the chat on its first message)
function saveTranscriptItem(item) {
  const store = readChats();
  let chat = activeChat(store);
  const now = Date.now();
  if (!chat) {
    chat = { id: `c${now}`, title: '', createdAt: now, updatedAt: now, transcript: [], history: [] };
    store.chats.unshift(chat);
    store.activeId = chat.id;
  }
  chat.transcript.push(item);
  chat.transcript = chat.transcript.slice(-60);
  if (!chat.title && item.who === 'user') chat.title = String(item.text).replace(/\s+/g, ' ').trim().slice(0, 60);
  chat.updatedAt = now;
  writeChats(store);
  updateCompanionHeader(chat);
}

// Keep the model's short memory with the chat so follow-ups work after reopening it
function saveChatHistory() {
  const store = readChats();
  const chat = activeChat(store);
  if (!chat) return;
  chat.history = (window.northstarChatHistory || []).slice(-10);
  writeChats(store);
}

function appendUserMessageBubble(text, opts = {}) {
  const messagesList = document.getElementById('chatbot-messages-list');
  if (!messagesList) return;

  const bubble = document.createElement('div');
  bubble.className = 'ns-chat__bubble ns-chat__bubble--out chat-msg-outgoing';
  bubble.textContent = text;
  messagesList.appendChild(bubble);
  messagesList.scrollTop = messagesList.scrollHeight;
  if (!opts.restore) saveTranscriptItem({ who: 'user', text });
  updateCompanionEmptyState();
}

function appendAssistantMessageBubble(text, isError = false, action = null, opts = {}) {
  const messagesList = document.getElementById('chatbot-messages-list');
  if (!messagesList) return;

  const row = document.createElement('div');
  row.className = 'flex gap-2 items-start chat-msg-incoming';

  const mark = document.createElement('span');
  mark.className = 'ns-chat__mark ns-chat__mark--sm';
  mark.setAttribute('aria-hidden', 'true');

  const wrap = document.createElement('div');
  wrap.className = 'flex flex-col gap-2 max-w-[85%]';

  const bubble = document.createElement('div');
  bubble.className = `ns-chat__bubble ns-chat__bubble--in !max-w-full${isError ? ' ns-chat__bubble--error' : ''}`;
  bubble.textContent = text;
  wrap.appendChild(bubble);

  if (action && action.type === 'navigate') {
    let target = null;
    let label = action.label || '';
    if (action.destination === 'jobs') {
      target = 'opportunities.html';
      label = label || 'See gigs';
    } else if (action.destination === 'map' && action.resourceId) {
      target = `resource-map.html?resource=${encodeURIComponent(action.resourceId)}`;
      label = label || 'Show on map';
    }
    if (target) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ns-btn ns-btn--primary ns-btn--sm self-start';
      btn.textContent = label;
      btn.onclick = (e) => {
        e.preventDefault();
        nsGo(target);
      };
      wrap.appendChild(btn);
    }
  }

  row.appendChild(mark);
  row.appendChild(wrap);
  messagesList.appendChild(row);
  messagesList.scrollTop = messagesList.scrollHeight;
  if (!opts.restore) saveTranscriptItem({ who: 'assistant', text, error: !!isError, action: action || null });
  updateCompanionEmptyState();
}

// ---- Managing chats: new, open, delete, list ----
function chatBusy() {
  // Don't switch chats while a reply is on its way (it belongs to the open chat)
  if (!window._chatPending) return false;
  showCompanionNotice('Wait for Companion to finish answering, then try again.');
  return true;
}

function showCompanionNotice(text) {
  const el = document.getElementById('companion-notice');
  if (!el) return;
  el.textContent = text;
  el.classList.remove('hidden');
  clearTimeout(window._companionNoticeTimer);
  window._companionNoticeTimer = setTimeout(() => el.classList.add('hidden'), 2600);
}

function startNewCompanionChat(opts = {}) {
  if (chatBusy()) return;
  const store = readChats();
  store.activeId = null;
  writeChats(store);
  renderCompanionConversation(null);
  if (!opts.keepSheet) closeModal('companion-chats-sheet');
  const input = document.getElementById('chatbot-input-field');
  if (input && !opts.keepSheet) input.focus();
}
window.startNewCompanionChat = startNewCompanionChat;
window.clearCompanionConversation = startNewCompanionChat; // older name

window.openCompanionChat = function (id) {
  if (chatBusy()) return;
  const store = readChats();
  if (!store.chats.some(c => c.id === id)) return;
  store.activeId = id;
  writeChats(store);
  renderCompanionConversation(activeChat(store));
  closeModal('companion-chats-sheet');
};

window.deleteCompanionChat = function (id, event) {
  if (event) { event.stopPropagation(); event.preventDefault(); }
  if (window._chatPending && readChats().activeId === id) { chatBusy(); return; }
  const store = readChats();
  const wasActive = store.activeId === id;
  store.chats = store.chats.filter(c => c.id !== id);
  if (wasActive) store.activeId = null;
  writeChats(store);
  if (wasActive) renderCompanionConversation(null);
  else updateCompanionHeader(activeChat(store));
  renderCompanionChatList();
};

window.clearAllCompanionChats = function (btn) {
  if (chatBusy()) return;
  // Two taps: the first asks, the second deletes
  if (btn && btn.dataset.confirm !== '1') {
    btn.dataset.confirm = '1';
    btn.textContent = 'Tap again to delete all chats';
    btn.classList.add('!text-danger');
    setTimeout(() => {
      if (btn.isConnected) { btn.dataset.confirm = ''; btn.textContent = 'Delete all chats'; btn.classList.remove('!text-danger'); }
    }, 3500);
    return;
  }
  writeChats({ chats: [], activeId: null });
  renderCompanionConversation(null);
  renderCompanionChatList();
};

function chatTimeLabel(ts) {
  const d = new Date(ts);
  const now = new Date();
  const startOfDay = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (days === 0) return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (days === 1) return 'Yesterday';
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function renderCompanionChatList() {
  const listEl = document.getElementById('companion-chats-list');
  if (!listEl) return;
  const store = readChats();
  const clearBtn = document.getElementById('companion-clear-all');
  if (clearBtn) clearBtn.classList.toggle('hidden', store.chats.length === 0);

  if (!store.chats.length) {
    listEl.innerHTML = `
      <div class="ns-empty">
        <p class="ns-empty__title">No chats yet</p>
        <p class="ns-empty__sub">Your conversations with Companion will show up here.</p>
      </div>`;
    return;
  }

  listEl.innerHTML = store.chats.map(c => {
    const last = [...(c.transcript || [])].reverse().find(i => i.who === 'assistant' && !i.error) || (c.transcript || []).slice(-1)[0];
    const preview = last ? String(last.text).replace(/\s+/g, ' ').slice(0, 90) : '';
    const current = c.id === store.activeId;
    return `
      <div class="ns-row !py-2.5">
        <button type="button" class="flex items-center gap-3 flex-1 min-w-0 text-left" onclick="openCompanionChat('${nsEscape(c.id)}')">
          <span class="ns-tile ${current ? 'ns-tile--leaf' : ''}"><span class="material-symbols-outlined">chat_bubble</span></span>
          <span class="min-w-0 flex-1">
            <span class="flex items-baseline gap-2">
              <span class="ns-row__title truncate flex-1">${nsEscape(c.title || 'New chat')}</span>
              <span class="text-[12px] font-medium text-muted flex-shrink-0">${nsEscape(chatTimeLabel(c.updatedAt))}</span>
            </span>
            <span class="ns-row__sub block truncate">${current ? '<b class="text-ink">Current</b> · ' : ''}${nsEscape(preview)}</span>
          </span>
        </button>
        <button type="button" class="ns-icon-btn ns-icon-btn--bare ns-icon-btn--sm flex-shrink-0 -mr-2 text-muted" onclick="deleteCompanionChat('${nsEscape(c.id)}', event)" aria-label="Delete chat: ${nsEscape(c.title || 'New chat')}">
          <span class="material-symbols-outlined">delete</span>
        </button>
      </div>`;
  }).join('');
}

window.openCompanionChats = function () {
  renderCompanionChatList();
  openModal('companion-chats-sheet');
};

function removeTypingIndicator() {
  const existingTyping = document.getElementById('chatbot-typing-bubble');
  if (existingTyping) {
    existingTyping.classList.add('typing-bubble-exit');
    setTimeout(() => existingTyping.remove(), 160);
  }
}


// ============================================================
// NORTHSTAR AI VERIFIED APP CONTEXT
// ============================================================


function calculateNorthStarDistanceMiles(lat1, lon1, lat2, lon2) {
  if (
    lat1 === undefined || lon1 === undefined ||
    lat2 === undefined || lon2 === undefined
  ) return null;

  const R = 3958.8;
  const toRad = deg => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const dist = R * c;

  return Number.isFinite(dist) ? dist : null;
}

function getNorthStarCachedResources() {
  return Array.isArray(window.NS_RESOURCES) ? window.NS_RESOURCES : [];
}

// Verified places from the server (same list as the Map), fetched once when needed
let _nsServerResources = null;
async function loadNorthStarServerResources() {
  if (Array.isArray(_nsServerResources) && _nsServerResources.length) return _nsServerResources;
  try {
    const res = await fetch('/api/resources');
    const data = res.ok ? await res.json() : null;
    const list = data && Array.isArray(data.resources) ? data.resources : [];
    // Only remember a real answer; a failed fetch is retried next time
    if (list.length) _nsServerResources = list;
    return list;
  } catch (err) {
    return [];
  }
}

async function getNorthStarLocationResourceContext(message) {
  const lower = String(message || '').toLowerCase();

  const asksNearby =
    lower.includes('nearest') ||
    lower.includes('closest') ||
    lower.includes('near me') ||
    lower.includes('nearby');

  const asksShelter =
    lower.includes('shelter') ||
    lower.includes('bed') ||
    lower.includes('place to stay') ||
    lower.includes('sleep');

  const asksFood =
    lower.includes('food') ||
    lower.includes('meal') ||
    lower.includes('pantry') ||
    lower.includes('eat');

  const asksHygiene =
    lower.includes('shower') ||
    lower.includes('restroom') ||
    lower.includes('bathroom') ||
    lower.includes('hygiene');

  if (!asksNearby || (!asksShelter && !asksFood && !asksHygiene)) {
    return null;
  }

  let resources = getNorthStarCachedResources();
  if (!resources.length) resources = await loadNorthStarServerResources();

  if (!resources.length) {
    return {
      resource_lookup_requested: true,
      resource_lookup_status: 'no_cached_resources'
    };
  }

  let category = null;

  if (asksShelter) category = 'shelter';
  else if (asksFood) category = 'food';
  else if (asksHygiene) category = 'restroom';

  return await new Promise(resolve => {
    if (!navigator.geolocation || window.isSecureContext === false) {
      resolve({
        resource_lookup_requested: true,
        category,
        resource_lookup_status: 'geolocation_unavailable'
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      position => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;

        const cats = r => (Array.isArray(r.categories) && r.categories.length ? r.categories : [r.category]);
        const statusOf = r => (window.nsPlaceStatus ? window.nsPlaceStatus(r) : { open: null, text: r.status || '' });
        const matching = resources
          .filter(resource =>
            resource &&
            cats(resource).includes(category) &&
            !resource.referralOnly &&
            !resource.closedNote &&
            typeof resource.lat === 'number' &&
            typeof resource.lng === 'number'
          )
          .map(resource => ({
            resource,
            distance_miles: calculateNorthStarDistanceMiles(
              userLat,
              userLng,
              resource.lat,
              resource.lng
            )
          }))
          .filter(item => item.distance_miles !== null)
          .sort((a, b) => a.distance_miles - b.distance_miles);

        if (!matching.length) {
          resolve({
            resource_lookup_requested: true,
            category,
            resource_lookup_status: 'no_matching_resources'
          });
          return;
        }

        // Close by (2 mi) first: places mainly for this, open now, then "call first"; else the nearest
        const near = matching.filter(m => m.distance_miles <= 2);
        const main = near.filter(m => m.resource.category === category);
        let nearest = null;
        for (const list of [main, near]) {
          nearest = list.find(m => statusOf(m.resource).open === true) || list.find(m => statusOf(m.resource).open !== false);
          if (nearest) break;
        }
        nearest = nearest || matching[0];
        const describe = r => ({
          id: r.id || '',
          name: r.name || '',
          address: r.address || '',
          status: statusOf(r).text,
          hours: r.hours || '',
          who_it_is_for: r.population || '',
          id_required: r.idRequired === true,
          phone: r.phone || '',
          notes: r.description || ''
        });

        const resolvedResource = {
          resource_lookup_requested: true,
          resource_lookup_status: 'success',
          user_location: {
            lat: userLat,
            lng: userLng
          },
          nearest_resource: {
            id: nearest.resource.id || '',
            name: nearest.resource.name || '',
            category: nearest.resource.category || '',
            address: nearest.resource.address || '',
            status: statusOf(nearest.resource).text,
            hours: nearest.resource.hours || '',
            who_it_is_for: nearest.resource.population || '',
            id_required: nearest.resource.idRequired === true,
            phone: nearest.resource.phone || '',
            details: nearest.resource.description || '',
            verifiedOnly: nearest.resource.verifiedOnly === true,
            lat: nearest.resource.lat,
            lng: nearest.resource.lng,
            distance_miles: Number(nearest.distance_miles.toFixed(2))
          },
          // a few more close by, so Companion can mention options for other groups (women, youth...)
          other_nearby: matching.filter(m => m !== nearest).slice(0, 3).map(m => ({ ...describe(m.resource), distance_miles: Number(m.distance_miles.toFixed(2)) }))
        };

        window.northstarLastVerifiedResource = resolvedResource.nearest_resource;

        resolve(resolvedResource);
      },
      error => {
        resolve({
          resource_lookup_requested: true,
          category,
          resource_lookup_status:
            error && error.code === 1
              ? 'location_permission_denied'
              : 'location_lookup_failed'
        });
      },
      {
        enableHighAccuracy: false,
        timeout: 7000,
        maximumAge: 300000
      }
    );
  });
}

function getNorthStarChatContext() {
  let resumeData = null;

  // 1. Prefer the newest resume generated during this browser session.
  if (
    window.currentGeneratedResumeData &&
    typeof window.currentGeneratedResumeData === 'object'
  ) {
    resumeData = window.currentGeneratedResumeData;
  }

  // 2. For logged-in users, use the resume saved in their NorthStar profile.
  if (!resumeData && typeof getUserData === 'function') {
    try {
      const userData = getUserData();

      if (
        userData &&
        userData.resumeData &&
        typeof userData.resumeData === 'object'
      ) {
        resumeData = userData.resumeData;
      }
    } catch (err) {
      console.warn('[NorthStar AI] Could not read saved user resume:', err);
    }
  }

  // 3. SPA / guest fallback: resume-builder stores the latest generated
  // structured resume here.
  if (!resumeData) {
    try {
      const rawResume = localStorage.getItem('northstar_latest_resume_data');

      if (rawResume) {
        const parsedResume = JSON.parse(rawResume);

        if (parsedResume && typeof parsedResume === 'object') {
          resumeData = parsedResume;
        }
      }
    } catch (err) {
      console.warn('[NorthStar AI] Could not read latest resume context:', err);
    }
  }

  const context = {};

  if (resumeData) {
    context.resume = resumeData;
    context.resume_source = 'northstar_saved_resume';
  }

  return context;
}

async function handleAIChatSubmit(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('chatbot-input-field');
  if (!input) return;

  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  await dispatchChatMessage(text);
}

// opts.voice: the message was spoken (Voice Companion). Resolves to { ok, reply, spoken } or
// { ok: false, message } so voice mode can read the answer aloud.
async function dispatchChatMessage(rawText, isResuming = false, opts = {}) {
  const text = String(rawText || '').trim();
  if (!text) return { ok: false };
  if (!(await window.nsEnsureAiConsent())) {
    appendAssistantMessageBubble('Okay, nothing was sent. Companion only works with your OK. You can still use the map, or call 211 to talk to a person about beds, food and other help.');
    return { ok: false, consent: false };
  }

  const messagesList = document.getElementById('chatbot-messages-list');
  const sendBtn = document.getElementById('chatbot-send-btn');
  if (!messagesList) return { ok: false };

  // Prevent multiple simultaneous requests
  if (window._chatPending) return { ok: false, busy: true };
  let outcome = { ok: false };

  // 1. Capture the CURRENT history snapshot BEFORE adding the new user message
  const previousHistory = (window.northstarChatHistory || []).slice(-10);

  // 2. Safely append user bubble to UI (skip if resuming from an aborted session)
  if (!isResuming) {
    appendUserMessageBubble(text);
  } else {
    messagesList.scrollTop = messagesList.scrollHeight;
  }

  // 3. Append typing bubble with staggered wave dots
  const typingBubble = document.createElement('div');
  typingBubble.id = 'chatbot-typing-bubble';
  typingBubble.className = 'flex gap-2 items-start chat-msg-incoming';
  typingBubble.innerHTML = `
    <span class="ns-chat__mark ns-chat__mark--sm" aria-hidden="true"></span>
    <div class="ns-chat__bubble ns-chat__bubble--in flex items-center gap-1.5" role="status" aria-label="Companion is typing">
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
      <span id="chatbot-typing-note" class="ml-2 text-[13px] font-medium text-muted"></span>
    </div>
  `;
  messagesList.appendChild(typingBubble);
  messagesList.scrollTop = messagesList.scrollHeight;
  const typingNotes = [
    setTimeout(() => { const n = document.getElementById('chatbot-typing-note'); if (n) n.textContent = 'Still thinking…'; }, 6000),
    setTimeout(() => { const n = document.getElementById('chatbot-typing-note'); if (n) n.textContent = 'Almost there…'; }, 25000)
  ];
  const chatController = new AbortController();
  const chatTimeout = setTimeout(() => chatController.abort(), 90000);

  // Set pending state & disable send button
  window._chatPending = true;
  if (sendBtn) sendBtn.disabled = true;

  // "Ask Companion a question" counts once a question is actually sent
  try {
    localStorage.setItem('northstar_ai_used', 'true');
    if (typeof updateMilestone === 'function') updateMilestone('aiCompanion', true);
  } catch (_) {}

  try {
    const rawRole = (typeof getRole === 'function') ? getRole() : (localStorage.getItem('northstar_user_role') || 'seeker');
    const isHelperRole = (rawRole === 'volunteer' || rawRole === 'donater' || rawRole === 'helper' || rawRole === 'employer');
    const currentRole = isHelperRole ? 'volunteer' : 'seeker';

    // Gather verified NorthStar app data for this chat request.
    // This currently includes the user's saved/generated resume when available.
    const northstarContext = getNorthStarChatContext();

    // Add verified location/resource context only when the user's
    // question actually requires nearby map data.
    const resourceContext = await getNorthStarLocationResourceContext(text);

    if (resourceContext) {
      northstarContext.resource_lookup = resourceContext;
    } else {
      const lowerText = String(text || '').toLowerCase();

      const refersToPreviousResource =
        lowerText.includes('that shelter') ||
        lowerText.includes('that place') ||
        lowerText.includes('that resource') ||
        lowerText.includes('is it open') ||
        lowerText.includes('does it have') ||
        lowerText.includes('what about that');

      if (
        refersToPreviousResource &&
        window.northstarLastVerifiedResource
      ) {
        northstarContext.resource_lookup = {
          resource_lookup_requested: true,
          resource_lookup_status: 'success',
          follow_up_reference: true,
          nearest_resource: window.northstarLastVerifiedResource
        };
      }
    }

    console.log('[NorthStar AI] Verified app context:', northstarContext);
    // 4. Send request with message, role, history, and verified app context
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        aiConsent: true,
        message: text,
        role: currentRole,
        history: previousHistory,
        context: northstarContext,
        voice: opts.voice === true
      }),
      signal: chatController.signal
    });

    // 5. After sending request, record the user turn into canonical history
    window.northstarChatHistory.push({
      role: 'user',
      content: text
    });
    if (window.northstarChatHistory.length > 10) {
      window.northstarChatHistory = window.northstarChatHistory.slice(-10);
    }

    const data = await res.json();

    removeTypingIndicator();

    // 6. Only display an AI reply when res.ok, data.success, and data.reply exist
    if (res.ok && data && data.success && typeof data.reply === 'string' && data.reply.trim()) {
      // Record assistant reply into canonical history
      window.northstarChatHistory.push({
        role: 'assistant',
        content: data.reply
      });
      if (window.northstarChatHistory.length > 10) {
        window.northstarChatHistory = window.northstarChatHistory.slice(-10);
      }

      // Determine navigation action: backend data.action takes priority,
      // followed deterministically by verified nearest resource lookup if available
      let chatAction = data.action || null;
      if (!chatAction &&
        northstarContext &&
        northstarContext.resource_lookup &&
        northstarContext.resource_lookup.resource_lookup_status === 'success' &&
        northstarContext.resource_lookup.nearest_resource &&
        northstarContext.resource_lookup.nearest_resource.id) {
        chatAction = {
          type: 'navigate',
          destination: 'map',
          resourceId: northstarContext.resource_lookup.nearest_resource.id,
          label: 'View on Map'
        };
      }

      setTimeout(() => {
        appendAssistantMessageBubble(data.reply, false, chatAction);
      }, 120);
      outcome = { ok: true, reply: data.reply, spoken: data.spoken || data.reply };
    } else {
      // The server answered but no assistant could reply
      const busy = "Companion is busy right now. Please try again in a minute.";
      setTimeout(() => {
        appendAssistantMessageBubble(busy, true);
      }, 120);
      outcome = { ok: false, message: busy };
    }
  } catch (err) {
    console.error('Chat error:', err);
    removeTypingIndicator();
    const msg = err && err.name === 'AbortError'
      ? 'That took too long. Please try again.'
      : 'Companion can’t reach the internet right now. Check your connection and try again.';
    setTimeout(() => appendAssistantMessageBubble(msg, true), 120);
    outcome = { ok: false, message: msg };
  } finally {
    saveChatHistory();
    typingNotes.forEach(clearTimeout);
    clearTimeout(chatTimeout);
    window._chatPending = false;
    if (sendBtn) sendBtn.disabled = false;
  }
  return outcome;
}

// Expose globally for inline/SPA callers
window.initGlobalAIChatbot = initGlobalAIChatbot;
window.toggleAIChatbotWindow = toggleAIChatbotWindow;
window.sendQuickChatMessage = sendQuickChatMessage;
window.appendChatMessage = appendChatMessage;
window.dispatchChatMessage = dispatchChatMessage;
window.handleAIChatSubmit = handleAIChatSubmit;

// Auto-initialize Global Chatbot on DOM Ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(initGlobalAIChatbot, 100));
} else {
  setTimeout(initGlobalAIChatbot, 100);
}

// ============================================================
// OFFLINE: pages that need the internet show a short notice instead of failing.
// Allowed offline: dashboards and settings.
// ============================================================
(function initOfflineAccessControl() {
  function isAllowedOfflineHref(href) {
    if (!href) return true;
    const lower = href.toLowerCase();
    return lower.includes('seeker-dashboard') ||
      lower.includes('helper-dashboard') ||
      lower.includes('settings') ||
      lower === '#' ||
      lower.startsWith('#') ||
      lower.startsWith('tel:') ||
      lower.startsWith('javascript:');
  }

  function hideOfflineModal() {
    const modal = document.getElementById('ns-global-offline-modal');
    if (modal) modal.style.display = 'none';
  }
  window.hideOfflineModal = hideOfflineModal;

  function showOfflineModal() {
    let modal = document.getElementById('ns-global-offline-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'ns-global-offline-modal';
      modal.className = 'ns-offline-modal-backdrop';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-labelledby', 'ns-offline-title');
      modal.innerHTML = `
        <div class="ns-offline-modal-card" onclick="event.stopPropagation()">
          <span class="ns-tile mx-auto"><span class="material-symbols-outlined">wifi_off</span></span>
          <h3 id="ns-offline-title" class="text-[20px] font-bold mt-4">You’re offline</h3>
          <p class="ns-card-sub mt-2">This part of the app needs an internet connection. Your home screen and saved info still work.</p>
          <button type="button" onclick="hideOfflineModal()" class="ns-btn ns-btn--primary mt-6">OK</button>
        </div>
      `;
      modal.onclick = hideOfflineModal;
      document.body.appendChild(modal);
    }
    modal.style.display = 'flex';
  }

  function syncInlineMapPlaceholder(isOnline) {
    const mapCard = document.querySelector('.map-preview-card');
    if (!mapCard) return;

    let placeholder = mapCard.querySelector('.ns-offline-map-placeholder');
    if (!isOnline) {
      if (!placeholder) {
        placeholder = document.createElement('div');
        placeholder.className = 'ns-offline-map-placeholder';
        placeholder.innerHTML = `
          <span class="material-symbols-outlined text-[24px] text-ink">wifi_off</span>
          <span>The map needs a connection</span>
        `;
        mapCard.appendChild(placeholder);
      }
      placeholder.style.display = 'flex';
    } else if (placeholder) {
      placeholder.style.display = 'none';
    }
  }

  function handleNetworkChange() {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    syncInlineMapPlaceholder(isOnline);
  }

  // Intercept restricted links and the chat button while offline
  document.addEventListener(
    'click',
    function (e) {
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      if (isOnline) return;

      const aiTrigger = e.target.closest('#chat-fab, [data-fab-alias="chatbot-fab-btn"]');
      if (aiTrigger) {
        e.preventDefault();
        e.stopPropagation();
        showOfflineModal();
        return;
      }

      const link = e.target.closest('a[href]');
      if (link) {
        const href = link.getAttribute('href');
        if (!isAllowedOfflineHref(href)) {
          e.preventDefault();
          e.stopPropagation();
          showOfflineModal();
        }
      }
    },
    true
  );

  window.addEventListener('online', handleNetworkChange);
  window.addEventListener('offline', handleNetworkChange);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', handleNetworkChange);
  } else {
    handleNetworkChange();
  }

  window.showOfflineModal = showOfflineModal;
})();
// ============================================================
// Background resume jobs: the resume keeps being written on the server
// even when the person leaves the Resume page. Any page polls the job and
// saves the finished result so the Resume page can show it later.
// ============================================================
(function () {
  const JOB_KEY = 'northstar_resume_job';
  const POLL_MS = 3000;
  let pollTimer = null;
  let polling = false;

  function ownerId() {
    try {
      const s = JSON.parse(localStorage.getItem('northstar_session') || 'null');
      return s ? (s.id || s.username || 'guest') : '';
    } catch (e) { return ''; }
  }

  function readJob() {
    try {
      const job = JSON.parse(localStorage.getItem(JOB_KEY) || 'null');
      if (!job || !job.id) return null;
      if (job.owner && job.owner !== ownerId()) { localStorage.removeItem(JOB_KEY); return null; }
      return job;
    } catch (e) { return null; }
  }

  function writeJob(job) {
    try {
      if (job) localStorage.setItem(JOB_KEY, JSON.stringify(job));
      else localStorage.removeItem(JOB_KEY);
    } catch (e) {}
  }

  function onResumePage() {
    return /resume-builder\.html$/.test(window.location.pathname);
  }

  // Small "Your resume is ready" link on other pages
  function showReadyPill() {
    if (onResumePage() || document.getElementById('ns-resume-ready-pill')) return;
    const a = document.createElement('a');
    a.id = 'ns-resume-ready-pill';
    a.href = 'resume-builder.html';
    a.setAttribute('role', 'status');
    a.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(84px + env(safe-area-inset-bottom));z-index:3000;display:flex;align-items:center;gap:8px;padding:10px 16px;border-radius:999px;background:#111;color:#fff;font:600 14px/1.2 "Plus Jakarta Sans",system-ui,sans-serif;box-shadow:0 10px 24px -10px rgba(0,0,0,.5);text-decoration:none;white-space:nowrap';
    a.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true" style="font-size:18px">description</span><span>Your resume is ready · View</span>';
    (document.body || document.documentElement).appendChild(a);
  }

  async function pollOnce() {
    const job = readJob();
    if (!job || job.status !== 'running') { stop(); return job; }
    if (polling) return job;
    polling = true;
    // Waiting on the resume page for a long generation is not "idle": keep the session alive
    if (onResumePage() && document.visibilityState === 'visible' && typeof window.nsMarkActive === 'function') {
      try { window.nsMarkActive(true); } catch (e) {}
    }
    try {
      const resp = await fetch(`/api/resume-jobs/${encodeURIComponent(job.id)}`, { cache: 'no-store' });
      if (resp.status === 404) {
        // Server restarted and lost the job
        const latest = readJob();
        if (latest && latest.id === job.id) {
          latest.status = 'failed';
          latest.result = { success: false, error: 'The resume was interrupted. Please try again.' };
          writeJob(latest);
        }
      } else if (resp.ok) {
        const out = await resp.json();
        if (out && (out.status === 'done' || out.status === 'failed')) {
          const latest = readJob();
          if (latest && latest.id === job.id) {
            latest.status = out.status;
            latest.result = out.result || null;
            latest.finishedAt = Date.now();
            writeJob(latest);
          }
        }
      }
    } catch (e) { /* offline: try again */ }
    polling = false;

    const now = readJob();
    if (now && now.status !== 'running') {
      stop();
      window.dispatchEvent(new CustomEvent('ns:resume-job', { detail: now }));
      if (now.status === 'done') showReadyPill();
    }
    return now;
  }

  function start() {
    if (pollTimer) return;
    pollTimer = setInterval(pollOnce, POLL_MS);
    pollOnce();
  }

  function stop() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  // Another tab finished (or cleared) the job: relay it here so this page stops waiting too
  window.addEventListener('storage', function (e) {
    if (e.key !== JOB_KEY) return;
    const job = readJob();
    if (!job) { stop(); return; }
    if (job.status === 'running') { start(); return; }
    stop();
    window.dispatchEvent(new CustomEvent('ns:resume-job', { detail: job }));
    if (job.status === 'done') showReadyPill();
  });

  // Start a job; resolves with the job record once the server accepted it
  async function startResumeJob(confirmed) {
    const resp = await fetch('/api/resume-jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(confirmed)
    });
    const out = await resp.json().catch(() => ({}));
    if (!resp.ok || !out.success || !out.jobId) throw new Error(out.error || 'Could not start your resume.');
    const job = { id: out.jobId, owner: ownerId(), startedAt: Date.now(), status: 'running', confirmed, result: null };
    writeJob(job);
    start();
    return job;
  }

  window.nsResumeJob = {
    start: startResumeJob,
    get: readJob,
    clear: () => { stop(); writeJob(null); },
    poll: pollOnce,
    watch: start
  };

  function boot() {
    const job = readJob();
    if (!job) return;
    if (job.status === 'running') start();
    else if (job.status === 'done') showReadyPill();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
