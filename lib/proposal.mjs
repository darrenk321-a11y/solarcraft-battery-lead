// SolarCraft 5-page portrait battery proposal (letter size).
// renderProposalHtml(d) returns a self-contained HTML document with images
// and fonts embedded, ready to print or turn into a PDF.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
// Assets ship with the functions (netlify.toml included_files); fall back to the repo root locally.
const ASSET_DIRS = [path.join(process.cwd(), "assets"), path.join(here, "..", "assets"), path.join(here, "assets")];
function assetPath(name) {
  for (const d of ASSET_DIRS) { const p = path.join(d, name); if (fs.existsSync(p)) return p; }
  throw new Error(`Missing asset: ${name}`);
}
const cache = new Map();
function dataUri(name) {
  if (!cache.has(name)) {
    const ext = path.extname(name).slice(1);
    const mime = { jpg: "image/jpeg", png: "image/png", woff2: "font/woff2" }[ext];
    cache.set(name, `data:${mime};base64,${fs.readFileSync(assetPath(name)).toString("base64")}`);
  }
  return cache.get(name);
}
const NAVY = "#002D72", BLUE = "#1A3FA0", G = "#3E7D24", GL = "#509E2F", INK = "#333", MUTE = "#5A6876", LINE = "#C9D1DB";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function ic(name, size = 40, color = NAVY, sw = 1.4) {
  const t = fs.readFileSync(assetPath(`icons/${name}.svg`), "utf8");
  const inner = [...t.matchAll(/<(path|circle|rect|line|polyline|polygon|ellipse)\s+([^>]*?)\s*\/>/g)].map((m) => `<${m[1]} ${m[2]}></${m[1]}>`).join("");
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" style="display:block;flex:none">${inner}</svg>`;
}

const MAIN_TITLE = "Industry Best Technology &amp;<br>Design-Build Craftsmanship";
const EN_SIZES = { 20: ["Two", 2, "14.2 kW"], 30: ["Three", 3, "21 kW"] };
const PW_IDX = { 13.5: 0, 27: 1, 40.5: 2 };
const PW_LABEL = ["Tesla Powerwall 3 • 13.5 kWh", "Tesla Powerwall 3 + 1 expansion • 27 kWh", "Tesla Powerwall 3 + 2 expansions • 40.5 kWh"];

export function proposalFields(call, rec) {
  const rep = call.rep || {};
  return {
    name: call.name, address: call.address,
    date: call.date || new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/Los_Angeles" }),
    proposal_type: call.proposal_type || "Battery Only",
    payment: { cash: "Cash purchase", finance: "Financed purchase" }[call.payment] || "Payment to be discussed",
    rep_name: rep.name || "", rep_email: rep.email || "", rep_phone: rep.phone || "", rep_his: rep.his || "",
    primary: rec.primary, enphase_kwh: rec.enphase_kwh, powerwall_kwh: rec.powerwall_kwh,
  };
}

export function renderProposalHtml(input) {
  const d = Object.fromEntries(Object.entries(input).map(([k, v]) => [k, typeof v === "string" ? esc(v) : v]));
  const I = (n) => dataUri(n);
  const [EN_UNITS, EN_UNITS_N, EN_KW] = EN_SIZES[d.enphase_kwh];
  const pwIdx = PW_IDX[d.powerwall_kwh];
  const EN_TITLE = d.primary === "enphase" ? MAIN_TITLE : "Alternate Options";
  const PW_TITLE = d.primary === "enphase" ? "Alternate Options" : MAIN_TITLE;
  const top = (title) => `<div class="top"><a href="https://solarcraft.com"><img src="${I("x-002.jpg")}" alt="SolarCraft"></a><h1>${title}</h1></div>`;
  const foot = () => `<div class="foot"><span>SolarCraft · <a href="https://solarcraft.com">solarcraft.com</a></span><span>Battery Proposal · ${d.name} · @@</span></div>`;
  const faces = [400, 500, 600, 700].map((w) => `@font-face{font-family:'Jost';font-weight:${w};src:url('${I(`fonts/jost-latin-${w}-normal.woff2`)}')}`).join("");
  const css = `${faces}
@page{size:letter portrait;margin:0}
*{box-sizing:border-box} body{margin:0;font-family:'Jost',sans-serif;color:${INK}}
.pg{width:816px;height:1056px;position:relative;overflow:hidden;display:flex;flex-direction:column;page-break-after:always;background:#fff}
.pad{padding:0 54px}
.top{display:flex;justify-content:space-between;align-items:center;padding:34px 0 16px;border-bottom:2px solid ${GL};margin:0 54px}
.top img{height:50px;display:block}
.top h1{margin:0;font-size:28px;line-height:1.1;font-weight:700;color:${NAVY};text-align:right}
.eyebrow{font-size:13px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:${G}}
h2{margin:0;color:${NAVY};font-weight:700}
.foot{margin-top:auto;padding:12px 54px 26px;display:flex;justify-content:space-between;font-size:12px;color:${MUTE}}
.foot a{color:inherit;text-decoration:none}
@media screen{body{background:#8a8f96;padding:20px 0}.pg{margin:0 auto 20px;box-shadow:0 2px 12px rgba(0,0,0,.3)}}
@media print{body{background:#fff;padding:0}.pg{margin:0;box-shadow:none}}
`;

  // ---- Page 1 cover
  const adv = [["wrench", "Professional Sizing &amp; Project Development", "Right-sized for your home, energy use and goals."],
    ["utility-pole", "Utility Administration", "Permits, interconnection and program enrollment (e.g., VPP incentives)."],
    ["hard-hat", "Professional Design / Build", "Intelligent design, code-compliant installation and quality craftsmanship."],
    ["headset", "Expert Guidance in System Operation", "Setup, optimization and ongoing performance support."],
    ["users", "Local Responsive Service", "Fast, friendly support from our North Bay team."],
    ["award", "Industry Best Workmanship Warranty", "10-year SolarCraft workmanship warranty for lasting peace of mind."]];
  const advh = adv.map(([i, t, x]) => `<div style="display:flex;gap:14px;padding:14px 0;border-top:1px solid ${LINE}">${ic(i, 38)}<div><div style="font-size:15.5px;font-weight:600;color:${NAVY};line-height:1.2">${t}</div><div style="font-size:13.5px;line-height:1.35;margin-top:4px">${x}</div></div></div>`).join("");
  const p1 = `<div class="pg">
<img src="${I("x-000.jpg")}" style="width:816px;height:386px;object-fit:cover;display:block" alt="">
<div class="pad" style="display:grid;grid-template-columns:1.25fr 1fr;gap:36px;padding-top:28px">
<div>
<div style="font-size:14px;color:${MUTE}">${d.date}</div>
<div style="font-size:27px;font-weight:700;color:${NAVY};line-height:1.15;margin-top:6px">SolarCraft Battery Proposal for ${d.name}</div>
<div style="font-size:15px;color:${BLUE};margin-top:14px">${d.address}</div>
<div style="font-size:15px;line-height:1.45">${d.proposal_type}<br>${d.payment}</div>
<div style="font-size:15px;font-weight:600;color:${G};margin-top:14px">The Best in Technology &amp; Design/build Craftsmanship</div>
</div>
<div style="display:flex;flex-direction:column;gap:18px;border-left:1px solid ${LINE};padding-left:30px">
<a href="https://solarcraft.com"><img src="${I("x-002.jpg")}" style="width:220px;display:block" alt="SolarCraft"></a>
<div style="font-size:14px;line-height:1.5"><span style="color:${MUTE}">Developed by:</span><br><b style="color:${NAVY};font-weight:600">${d.rep_name}</b><br><a href="mailto:${d.rep_email}" style="color:${INK}">${d.rep_email}</a><br>${d.rep_phone}<br>HIS#${d.rep_his}</div>
</div></div>
<div class="pad" style="padding-top:26px">
<div class="eyebrow">The SolarCraft Advantage</div>
<h2 style="font-size:26px;margin:4px 0 10px">More Value Than the Technology Alone</h2>
<div style="display:grid;grid-template-columns:1fr 1fr;column-gap:34px">${advh}</div>
</div>
${foot()}</div>`;

  // ---- Page 2 difference
  const dif = [["mountain", "Trusted Local Company", "We are proud to be the largest locally-based solar provider in the North Bay (Marin, Sonoma, Napa!). Our personal relationships with the local building departments, code expertise, and our decades of experience with the building types, micro-climates, and community leadership, separate us from the pack."],
    ["users", "100% Employee-Owned &amp; Operated (ESOP)", "All aspects of SolarCraft’s work is performed by in-house experts and owners of our business. Your project’s success is their success!"],
    ["drafting-compass", "Best in Solar &amp; Battery Technology and Design-Build Craftsmanship", "SolarCraft focuses on two traits: Providing high quality solar and battery systems and an impeccable customer experience. The result is unequivocally the best value for your investment."],
    ["trophy", "Industry Leadership and Experience", "SolarCraft is a licensed and bonded Electrical (C10), Solar (C46) and General(B) Contractor with accredited Certified Electricians to install residential and commercial systems."]];
  const difh = dif.map(([i, t, x]) => `<div style="display:flex;gap:20px;padding:16px 0;border-top:1px solid ${LINE}">${ic(i, 46)}<div style="border-left:2px solid #B9C6E6;padding-left:18px"><div style="font-size:17px;font-weight:600;color:${NAVY};line-height:1.2">${t}</div><div style="font-size:14px;line-height:1.45;margin-top:5px">${x}</div></div></div>`).join("");
  const p2 = `<div class="pg">${top("The SolarCraft Difference")}
<div class="pad" style="padding-top:24px">
<div style="font-size:21px;font-style:italic;color:${G};line-height:1.35">SolarCraft delivers more than energy security, independence and savings. SolarCraft delivers peace of mind.</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:22px">
<img src="${I("couple.jpg")}" style="width:100%;height:210px;object-fit:cover;display:block" alt="">
<img src="${I("elec.jpg")}" style="width:100%;height:210px;object-fit:cover;display:block" alt="">
</div>
<div style="margin-top:20px">${difh}</div>
<div style="font-size:17px;font-style:italic;color:${BLUE};margin-top:14px;padding-top:14px;border-top:1px solid ${LINE}">SolarCraft creates a positive impact in our North Bay community &amp; the planet.</div>
</div>${foot()}</div>`;

  // ---- Enphase page
  const stats = [[`${d.enphase_kwh} kWh`, "usable storage"], [EN_KW, "continuous power"], ["15 yr", "industry leading warranty"], ["LFP", "safest-class chemistry"]];
  const st = stats.map(([a, b]) => `<div style="background:#EEF3FA;border-top:3px solid ${GL};padding:12px 14px"><div style="font-size:24px;font-weight:600;color:${NAVY}">${a}</div><div style="font-size:13px">${b}</div></div>`).join("");
  const ef = [["Real Energy Management", "Optimize how and when you use stored energy, including load shedding and smart EV charging to lower costs and protect critical loads."],
    ["14.2 kW continuous output", "Run AC, a well pump and the kitchen at the same time without rationing circuits."],
    ["Field-replaceable 5 kWh modules", "Service is faster and less disruptive: swap a module, not the whole battery."],
    ["Fan-free passive cooling", "Whisper quiet, with no moving parts to wear out, clean or replace."],
    ["Storm Guard &amp; Enphase App", "Charges ahead of severe weather and shows solar, storage and savings from your phone."],
    ["Built-in IQ8 microinverters", "No single central inverter to fail. If one part needs service, the rest keeps your power on."]];
  const efh = ef.map(([t, x]) => `<div style="padding:10px 0;border-bottom:1px solid ${LINE}"><div style="font-size:16px;font-weight:600;color:${NAVY}">${t}</div><div style="font-size:13.5px;line-height:1.4;margin-top:2px">${x}</div></div>`).join("");
  const pr = [["1 IQ 10C – 10 kWh / 7 kW", "$14,490 – $15,525", "$20,700"], ["2 IQ 10C – 20 kWh / 14 kW", "$20,265 – $21,713", "$28,950"], ["3 IQ 10C – 30 kWh / 21 kW", "$26,075 – $27,938", "$37,250"]];
  const prh = pr.map(([a, b, c]) => { const on = a.startsWith(`${EN_UNITS_N} `);
    return `<div style="display:grid;grid-template-columns:1.2fr 1.2fr .7fr;align-items:baseline;padding:7px 0;border-bottom:1px solid ${LINE}"><span style="font-size:13.5px;${on ? "font-weight:600;color:" + G : ""}">${a}</span><span style="font-size:18px;font-weight:600;color:${on ? G : BLUE}">${b}</span><span style="font-size:12.5px;color:${MUTE};text-align:right">list ${c}</span></div>`; }).join("");
  const p3 = `<div class="pg">${top(EN_TITLE)}
<div class="pad" style="padding-top:20px;display:grid;grid-template-columns:1.15fr 1fr;gap:24px;align-items:center">
<div><div style="font-size:18px;font-weight:600;color:${G}">${d.enphase_kwh}kWh ENPHASE IQ Battery System</div>
<div style="font-size:27px;font-weight:700;color:${NAVY};line-height:1.12;margin:6px 0 10px">Quiet, redundant power that keeps your whole home running.</div>
<div style="font-size:14px;line-height:1.45"><b>${EN_UNITS} 10kWh IQ10C</b> battery units with built-in microinverters + IQ6C Controller and Meter Collar deliver serious backup capacity, smart savings every day, no single point of failure, and the longest lifespan and warranty.</div></div>
<div style="display:flex;flex-direction:column;align-items:center;gap:12px"><img src="${I("enlogo.jpg")}" style="width:200px;display:block" alt="Enphase"><img src="${I("enph.jpg")}" style="width:100%;display:block" alt="Enphase IQ batteries"></div>
</div>
<div class="pad" style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:18px">${st}</div>
<div class="pad" style="display:grid;grid-template-columns:1fr 1fr;column-gap:30px;margin-top:10px">${efh}</div>
<div style="margin:18px 54px 0;background:#EEF3FA;padding:16px 20px">
<div style="font-size:14px;font-weight:600;color:${G};letter-spacing:.04em">EST. COST WITH PREPAID PPA DISCOUNT*</div>
<div style="margin-top:4px">${prh}</div>
<div style="font-size:12.5px;line-height:1.45;margin-top:10px">*Reflects a 25–30% prepaid PPA discount, which can apply to Enphase batteries. <b style="color:${G};font-weight:600">Plus: SolarCraft-Maxwell discount.</b><br>Includes IQ6C controller with Meter Collar, engineering, permits, PG&amp;E interconnection, automatic transfer switch, monitoring, labor near the main panel, 10-year workmanship warranty, manufacturer’s warranty and sales tax.</div>
</div>${foot()}</div>`;

  // ---- Powerwall page
  const pf = [["clock", "Time-of-use savings", "Stores solar or off-peak energy and uses it during PG&amp;E’s expensive evening peak hours."],
    ["sun", "Use more of your own solar", "Keep extra daytime solar for your home instead of exporting it to the grid for low credits."],
    ["layers", "Built-in solar inverter", "One box replaces two — fewer parts and lower cost when adding new solar."],
    ["gauge", "11.5 kW with 185 LRA motor start", "Whole-home backup from one unit — starts AC compressors and well pumps smoothly."],
    ["cloud-lightning", "Storm Watch", "Automatically charges to full ahead of severe weather — no action needed."],
    ["smartphone", "Tesla app &amp; LFP chemistry", "Track savings live from your phone, with long-life cells built for daily cycling."]];
  const pfh = pf.map(([i, t, x]) => `<div style="display:flex;gap:14px;padding:12px 0;border-bottom:1px solid ${LINE}">${ic(i, 34)}<div><div style="font-size:16px;font-weight:600;color:${NAVY}">${t}</div><div style="font-size:13.5px;line-height:1.4;margin-top:2px">${x}</div></div></div>`).join("");
  const rows = [["Powerwall 3 (starting size)", "13.5 kWh", "11.5 kW", "$22,050", "$15,435 – $16,538", pwIdx === 0], ["+ 1 expansion", "27 kWh", "11.5 kW", "$31,400", "$21,980 – $23,550", pwIdx === 1], ["+ 2 expansions", "40.5 kWh", "11.5 kW", "$40,750", "$28,525 – $30,563", pwIdx === 2]];
  const cols = "grid-template-columns:1.6fr .8fr .7fr .8fr 1.45fr";
  const rh = rows.map(([a, b, c, x, e, h]) => `<div style="display:grid;${cols};padding:9px 0;border-bottom:1px solid ${LINE};align-items:baseline"><span style="font-size:14.5px;font-weight:${h ? 600 : 500};color:${h ? G : BLUE}">${a}</span><span style="font-size:14.5px;font-weight:600;color:${NAVY}">${b}</span><span style="font-size:14.5px;font-weight:600;color:${NAVY}">${c}</span><span style="font-size:14px;color:${MUTE}">${x}</span><span style="font-size:15.5px;font-weight:700;color:${NAVY};white-space:nowrap">${e}</span></div>`).join("");
  const p4 = `<div class="pg">${top(PW_TITLE)}
<div class="pad" style="padding-top:22px;display:grid;grid-template-columns:1.5fr 1fr;gap:28px;align-items:center">
<div><img src="${I("pwlogo.jpg")}" style="height:40px;display:block" alt="Tesla Powerwall">
<div class="eyebrow" style="margin-top:14px">${PW_LABEL[pwIdx]}</div>
<div style="font-size:28px;font-weight:700;color:${NAVY};line-height:1.12;margin:8px 0 10px">Whole-home backup and a solar inverter in one sleek unit.</div>
<div style="font-size:14.5px;line-height:1.45">Powerwall 3 pairs 13.5 kWh of storage with 11.5 kW of continuous power and a built-in solar inverter — fewer boxes on the wall, more power in your home.</div></div>
<img src="${I("pw.jpg")}" style="width:190px;justify-self:center;display:block" alt="Tesla Powerwall 3">
</div>
<div class="pad" style="display:grid;grid-template-columns:1fr 1fr;column-gap:30px;margin-top:16px">${pfh}</div>
<div class="pad" style="margin-top:24px"><h2 style="font-size:22px;font-weight:500">Sizes and preliminary pricing</h2>
<div style="display:grid;${cols};padding:8px 0;border-top:2px solid ${NAVY};border-bottom:1px solid ${NAVY};margin-top:8px;font-size:13px;color:${MUTE}"><span>System</span><span>Storage</span><span>Power</span><span>List price</span><span>After discount*</span></div>
${rh}
<div style="font-size:12px;color:${MUTE};margin-top:8px">*Reflects a 25–30% prepaid PPA discount, which can apply to Tesla batteries.</div>
</div>${foot()}</div>`;

  // ---- Page 5 Next steps
  const steps = [["handshake", "Say yes to this plan", "Tell us you’d like to move forward."], ["house", "One site visit", "We confirm equipment placement, details and final scope of work."], ["clipboard-check", "Design and permits", "Engineering, permits and PG&amp;E paperwork."], ["wrench", "Install and inspect", "Our own crew, then inspections and approval."], ["chart-column", "Learn your system", "We walk you through it, and stay on call."], ["dollar-sign", "Savings &amp; Security", "Lower energy costs, backup power and long-term value."]];
  const sh = steps.map(([i, t, x], n) => `<div style="padding:18px 18px 18px ${n % 3 === 0 ? 0 : 18}px;${n % 3 === 0 ? "" : `border-left:1px solid ${LINE};`}${n >= 3 ? `border-top:1px solid ${LINE};` : ""}"><div style="display:flex;align-items:center;gap:12px"><span style="font-size:30px;font-weight:700;color:${GL}">${n + 1}</span>${ic(i, 36)}</div><div style="font-size:17px;font-weight:600;color:${BLUE};margin-top:10px;line-height:1.2">${t}</div><div style="font-size:14px;line-height:1.4;margin-top:6px">${x}</div></div>`).join("");
  const p5 = `<div class="pg">${top("Next Steps")}
<div class="pad" style="padding-top:30px"><h2 style="font-size:26px">Six steps, and we handle the hard parts</h2>
<div style="display:grid;grid-template-columns:repeat(3,1fr);margin-top:18px">${sh}</div>
<div style="margin-top:44px;border:1.5px solid #8FA6DA;border-radius:12px;padding:26px 30px 30px">
<h2 style="font-size:24px">LETTER OF INTENT</h2>
<div style="font-size:15.5px;line-height:1.5;margin-top:8px">I would like to move forward with the next step and approve a SolarCraft expert visit to my home to confirm project details and price before sending contract.</div>
<div style="display:flex;align-items:flex-end;gap:10px;margin-top:56px">${ic("pen-line", 28, G, 1.6)}<div style="flex:1;border-bottom:2px solid ${NAVY}"></div></div>
<div style="font-size:15px;font-weight:600;color:${BLUE};margin:6px 0 0 38px">Client Signature</div>
<div style="display:flex;align-items:flex-end;gap:10px;margin-top:44px;width:60%">${ic("calendar-days", 28, G, 1.6)}<div style="flex:1;border-bottom:2px solid ${NAVY}"></div></div>
<div style="font-size:15px;font-weight:600;color:${BLUE};margin:6px 0 0 38px">Date</div>
</div>
<div style="margin-top:30px;font-size:14px;line-height:1.5">Questions? Contact <b style="color:${NAVY};font-weight:600">${d.rep_name}</b> · <a href="mailto:${d.rep_email}" style="color:${INK}">${d.rep_email}</a> · ${d.rep_phone}</div>
</div>${foot()}</div>`;

  const seq = d.primary === "enphase" ? [p1, p2, p3, p4, p5] : [p1, p2, p4, p3, p5];
  const body = seq.map((p, i) => p.replace("@@", `${i + 1} / 5`)).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>SolarCraft Battery Proposal · ${d.name}</title><style>${css}</style></head><body>${body}</body></html>`;
}
