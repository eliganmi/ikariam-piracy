const body = document.querySelector("#players");
const template = document.querySelector("#row");
const connection = document.querySelector("#connection");
const count = document.querySelector("#count");
const leaderboardBody = document.querySelector("#leaderboard");
const leaderboardTemplate = document.querySelector("#leaderboardRow");
const leaderboardUpdated = document.querySelector("#leaderboardUpdated");

function relativeTime(value) {
  try {
    const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
    const formatter = new Intl.RelativeTimeFormat("bs", { numeric: "auto" });
    const units = [["day", 86400], ["hour", 3600], ["minute", 60], ["second", 1]];
    for (const [unit, size] of units) {
      if (Math.abs(seconds) >= size || unit === "second") return formatter.format(Math.round(seconds / size), unit);
    }
  } catch {
    return new Date(value).toLocaleString("bs");
  }
}

async function load() {
  try {
    const response = await fetch("/api/pirate-points/latest", { cache: "no-store" });
    if (!response.ok) throw new Error(String(response.status));
    const { players, leaderboards = [] } = await response.json();
    body.replaceChildren();
    for (const item of players) {
      const row = template.content.cloneNode(true);
      row.querySelector("[data-cell='player']").textContent = item.playerName || `Igrač #${item.playerId}`;
      row.querySelector("[data-cell='world']").textContent = item.worldId || "—";
      row.querySelector("[data-cell='server']").textContent = item.server;
      row.querySelector("[data-cell='coordinates']").textContent = item.coordinates || "—";
      row.querySelector("[data-cell='points']").textContent = new Intl.NumberFormat("bs").format(item.points);
      const time = row.querySelector("[data-cell='time']");
      time.textContent = relativeTime(item.capturedAt);
      time.title = new Date(item.capturedAt).toLocaleString("bs");
      body.append(row);
    }
    if (!players.length) body.innerHTML = '<tr><td colspan="6" class="empty">Još nema poslanih podataka.</td></tr>';
    count.textContent = `${players.length} ${players.length === 1 ? "igrač" : "igrača"}`;
    leaderboardBody.replaceChildren();
    for (const snapshot of leaderboards) {
      for (const entry of snapshot.entries) {
        const row = leaderboardTemplate.content.cloneNode(true);
        row.querySelector("[data-cell='rank']").textContent = `${entry.rank}.`;
        row.querySelector("[data-cell='rankingPlayer']").textContent = entry.playerName;
        row.querySelector("[data-cell='rankingAlliance']").textContent = entry.alliance || "—";
        row.querySelector("[data-cell='rankingCoordinates']").textContent = entry.coordinates || "—";
        row.querySelector("[data-cell='rankingWorld']").textContent = snapshot.worldId || "—";
        row.querySelector("[data-cell='rankingServer']").textContent = snapshot.server;
        row.querySelector("[data-cell='rankingPoints']").textContent = new Intl.NumberFormat("bs").format(entry.points);
        leaderboardBody.append(row);
      }
    }
    if (!leaderboardBody.children.length) {
      leaderboardBody.innerHTML = '<tr><td colspan="7" class="empty">Rang-lista još nije očitana.</td></tr>';
      leaderboardUpdated.textContent = "";
    } else {
      const sourceCount = leaderboards.reduce((sum, snapshot) => sum + (snapshot.sources || 1), 0);
      leaderboardUpdated.textContent = `Spojeno iz ${sourceCount} očitanja · Očitano ${relativeTime(leaderboards[0].capturedAt)}`;
    }
    connection.textContent = "Povezano";
    connection.className = "status ok";
  } catch (error) {
    console.error("Učitavanje poena nije uspjelo:", error);
    connection.textContent = `Greška prikaza: ${error.message}`;
    connection.className = "status error";
  }
}

document.querySelector("#refresh").addEventListener("click", load);
load();
setInterval(load, 10_000);
