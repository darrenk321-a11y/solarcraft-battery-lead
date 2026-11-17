// Background function: returns 202 right away, then builds the proposal PDF
// (up to 15 minutes allowed) and records the result on the call.
import { isAuthed, configured } from "../../lib/auth.mjs";
import { store, getCall, saveCall } from "../../lib/store.mjs";
import { recommend } from "../../lib/select.mjs";
import { renderProposalHtml, proposalFields } from "../../lib/proposal.mjs";
import { htmlToPdf } from "../../lib/pdf.mjs";

export default async (req) => {
  if (!configured() || !isAuthed(req) || req.method !== "POST") return;
  const { id } = await req.json().catch(() => ({}));
  const call = await getCall(id); if (!call) return;
  const started = new Date().toISOString();
  await saveCall({ ...call, proposal: { ...(call.proposal || {}), status: "building", startedAt: started, error: null } });
  try {
    const rec = recommend(call);
    const pdf = await htmlToPdf(renderProposalHtml(proposalFields(call, rec)));
    await (await store("battery-proposals")).set(`${call.id}.pdf`, pdf, { metadata: { builtAt: new Date().toISOString() } });
    const latest = (await getCall(id)) || call;
    const now = new Date().toISOString();
    const moveStage = latest.stage === "Call taken";
    await saveCall({ ...latest, rec,
      proposal: { status: "ready", builtAt: now, primary: rec.primary, kwh: rec.primary === "enphase" ? rec.enphase_kwh : rec.powerwall_kwh, value: rec.value, bytes: pdf.length },
      ...(moveStage ? { stage: "Proposal ready", history: [...(latest.history || []), { stage: "Proposal ready", at: now }] } : {}),
      updatedAt: now });
  } catch (e) {
    const latest = (await getCall(id)) || call;
    await saveCall({ ...latest, proposal: { ...(latest.proposal || {}), status: "failed", error: String(e && e.message || e).slice(0, 300), failedAt: new Date().toISOString() } });
  }
};
