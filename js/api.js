/**
 * AstraPulse API Layer
 * Respects LL2 15 req/hour limit via request queue + cache
 */

const API = (() => {
  let requestCount = 0;
  let windowStart = Date.now();
  const QUEUE = [];
  let processing = false;

  function resetWindowIfNeeded() {
    if (Date.now() - windowStart > 60 * 60 * 1000) {
      requestCount = 0;
      windowStart = Date.now();
    }
  }

  function canRequest() {
    resetWindowIfNeeded();
    return requestCount < CONFIG.LL2_LIMIT - 1; // leave 1 headroom
  }

  async function fetchJSON(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.headers || {}),
      },
    });
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  // Rate-limited LL2 fetch
  async function ll2(path, { useCache = true, ttl = CONFIG.CACHE_MEDIUM, forceDev = false } = {}) {
    const cacheKey = 'll2_' + path;
    if (useCache) {
      const cached = Cache.get(cacheKey);
      if (cached) return cached;
    }

    const base = (forceDev || !CONFIG.useProduction || !canRequest())
      ? CONFIG.LL2_DEV
      : CONFIG.LL2_BASE;

    const url = `${base}${path}`;
    try {
      if (base === CONFIG.LL2_BASE) requestCount++;
      const data = await fetchJSON(url);
      Cache.set(cacheKey, data, ttl);
      updateThrottleUI();
      return data;
    } catch (e) {
      if (e.status === 429 && base === CONFIG.LL2_BASE) {
        // fallback to dev
        console.warn('LL2 rate limited — falling back to lldev');
        const data = await fetchJSON(`${CONFIG.LL2_DEV}${path}`);
        Cache.set(cacheKey, data, ttl);
        updateThrottleUI();
        return data;
      }
      throw e;
    }
  }

  function updateThrottleUI() {
    resetWindowIfNeeded();
    const remaining = Math.max(0, CONFIG.LL2_LIMIT - requestCount);
    const el = document.getElementById('api-status-text');
    const dot = document.querySelector('.status-dot');
    if (!el) return;
    if (remaining <= 2) {
      el.textContent = `LL2 limited (${remaining} left)`;
      dot.className = 'status-dot limited';
    } else {
      el.textContent = `Online · ${remaining} LL2 calls left`;
      dot.className = 'status-dot online';
    }
  }

  // ——— Public endpoints ———

  async function getUpcomingLaunches(limit = 12) {
    return ll2(`/launches/upcoming/?limit=${limit}&mode=detailed`, {
      ttl: CONFIG.CACHE_SHORT,
    });
  }

  async function getPreviousLaunches(limit = 12, offset = 0) {
    return ll2(`/launches/previous/?limit=${limit}&offset=${offset}&mode=list`, {
      ttl: CONFIG.CACHE_MEDIUM,
    });
  }

  async function getLaunch(id) {
    return ll2(`/launches/${id}/`, { ttl: CONFIG.CACHE_MEDIUM });
  }

  async function searchLaunches(query, limit = 20) {
    return ll2(`/launches/?search=${encodeURIComponent(query)}&limit=${limit}&mode=list`, {
      ttl: CONFIG.CACHE_SHORT,
    });
  }

  async function getEvents(upcoming = true, limit = 12) {
    const path = upcoming ? '/events/upcoming/' : '/events/';
    return ll2(`${path}?limit=${limit}`, { ttl: CONFIG.CACHE_MEDIUM });
  }

  async function getAgencies(limit = 30, offset = 0) {
    return ll2(`/agencies/?limit=${limit}&offset=${offset}&ordering=-total_launch_count`, {
      ttl: CONFIG.CACHE_LONG,
    });
  }

  async function getAgency(id) {
    return ll2(`/agencies/${id}/`, { ttl: CONFIG.CACHE_LONG });
  }

  async function getAstronauts(limit = 24, offset = 0, status = null) {
    let path = `/astronauts/?limit=${limit}&offset=${offset}&ordering=-flights_count`;
    if (status) path += `&status=${status}`;
    return ll2(path, { ttl: CONFIG.CACHE_LONG });
  }

  async function getAstronaut(id) {
    return ll2(`/astronauts/${id}/`, { ttl: CONFIG.CACHE_LONG });
  }

  async function searchAstronauts(query) {
    return ll2(`/astronauts/?search=${encodeURIComponent(query)}&limit=20`, {
      ttl: CONFIG.CACHE_MEDIUM,
    });
  }

  async function getSpaceStations() {
    return ll2('/space_stations/?limit=20', { ttl: CONFIG.CACHE_LONG });
  }

  async function getExpeditions(limit = 12) {
    return ll2(`/expeditions/?limit=${limit}&ordering=-start`, {
      ttl: CONFIG.CACHE_MEDIUM,
    });
  }

  async function getDockings(limit = 12) {
    return ll2(`/docking_events/?limit=${limit}&ordering=-docking`, {
      ttl: CONFIG.CACHE_MEDIUM,
    });
  }

  async function getLauncherConfigs(limit = 24) {
    return ll2(`/launcher_configurations/?limit=${limit}&ordering=-successful_launches`, {
      ttl: CONFIG.CACHE_LONG,
    });
  }

  async function getLaunchers(limit = 20) {
    // reusable first stages
    return ll2(`/launchers/?limit=${limit}&ordering=-flights`, {
      ttl: CONFIG.CACHE_LONG,
    });
  }

  async function getSpacecraft(limit = 20) {
    return ll2(`/spacecraft/?limit=${limit}`, { ttl: CONFIG.CACHE_LONG });
  }

  async function getLocations() {
    return ll2('/locations/?limit=50', { ttl: CONFIG.CACHE_LONG });
  }

  async function getPads(limit = 30) {
    return ll2(`/pads/?limit=${limit}`, { ttl: CONFIG.CACHE_LONG });
  }

  // ——— Realtime / non-LL2 ———

  async function getISSPosition() {
    const cacheKey = 'iss_pos';
    const cached = Cache.get(cacheKey);
    if (cached) return cached;
    try {
      // Prefer WhereTheISS for richer data
      const data = await fetchJSON(CONFIG.WHERE_ISS);
      const result = {
        latitude: data.latitude,
        longitude: data.longitude,
        altitude: data.altitude,
        velocity: data.velocity,
        visibility: data.visibility,
        timestamp: data.timestamp,
        source: 'wheretheiss.at',
      };
      Cache.set(cacheKey, result, 25_000);
      return result;
    } catch {
      // fallback Open Notify
      const data = await fetchJSON(CONFIG.ISS_NOW);
      const result = {
        latitude: parseFloat(data.iss_position.latitude),
        longitude: parseFloat(data.iss_position.longitude),
        altitude: null,
        velocity: null,
        visibility: null,
        timestamp: data.timestamp,
        source: 'open-notify',
      };
      Cache.set(cacheKey, result, 25_000);
      return result;
    }
  }

  async function getPeopleInSpace() {
    const cacheKey = 'people_space';
    const cached = Cache.get(cacheKey);
    if (cached) return cached;
    const data = await fetchJSON(CONFIG.PEOPLE_IN_SPACE);
    Cache.set(cacheKey, data, CONFIG.CACHE_MEDIUM);
    return data;
  }

  async function getStarlinkCount() {
    const cacheKey = 'starlink_meta';
    const cached = Cache.get(cacheKey);
    if (cached) return cached;
    try {
      // Lightweight: only fetch a small sample or use a known public count endpoint
      // CelesTrak full starlink is large; we only need approximate count for dashboard
      const data = await fetchJSON(CONFIG.CELESTRAK.starlink);
      const count = Array.isArray(data) ? data.length : 0;
      const result = { count, updated: Date.now() };
      Cache.set(cacheKey, result, CONFIG.CACHE_LONG);
      return result;
    } catch (e) {
      console.warn('Starlink fetch failed', e);
      return { count: null, updated: null };
    }
  }

  async function getStationsTLE() {
    const cacheKey = 'stations_tle';
    const cached = Cache.get(cacheKey);
    if (cached) return cached;
    try {
      const data = await fetchJSON(CONFIG.CELESTRAK.stations);
      Cache.set(cacheKey, data, CONFIG.CACHE_MEDIUM);
      return data;
    } catch {
      return [];
    }
  }

  async function getAPOD() {
    const cacheKey = 'nasa_apod';
    const cached = Cache.get(cacheKey);
    if (cached) return cached;
    try {
      const data = await fetchJSON(`${CONFIG.NASA_APOD}?api_key=${CONFIG.NASA_KEY}`);
      Cache.set(cacheKey, data, CONFIG.CACHE_LONG);
      return data;
    } catch {
      return null;
    }
  }

  // ——— NASA NeoWs: Near-Earth Objects this week ———
  async function getNeoFeed() {
    const cacheKey = 'nasa_neo';
    const cached = Cache.get(cacheKey);
    if (cached) return cached;
    try {
      const start = new Date();
      const end = new Date();
      end.setDate(end.getDate() + 7);
      const fmt = (d) => d.toISOString().slice(0, 10);
      const url = `${CONFIG.NASA_NEO_FEED}?start_date=${fmt(start)}&end_date=${fmt(end)}&api_key=${CONFIG.NASA_KEY}`;
      const data = await fetchJSON(url);
      Cache.set(cacheKey, data, CONFIG.CACHE_MEDIUM);
      return data;
    } catch (e) {
      console.warn('NeoWs failed', e);
      return null;
    }
  }

  // ——— NASA DONKI: Space weather (CME, flares, storms) ———
  async function getSpaceWeather() {
    const cacheKey = 'nasa_donki';
    const cached = Cache.get(cacheKey);
    if (cached) return cached;
    try {
      const start = new Date();
      start.setDate(start.getDate() - 7);
      const fmt = (d) => d.toISOString().slice(0, 10);
      const s = fmt(start);
      const key = CONFIG.NASA_KEY;
      const [cme, flr, gst] = await Promise.all([
        fetchJSON(`${CONFIG.NASA_DONKI_CME}?startDate=${s}&api_key=${key}`).catch(() => []),
        fetchJSON(`${CONFIG.NASA_DONKI_FLARE}?startDate=${s}&api_key=${key}`).catch(() => []),
        fetchJSON(`${CONFIG.NASA_DONKI_GST}?startDate=${s}&api_key=${key}`).catch(() => []),
      ]);
      const result = {
        cme: Array.isArray(cme) ? cme.slice(-8).reverse() : [],
        flares: Array.isArray(flr) ? flr.slice(-8).reverse() : [],
        storms: Array.isArray(gst) ? gst.slice(-5).reverse() : [],
      };
      Cache.set(cacheKey, result, CONFIG.CACHE_MEDIUM);
      return result;
    } catch (e) {
      console.warn('DONKI failed', e);
      return { cme: [], flares: [], storms: [] };
    }
  }

  // ——— NASA EPIC: latest Earth disk image ———
  async function getEPIC() {
    const cacheKey = 'nasa_epic';
    const cached = Cache.get(cacheKey);
    if (cached) return cached;
    try {
      const list = await fetchJSON(`${CONFIG.NASA_EPIC}?api_key=${CONFIG.NASA_KEY}`);
      if (!Array.isArray(list) || !list.length) return null;
      const latest = list[list.length - 1];
      // image URL: https://epic.gsfc.nasa.gov/archive/natural/YYYY/MM/DD/png/NAME.png
      const d = latest.date || latest.identifier || '';
      const datePart = (latest.date || '').slice(0, 10).replace(/-/g, '/');
      const name = latest.image || latest.identifier;
      const imageUrl = datePart && name
        ? `${CONFIG.NASA_EPIC_ARCHIVE}/${datePart}/png/${name}.png`
        : null;
      const result = { ...latest, imageUrl, all: list.slice(-6).reverse() };
      Cache.set(cacheKey, result, CONFIG.CACHE_MEDIUM);
      return result;
    } catch (e) {
      console.warn('EPIC failed', e);
      return null;
    }
  }

  // ——— NASA Image & Video Library search ———
  async function searchNASAImages(query, page = 1) {
    if (!query || query.length < 2) return { items: [], total: 0 };
    const cacheKey = `nasa_img_${query}_${page}`;
    const cached = Cache.get(cacheKey);
    if (cached) return cached;
    try {
      const url = `${CONFIG.NASA_IMAGES}?q=${encodeURIComponent(query)}&media_type=image&page=${page}&page_size=24`;
      const data = await fetchJSON(url);
      const items = (data.collection?.items || []).map((item) => {
        const meta = item.data?.[0] || {};
        const links = item.links || [];
        const thumb = links.find((l) => l.rel === 'preview')?.href
          || links.find((l) => l.render === 'image')?.href
          || links[0]?.href;
        return {
          id: meta.nasa_id,
          title: meta.title,
          description: meta.description,
          date: meta.date_created,
          center: meta.center,
          keywords: meta.keywords,
          thumb,
          href: item.href,
        };
      });
      const result = {
        items,
        total: data.collection?.metadata?.total_hits || items.length,
      };
      Cache.set(cacheKey, result, CONFIG.CACHE_MEDIUM);
      return result;
    } catch (e) {
      console.warn('NASA Images failed', e);
      return { items: [], total: 0 };
    }
  }

  // Global search across multiple resources (uses minimal calls)
  async function globalSearch(query) {
    if (!query || query.length < 2) return { launches: [], astronauts: [], agencies: [] };
    const q = encodeURIComponent(query);
    // Parallel but limited
    const [launches, astronauts] = await Promise.all([
      ll2(`/launches/?search=${q}&limit=8&mode=list`, { ttl: CONFIG.CACHE_SHORT }).catch(() => ({ results: [] })),
      ll2(`/astronauts/?search=${q}&limit=8`, { ttl: CONFIG.CACHE_MEDIUM }).catch(() => ({ results: [] })),
    ]);
    return {
      launches: launches.results || [],
      astronauts: astronauts.results || [],
      agencies: [], // skip to save quota
    };
  }

  return {
    getUpcomingLaunches,
    getPreviousLaunches,
    getLaunch,
    searchLaunches,
    getEvents,
    getAgencies,
    getAgency,
    getAstronauts,
    getAstronaut,
    searchAstronauts,
    getSpaceStations,
    getExpeditions,
    getDockings,
    getLauncherConfigs,
    getLaunchers,
    getSpacecraft,
    getLocations,
    getPads,
    getISSPosition,
    getPeopleInSpace,
    getStarlinkCount,
    getStationsTLE,
    getAPOD,
    getNeoFeed,
    getSpaceWeather,
    getEPIC,
    searchNASAImages,
    globalSearch,
    updateThrottleUI,
    getRequestCount: () => requestCount,
  };
})();
