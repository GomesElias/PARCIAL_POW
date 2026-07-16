/* ================================================================
   weather.js — SkyDash-Manager Weather Module
   Uses Open-Meteo API (https://open-meteo.com/)
   Handles: data fetching, WMO code mapping, rendering,
            offline caching via localStorage
   ================================================================ */
'use strict';

/* ── WMO Weather Code Dictionary ────────────────────────────────── */
var WMO = {
  0:  { emoji: '☀️',  label: 'Cielo despejado',           bg: '#fef3c7' },
  1:  { emoji: '🌤️', label: 'Principalmente despejado',   bg: '#fef9c3' },
  2:  { emoji: '⛅',  label: 'Parcialmente nublado',       bg: '#e0f2fe' },
  3:  { emoji: '☁️',  label: 'Nublado',                   bg: '#f1f5f9' },
  45: { emoji: '🌫️', label: 'Niebla',                    bg: '#f8fafc' },
  48: { emoji: '🌫️', label: 'Niebla con escarcha',       bg: '#f8fafc' },
  51: { emoji: '🌦️', label: 'Llovizna ligera',            bg: '#eff6ff' },
  53: { emoji: '🌦️', label: 'Llovizna moderada',          bg: '#eff6ff' },
  55: { emoji: '🌧️', label: 'Llovizna densa',             bg: '#dbeafe' },
  56: { emoji: '🌧️', label: 'Llovizna helada ligera',     bg: '#dbeafe' },
  57: { emoji: '🌧️', label: 'Llovizna helada densa',      bg: '#bfdbfe' },
  61: { emoji: '🌧️', label: 'Lluvia ligera',              bg: '#dbeafe' },
  63: { emoji: '🌧️', label: 'Lluvia moderada',            bg: '#bfdbfe' },
  65: { emoji: '🌧️', label: 'Lluvia intensa',             bg: '#93c5fd' },
  66: { emoji: '🌧️', label: 'Lluvia helada ligera',       bg: '#bfdbfe' },
  67: { emoji: '🌧️', label: 'Lluvia helada intensa',      bg: '#93c5fd' },
  71: { emoji: '🌨️', label: 'Nevada ligera',              bg: '#f0f9ff' },
  73: { emoji: '🌨️', label: 'Nevada moderada',            bg: '#e0f2fe' },
  75: { emoji: '❄️',  label: 'Nevada intensa',             bg: '#bae6fd' },
  77: { emoji: '🌨️', label: 'Granizo de nieve',           bg: '#e0f2fe' },
  80: { emoji: '🌦️', label: 'Chubascos ligeros',          bg: '#dbeafe' },
  81: { emoji: '🌦️', label: 'Chubascos moderados',        bg: '#bfdbfe' },
  82: { emoji: '⛈️',  label: 'Chubascos violentos',       bg: '#7dd3fc' },
  85: { emoji: '🌨️', label: 'Chubascos de nieve ligeros', bg: '#f0f9ff' },
  86: { emoji: '❄️',  label: 'Chubascos de nieve intensos',bg: '#bae6fd' },
  95: { emoji: '⛈️',  label: 'Tormenta eléctrica',        bg: '#818cf8' },
  96: { emoji: '⛈️',  label: 'Tormenta con granizo',      bg: '#6366f1' },
  99: { emoji: '⛈️',  label: 'Tormenta con granizo fuerte',bg: '#4f46e5' }
};

/**
 * Returns WMO weather info for a given code.
 * @param {number} code
 * @returns {{ emoji: string, label: string, bg: string }}
 */
function getWeatherInfo(code) {
  return WMO[code] || { emoji: '🌡️', label: 'Condición desconocida', bg: '#f8fafc' };
}

/* ── Open-Meteo API ─────────────────────────────────────────────── */
var WEATHER_CACHE_KEY = 'skydash-weather-cache';
var OPEN_METEO_BASE   = 'https://api.open-meteo.com/v1/forecast';

/**
 * Fetches current + 7-day forecast from Open-Meteo.
 * Falls back to localStorage cache on failure (offline mode).
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<Object>} Open-Meteo response
 */
function fetchWeather(lat, lon) {
  var params = new URLSearchParams({
    latitude:  lat.toFixed(4),
    longitude: lon.toFixed(4),
    current:   [
      'temperature_2m',
      'relative_humidity_2m',
      'wind_speed_10m',
      'weathercode',
      'apparent_temperature',
      'precipitation'
    ].join(','),
    daily: [
      'weathercode',
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_sum',
      'windspeed_10m_max'
    ].join(','),
    timezone:     'auto',
    forecast_days: 7
  });

  var url = OPEN_METEO_BASE + '?' + params.toString();

  return fetch(url)
    .then(function(response) {
      if (!response.ok) throw new Error('Error HTTP ' + response.status);
      return response.json();
    })
    .then(function(data) {
      cacheWeatherData(lat, lon, data);
      return data;
    })
    .catch(function(error) {
      var cached = getCachedWeatherData(lat, lon);
      if (cached) {
        console.warn('[SkyDash] Sin red – usando caché:', error.message);
        return cached.data;
      }
      throw error;
    });
}

/* ── Cache Helpers ──────────────────────────────────────────────── */
function cacheWeatherData(lat, lon, data) {
  try {
    var cache = JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY) || '{}');
    var key   = roundCoord(lat) + '_' + roundCoord(lon);
    cache[key] = { data: data, timestamp: Date.now() };

    // Keep only 15 most recent entries
    var keys = Object.keys(cache);
    if (keys.length > 15) {
      delete cache[keys[0]];
    }
    localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn('[SkyDash] No se pudo guardar caché:', e);
  }
}

function getCachedWeatherData(lat, lon) {
  try {
    var cache = JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY) || '{}');
    var key   = roundCoord(lat) + '_' + roundCoord(lon);
    return cache[key] || null;
  } catch (e) {
    return null;
  }
}

function roundCoord(n) {
  return parseFloat(n).toFixed(2);
}

/* ── Day Name Helper ────────────────────────────────────────────── */
var DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function getDayLabel(dateStr, index) {
  if (index === 0) return 'Hoy';
  var date = new Date(dateStr + 'T12:00:00');
  return DAY_NAMES[date.getDay()];
}

/* ── Render: Current Weather ────────────────────────────────────── */
/**
 * Renders current weather into #weatherPanel.
 * @param {Object} data     Open-Meteo API response
 * @param {string} location Human-readable location name
 */
function renderCurrentWeather(data, location) {
  var panel = document.getElementById('weatherPanel');
  if (!panel) return;

  var cur  = data.current;
  var info = getWeatherInfo(cur.weathercode);

  var html = '<div class="location-header">'
    + '<h2 class="location-name">' + escapeHtml(location || 'Ubicación desconocida') + '</h2>'
    + '<span class="location-coords">'
    +   parseFloat(data.latitude).toFixed(4) + '° N, '
    +   parseFloat(data.longitude).toFixed(4) + '° E'
    + '</span>'
    + '</div>'

    + '<div class="current-weather-card fade-in">'
    +   '<div class="weather-main">'
    +     '<span class="weather-emoji-large" role="img" aria-label="' + info.label + '">' + info.emoji + '</span>'
    +     '<div class="temp-container">'
    +       '<span class="temperature">' + Math.round(cur.temperature_2m) + '°</span>'
    +       '<span class="temp-unit">C</span>'
    +     '</div>'
    +   '</div>'
    +   '<p class="weather-desc">' + escapeHtml(info.label) + '</p>'
    +   '<p class="feels-like">Sensación térmica: ' + Math.round(cur.apparent_temperature) + '°C</p>'

    +   '<div class="weather-stats">'
    +     '<div class="stat-item"><span class="stat-icon">💧</span><span class="stat-value">' + cur.relative_humidity_2m + '%</span><span class="stat-label">Humedad</span></div>'
    +     '<div class="stat-item"><span class="stat-icon">💨</span><span class="stat-value">' + Math.round(cur.wind_speed_10m) + ' km/h</span><span class="stat-label">Viento</span></div>'
    +     '<div class="stat-item"><span class="stat-icon">🌧️</span><span class="stat-value">' + (cur.precipitation || 0) + ' mm</span><span class="stat-label">Precipitación</span></div>'
    +   '</div>'
    + '</div>'

    + '<div class="forecast-section">'
    +   '<h3 class="forecast-title">Pronóstico 7 días</h3>'
    +   '<div class="forecast-grid" id="forecastGrid"></div>'
    + '</div>'

    + '<button class="btn-save-location" id="saveLocationBtn" onclick="saveCurrentLocation()" aria-label="Guardar esta ubicación en favoritos">'
    +   '<span aria-hidden="true">⭐</span> Guardar ubicación'
    + '</button>';

  panel.innerHTML = html;
  render7DayForecast(data);
}

/* ── Render: 7-Day Forecast ─────────────────────────────────────── */
function render7DayForecast(data) {
  var grid = document.getElementById('forecastGrid');
  if (!grid || !data.daily) return;

  var html = '';
  for (var i = 0; i < data.daily.time.length; i++) {
    var dayInfo  = getWeatherInfo(data.daily.weathercode[i]);
    var maxT     = Math.round(data.daily.temperature_2m_max[i]);
    var minT     = Math.round(data.daily.temperature_2m_min[i]);
    var precip   = data.daily.precipitation_sum[i] || 0;
    var dayLabel = getDayLabel(data.daily.time[i], i);
    var isToday  = i === 0;

    html += '<div class="forecast-day' + (isToday ? ' today' : '') + '" '
      + 'title="' + escapeHtml(dayInfo.label) + '">'
      + '<span class="forecast-day-name">' + dayLabel + '</span>'
      + '<span class="forecast-emoji" role="img" aria-label="' + escapeHtml(dayInfo.label) + '">' + dayInfo.emoji + '</span>'
      + '<span class="forecast-desc">' + escapeHtml(dayInfo.label) + '</span>'
      + '<div class="forecast-temps">'
      +   '<span class="temp-max">' + maxT + '°</span>'
      +   '<span class="temp-min">' + minT + '°</span>'
      + '</div>'
      + (precip > 0 ? '<span class="forecast-precip">💧' + precip + 'mm</span>' : '')
      + '</div>';
  }

  grid.innerHTML = html;
}

/* ── Render: Loading State ──────────────────────────────────────── */
function showWeatherLoading() {
  var panel = document.getElementById('weatherPanel');
  if (!panel) return;
  panel.innerHTML = '<div class="weather-loading">'
    + '<div class="loading-spinner-large" role="status" aria-label="Cargando"></div>'
    + '<p>Cargando datos meteorológicos...</p>'
    + '</div>';
}

/* ── Render: Error State ────────────────────────────────────────── */
function showWeatherError(message) {
  var panel = document.getElementById('weatherPanel');
  if (!panel) return;
  panel.innerHTML = '<div class="weather-error">'
    + '<span class="error-icon" role="img" aria-label="Error">⚠️</span>'
    + '<p>' + escapeHtml(message) + '</p>'
    + '<p class="error-hint">Verifica tu conexión o intenta otra ubicación.</p>'
    + '</div>';
}

/* ── Render: Placeholder (initial state) ────────────────────────── */
function showWeatherPlaceholder() {
  var panel = document.getElementById('weatherPanel');
  if (!panel) return;
  panel.innerHTML = '<div class="weather-placeholder">'
    + '<div class="placeholder-icon" role="img" aria-label="Globo terráqueo">🌍</div>'
    + '<h3>Explora el mundo</h3>'
    + '<p>Haz clic en cualquier punto del mapa o busca una ciudad para ver las condiciones meteorológicas en tiempo real.</p>'
    + '</div>';
}

/* ── Utility ────────────────────────────────────────────────────── */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
