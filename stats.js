(function () {
  'use strict';

  const STORAGE_PREFIX = 'work-timer:stats:';
  const MAX_LOG_ENTRIES = 12;

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function loadToday() {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + todayKey());
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) { /* ignore corrupt storage */ }
    return [];
  }

  function saveToday(entries) {
    try {
      localStorage.setItem(STORAGE_PREFIX + todayKey(), JSON.stringify(entries));
    } catch (e) { /* storage unavailable, keep in-memory only */ }
  }

  const el = {
    count: document.getElementById('statsCount'),
    total: document.getElementById('statsTotal'),
    list: document.getElementById('statsList'),
    empty: document.getElementById('statsEmpty'),
  };

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function fmtClock(ts) {
    const d = new Date(ts);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function fmtTotal(totalMin) {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return h > 0 ? `${h}h${pad(m)}m` : `${m}m`;
  }

  function render() {
    if (!el.count) return; // stats panel not present on this page
    const entries = loadToday();
    const totalMin = entries.reduce((sum, e) => sum + e.minutes, 0);

    el.count.textContent = String(entries.length);
    el.total.textContent = fmtTotal(totalMin);

    el.list.innerHTML = '';
    if (entries.length === 0) {
      el.empty.classList.remove('is-hidden');
      return;
    }
    el.empty.classList.add('is-hidden');

    entries.slice().reverse().slice(0, MAX_LOG_ENTRIES).forEach((entry) => {
      const row = document.createElement('div');
      row.className = 'stats-row';
      const time = document.createElement('span');
      time.className = 'stats-time';
      time.textContent = fmtClock(entry.t);
      const label = document.createElement('span');
      label.className = 'stats-label';
      label.textContent = entry.label;
      const minutes = document.createElement('span');
      minutes.className = 'stats-min';
      minutes.textContent = `${entry.minutes}min`;
      row.append(time, label, minutes);
      el.list.appendChild(row);
    });
  }

  window.WorkTimerStats = {
    recordFocusComplete(minutes, label) {
      const rounded = Math.max(1, Math.round(minutes));
      const entries = loadToday();
      entries.push({ t: Date.now(), minutes: rounded, label: label || 'FOCUS' });
      saveToday(entries);
      render();
    },
  };

  render();
  // Cheap periodic refresh so the panel rolls over to an empty state
  // automatically after local midnight, without needing a page reload.
  setInterval(render, 60 * 1000);
})();
