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

Every submission is appended as a row to `data/responses.csv` on the
server. That file uses the same 3-row header structure as a Qualtrics
"legacy" CSV export (field names / question text / `ImportId` metadata), so
it can be re-imported into Qualtrics as response data, or opened directly
in Excel/Google Sheets/Numbers.

Click "Download all feedback (CSV)" on the page (or visit `/api/export`) to
download the current file at any time. The file lives only on the machine
running the server — nothing is sent anywhere else.

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
