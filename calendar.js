(function () {
  'use strict';

  const STATS_PREFIX = 'work-timer:stats:';

  const el = {
    grid: document.getElementById('calendarGrid'),
    monthLabel: document.getElementById('calMonthLabel'),
    prevBtn: document.getElementById('calPrevBtn'),
    nextBtn: document.getElementById('calNextBtn'),
  };

  if (!el.grid) return; // calendar panel not present on this page

  const MONTH_LABEL = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  const initialToday = new Date();
  let viewYear = initialToday.getFullYear();
  let viewMonth = initialToday.getMonth(); // 0-11

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function dateKey(y, m, d) {
    return `${y}-${pad(m + 1)}-${pad(d)}`;
  }

  function loadDay(y, m, d) {
    try {
      const raw = localStorage.getItem(STATS_PREFIX + dateKey(y, m, d));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) { /* ignore corrupt storage */ }
    return [];
  }

  function activityLevel(totalMinutes) {
    if (totalMinutes <= 0) return null;
    if (totalMinutes < 30) return 'low';
    if (totalMinutes < 90) return 'mid';
    return 'high';
  }

  function render() {
    const today = new Date();
    el.monthLabel.textContent = `${viewYear}.${MONTH_LABEL[viewMonth]}`;
    el.grid.innerHTML = '';

    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();

    const frag = document.createDocumentFragment();

    for (let i = 0; i < firstDayIndex; i++) {
      const cell = document.createElement('div');
      cell.className = 'calendar-day empty';
      frag.appendChild(cell);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const cell = document.createElement('div');
      const weekday = new Date(viewYear, viewMonth, day).getDay();
      const classes = ['calendar-day'];

      if (weekday === 0 || weekday === 6) classes.push('weekend');
      if (isCurrentMonth && day === today.getDate()) classes.push('today');

      const entries = loadDay(viewYear, viewMonth, day);
      const totalMinutes = entries.reduce((sum, e) => sum + (e.minutes || 0), 0);
      const level = activityLevel(totalMinutes);
      if (level) classes.push('has-activity', level);

      cell.className = classes.join(' ');
      cell.textContent = String(day);
      if (level) {
        cell.title = `${entries.length}セッション / ${totalMinutes}分`;
      }
      frag.appendChild(cell);
    }

    el.grid.appendChild(frag);
  }

  el.prevBtn.addEventListener('click', () => {
    viewMonth -= 1;
    if (viewMonth < 0) { viewMonth = 11; viewYear -= 1; }
    render();
  });

  el.nextBtn.addEventListener('click', () => {
    viewMonth += 1;
    if (viewMonth > 11) { viewMonth = 0; viewYear += 1; }
    render();
  });

  el.monthLabel.addEventListener('click', () => {
    const now = new Date();
    viewYear = now.getFullYear();
    viewMonth = now.getMonth();
    render();
  });

  render();

  // Keep "today" fresh and pick up newly-logged sessions without a reload.
  setInterval(render, 60 * 1000);
})();
