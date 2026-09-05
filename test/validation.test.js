const test = require("node:test");
const assert = require("node:assert/strict");
const { validatePayload } = require("../backend/validation");
const { PointsStore } = require("../backend/store");

const valid = {
  playerId: "123", playerName: "Kapetan", server: "s1-ba.ikariam.gameforge.com",
  points: 32192, coordinates: "2:15", capturedAt: "2026-09-05T12:00:00.000Z",
  sourceUrl: "https://s1-ba.ikariam.gameforge.com/index.php?view=pirateFortress"
};

test("prihvata valjan Ikariam zapis", () => {
  const result = validatePayload(valid);
  assert.deepEqual(result.errors, []);
  assert.equal(result.value.points, 32192);
});

test("odbija tuđi server i neispravne poene", () => {
  const result = validatePayload({ ...valid, server: "evil.example", points: -1 });
  assert.equal(result.errors.length, 2);
});

test("odbija neispravan format koordinata", () => {
  const result = validatePayload({ ...valid, coordinates: "[2,15]" });
  assert.match(result.errors.join(" "), /coordinates/);
});

test("prihvata dnevnu rang-listu do 10 igrača", () => {
  const leaderboard = Array.from({ length: 10 }, (_, index) => ({
    rank: index + 1,
    playerName: `Igrač ${index + 1}`,
    points: 700000 - index * 1000,
    cityId: String(7000 + index),
    coordinates: `${index + 1}:15`,
    alliance: index === 0 ? "BAUN" : null
  }));
  const result = validatePayload({ ...valid, leaderboard });
  assert.deepEqual(result.errors, []);
  assert.equal(result.value.leaderboard.length, 10);
  assert.equal(result.value.leaderboard[0].coordinates, "1:15");
  assert.equal(result.value.leaderboard[0].alliance, "BAUN");
});

test("odbija rang-listu dužu od 10 igrača", () => {
  const leaderboard = Array.from({ length: 11 }, (_, index) => ({ rank: index + 1, playerName: "Igrač", points: 1 }));
  const result = validatePayload({ ...valid, leaderboard });
  assert.match(result.errors.join(" "), /najviše 10/);
});

test("odbija neispravne koordinate igrača rang-liste", () => {
  const leaderboard = [{ rank: 1, playerName: "Igrač", points: 10, cityId: "abc", coordinates: "2,15" }];
  const result = validatePayload({ ...valid, leaderboard });
  assert.match(result.errors.join(" "), /cityId/);
  assert.match(result.errors.join(" "), /koordinate/);
});

test("store deduplicira nepromijenjen rezultat", async () => {
  const store = new PointsStore("/tmp/unused-ikariam-test.json");
  store.persist = async () => {};
  const first = await store.upsert(valid);
  const second = await store.upsert(valid);
  assert.equal(first.deduplicated, false);
  assert.equal(second.deduplicated, true);
  assert.equal(store.latest().length, 1);
});

test("store ažurira koordinate i kada su poeni isti", async () => {
  const store = new PointsStore("/tmp/unused-ikariam-coordinates-test.json");
  store.persist = async () => {};
  await store.upsert(valid);
  const changed = await store.upsert({ ...valid, coordinates: "5:23" });
  assert.equal(changed.deduplicated, false);
  assert.equal(store.latest()[0].coordinates, "5:23");
});

test("store spaja rang-liste svih očitanih igrača na istom serveru", async () => {
  const store = new PointsStore("/tmp/unused-ikariam-merged-leaderboard-test.json");
  store.persist = async () => {};
  await store.upsert({
    ...valid,
    playerId: "1",
    leaderboard: [
      { rank: 74, playerName: "Ypy 1", points: 36348, cityId: "7001", coordinates: null, alliance: null },
      { rank: 75, playerName: "jepeta", points: 36144, cityId: "7002", coordinates: null, alliance: null }
    ]
  });
  await store.upsert({
    ...valid,
    playerId: "2",
    leaderboard: [
      { rank: 75, playerName: "jepeta", points: 36144, cityId: "7002", coordinates: "8:9", alliance: "ABC" },
      { rank: 76, playerName: "raganius", points: 35406, cityId: "7003", coordinates: null, alliance: null }
    ]
  });

  const [merged] = store.latestLeaderboards();
  assert.equal(merged.sources, 2);
  assert.deepEqual(merged.entries.map((entry) => entry.rank), [74, 75, 76]);
  assert.equal(merged.entries[1].coordinates, "8:9");
  assert.equal(merged.entries[1].alliance, "ABC");
});
