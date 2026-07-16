/* ================================================================
   map.js — SkyDash-Manager Map Module
   Uses Leaflet.js (https://leafletjs.com/)
   Handles: map init, DivIcon weather markers, geocoding,
            reverse geocoding, search fly-to animation
   ================================================================ */
'use strict';

/* ── Module State ───────────────────────────────────────────────── */
var _map           = null;
var _currentMarker = null;
var _currentLat    = null;
var _currentLon    = null;

// Nominatim base URL (free, no API key needed)
var NOMINATIM = 'https://nominatim.openstreetmap.org';

/* ── Map Initialization ─────────────────────────────────────────── */
/**
 * Initializes the Leaflet map centered on Venezuela by default.
 * Wires up click event and zoom controls.
 */
function initMap() {
  // Default center: Venezuela (UCAB)
  _map = L.map('map', {
    center:    [10.5, -66.9],
    zoom:      5,
    zoomControl: true
  });

  // OpenStreetMap tile layer
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
    maxZoom: 18
  }).addTo(_map);

  // Move zoom control to bottom-left to avoid overlap with sidebar
  _map.zoomControl.setPosition('bottomleft');

  // Click → reverse geocode + fetch weather
  _map.on('click', function(e) {
    handleMapClick(e.latlng.lat, e.latlng.lng);
  });

  return _map;
}

/* ── Map Click Handler ──────────────────────────────────────────── */
/**
 * Called when user clicks on the map.
 * Reverse-geocodes and fetches weather for the clicked location.
 * @param {number} lat
 * @param {number} lon
 */
function handleMapClick(lat, lon) {
  _currentLat = lat;
  _currentLon = lon;

  // Show loading in weather panel
  if (typeof showWeatherLoading === 'function') showWeatherLoading();

  // Switch sidebar to weather tab
  if (typeof switchSidebarTab === 'function') switchSidebarTab('weather');

  // On mobile, open sidebar
  if (window.innerWidth <= 768 && typeof openSidebar === 'function') openSidebar();

  // Parallel: reverse geocode + fetch weather
  var geoPromise     = reverseGeocode(lat, lon);
  var weatherPromise = fetchWeather(lat, lon);

  Promise.all([geoPromise, weatherPromise])
    .then(function(results) {
      var locationName = results[0];
      var weatherData  = results[1];
      var weatherCode  = weatherData.current.weathercode;
      var temp         = weatherData.current.temperature_2m;

      // Place dynamic marker
      setWeatherMarker(lat, lon, weatherCode, locationName);

      // Render weather panel
      renderCurrentWeather(weatherData, locationName);

      // Store current state for saving
      window._currentWeatherData = {
        lat: lat, lon: lon,
        name: locationName,
        weatherCode: weatherCode,
        temp: temp
      };
    })
    .catch(function(err) {
      console.error('[SkyDash] Map click error:', err);
      if (typeof showWeatherError === 'function') {
        showWeatherError('No se pudo obtener el clima para esta ubicación.');
      }
    });
}

/* ── DivIcon Weather Marker ─────────────────────────────────────── */
/**
 * Places (or replaces) a DivIcon marker with the weather emoji.
 * @param {number} lat
 * @param {number} lon
 * @param {number} weatherCode
 * @param {string} locationName
 */
function setWeatherMarker(lat, lon, weatherCode, locationName) {
  if (!_map) return;

  var info = (typeof getWeatherInfo === 'function')
    ? getWeatherInfo(weatherCode)
    : { emoji: '📍', label: '' };

  // Remove previous marker
  if (_currentMarker) {
    _map.removeLayer(_currentMarker);
    _currentMarker = null;
  }

  // Create DivIcon with animated weather bubble
  var icon = L.divIcon({
    className:  'weather-marker',
    html: '<div class="marker-bubble" title="' + escapeHtmlMap(locationName || '') + '">'
        + '<span class="marker-emoji" role="img" aria-label="' + escapeHtmlMap(info.label) + '">'
        + info.emoji
        + '</span>'
        + '</div>',
    iconSize:    [54, 54],
    iconAnchor:  [27, 54],
    popupAnchor: [0, -58]
  });

  _currentMarker = L.marker([lat, lon], { icon: icon });

  // Popup with brief info
  var popupContent = '<div style="text-align:center;font-weight:700;font-size:1rem;">'
    + info.emoji + ' ' + (locationName || 'Sin nombre')
    + '</div>'
    + '<div style="color:var(--text-secondary);font-size:0.8rem;text-align:center;margin-top:4px;">'
    + info.label
    + '</div>';

  _currentMarker.bindPopup(popupContent);
  _currentMarker.addTo(_map);
  _currentMarker.openPopup();
}

/* ── Reverse Geocoding (coords → name) ─────────────────────────── */
/**
 * Translates lat/lon into a human-readable location name via Nominatim.
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<string>}
 */
function reverseGeocode(lat, lon) {
  var url = NOMINATIM + '/reverse?lat=' + lat + '&lon=' + lon + '&format=json&accept-language=es';

  return fetch(url, {
    headers: { 'Accept-Language': 'es', 'User-Agent': 'SkyDash-Manager/1.0' }
  })
    .then(function(res) {
      if (!res.ok) throw new Error('Nominatim error ' + res.status);
      return res.json();
    })
    .then(function(data) {
      return buildLocationName(data);
    })
    .catch(function(err) {
      console.warn('[SkyDash] Reverse geocoding failed:', err.message);
      return lat.toFixed(4) + '°, ' + lon.toFixed(4) + '°';
    });
}

/**
 * Extracts a readable name from Nominatim reverse geocode response.
 */
function buildLocationName(data) {
  if (!data || !data.address) return 'Ubicación desconocida';
  var a = data.address;
  var parts = [];
  var city  = a.city || a.town || a.village || a.hamlet || a.county || a.municipality || '';
  var state = a.state || a.region || '';
  var country = a.country || '';
  if (city)    parts.push(city);
  if (state)   parts.push(state);
  if (country) parts.push(country);
  return parts.length > 0 ? parts.join(', ') : (data.display_name || 'Ubicación desconocida');
}

/* ── Forward Geocoding (text → coords) ─────────────────────────── */
/**
 * Searches for a location by text query using Nominatim.
 * @param {string} query
 * @returns {Promise<Array<{ name: string, lat: number, lon: number }>>}
 */
function forwardGeocode(query) {
  var url = NOMINATIM + '/search?q=' + encodeURIComponent(query)
    + '&format=json&limit=5&accept-language=es';

  return fetch(url, {
    headers: { 'User-Agent': 'SkyDash-Manager/1.0' }
  })
    .then(function(res) {
      if (!res.ok) throw new Error('Search error ' + res.status);
      return res.json();
    })
    .then(function(results) {
      return results.map(function(r) {
        return {
          name: r.display_name,
          lat:  parseFloat(r.lat),
          lon:  parseFloat(r.lon)
        };
      });
    });
}

/* ── Map Navigation ─────────────────────────────────────────────── */
/**
 * Flies the map to the given coordinates with smooth animation.
 * @param {number} lat
 * @param {number} lon
 * @param {number} [zoom=13]
 */
function flyToLocation(lat, lon, zoom) {
  if (!_map) return;
  _map.flyTo([lat, lon], zoom || 13, {
    animate:  true,
    duration: 1.5
  });
}

/**
 * Resets the map to the default global view.
 */
function resetMapView() {
  if (!_map) return;
  _map.flyTo([10.5, -66.9], 5, { animate: true, duration: 1.5 });
}

/**
 * Attempts to geolocate the user and fly there.
 */
function locateMe() {
  if (!navigator.geolocation) {
    if (typeof showToast === 'function') showToast('⚠️ Geolocalización no disponible en este dispositivo.');
    return;
  }

  if (typeof showToast === 'function') showToast('📡 Localizando tu posición...');

  navigator.geolocation.getCurrentPosition(
    function(pos) {
      var lat = pos.coords.latitude;
      var lon = pos.coords.longitude;
      flyToLocation(lat, lon, 13);
      handleMapClick(lat, lon);
    },
    function(err) {
      console.warn('[SkyDash] Geolocation error:', err.message);
      if (typeof showToast === 'function') showToast('❌ No se pudo obtener tu ubicación.');
    },
    { timeout: 8000, maximumAge: 60000 }
  );
}

/* ── Getters ────────────────────────────────────────────────────── */
function getCurrentLat() { return _currentLat; }
function getCurrentLon() { return _currentLon; }
function getMapInstance() { return _map; }

/* ── Utility ────────────────────────────────────────────────────── */
function escapeHtmlMap(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
