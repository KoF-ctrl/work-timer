(function () {
  'use strict';

  const WORK_START = { h: 9, m: 0 };
  const WORK_END = { h: 17, m: 30 };
  const SEGMENT_MINUTES = 15;
  const URGENT_MS = 30 * 60 * 1000;
  const CRITICAL_MS = 5 * 60 * 1000;
  const RING_RADIUS = 170;
  const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

  const el = {
    clock: document.getElementById('clock'),
    dateLabel: document.getElementById('dateLabel'),
    statusPill: document.getElementById('statusPill'),
    statusText: document.getElementById('statusText'),
    ringProgress: document.getElementById('ringProgress'),
    ticks: document.getElementById('ticks'),
    readoutLabel: document.getElementById('readoutLabel'),
    bigTime: document.getElementById('bigTime'),
    subLabel: document.getElementById('subLabel'),
    percent: document.getElementById('percent'),
    segbar: document.getElementById('segbar'),
    nextEvent: document.getElementById('nextEvent'),
    elapsedTime: document.getElementById('elapsedTime'),
  };

  const WEEKDAY_LABEL = ['日', '月', '火', '水', '木', '金', '土'];
  const TOTAL_SEGMENTS = ((WORK_END.h * 60 + WORK_END.m) - (WORK_START.h * 60 + WORK_START.m)) / SEGMENT_MINUTES;

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function fmtHMS(ms) {
    const totalSec = Math.max(0, Math.round(ms / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  function atTime(date, h, m) {
    const d = new Date(date);
    d.setHours(h, m, 0, 0);
    return d;
  }

  function isWeekday(date) {
    const day = date.getDay();
    return day >= 1 && day <= 5;
  }

  function nextWorkStart(from) {
    const todayStart = atTime(from, WORK_START.h, WORK_START.m);
    if (isWeekday(from) && from < todayStart) {
      return todayStart;
    }
    const d = new Date(from);
    d.setDate(d.getDate() + 1);
    d.setHours(WORK_START.h, WORK_START.m, 0, 0);
    while (!isWeekday(d)) {
      d.setDate(d.getDate() + 1);
    }
    return d;
  }

  function computeState(now) {
    const weekday = isWeekday(now);
    const start = atTime(now, WORK_START.h, WORK_START.m);
    const end = atTime(now, WORK_END.h, WORK_END.m);

    if (weekday && now >= start && now <= end) {
      const total = end - start;
      const elapsed = now - start;
      const remaining = end - now;
      return {
        phase: 'working',
        remaining,
        elapsed,
        total,
        nextEventLabel: '定時',
        nextEventAt: end,
      };
    }

    if (weekday && now < start) {
      return {
        phase: 'before',
        remaining: start - now,
        nextEventLabel: '始業',
        nextEventAt: start,
      };
    }

    const next = nextWorkStart(now);
    return {
      phase: weekday ? 'after' : 'off',
      remaining: next - now,
      nextEventLabel: '次回始業',
      nextEventAt: next,
    };
  }

  function urgencyLevel(state) {
    if (state.phase !== 'working') return 'normal';
    if (state.remaining <= CRITICAL_MS) return 'critical';
    if (state.remaining <= URGENT_MS) return 'urgent';
    return 'normal';
  }

  function buildTicks(count, majorEvery, radius) {
    const ns = 'http://www.w3.org/2000/svg';
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * 2 * Math.PI;
      const isMajor = i % majorEvery === 0;
      const outer = radius + (isMajor ? 12 : 7);
      const inner = radius + 2;
      const x1 = 200 + inner * Math.cos(angle);
      const y1 = 200 + inner * Math.sin(angle);
      const x2 = 200 + outer * Math.cos(angle);
      const y2 = 200 + outer * Math.sin(angle);
      const line = document.createElementNS(ns, 'line');
      line.setAttribute('x1', x1.toFixed(2));
      line.setAttribute('y1', y1.toFixed(2));
      line.setAttribute('x2', x2.toFixed(2));
      line.setAttribute('y2', y2.toFixed(2));
      if (isMajor) line.setAttribute('class', 'major');
      frag.appendChild(line);
    }
    return frag;
  }

  function buildSegments(count) {
    const frag = document.createDocumentFragment();
    const nodes = [];
    for (let i = 0; i < count; i++) {
      const seg = document.createElement('div');
      seg.className = 'seg';
      frag.appendChild(seg);
      nodes.push(seg);
    }
    el.segbar.appendChild(frag);
    return nodes;
  }

  el.ticks.appendChild(buildTicks(60, 5, RING_RADIUS));
  const segNodes = buildSegments(TOTAL_SEGMENTS);
  el.ringProgress.style.strokeDasharray = String(RING_CIRCUMFERENCE);

  function setRing(fraction, level) {
    const clamped = Math.max(0, Math.min(1, fraction));
    const offset = RING_CIRCUMFERENCE * (1 - clamped);
    el.ringProgress.style.strokeDashoffset = String(offset);
    el.ringProgress.classList.remove('urgent', 'critical', 'off');
    if (level === 'urgent') el.ringProgress.classList.add('urgent');
    else if (level === 'critical') el.ringProgress.classList.add('critical');
    else if (level === 'off') el.ringProgress.classList.add('off');
  }

  function setSegments(filledCount, level) {
    segNodes.forEach((node, i) => {
      const filled = i >= TOTAL_SEGMENTS - filledCount;
      node.classList.toggle('filled', filled);
      node.classList.toggle('urgent', filled && level === 'urgent');
      node.classList.toggle('critical', filled && level === 'critical');
    });
  }

  function render(now) {
    el.clock.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    el.dateLabel.textContent = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())} ${WEEKDAY_LABEL[now.getDay()]}`;

    const state = computeState(now);
    const level = urgencyLevel(state);

    el.statusPill.classList.remove('status-working', 'status-before', 'status-off', 'status-urgent', 'status-critical');
    el.bigTime.classList.remove('urgent', 'critical', 'off');

    if (state.phase === 'working') {
      const pillClass = level === 'critical' ? 'status-critical' : level === 'urgent' ? 'status-urgent' : 'status-working';
      el.statusPill.classList.add(pillClass);
      el.statusText.textContent = level === 'critical' ? 'CRITICAL' : level === 'urgent' ? 'URGENT' : 'WORKING';
      el.readoutLabel.textContent = 'REMAINING';
      el.bigTime.textContent = fmtHMS(state.remaining);
      if (level === 'critical') el.bigTime.classList.add('critical');
      else if (level === 'urgent') el.bigTime.classList.add('urgent');
      el.subLabel.textContent = '定時 17:30 まで';
      const pct = Math.round((state.remaining / state.total) * 100);
      el.percent.textContent = `${pct}% LEFT`;
      setRing(state.remaining / state.total, level);
      const filledSegs = Math.ceil(state.remaining / (SEGMENT_MINUTES * 60 * 1000));
      setSegments(filledSegs, level);
      el.elapsedTime.textContent = fmtHMS(state.elapsed);
    } else if (state.phase === 'before') {
      el.statusPill.classList.add('status-before');
      el.statusText.textContent = 'STANDBY';
      el.readoutLabel.textContent = 'STARTS IN';
      el.bigTime.textContent = fmtHMS(state.remaining);
      el.subLabel.textContent = '始業 09:00 まで';
      el.percent.textContent = '';
      setRing(0, 'before');
      setSegments(TOTAL_SEGMENTS, 'normal');
      el.elapsedTime.textContent = '00:00:00';
    } else {
      el.statusPill.classList.add('status-off');
      el.statusText.textContent = state.phase === 'after' ? 'COMPLETE' : 'OFF DUTY';
      el.readoutLabel.textContent = 'NEXT SHIFT';
      el.bigTime.textContent = fmtHMS(state.remaining);
      el.bigTime.classList.add('off');
      el.subLabel.textContent = state.phase === 'after' ? '本日の勤務は終了しました' : '本日は休日です';
      el.percent.textContent = '';
      setRing(0, 'off');
      setSegments(0, 'normal');
      el.elapsedTime.textContent = '--:--:--';
    }

    const eventDate = state.nextEventAt;
    const sameDay = eventDate.toDateString() === now.toDateString();
    const eventTimeStr = `${pad(eventDate.getHours())}:${pad(eventDate.getMinutes())}`;
    const eventDayStr = sameDay ? '' : `${eventDate.getMonth() + 1}/${eventDate.getDate()}(${WEEKDAY_LABEL[eventDate.getDay()]}) `;
    el.nextEvent.textContent = `${state.nextEventLabel} ${eventDayStr}${eventTimeStr}`;
  }

  function tick() {
    render(new Date());
  }

  tick();
  setInterval(tick, 1000);
})();
