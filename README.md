# SolarCraft Battery Leads

Staff site for battery leads: take the 10-question intake on a call, press
**Make proposal** to build the 5-page proposal PDF, and track each lead on the
dashboard (stages, follow-ups due, results by rep, systems and value).

Runs on Netlify: static pages in `public/`, functions in `netlify/functions/`,
data in Netlify Blobs (no database to set up).

## Deploy (one time)

1. Put this folder in a GitHub repository, then in Netlify choose
   **Add new site → Import an existing project** and pick that repository.
   Build settings come from `netlify.toml`; leave the build command empty.
   (Drag-and-drop deploys don't install the PDF packages, so use GitHub or the
   Netlify CLI: `npm install` then `netlify deploy --prod`.)
2. In **Site configuration → Environment variables**, add:
   - `STAFF_PASSWORD`: the password your staff will use to sign in.
   - `SESSION_SECRET`: a long random string (at least 24 characters). Changing
     it signs everyone out.
3. Redeploy so the variables take effect, then open the site and sign in.

Optional: `CHROMIUM_PACK_URL` points to the headless Chromium pack the PDF
builder downloads. The default is the matching v143.0.4 x64 pack on GitHub.

## How it works

| Piece | File |
| --- | --- |
| Selection rules (draft, for engineering review) | `lib/select.mjs` |
| Proposal design | `lib/proposal.mjs`, images and fonts in `assets/` |
| PDF builder (headless Chromium) | `lib/pdf.mjs`, run by `netlify/functions/build-proposal-background.mjs` |
| Staff login | `lib/auth.mjs`, `netlify/functions/login.mjs` |
| Calls, uploads, proposal downloads | `netlify/functions/calls.mjs`, `files.mjs`, `proposal.mjs` |
| Dashboard and call pages | `public/` |

Prices, the 10 kWh Enphase row and company facts are written into
`lib/proposal.mjs` and `lib/select.mjs`; update them there when they change.

If a PDF ever fails to build, the call page offers a printable version of the
proposal; open it and use the browser's Save as PDF.

## Test locally

    npm install
    STAFF_PASSWORD=test SESSION_SECRET=local-test-secret-1234567890 npm run dev

Then open http://localhost:8888. Local data is kept in `.data/`.
