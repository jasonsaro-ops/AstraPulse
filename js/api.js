/**
 * AstraPulse API Layer
 * 1) Prefer static JSON from /data/ (written by GitHub Actions — fast, no rate limits)
 * 2) Fall back to live APIs with localStorage cache
 */

const API = (() => {
  let requestCount = 0;
  let windowStart = Date.now();

  function resetWindowIfNeeded() {
    if (Date.now() - windowStart > 60 * 60 * 1000) {
      requestCount = 0;
      windowStart = Date.now();
    }
  }

  function canRequest() {
    resetWindowIfNeeded();
    return requestCount < CONFIG.LL2_LIMIT - 1;
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

  // Load pre-built JSON from repo (GitHub Actions). Fast same-origin.
  async function staticData(filename) {
    try {
      const res = await fetch(`data/${filename}`, { cache: 'no-cache' });
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
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
    const s = await staticData('launches_upcoming.json');
    if (s?.results) return s;
    return ll2(`/launches/upcoming/?limit=${limit}&mode=detailed`, {
      ttl: CONFIG.CACHE_SHORT,
    });
  }

  async function getPreviousLaunches(limit = 12, offset = 0) {
    if (offset === 0) {
      const s = await staticData('launches_previous.json');
      if (s?.results) return s;
    }
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
    if (upcoming) {
      const s = await staticData('events.json');
      if (s?.results) return s;
    }
    const path = upcoming ? '/events/upcoming/' : '/events/';
    return ll2(`${path}?limit=${limit}`, { ttl: CONFIG.CACHE_MEDIUM });
  }

  async function getAgencies(limit = 30, offset = 0) {
    if (offset === 0) {
      const s = await staticData('agencies.json');
      if (s?.results) return s;
    }
    return ll2(`/agencies/?limit=${limit}&offset=${offset}&ordering=-total_launch_count`, {
      ttl: CONFIG.CACHE_LONG,
    });
  }

  async function getAgency(id) {
    return ll2(`/agencies/${id}/`, { ttl: CONFIG.CACHE_LONG });
  }

  async function getAstronauts(limit = 24, offset = 0, status = null) {
    if (offset === 0 && !status) {
      const s = await staticData('astronauts.json');
      if (s?.results) return s;
    }
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
    const s = await staticData('stations.json');
    if (s?.results) return s;
    return ll2('/space_stations/?limit=20', { ttl: CONFIG.CACHE_LONG });
  }

  async function getExpeditions(limit = 12) {
    const s = await staticData('expeditions.json');
    if (s?.results) return s;
    return ll2(`/expeditions/?limit=${limit}&ordering=-start`, {
      ttl: CONFIG.CACHE_MEDIUM,
    });
  }

  async function getDockings(limit = 12) {
    const s = await staticData('dockings.json');
    if (s?.results) return s;
    return ll2(`/docking_events/?limit=${limit}&ordering=-docking`, {
      ttl: CONFIG.CACHE_MEDIUM,
    });
  }

  async function getLauncherConfigs(limit = 24) {
    const s = await staticData('vehicles.json');
    if (s?.results) return s;
    return ll2(`/launcher_configurations/?limit=${limit}&ordering=-successful_launches`, {
      ttl: CONFIG.CACHE_LONG,
    });
  }

  async function getLaunchers(limit = 20) {
    const s = await staticData('launchers.json');
    if (s?.results) return s;
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

    // Live first for near-realtime (lightweight)
    try {
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
    } catch { /* fall through */ }

    // Static snapshot from Actions
    const s = await staticData('iss.json');
    if (s) {
      if (s.latitude != null) {
        const result = {
          latitude: s.latitude,
          longitude: s.longitude,
          altitude: s.altitude,
          velocity: s.velocity,
          visibility: s.visibility,
          timestamp: s.timestamp,
          source: 'static',
        };
        Cache.set(cacheKey, result, 25_000);
        return result;
      }
      if (s.iss_position) {
        const result = {
          latitude: parseFloat(s.iss_position.latitude),
          longitude: parseFloat(s.iss_position.longitude),
          altitude: null, velocity: null, visibility: null,
          timestamp: s.timestamp, source: 'static',
        };
        Cache.set(cacheKey, result, 25_000);
        return result;
      }
    }

    try {
      const data = await fetchJSON(CONFIG.ISS_NOW);
      const result = {
        latitude: parseFloat(data.iss_position.latitude),
        longitude: parseFloat(data.iss_position.longitude),
        altitude: null, velocity: null, visibility: null,
        timestamp: data.timestamp, source: 'open-notify',
      };
      Cache.set(cacheKey, result, 25_000);
      return result;
    } catch {
      return null;
    }
  }

  async function getPeopleInSpace() {
    const s = await staticData('people.json');
    if (s?.people) return s;
    const cacheKey = 'people_space';
    const cached = Cache.get(cacheKey);
    if (cached) return cached;
    const data = await fetchJSON(CONFIG.PEOPLE_IN_SPACE);
    Cache.set(cacheKey, data, CONFIG.CACHE_MEDIUM);
    return data;
  }

  async function getStarlinkCount() {
    // CelesTrak returns 403 to browsers. Only use data/ from GitHub Actions.
    const s = await staticData('starlink.json');
    if (s && s.count != null) return s;
    const cached = Cache.get('starlink_meta');
    if (cached) return cached;
    return { count: null, updated: null };
  }

  async function getStationsTLE() {
    // Same: never call CelesTrak from the browser
    const s = await staticData('stations_tle.json');
    if (Array.isArray(s) && s.length) return s;
    const cached = Cache.get('stations_tle');
    if (cached) return cached;
    return [];
  }

  async function getAPOD() {
    const s = await staticData('apod.json');
    if (s && s.url) return s;
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
    const s = await staticData('neo.json');
    if (s?.near_earth_objects) return s;
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
    const [cmeS, flrS, gstS] = await Promise.all([
      staticData('donki_cme.json'),
      staticData('donki_flr.json'),
      staticData('donki_gst.json'),
    ]);
    if (cmeS || flrS || gstS) {
      return {
        cme: Array.isArray(cmeS) ? cmeS.slice(-8).reverse() : [],
        flares: Array.isArray(flrS) ? flrS.slice(-8).reverse() : [],
        storms: Array.isArray(gstS) ? gstS.slice(-5).reverse() : [],
      };
    }
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
    const listS = await staticData('epic.json');
    const list = Array.isArray(listS) ? listS : null;
    if (list && list.length) {
      const latest = list[list.length - 1];
      const datePart = (latest.date || '').slice(0, 10).replace(/-/g, '/');
      const name = latest.image || latest.identifier;
      const imageUrl = datePart && name
        ? `${CONFIG.NASA_EPIC_ARCHIVE}/${datePart}/png/${name}.png`
        : null;
      return { ...latest, imageUrl, all: list.slice(-6).reverse() };
    }
    const cacheKey = 'nasa_epic';
    const cached = Cache.get(cacheKey);
    if (cached) return cached;
    try {
      const live = await fetchJSON(`${CONFIG.NASA_EPIC}?api_key=${CONFIG.NASA_KEY}`);
      if (!Array.isArray(live) || !live.length) return null;
      const latest = live[live.length - 1];
      const datePart = (latest.date || '').slice(0, 10).replace(/-/g, '/');
      const name = latest.image || latest.identifier;
      const imageUrl = datePart && name
        ? `${CONFIG.NASA_EPIC_ARCHIVE}/${datePart}/png/${name}.png`
        : null;
      const result = { ...latest, imageUrl, all: live.slice(-6).reverse() };
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
