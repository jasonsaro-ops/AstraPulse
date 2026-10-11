/**
 * AstraPulse UI Helpers & View Renderers
 */

const UI = (() => {
  const content = () => document.getElementById('content');
  const modalBody = () => document.getElementById('modal-body');

  function toast(msg, type = '') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = `toast ${type}`;
    setTimeout(() => el.classList.add('hidden'), 3200);
  }

  function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
    });
  }

  function formatRelative(iso) {
    if (!iso) return '';
    const diff = new Date(iso) - Date.now();
    const abs = Math.abs(diff);
    const mins = Math.floor(abs / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    if (diff > 0) {
      if (days > 0) return `in ${days}d ${hours % 24}h`;
      if (hours > 0) return `in ${hours}h ${mins % 60}m`;
      return `in ${mins}m`;
    }
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return `${mins}m ago`;
  }

  function statusBadge(status) {
    if (!status) return '';
    const name = (status.name || status || '').toLowerCase();
    let cls = 'badge-info';
    if (name.includes('go') || name.includes('success')) cls = 'badge-go';
    else if (name.includes('hold') || name.includes('fail')) cls = 'badge-hold';
    else if (name.includes('tbd') || name.includes('to be')) cls = 'badge-tbd';
    else if (name.includes('success')) cls = 'badge-success';
    return `<span class="badge ${cls}">${status.name || status}</span>`;
  }

  function loading() {
    return `<div class="loading-center"><div class="spinner"></div><p>Loading space data…</p></div>`;
  }

  function empty(msg = 'No data available') {
    return `<div class="empty-state"><h3>${msg}</h3><p>Try refreshing or check back later.</p></div>`;
  }

  // ——— View: Dashboard ———
  async function renderDashboard() {
    content().innerHTML = loading();
    try {
      const [upcoming, people, iss, starlink, apod, neo, weather, epic] = await Promise.all([
        API.getUpcomingLaunches(6),
        API.getPeopleInSpace().catch(() => ({ number: '—', people: [] })),
        API.getISSPosition().catch(() => null),
        API.getStarlinkCount().catch(() => ({ count: '—' })),
        API.getAPOD().catch(() => null),
        API.getNeoFeed().catch(() => null),
        API.getSpaceWeather().catch(() => ({ cme: [], flares: [], storms: [] })),
        API.getEPIC().catch(() => null),
      ]);

      const launches = upcoming.results || [];
      const next = launches[0];

      // Flatten Neo objects for this week
      let neoList = [];
      let neoHazard = 0;
      if (neo?.near_earth_objects) {
        Object.values(neo.near_earth_objects).forEach((day) => {
          day.forEach((obj) => {
            neoList.push(obj);
            if (obj.is_potentially_hazardous_asteroid) neoHazard++;
          });
        });
        neoList.sort((a, b) => {
          const da = a.close_approach_data?.[0]?.miss_distance?.kilometers || 1e15;
          const db = b.close_approach_data?.[0]?.miss_distance?.kilometers || 1e15;
          return Number(da) - Number(db);
        });
      }

      // Space weather strip
      const weatherItems = [];
      (weather.flares || []).slice(0, 3).forEach((f) => {
        weatherItems.push({ type: 'Flare', label: f.classType || 'Solar Flare', time: f.beginTime || f.peakTime, cls: 'badge-hold' });
      });
      (weather.cme || []).slice(0, 2).forEach((c) => {
        weatherItems.push({ type: 'CME', label: c.sourceLocation || 'Coronal Mass Ejection', time: c.startTime, cls: 'badge-tbd' });
      });
      (weather.storms || []).slice(0, 2).forEach((s) => {
        const kp = s.allKpIndex?.[s.allKpIndex.length - 1]?.kpIndex;
        weatherItems.push({ type: 'Storm', label: kp != null ? `Kp ${kp}` : 'Geomagnetic Storm', time: s.startTime, cls: 'badge-purple' });
      });

      let html = `
        <div class="hero-stats">
          <div class="stat-card">
            <div class="stat-label">People in Space</div>
            <div class="stat-value accent">${people.number ?? '—'}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Next Launch</div>
            <div class="stat-value" style="font-size:1.05rem">${next ? formatRelative(next.net) : '—'}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Starlink</div>
            <div class="stat-value success">${starlink.count ?? '—'}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">ISS Alt</div>
            <div class="stat-value">${iss?.altitude ? iss.altitude.toFixed(0) + ' km' : '—'}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">NEOs / 7d</div>
            <div class="stat-value warning">${neoList.length || '—'}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Hazardous</div>
            <div class="stat-value" style="color:var(--danger)">${neoHazard}</div>
          </div>
        </div>

        ${weatherItems.length ? `
        <div class="card" style="margin-bottom:1rem">
          <div class="card-body" style="display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;padding:0.75rem 1rem">
            <span class="badge badge-info">☀️ Weather</span>
            ${weatherItems.map((w) => `
              <span class="crew-chip" style="font-size:0.8rem">
                <span class="badge ${w.cls}">${w.type}</span> ${w.label}
              </span>
            `).join('')}
          </div>
        </div>
        ` : ''}

        <div class="section-title" style="margin-bottom:0.75rem">🚀 Upcoming Launches</div>
        <div class="grid grid-3" id="upcoming-grid" style="margin-bottom:1.25rem">
          ${launches.slice(0, 6).map(l => launchCardCompact(l)).join('') || empty('No upcoming launches')}
        </div>

        <div class="grid grid-2" style="margin-bottom:1.25rem">
          <div class="card">
            <div class="card-header" style="padding:0.65rem 1rem">
              <span class="card-title">🌍 ISS</span>
              <span class="text-muted mono" style="font-size:0.75rem" id="iss-coords">—</span>
            </div>
            <div class="card-body" style="padding:0">
              <div id="dashboard-map" style="height:260px"></div>
            </div>
          </div>
          <div class="card">
            <div class="card-header" style="padding:0.65rem 1rem">
              <span class="card-title">👨‍🚀 In Space</span>
            </div>
            <div class="card-body" style="padding:0.85rem 1rem">
              <div class="crew-list">
                ${(people.people || []).map(p =>
                  `<span class="crew-chip">${p.name} <span class="text-muted">· ${p.craft}</span></span>`
                ).join('') || '<span class="text-muted">—</span>'}
              </div>
              ${epic?.imageUrl ? `
              <div style="margin-top:0.85rem;text-align:center">
                <img src="${epic.imageUrl}" alt="EPIC" style="max-width:140px;border-radius:50%;box-shadow:0 0 20px rgba(56,189,248,0.15)" loading="lazy" />
                <p class="text-muted" style="font-size:0.7rem;margin-top:0.35rem">EPIC · ${epic.date || ''}</p>
              </div>` : ''}
            </div>
          </div>
        </div>

        <div class="card" style="margin-bottom:1rem">
          <div class="card-header" style="padding:0.65rem 1rem">
            <span class="card-title">☄️ Closest Asteroids</span>
            <a href="#asteroids" class="text-accent" style="font-size:0.8rem;text-decoration:none">All →</a>
          </div>
          <div class="card-body" style="padding:0">
            <div class="table-wrap" style="border:none;border-radius:0">
              <table>
                <thead><tr><th>Name</th><th>Miss (km)</th><th>Size</th><th></th></tr></thead>
                <tbody>
                  ${neoList.slice(0, 5).map((o) => {
                    const approach = o.close_approach_data?.[0];
                    const miss = approach?.miss_distance?.kilometers
                      ? Number(approach.miss_distance.kilometers).toLocaleString(undefined, { maximumFractionDigits: 0 })
                      : '—';
                    const diam = o.estimated_diameter?.meters;
                    const size = diam
                      ? `${Math.round(diam.estimated_diameter_min)}–${Math.round(diam.estimated_diameter_max)} m`
                      : '—';
                    return `<tr>
                      <td><strong>${o.name}</strong></td>
                      <td class="mono">${miss}</td>
                      <td class="mono" style="font-size:0.8rem">${size}</td>
                      <td>${o.is_potentially_hazardous_asteroid ? '<span class="badge badge-hold">Hazard</span>' : ''}</td>
                    </tr>`;
                  }).join('') || '<tr><td colspan="4" class="text-muted">No NEO data</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;

      if (apod && apod.url) {
        html += `
          <div class="section-title mt-2">🔭 NASA Astronomy Picture of the Day</div>
          <div class="card">
            <div class="card-body" style="display:flex;gap:1.25rem;flex-wrap:wrap">
              ${apod.media_type === 'image'
                ? `<img src="${apod.url}" alt="${apod.title}" style="max-width:320px;border-radius:8px;object-fit:cover" />`
                : ''}
              <div style="flex:1;min-width:200px">
                <h3 style="margin-bottom:0.5rem">${apod.title}</h3>
                <p class="text-muted" style="font-size:0.85rem;line-height:1.55">${(apod.explanation || '').slice(0, 320)}…</p>
                <p class="mt-1 text-muted" style="font-size:0.75rem">${apod.date} · NASA APOD</p>
              </div>
            </div>
          </div>
        `;
      }

      content().innerHTML = html;

      if (iss) {
        initISSMap('dashboard-map', iss);
        document.getElementById('iss-coords').textContent =
          `${iss.latitude.toFixed(2)}°, ${iss.longitude.toFixed(2)}°`;
      }

      document.querySelectorAll('[data-launch-id]').forEach(el => {
        el.addEventListener('click', () => openLaunchDetail(el.dataset.launchId));
      });
    } catch (e) {
      console.error(e);
      content().innerHTML = empty('Failed to load dashboard. API may be rate-limited.');
      toast('Dashboard load error', 'error');
    }
  }

  function launchCard(l) {
    const img = l.image || l.rocket?.configuration?.image_url || '';
    const status = l.status || {};
    const lsp = l.launch_service_provider?.name || l.lsp?.name || '—';
    const pad = l.pad?.name || l.pad?.location?.name || '';
    return `
      <div class="item-card" data-launch-id="${l.id}">
        ${img ? `<img class="item-card-img" src="${img}" alt="" loading="lazy" onerror="this.style.display='none'" />` : '<div class="item-card-img" style="display:flex;align-items:center;justify-content:center;font-size:2.5rem;opacity:0.3">🚀</div>'}
        <div class="item-card-body">
          <div class="item-card-title truncate">${l.name || 'Unnamed'}</div>
          <div class="item-card-meta">
            ${statusBadge(status)}
            <span>${lsp}</span>
          </div>
          <div class="countdown mt-1">${formatRelative(l.net)}</div>
          <div class="text-muted" style="font-size:0.75rem">${formatDate(l.net)}</div>
          ${pad ? `<div class="text-muted" style="font-size:0.75rem">${pad}</div>` : ''}
        </div>
      </div>
    `;
  }

  // Compact card for dashboard — no large image, faster paint
  function launchCardCompact(l) {
    const status = l.status || {};
    const lsp = l.launch_service_provider?.name || l.lsp?.name || '—';
    const rocket = l.rocket?.configuration?.name || '';
    return `
      <div class="item-card" data-launch-id="${l.id}" style="min-height:0">
        <div class="item-card-body" style="padding:0.85rem 1rem">
          <div class="item-card-title" style="font-size:0.9rem;margin-bottom:0.25rem">${l.name || 'Unnamed'}</div>
          <div class="item-card-meta" style="margin-bottom:0.35rem">
            ${statusBadge(status)}
            <span class="text-muted">${lsp}</span>
          </div>
          <div class="countdown" style="font-size:0.95rem">${formatRelative(l.net)}</div>
          <div class="text-muted" style="font-size:0.72rem">${formatDate(l.net)}${rocket ? ' · ' + rocket : ''}</div>
        </div>
      </div>
    `;
  }

  // ——— View: Launches ———
  async function renderLaunches(tab = 'upcoming') {
    content().innerHTML = `
      <div class="tabs">
        <button class="tab ${tab === 'upcoming' ? 'active' : ''}" data-tab="upcoming">Upcoming</button>
        <button class="tab ${tab === 'previous' ? 'active' : ''}" data-tab="previous">Previous</button>
      </div>
      <div id="launches-content">${loading()}</div>
    `;
    document.querySelectorAll('.tab').forEach(t => {
      t.addEventListener('click', () => renderLaunches(t.dataset.tab));
    });

    try {
      const data = tab === 'upcoming'
        ? await API.getUpcomingLaunches(CONFIG.PAGE_SIZE)
        : await API.getPreviousLaunches(CONFIG.PAGE_SIZE);
      const results = data.results || [];
      const el = document.getElementById('launches-content');
      if (!results.length) {
        el.innerHTML = empty();
        return;
      }
      el.innerHTML = `<div class="grid grid-3">${results.map(l => launchCard(l)).join('')}</div>`;
      el.querySelectorAll('[data-launch-id]').forEach(c => {
        c.addEventListener('click', () => openLaunchDetail(c.dataset.launchId));
      });
    } catch (e) {
      document.getElementById('launches-content').innerHTML = empty('Could not load launches');
    }
  }

  async function openLaunchDetail(id) {
    showModal(loading());
    try {
      const l = await API.getLaunch(id);
      const mission = l.mission || {};
      const rocket = l.rocket?.configuration || {};
      const lsp = l.launch_service_provider || {};
      const pad = l.pad || {};
      modalBody().innerHTML = `
        <h2 style="margin-bottom:0.5rem;padding-right:2rem">${l.name}</h2>
        <div class="mb-2">${statusBadge(l.status)} <span class="text-muted" style="margin-left:0.5rem">${formatDate(l.net)}</span></div>
        ${l.image ? `<img src="${l.image}" alt="" style="width:100%;max-height:240px;object-fit:cover;border-radius:8px;margin-bottom:1rem" />` : ''}
        <dl class="detail-grid">
          <dt>Provider</dt><dd>${lsp.name || '—'}</dd>
          <dt>Rocket</dt><dd>${rocket.full_name || rocket.name || '—'}</dd>
          <dt>Pad</dt><dd>${pad.name || '—'} ${pad.location ? '· ' + pad.location.name : ''}</dd>
          <dt>Mission</dt><dd>${mission.name || '—'}</dd>
          <dt>Type</dt><dd>${mission.type || '—'}</dd>
          <dt>Orbit</dt><dd>${mission.orbit?.name || '—'}</dd>
          <dt>Window</dt><dd>${formatDate(l.window_start)} → ${formatDate(l.window_end)}</dd>
          ${l.probability != null ? `<dt>Probability</dt><dd>${l.probability}%</dd>` : ''}
        </dl>
        ${mission.description ? `<p class="mt-2" style="font-size:0.9rem;line-height:1.55;color:var(--text-secondary)">${mission.description}</p>` : ''}
        ${l.vid_urls?.length ? `<div class="mt-2"><a class="btn btn-primary" href="${l.vid_urls[0].url}" target="_blank" rel="noopener">Watch Webcast</a></div>` : ''}
      `;
    } catch (e) {
      modalBody().innerHTML = empty('Could not load launch details');
    }
  }

  // ——— View: Events ———
  async function renderEvents() {
    content().innerHTML = loading();
    try {
      const data = await API.getEvents(true, 16);
      const results = data.results || [];
      content().innerHTML = `
        <div class="section-title">Upcoming & Recent Events</div>
        <div class="grid grid-2">
          ${results.map(e => `
            <div class="card">
              <div class="card-body">
                <div class="flex-between mb-2">
                  <strong>${e.name}</strong>
                  ${statusBadge(e.type?.name || e.type)}
                </div>
                <p class="text-muted" style="font-size:0.85rem">${formatDate(e.date || e.net)}</p>
                ${e.description ? `<p class="mt-1" style="font-size:0.85rem;color:var(--text-secondary)">${e.description.slice(0, 180)}${e.description.length > 180 ? '…' : ''}</p>` : ''}
                ${e.location ? `<p class="mt-1 text-muted" style="font-size:0.8rem">📍 ${e.location}</p>` : ''}
              </div>
            </div>
          `).join('') || empty()}
        </div>
      `;
    } catch {
      content().innerHTML = empty('Could not load events');
    }
  }

  // ——— View: Astronauts ———
  async function renderAstronauts() {
    content().innerHTML = loading();
    try {
      const data = await API.getAstronauts(24);
      const results = data.results || [];
      content().innerHTML = `
        <div class="section-title">Astronauts (most flown)</div>
        <div class="grid grid-4">
          ${results.map(a => `
            <div class="item-card" data-astro-id="${a.id}">
              ${a.profile_image
                ? `<img class="item-card-img" src="${a.profile_image}" alt="${a.name}" loading="lazy" style="object-position:top" onerror="this.style.display='none'" />`
                : '<div class="item-card-img" style="display:flex;align-items:center;justify-content:center;font-size:2.5rem;opacity:0.3">👨‍🚀</div>'}
              <div class="item-card-body">
                <div class="item-card-title">${a.name}</div>
                <div class="item-card-meta">
                  <span class="badge badge-info">${a.nationality || a.status?.name || ''}</span>
                  <span>${a.flights_count ?? a.flights?.length ?? 0} flights</span>
                </div>
                <div class="text-muted" style="font-size:0.75rem">${a.agency?.name || ''}</div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
      document.querySelectorAll('[data-astro-id]').forEach(el => {
        el.addEventListener('click', () => openAstronautDetail(el.dataset.astroId));
      });
    } catch {
      content().innerHTML = empty('Could not load astronauts');
    }
  }

  async function openAstronautDetail(id) {
    showModal(loading());
    try {
      const a = await API.getAstronaut(id);
      modalBody().innerHTML = `
        <div style="display:flex;gap:1.25rem;flex-wrap:wrap">
          ${a.profile_image ? `<img src="${a.profile_image}" alt="" style="width:140px;height:160px;object-fit:cover;border-radius:10px" />` : ''}
          <div style="flex:1">
            <h2>${a.name}</h2>
            <p class="text-muted">${a.nationality || ''} · ${a.agency?.name || ''}</p>
            <div class="mt-1">${statusBadge(a.status)}</div>
          </div>
        </div>
        <dl class="detail-grid mt-2">
          <dt>Flights</dt><dd>${a.flights_count ?? '—'}</dd>
          <dt>Spacewalks</dt><dd>${a.spacewalks_count ?? '—'}</dd>
          <dt>Date of birth</dt><dd>${a.date_of_birth || '—'}</dd>
          <dt>Type</dt><dd>${a.type?.name || '—'}</dd>
        </dl>
        ${a.bio ? `<p class="mt-2" style="font-size:0.9rem;line-height:1.55;color:var(--text-secondary)">${a.bio.slice(0, 600)}${a.bio.length > 600 ? '…' : ''}</p>` : ''}
      `;
    } catch {
      modalBody().innerHTML = empty('Could not load astronaut');
    }
  }

  // ——— View: Agencies ———
  async function renderAgencies() {
    content().innerHTML = loading();
    try {
      const data = await API.getAgencies(30);
      const results = data.results || [];
      content().innerHTML = `
        <div class="section-title">Space Agencies & Providers</div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Country</th>
                <th>Launches</th>
                <th>Success</th>
              </tr>
            </thead>
            <tbody>
              ${results.map(a => `
                <tr style="cursor:pointer" data-agency-id="${a.id}">
                  <td><strong>${a.name}</strong> ${a.abbrev ? `<span class="text-muted">(${a.abbrev})</span>` : ''}</td>
                  <td>${a.type || '—'}</td>
                  <td>${a.country_code || '—'}</td>
                  <td class="mono">${a.total_launch_count ?? '—'}</td>
                  <td class="mono">${a.successful_launches ?? '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch {
      content().innerHTML = empty('Could not load agencies');
    }
  }

  // ——— View: Stations ———
  async function renderStations() {
    content().innerHTML = loading();
    try {
      const [stations, expeditions, dockings] = await Promise.all([
        API.getSpaceStations(),
        API.getExpeditions(8).catch(() => ({ results: [] })),
        API.getDockings(8).catch(() => ({ results: [] })),
      ]);
      const list = stations.results || [];
      content().innerHTML = `
        <div class="section-title">Space Stations</div>
        <div class="grid grid-2 mb-2">
          ${list.map(s => `
            <div class="card">
              <div class="card-body">
                <div class="flex-between">
                  <strong>${s.name}</strong>
                  ${statusBadge(s.status)}
                </div>
                <p class="text-muted mt-1" style="font-size:0.85rem">${s.owners?.map(o => o.name).join(', ') || s.description?.slice(0, 120) || ''}</p>
                <div class="mt-1 text-muted" style="font-size:0.8rem">
                  Founded: ${s.founded || '—'} · Orbit: ${s.orbit || '—'}
                </div>
              </div>
            </div>
          `).join('') || empty()}
        </div>
        <div class="section-title">Recent Expeditions</div>
        <div class="grid grid-2 mb-2">
          ${(expeditions.results || []).map(e => `
            <div class="card"><div class="card-body">
              <strong>${e.name}</strong>
              <p class="text-muted" style="font-size:0.85rem">${e.space_station?.name || ''} · ${formatDate(e.start)}</p>
            </div></div>
          `).join('') || '<p class="text-muted">No expedition data</p>'}
        </div>
        <div class="section-title">Recent Dockings</div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Spacecraft</th><th>Station</th><th>Docking</th><th>Location</th></tr></thead>
            <tbody>
              ${(dockings.results || []).map(d => `
                <tr>
                  <td>${d.flight_vehicle?.spacecraft?.name || d.docking_location?.name || '—'}</td>
                  <td>${d.space_station?.name || '—'}</td>
                  <td>${formatDate(d.docking)}</td>
                  <td>${d.docking_location?.name || '—'}</td>
                </tr>
              `).join('') || '<tr><td colspan="4">No data</td></tr>'}
            </tbody>
          </table>
        </div>
      `;
    } catch {
      content().innerHTML = empty('Could not load stations data');
    }
  }

  // ——— View: Vehicles ———
  async function renderVehicles() {
    content().innerHTML = loading();
    try {
      const [configs, launchers] = await Promise.all([
        API.getLauncherConfigs(16),
        API.getLaunchers(12).catch(() => ({ results: [] })),
      ]);
      content().innerHTML = `
        <div class="section-title">Launch Vehicles</div>
        <div class="grid grid-3 mb-2">
          ${(configs.results || []).map(v => `
            <div class="item-card">
              ${v.image_url ? `<img class="item-card-img" src="${v.image_url}" alt="" loading="lazy" onerror="this.style.display='none'" />` : '<div class="item-card-img" style="display:flex;align-items:center;justify-content:center;opacity:0.3;font-size:2rem">🛰️</div>'}
              <div class="item-card-body">
                <div class="item-card-title">${v.full_name || v.name}</div>
                <div class="item-card-meta">
                  <span>${v.family || ''}</span>
                  <span class="badge badge-info">${v.successful_launches ?? 0} success</span>
                </div>
                <div class="text-muted" style="font-size:0.75rem">${v.manufacturer?.name || ''}</div>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="section-title">Reusable First Stages</div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Serial</th><th>Config</th><th>Flights</th><th>Status</th><th>Last Launch</th></tr></thead>
            <tbody>
              ${(launchers.results || []).map(l => `
                <tr>
                  <td class="mono"><strong>${l.serial_number}</strong></td>
                  <td>${l.launcher_config?.name || '—'}</td>
                  <td class="mono">${l.flights ?? '—'}</td>
                  <td>${statusBadge(l.status)}</td>
                  <td>${formatDate(l.last_launch_date)}</td>
                </tr>
              `).join('') || '<tr><td colspan="5">No data</td></tr>'}
            </tbody>
          </table>
        </div>
      `;
    } catch {
      content().innerHTML = empty('Could not load vehicles');
    }
  }

  // ——— View: Satellites ———
  async function renderSatellites() {
    content().innerHTML = loading();
    try {
      const [starlink, stations] = await Promise.all([
        API.getStarlinkCount(),
        API.getStationsTLE(),
      ]);
      const stationList = Array.isArray(stations) ? stations : [];
      content().innerHTML = `
        <div class="hero-stats">
          <div class="stat-card">
            <div class="stat-label">Starlink Constellation</div>
            <div class="stat-value success">${starlink.count ?? '—'}</div>
            <div class="text-muted" style="font-size:0.75rem">Active objects (CelesTrak)</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Tracked Stations</div>
            <div class="stat-value accent">${stationList.length}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Data Source</div>
            <div class="stat-value" style="font-size:1rem">CelesTrak GP</div>
          </div>
        </div>
        <div class="section-title">Space Stations & Notable Objects</div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>NORAD ID</th>
                <th>Inclination</th>
                <th>Mean Motion</th>
                <th>Epoch</th>
              </tr>
            </thead>
            <tbody>
              ${stationList.slice(0, 40).map(s => `
                <tr>
                  <td><strong>${s.OBJECT_NAME || s.name || '—'}</strong></td>
                  <td class="mono">${s.NORAD_CAT_ID || s.norad_id || '—'}</td>
                  <td class="mono">${s.INCLINATION != null ? Number(s.INCLINATION).toFixed(2) + '°' : '—'}</td>
                  <td class="mono">${s.MEAN_MOTION != null ? Number(s.MEAN_MOTION).toFixed(4) : '—'}</td>
                  <td class="mono" style="font-size:0.8rem">${s.EPOCH || '—'}</td>
                </tr>
              `).join('') || '<tr><td colspan="5">Could not load TLE data</td></tr>'}
            </tbody>
          </table>
        </div>
        <p class="text-muted mt-2" style="font-size:0.8rem">
          Starlink and debris catalogs are large. Full orbital elements are sourced from CelesTrak.
          Space junk / debris groups can be added via additional CelesTrak GP endpoints.
          Respect CelesTrak usage policy when expanding.
        </p>
      `;
    } catch (e) {
      content().innerHTML = empty('Could not load satellite data');
    }
  }

  // ——— View: ISS Tracker ———
  let issMap = null;
  let issMarker = null;
  let issTrail = [];

  async function renderISS() {
    content().innerHTML = `
      <div class="hero-stats" id="iss-stats">
        <div class="stat-card"><div class="stat-label">Latitude</div><div class="stat-value mono" id="iss-lat">—</div></div>
        <div class="stat-card"><div class="stat-label">Longitude</div><div class="stat-value mono" id="iss-lon">—</div></div>
        <div class="stat-card"><div class="stat-label">Altitude</div><div class="stat-value mono" id="iss-alt">—</div></div>
        <div class="stat-card"><div class="stat-label">Velocity</div><div class="stat-value mono" id="iss-vel">—</div></div>
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title">ISS Realtime Tracker</span>
          <span class="text-muted" id="iss-vis">—</span>
        </div>
        <div class="card-body" style="padding:0">
          <div id="iss-map"></div>
        </div>
      </div>
      <p class="text-muted mt-2" style="font-size:0.8rem">Position updates every 30 seconds. Trail shows recent path.</p>
    `;
    await updateISSMap();
  }

  function initISSMap(containerId, pos) {
    const el = document.getElementById(containerId);
    if (!el) return null;
    const map = L.map(containerId, {
      zoomControl: true,
      attributionControl: true,
    }).setView([pos.latitude, pos.longitude], 3);

    // Free tiles — no API key required (Esri World Dark Gray)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri',
      maxZoom: 16,
    }).addTo(map);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
      attribution: '',
      maxZoom: 16,
      opacity: 0.85,
    }).addTo(map);

    const icon = L.divIcon({
      className: '',
      html: `<div style="font-size:22px;filter:drop-shadow(0 0 6px #38bdf8)">🛰️</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    const marker = L.marker([pos.latitude, pos.longitude], { icon }).addTo(map);
    return { map, marker };
  }

  async function updateISSMap() {
    try {
      const pos = await API.getISSPosition();
      document.getElementById('iss-lat').textContent = pos.latitude.toFixed(4) + '°';
      document.getElementById('iss-lon').textContent = pos.longitude.toFixed(4) + '°';
      document.getElementById('iss-alt').textContent = pos.altitude != null ? pos.altitude.toFixed(1) + ' km' : '—';
      document.getElementById('iss-vel').textContent = pos.velocity != null ? pos.velocity.toFixed(0) + ' km/h' : '—';
      const vis = document.getElementById('iss-vis');
      if (vis) vis.textContent = pos.visibility ? `Visibility: ${pos.visibility}` : '';

      if (!issMap) {
        const res = initISSMap('iss-map', pos);
        if (res) {
          issMap = res.map;
          issMarker = res.marker;
        }
      } else {
        issMarker.setLatLng([pos.latitude, pos.longitude]);
        issTrail.push([pos.latitude, pos.longitude]);
        if (issTrail.length > 40) issTrail.shift();
        // redraw trail
        if (window._issPolyline) issMap.removeLayer(window._issPolyline);
        window._issPolyline = L.polyline(issTrail, {
          color: '#38bdf8',
          weight: 2,
          opacity: 0.7,
        }).addTo(issMap);
      }
    } catch (e) {
      console.warn('ISS update failed', e);
    }
  }

  // ——— View: Search ———
  async function renderSearch(initialQuery = '') {
    content().innerHTML = `
      <div class="search-box" style="max-width:480px;margin-bottom:1.5rem;padding:0.5rem 1rem">
        <input type="search" id="page-search" placeholder="Search launches, astronauts…" value="${initialQuery}" style="width:100%;background:transparent;border:none;color:var(--text-primary);font-size:1rem;outline:none" />
      </div>
      <div id="search-results">${initialQuery ? loading() : '<div class="empty-state"><h3>Search the cosmos</h3><p>Enter a mission, rocket, astronaut or agency name.</p></div>'}</div>
    `;
    const input = document.getElementById('page-search');
    input.focus();
    let debounce;
    const run = async (q) => {
      if (!q || q.length < 2) {
        document.getElementById('search-results').innerHTML = '<div class="empty-state"><h3>Type at least 2 characters</h3></div>';
        return;
      }
      document.getElementById('search-results').innerHTML = loading();
      try {
        const res = await API.globalSearch(q);
        let html = '';
        if (res.launches.length) {
          html += `<div class="section-title">Launches</div><div class="grid grid-3 mb-2">${res.launches.map(l => launchCard(l)).join('')}</div>`;
        }
        if (res.astronauts.length) {
          html += `<div class="section-title">Astronauts</div><div class="grid grid-4">${res.astronauts.map(a => `
            <div class="item-card" data-astro-id="${a.id}">
              <div class="item-card-body">
                <div class="item-card-title">${a.name}</div>
                <div class="item-card-meta"><span>${a.nationality || ''}</span><span>${a.flights_count ?? 0} flights</span></div>
              </div>
            </div>
          `).join('')}</div>`;
        }
        if (!html) html = empty('No results found');
        document.getElementById('search-results').innerHTML = html;
        document.querySelectorAll('[data-launch-id]').forEach(el => {
          el.addEventListener('click', () => openLaunchDetail(el.dataset.launchId));
        });
        document.querySelectorAll('[data-astro-id]').forEach(el => {
          el.addEventListener('click', () => openAstronautDetail(el.dataset.astroId));
        });
      } catch {
        document.getElementById('search-results').innerHTML = empty('Search failed');
      }
    };
    input.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => run(input.value.trim()), 400);
    });
    if (initialQuery) run(initialQuery);
  }

  // ——— View: Asteroids (NeoWs) ———
  async function renderAsteroids() {
    content().innerHTML = loading();
    try {
      const neo = await API.getNeoFeed();
      let list = [];
      if (neo?.near_earth_objects) {
        Object.entries(neo.near_earth_objects).forEach(([date, objs]) => {
          objs.forEach((o) => list.push({ ...o, approachDate: date }));
        });
        list.sort((a, b) => {
          const da = a.close_approach_data?.[0]?.miss_distance?.kilometers || 1e15;
          const db = b.close_approach_data?.[0]?.miss_distance?.kilometers || 1e15;
          return Number(da) - Number(db);
        });
      }
      const hazardous = list.filter((o) => o.is_potentially_hazardous_asteroid).length;
      content().innerHTML = `
        <div class="hero-stats">
          <div class="stat-card">
            <div class="stat-label">NEOs (7 days)</div>
            <div class="stat-value accent">${list.length}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Potentially Hazardous</div>
            <div class="stat-value" style="color:var(--danger)">${hazardous}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Data Source</div>
            <div class="stat-value" style="font-size:1rem">NASA NeoWs</div>
          </div>
        </div>
        <div class="section-title">Asteroids Near Earth This Week</div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Approach</th>
                <th>Miss Distance</th>
                <th>Relative Velocity</th>
                <th>Est. Diameter</th>
                <th>Hazard</th>
              </tr>
            </thead>
            <tbody>
              ${list.map((o) => {
                const approach = o.close_approach_data?.[0];
                const missKm = approach?.miss_distance?.kilometers
                  ? Number(approach.miss_distance.kilometers).toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' km'
                  : '—';
                const missLd = approach?.miss_distance?.lunar
                  ? Number(approach.miss_distance.lunar).toFixed(2) + ' LD'
                  : '';
                const vel = approach?.relative_velocity?.kilometers_per_hour
                  ? Number(approach.relative_velocity.kilometers_per_hour).toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' km/h'
                  : '—';
                const diam = o.estimated_diameter?.meters;
                const size = diam
                  ? `${Math.round(diam.estimated_diameter_min)}–${Math.round(diam.estimated_diameter_max)} m`
                  : '—';
                return `<tr>
                  <td><strong>${o.name}</strong><br><span class="text-muted mono" style="font-size:0.75rem">${o.neo_reference_id || ''}</span></td>
                  <td>${approach?.close_approach_date_full || approach?.close_approach_date || o.approachDate || '—'}</td>
                  <td class="mono">${missKm}<br><span class="text-muted" style="font-size:0.75rem">${missLd}</span></td>
                  <td class="mono">${vel}</td>
                  <td class="mono">${size}</td>
                  <td>${o.is_potentially_hazardous_asteroid ? '<span class="badge badge-hold">Yes</span>' : '<span class="badge badge-go">No</span>'}</td>
                </tr>`;
              }).join('') || '<tr><td colspan="6">No data available</td></tr>'}
            </tbody>
          </table>
        </div>
        <p class="text-muted mt-2" style="font-size:0.8rem">LD = Lunar Distance (~384,400 km). Data from NASA JPL NeoWs.</p>
      `;
    } catch {
      content().innerHTML = empty('Could not load Near-Earth Object data');
    }
  }

  // ——— View: NASA Photos (Image Library) ———
  async function renderPhotos(initialQuery = 'Apollo') {
    content().innerHTML = `
      <div class="filters" style="margin-bottom:1rem">
        <div class="search-box" style="flex:1;max-width:420px;padding:0.45rem 1rem">
          <input type="search" id="photo-search" placeholder="Search NASA images (e.g. Artemis, Hubble, Mars)…" value="${initialQuery}" style="width:100%;background:transparent;border:none;color:var(--text-primary);outline:none;font-size:0.95rem" />
        </div>
        <button class="chip" data-q="Apollo">Apollo</button>
        <button class="chip" data-q="Artemis">Artemis</button>
        <button class="chip" data-q="ISS">ISS</button>
        <button class="chip" data-q="Hubble">Hubble</button>
        <button class="chip" data-q="Mars">Mars</button>
        <button class="chip" data-q="James Webb">JWST</button>
        <button class="chip" data-q="Space Shuttle">Shuttle</button>
      </div>
      <div id="photo-results">${loading()}</div>
    `;

    const run = async (q) => {
      const el = document.getElementById('photo-results');
      if (!q || q.length < 2) {
        el.innerHTML = empty('Enter a search term');
        return;
      }
      el.innerHTML = loading();
      try {
        const res = await API.searchNASAImages(q);
        if (!res.items.length) {
          el.innerHTML = empty('No images found');
          return;
        }
        el.innerHTML = `
          <p class="text-muted mb-2" style="font-size:0.85rem">${res.total.toLocaleString()} results for “${q}”</p>
          <div class="grid grid-4">
            ${res.items.map((img) => `
              <div class="item-card" data-photo-title="${(img.title || '').replace(/"/g, '&quot;')}" data-photo-desc="${(img.description || '').slice(0, 400).replace(/"/g, '&quot;')}" data-photo-src="${img.thumb || ''}">
                ${img.thumb
                  ? `<img class="item-card-img" src="${img.thumb}" alt="${img.title || ''}" loading="lazy" style="height:160px;object-fit:cover" onerror="this.style.display='none'" />`
                  : '<div class="item-card-img" style="display:flex;align-items:center;justify-content:center;opacity:0.3">📷</div>'}
                <div class="item-card-body">
                  <div class="item-card-title truncate">${img.title || 'Untitled'}</div>
                  <div class="item-card-meta">
                    <span class="text-muted" style="font-size:0.75rem">${img.date ? img.date.slice(0, 10) : ''} ${img.center ? '· ' + img.center : ''}</span>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        `;
        el.querySelectorAll('[data-photo-title]').forEach((card) => {
          card.addEventListener('click', () => {
            showModal(`
              <h2 style="margin-bottom:0.75rem;padding-right:2rem">${card.dataset.photoTitle}</h2>
              ${card.dataset.photoSrc ? `<img src="${card.dataset.photoSrc}" alt="" style="width:100%;max-height:360px;object-fit:contain;border-radius:8px;margin-bottom:1rem;background:#000" />` : ''}
              <p style="font-size:0.9rem;line-height:1.55;color:var(--text-secondary)">${card.dataset.photoDesc || 'No description'}</p>
            `);
          });
        });
      } catch {
        el.innerHTML = empty('Image search failed');
      }
    };

    document.getElementById('photo-search').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') run(e.target.value.trim());
    });
    document.querySelectorAll('.chip[data-q]').forEach((chip) => {
      chip.addEventListener('click', () => {
        document.getElementById('photo-search').value = chip.dataset.q;
        run(chip.dataset.q);
      });
    });
    run(initialQuery);
  }

  // Modal helpers
  function showModal(html) {
    document.getElementById('modal').classList.remove('hidden');
    modalBody().innerHTML = html;
  }
  function hideModal() {
    document.getElementById('modal').classList.add('hidden');
  }

  return {
    toast,
    formatDate,
    formatRelative,
    statusBadge,
    loading,
    empty,
    renderDashboard,
    renderLaunches,
    renderEvents,
    renderAstronauts,
    renderAgencies,
    renderStations,
    renderVehicles,
    renderSatellites,
    renderISS,
    updateISSMap,
    renderSearch,
    renderAsteroids,
    renderPhotos,
    showModal,
    hideModal,
    openLaunchDetail,
    openAstronautDetail,
  };
})();
