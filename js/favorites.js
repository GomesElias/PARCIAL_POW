/* ================================================================
   favorites.js — SkyDash-Manager Saved Locations Module
   Handles: CRUD for saved locations, localStorage persistence,
            favorites list rendering, click-to-navigate
   ================================================================ */
'use strict';

/* ── Storage Key ────────────────────────────────────────────────── */
var FAVORITES_KEY = 'skydash-favorites';

/* ── Storage Helpers ────────────────────────────────────────────── */
function loadFavorites() {
  try {
    var stored = localStorage.getItem(FAVORITES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
}

function persistFavorites(favorites) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
}

/* ── CRUD Operations ────────────────────────────────────────────── */

/**
 * Adds a new favorite location.
 * @param {{ name: string, lat: number, lon: number, weatherCode: number, temp?: number }} loc
 * @returns {boolean} true if added, false if duplicate
 */
function addFavorite(loc) {
  var favorites = loadFavorites();

  // Duplicate check (within ~0.05° ≈ 5km)
  var isDuplicate = favorites.some(function(f) {
    return Math.abs(f.lat - loc.lat) < 0.05 && Math.abs(f.lon - loc.lon) < 0.05;
  });

  if (isDuplicate) return false;

  favorites.unshift({
    id:          generateId(),
    name:        loc.name || 'Sin nombre',
    lat:         loc.lat,
    lon:         loc.lon,
    weatherCode: loc.weatherCode || 0,
    temp:        loc.temp || null,
    savedAt:     Date.now()
  });

  persistFavorites(favorites);
  return true;
}

/**
 * Removes a favorite by id.
 * @param {string} id
 */
function removeFavorite(id) {
  var favorites = loadFavorites().filter(function(f) {
    return f.id !== id;
  });
  persistFavorites(favorites);
}

/**
 * Updates weather info for an existing favorite.
 * @param {number} lat
 * @param {number} lon
 * @param {number} weatherCode
 * @param {number} temp
 */
function updateFavoriteWeather(lat, lon, weatherCode, temp) {
  var favorites = loadFavorites();
  favorites.forEach(function(f) {
    if (Math.abs(f.lat - lat) < 0.05 && Math.abs(f.lon - lon) < 0.05) {
      f.weatherCode = weatherCode;
      f.temp        = temp;
    }
  });
  persistFavorites(favorites);
}

function getFavoritesCount() {
  return loadFavorites().length;
}

/* ── Render Favorites List ──────────────────────────────────────── */
/**
 * Renders the favorites list into #favoritesList.
 * Calls window.onFavoriteClick(lat, lon) when an item is clicked.
 */
function renderFavoritesList() {
  var container = document.getElementById('favoritesList');
  var countEl   = document.getElementById('favoritesCount');
  if (!container) return;

  var favorites = loadFavorites();

  // Update count badge
  if (countEl) countEl.textContent = favorites.length;

  if (favorites.length === 0) {
    container.innerHTML = '<div class="favorites-empty">'
      + '<span class="empty-icon" role="img" aria-label="Sin favoritos">📍</span>'
      + '<p>Aún no tienes lugares guardados. Haz clic en el mapa y guarda tus ubicaciones favoritas.</p>'
      + '</div>';
    return;
  }

  var html = '<div class="favorites-list">';
  favorites.forEach(function(fav) {
    var info = (typeof getWeatherInfo === 'function') ? getWeatherInfo(fav.weatherCode) : { emoji: '📍' };
    var tempStr = fav.temp !== null && fav.temp !== undefined ? Math.round(fav.temp) + '°C' : '';

    html += '<div class="favorite-item" '
      + 'role="button" '
      + 'tabindex="0" '
      + 'aria-label="Ir a ' + escapeHtmlFav(fav.name) + '" '
      + 'onclick="onFavoriteClick(' + fav.lat + ',' + fav.lon + ')" '
      + 'onkeydown="if(event.key===\'Enter\'||event.key===\' \')onFavoriteClick(' + fav.lat + ',' + fav.lon + ')">'

      + '<span class="fav-emoji" role="img" aria-label="Clima">' + info.emoji + '</span>'

      + '<div class="fav-info">'
      +   '<div class="fav-name">' + escapeHtmlFav(fav.name) + '</div>'
      +   '<div class="fav-coords">'
      +     parseFloat(fav.lat).toFixed(3) + '°, ' + parseFloat(fav.lon).toFixed(3) + '°'
      +   '</div>'
      +   (tempStr ? '<div class="fav-temp">' + tempStr + '</div>' : '')
      + '</div>'

      + '<button class="fav-remove" '
      + 'aria-label="Eliminar ' + escapeHtmlFav(fav.name) + '" '
      + 'onclick="event.stopPropagation(); removeFavoriteAndRefresh(\'' + fav.id + '\')">'
      + '✕'
      + '</button>'
      + '</div>';
  });
  html += '</div>';

  container.innerHTML = html;
}

/**
 * Removes a favorite and re-renders the list.
 * @param {string} id
 */
function removeFavoriteAndRefresh(id) {
  removeFavorite(id);
  renderFavoritesList();
  showToast('📍 Ubicación eliminada de favoritos.');
}

/* ── Utility ────────────────────────────────────────────────────── */
function generateId() {
  return 'fav_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
}

function escapeHtmlFav(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#039;');
}

// showToast is defined in app.js — forward reference is fine since
// favorites.js loads before app.js only for module definitions.
// The actual calls happen post-DOMContentLoaded.
