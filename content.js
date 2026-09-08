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
  const OPACITY_LEVELS = [0, 20, 40, 60, 80, 100];

  const LANGUAGES = [
    { code: "en", nameKey: "langEnglish" },
    { code: "pt-BR", nameKey: "langPortugueseBR" },
  ];

  const TRANSLATIONS = {
    en: {
      timezoneLabel: "Timezone",
      searchPlaceholder: "Search city or timezone...",
      noResults: "No timezone found",
      focus: "Focus",
      break: "Break",
      startPause: "Start/Pause",
      reset: "Reset",
      hideBar: "Hide bar",
      languageLabel: "Language",
      langEnglish: "English",
      langPortugueseBR: "Portuguese (Brazil)",
      settingsLabel: "Appearance",
      barColorLabel: "Bar color",
      transparencyLabel: "Transparency",
      textColorLabel: "Text color",
      fontWhite: "White",
      fontBlack: "Black",
    },
    "pt-BR": {
      timezoneLabel: "Fuso horário",
      searchPlaceholder: "Buscar cidade ou fuso...",
      noResults: "Nenhum fuso encontrado",
      focus: "Foco",
      break: "Pausa",
      startPause: "Iniciar/Pausar",
      reset: "Reiniciar",
      hideBar: "Ocultar barra",
      languageLabel: "Idioma",
      langEnglish: "Inglês",
      langPortugueseBR: "Português (Brasil)",
      settingsLabel: "Aparência",
      barColorLabel: "Cor da barra",
      transparencyLabel: "Transparência",
      textColorLabel: "Cor da fonte",
      fontWhite: "Branco",
      fontBlack: "Preto",
    },
  };

  function t(key) {
    return TRANSLATIONS[state.lang]?.[key] ?? TRANSLATIONS.en[key];
  }

  let state = {
    barVisible: true,
    lang: "en",
    tz1: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    tz2: "UTC",
    barColor: "#3c3c3c",
    barOpacity: 100,
    fontColor: "white",
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
      border-right: 1px solid rgba(128, 128, 128, 0.4);
      white-space: nowrap;
      position: relative;
    }
    .segment:last-child { border-right: none; }
    .clock-label {
      opacity: 0.65;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .clock-time {
      font-variant-numeric: tabular-nums;
      font-weight: 600;
    }
    .clock-segment { cursor: pointer; }
    .clock-segment:hover { background: rgba(128, 128, 128, 0.18); }
    .pomo-mode {
      opacity: 0.65;
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
      color: inherit;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      border-radius: 4px;
      font-size: 11px;
    }
    button:hover { background: rgba(128, 128, 128, 0.22); }
    .close-btn { opacity: 0.65; }
    .pause-icon {
      display: inline-flex;
      gap: 2.5px;
    }
    .pause-icon span {
      width: 3px;
      height: 10px;
      background: currentColor;
      border-radius: 1px;
    }
    .settings-segment {
      cursor: pointer;
      padding-left: 9px;
      padding-right: 9px;
    }
    .settings-segment svg { display: block; }

    .popover {
      position: absolute;
      bottom: calc(100% + 6px);
      right: 0;
      background: #2f2f2f;
      color: #e5e5e5;
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
    .color-input {
      width: 100%;
      height: 28px;
      background: #1f1f1f;
      border: 1px solid #545454;
      border-radius: 4px;
      padding: 2px;
      cursor: pointer;
    }
    .chip-row {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .chip {
      padding: 4px 7px;
      border-radius: 4px;
      border: 1px solid #545454;
      cursor: pointer;
      font-size: 11px;
    }
    .chip:hover { background: rgba(255, 255, 255, 0.1); }
    .chip.selected { background: rgba(99, 102, 241, 0.35); border-color: #6366f1; font-weight: 600; }
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

  const SETTINGS_ICON_SVG = `
    <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
      <line x1="3" y1="5" x2="17" y2="5" />
      <circle cx="12" cy="5" r="2" fill="currentColor" stroke="none" />
      <line x1="3" y1="10" x2="17" y2="10" />
      <circle cx="7" cy="10" r="2" fill="currentColor" stroke="none" />
      <line x1="3" y1="15" x2="17" y2="15" />
      <circle cx="14" cy="15" r="2" fill="currentColor" stroke="none" />
    </svg>
  `;

  const clock1 = createClockSegment("tz1");
  const clock2 = createClockSegment("tz2");
  const langSegment = createLanguageSegment();
  const settingsSegment = createSettingsSegment();

  const pomoSegment = document.createElement("div");
  pomoSegment.className = "segment";
  const pomoMode = document.createElement("span");
  pomoMode.className = "pomo-mode";
  const pomoTime = document.createElement("span");
  pomoTime.className = "pomo-time";
  const playPauseBtn = document.createElement("button");
  const resetBtn = document.createElement("button");
  resetBtn.textContent = "⟲";
  pomoSegment.append(pomoMode, pomoTime, playPauseBtn, resetBtn);

  const closeSegment = document.createElement("div");
  closeSegment.className = "segment";
  const closeBtn = document.createElement("button");
  closeBtn.className = "close-btn";
  closeBtn.textContent = "✕";
  closeSegment.appendChild(closeBtn);

  bar.append(
    clock1.segment,
    clock2.segment,
    langSegment.segment,
    pomoSegment,
    settingsSegment.segment,
    closeSegment,
  );
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
    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.className = "tz-search";
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
        empty.textContent = t("noResults");
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

    return { segment, label, time, popover, popLabel, searchInput, renderOptions };
  }

  function createLanguageSegment() {
    const segment = document.createElement("div");
    segment.className = "segment clock-segment";
    const label = document.createElement("span");
    label.className = "clock-label";
    segment.appendChild(label);

    const popover = document.createElement("div");
    popover.className = "popover";
    const popLabel = document.createElement("label");
    const optionsList = document.createElement("div");
    optionsList.className = "tz-options";
    popover.append(popLabel, optionsList);
    segment.appendChild(popover);

    function renderOptions() {
      optionsList.innerHTML = "";
      for (const { code, nameKey } of LANGUAGES) {
        const item = document.createElement("div");
        item.className = "tz-option" + (code === state.lang ? " selected" : "");
        item.textContent = t(nameKey);
        item.addEventListener("click", () => {
          chrome.storage.local.set({ lang: code });
          popover.classList.remove("open");
        });
        optionsList.appendChild(item);
      }
    }

    segment.addEventListener("click", (e) => {
      if (popover.contains(e.target)) return;
      const wasOpen = popover.classList.contains("open");
      closeAllPopovers();
      if (!wasOpen) {
        popover.classList.add("open");
        renderOptions();
      }
    });

    return { segment, label, popover, popLabel, renderOptions };
  }

  function createSettingsSegment() {
    const segment = document.createElement("div");
    segment.className = "segment clock-segment settings-segment";
    segment.innerHTML = SETTINGS_ICON_SVG;
    segment.title = t("settingsLabel");

    const popover = document.createElement("div");
    popover.className = "popover";

    const colorLabel = document.createElement("label");
    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.className = "color-input";
    colorInput.addEventListener("input", () => {
      chrome.storage.local.set({ barColor: colorInput.value });
    });

    const opacityLabel = document.createElement("label");
    const opacityRow = document.createElement("div");
    opacityRow.className = "chip-row";

    const fontLabel = document.createElement("label");
    const fontRow = document.createElement("div");
    fontRow.className = "chip-row";

    popover.append(colorLabel, colorInput, opacityLabel, opacityRow, fontLabel, fontRow);
    segment.appendChild(popover);

    function renderOpacityChips() {
      opacityRow.innerHTML = "";
      for (const level of OPACITY_LEVELS) {
        const chip = document.createElement("div");
        chip.className = "chip" + (level === state.barOpacity ? " selected" : "");
        chip.textContent = `${level}%`;
        chip.addEventListener("click", () => chrome.storage.local.set({ barOpacity: level }));
        opacityRow.appendChild(chip);
      }
    }

    function renderFontChips() {
      fontRow.innerHTML = "";
      for (const value of ["white", "black"]) {
        const chip = document.createElement("div");
        chip.className = "chip" + (value === state.fontColor ? " selected" : "");
        chip.textContent = t(value === "white" ? "fontWhite" : "fontBlack");
        chip.addEventListener("click", () => chrome.storage.local.set({ fontColor: value }));
        fontRow.appendChild(chip);
      }
    }

    segment.addEventListener("click", (e) => {
      if (popover.contains(e.target)) return;
      const wasOpen = popover.classList.contains("open");
      closeAllPopovers();
      if (!wasOpen) {
        popover.classList.add("open");
        colorInput.value = state.barColor;
        renderOpacityChips();
        renderFontChips();
      }
    });

    return {
      segment,
      popover,
      colorLabel,
      opacityLabel,
      fontLabel,
      colorInput,
      renderOpacityChips,
      renderFontChips,
    };
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
      return new Intl.DateTimeFormat(state.lang, {
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

  function hexToRgb(hex) {
    const clean = hex.replace("#", "");
    const value = parseInt(clean, 16);
    return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
  }

  function applyBarTheme() {
    const { r, g, b } = hexToRgb(state.barColor || "#3c3c3c");
    const alpha = (state.barOpacity ?? 100) / 100;
    bar.style.background = `rgba(${r}, ${g}, ${b}, ${alpha})`;
    bar.style.color = state.fontColor === "black" ? "#000000" : "#ffffff";
  }

  function render() {
    host.style.display = state.barVisible ? "block" : "none";

    clock1.label.textContent = cityOf(state.tz1);
    clock1.time.textContent = formatClock(state.tz1);
    clock1.popLabel.textContent = t("timezoneLabel");
    clock1.searchInput.placeholder = t("searchPlaceholder");

    clock2.label.textContent = cityOf(state.tz2);
    clock2.time.textContent = formatClock(state.tz2);
    clock2.popLabel.textContent = t("timezoneLabel");
    clock2.searchInput.placeholder = t("searchPlaceholder");

    langSegment.label.textContent = state.lang === "pt-BR" ? "PT-BR" : "EN";
    langSegment.popLabel.textContent = t("languageLabel");

    settingsSegment.segment.title = t("settingsLabel");
    settingsSegment.colorLabel.textContent = t("barColorLabel");
    settingsSegment.opacityLabel.textContent = t("transparencyLabel");
    settingsSegment.fontLabel.textContent = t("textColorLabel");
    if (settingsSegment.popover.classList.contains("open")) {
      settingsSegment.colorInput.value = state.barColor;
      settingsSegment.renderOpacityChips();
      settingsSegment.renderFontChips();
    }
    applyBarTheme();

    const { pomodoro } = state;
    pomoMode.textContent = pomodoro.mode === "work" ? t("focus") : t("break");
    const remaining = pomodoro.running
      ? Math.max(0, (pomodoro.endAt ?? Date.now()) - Date.now())
      : pomodoro.remainingMs;
    pomoTime.textContent = formatDuration(remaining);
    playPauseBtn.innerHTML = pomodoro.running
      ? '<span class="pause-icon"><span></span><span></span></span>'
      : "▶";
    playPauseBtn.title = t("startPause");
    resetBtn.title = t("reset");
    closeBtn.title = t("hideBar");
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
