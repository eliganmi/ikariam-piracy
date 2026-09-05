const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs/promises");
const { PointsStore } = require("./store");
const { validatePayload, IKARIAM_HOST } = require("./validation");

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "127.0.0.1";
const PUBLIC_DIR = path.join(__dirname, "..", "frontend");
const store = new PointsStore(process.env.DATA_FILE || path.join(__dirname, "data", "points.json"));

const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };

function corsOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return null;
  try {
    const url = new URL(origin);
    if (IKARIAM_HOST.test(url.hostname) || (url.hostname === "localhost" && url.port === String(PORT)) || url.hostname === "127.0.0.1") return origin;
  } catch {}
  return null;
}

function sendJson(res, status, value, origin = null) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    ...(origin ? { "Access-Control-Allow-Origin": origin, "Vary": "Origin" } : {})
  });
  res.end(body);
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 16_384) throw Object.assign(new Error("Payload je prevelik"), { status: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw Object.assign(new Error("Neispravan JSON"), { status: 400 }); }
}

async function serveStatic(req, res, pathname) {
  const requested = pathname === "/" ? "index.html" : pathname.slice(1);
  const safePath = path.normalize(requested).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = path.join(PUBLIC_DIR, safePath);
  if (!filePath.startsWith(`${PUBLIC_DIR}${path.sep}`)) return false;
  try {
    const body = await fs.readFile(filePath);
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream",
      "Content-Length": body.length,
      "Cache-Control": "no-store"
    });
    if (req.method === "HEAD") res.end(); else res.end(body);
    return true;
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EISDIR") return false;
    throw error;
  }
}

function createServer() {
  return http.createServer(async (req, res) => {
    const origin = corsOrigin(req);
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    try {
      if (req.method === "OPTIONS" && url.pathname === "/api/pirate-points") {
        if (!origin) return sendJson(res, 403, { error: "Origin nije dozvoljen" });
        res.writeHead(204, {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-Ingest-Key",
          "Access-Control-Max-Age": "600",
          "Vary": "Origin"
        });
        return res.end();
      }
      if (req.method === "GET" && url.pathname === "/api/health") return sendJson(res, 200, { ok: true });
      if (req.method === "GET" && url.pathname === "/api/pirate-points/latest") {
        return sendJson(res, 200, { players: store.latest(), leaderboards: store.latestLeaderboards() }, origin);
      }
      if (req.method === "POST" && url.pathname === "/api/pirate-points") {
        const requiredKey = process.env.IKARIAM_INGEST_KEY;
        if (requiredKey && req.headers["x-ingest-key"] !== requiredKey) return sendJson(res, 401, { error: "Neispravan ključ" }, origin);
        const { errors, value } = validatePayload(await readJson(req));
        if (errors.length) return sendJson(res, 400, { error: "Neispravni podaci", details: errors }, origin);
        const result = await store.upsert(value);
        return sendJson(res, result.deduplicated ? 200 : 201, result, origin);
      }
      if ((req.method === "GET" || req.method === "HEAD") && await serveStatic(req, res, url.pathname)) return;
      sendJson(res, 404, { error: "Nije pronađeno" }, origin);
    } catch (error) {
      console.error(error);
      sendJson(res, error.status || 500, { error: error.status ? error.message : "Greška servera" }, origin);
    }
  });
}

async function main() {
  await store.load();
  createServer().listen(PORT, HOST, () => console.log(`Ikariam poeni: http://${HOST}:${PORT}`));
}

if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1; });

module.exports = { createServer, store };
