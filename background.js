const WORK_MS = 25 * 60 * 1000;
const BREAK_MS = 5 * 60 * 1000;
const ALARM_NAME = "pomodoro";

const DEFAULT_STATE = {
  barVisible: true,
  tz1: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  tz2: "UTC",
  pomodoro: {
    mode: "work", // "work" | "break"
    running: false,
    endAt: null, // epoch ms, only meaningful while running
    remainingMs: WORK_MS,
  },
};

async function getState() {
  const data = await chrome.storage.local.get(Object.keys(DEFAULT_STATE));
  return {
    barVisible: data.barVisible ?? DEFAULT_STATE.barVisible,
    tz1: data.tz1 ?? DEFAULT_STATE.tz1,
    tz2: data.tz2 ?? DEFAULT_STATE.tz2,
    pomodoro: data.pomodoro ?? DEFAULT_STATE.pomodoro,
  };
}

function durationFor(mode) {
  return mode === "work" ? WORK_MS : BREAK_MS;
}

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    await chrome.storage.local.set(DEFAULT_STATE);
  }
});

chrome.action.onClicked.addListener(async () => {
  const { barVisible } = await getState();
  await chrome.storage.local.set({ barVisible: !barVisible });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse);
  return true; // keep the message channel open for the async response
});

async function handleMessage(message) {
  const { pomodoro } = await getState();

  switch (message?.type) {
    case "pomodoro:start": {
      const remaining = pomodoro.running
        ? pomodoro.remainingMs
        : pomodoro.remainingMs || durationFor(pomodoro.mode);
      const endAt = Date.now() + remaining;
      const next = { ...pomodoro, running: true, endAt, remainingMs: remaining };
      await chrome.storage.local.set({ pomodoro: next });
      await chrome.alarms.create(ALARM_NAME, { when: endAt });
      return next;
    }
    case "pomodoro:pause": {
      if (!pomodoro.running) return pomodoro;
      const remaining = Math.max(0, (pomodoro.endAt ?? Date.now()) - Date.now());
      const next = { ...pomodoro, running: false, endAt: null, remainingMs: remaining };
      await chrome.storage.local.set({ pomodoro: next });
      await chrome.alarms.clear(ALARM_NAME);
      return next;
    }
    case "pomodoro:reset": {
      const next = {
        mode: "work",
        running: false,
        endAt: null,
        remainingMs: WORK_MS,
      };
      await chrome.storage.local.set({ pomodoro: next });
      await chrome.alarms.clear(ALARM_NAME);
      return next;
    }
    default:
      return null;
  }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;

  const { pomodoro } = await getState();
  const nextMode = pomodoro.mode === "work" ? "break" : "work";
  const next = {
    mode: nextMode,
    running: false,
    endAt: null,
    remainingMs: durationFor(nextMode),
  };
  await chrome.storage.local.set({ pomodoro: next });

  const title = nextMode === "break" ? "Hora da pausa ☕" : "Hora de focar 🎯";
  const message =
    nextMode === "break"
      ? "Você completou um ciclo de foco. Descanse 5 minutos."
      : "A pausa acabou. Bora focar por 25 minutos.";

  chrome.notifications?.create({
    type: "basic",
    iconUrl: "icons/icon128.png",
    title,
    message,
    priority: 1,
  });
});
