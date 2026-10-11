/**
 * AstraPulse Configuration
 * Rate-limit aware: LL2 free tier = 15 req/hour
 * Strategy: cache aggressively, prefer lldev for non-critical, throttle production calls
 */

const CONFIG = {
  // Launch Library 2
  LL2_BASE: 'https://ll.thespacedevs.com/2.3.0',
  LL2_DEV: 'https://lldev.thespacedevs.com/2.3.0', // no rate limit, stale data — use for heavy exploratory fetches
  LL2_LIMIT: 15, // requests per hour (production)

  // Prefer production for live data; fall back to dev when throttled
  useProduction: true,

  // Open Notify / ISS
  ISS_NOW: 'https://api.open-notify.org/iss-now.json',
  PEOPLE_IN_SPACE: 'https://api.open-notify.org/astros.json',
  // Alternative realtime ISS
  WHERE_ISS: 'https://api.wheretheiss.at/v1/satellites/25544',

  // CelesTrak (public, be respectful)
  CELESTRAK: {
    stations: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=json',
    starlink: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=json',
    active: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=json',
    debris: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=cosmos-1408-debris&FORMAT=json',
  },

  // NASA API key
  NASA_KEY: 'FkX1PuggUJq8aVhg1ZJuffZc3TsPfLa90DWLF7I1',
  NASA_APOD: 'https://api.nasa.gov/planetary/apod',
  NASA_NEO_FEED: 'https://api.nasa.gov/neo/rest/v1/feed',
  NASA_DONKI_CME: 'https://api.nasa.gov/DONKI/CME',
  NASA_DONKI_FLARE: 'https://api.nasa.gov/DONKI/FLR',
  NASA_DONKI_GST: 'https://api.nasa.gov/DONKI/GST',
  NASA_EPIC: 'https://api.nasa.gov/EPIC/api/natural',
  NASA_EPIC_ARCHIVE: 'https://epic.gsfc.nasa.gov/archive/natural',
  NASA_IMAGES: 'https://images-api.nasa.gov/search',

  // Refresh intervals (ms)
  REFRESH_ISS: 30_000,       // 30s for ISS position
  REFRESH_DASHBOARD: 120_000, // 2 min for near-realtime dashboard
  REFRESH_HEAVY: 15 * 60_000, // 15 min for agencies/astronauts lists

  // Cache TTLs (ms)
  CACHE_SHORT: 90_000,   // ~1.5 min
  CACHE_MEDIUM: 10 * 60_000,
  CACHE_LONG: 60 * 60_000,

  // Pagination
  PAGE_SIZE: 12,

  // App
  APP_NAME: 'AstraPulse',
  VERSION: '1.0.0',
};

// Simple localStorage cache with TTL
const Cache = {
  get(key) {
    try {
      const raw = localStorage.getItem('ap_' + key);
      if (!raw) return null;
      const { data, expires } = JSON.parse(raw);
      if (Date.now() > expires) {
        localStorage.removeItem('ap_' + key);
        return null;
      }
      return data;
    } catch {
      return null;
    }
  },
  set(key, data, ttl = CONFIG.CACHE_MEDIUM) {
    try {
      localStorage.setItem('ap_' + key, JSON.stringify({
        data,
        expires: Date.now() + ttl,
      }));
    } catch (e) {
      // quota exceeded — clear old keys
      console.warn('Cache write failed', e);
    }
  },
  clear() {
    Object.keys(localStorage)
      .filter(k => k.startsWith('ap_'))
      .forEach(k => localStorage.removeItem(k));
  },
};
