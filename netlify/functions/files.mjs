import crypto from "node:crypto";
import { guard, json } from "../../lib/auth.mjs";
import { store, getCall, saveCall } from "../../lib/store.mjs";

const TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
const MAX = 5.5 * 1024 * 1024;

export default async (req) => {
  const denied = guard(req); if (denied) return denied;
  const u = new URL(req.url); const callId = u.searchParams.get("call");
  const call = await getCall(callId); if (!call) return json({ error: "Call not found." }, 404);
  const files = await store("battery-files");

  if (req.method === "GET") {
    const kind = u.searchParams.get("kind"); const f = (call.files || {})[kind];
    if (!f) return json({ error: "No file." }, 404);
    const r = await files.getWithMetadata(`${callId}/${f.id}`, { type: "arrayBuffer" });
    if (!r) return json({ error: "File not found." }, 404);
    return new Response(r.data, { headers: { "content-type": f.type, "content-disposition": `inline; filename="${encodeURIComponent(f.name)}"`, "cache-control": "private, no-store" } });
  }
  if (req.method === "POST") {
    const kind = u.searchParams.get("kind");
    if (!["bill", "panel"].includes(kind)) return json({ error: "Unknown file kind." }, 400);
    const type = (req.headers.get("content-type") || "").split(";")[0];
    if (!TYPES.includes(type)) return json({ error: "Upload a JPG, PNG or PDF." }, 415);
    const buf = await req.arrayBuffer();
    if (!buf.byteLength) return json({ error: "The file was empty." }, 400);
    if (buf.byteLength > MAX) return json({ error: "That file is over 5.5 MB. Send a smaller photo or a shorter PDF." }, 413);
    const id = crypto.randomUUID();
    let name = req.headers.get("x-filename") || kind; try { name = decodeURIComponent(name); } catch {}
    name = name.replace(/[^\w .()-]/g, "_").slice(0, 100);
    const old = (call.files || {})[kind];
    await files.set(`${callId}/${id}`, buf, { metadata: { type, name } });
    if (old) await files.delete(`${callId}/${old.id}`);
    call.files = { ...(call.files || {}), [kind]: { id, name, type, size: buf.byteLength, at: new Date().toISOString() } };
    if (kind === "bill") call.bill_received = true; else call.panel_photo_received = true;
    call.updatedAt = call.intakeAt = new Date().toISOString();
    await saveCall(call);
    return json({ ok: true, file: call.files[kind] });
  }
  return json({ error: "Method not allowed" }, 405);
};
export const config = { path: "/api/files" };
