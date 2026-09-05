const code = document.querySelector("#bookmarkletCode");
const link = document.querySelector("#bookmarkletLink");
const copy = document.querySelector("#copyBookmarklet");
const key = document.querySelector("#ingestKey");
const notice = document.querySelector("#notice");
let source = "";

async function build() {
  if (!source) source = await fetch("/mobile-bookmarklet.js", { cache: "no-store" }).then((response) => response.text());
  const configured = source
    .replace('"__BACKEND_ORIGIN__"', JSON.stringify(location.origin))
    .replace('"__INGEST_KEY__"', JSON.stringify(key.value.trim()));
  const value = `javascript:${encodeURIComponent(configured)}`;
  code.value = value;
  link.href = value;
}

copy.addEventListener("click", async () => {
  await build();
  await navigator.clipboard.writeText(code.value);
  copy.textContent = "Kopirano";
  setTimeout(() => { copy.textContent = "Kopiraj kod"; }, 1800);
});
key.addEventListener("input", build);

if (location.protocol !== "https:" && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
  notice.textContent = "Za slanje iz HTTPS Ikariam stranice backend također mora koristiti HTTPS adresu.";
  notice.className = "notice error";
}
build().catch(() => {
  notice.textContent = "Kod se nije mogao pripremiti. Osvježi stranicu.";
  notice.className = "notice error";
});
