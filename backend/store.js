const fs = require("node:fs/promises");
const path = require("node:path");

class PointsStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.records = new Map();
    this.writeQueue = Promise.resolve();
  }

  async load() {
    try {
      const parsed = JSON.parse(await fs.readFile(this.filePath, "utf8"));
      for (const record of parsed.records || []) this.records.set(record.key, record);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }

  keyFor(input) {
    const identity = input.playerId ? `id:${input.playerId}` : `name:${input.playerName.toLocaleLowerCase("bs")}`;
    return `${input.server}|${identity}`;
  }

  async upsert(input) {
    const key = this.keyFor(input);
    const previous = this.records.get(key);
    const leaderboard = input.leaderboard || [];
    if (
      previous?.points === input.points &&
      previous?.coordinates === (input.coordinates || null) &&
      JSON.stringify(previous?.leaderboard || []) === JSON.stringify(leaderboard)
    ) {
      return { record: previous, deduplicated: true };
    }

    const record = {
      key,
      server: input.server,
      worldId: input.worldId || null,
      playerId: input.playerId || null,
      playerName: input.playerName || null,
      coordinates: input.coordinates || null,
      points: input.points,
      leaderboard,
      capturedAt: input.capturedAt,
      receivedAt: new Date().toISOString(),
      sourceUrl: input.sourceUrl || null
    };
    this.records.set(key, record);
    await this.persist();
    return { record, deduplicated: false };
  }

  latest() {
    return [...this.records.values()].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  }

  latestLeaderboards() {
    const groups = new Map();
    for (const record of this.latest()) {
      if (!record.leaderboard?.length) continue;
      const key = `${record.server}|${record.worldId || ""}`;
      let group = groups.get(key);
      if (!group) {
        group = {
          server: record.server,
          worldId: record.worldId,
          capturedAt: record.capturedAt,
          receivedAt: record.receivedAt,
          sources: 0,
          players: new Map()
        };
        groups.set(key, group);
      }
      group.sources += 1;
      for (const entry of record.leaderboard) {
        const playerKey = entry.playerName.trim().toLocaleLowerCase("bs");
        const existing = group.players.get(playerKey);
        if (!existing) {
          group.players.set(playerKey, { ...entry });
          continue;
        }
        if (!existing.cityId && entry.cityId) existing.cityId = entry.cityId;
        if (!existing.coordinates && entry.coordinates) existing.coordinates = entry.coordinates;
        if (!existing.alliance && entry.alliance) existing.alliance = entry.alliance;
      }
    }
    return [...groups.values()].map((group) => ({
      server: group.server,
      worldId: group.worldId,
      capturedAt: group.capturedAt,
      receivedAt: group.receivedAt,
      sources: group.sources,
      entries: [...group.players.values()].sort((a, b) =>
        a.rank - b.rank || b.points - a.points || a.playerName.localeCompare(b.playerName, "bs")
      )
    }));
  }

  persist() {
    this.writeQueue = this.writeQueue.then(async () => {
      const directory = path.dirname(this.filePath);
      await fs.mkdir(directory, { recursive: true });
      const temporary = `${this.filePath}.tmp`;
      await fs.writeFile(temporary, JSON.stringify({ records: this.latest() }, null, 2), "utf8");
      await fs.rename(temporary, this.filePath);
    });
    return this.writeQueue;
  }
}

module.exports = { PointsStore };
