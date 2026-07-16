/* ================================================================
   auth.js — SkyDash-Manager Authentication Module
   Handles: login, register, logout, session management,
            tab switching, spinner feedback, theme toggle
   ================================================================ */
'use strict';

// ── Storage Keys ────────────────────────────────────────────────
var USERS_KEY   = 'skydash-users';
var SESSION_KEY = 'skydash-session';
var THEME_KEY   = 'skydash-theme';

// ── Default / seed account ──────────────────────────────────────
var DEFAULT_USERS = [
  { username: 'admin', password: 'skydash2025' }
];

/* ── User Storage ──────────────────────────────────────────────── */
function loadUsers() {
  try {
    var stored = localStorage.getItem(USERS_KEY);
    return stored ? JSON.parse(stored) : JSON.parse(JSON.stringify(DEFAULT_USERS));
  } catch (e) {
    return JSON.parse(JSON.stringify(DEFAULT_USERS));
  }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

/* ── Session Management ────────────────────────────────────────── */
function setSession(username) {
  var session = {
    username:  username,
    loginTime: Date.now(),
    token:     btoa(username + ':' + Date.now())
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
  // Also clean any temp data
  sessionStorage.clear();
}

function getSession() {
  try {
    var stored = sessionStorage.getItem(SESSION_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    return null;
  }
}

function isLoggedIn() {
  return getSession() !== null;
}

function getCurrentUser() {
  var session = getSession();
  return session ? session.username : null;
}

/* ── Core Auth Logic ────────────────────────────────────────────── */

/**
 * Simulates async credential validation with a 1.5s delay (spinner period).
 * @param {string} username
 * @param {string} password
 * @returns {Promise}
 */
function login(username, password) {
  return new Promise(function(resolve, reject) {
    setTimeout(function() {
      var users = loadUsers();
      var user  = users.find(function(u) {
        return u.username === username && u.password === password;
      });
      if (user) {
        setSession(username);
        resolve({ success: true, username: username });
      } else {
        reject(new Error('Credenciales incorrectas. Verifica tu usuario y contraseña.'));
      }
    }, 1500);
  });
}

/**
 * Simulates async account creation with validation and 1.5s delay.
 * @param {string} username
 * @param {string} password
 * @param {string} confirmPassword
 * @returns {Promise}
 */
function register(username, password, confirmPassword) {
  return new Promise(function(resolve, reject) {
    setTimeout(function() {
      // Input validations
      if (!username || username.trim().length === 0) {
        reject(new Error('El nombre de usuario no puede estar vacío.')); return;
      }
      if (username.trim().length < 3) {
        reject(new Error('El nombre de usuario debe tener al menos 3 caracteres.')); return;
      }
      if (!password || password.length === 0) {
        reject(new Error('La contraseña no puede estar vacía.')); return;
      }
      if (password.length < 6) {
        reject(new Error('La contraseña debe tener al menos 6 caracteres.')); return;
      }
      if (password !== confirmPassword) {
        reject(new Error('Las contraseñas no coinciden.')); return;
      }

      var users = loadUsers();
      var exists = users.some(function(u) {
        return u.username.toLowerCase() === username.trim().toLowerCase();
      });

      if (exists) {
        reject(new Error('El nombre de usuario ya está en uso. Elige otro.')); return;
      }

      // Create user
      users.push({ username: username.trim(), password: password });
      saveUsers(users);
      setSession(username.trim());
      resolve({ success: true, username: username.trim() });
    }, 1500);
  });
}

/**
 * Securely logs out: clears session token and redirects to welcome screen.
 */
function logout() {
  clearSession();
  window.location.replace('index.html');
}

/* ── UI Helper Functions ────────────────────────────────────────── */
function showMessage(elementId, message, type) {
  var el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = message;
  el.className   = 'form-message' + (type ? ' ' + type : '');
}

function setButtonLoading(btnId, spinnerId, loading) {
  var btn     = document.getElementById(btnId);
  var spinner = document.getElementById(spinnerId);
  if (!btn || !spinner) return;
  var btnText = btn.querySelector('.btn-text');

  if (loading) {
    btn.disabled            = true;
    spinner.classList.remove('hidden');
    if (btnText) btnText.style.opacity = '0.6';
  } else {
    btn.disabled            = false;
    spinner.classList.add('hidden');
    if (btnText) btnText.style.opacity = '1';
  }
}

/* ── Tab Switching ──────────────────────────────────────────────── */
function switchTab(tab) {
  var loginForm      = document.getElementById('loginForm');
  var registerForm   = document.getElementById('registerForm');
  var loginTabBtn    = document.getElementById('loginTabBtn');
  var registerTabBtn = document.getElementById('registerTabBtn');

  if (tab === 'login') {
    loginForm.classList.add('active');
    registerForm.classList.remove('active');
    loginTabBtn.classList.add('active');
    loginTabBtn.setAttribute('aria-selected', 'true');
    registerTabBtn.classList.remove('active');
    registerTabBtn.setAttribute('aria-selected', 'false');
  } else {
    loginForm.classList.remove('active');
    registerForm.classList.add('active');
    loginTabBtn.classList.remove('active');
    loginTabBtn.setAttribute('aria-selected', 'false');
    registerTabBtn.classList.add('active');
    registerTabBtn.setAttribute('aria-selected', 'true');
  }
  // Clear any leftover messages
  showMessage('loginMessage', '', '');
  showMessage('registerMessage', '', '');
}

/* ── Form Submit Handlers ───────────────────────────────────────── */
function handleLogin(event) {
  event.preventDefault();
  var username = document.getElementById('loginUsername').value.trim();
  var password = document.getElementById('loginPassword').value;

  if (!username || !password) {
    showMessage('loginMessage', '❌ Completa todos los campos.', 'error');
    return;
  }

  setButtonLoading('loginBtn', 'loginSpinner', true);
  showMessage('loginMessage', '', '');

  login(username, password)
    .then(function() {
      showMessage('loginMessage', '✅ ¡Bienvenido, ' + username + '! Cargando...', 'success');
      setTimeout(function() {
        window.location.href = 'dashboard.html';
      }, 600);
    })
    .catch(function(err) {
      showMessage('loginMessage', '❌ ' + err.message, 'error');
      setButtonLoading('loginBtn', 'loginSpinner', false);
    });
}

function handleRegister(event) {
  event.preventDefault();
  var username = document.getElementById('regUsername').value.trim();
  var password = document.getElementById('regPassword').value;
  var confirm  = document.getElementById('regConfirm').value;

  setButtonLoading('registerBtn', 'registerSpinner', true);
  showMessage('registerMessage', '', '');

  register(username, password, confirm)
    .then(function() {
      showMessage('registerMessage', '✅ Cuenta creada exitosamente. Redirigiendo...', 'success');
      setTimeout(function() {
        window.location.href = 'dashboard.html';
      }, 700);
    })
    .catch(function(err) {
      showMessage('registerMessage', '❌ ' + err.message, 'error');
      setButtonLoading('registerBtn', 'registerSpinner', false);
    });
}

/* ── Theme Management ───────────────────────────────────────────── */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
  // Update auth page theme button
  var btn = document.getElementById('authThemeBtn');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

function toggleAuthTheme() {
  var current = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

/* ── Particle Generator ─────────────────────────────────────────── */
function generateParticles() {
  var container = document.getElementById('particles');
  if (!container) return;

  var emojis = ['☀️','🌤️','⛅','🌥️','☁️','🌧️','⛈️','🌨️','🌬️','🌡️','💧','❄️','🌈','🌊','⚡','🌪️'];
  var count   = 22;

  for (var i = 0; i < count; i++) {
    var particle = document.createElement('div');
    particle.className   = 'particle';
    particle.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    particle.setAttribute('aria-hidden', 'true');
    particle.style.cssText = [
      'left:'              + (Math.random() * 100)  + '%;',
      'font-size:'         + (Math.random() * 22 + 14) + 'px;',
      'animation-duration:'+ (Math.random() * 12 + 10)  + 's;',
      'animation-delay:'   + (Math.random() * -20)    + 's;',
      'opacity:'           + (Math.random() * 0.35 + 0.08) + ';'
    ].join('');
    container.appendChild(particle);
  }
}

/* ── Keyboard shortcut: Enter to submit ─────────────────────────── */
document.addEventListener('keydown', function(e) {
  if (e.key !== 'Enter') return;
  var loginForm    = document.getElementById('loginForm');
  var registerForm = document.getElementById('registerForm');
  if (loginForm && loginForm.classList.contains('active')) {
    loginForm.dispatchEvent(new Event('submit', { cancelable: true }));
  } else if (registerForm && registerForm.classList.contains('active')) {
    registerForm.dispatchEvent(new Event('submit', { cancelable: true }));
  }
});

/* ── Auto-init on auth page ─────────────────────────────────────── */
(function initAuthPage() {
  // If already logged in → redirect directly to dashboard
  if (isLoggedIn() && window.location.pathname.indexOf('dashboard') === -1) {
    window.location.replace('dashboard.html');
    return;
  }

  // Apply saved theme
  applyTheme(localStorage.getItem(THEME_KEY) || 'light');

  // Generate particles
  generateParticles();
})();
