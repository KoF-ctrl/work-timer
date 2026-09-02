(function () {
  'use strict';

  // Original HUD companion, "R.E.D." (Rapid Encouragement Droid) — a red/gold
  // armored bust inspired by the app's Iron-Man-style HUD aesthetic. Wanders
  // the screen on its own and drops a wisecracking pep-talk roughly once an
  // hour (plus on click, with a short cooldown).

  const NAME = 'R.E.D.';
  const SIZE = 60;

  const MESSAGES = [
    'よし、状況確認完了。まだまだ余裕だな、ボス。',
    '根を詰めすぎるなよ。天才にも休憩は必要だ、俺で証明済みだ。',
    'そのタスク、片付けたら少しはドヤ顔していいぞ。',
    '調子はどうだ？センサー的には、まだ本気出してないように見えるが。',
    '残り時間？計算済みだ。お前ならまだ間に合う。',
    '疲れた顔してるな。コーヒーでも起動しろ。',
    '小さな一歩でもいい。積み重ねが伝説を作る。',
    'サボれとは言わない。ただ、今はまだそのタイミングじゃない。',
    'ピンチはチャンスの前触れだ。俺が何度も言ってきただろ。',
    '今日のお前、なかなかいい仕事してるじゃないか。',
    '動力系は正常。あとはお前の集中力次第だな。',
    '諦めるという選択肢、俺の辞書にはない。お前もそうだろ？',
    '肩の力を抜け。凝り固まった天才はいい仕事をしない。',
    'ここが踏ん張りどころだ。俺がついてる、続けろ。',
    '完璧を求めすぎるな。まずは終わらせることだ。',
    'そろそろ伸びでもしとけ。体が資本だ、スーツも同じだよ。',
    'お前のペース、悪くない。このまま押し切れ。',
    '小休止も戦略のうちだ。無理はするなよ、ボス。',
  ];

  const MIN_INTERVAL_MS = 45 * 60 * 1000; // ~45min
  const MAX_INTERVAL_MS = 75 * 60 * 1000; // ~75min
  const STORAGE_KEY = 'work-timer:companion:next-message-at';
  const CLICK_COOLDOWN_MS = 20 * 1000;
  const BUBBLE_VISIBLE_MS = 7500;

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function pickMessage() {
    return MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
  }

  // ---------- build DOM ----------

  const wrap = document.createElement('div');
  wrap.className = 'companion-wrap';
  wrap.innerHTML = `
    <div class="companion-bubble" id="companionBubble">
      <span class="companion-bubble-name">${NAME}</span>
      <span id="companionBubbleText"></span>
    </div>
    <button type="button" class="companion-figure" id="companionFigure" aria-label="${NAME}">
      <div class="companion-thruster"></div>
      <div class="companion-bob">
        <svg class="companion-svg" viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="companionGlow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="2.4" result="blur"/>
              <feMerge>
                <feMergeNode in="blur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          <rect x="8" y="90" width="26" height="16" rx="6" fill="#c9932f"/>
          <rect x="66" y="90" width="26" height="16" rx="6" fill="#c9932f"/>
          <path d="M30 78 L70 78 L62 92 L38 92 Z" fill="#8f1420"/>
          <circle class="companion-core" cx="50" cy="85" r="5" fill="#fff3d6" filter="url(#companionGlow)"/>
          <rect x="22" y="8" width="56" height="60" rx="20" fill="#d81f2f" stroke="#7a0f1a" stroke-width="2"/>
          <rect x="46" y="8" width="8" height="60" fill="#ffcf6b"/>
          <rect x="22" y="58" width="56" height="10" rx="4" fill="#ffcf6b"/>
          <rect x="30" y="14" width="14" height="3" rx="1.5" fill="#ffcf6b" opacity="0.85"/>
          <rect x="56" y="14" width="14" height="3" rx="1.5" fill="#ffcf6b" opacity="0.85"/>
          <rect class="companion-eye" x="30" y="32" width="15" height="7" rx="3.5" fill="#eafcff" filter="url(#companionGlow)"/>
          <rect class="companion-eye" x="55" y="32" width="15" height="7" rx="3.5" fill="#eafcff" filter="url(#companionGlow)"/>
        </svg>
      </div>
    </button>
  `;
  document.body.appendChild(wrap);

  const figure = document.getElementById('companionFigure');
  const bubble = document.getElementById('companionBubble');
  const bubbleText = document.getElementById('companionBubbleText');

  // ---------- wandering movement ----------

  let pos = { x: 0, y: 0 };
  let talking = false;
  let wanderTimer = null;

  function bounds() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const marginX = Math.min(120, w * 0.28);
    const marginTop = Math.min(100, h * 0.2);
    const marginBottom = Math.min(70, h * 0.14);
    return {
      minX: marginX,
      maxX: Math.max(marginX + 40, w - marginX - SIZE),
      minY: marginTop,
      maxY: Math.max(marginTop + 40, h - marginBottom - SIZE),
    };
  }

  function place(x, y, durationSec) {
    wrap.style.transition = durationSec
      ? `left ${durationSec}s ease-in-out, top ${durationSec}s ease-in-out`
      : 'none';
    wrap.style.left = `${x}px`;
    wrap.style.top = `${y}px`;
  }

  function pickTarget() {
    const b = bounds();
    const target = { x: rand(b.minX, b.maxX), y: rand(b.minY, b.maxY) };
    const dist = Math.hypot(target.x - pos.x, target.y - pos.y);
    const duration = Math.min(7, Math.max(2.5, dist / 90));

    figure.classList.toggle('facing-left', target.x < pos.x);
    figure.classList.add('walking');
    place(target.x, target.y, duration);
    pos = target;

    wanderTimer = setTimeout(() => {
      figure.classList.remove('walking');
      wanderTimer = setTimeout(wander, rand(1500, 4000));
    }, duration * 1000);
  }

  function wander() {
    if (talking) {
      wanderTimer = setTimeout(wander, 1000);
      return;
    }
    pickTarget();
  }

  (function initPosition() {
    const b = bounds();
    pos = { x: rand(b.minX, b.maxX), y: rand(b.minY, b.maxY) };
    place(pos.x, pos.y, 0);
  })();

  window.addEventListener('resize', () => {
    const b = bounds();
    const x = Math.min(Math.max(pos.x, b.minX), b.maxX);
    const y = Math.min(Math.max(pos.y, b.minY), b.maxY);
    pos = { x, y };
    place(x, y, 0);
  });

  setTimeout(wander, 1500);

  // ---------- speaking ----------

  let hideBubbleTimer = null;

  function showMessage(text) {
    talking = true;
    figure.classList.remove('walking');
    figure.classList.add('talking');
    bubbleText.textContent = text;
    bubble.classList.add('show');

    clearTimeout(hideBubbleTimer);
    hideBubbleTimer = setTimeout(() => {
      bubble.classList.remove('show');
      figure.classList.remove('talking');
      talking = false;
    }, BUBBLE_VISIBLE_MS);
  }

  // ---------- ~hourly schedule, persisted across reloads ----------

  function scheduleNext() {
    const delay = rand(MIN_INTERVAL_MS, MAX_INTERVAL_MS);
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now() + delay));
    } catch (e) { /* storage unavailable, still works for this tab session */ }
    setTimeout(fireScheduled, delay);
  }

  function fireScheduled() {
    showMessage(pickMessage());
    scheduleNext();
  }

  (function initSchedule() {
    let storedAt = null;
    try {
      storedAt = Number(localStorage.getItem(STORAGE_KEY));
    } catch (e) { /* ignore */ }

    if (storedAt && storedAt > Date.now()) {
      setTimeout(fireScheduled, storedAt - Date.now());
    } else {
      // first visit, or the scheduled time passed while the tab was closed —
      // say hello soon, then settle into the ~hourly rhythm.
      setTimeout(fireScheduled, rand(8000, 30000));
    }
  })();

  // ---------- click to chat (rate-limited) ----------

  let lastClickAt = 0;
  figure.addEventListener('click', () => {
    const now = Date.now();
    if (now - lastClickAt < CLICK_COOLDOWN_MS) return;
    lastClickAt = now;
    showMessage(pickMessage());
  });
})();
