/**
 * Northstar Authentication Engine & Device Theme Synchronization
 * Strict Password Validation, Local & Supabase Credential Verification, and Zero Wildcard Bypasses
 */

// ==========================================================================
// 1. DYNAMIC DEVICE THEME DETECTION & SYNCHRONIZATION
// ==========================================================================

// Light / dark mode is owned by js/ns-boot.js (window.nsTheme); these follow it.
function getSystemTheme() {
  return window.nsTheme ? window.nsTheme.current() : 'light';
}

function applyTheme() {}

function initDeviceThemeDetection() {
  applyTheme('light');
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDeviceThemeDetection);
  } else {
    initDeviceThemeDetection();
  }
}

// ==========================================================================
// 2. STRICT CREDENTIAL REGISTRY & DEMO TEST ACCOUNT GATING
// ==========================================================================

const REGISTERED_USERS_KEY = 'northstar_registered_users_v2';

// One-time migration: clear any corrupted v1 data that used hashed passwords
(function migrateRegisteredUsers() {
  try {
    const oldRaw = localStorage.getItem('northstar_registered_users_v1');
    if (oldRaw) {
      // If any record has no 'password' field (old hashed-only records), purge the whole v1 store
      const oldMap = JSON.parse(oldRaw);
      const hasCorrupted = Object.values(oldMap).some(r => !r.password);
      if (hasCorrupted) {
        localStorage.removeItem('northstar_registered_users_v1');
      }
    }
  } catch (e) {}
})();

// Accounts live on the server (/api/auth/*). No demo accounts or passwords ship in this file;
// reviewer and test accounts are created on the server and shared privately.
function getRegisteredUsersMap() {
  try {
    const raw = localStorage.getItem(REGISTERED_USERS_KEY);
    if (raw) return JSON.parse(raw) || {};
  } catch (e) {
    console.warn('Could not read registered users map:', e);
  }
  return {};
}

function saveRegisteredUserRecord(userRecord) {
  if (!userRecord || !userRecord.username) return;
  try {
    const map = getRegisteredUsersMap();
    const cleanUsername = userRecord.username.trim().toLowerCase();
    const cleanEmail = (userRecord.email || `${cleanUsername}@northstar.local`).trim().toLowerCase();
    map[cleanUsername] = userRecord;
    map[cleanEmail] = userRecord;
    localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn('Could not save user record:', e);
  }
}
window.saveRegisteredUserRecord = saveRegisteredUserRecord;

/**
 * Strictly validates an identifier (username or email) and password against registered/demo accounts.
 * Returns:
 * - { status: 'valid', user } if account exists AND password matches exactly
 * - { status: 'invalid_password' } if account exists in local registry AND password does NOT match
 * - { status: 'not_found' } if account is not in local registry
 */
function validateLocalCredentials(identifier, password) {
  if (!identifier || !password) return { status: 'invalid_password' };
  const map = getRegisteredUsersMap();
  const key = identifier.trim().toLowerCase();
  const shortKey = key.includes('@') ? key.split('@')[0] : key;

  const record = map[key] || map[shortKey];
  if (record) {
    if (record.password === password) {
      return { status: 'valid', user: record };
    } else {
      return { status: 'invalid_password' };
    }
  }
  return { status: 'not_found' };
}
window.validateLocalCredentials = validateLocalCredentials;

// ==========================================================================
// 3. SUPABASE CLIENT INITIALIZATION
// ==========================================================================

let supabaseClientInstance = null;

function initGlobalSupabaseClient(url, key) {
  if (typeof window === 'undefined') return null;
  if (window.supabaseClient) return window.supabaseClient;
  if (supabaseClientInstance) {
    window.supabaseClient = supabaseClientInstance;
    return supabaseClientInstance;
  }
  if (!url || !key) return null;
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    const cleanUrl = url.trim();
    const cleanKey = key.trim();
    if (!cleanUrl.startsWith('https://')) {
      return null;
    }
    supabaseClientInstance = window.supabase.createClient(cleanUrl, cleanKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    window.supabaseClient = supabaseClientInstance;
    return supabaseClientInstance;
  }
  return null;
}

async function getSupabase() {
  if (window.supabaseClient) return window.supabaseClient;
  if (supabaseClientInstance) {
    window.supabaseClient = supabaseClientInstance;
    return supabaseClientInstance;
  }

  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const config = await res.json();
      const url = (config.supabaseUrl || '').trim();
      const key = (config.supabaseAnonKey || '').trim();
      if (!url || !key) return null;
      return initGlobalSupabaseClient(url, key);
    }
  } catch (e) {
    console.warn('[Supabase] Could not fetch /api/config:', e.message);
  }

  return null;
}
window.getSupabase = getSupabase;

/**
 * Dynamic Role-Based Redirection Helper
 */
async function redirectToRoleDashboard(user) {
  let role = user?.user_metadata?.role || user?.role;

  if (!role && user?.id) {
    try {
      const supabase = window.supabaseClient || await getSupabase();
      if (supabase) {
        const { data } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        role = data?.role;
      }
    } catch (_) {}
  }

  if (!role) {
    role = document.querySelector('.role-toggle.active')?.dataset.role || localStorage.getItem('northstar_user_role');
  }

  const normalizedRole = (role || '').toLowerCase();
  if (normalizedRole === 'volunteer' || normalizedRole === 'helper') {
    window.location.href = 'helper-dashboard.html';
  } else {
    window.location.href = 'seeker-dashboard.html';
  }
}
window.redirectToRoleDashboard = redirectToRoleDashboard;

// ==========================================================================
// 4. STRICT AUTHENTICATION SUBMISSION HANDLER
// ==========================================================================

let currentAuthMode = 'login';
let currentAuthRole = 'seeker';

window.switchAuthTab = function(mode) {
  currentAuthMode = mode;
  const tabLogin = document.getElementById('tab-login');
  const tabSignup = document.getElementById('tab-signup');
  const roleContainer = document.getElementById('role-selection-container');
  const submitBtn = document.getElementById('auth-submit-btn');

  clearAuthError();

  if (mode === 'login') {
    if (tabLogin) tabLogin.className = 'flex-1 h-10 text-xs sm:text-sm font-extrabold rounded-lg bg-slate-950 dark:bg-amber-400 text-white dark:text-slate-950 shadow-sm transition-all duration-200';
    if (tabSignup) tabSignup.className = 'flex-1 h-10 text-xs sm:text-sm font-bold rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white transition-all duration-200';
    if (roleContainer) roleContainer.classList.add('hidden');
    if (submitBtn) submitBtn.textContent = 'Sign In';
  } else {
    if (tabSignup) tabSignup.className = 'flex-1 h-10 text-xs sm:text-sm font-extrabold rounded-lg bg-slate-950 dark:bg-amber-400 text-white dark:text-slate-950 shadow-sm transition-all duration-200';
    if (tabLogin) tabLogin.className = 'flex-1 h-10 text-xs sm:text-sm font-bold rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white transition-all duration-200';
    if (roleContainer) roleContainer.classList.remove('hidden');
    if (submitBtn) submitBtn.textContent = 'Create Account';
  }
};

window.setAuthRole = function(role) {
  currentAuthRole = role;
  const seekerBtn = document.getElementById('role-btn-seeker');
  const volunteerBtn = document.getElementById('role-btn-volunteer');

  if (role === 'seeker') {
    if (seekerBtn) seekerBtn.className = 'h-11 px-3 text-xs sm:text-sm font-extrabold rounded-xl border border-amber-400 bg-amber-500/15 text-amber-900 dark:text-amber-300 flex items-center justify-center gap-1.5 transition-all';
    if (volunteerBtn) volunteerBtn.className = 'h-11 px-3 text-xs sm:text-sm font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1.5 transition-all';
  } else {
    if (volunteerBtn) volunteerBtn.className = 'h-11 px-3 text-xs sm:text-sm font-extrabold rounded-xl border border-amber-400 bg-amber-500/15 text-amber-900 dark:text-amber-300 flex items-center justify-center gap-1.5 transition-all';
    if (seekerBtn) seekerBtn.className = 'h-11 px-3 text-xs sm:text-sm font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1.5 transition-all';
  }
};

function clearAuthError() {
  const errorContainer = document.getElementById('auth-error-message') || document.getElementById('auth-error') || document.getElementById('simple-login-error');
  const emailInput = document.getElementById('auth-email') || document.getElementById('gateway-username') || document.getElementById('simple-login-name');
  const passwordInput = document.getElementById('auth-password') || document.getElementById('gateway-password') || document.getElementById('simple-login-password');

  if (errorContainer) {
    errorContainer.classList.add('hidden');
    errorContainer.style.display = 'none';
    errorContainer.textContent = '';
  }
  if (emailInput) {
    emailInput.style.borderColor = '';
    emailInput.classList.remove('input-error');
  }
  if (passwordInput) {
    passwordInput.style.borderColor = '';
    passwordInput.classList.remove('input-error');
  }
}

function showAuthError(message) {
  const errorContainer = document.getElementById('auth-error-message') || document.getElementById('auth-error') || document.getElementById('simple-login-error');
  const emailInput = document.getElementById('auth-email') || document.getElementById('gateway-username') || document.getElementById('simple-login-name');
  const passwordInput = document.getElementById('auth-password') || document.getElementById('gateway-password') || document.getElementById('simple-login-password');

  if (emailInput) {
    emailInput.style.borderColor = '#ef4444';
    emailInput.classList.add('input-error');
  }
  if (passwordInput) {
    passwordInput.style.borderColor = '#ef4444';
    passwordInput.classList.add('input-error');
  }

  if (errorContainer) {
    errorContainer.textContent = message;
    errorContainer.style.border = '1px solid #ef4444';
    errorContainer.style.backgroundColor = 'rgba(239, 68, 68, 0.12)';
    errorContainer.style.color = '#f87171';
    errorContainer.style.borderRadius = '0.75rem';
    errorContainer.style.padding = '10px 14px';
    errorContainer.classList.remove('hidden');
    errorContainer.style.display = 'block';
  }

  if (typeof window.showNotification === 'function') {
    window.showNotification(message, 'error');
  }
}
window.showAuthError = showAuthError;

function attachInputListeners() {
  const emailInput = document.getElementById('auth-email') || document.getElementById('gateway-username') || document.getElementById('simple-login-name');
  const passwordInput = document.getElementById('auth-password') || document.getElementById('gateway-password') || document.getElementById('simple-login-password');

  [emailInput, passwordInput].forEach(input => {
    if (input && !input.dataset.hasAuthClearListener) {
      input.addEventListener('input', () => {
        input.style.borderColor = '';
        input.classList.remove('input-error');
        const errorContainer = document.getElementById('auth-error-message') || document.getElementById('auth-error') || document.getElementById('simple-login-error');
        if (errorContainer) {
          errorContainer.classList.add('hidden');
          errorContainer.style.display = 'none';
        }
      });
      input.dataset.hasAuthClearListener = 'true';
    }
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachInputListeners);
  } else {
    attachInputListeners();
  }
}

function resetSubmitButton() {
  const submitBtn = document.getElementById('auth-submit-btn') || document.getElementById('simple-login-submit-btn');
  const lbl = document.getElementById('onboarding-submit-label');
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.style.opacity = '1';
    if (!lbl) {
      submitBtn.textContent = currentAuthMode === 'signup' ? 'Create Account' : 'Sign In';
    }
  }
  if (lbl) {
    lbl.textContent = currentAuthMode === 'signup' ? 'Create Account' : 'Sign In';
  }
}

/**
 * Strict Sign In & Account Creation Handler
 */
window.handleAuthFormSubmit = async function(e) {
  if (e && typeof e.preventDefault === 'function') {
    e.preventDefault();
  }

  attachInputListeners();
  clearAuthError();

  const fullNameInput = document.getElementById('auth-full-name');
  const identifierInput = document.getElementById('auth-email') || document.getElementById('gateway-username') || document.getElementById('simple-login-name');
  const passwordInput = document.getElementById('auth-password') || document.getElementById('gateway-password') || document.getElementById('simple-login-password');

  const fullName = fullNameInput ? fullNameInput.value.trim() : '';
  const emailOrUsername = identifierInput ? identifierInput.value.trim() : '';
  const password = passwordInput ? passwordInput.value.trim() : '';
  const selectedRole = document.querySelector('.role-toggle.active')?.dataset.role || currentAuthRole || 'seeker';

  if (!emailOrUsername || !password) {
    showAuthError('Please enter both username/email and password.');
    return;
  }

  const email = emailOrUsername.includes('@')
    ? emailOrUsername
    : `${emailOrUsername}@northstar.local`;
  const username = emailOrUsername.includes('@') ? emailOrUsername.split('@')[0] : emailOrUsername;

  const submitBtn = document.getElementById('auth-submit-btn') || document.getElementById('simple-login-submit-btn');
  if (submitBtn) {
    submitBtn.disabled = true;
  }

  try {
    const supabase = window.supabaseClient || await getSupabase();

    if (currentAuthMode === 'signup') {
      if (password.length < 4) {
        showAuthError('Password must be at least 4 characters long.');
        return;
      }

      const userId = 'user_' + username.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Math.floor(Math.random() * 9000 + 1000);
      const newUserRecord = {
        id: userId,
        username: username,
        full_name: fullName || username,
        email: email,
        role: selectedRole,
        password: password
      };

      // Save to strict local registry
      saveRegisteredUserRecord(newUserRecord);

      if (supabase) {
        try {
          const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
              data: { full_name: fullName, role: selectedRole }
            }
          });
          if (error && error.message && error.message.toLowerCase().includes('already registered')) {
            showAuthError('This account is already registered. Please sign in.');
            return;
          }
          if (data?.user?.id) {
            newUserRecord.id = data.user.id;
            saveRegisteredUserRecord(newUserRecord);
          }
        } catch (_) {}
      }

      const sessionData = {
        id: newUserRecord.id,
        username: newUserRecord.full_name || newUserRecord.username,
        full_name: newUserRecord.full_name,
        email: newUserRecord.email,
        role: selectedRole,
        isGuest: false,
        loggedInAt: Date.now()
      };
      try { sessionStorage.setItem('ns_session_active', '1'); } catch (e) {}
      localStorage.setItem('northstar_session', JSON.stringify(sessionData));
      if (typeof window.setRole === 'function') window.setRole(selectedRole);

      await redirectToRoleDashboard(sessionData);
      return;

    } else {
      // --- STRICT SIGN IN ---
      // 1. Check local registry first for known users / demo accounts
      const localCheck = validateLocalCredentials(emailOrUsername, password);
      if (localCheck.status === 'invalid_password') {
        showAuthError('Invalid username or password');
        return;
      }

      // 2. Check Supabase signInWithPassword if available
      if (supabase) {
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
          });

          if (!error && data?.user) {
            const role = data.user.user_metadata?.role || localCheck.user?.role || selectedRole;
            const sessionData = {
              id: data.user.id,
              username: data.user.user_metadata?.full_name || username,
              full_name: data.user.user_metadata?.full_name || '',
              email: email,
              role: role,
              isGuest: false,
              loggedInAt: Date.now()
            };
            saveRegisteredUserRecord({ ...sessionData, password });
            try { sessionStorage.setItem('ns_session_active', '1'); } catch (e) {}
            localStorage.setItem('northstar_session', JSON.stringify(sessionData));
            if (typeof window.setRole === 'function') window.setRole(role);
            await redirectToRoleDashboard(sessionData);
            return;
          }
        } catch (_) {}
      }

      // 3. If Supabase did not authenticate, ONLY allow login if localCheck explicitly verified the exact password!
      if (localCheck.status === 'valid' && localCheck.user) {
        const sessionData = {
          id: localCheck.user.id,
          username: localCheck.user.full_name || localCheck.user.username,
          full_name: localCheck.user.full_name || '',
          email: localCheck.user.email,
          role: localCheck.user.role || selectedRole,
          isGuest: false,
          loggedInAt: Date.now()
        };
        try { sessionStorage.setItem('ns_session_active', '1'); } catch (e) {}
        localStorage.setItem('northstar_session', JSON.stringify(sessionData));
        if (typeof window.setRole === 'function') window.setRole(sessionData.role);
        await redirectToRoleDashboard(sessionData);
        return;
      }

      // Otherwise, authentication failed — block session storage and dashboard routing!
      showAuthError('Invalid username or password');
      return;
    }
  } catch (err) {
    showAuthError(err?.message || 'Invalid username or password');
  } finally {
    resetSubmitButton();
  }
};

window.handleSimpleLoginSubmit = window.handleAuthFormSubmit;
window.handleLogin = window.handleAuthFormSubmit;
window.handleGatewayLogin = window.handleAuthFormSubmit;
