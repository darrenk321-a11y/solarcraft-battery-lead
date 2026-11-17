// Staff login: one shared password (STAFF_PASSWORD) and a signed session
// cookie (SESSION_SECRET). Every API call checks the cookie.
import crypto from "node:crypto";

const COOKIE = "sc_session";
const DAYS = 7;

export function configured() { return Boolean(process.env.STAFF_PASSWORD && process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 24); }
const sign = (v) => crypto.createHmac("sha256", process.env.SESSION_SECRET).update(v).digest("base64url");
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

export function passwordOk(pw) {
  const a = crypto.createHash("sha256").update(String(pw || "")).digest();
  const b = crypto.createHash("sha256").update(process.env.STAFF_PASSWORD).digest();
  return crypto.timingSafeEqual(a, b);
}
export function sessionCookie() {
  const exp = String(Date.now() + DAYS * 864e5);
  const secure = process.env.LOCAL_STORE_DIR ? "" : "; Secure";
  return `${COOKIE}=${exp}.${sign(exp)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${DAYS * 86400}${secure}`;
}
export function clearCookie() { return `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`; }
export function isAuthed(req) {
  if (!configured()) return false;
  const m = (req.headers.get("cookie") || "").match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return false;
  const [exp, sig] = m[1].split(".");
  return Boolean(exp && sig && same(sig, sign(exp)) && Number(exp) > Date.now());
}
export const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } });
export function guard(req) {
  if (!configured()) return json({ error: "The site isn't set up yet. Add STAFF_PASSWORD and SESSION_SECRET in Netlify's environment variables." }, 503);
  if (!isAuthed(req)) return json({ error: "Please sign in." }, 401);
  // Same-origin check for writes
  if (req.method !== "GET" && req.method !== "HEAD") {
    const origin = req.headers.get("origin"); const host = req.headers.get("host");
    if (origin && host && new URL(origin).host !== host) return json({ error: "Request blocked." }, 403);
  }
  return null;
}
