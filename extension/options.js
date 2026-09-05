const storage = globalThis.browser?.storage ?? globalThis.chrome?.storage;
const form = document.querySelector("#settings");
const backendUrl = document.querySelector("#backendUrl");
const ingestKey = document.querySelector("#ingestKey");
const status = document.querySelector("#status");

storage.sync.get({ backendUrl: "http://localhost:8787", ingestKey: "" }, (value) => {
  backendUrl.value = value.backendUrl;
  ingestKey.value = value.ingestKey;
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  storage.sync.set({ backendUrl: backendUrl.value.replace(/\/+$/, ""), ingestKey: ingestKey.value }, () => {
    status.textContent = "Sačuvano.";
    setTimeout(() => { status.textContent = ""; }, 1500);
  });
});
