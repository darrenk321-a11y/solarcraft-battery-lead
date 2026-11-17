// Local test server: serves public/ and runs the Netlify functions with a
// folder on disk in place of Netlify Blobs. Not used on Netlify.
//   STAFF_PASSWORD=test SESSION_SECRET=... LOCAL_STORE_DIR=.data node dev/server.mjs
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
process.env.LOCAL_STORE_DIR ||= path.join(root, ".data");
const fn = async (name) => (await import(path.join(root, "netlify/functions", name + ".mjs"))).default;
const routes = [
  [/^\/api\/login$/, "login", () => ({})],
  [/^\/api\/calls$/, "calls", () => ({})],
  [/^\/api\/calls\/([\w-]+)$/, "calls", (m) => ({ id: m[1] })],
  [/^\/api\/files$/, "files", () => ({})],
  [/^\/api\/proposal\/([\w-]+)$/, "proposal", (m) => ({ id: m[1] })],
];
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg" };

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const chunks = []; for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const headers = new Headers(); for (const [k, v] of Object.entries(req.headers)) headers.set(k, Array.isArray(v) ? v.join(",") : v);
  const request = new Request(url, { method: req.method, headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : body });
  const send = async (r) => { res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer())); };

  if (url.pathname === "/.netlify/functions/build-proposal-background") {
    res.writeHead(202); res.end();
    (await fn("build-proposal-background"))(request).catch((e) => console.error("background", e));
    return;
  }
  for (const [re, name, params] of routes) {
    const m = url.pathname.match(re);
    if (m) { try { return await send(await (await fn(name))(request, { params: params(m) })); } catch (e) { console.error(e); res.writeHead(500); return res.end(String(e)); } }
  }
  let p = path.join(root, "public", decodeURIComponent(url.pathname));
  if (!p.startsWith(path.join(root, "public"))) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end("Not found"); }
  res.writeHead(200, { "content-type": MIME[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
}).listen(process.env.PORT || 8888, () => console.log("http://localhost:" + (process.env.PORT || 8888)));
