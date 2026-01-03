// monitor/static/monitor.js — client-side renderer for static dashboard
(function(){
  const grid = document.getElementById('sitesGrid');
  const lastLoaded = document.getElementById('lastLoaded');
  const refreshBtn = document.getElementById('refreshBtn');
  const autoCheckbox = document.getElementById('autoRefresh');
  let autoTimer = null;

  // keep track of Chart instances so we can destroy/update them (avoid leaks)
  const charts = {};

  async function load(){
    try{
      const res = await fetch('sample-data.json');
      const json = await res.json();
      render(json);
      lastLoaded.textContent = 'Loaded: ' + new Date(json.generated).toLocaleString();
    }catch(e){
      lastLoaded.textContent = 'Failed to load data';
      console.error(e);
    }
  }

  function clearCharts(){
    Object.keys(charts).forEach(id=>{
      try{ if (charts[id].lat) charts[id].lat.destroy(); }catch(e){}
      try{ if (charts[id].status) charts[id].status.destroy(); }catch(e){}
    });
    for (const k in charts) delete charts[k];
  }

  function render(data){
    // Destroy existing Chart instances to prevent continuous growth
    clearCharts();
    grid.innerHTML = '';

    data.sites.forEach(site=>{
      const card = document.createElement('div');
      card.className = 'site-card';
      const latest = site.history[site.history.length-1] || {status:0,lat:0};
      const isUp = latest.status >= 200 && latest.status < 400;
      const badge = isUp ? '<span class="badge-up">UP</span>' : '<span class="badge-down">DOWN</span>';

      // two charts: latency (line) and status (bar)
      card.innerHTML = `
        <div class="site-title"><strong>${escapeHtml(site.name)}</strong><div>${badge}</div></div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:8px">Last: ${latest.status} · ${latest.lat} ms</div>
        <div style="display:flex;gap:8px;align-items:center">
          <div style="flex:1"><canvas id="lat-${site.id}"></canvas></div>
          <div style="width:110px"><canvas id="st-${site.id}"></canvas></div>
        </div>
      `;
      grid.appendChild(card);

      // create charts
      const latCanvas = document.getElementById('lat-'+site.id);
      const stCanvas = document.getElementById('st-'+site.id);
      charts[site.id] = {lat:null, status:null};
      createLatencyChart(site, latCanvas);
      createStatusChart(site, stCanvas);
    });
  }

  function createLatencyChart(site, canvas){
    const labels = site.history.map(h=> new Date(h.t).toLocaleTimeString());
    const data = site.history.map(h=> h.lat);
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#4da3ff';
    const cfg = {
      type: 'line',
      data: { labels, datasets: [{ data, borderColor: accent.trim(), borderWidth: 2, pointRadius: 0, fill: true, backgroundColor: 'rgba(77,163,255,0.06)'}] },
      options: { responsive:true, maintainAspectRatio:false, animation:false, elements:{line:{tension:0.3}}, scales:{x:{display:false}, y:{display:false}}, plugins:{legend:{display:false}, tooltip:{mode:'index',intersect:false}} }
    };
    charts[site.id].lat = new Chart(canvas.getContext('2d'), cfg);
  }

  function createStatusChart(site, canvas){
    const labels = site.history.map(h=> new Date(h.t).toLocaleTimeString());
    const statuses = site.history.map(h=> (h.status>=200 && h.status<400) ? 1 : 0);
    const colors = statuses.map(s=> s ? '#06b58a' : '#d92f2f');
    const cfg = {
      type: 'bar',
      data: { labels, datasets: [{ data: statuses, backgroundColor: colors, barPercentage: 0.9, categoryPercentage: 1.0 }] },
      options: { responsive:true, maintainAspectRatio:false, animation:false, scales:{x:{display:false}, y:{display:false}}, plugins:{legend:{display:false}, tooltip:{callbacks:{label: ctx => ctx.parsed.y ? 'UP' : 'DOWN'}}} }
    };
    charts[site.id].status = new Chart(canvas.getContext('2d'), cfg);
  }

  function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;') }

  // Auto-refresh handling (10s)
  function startAuto(){ if (autoTimer) return; autoTimer = setInterval(load, 10000); }
  function stopAuto(){ if (!autoTimer) return; clearInterval(autoTimer); autoTimer = null; }

  refreshBtn.addEventListener('click', load);
  autoCheckbox.addEventListener('change', ()=> autoCheckbox.checked ? startAuto() : stopAuto());

  // initial load
  load();
})();
