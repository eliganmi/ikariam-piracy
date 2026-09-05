(() => {
  "use strict";

  const PIRATE_WORDS = [
    "gusarska tvrđava", "gusarska tvrdjava", "gusarski poeni", "pirate fortress",
    "pirate points", "piratenfestung", "piratenpunkte", "forteresse pirate",
    "points de piraterie", "fortaleza pirata", "puntos de piratería",
    "osvajački bodovi", "osvajacki bodovi"
  ];
  const EXACT_POINTS_SELECTOR = "#pirateFortress .pirateHeader > ul.resources > li.capturePoints > span.value";
  const FORTRESS_MARKERS = [
    "#pirateFortress", "#pirateFortressContainer", "[data-view*='pirate' i]",
    "[data-building*='pirate' i]", "[id*='pirateFortress' i]", ".pirateHeader",
    "li.capturePoints"
  ];
  const POINT_SELECTORS = [
    ".pirateHeader > ul.resources > li.capturePoints > span.value",
    ".pirateHeader .resources .capturePoints > .value",
    "#pirateFortress li.capturePoints span.value", ".pirateHeader li.capturePoints .value",
    "li.capturePoints span.value", ".capturePoints .value", "[class~='capturePoints'] [class~='value']",
    "#piratePoints", "#piracyPoints", "[data-pirate-points]", "[data-points][data-type*='pirate' i]",
    "[name='piratePoints']", "[id*='pirate'][id*='point' i]", "[class*='pirate'][class*='point' i]",
    "[aria-label*='pirate point' i]", "[aria-label*='gusars' i]"
  ];
  const PLAYER_ID_SELECTORS = ["[data-player-id]", "[data-playerid]", "meta[name='player-id']"];
  const PLAYER_NAME_SELECTORS = [
    ".avatarName a[href*='optionsAccount'][title]", "#pirateHighscore li.player.bold .userName[title]",
    "[data-player-name]", "meta[name='player-name']", "#playerName", ".playerName",
    "[class*='avatarName']", "[class*='playerName']"
  ];
  const storage = globalThis.browser?.storage ?? globalThis.chrome?.storage;
  let scanTimer;
  let lastUrl = location.href;
  let inFlightKey = "";
  let statusTimer;
  let leaderboardReadPromise;
  const COORDINATE_CACHE_MS = 7 * 24 * 60 * 60 * 1000;

  function showStatus(message, type = "info", persist = false) {
    let badge = document.querySelector("#ikariam-points-extension-status");
    if (!badge) {
      badge = document.createElement("div");
      badge.id = "ikariam-points-extension-status";
      Object.assign(badge.style, {
        position: "fixed", right: "16px", bottom: "16px", zIndex: "2147483647",
        padding: "10px 14px", borderRadius: "7px", color: "white",
        font: "600 13px/1.35 system-ui, sans-serif", boxShadow: "0 4px 18px #0006",
        maxWidth: "360px", cursor: "default"
      });
      document.documentElement.append(badge);
    }
    const colors = { info: "#315b8a", pending: "#986617", success: "#347252", error: "#a13f32" };
    badge.style.background = colors[type] || colors.info;
    badge.textContent = `Ikariam poeni: ${message}`;
    badge.hidden = false;
    clearTimeout(statusTimer);
    if (!persist) statusTimer = setTimeout(() => { badge.hidden = true; }, 6000);
  }

  function normalizedText(node) {
    return (node?.textContent || node?.getAttribute?.("content") || "").replace(/\s+/g, " ").trim();
  }

  function parsePoints(raw) {
    if (!raw) return null;
    const matches = String(raw).match(/\d[\d\s.,'’]*/g);
    if (!matches) return null;
    for (const candidate of matches) {
      const digits = candidate.replace(/\D/g, "");
      if (digits && digits.length <= 12) {
        const value = Number(digits);
        if (Number.isSafeInteger(value)) return value;
      }
    }
    return null;
  }

  function visible(node) {
    if (!(node instanceof Element)) return false;
    const style = getComputedStyle(node);
    return style.display !== "none" && style.visibility !== "hidden" && node.getClientRects().length > 0;
  }

  function isFortressOpen() {
    if (document.querySelector(EXACT_POINTS_SELECTOR)) return true;
    const url = `${location.pathname}${location.search}${location.hash}`.toLowerCase();
    if (/pirate|piracy/.test(url)) return true;
    if (FORTRESS_MARKERS.some((selector) => document.querySelector(selector))) return true;
    return [...document.querySelectorAll("h1,h2,h3,.title,.header,[role='heading']")]
      .filter(visible)
      .some((node) => PIRATE_WORDS.some((word) => normalizedText(node).toLowerCase().includes(word)));
  }

  function fortressRoot() {
    for (const selector of FORTRESS_MARKERS) {
      const node = document.querySelector(selector);
      if (node && visible(node)) return node;
    }
    const heading = [...document.querySelectorAll("h1,h2,h3,.title,.header,[role='heading']")]
      .find((node) => visible(node) && PIRATE_WORDS.some((word) => normalizedText(node).toLowerCase().includes(word)));
    return heading?.closest("section,article,dialog,.window,.content,.building") || document.body;
  }

  function pointsFromLabel(root) {
    const nodes = root.querySelectorAll("label,dt,th,strong,span,div,p");
    for (const label of nodes) {
      const text = normalizedText(label).toLowerCase();
      if (!PIRATE_WORDS.some((word) => text.includes(word)) || !visible(label)) continue;
      const candidates = [
        label.getAttribute("data-value"), label.nextElementSibling?.textContent,
        label.parentElement?.querySelector("dd,.value,[class*='value'],[data-value]")?.textContent,
        label.textContent?.replace(/^[^:]*:/, "")
      ];
      for (const candidate of candidates) {
        const value = parsePoints(candidate);
        if (value !== null) return value;
      }
    }
    return null;
  }

  function findPoints() {
    const exactNode = document.querySelector(EXACT_POINTS_SELECTOR);
    const exactValue = parsePoints(exactNode?.textContent);
    if (exactValue !== null) return exactValue;
    const root = fortressRoot();
    for (const selector of POINT_SELECTORS) {
      for (const node of root.querySelectorAll(selector)) {
        if (!visible(node)) continue;
        const value = parsePoints(node.getAttribute("data-pirate-points") || node.getAttribute("data-points") || normalizedText(node));
        if (value !== null) return value;
      }
    }
    return pointsFromLabel(root);
  }

  function firstValue(selectors, attributes = []) {
    for (const selector of selectors) {
      const node = document.querySelector(selector);
      if (!node) continue;
      for (const attribute of attributes) {
        const value = node.getAttribute(attribute);
        if (value?.trim()) return value.trim();
      }
      const text = normalizedText(node);
      if (text) return text;
    }
    return null;
  }

  function inlineConfigValue(name) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`\\b${escaped}\\s*:\\s*['\"]([^'\"]+)['\"]`);
    for (const script of document.scripts) {
      const match = script.textContent?.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  function currentCityCoordinates() {
    const selectors = [
      "#js_citySelectContainer .dropDownButton.ownCity.coords a",
      "#js_citySelectContainer .dropDownButton.coords a",
      "#js_islandBreadCoords"
    ];
    for (const selector of selectors) {
      const node = document.querySelector(selector);
      const raw = node?.getAttribute("title") || normalizedText(node);
      const match = raw?.match(/\[?\s*(\d{1,3})\s*:\s*(\d{1,3})\s*\]?/);
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

  function parseCoordinates(raw) {
    const match = raw?.match(/\[?\s*(\d{1,3})\s*:\s*(\d{1,3})\s*\]?/);
    return match ? `${Number(match[1])}:${Number(match[2])}` : null;
  }

  function cityDetailsFromResponse(rawHtml, cityId) {
    let backgroundData = null;

    function findBackgroundData(value) {
      if (!Array.isArray(value)) return null;
      if (value[0] === "updateBackgroundData" && value[1] && typeof value[1] === "object") return value[1];
      for (const item of value) {
        const found = findBackgroundData(item);
        if (found) return found;
      }
      return null;
    }

    try { backgroundData = findBackgroundData(JSON.parse(rawHtml)); } catch {}
    const commandMatch = rawHtml.match(/\["updateBackgroundData"\s*,\s*(\{[\s\S]*?\})\s*\]\s*,\s*\["updateTemplateData"/);
    if (commandMatch) {
      try { backgroundData = JSON.parse(commandMatch[1]); } catch {}
    }
    const cities = Array.isArray(backgroundData?.cities)
      ? backgroundData.cities
      : Object.values(backgroundData?.cities || {});
    const city = cities.find((item) => String(item?.id ?? item?.cityId) === String(cityId));
    const dataX = backgroundData?.xCoord ?? backgroundData?.islandXCoord ?? city?.xCoord;
    const dataY = backgroundData?.yCoord ?? backgroundData?.islandYCoord ?? city?.yCoord;
    if (city && dataX !== undefined && dataY !== undefined) {
      return {
        coordinates: `${Number(dataX)}:${Number(dataY)}`,
        alliance: city.ownerAllyTag || city.allyTag || city.allianceTag || null,
        allianceResolved: true
      };
    }

    const parsed = new DOMParser().parseFromString(rawHtml, "text/html");
    const visibleValue = parsed.querySelector("#js_islandBreadCoords")?.textContent;
    const fromElement = parseCoordinates(visibleValue);
    const x = rawHtml.match(/["']?islandXCoord["']?\s*[:=]\s*["']?(\d{1,3})/i)?.[1];
    const y = rawHtml.match(/["']?islandYCoord["']?\s*[:=]\s*["']?(\d{1,3})/i)?.[1];
    return {
      coordinates: fromElement || (x && y ? `${Number(x)}:${Number(y)}` : null),
      alliance: null,
      allianceResolved: false
    };
  }

  async function fetchCityDetails(cityId) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const url = new URL("/index.php", location.origin);
      url.searchParams.set("view", "island");
      url.searchParams.set("cityId", cityId);
      const response = await fetch(url, {
        method: "GET",
        credentials: "same-origin",
        headers: { Accept: "application/json,text/html,application/xhtml+xml", "X-Requested-With": "XMLHttpRequest" },
        signal: controller.signal
      });
      if (!response.ok) return null;
      return cityDetailsFromResponse(await response.text(), cityId);
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function addLeaderboardDetails(entries) {
    const state = await new Promise((resolve) => storage.local.get({ cityCoordinateCache: {} }, resolve));
    const cache = state.cityCoordinateCache;
    const now = Date.now();
    const pending = [];
    for (const entry of entries) {
      if (!entry.cityId) continue;
      const key = `${location.hostname}|${entry.cityId}`;
      const cached = cache[key];
      if (cached?.coordinates && cached.allianceResolved && now - cached.savedAt < COORDINATE_CACHE_MS) {
        entry.coordinates = cached.coordinates;
        entry.alliance = cached.alliance || null;
      } else {
        pending.push({ entry, key });
      }
    }

    let cursor = 0;
    async function worker() {
      while (cursor < pending.length) {
        const item = pending[cursor++];
        const details = await fetchCityDetails(item.entry.cityId);
        if (!details?.coordinates) continue;
        item.entry.coordinates = details.coordinates;
        item.entry.alliance = details.alliance || null;
        cache[item.key] = { ...details, savedAt: now };
      }
    }
    await Promise.all(Array.from({ length: Math.min(3, pending.length) }, worker));
    if (pending.length) {
      const trimmed = Object.fromEntries(Object.entries(cache).slice(-500));
      await new Promise((resolve) => storage.local.set({ cityCoordinateCache: trimmed }, resolve));
    }
    return entries;
  }

  async function collectLeaderboard() {
    const entries = [];
    for (const row of document.querySelectorAll("#pirateHighscore > li")) {
      const rank = parsePoints(row.querySelector(".place")?.textContent);
      const rankingPoints = parsePoints(row.querySelector(".pirateBooty")?.textContent);
      const nameNode = row.querySelector(".userName");
      const playerName = (nameNode?.getAttribute("title") || normalizedText(nameNode)).trim();
      if (rank === null || rankingPoints === null || !playerName) continue;
      const link = row.querySelector("a.userName[onclick], a.userName[href], .userName[onclick], .userName[href]");
      const linkData = link?.getAttribute("onclick") || link?.getAttribute("href") || "";
      const ownRow = row.matches("li.player");
      const cityId = linkData.match(/\bcityId(?:=|%3D)(\d+)/i)?.[1] || (ownRow ? currentCityId() : null);
      entries.push({
        rank,
        playerName: playerName.slice(0, 120),
        points: rankingPoints,
        cityId,
        coordinates: ownRow ? currentCityCoordinates() : null,
        alliance: null
      });
      if (entries.length === 10) break;
    }
    return addLeaderboardDetails(entries);
  }

  function readLeaderboard() {
    if (!leaderboardReadPromise) {
      leaderboardReadPromise = collectLeaderboard().finally(() => { leaderboardReadPromise = null; });
    }
    return leaderboardReadPromise;
  }

  function identifyPlayer() {
    let playerId = firstValue(PLAYER_ID_SELECTORS, ["data-player-id", "data-playerid", "content"]);
    if (!playerId) playerId = inlineConfigValue("avatarId");
    const playerName = firstValue(PLAYER_NAME_SELECTORS, ["data-player-name", "content", "title"]);
    const url = new URL(location.href);
    return {
      playerId: playerId ? String(playerId).slice(0, 80) : null,
      playerName: playerName ? String(playerName).slice(0, 120) : null,
      server: location.hostname.toLowerCase(),
      worldId: url.searchParams.get("world") || document.documentElement.dataset.worldId || inlineConfigValue("serverName") || null,
      coordinates: currentCityCoordinates()
    };
  }

  function sendToBackend(payload) {
    if (globalThis.browser?.runtime) return globalThis.browser.runtime.sendMessage({ type: "SEND_POINTS", payload });
    return new Promise((resolve, reject) => {
      globalThis.chrome.runtime.sendMessage({ type: "SEND_POINTS", payload }, (response) => {
        const error = globalThis.chrome.runtime.lastError;
        if (error) reject(new Error(error.message)); else resolve(response);
      });
    });
  }

  async function sendIfChanged() {
    if (!isFortressOpen()) return;
    const points = findPoints();
    if (points === null) return;
    const identity = identifyPlayer();
    const leaderboard = await readLeaderboard();
    if (!identity.playerId && !identity.playerName) identity.playerName = "Nepoznat igrač";
    const playerKey = `${identity.server}|${identity.playerId || identity.playerName}`;
    const leaderboardState = leaderboard
      .map((entry) => `${entry.rank}:${entry.playerName}:${entry.points}:${entry.coordinates || ""}:${entry.alliance || ""}`)
      .join(";");
    const pointState = `${points}|${identity.coordinates || ""}|${leaderboardState}`;
    const dedupeKey = `${playerKey}|${pointState}`;
    const state = await new Promise((resolve) => storage.local.get({ lastPointsByPlayerV2: {} }, resolve));
    if (state.lastPointsByPlayerV2[playerKey] === pointState || inFlightKey === dedupeKey) return;

    inFlightKey = dedupeKey;
    try {
      const response = await sendToBackend({
          ...identity,
          points,
          leaderboard,
          capturedAt: new Date().toISOString(),
          sourceUrl: `${location.origin}${location.pathname}`
      });
      if (!response?.ok) throw new Error(response?.error || "Backend nije dostupan");
      const next = { ...state.lastPointsByPlayerV2 };
      delete next[playerKey];
      next[playerKey] = pointState;
      const entries = Object.entries(next).slice(-100);
      await new Promise((resolve) => storage.local.set({ lastPointsByPlayerV2: Object.fromEntries(entries) }, resolve));
      console.info("[Ikariam poeni] Poslano:", points);
      showStatus(`očitano i poslano ${points.toLocaleString()}`, "success");
    } catch (error) {
      console.warn("[Ikariam poeni] Slanje nije uspjelo; pokušat će ponovo.", error);
    } finally {
      inFlightKey = "";
    }
  }

  function scheduleScan() {
    if (scanTimer) return;
    scanTimer = setTimeout(() => {
      scanTimer = null;
      sendIfChanged();
    }, 700);
  }

  new MutationObserver(scheduleScan).observe(document.documentElement, {
    childList: true, subtree: true, characterData: true, attributes: true,
    attributeFilter: ["class", "style", "data-pirate-points", "data-points"]
  });
  setInterval(() => {
    if (location.href !== lastUrl) lastUrl = location.href;
    scheduleScan();
  }, 2500);
  scheduleScan();
})();
