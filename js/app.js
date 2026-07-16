/* ================================================================
   app.js — SkyDash-Manager Main Orchestrator
   Handles: app init, theme toggle, search, sidebar toggle,
            save location, offline detection, toast notifications,
            all global event wiring
   ================================================================ */
'use strict';

/* ── State ──────────────────────────────────────────────────────── */
var THEME_KEY = 'skydash-theme';
var _searchDebounceTimer = null;
window._currentWeatherData = null; // set by map.js after each click

/* ================================================================
   INITIALIZATION
   ================================================================ */
document.addEventListener('DOMContentLoaded', function() {
  // 1. Auth guard – redirect to login if no session
  if (!isLoggedIn()) {
    window.location.replace('index.html');
    return;
  }

  // 2. Display username
  var usernameEl = document.getElementById('usernameDisplay');
  if (usernameEl) usernameEl.textContent = getCurrentUser() || '—';

  // 3. Apply saved theme
  loadTheme();

  // 4. Initialize map
  initMap();

  // Force Leaflet to recalculate tile positions after layout is stable
  setTimeout(function() {
    var mapInstance = getMapInstance();
    if (mapInstance) {
      mapInstance.invalidateSize();
    }
  }, 200);

  // 5. Auto-load default location (Caracas, Venezuela) so map is never empty
  setTimeout(function() {
    handleMapClick(10.4806, -66.9036); // Caracas, Venezuela
  }, 400);

  // 6. Show placeholder in weather panel (will be replaced by Caracas auto-load)
  showWeatherPlaceholder();

  // 7. Render favorites list
  renderFavoritesList();

  // 8. Wire search input
  initSearch();

  // 9. Register Service Worker
  registerServiceWorker();

  // 10. Monitor online/offline status
  monitorNetworkStatus();

  // 11. Keyboard shortcuts
  initKeyboardShortcuts();
});

/* ================================================================
   THEME MANAGEMENT
   ================================================================ */
function loadTheme() {
  var saved = localStorage.getItem(THEME_KEY) || 'light';
  applyThemeToPage(saved);
}

function applyThemeToPage(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
  var btn = document.getElementById('themeToggleBtn');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
  if (btn) btn.setAttribute('aria-label', theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
}

function toggleTheme() {
  var current = document.documentElement.getAttribute('data-theme') || 'light';
  applyThemeToPage(current === 'dark' ? 'light' : 'dark');
}

/* ================================================================
   LOGOUT
   ================================================================ */
function doLogout() {
  if (typeof logout === 'function') {
    logout(); // from auth.js – clears session + redirects
  } else {
    sessionStorage.clear();
    window.location.replace('index.html');
  }
}

/* ================================================================
   SIDEBAR MANAGEMENT
   ================================================================ */
function switchSidebarTab(tab) {
  var panelWeather   = document.getElementById('panelWeather');
  var panelFavorites = document.getElementById('panelFavorites');
  var tabWeather     = document.getElementById('tabWeather');
  var tabFavorites   = document.getElementById('tabFavorites');
  if (!panelWeather || !panelFavorites) return;

  if (tab === 'weather') {
    panelWeather.classList.add('active');
    panelFavorites.classList.remove('active');
    tabWeather.classList.add('active');
    tabWeather.setAttribute('aria-selected', 'true');
    tabFavorites.classList.remove('active');
    tabFavorites.setAttribute('aria-selected', 'false');
    var toggleLabel = document.getElementById('sidebarToggleLabel');
    if (toggleLabel) toggleLabel.textContent = 'Ver Clima';
  } else {
    panelWeather.classList.remove('active');
    panelFavorites.classList.add('active');
    tabWeather.classList.remove('active');
    tabWeather.setAttribute('aria-selected', 'false');
    tabFavorites.classList.add('active');
    tabFavorites.setAttribute('aria-selected', 'true');
    renderFavoritesList();
    var toggleLabel2 = document.getElementById('sidebarToggleLabel');
    if (toggleLabel2) toggleLabel2.textContent = 'Mis Lugares';
  }
}

function toggleSidebar() {
  var sidebar = document.getElementById('sidebar');
  var btn     = document.getElementById('sidebarToggle');
  if (!sidebar) return;
  var isOpen = sidebar.classList.contains('open');
  if (isOpen) {
    sidebar.classList.remove('open');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  } else {
    sidebar.classList.add('open');
    if (btn) btn.setAttribute('aria-expanded', 'true');
  }
}

function openSidebar() {
  var sidebar = document.getElementById('sidebar');
  var btn     = document.getElementById('sidebarToggle');
  if (sidebar) sidebar.classList.add('open');
  if (btn)     btn.setAttribute('aria-expanded', 'true');
}

// Close sidebar when clicking outside (mobile)
document.addEventListener('click', function(e) {
  if (window.innerWidth > 768) return;
  var sidebar = document.getElementById('sidebar');
  var toggle  = document.getElementById('sidebarToggle');
  if (!sidebar || !sidebar.classList.contains('open')) return;
  if (!sidebar.contains(e.target) && (!toggle || !toggle.contains(e.target))) {
    sidebar.classList.remove('open');
    var btn = document.getElementById('sidebarToggle');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }
});

/* ================================================================
   SEARCH
   ================================================================ */
function initSearch() {
  var input       = document.getElementById('searchInput');
  var suggestions = document.getElementById('searchSuggestions');
  if (!input) return;

  // Enter key triggers search
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      hideSuggestions();
      doSearch();
    }
    if (e.key === 'Escape') {
      hideSuggestions();
    }
  });

  // Debounced live suggestions
  input.addEventListener('input', function() {
    clearTimeout(_searchDebounceTimer);
    var query = input.value.trim();
    if (query.length < 2) {
      hideSuggestions();
      return;
    }
    _searchDebounceTimer = setTimeout(function() {
      fetchSuggestions(query);
    }, 350);
  });

  // Hide suggestions on outside click
  document.addEventListener('click', function(e) {
    if (!input.contains(e.target) && suggestions && !suggestions.contains(e.target)) {
      hideSuggestions();
    }
  });
}

function fetchSuggestions(query) {
  forwardGeocode(query)
    .then(function(results) {
      showSuggestions(results);
    })
    .catch(function() {
      hideSuggestions();
    });
}

function showSuggestions(results) {
  var suggestions = document.getElementById('searchSuggestions');
  if (!suggestions) return;

  if (!results || results.length === 0) {
    hideSuggestions();
    return;
  }

  var html = '';
  results.slice(0, 5).forEach(function(r) {
    // Use short display name (first two parts)
    var shortName = r.name.split(',').slice(0, 2).join(',').trim();
    html += '<div class="suggestion-item" '
      + 'role="option" '
      + 'tabindex="0" '
      + 'onclick="selectSuggestion(' + r.lat + ',' + r.lon + ',\'' + escapeHtmlApp(shortName) + '\')" '
      + 'onkeydown="if(event.key===\'Enter\')selectSuggestion(' + r.lat + ',' + r.lon + ',\'' + escapeHtmlApp(shortName) + '\')">'
      + '<span class="sug-icon" aria-hidden="true">📍</span>'
      + escapeHtmlApp(shortName)
      + '</div>';
  });

  suggestions.innerHTML = html;
  suggestions.classList.add('visible');
}

function selectSuggestion(lat, lon, name) {
  hideSuggestions();
  var input = document.getElementById('searchInput');
  if (input) input.value = name;
  flyToLocation(lat, lon, 12);
  handleMapClick(lat, lon);
}

function hideSuggestions() {
  var suggestions = document.getElementById('searchSuggestions');
  if (suggestions) suggestions.classList.remove('visible');
}

function doSearch() {
  var input = document.getElementById('searchInput');
  if (!input) return;
  var query = input.value.trim();
  if (!query) return;

  showToast('🔍 Buscando "' + query + '"...');

  forwardGeocode(query)
    .then(function(results) {
      if (!results || results.length === 0) {
        showToast('❌ No se encontraron resultados para "' + query + '".');
        return;
      }
      var best = results[0];
      // Use short name
      var shortName = best.name.split(',').slice(0, 2).join(',').trim();
      flyToLocation(best.lat, best.lon, 12);
      handleMapClick(best.lat, best.lon);
      input.value = shortName;
    })
    .catch(function() {
      showToast('❌ Error al buscar. Verifica tu conexión.');
    });
}

/* ================================================================
   SAVE CURRENT LOCATION (called from weather.js panel button)
   ================================================================ */
function saveCurrentLocation() {
  if (!window._currentWeatherData) {
    showToast('⚠️ Primero selecciona una ubicación en el mapa.');
    return;
  }

  var data    = window._currentWeatherData;
  var success = addFavorite({
    name:        data.name,
    lat:         data.lat,
    lon:         data.lon,
    weatherCode: data.weatherCode,
    temp:        data.temp
  });

  if (success) {
    showToast('⭐ "' + truncate(data.name, 30) + '" guardado en favoritos.');
    renderFavoritesList();
  } else {
    showToast('ℹ️ Esta ubicación ya está en tus favoritos.');
  }
}

/* ================================================================
   FAVORITES CLICK (defined globally, called from favorites.js HTML)
   ================================================================ */
function onFavoriteClick(lat, lon) {
  flyToLocation(lat, lon, 13);
  handleMapClick(lat, lon);
  // On mobile, close sidebar so the map is visible
  if (window.innerWidth <= 768) {
    var sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('open');
    var btn = document.getElementById('sidebarToggle');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }
  // Switch to weather tab
  switchSidebarTab('weather');
}

/* ================================================================
   OFFLINE MODE DETECTION
   ================================================================ */
function monitorNetworkStatus() {
  var banner = document.getElementById('offlineBanner');

  function handleOffline() {
    if (banner) banner.classList.add('visible');
    showToast('📡 Sin conexión – datos en caché disponibles.');
  }

  function handleOnline() {
    if (banner) banner.classList.remove('visible');
    showToast('✅ Conexión restablecida.');
  }

  window.addEventListener('offline', handleOffline);
  window.addEventListener('online',  handleOnline);

  // Check initial state
  if (!navigator.onLine) handleOffline();
}

/* ================================================================
   SERVICE WORKER REGISTRATION
   ================================================================ */
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(function(reg) {
        console.log('[SkyDash] Service Worker registrado:', reg.scope);
      })
      .catch(function(err) {
        console.warn('[SkyDash] Service Worker error:', err);
      });
  }
}

/* ================================================================
   TOAST NOTIFICATION
   ================================================================ */
var _toastTimer = null;

function showToast(message) {
  // Remove existing toast
  var existing = document.querySelector('.toast');
  if (existing) existing.remove();
  clearTimeout(_toastTimer);

  var toast       = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.textContent = message;

  document.body.appendChild(toast);

  _toastTimer = setTimeout(function() {
    if (toast.parentNode) {
      toast.style.transition = 'opacity 0.4s ease';
      toast.style.opacity    = '0';
      setTimeout(function() {
        if (toast.parentNode) toast.remove();
      }, 400);
    }
  }, 3000);
}

/* ================================================================
   KEYBOARD SHORTCUTS
   ================================================================ */
function initKeyboardShortcuts() {
  document.addEventListener('keydown', function(e) {
    // Ctrl/Cmd + K → focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      var input = document.getElementById('searchInput');
      if (input) input.focus();
    }
    // Escape → close suggestions / sidebar
    if (e.key === 'Escape') {
      hideSuggestions();
      if (window.innerWidth <= 768) {
        var sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.remove('open');
      }
    }
    // D → toggle dark mode
    if (e.key === 'd' && !e.ctrlKey && !e.metaKey && e.target.tagName !== 'INPUT') {
      toggleTheme();
    }
  });
}

/* ================================================================
   UTILITY
   ================================================================ */
function truncate(str, maxLen) {
  if (!str) return '';
  return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
}

function escapeHtmlApp(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#039;');
}
