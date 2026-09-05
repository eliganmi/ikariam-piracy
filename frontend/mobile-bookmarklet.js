(async () => {
  "use strict";

  const BACKEND_ORIGIN = "__BACKEND_ORIGIN__";
  const INGEST_KEY = "__INGEST_KEY__";
  const IKARIAM_HOST = /^(?:[a-z0-9-]+\.)*ikariam\.gameforge\.com$/i;
  const statusId = "ikariam-mobile-collector-status";

  function status(message, type = "pending") {
    let badge = document.getElementById(statusId);
    if (!badge) {
      badge = document.createElement("div");
      badge.id = statusId;
      Object.assign(badge.style, {
        position: "fixed", right: "12px", bottom: "12px", zIndex: "2147483647",
        maxWidth: "calc(100vw - 24px)", padding: "11px 14px", borderRadius: "8px",
        color: "white", font: "600 14px/1.35 system-ui,sans-serif", boxShadow: "0 4px 18px #0007"
      });
      document.documentElement.append(badge);
    }
    badge.style.background = type === "success" ? "#347252" : type === "error" ? "#a13f32" : "#986617";
    badge.textContent = `Ikariam poeni: ${message}`;
    if (type !== "pending") setTimeout(() => badge.remove(), 8000);
  }

  function text(node) {
    return (node?.textContent || "").replace(/\s+/g, " ").trim();
  }

  function number(raw) {
    const value = String(raw || "").match(/\d[\d\s.,'’]*/)?.[0]?.replace(/\D/g, "");
    return value && Number.isSafeInteger(Number(value)) ? Number(value) : null;
  }

  function inlineValue(name) {
    const pattern = new RegExp(`\\b${name}\\s*:\\s*['\"]([^'\"]+)['\"]`);
    for (const script of document.scripts) {
      const match = script.textContent?.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  function coordinates() {
    for (const selector of [
      "#js_citySelectContainer .dropDownButton.ownCity.coords a",
      "#js_citySelectContainer .dropDownButton.coords a",
      "#js_islandBreadCoords"
    ]) {
      const node = document.querySelector(selector);
      const match = (node?.getAttribute("title") || text(node)).match(/\[?\s*(\d{1,3})\s*:\s*(\d{1,3})\s*\]?/);
      if (match) return `${Number(match[1])}:${Number(match[2])}`;
    }
    return null;
  }

  function currentCityId() {
    const fromUrl = new URL(location.href).searchParams.get("cityId");
    if (fromUrl && /^\d+$/.test(fromUrl)) return fromUrl;
    for (const script of document.scripts) {
      const match = script.textContent?.match(/\bcurrentCityId\s*:\s*['"]?(\d+)/);
      if (match) return match[1];
    }
    return null;
  }

  function cityDetails(raw, cityId) {
    function find(value) {
      if (!Array.isArray(value)) return null;
      if (value[0] === "updateBackgroundData" && value[1] && typeof value[1] === "object") return value[1];
      for (const item of value) {
        const found = find(item);
        if (found) return found;
      }
      return null;
    }
    let data = null;
    try { data = find(JSON.parse(raw)); } catch {}
    const command = raw.match(/\["updateBackgroundData"\s*,\s*(\{[\s\S]*?\})\s*\]\s*,\s*\["updateTemplateData"/);
    if (!data && command) {
      try { data = JSON.parse(command[1]); } catch {}
    }
    const cities = Array.isArray(data?.cities) ? data.cities : Object.values(data?.cities || {});
    const city = cities.find((item) => String(item?.id ?? item?.cityId) === String(cityId));
    const x = data?.xCoord ?? data?.islandXCoord ?? city?.xCoord;
    const y = data?.yCoord ?? data?.islandYCoord ?? city?.yCoord;
    if (!city || x === undefined || y === undefined) return null;
    return {
      coordinates: `${Number(x)}:${Number(y)}`,
      alliance: city.ownerAllyTag || city.allyTag || city.allianceTag || null
    };
  }

  async function fetchDetails(cityId) {
    try {
      const url = new URL("/index.php", location.origin);
      url.searchParams.set("view", "island");
      url.searchParams.set("cityId", cityId);
      const response = await fetch(url, {
        credentials: "same-origin",
        headers: { Accept: "application/json,text/html", "X-Requested-With": "XMLHttpRequest" }
      });
      return response.ok ? cityDetails(await response.text(), cityId) : null;
    } catch {
      return null;
    }
  }

  async function leaderboard() {
    const entries = [];
    for (const row of document.querySelectorAll("#pirateHighscore > li")) {
      const rank = number(row.querySelector(".place")?.textContent);
      const points = number(row.querySelector(".pirateBooty")?.textContent);
      const nameNode = row.querySelector(".userName");
      const playerName = (nameNode?.getAttribute("title") || text(nameNode)).trim();
      if (rank === null || points === null || !playerName) continue;
      const link = row.querySelector("a.userName[onclick], a.userName[href], .userName[onclick], .userName[href]");
      const linkData = link?.getAttribute("onclick") || link?.getAttribute("href") || "";
      const own = row.matches("li.player");
      const cityId = linkData.match(/\bcityId(?:=|%3D)(\d+)/i)?.[1] || (own ? currentCityId() : null);
      entries.push({ rank, playerName: playerName.slice(0, 120), points, cityId, coordinates: own ? coordinates() : null, alliance: null });
      if (entries.length === 10) break;
    }
    let cursor = 0;
    async function worker() {
      while (cursor < entries.length) {
        const entry = entries[cursor++];
        if (!entry.cityId) continue;
        const details = await fetchDetails(entry.cityId);
        if (details) Object.assign(entry, details);
      }
    }
    await Promise.all(Array.from({ length: Math.min(3, entries.length) }, worker));
    return entries;
  }

  if (window.__ikariamMobileCollectorRunning) return status("očitavanje je već u toku");
  window.__ikariamMobileCollectorRunning = true;
  try {
    if (!IKARIAM_HOST.test(location.hostname)) throw new Error("otvori Ikariam prije pokretanja oznake");
    const points = number(document.querySelector("#pirateFortress .pirateHeader li.capturePoints span.value, .pirateHeader li.capturePoints .value")?.textContent);
    if (points === null) throw new Error("otvori Gusarsku tvrđavu pa pokušaj ponovo");
    status("očitavam poene, koordinate i saveze…");
    const nameNode = document.querySelector(".avatarName a[href*='optionsAccount'][title], #pirateHighscore li.player .userName");
    const payload = {
      playerId: inlineValue("avatarId"),
      playerName: nameNode?.getAttribute("title") || text(nameNode) || "Nepoznat igrač",
      server: location.hostname.toLowerCase(),
      worldId: inlineValue("serverName"),
      coordinates: coordinates(),
      points,
      leaderboard: await leaderboard(),
      capturedAt: new Date().toISOString(),
      sourceUrl: `${location.origin}${location.pathname}`
    };
    const headers = { "Content-Type": "application/json" };
    if (INGEST_KEY) headers["X-Ingest-Key"] = INGEST_KEY;
    const response = await fetch(`${BACKEND_ORIGIN}/api/pirate-points`, {
      method: "POST", headers, body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(`backend je vratio grešku ${response.status}`);
    status(`očitano i poslano ${points.toLocaleString()}`, "success");
  } catch (error) {
    status(error.message || "slanje nije uspjelo", "error");
  } finally {
    window.__ikariamMobileCollectorRunning = false;
  }
})();
