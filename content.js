(() => {
  if (window.__statusBarInjected) return;
  window.__statusBarInjected = true;

  const COMMON_TIMEZONES = [
    "America/Sao_Paulo",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Mexico_City",
    "America/Bogota",
    "America/Argentina/Buenos_Aires",
    "UTC",
    "Europe/Lisbon",
    "Europe/London",
    "Europe/Madrid",
    "Europe/Paris",
    "Europe/Berlin",
    "Europe/Rome",
    "Europe/Moscow",
    "Africa/Cairo",
    "Africa/Johannesburg",
    "Asia/Dubai",
    "Asia/Kolkata",
    "Asia/Bangkok",
    "Asia/Shanghai",
    "Asia/Tokyo",
    "Asia/Seoul",
    "Asia/Singapore",
    "Australia/Sydney",
    "Pacific/Auckland",
  ];

  const timezoneOptions = (() => {
    try {
      if (typeof Intl.supportedValuesOf === "function") {
        const values = Intl.supportedValuesOf("timeZone");
        if (values?.length) return values;
      }
    } catch {
      /* fall through to curated list */
    }
    return COMMON_TIMEZONES;
  })();

  function cityOf(tz) {
    const parts = tz.split("/");
    return parts[parts.length - 1].replace(/_/g, " ");
  }

  function rankedMatches(query) {
    const q = query.toLowerCase();
    const scored = [];
    for (const tz of timezoneOptions) {
      const city = cityOf(tz).toLowerCase();
      const full = tz.toLowerCase();
      let score;
      if (city.startsWith(q)) score = 0;
      else if (city.includes(q)) score = 1;
      else if (full.includes(q)) score = 2;
      else continue;
      scored.push({ tz, score });
    }
    scored.sort((a, b) => a.score - b.score || a.tz.localeCompare(b.tz));
    return scored.map((s) => s.tz);
  }

  const WORK_MS = 25 * 60 * 1000;

  let state = {
    barVisible: true,
    tz1: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    tz2: "UTC",
    pomodoro: { mode: "work", running: false, endAt: null, remainingMs: WORK_MS },
  };

  const host = document.createElement("div");
  host.id = "__status_bar_host__";
  host.style.all = "initial";
  host.style.position = "fixed";
  host.style.zIndex = "2147483647";
  host.style.bottom = "0";
  host.style.right = "12px";
  host.style.pointerEvents = "none";

  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .bar {
      pointer-events: auto;
      display: flex;
      align-items: stretch;
      gap: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 12px;
      color: #e5e5e5;
      background: #3c3c3c;
      border: 1px solid #2a2a2a;
      border-bottom: none;
      border-radius: 6px 6px 0 0;
      box-shadow: 0 -1px 6px rgba(0, 0, 0, 0.25);
      overflow: visible;
      user-select: none;
    }
    .segment {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 5px 10px;
      border-right: 1px solid #545454;
      white-space: nowrap;
      position: relative;
    }
    .segment:last-child { border-right: none; }
    .clock-label {
      color: #a8a8a8;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .clock-time {
      font-variant-numeric: tabular-nums;
      font-weight: 600;
    }
    .clock-segment { cursor: pointer; }
    .clock-segment:hover { background: rgba(255, 255, 255, 0.06); }
    .pomo-mode {
      color: #a8a8a8;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      min-width: 34px;
    }
    .pomo-time {
      font-variant-numeric: tabular-nums;
      font-weight: 600;
      min-width: 40px;
    }
    button {
      all: unset;
      cursor: pointer;
      color: #e5e5e5;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      border-radius: 4px;
      font-size: 11px;
    }
    button:hover { background: rgba(255, 255, 255, 0.12); }
    .close-btn { color: #a8a8a8; }
    .pause-icon {
      display: inline-flex;
      gap: 2.5px;
    }
    .pause-icon span {
      width: 3px;
      height: 10px;
      background: #e5e5e5;
      border-radius: 1px;
    }

    .popover {
      position: absolute;
      bottom: calc(100% + 6px);
      right: 0;
      background: #2f2f2f;
      border: 1px solid #545454;
      border-radius: 8px;
      padding: 10px;
      width: 210px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
      display: none;
      flex-direction: column;
      gap: 8px;
    }
    .popover.open { display: flex; }
    .popover label {
      font-size: 10px;
      color: #a8a8a8;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      display: block;
      margin-bottom: 3px;
    }
    .tz-search {
      width: 100%;
      background: #1f1f1f;
      color: #e5e5e5;
      border: 1px solid #545454;
      border-radius: 4px;
      padding: 5px 6px;
      font-size: 12px;
    }
    .tz-search:focus { outline: 1px solid #8b8b8b; }
    .tz-options {
      max-height: 160px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .tz-option {
      padding: 5px 6px;
      border-radius: 4px;
      cursor: pointer;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .tz-option:hover { background: rgba(255, 255, 255, 0.1); }
    .tz-option.selected { background: rgba(99, 102, 241, 0.35); font-weight: 600; }
    .tz-empty {
      padding: 6px;
      color: #888;
      font-size: 11px;
      text-align: center;
    }
  `;

  const bar = document.createElement("div");
  bar.className = "bar";

  const clock1 = createClockSegment("tz1");
  const clock2 = createClockSegment("tz2");

  const pomoSegment = document.createElement("div");
  pomoSegment.className = "segment";
  const pomoMode = document.createElement("span");
  pomoMode.className = "pomo-mode";
  const pomoTime = document.createElement("span");
  pomoTime.className = "pomo-time";
  const playPauseBtn = document.createElement("button");
  playPauseBtn.title = "Iniciar/Pausar";
  const resetBtn = document.createElement("button");
  resetBtn.textContent = "⟲";
  resetBtn.title = "Reiniciar";
  pomoSegment.append(pomoMode, pomoTime, playPauseBtn, resetBtn);

  const closeSegment = document.createElement("div");
  closeSegment.className = "segment";
  const closeBtn = document.createElement("button");
  closeBtn.className = "close-btn";
  closeBtn.textContent = "✕";
  closeBtn.title = "Ocultar barra";
  closeSegment.appendChild(closeBtn);

  bar.append(clock1.segment, clock2.segment, pomoSegment, closeSegment);
  shadow.append(style, bar);

  function createClockSegment(tzKey) {
    const segment = document.createElement("div");
    segment.className = "segment clock-segment";
    const label = document.createElement("span");
    label.className = "clock-label";
    const time = document.createElement("span");
    time.className = "clock-time";
    segment.append(label, time);

    const popover = document.createElement("div");
    popover.className = "popover";
    const popLabel = document.createElement("label");
    popLabel.textContent = "Fuso horário";
    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.className = "tz-search";
    searchInput.placeholder = "Buscar cidade ou fuso...";
    searchInput.autocomplete = "off";
    const optionsList = document.createElement("div");
    optionsList.className = "tz-options";

    function renderOptions() {
      const q = searchInput.value.trim().toLowerCase();
      const matches = (q ? rankedMatches(q) : timezoneOptions).slice(0, 60);

      optionsList.innerHTML = "";
      if (matches.length === 0) {
        const empty = document.createElement("div");
        empty.className = "tz-empty";
        empty.textContent = "Nenhum fuso encontrado";
        optionsList.appendChild(empty);
        return;
      }
      for (const tz of matches) {
        const item = document.createElement("div");
        item.className = "tz-option" + (tz === state[tzKey] ? " selected" : "");
        item.textContent = tz.replace(/_/g, " ");
        item.addEventListener("click", () => {
          chrome.storage.local.set({ [tzKey]: tz });
          popover.classList.remove("open");
        });
        optionsList.appendChild(item);
      }
    }

    searchInput.addEventListener("input", renderOptions);
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        popover.classList.remove("open");
      } else if (e.key === "Enter") {
        const first = optionsList.querySelector(".tz-option");
        first?.click();
      }
    });

    popover.append(popLabel, searchInput, optionsList);
    segment.appendChild(popover);

    segment.addEventListener("click", (e) => {
      if (popover.contains(e.target)) return;
      const wasOpen = popover.classList.contains("open");
      closeAllPopovers();
      if (!wasOpen) {
        popover.classList.add("open");
        searchInput.value = "";
        renderOptions();
        searchInput.focus();
      }
    });

    return { segment, label, time, popover, renderOptions };
  }

  function closeAllPopovers() {
    shadow.querySelectorAll(".popover.open").forEach((p) => p.classList.remove("open"));
  }

  document.addEventListener("click", (e) => {
    if (!e.composedPath().includes(host)) closeAllPopovers();
  });

  playPauseBtn.addEventListener("click", () => {
    const type = state.pomodoro.running ? "pomodoro:pause" : "pomodoro:start";
    chrome.runtime.sendMessage({ type });
  });
  resetBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "pomodoro:reset" });
  });
  closeBtn.addEventListener("click", () => {
    chrome.storage.local.set({ barVisible: false });
  });

  function formatClock(tz) {
    try {
      return new Intl.DateTimeFormat("pt-BR", {
        timeZone: tz,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(new Date());
    } catch {
      return "--:--:--";
    }
  }

  function formatDuration(ms) {
    const totalSeconds = Math.max(0, Math.round(ms / 1000));
    const m = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const s = String(totalSeconds % 60).padStart(2, "0");
    return `${m}:${s}`;
  }

  function render() {
    host.style.display = state.barVisible ? "block" : "none";

    clock1.label.textContent = cityOf(state.tz1);
    clock1.time.textContent = formatClock(state.tz1);

    clock2.label.textContent = cityOf(state.tz2);
    clock2.time.textContent = formatClock(state.tz2);

    const { pomodoro } = state;
    pomoMode.textContent = pomodoro.mode === "work" ? "Foco" : "Pausa";
    const remaining = pomodoro.running
      ? Math.max(0, (pomodoro.endAt ?? Date.now()) - Date.now())
      : pomodoro.remainingMs;
    pomoTime.textContent = formatDuration(remaining);
    playPauseBtn.innerHTML = pomodoro.running
      ? '<span class="pause-icon"><span></span><span></span></span>'
      : "▶";
  }

  chrome.storage.local.get(null).then((data) => {
    state = { ...state, ...data };
    document.documentElement.appendChild(host);
    render();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    for (const [key, { newValue }] of Object.entries(changes)) {
      state[key] = newValue;
    }
    render();
  });

  setInterval(render, 1000);
})();
