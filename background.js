chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    const data = await chrome.storage.local.get("tasks");
    if (!data.tasks) {
      await chrome.storage.local.set({ tasks: [] });
    }
  }
});
