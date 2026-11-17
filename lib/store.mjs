// Storage: Netlify Blobs in production; a folder on disk for local testing
// (set LOCAL_STORE_DIR). Three stores: call records, uploaded files, proposal PDFs.
import fs from "node:fs";
import path from "node:path";

class DiskStore {
  constructor(dir) { this.dir = dir; fs.mkdirSync(dir, { recursive: true }); }
  #p(key) { return path.join(this.dir, encodeURIComponent(key)); }
  async get(key, opts = {}) {
    const p = this.#p(key); if (!fs.existsSync(p)) return null;
    const buf = fs.readFileSync(p);
    return opts.type === "json" ? JSON.parse(buf.toString("utf8")) : opts.type === "arrayBuffer" ? buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length) : buf.toString("utf8");
  }
  async getWithMetadata(key, opts = {}) {
    const data = await this.get(key, opts); if (data === null) return null;
    const m = this.#p(key) + ".meta"; return { data, metadata: fs.existsSync(m) ? JSON.parse(fs.readFileSync(m, "utf8")) : {} };
  }
  async setJSON(key, v) { fs.writeFileSync(this.#p(key), JSON.stringify(v)); }
  async set(key, v, opts = {}) {
    fs.writeFileSync(this.#p(key), Buffer.from(v instanceof ArrayBuffer ? new Uint8Array(v) : v));
    if (opts.metadata) fs.writeFileSync(this.#p(key) + ".meta", JSON.stringify(opts.metadata));
  }
  async delete(key) { for (const p of [this.#p(key), this.#p(key) + ".meta"]) if (fs.existsSync(p)) fs.unlinkSync(p); }
  async list({ prefix = "" } = {}) {
    const blobs = fs.readdirSync(this.dir).filter((f) => !f.endsWith(".meta")).map((f) => ({ key: decodeURIComponent(f) })).filter((b) => b.key.startsWith(prefix));
    return { blobs };
  }
}

const stores = {};
export async function store(name) {
  if (stores[name]) return stores[name];
  if (process.env.LOCAL_STORE_DIR) return (stores[name] = new DiskStore(path.join(process.env.LOCAL_STORE_DIR, name)));
  const { getStore } = await import("@netlify/blobs");
  return (stores[name] = getStore({ name, consistency: "strong" }));
}

export const STAGES = ["Call taken", "Proposal ready", "Sent", "Site visit", "Contract signed", "Installed", "Lost"];

export async function getCall(id) {
  if (!/^[a-z0-9-]{8,64}$/i.test(id || "")) return null;
  return (await store("battery-calls")).get(`call/${id}`, { type: "json" });
}
export async function saveCall(call) { await (await store("battery-calls")).setJSON(`call/${call.id}`, call); return call; }
export async function listCalls() {
  const s = await store("battery-calls");
  const { blobs } = await s.list({ prefix: "call/" });
  const all = await Promise.all(blobs.map((b) => s.get(b.key, { type: "json" })));
  return all.filter(Boolean).sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}
export async function deleteCall(id) {
  await (await store("battery-calls")).delete(`call/${id}`);
  await (await store("battery-proposals")).delete(`${id}.pdf`);
  const f = await store("battery-files"); const { blobs } = await f.list({ prefix: `${id}/` });
  await Promise.all(blobs.map((b) => f.delete(b.key)));
}
