"use strict";
const STAGES = ["Call taken", "Proposal ready", "Sent", "Site visit", "Contract signed", "Installed", "Lost"];
const WON = ["Contract signed", "Installed"];
const FOLLOW_UP_DAYS = { "Proposal ready": 2, "Sent": 3 }; // days a lead can sit before it needs a nudge
const SYS = { enphase: "Enphase", powerwall: "Powerwall 3" };
const OPTS = {
  has_solar: [["yes", "Yes"], ["no", "No"], ["unsure", "Not sure"]],
  ownership: [["owned", "Owned"], ["leased", "Leased"], ["ppa", "PPA"], ["unsure", "Not sure"]],
  microinverters: [["yes", "Yes"], ["no", "No"], ["unsure", "Not sure"]],
  priority: [["backup", "Backup power"], ["savings", "Lower bills"], ["both", "Both"]],
  backup_level: [["essentials", "Essentials"], ["whole_home", "Whole home"]],
  must_run: [["ac", "AC"], ["heat_pump", "Heat pump"], ["well_pump", "Well pump"], ["ev_charger", "EV charger"], ["electric_stove", "Electric stove"], ["water_heater", "Electric water heater"], ["refrigerator", "Fridge and freezer"]],
  life_safety: [["medical", "Medical equipment"], ["gates", "Electric gates"], ["garage_doors", "Garage doors"], ["locks", "Electric locks"], ["elevator", "Elevator or stair lift"]],
  future_plans: [["ev", "EV"], ["heat_pump", "Heat pump"], ["more_solar", "More solar"], ["remodel", "Remodel or ADU"]],
  payment: [["cash", "Cash"], ["finance", "Finance"], ["unsure", "Not sure"]],
};
const TEXT = ["name", "phone", "email", "address", "solar_brand", "budget_timing", "notes", "rep_name", "rep_email", "rep_phone", "rep_his", "proposal_type", "date"];

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); for (const k of kids) if (k != null) e.append(k); return e; };
const money = (n) => n ? "$" + Math.round(n).toLocaleString("en-US") : "—";
const days = (iso) => iso ? Math.floor((Date.now() - new Date(iso)) / 864e5) : 0;
const shortDate = (iso) => iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
const today = () => new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
const stageClass = (s) => WON.includes(s) ? "won" : s === "Lost" ? "lost" : "";
const sysLabel = (c) => c.rec ? `${SYS[c.rec.primary]} ${c.rec.primary === "enphase" ? c.rec.enphase_kwh : c.rec.powerwall_kwh} kWh` : "—";
const lastStageAt = (c) => (c.history || []).slice(-1)[0]?.at || c.createdAt;

async function api(path, opts = {}) {
  const r = await fetch(path, { credentials: "same-origin", ...opts, headers: { ...(opts.body && !(opts.body instanceof Blob) ? { "content-type": "application/json" } : {}), ...(opts.headers || {}) } });
  if (r.status === 401) { showLogin(); throw new Error("signed out"); }
  const data = r.headers.get("content-type")?.includes("json") ? await r.json() : null;
  if (!r.ok) throw new Error(data?.error || `Something went wrong (${r.status}).`);
  return data;
}

// ---------- routing
let calls = [];
let stageFilter = null;
async function route() {
  const h = location.hash.slice(1) || "dashboard";
  $("#nav").hidden = false;
  if (h === "new") return showCall(null);
  if (h.startsWith("call-")) return showCall(h.slice(5));
  return showDashboard();
}
window.addEventListener("hashchange", () => route().catch(() => {}));

function mount(tplId) { const app = $("#app"); app.replaceChildren($("#" + tplId).content.cloneNode(true)); return app; }

// ---------- login
function showLogin() {
  $("#nav").hidden = true;
  mount("tpl-login");
  $("#pw").focus();
  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault(); $("#loginErr").textContent = "";
    const r = await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: $("#pw").value }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { $("#loginErr").textContent = d.error || "Couldn't sign in."; return; }
    route();
  });
}
$("#signOut").addEventListener("click", async () => { await fetch("/api/login", { method: "DELETE" }); showLogin(); });

// ---------- dashboard
async function showDashboard() {
  const app = mount("tpl-dashboard");
  const d = await api("/api/calls"); calls = d.calls;
  renderStages(); renderFollowUps(); renderSystems(); renderReps(); renderLeads();
  $("#search", app).addEventListener("input", renderLeads);
}
function renderStages() {
  const box = $("#stageBars"); box.replaceChildren();
  const max = Math.max(1, ...STAGES.map((s) => calls.filter((c) => c.stage === s).length));
  for (const s of STAGES) {
    const n = calls.filter((c) => c.stage === s).length;
    const b = el("button", { type: "button", className: "stagebar " + stageClass(s), title: `Show ${s} leads` },
      el("span", { textContent: s }), el("span", { className: "track" }, el("span", { className: "fill", style: `width:${(n / max) * 100}%;display:block` })), el("b", { textContent: n }));
    b.addEventListener("click", () => { stageFilter = stageFilter === s ? null : s; renderLeads(); $("#leadTable").scrollIntoView({ behavior: "smooth", block: "start" }); });
    box.append(b);
  }
}
function followUps() {
  return calls.filter((c) => FOLLOW_UP_DAYS[c.stage] != null && days(lastStageAt(c)) >= FOLLOW_UP_DAYS[c.stage])
    .sort((a, b) => lastStageAt(a).localeCompare(lastStageAt(b)));
}
function renderFollowUps() {
  const list = followUps(); $("#fuCount").textContent = list.length;
  const ul = $("#followUps"); ul.replaceChildren();
  if (!list.length) { ul.append(el("li", { className: "empty", textContent: `Nothing overdue. Leads appear here after ${FOLLOW_UP_DAYS["Proposal ready"]} days in Proposal ready or ${FOLLOW_UP_DAYS.Sent} days in Sent.` })); return; }
  for (const c of list.slice(0, 8)) {
    const what = c.stage === "Sent" ? "Proposal sent" : "Proposal not sent";
    ul.append(el("li", {}, el("a", { href: "#call-" + c.id }, el("span", {}, el("b", { textContent: c.name }), " · ", c.rep?.name || "No rep"), el("small", { textContent: `${what} ${days(lastStageAt(c))} days ago` }))));
  }
}
function renderSystems() {
  const active = calls.filter((c) => c.stage !== "Lost");
  const en = active.filter((c) => c.rec?.primary === "enphase").length, pw = active.filter((c) => c.rec?.primary === "powerwall").length;
  const open = active.filter((c) => !WON.includes(c.stage)).reduce((s, c) => s + (c.rec?.value || 0), 0);
  const won = calls.filter((c) => WON.includes(c.stage)).reduce((s, c) => s + (c.rec?.value || 0), 0);
  const tot = Math.max(1, en + pw);
  $("#systems").replaceChildren(
    el("div", {}, el("div", { className: "num", textContent: money(open) }), el("div", { className: "lbl", textContent: "Open pipeline value" })),
    el("div", {}, el("div", { className: "num", textContent: money(won) }), el("div", { className: "lbl", textContent: "Signed value" })),
    el("div", { className: "split", title: `${en} Enphase, ${pw} Powerwall` }, el("i", { className: "en", style: `width:${(en / tot) * 100}%` }), el("i", { className: "pw", style: `width:${(pw / tot) * 100}%` })),
    el("div", { className: "legend" }, el("span", {}, el("i", { style: "background:var(--navy)" }), `Enphase: ${en}`), el("span", {}, el("i", { style: "background:var(--green)" }), `Powerwall 3: ${pw}`)),
    el("div", { className: "lbl full", textContent: "Value is the midpoint of the discounted price range for the recommended system. Lost leads are left out." }));
}
function renderReps() {
  const by = new Map();
  for (const c of calls) {
    const k = c.rep?.name || "No rep";
    const r = by.get(k) || { calls: 0, sent: 0, signed: 0, value: 0 };
    r.calls++; if ((c.history || []).some((h) => h.stage === "Sent")) r.sent++;
    if (WON.includes(c.stage)) { r.signed++; r.value += c.rec?.value || 0; }
    by.set(k, r);
  }
  const t = $("#reps"); t.replaceChildren();
  t.append(el("thead", {}, el("tr", {}, el("th", { textContent: "Rep" }), el("th", { className: "num", textContent: "Calls" }), el("th", { className: "num", textContent: "Sent" }), el("th", { className: "num", textContent: "Signed" }), el("th", { className: "num", textContent: "Signed value" }))));
  const tb = el("tbody");
  if (!by.size) tb.append(el("tr", {}, el("td", { colSpan: 5, className: "empty", textContent: "Reps appear here once calls are saved." })));
  for (const [k, r] of [...by].sort((a, b) => b[1].signed - a[1].signed || b[1].calls - a[1].calls))
    tb.append(el("tr", {}, el("td", { textContent: k }), el("td", { className: "num", textContent: r.calls }), el("td", { className: "num", textContent: r.sent }), el("td", { className: "num", textContent: r.signed }), el("td", { className: "num", textContent: money(r.value) })));
  t.append(tb);
}
function renderLeads() {
  const f = $("#stageFilter"); f.replaceChildren();
  for (const s of [null, ...STAGES]) {
    const b = el("button", { type: "button", className: "chipbtn", textContent: s || "All" });
    b.setAttribute("aria-pressed", String(stageFilter === s));
    b.addEventListener("click", () => { stageFilter = s; renderLeads(); });
    f.append(b);
  }
  const q = ($("#search")?.value || "").toLowerCase();
  const rows = calls.filter((c) => (!stageFilter || c.stage === stageFilter) && (!q || `${c.name} ${c.address}`.toLowerCase().includes(q)));
  const t = $("#leadTable"); t.replaceChildren();
  t.append(el("thead", {}, el("tr", {}, ...["Customer", "Stage", "System", "Value", "Rep", "Proposal", "Updated"].map((h, i) => el("th", { className: i === 3 ? "num" : "", textContent: h })))));
  const tb = el("tbody");
  if (!rows.length) tb.append(el("tr", {}, el("td", { colSpan: 7, className: "empty", textContent: calls.length ? "No leads match." : "No calls yet. Press New call to take the first one." })));
  for (const c of rows) {
    const missing = !c.bill_received || !c.panel_photo_received;
    const prop = c.proposal?.status === "ready" ? el("span", { className: "pill won", textContent: "Ready" }) : c.proposal?.status === "building" ? el("span", { className: "pill", textContent: "Building" }) : c.proposal?.status === "failed" ? el("span", { className: "pill bad", textContent: "Failed" }) : el("span", { className: "muted", textContent: "—" });
    const tr = el("tr", { className: "row" },
      el("td", {}, el("a", { href: "#call-" + c.id, textContent: c.name }), el("small", { textContent: c.address || "No address" })),
      el("td", {}, el("span", { className: "pill " + stageClass(c.stage), textContent: c.stage }), missing && c.stage === "Call taken" ? el("small", { textContent: "Missing bill or photo" }) : null),
      el("td", { textContent: sysLabel(c) }), el("td", { className: "num", textContent: money(c.rec?.value) }),
      el("td", { textContent: c.rep?.name || "—" }), el("td", {}, prop), el("td", { textContent: shortDate(c.updatedAt) }));
    tr.addEventListener("click", (e) => { if (e.target.tagName !== "A") location.hash = "call-" + c.id; });
    tb.append(tr);
  }
  t.append(tb);
}

// ---------- call view
let current = null;
let pollTimer = null;
function loadRep() { try { return JSON.parse(localStorage.getItem("sc_rep") || "{}"); } catch { return {}; } }
function saveRep(r) { try { localStorage.setItem("sc_rep", JSON.stringify(r)); } catch {} }
const yn = (v) => v === "yes" ? true : v === "no" ? false : null;
const fromYn = (v) => v === true ? "yes" : v === false ? "no" : "unsure";

async function showCall(id) {
  clearTimeout(pollTimer);
  const app = mount("tpl-call");
  for (const box of $$("[data-radio],[data-check]", app)) {
    const key = box.dataset.radio || box.dataset.check, type = box.dataset.radio ? "radio" : "checkbox";
    for (const [v, l] of OPTS[key]) box.append(el("label", { className: "chip" }, el("input", { type, name: key, value: v, id: `${key}_${v}` }), el("span", { textContent: l })));
  }
  const sel = $("#stage"); for (const s of STAGES) sel.append(el("option", { value: s, textContent: s }));
  current = id ? await api("/api/calls/" + id) : null;
  fill(current);
  $("#form").addEventListener("submit", onSave);
  sel.addEventListener("change", onStage);
  $("#makeBtn").addEventListener("click", onMake);
  for (const inp of $$("[data-upload]")) inp.addEventListener("change", () => onUpload(inp));
  $("#deleteBtn").addEventListener("click", () => { $("#confirmDelete").hidden = false; });
  $("#confirmNo").addEventListener("click", () => { $("#confirmDelete").hidden = true; });
  $("#confirmYes").addEventListener("click", async () => { await api("/api/calls/" + current.id, { method: "DELETE" }); location.hash = "dashboard"; });
  if (!id) $("#name").focus();
  if (current?.proposal?.status === "building") poll();
}

function fill(c) {
  const d = c || {}; const rep = d.rep?.name ? d.rep : loadRep(); const s = d.solar || {};
  const t = { name: d.name, phone: d.phone, email: d.email, address: d.address, solar_brand: s.brand, budget_timing: d.budget_timing, notes: d.notes,
    rep_name: rep.name, rep_email: rep.email, rep_phone: rep.phone, rep_his: rep.his, proposal_type: d.proposal_type || "Battery Only", date: d.date || today() };
  for (const k of TEXT) $("#" + k).value = t[k] || "";
  const setR = (k, v) => $$(`input[name="${k}"]`).forEach((i) => (i.checked = i.value === v));
  const setC = (k, a) => { const set = new Set(a || []); $$(`input[name="${k}"]`).forEach((i) => (i.checked = set.has(i.value))); };
  setR("has_solar", c ? fromYn(s.has_solar) : null); setR("ownership", s.ownership); setR("microinverters", c ? fromYn(s.microinverters) : null);
  setR("priority", d.priority); setR("backup_level", d.backup_level); setR("payment", d.payment);
  setC("must_run", d.must_run); setC("life_safety", d.life_safety); setC("future_plans", d.future_plans);
  $("#bill_received").checked = !!d.bill_received; $("#panel_photo_received").checked = !!d.panel_photo_received;
  $("#ov_primary").value = d.override?.primary || ""; $("#ov_enphase").value = d.override?.enphase_kwh ?? ""; $("#ov_powerwall").value = d.override?.powerwall_kwh ?? "";
  $("#formTitle").textContent = d.name || "New call";
  $("#repBox").open = !rep.name;
  $("#saveStatus").textContent = c ? `Last saved ${new Date(c.updatedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : "Not saved yet";
  renderSide();
}

function renderSide() {
  const c = current; const saved = !!c;
  $("#stage").value = c?.stage || "Call taken"; $("#stage").disabled = !saved;
  $("#deleteBtn").hidden = !saved;
  const h = $("#history"); h.replaceChildren();
  for (const x of (c?.history || []).slice().reverse()) h.append(el("li", {}, el("span", { textContent: x.stage }), el("span", { textContent: shortDate(x.at) })));
  for (const kind of ["bill", "panel"]) {
    const f = c?.files?.[kind]; const box = $(`[data-file="${kind}"]`); box.replaceChildren();
    if (f) box.append(el("a", { href: `/api/files?call=${c.id}&kind=${kind}`, target: "_blank", rel: "noopener", textContent: f.name }));
    $(`[data-upload="${kind}"]`).disabled = !saved;
    $(`[data-upload="${kind}"]`).parentElement.title = saved ? "" : "Save the call first";
  }
  const rec = $("#rec"); rec.replaceChildren();
  if (c?.rec) {
    const r = c.rec; const kwh = r.primary === "enphase" ? r.enphase_kwh : r.powerwall_kwh; const altKwh = r.alternate === "enphase" ? r.enphase_kwh : r.powerwall_kwh;
    rec.append(el("div", { className: "recsys", textContent: `${SYS[r.primary]} · ${kwh} kWh` }),
      el("div", { className: "recval", textContent: `${money(r.price_low)} – ${money(r.price_high)} after discount · alternate ${SYS[r.alternate]} ${altKwh} kWh` }),
      el("ul", { className: "reasons" }, ...r.reasons.map((x) => el("li", { textContent: x }))));
    if (r.flags.length) rec.append(el("ul", { className: "flags" }, ...r.flags.map((x) => el("li", { textContent: x }))));
  } else rec.append(el("p", { className: "muted", textContent: "Save the call to see the recommended system." }));
  const pb = $("#proposalBox"); pb.replaceChildren(); const p = c?.proposal; const btn = $("#makeBtn");
  btn.disabled = !saved || p?.status === "building"; btn.textContent = p?.status === "ready" ? "Make proposal again" : "Make proposal";
  if (!saved) pb.append(el("p", { className: "muted", textContent: "Save the call, then make the proposal." }));
  else if (p?.status === "building") pb.append(el("p", { className: "muted", textContent: "Building the proposal. This usually takes under a minute." }));
  else if (p?.status === "ready") pb.append(el("div", { className: "proposalinfo" },
    el("span", { textContent: `Made ${new Date(p.builtAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · ${SYS[p.primary]} ${p.kwh} kWh` }),
    el("a", { href: `/api/proposal/${c.id}`, textContent: "Download PDF" }),
    el("a", { href: `/api/proposal/${c.id}?view=inline`, target: "_blank", rel: "noopener", textContent: "Open PDF in a new tab" }),
    ((c.intakeAt || "") > p.builtAt) ? el("span", { className: "pill warn", textContent: "Call changed since this proposal was made" }) : null));
  else if (p?.status === "failed") pb.append(el("div", { className: "proposalinfo" }, el("span", { className: "pill bad", textContent: "The PDF didn't build" }),
    el("span", { className: "small muted", textContent: p.error || "" }),
    el("a", { href: `/api/proposal/${c.id}?view=html`, target: "_blank", rel: "noopener", textContent: "Open printable proposal (use Save as PDF)" })));
  else pb.append(el("p", { className: "muted", textContent: "No proposal yet." }));
}

function readForm() {
  const r = (k) => ($(`input[name="${k}"]:checked`) || {}).value || null;
  const ch = (k) => $$(`input[name="${k}"]:checked`).map((i) => i.value);
  const t = Object.fromEntries(TEXT.map((k) => [k, $("#" + k).value.trim()]));
  return {
    name: t.name, phone: t.phone, email: t.email, address: t.address, date: t.date || today(), proposal_type: t.proposal_type,
    payment: r("payment"), rep: { name: t.rep_name, email: t.rep_email, phone: t.rep_phone, his: t.rep_his },
    solar: { has_solar: yn(r("has_solar")), ownership: r("ownership"), brand: t.solar_brand, microinverters: yn(r("microinverters")) },
    priority: r("priority"), backup_level: r("backup_level"), must_run: ch("must_run"), life_safety: ch("life_safety"), future_plans: ch("future_plans"),
    bill_received: $("#bill_received").checked, panel_photo_received: $("#panel_photo_received").checked,
    budget_timing: t.budget_timing, notes: t.notes,
    override: { primary: $("#ov_primary").value || null, enphase_kwh: $("#ov_enphase").value || null, powerwall_kwh: $("#ov_powerwall").value || null },
  };
}
const status = (msg, err) => { const s = $("#saveStatus"); s.textContent = msg; s.classList.toggle("err", !!err); };

async function onSave(e) { e.preventDefault(); await saveForm(); }
async function saveForm() {
  const d = readForm();
  if (!d.name) { status("Add the customer's name before saving.", true); $("#name").focus(); return false; }
  saveRep(d.rep); $("#saveBtn").disabled = true; status("Saving…");
  try {
    if (!current) { current = await api("/api/calls", { method: "POST", body: JSON.stringify(d) }); history.replaceState(null, "", "#call-" + current.id); }
    else current = await api("/api/calls/" + current.id, { method: "PUT", body: JSON.stringify({ intake: d }) });
    $("#formTitle").textContent = current.name; status("Saved. Ready to make the proposal."); renderSide();
    $("#form").dataset.dirty = "0"; $("#saveBtn").disabled = false; return true;
  } catch (err) { status(err.message, true); $("#saveBtn").disabled = false; return false; }
}
async function onStage() {
  try { current = await api("/api/calls/" + current.id, { method: "PUT", body: JSON.stringify({ stage: $("#stage").value }) }); renderSide(); status(`Moved to ${current.stage}.`); }
  catch (err) { status(err.message, true); $("#stage").value = current.stage; }
}
async function onMake() {
  if (!current) return;
  if ($("#form").dataset.dirty === "1" && !(await saveForm())) return;
  $("#makeBtn").disabled = true;
  current = { ...current, proposal: { ...(current.proposal || {}), status: "building" } }; renderSide();
  const r = await fetch("/.netlify/functions/build-proposal-background", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: current.id }) });
  if (r.status !== 202 && !r.ok) { status("Couldn't start the proposal. Try again.", true); $("#makeBtn").disabled = false; return; }
  poll(Date.now());
}
function poll(start = Date.now()) {
  clearTimeout(pollTimer);
  pollTimer = setTimeout(async () => {
    if (!current || !location.hash.endsWith(current.id)) return;
    try { current = await api("/api/calls/" + current.id); } catch { return; }
    if (current.proposal?.status === "building" && Date.now() - start < 180000) { renderSide(); return poll(start); }
    if (current.proposal?.status === "building") current.proposal = { status: "failed", error: "It's taking longer than expected. Refresh in a minute, or open the printable version." };
    renderSide();
  }, 3000);
}

async function shrink(file) {
  if (!file.type.startsWith("image/") || file.size < 1.5e6) return file;
  try {
    const bmp = await createImageBitmap(file); const scale = Math.min(1, 2200 / Math.max(bmp.width, bmp.height));
    const cv = el("canvas", { width: Math.round(bmp.width * scale), height: Math.round(bmp.height * scale) });
    cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
    const blob = await new Promise((r) => cv.toBlob(r, "image/jpeg", 0.85));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  } catch { return file; }
}
async function onUpload(inp) {
  const kind = inp.dataset.upload; let f = inp.files[0]; if (!f || !current) return;
  status(`Uploading ${f.name}…`);
  try {
    f = await shrink(f);
    if (f.size > 5.5e6) throw new Error("That file is over 5.5 MB. Send a smaller photo or a shorter PDF.");
    const type = f.type || (f.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");
    await api(`/api/files?call=${current.id}&kind=${kind}`, { method: "POST", body: f, headers: { "content-type": type, "x-filename": encodeURIComponent(f.name).slice(0, 100) } });
    current = await api("/api/calls/" + current.id);
    $(kind === "bill" ? "#bill_received" : "#panel_photo_received").checked = true;
    renderSide(); status("File attached.");
  } catch (err) { status(err.message, true); }
  inp.value = "";
}
document.addEventListener("input", (e) => { if (e.target.closest("#form")) $("#form").dataset.dirty = "1"; });

// ---------- start
(async () => {
  const r = await fetch("/api/login").then((x) => x.json().then((d) => ({ ok: x.ok, d }))).catch(() => ({ ok: false, d: {} }));
  if (!r.ok) { $("#app").replaceChildren(el("section", { className: "panel login" }, el("h1", { textContent: "Setup needed" }), el("p", { textContent: r.d.error || "The site couldn't reach its server." }))); return; }
  if (!r.d.signedIn) return showLogin();
  route();
})();
