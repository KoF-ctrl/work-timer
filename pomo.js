(function () {
  'use strict';

  const RING_RADIUS = 170;
  const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
  const CENTER = 200;

  const MAX_MIN = { work: 90, break: 30, simple: 60 };
  const MIN_MIN = 1;
  const PRESETS = {
    simple: [5, 10, 15, 25, 45],
    work: [15, 25, 45, 60],
    break: [5, 10, 15, 20],
  };

  const el = {
    hud: document.getElementById('pomoHud'),
    cycleToggle: document.getElementById('cycleToggle'),
    modeTabs: document.getElementById('modeTabs'),
    workDurLabel: document.getElementById('workDurLabel'),
    breakDurLabel: document.getElementById('breakDurLabel'),
    pomoPill: document.getElementById('pomoPill'),
    pomoStatusText: document.getElementById('pomoStatusText'),
    sessionLabel: document.getElementById('sessionLabel'),
    sessionCount: document.getElementById('sessionCount'),
    ring: document.getElementById('pomoRing'),
    ringProgress: document.getElementById('pomoRingProgress'),
    ticks: document.getElementById('pomoTicks'),
    handle: document.getElementById('pomoHandle'),
    phaseLabel: document.getElementById('pomoPhaseLabel'),
    time: document.getElementById('pomoTime'),
    hint: document.getElementById('pomoHint'),
    presetRow: document.getElementById('presetRow'),
    startBtn: document.getElementById('pomoStartBtn'),
    pauseBtn: document.getElementById('pomoPauseBtn'),
    resetBtn: document.getElementById('pomoResetBtn'),
  };

  const state = {
    cycleEnabled: false,
    editPhase: 'work',
    durations: { work: 25, break: 5, simple: 25 },
    status: 'idle', // idle | running | paused
    runningPhase: 'simple', // simple | work | break
    totalMs: 25 * 60 * 1000,
    remainingMs: 25 * 60 * 1000,
    endAt: null,
    sessionCount: 1,
    dragging: false,
  };

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function fmtMS(ms) {
    const totalSec = Math.max(0, Math.round(ms / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${pad(m)}:${pad(s)}`;
  }

  function currentEditPhaseKey() {
    return state.cycleEnabled ? state.editPhase : 'simple';
  }

  function buildTicks(count, majorEvery, radius) {
    const ns = 'http://www.w3.org/2000/svg';
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * 2 * Math.PI;
      const isMajor = i % majorEvery === 0;
      const outer = radius + (isMajor ? 12 : 7);
      const inner = radius + 2;
      const x1 = CENTER + inner * Math.cos(angle);
      const y1 = CENTER + inner * Math.sin(angle);
      const x2 = CENTER + outer * Math.cos(angle);
      const y2 = CENTER + outer * Math.sin(angle);
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

  el.ticks.appendChild(buildTicks(60, 5, RING_RADIUS));
  el.ringProgress.style.strokeDasharray = String(RING_CIRCUMFERENCE);

  function setRingFraction(fraction) {
    const clamped = Math.max(0, Math.min(1, fraction));
    el.ringProgress.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - clamped));
  }

  function setHandleAtFraction(fraction) {
    const angle = fraction * 2 * Math.PI;
    const x = CENTER + RING_RADIUS * Math.cos(angle);
    const y = CENTER + RING_RADIUS * Math.sin(angle);
    el.handle.setAttribute('cx', x.toFixed(2));
    el.handle.setAttribute('cy', y.toFixed(2));
  }

  function minutesToFraction(minutes, phaseKey) {
    return Math.min(1, minutes / MAX_MIN[phaseKey]);
  }

  // ---------- duration editing (idle only) ----------

  function setDuration(phaseKey, minutes) {
    const clamped = Math.max(MIN_MIN, Math.min(MAX_MIN[phaseKey], Math.round(minutes)));
    state.durations[phaseKey] = clamped;
    if (phaseKey === 'work') el.workDurLabel.textContent = `${pad(clamped)}:00`;
    if (phaseKey === 'break') el.breakDurLabel.textContent = `${pad(clamped)}:00`;
    renderIdlePreview();
    syncPresetActive();
  }

  function syncPresetActive() {
    const phaseKey = currentEditPhaseKey();
    const minutes = state.durations[phaseKey];
    Array.from(el.presetRow.children).forEach((btn) => {
      btn.classList.toggle('active', Number(btn.dataset.min) === minutes);
    });
  }

  function renderPresets() {
    const phaseKey = currentEditPhaseKey();
    const list = PRESETS[phaseKey];
    el.presetRow.innerHTML = '';
    list.forEach((min) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'preset-btn';
      btn.dataset.min = String(min);
      btn.textContent = String(min);
      btn.addEventListener('click', () => {
        if (state.status !== 'idle') return;
        setDuration(phaseKey, min);
      });
      el.presetRow.appendChild(btn);
    });
    syncPresetActive();
  }

  // ---------- drag-to-set ----------

  function angleFractionFromPoint(clientX, clientY) {
    const rect = el.ring.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    let theta = Math.atan2(dx, -dy);
    if (theta < 0) theta += 2 * Math.PI;
    return theta / (2 * Math.PI);
  }

  function applyPointerAsDuration(evt) {
    const phaseKey = currentEditPhaseKey();
    const fraction = angleFractionFromPoint(evt.clientX, evt.clientY);
    const minutes = Math.max(MIN_MIN, Math.round(fraction * MAX_MIN[phaseKey]));
    setDuration(phaseKey, minutes);
  }

  function onPointerDown(evt) {
    if (state.status !== 'idle') return;
    state.dragging = true;
    el.ring.classList.add('dragging');
    if (el.ring.setPointerCapture) el.ring.setPointerCapture(evt.pointerId);
    applyPointerAsDuration(evt);
    evt.preventDefault();
  }

  function onPointerMove(evt) {
    if (!state.dragging) return;
    applyPointerAsDuration(evt);
  }

  function onPointerUp() {
    if (!state.dragging) return;
    state.dragging = false;
    el.ring.classList.remove('dragging');
  }

  el.ring.addEventListener('pointerdown', onPointerDown);
  el.ring.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);

  // ---------- mode tabs (which duration you're editing) ----------

  Array.from(el.modeTabs.children).forEach((tab) => {
    tab.addEventListener('click', () => {
      if (state.status !== 'idle') return;
      state.editPhase = tab.dataset.phase;
      Array.from(el.modeTabs.children).forEach((t) => t.classList.toggle('active', t === tab));
      renderPresets();
      renderIdlePreview();
    });
  });

  // ---------- auto cycle toggle ----------

  el.cycleToggle.addEventListener('change', () => {
    state.cycleEnabled = el.cycleToggle.checked;
    resetPomo();
    el.modeTabs.classList.toggle('is-hidden', !state.cycleEnabled);
    el.sessionLabel.classList.toggle('is-hidden', !state.cycleEnabled);
    renderPresets();
    renderIdlePreview();
  });

  // ---------- controls ----------

  function startPomo() {
    if (state.status === 'idle') {
      state.runningPhase = state.cycleEnabled ? 'work' : 'simple';
      state.totalMs = state.durations[state.runningPhase] * 60 * 1000;
      state.remainingMs = state.totalMs;
      state.endAt = Date.now() + state.remainingMs;
      state.status = 'running';
    } else if (state.status === 'paused') {
      state.endAt = Date.now() + state.remainingMs;
      state.status = 'running';
    }
  }

  function pausePomo() {
    if (state.status !== 'running') return;
    state.remainingMs = Math.max(0, state.endAt - Date.now());
    state.status = 'paused';
  }

  function resetPomo() {
    state.status = 'idle';
    state.sessionCount = 1;
    state.runningPhase = state.cycleEnabled ? 'work' : 'simple';
    state.endAt = null;
    el.hud.classList.remove('flash-complete');
  }

  el.startBtn.addEventListener('click', startPomo);
  el.pauseBtn.addEventListener('click', pausePomo);
  el.resetBtn.addEventListener('click', resetPomo);

  // ---------- completion / auto phase switch ----------

  function flashComplete() {
    el.hud.classList.remove('flash-complete');
    void el.hud.offsetWidth;
    el.hud.classList.add('flash-complete');
    setTimeout(() => el.hud.classList.remove('flash-complete'), 1400);
  }

  function recordCompletedFocus() {
    const finishedPhase = state.cycleEnabled ? state.runningPhase : 'simple';
    if (finishedPhase === 'break') return; // only count productive focus time, not breaks
    if (!window.WorkTimerStats) return;
    const minutes = state.totalMs / (60 * 1000);
    window.WorkTimerStats.recordFocusComplete(minutes, finishedPhase === 'work' ? 'WORK' : 'FOCUS');
  }

  function completePhase() {
    recordCompletedFocus();
    flashComplete();
    if (state.cycleEnabled) {
      if (state.runningPhase === 'work') {
        state.runningPhase = 'break';
      } else {
        state.runningPhase = 'work';
        state.sessionCount += 1;
      }
      state.totalMs = state.durations[state.runningPhase] * 60 * 1000;
      state.remainingMs = state.totalMs;
      state.endAt = Date.now() + state.remainingMs;
      state.status = 'running';
    } else {
      state.status = 'idle';
      state.endAt = null;
    }
  }

  // ---------- render ----------

  function renderIdlePreview() {
    if (state.status !== 'idle') return;
    const phaseKey = currentEditPhaseKey();
    const minutes = state.durations[phaseKey];
    const isBreak = state.cycleEnabled && phaseKey === 'break';
    setRingFraction(1);
    setHandleAtFraction(minutesToFraction(minutes, phaseKey));
    el.time.textContent = `${pad(minutes)}:00`;
    el.time.classList.toggle('urgent', isBreak);
    el.phaseLabel.textContent = state.cycleEnabled ? (phaseKey === 'work' ? 'WORK SET' : 'BREAK SET') : 'FOCUS';
    el.handle.classList.toggle('break-color', isBreak);
    el.ringProgress.classList.toggle('urgent', isBreak);
  }

  function render() {
    const isBreak = state.cycleEnabled && state.runningPhase === 'break';

    el.pomoPill.classList.remove('status-before', 'status-working', 'status-urgent', 'status-off');
    el.ringProgress.classList.remove('urgent', 'critical', 'off');
    el.time.classList.remove('urgent', 'critical', 'off');
    el.handle.classList.toggle('break-color', isBreak);

    if (state.status === 'idle') {
      el.pomoPill.classList.add('status-before');
      el.pomoStatusText.textContent = 'READY';
      el.hint.textContent = 'ドラッグ or プリセットで時間設定';
      el.presetRow.classList.remove('is-locked');
      el.modeTabs.classList.remove('is-locked');
      el.ring.classList.add('draggable');
      renderIdlePreview();
    } else {
      el.presetRow.classList.add('is-locked');
      el.modeTabs.classList.add('is-locked');
      el.ring.classList.remove('draggable');

      const remaining = state.status === 'running' ? Math.max(0, state.endAt - Date.now()) : state.remainingMs;
      const fraction = state.totalMs > 0 ? remaining / state.totalMs : 0;
      setRingFraction(fraction);
      setHandleAtFraction(fraction);
      el.time.textContent = fmtMS(remaining);
      el.phaseLabel.textContent = state.cycleEnabled ? (isBreak ? 'BREAK' : 'WORK') : 'FOCUS';

      if (state.status === 'paused') {
        el.pomoPill.classList.add('status-before');
        el.pomoStatusText.textContent = 'PAUSED';
      } else if (isBreak) {
        el.ringProgress.classList.add('urgent');
        el.time.classList.add('urgent');
        el.pomoPill.classList.add('status-urgent');
        el.pomoStatusText.textContent = 'BREAK';
      } else {
        el.pomoPill.classList.add('status-working');
        el.pomoStatusText.textContent = 'FOCUSING';
      }

      el.hint.textContent = state.cycleEnabled
        ? `SESSION ${state.sessionCount} / ${isBreak ? '休憩中' : '作業中'}`
        : (state.status === 'running' ? 'カウントダウン中' : '一時停止中');

      if (remaining <= 0 && state.status === 'running') {
        completePhase();
      }
    }

    el.sessionCount.textContent = String(state.sessionCount);
    el.startBtn.disabled = state.status === 'running';
    el.startBtn.textContent = state.status === 'paused' ? 'RESUME' : 'START';
    el.pauseBtn.disabled = state.status !== 'running';
  }

  renderPresets();
  render();
  setInterval(render, 1000);
})();
