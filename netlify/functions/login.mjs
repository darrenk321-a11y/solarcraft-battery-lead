import { configured, passwordOk, sessionCookie, clearCookie, isAuthed, json } from "../../lib/auth.mjs";

export default async (req) => {
  if (!configured()) return json({ error: "The site isn't set up yet. Add STAFF_PASSWORD and SESSION_SECRET in Netlify's environment variables." }, 503);
  if (req.method === "GET") return json({ signedIn: isAuthed(req) });
  if (req.method === "DELETE") return json({ ok: true }, 200, { "set-cookie": clearCookie() });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const { password } = await req.json().catch(() => ({}));
  if (!passwordOk(password)) { await new Promise((r) => setTimeout(r, 800)); return json({ error: "That password isn't right." }, 401); }
  return json({ ok: true }, 200, { "set-cookie": sessionCookie() });
};
export const config = { path: "/api/login" };
