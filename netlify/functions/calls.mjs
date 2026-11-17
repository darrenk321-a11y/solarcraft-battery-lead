import crypto from "node:crypto";
import { guard, json } from "../../lib/auth.mjs";
import { getCall, saveCall, listCalls, deleteCall, STAGES } from "../../lib/store.mjs";
import { recommend } from "../../lib/select.mjs";

const str = (v, n = 300) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const pick = (v, allowed) => (allowed.includes(v) ? v : null);
const list = (v, allowed) => (Array.isArray(v) ? [...new Set(v.filter((x) => allowed.includes(x)))] : []);
const tri = (v) => (v === true || v === false ? v : null);

// Only these intake fields are accepted from the page
function clean(b) {
  const s = b.solar || {}, r = b.rep || {}, o = b.override || {};
  return {
    name: str(b.name, 120), phone: str(b.phone, 40), email: str(b.email, 120), address: str(b.address, 200),
    date: str(b.date, 40), proposal_type: pick(b.proposal_type, ["Battery Only", "Solar + Battery"]) || "Battery Only",
    payment: pick(b.payment, ["cash", "finance", "unsure"]),
    rep: { name: str(r.name, 80), email: str(r.email, 120), phone: str(r.phone, 40), his: str(r.his, 40) },
    solar: { has_solar: tri(s.has_solar), ownership: pick(s.ownership, ["owned", "leased", "ppa", "unsure"]), brand: str(s.brand, 80), microinverters: tri(s.microinverters) },
    priority: pick(b.priority, ["backup", "savings", "both"]),
    backup_level: pick(b.backup_level, ["essentials", "whole_home"]),
    must_run: list(b.must_run, ["ac", "heat_pump", "well_pump", "ev_charger", "electric_stove", "water_heater", "refrigerator"]),
    life_safety: list(b.life_safety, ["medical", "gates", "garage_doors", "locks", "elevator"]),
    future_plans: list(b.future_plans, ["ev", "heat_pump", "more_solar", "remodel"]),
    bill_received: b.bill_received === true, panel_photo_received: b.panel_photo_received === true,
    budget_timing: str(b.budget_timing, 200), notes: str(b.notes, 2000),
    override: { primary: pick(o.primary, ["enphase", "powerwall"]), enphase_kwh: [20, 30].includes(Number(o.enphase_kwh)) ? Number(o.enphase_kwh) : null,
      powerwall_kwh: [13.5, 27, 40.5].includes(Number(o.powerwall_kwh)) ? Number(o.powerwall_kwh) : null },
  };
}

export default async (req, context) => {
  const denied = guard(req); if (denied) return denied;
  const id = context.params?.id || new URL(req.url).searchParams.get("id");
  const now = new Date().toISOString();

  if (req.method === "GET" && !id) return json({ calls: await listCalls(), stages: STAGES });
  if (req.method === "GET") { const c = await getCall(id); return c ? json(c) : json({ error: "Call not found." }, 404); }

  if (req.method === "POST" && !id) {
    const body = clean(await req.json().catch(() => ({})));
    if (!body.name) return json({ error: "Add the customer's name before saving." }, 400);
    const call = { id: crypto.randomUUID(), ...body, files: {}, stage: "Call taken",
      history: [{ stage: "Call taken", at: now }], createdAt: now, updatedAt: now, intakeAt: now, proposal: null };
    call.rec = recommend(call);
    return json(await saveCall(call), 201);
  }

  const call = await getCall(id);
  if (!call) return json({ error: "Call not found." }, 404);

  if (req.method === "PUT") {
    const raw = await req.json().catch(() => ({}));
    let next = { ...call };
    if (raw.intake) {
      const body = clean(raw.intake);
      if (!body.name) return json({ error: "Add the customer's name before saving." }, 400);
      next = { ...next, ...body, intakeAt: now };
    }
    if (raw.stage && raw.stage !== call.stage) {
      if (!STAGES.includes(raw.stage)) return json({ error: "Unknown stage." }, 400);
      next.stage = raw.stage; next.history = [...(call.history || []), { stage: raw.stage, at: now }];
      if (raw.stage === "Sent") next.sentAt = now;
    }
    if (typeof raw.followUpNote === "string") next.followUpNote = str(raw.followUpNote, 500);
    next.rec = recommend(next); next.updatedAt = now;
    return json(await saveCall(next));
  }
  if (req.method === "DELETE") { await deleteCall(id); return json({ ok: true }); }
  return json({ error: "Method not allowed" }, 405);
};
export const config = { path: ["/api/calls", "/api/calls/:id"] };
