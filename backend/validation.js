const IKARIAM_HOST = /^(?:[a-z0-9-]+\.)*ikariam\.gameforge\.com$/i;

function cleanString(value, maxLength) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
}

function validatePayload(body) {
  const errors = [];
  const playerId = cleanString(body?.playerId, 80);
  const playerName = cleanString(body?.playerName, 120);
  const server = cleanString(body?.server, 255)?.toLowerCase() || null;
  const worldId = cleanString(body?.worldId, 80);
  const coordinates = cleanString(body?.coordinates, 20);
  const sourceUrl = cleanString(body?.sourceUrl, 1000);
  const points = body?.points;
  const captured = new Date(body?.capturedAt);
  const leaderboard = [];

  if (!playerId && !playerName) errors.push("playerId ili playerName je obavezan");
  if (!server || !IKARIAM_HOST.test(server)) errors.push("server mora biti Ikariam Gameforge hostname");
  if (!Number.isSafeInteger(points) || points < 0 || points > 999_999_999_999) errors.push("points mora biti nenegativan cijeli broj");
  if (coordinates && !/^\d{1,3}:\d{1,3}$/.test(coordinates)) errors.push("coordinates mora biti u formatu X:Y");
  if (body?.leaderboard !== undefined && !Array.isArray(body.leaderboard)) {
    errors.push("leaderboard mora biti lista");
  } else if (Array.isArray(body?.leaderboard)) {
    if (body.leaderboard.length > 10) errors.push("leaderboard može imati najviše 10 igrača");
    for (const [index, entry] of body.leaderboard.slice(0, 10).entries()) {
      const rank = entry?.rank;
      const name = cleanString(entry?.playerName, 120);
      const score = entry?.points;
      const cityId = cleanString(entry?.cityId, 30);
      const entryCoordinates = cleanString(entry?.coordinates, 20);
      const alliance = cleanString(entry?.alliance, 80);
      if (!Number.isSafeInteger(rank) || rank < 1 || !name || !Number.isSafeInteger(score) || score < 0) {
        errors.push(`leaderboard zapis ${index + 1} nije ispravan`);
        continue;
      }
      if (cityId && !/^\d+$/.test(cityId)) errors.push(`leaderboard cityId ${index + 1} nije ispravan`);
      if (entryCoordinates && !/^\d{1,3}:\d{1,3}$/.test(entryCoordinates)) {
        errors.push(`leaderboard koordinate ${index + 1} nisu ispravne`);
      }
      leaderboard.push({
        rank,
        playerName: name,
        points: score,
        cityId: cityId || null,
        coordinates: entryCoordinates || null,
        alliance: alliance || null
      });
    }
  }
  if (!body?.capturedAt || Number.isNaN(captured.getTime())) errors.push("capturedAt mora biti ispravan datum");
  if (sourceUrl) {
    try {
      const url = new URL(sourceUrl);
      if (url.protocol !== "https:" || !IKARIAM_HOST.test(url.hostname)) errors.push("sourceUrl mora biti Ikariam HTTPS URL");
    } catch {
      errors.push("sourceUrl nije ispravan URL");
    }
  }

  return {
    errors,
    value: {
      playerId, playerName, server, worldId, coordinates, points, leaderboard,
      capturedAt: Number.isNaN(captured.getTime()) ? null : captured.toISOString(),
      sourceUrl
    }
  };
}

module.exports = { validatePayload, IKARIAM_HOST };
