# EPA Observed Feedback

A small local web app for recording feedback on an observed Entrustable
Professional Activity (EPA). It ships with the ABP Neonatal-Perinatal
Medicine EPAs (`data/epas.json`): each EPA's description, defining
functions, and what each entrustment level (1, 2, 3a, 3b, 4, 5) looks like
behaviorally. The feedback form captures the learner, evaluator,
gestational age, and location alongside typed or dictated (voice-to-text)
narrative feedback, and appends every submission to a CSV file formatted so
it can be imported into Qualtrics — downloadable any time.

## Running it

```bash
npm install
npm start
```

Then open http://localhost:3000 in a browser (Chrome recommended for
voice-to-text — see below).

## Customizing the EPA(s) and level descriptions

Edit `data/epas.json`. It's an array of EPAs; each entry has an `id`,
`title`, `category`, `description`, a `definingFunctions` array (the bullet
list of core functions), and a `levels` object with keys `"1"`, `"2"`,
`"3a"`, `"3b"`, `"4"`, `"5"` describing what that entrustment level looks
like behaviorally for that specific activity. Add, remove, or edit entries
to match your program's EPAs.

## Voice-to-text

The "Start voice-to-text" button uses the browser's built-in Web Speech API
(no external service or API key needed). It's well supported in Chrome and
Edge; Firefox and Safari support is limited or absent. You can always type
directly into the feedback box instead, and you can edit dictated text
before submitting.

## Data storage and export

Every submission is always appended as a row to `data/responses.csv` (or
wherever `RESPONSES_DIR` points, see below) — this is a local backup that
exists regardless of whether Qualtrics auto-upload is configured. That
file uses the same 3-row header structure as a Qualtrics "legacy" CSV
export (field names / question text / `ImportId` metadata), so it can be
re-imported into Qualtrics as response data, or opened directly in
Excel/Google Sheets/Numbers.

Click "Download all feedback (CSV)" on the page (or visit `/api/export`) to
download the current file at any time.

## Automatic upload to Qualtrics

When the three environment variables below are set, every submission is
also pushed live into a Qualtrics survey via Qualtrics's Response Import
API, in addition to the local CSV backup above. If the push fails for any
reason (bad credentials, network issue, survey misconfigured), the error is
logged server-side and the submission is still safely in the local CSV —
nothing is lost.

**1. Set up the receiving survey in Qualtrics**

- Create a survey in Qualtrics (or use an existing one) to act as the data
  store. It doesn't need real questions — it's just a place to collect
  the embedded data.
- Open **Survey Flow**, add an **Embedded Data** element (near the top),
  and add these exact field names — spelling and underscores matter,
  since Qualtrics silently drops any value whose field name doesn't
  match one defined here:
  `EPA_Title`, `Entrustment_Level`, `Learner_Name`, `Evaluator_Name`,
  `Gestational_Age`, `Care_Location`, `Feedback_Text`, `Response_Id`.
  (It's `Care_Location`, not `Location` — Qualtrics reserves `Location`
  for its own automatic geolocation tracking on every response, so using
  that name for our field causes it to be shadowed by Qualtrics's own
  geo data instead of showing what you typed.)
- Publish the survey.

**2. Gather three values from your Qualtrics account**

- **API token**: account icon (top right) → **Account Settings** →
  **Qualtrics IDs** tab → generate/copy your **API Token**.
- **Datacenter ID**: same **Qualtrics IDs** page, listed under the API
  section (e.g. `iad1`, `syd1`, `fra1`) — also visible as the subdomain
  when you're logged into Qualtrics (`https://<datacenter>.qualtrics.com`).
- **Survey ID**: on the **Qualtrics IDs** page, or in the survey's URL
  while editing it — starts with `SV_`.

**3. Set them as environment variables**

- **Locally**: `export QUALTRICS_DATACENTER=... QUALTRICS_API_TOKEN=... QUALTRICS_SURVEY_ID=...`
  before `npm start` (never commit these to git).
- **On Render**: the `render.yaml` Blueprint declares these three as
  secret env vars — Render prompts you to enter them when you apply the
  Blueprint, or set/update them anytime under the service's
  **Environment** tab. No redeploy is needed to pick up a changed value.

**4. Verify it**

Submit a piece of test feedback through the app, then check:
- The service logs (Render dashboard → **Logs**) for a
  `Qualtrics push payload: {...}` line (the exact data sent) followed by
  either `Pushed R_... to Qualtrics.` or a `Qualtrics push failed for
  R_...` error with details.
- Your Qualtrics survey's **Data & Analysis** tab for the new response —
  compare each field there against the logged payload. If a field is
  blank in Qualtrics but present in the log, its name doesn't match the
  Embedded Data element exactly (check for typos, spaces vs underscores,
  or case differences).

**If you already have a survey set up with the old `Location` field
name**: rename that Embedded Data field to `Care_Location` in Survey
Flow (existing responses keep their data; new ones will populate the
renamed field).

**If a response was created in Qualtrics but every field was blank**:
that was a bug in an earlier version of this integration (embedded data
was nested inside `values` instead of its own top-level `embeddedData`
key, so Qualtrics silently ignored all of it) — fixed now. Pull the
latest code and redeploy, then submit a fresh test entry.

If it fails, send me the logged error and I'll adjust the integration —
I built this against Qualtrics's documented Import Responses API but
couldn't test it live from this environment (its network policy blocks
`api.qualtrics.com`), so a first real test after deploying is worth doing.

## Deploying to Render

This repo includes a `render.yaml` Blueprint that deploys the app as a web
service with a 1GB persistent disk mounted at `/var/data` (feedback data
is stored there via the `RESPONSES_DIR` env var, so it survives restarts
and redeploys — Render's default filesystem is otherwise wiped on every
deploy).

1. Push this repo to GitHub (already done if you're reading this from the
   repo) and sign in at https://dashboard.render.com.
2. Click **New +** → **Blueprint**.
3. Connect your GitHub account/repo if you haven't already, then select
   this repository and the branch you want to deploy.
4. Render detects `render.yaml` and shows the `epa-feedback-app` service
   it will create, on the **Starter** plan (~$7/month — required for the
   persistent disk; the free plan does not support disks).
5. Click **Apply** / **Create**. Render will build (`npm install`) and
   start (`npm start`) the service.
6. Once deployed, Render gives you a public URL like
   `https://epa-feedback-app.onrender.com` — that's your remote link.

To redeploy after future code changes, push to the connected branch;
Render auto-deploys on push (or trigger it manually from the dashboard).

**Note:** as configured, this app has no login — anyone with the URL can
view and submit feedback, including the trainee/evaluator names and
narrative text. Don't post the link anywhere public. If you later want a
shared password, ask and I can add HTTP basic auth in front of the app.

## Notes

- This is intentionally a small single-server app (Express + static
  frontend) with no database. Locally it stores data in `data/`; in
  production it uses the `RESPONSES_DIR` env var (see above) so it can
  point at a persistent disk instead of the container's ephemeral
  filesystem.
