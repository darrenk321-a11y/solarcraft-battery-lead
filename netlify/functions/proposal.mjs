import { guard, json } from "../../lib/auth.mjs";
import { store, getCall } from "../../lib/store.mjs";
import { recommend } from "../../lib/select.mjs";
import { renderProposalHtml, proposalFields } from "../../lib/proposal.mjs";

export default async (req, context) => {
  const denied = guard(req); if (denied) return denied;
  const call = await getCall(context.params?.id || new URL(req.url).searchParams.get("id"));
  if (!call) return json({ error: "Call not found." }, 404);
  const view = new URL(req.url).searchParams.get("view");
  if (view === "html") {
    // Printable version, always available: open it and use the browser's Save as PDF.
    return new Response(renderProposalHtml(proposalFields(call, recommend(call))), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store" } });
  }
  const pdf = await (await store("battery-proposals")).get(`${call.id}.pdf`, { type: "arrayBuffer" });
  if (!pdf) return json({ error: "No proposal has been made for this call yet." }, 404);
  const fname = `SolarCraft Battery Proposal - ${call.name}.pdf`.replace(/[^\w .-]/g, "");
  return new Response(pdf, { headers: { "content-type": "application/pdf", "content-disposition": `${view === "inline" ? "inline" : "attachment"}; filename="${fname}"`, "cache-control": "private, no-store" } });
};
export const config = { path: "/api/proposal/:id" };
