/**
 * AstraPulse — Main Application
 */

(function () {
  const VIEWS = {
    dashboard: { title: 'Dashboard', subtitle: 'Realtime spaceflight overview', render: () => UI.renderDashboard() },
    launches: { title: 'Launches', subtitle: 'Upcoming & historical orbital launches', render: () => UI.renderLaunches() },
    events: { title: 'Events', subtitle: 'Spacewalks, landings, tests & more', render: () => UI.renderEvents() },
    astronauts: { title: 'Astronauts', subtitle: 'Past, present & future spacefarers', render: () => UI.renderAstronauts() },
    agencies: { title: 'Agencies', subtitle: 'Space agencies & launch providers worldwide', render: () => UI.renderAgencies() },
    stations: { title: 'Space Stations', subtitle: 'Stations, expeditions & dockings', render: () => UI.renderStations() },
    vehicles: { title: 'Vehicles', subtitle: 'Rockets, reusable stages & spacecraft', render: () => UI.renderVehicles() },
    satellites: { title: 'Satellites', subtitle: 'Starlink, stations & orbital objects', render: () => UI.renderSatellites() },
    iss: { title: 'ISS Tracker', subtitle: 'Live position of the International Space Station', render: () => UI.renderISS() },
    asteroids: { title: 'Asteroids', subtitle: 'Near-Earth objects this week (NASA NeoWs)', render: () => UI.renderAsteroids() },
    photos: { title: 'NASA Photos', subtitle: 'Mission photo browser from the NASA Image Library', render: (q) => UI.renderPhotos(q || 'Apollo') },
    search: { title: 'Search', subtitle: 'Find flights, missions, astronauts & more', render: (q) => UI.renderSearch(q) },
  };

  let currentView = 'dashboard';
  let issTimer = null;
  let dashTimer = null;

  function navigate(view, query) {
    if (!VIEWS[view]) view = 'dashboard';
    currentView = view;

    // Update nav
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.view === view);
    });

    // Title
    document.getElementById('view-title').textContent = VIEWS[view].title;
    document.getElementById('view-subtitle').textContent = VIEWS[view].subtitle;

    // Render
    VIEWS[view].render(query);

    // Hash
    history.replaceState(null, '', '#' + view + (query ? '?q=' + encodeURIComponent(query) : ''));

    // ISS auto-update only on ISS or dashboard
    clearInterval(issTimer);
    if (view === 'iss' || view === 'dashboard') {
      issTimer = setInterval(() => {
        if (view === 'iss') UI.updateISSMap();
        // dashboard map is static after first load to save calls
      }, CONFIG.REFRESH_ISS);
    }
  }

  function init() {
    // Nav clicks
    document.querySelectorAll('.nav-item').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(el.dataset.view);
        document.getElementById('sidebar').classList.remove('open');
      });
    });

    // Sidebar toggle (mobile)
    document.getElementById('sidebar-toggle').addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('open');
    });

    // Global search
    const globalInput = document.getElementById('global-search');
    document.getElementById('search-btn').addEventListener('click', () => {
      const q = globalInput.value.trim();
      if (q) navigate('search', q);
    });
    globalInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const q = globalInput.value.trim();
        if (q) navigate('search', q);
      }
    });

    // Refresh
    document.getElementById('refresh-btn').addEventListener('click', () => {
      Cache.clear();
      UI.toast('Cache cleared · refreshing…', 'success');
      navigate(currentView);
      API.updateThrottleUI();
    });

    // Modal
    document.getElementById('modal-close').addEventListener('click', UI.hideModal);
    document.getElementById('modal-backdrop').addEventListener('click', UI.hideModal);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') UI.hideModal();
    });

    // Initial route
    const hash = location.hash.slice(1) || 'dashboard';
    const [view, qs] = hash.split('?');
    const params = new URLSearchParams(qs || '');
    navigate(view || 'dashboard', params.get('q') || '');

    // Periodic dashboard soft refresh
    dashTimer = setInterval(() => {
      if (currentView === 'dashboard') {
        // only re-fetch ISS coords text if present
        API.getISSPosition().then(pos => {
          const el = document.getElementById('iss-coords');
          if (el && pos) el.textContent = `${pos.latitude.toFixed(2)}°, ${pos.longitude.toFixed(2)}°`;
        }).catch(() => {});
      }
      document.getElementById('last-refresh').textContent =
        'Updated ' + new Date().toLocaleTimeString();
    }, CONFIG.REFRESH_DASHBOARD);

    document.getElementById('last-refresh').textContent =
      'Updated ' + new Date().toLocaleTimeString();
    API.updateThrottleUI();

    console.log(`%c${CONFIG.APP_NAME} v${CONFIG.VERSION}`, 'color:#38bdf8;font-weight:bold');
    console.log('Data: Launch Library 2 · Open Notify · WhereTheISS · CelesTrak · NASA APOD');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
