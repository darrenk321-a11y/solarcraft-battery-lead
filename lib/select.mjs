// SolarCraft battery system selection.
// Reads a call record (the 10 intake questions) and returns the recommended
// system, the alternate, the sizes to quote, the reasons and the site-visit flags.
// These rules follow the "System selection worksheet". They are a starting
// draft: SolarCraft engineers should review them before reps rely on them.

const LARGE_LOADS = new Set(["ac", "heat_pump", "well_pump"]);
const LIFE_SAFETY = new Set(["medical", "gates", "garage_doors", "locks", "elevator"]);
const LABEL = { ac: "AC", heat_pump: "heat pump", well_pump: "well pump", medical: "medical equipment",
  gates: "electric gates", garage_doors: "garage doors", locks: "electric locks", elevator: "elevator or stair lift" };

// Estimated cost with the prepaid PPA discount (from the proposal's price tables)
export const PRICES = {
  enphase: { 10: [14490, 15525], 20: [20265, 21713], 30: [26075, 27938] },
  powerwall: { 13.5: [15435, 16538], 27: [21980, 23550], 40.5: [28525, 30563] },
};
export const SYSTEM_NAME = { enphase: "Enphase IQ Battery 10C", powerwall: "Tesla Powerwall 3" };

export function recommend(call) {
  const solar = call.solar || {};
  const mustRun = new Set(call.must_run || []);
  const life = new Set(call.life_safety || []);
  const future = new Set(call.future_plans || []);
  const backup = call.backup_level || null;

  const score = { enphase: 0, powerwall: 0 };
  const reasons = { enphase: [], powerwall: [] };
  const flags = [];
  const vote = (s, pts, why) => { score[s] += pts; reasons[s].push(why); };

  // 1. Existing solar decides the most
  if (solar.has_solar === true) {
    if (solar.microinverters === true || /enphase/i.test(solar.brand || "")) vote("enphase", 3, "Existing Enphase microinverter solar");
    else if (solar.microinverters === false) flags.push("String or other inverter: either battery can work; confirm on the site visit");
    else flags.push("Inverter type unknown: ask for a photo of the solar equipment");
    if (["leased", "lease", "ppa"].includes((solar.ownership || "").toLowerCase())) flags.push("Leased or PPA solar: the solar provider may need to approve changes");
  } else if (solar.has_solar === false) {
    vote("powerwall", 2, "No solar yet: Powerwall 3 has a built-in solar inverter");
  }
  if (future.has("more_solar")) vote("powerwall", 1, "Plans to add solar: Powerwall 3's inverter saves a box");

  // 2. Power needed at once
  const big = [...mustRun].filter((x) => LARGE_LOADS.has(x));
  if (big.length) vote("enphase", 2, `Large loads to run at once (${big.map((x) => LABEL[x]).join(", ")}): Enphase power grows with each battery`);

  // 3. Whole-home storage for the budget
  if (backup === "whole_home" && !big.length) vote("powerwall", 1, "Whole-home backup: Powerwall 3 offers the most storage per dollar");

  // 4. Life-safety loads
  const ls = [...life].filter((x) => LIFE_SAFETY.has(x));
  if (ls.length) flags.push(`Life-safety loads (${ls.map((x) => LABEL[x]).join(", ")}): size up and confirm these circuits on the site visit`);

  if (!call.bill_received) flags.push("No PG&E bill yet: sizing is based on answers only");
  if (!call.panel_photo_received) flags.push("No panel photo yet: service size and gas-meter clearance unknown");

  let primary;
  if (score.enphase === score.powerwall) { primary = "enphase"; flags.push("Rules gave a tie: rep should confirm the recommended system"); }
  else primary = score.enphase > score.powerwall ? "enphase" : "powerwall";

  const stepUp = backup === "whole_home" || big.length > 0 || ls.length > 0 || future.has("ev");
  let enphase_kwh = stepUp ? 30 : 20;
  let powerwall_kwh = stepUp ? 27 : 13.5;
  if (backup === "whole_home" && big.length) powerwall_kwh = 40.5;

  // Rep overrides
  const o = call.override || {};
  if (o.primary === "enphase" || o.primary === "powerwall") primary = o.primary;
  if ([20, 30].includes(Number(o.enphase_kwh))) enphase_kwh = Number(o.enphase_kwh);
  if ([13.5, 27, 40.5].includes(Number(o.powerwall_kwh))) powerwall_kwh = Number(o.powerwall_kwh);

  const alternate = primary === "enphase" ? "powerwall" : "enphase";
  const kwh = primary === "enphase" ? enphase_kwh : powerwall_kwh;
  const [lo, hi] = PRICES[primary][kwh];
  return {
    primary, alternate, enphase_kwh, powerwall_kwh, score,
    reasons: reasons[primary].length ? reasons[primary] : ["No strong signal from the answers"],
    flags,
    price_low: lo, price_high: hi, value: Math.round((lo + hi) / 2),
  };
}
