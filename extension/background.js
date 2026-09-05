const extensionApi = globalThis.browser ?? globalThis.chrome;

function getSettings() {
  if (globalThis.browser?.storage) {
    return globalThis.browser.storage.sync.get({ backendUrl: "http://localhost:8787", ingestKey: "" });
  }
  return new Promise((resolve) => globalThis.chrome.storage.sync.get(
    { backendUrl: "http://localhost:8787", ingestKey: "" }, resolve
  ));
}

async function postPoints(payload) {
  try {
    const settings = await getSettings();
    const backendUrl = settings.backendUrl.replace(/\/+$/, "");
    const response = await fetch(`${backendUrl}/api/pirate-points`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(settings.ingestKey ? { "X-Ingest-Key": settings.ingestKey } : {})
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const details = await response.text();
      return { ok: false, error: `Backend ${response.status}: ${details.slice(0, 300)}` };
    }
    return { ok: true, status: response.status };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

extensionApi.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "SEND_POINTS") return undefined;
  const task = postPoints(message.payload);
  if (globalThis.browser?.runtime) return task;
  task.then(sendResponse);
  return true;
});
