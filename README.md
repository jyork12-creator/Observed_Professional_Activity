# EPA Observed Feedback

A small local web app for recording feedback on an observed Entrustable
Professional Activity (EPA). It shows what the EPA is and what each
entrustment level (1, 2, 3a, 3b, 4, 5) looks like behaviorally, lets you type
or dictate (voice-to-text) narrative feedback, and appends every submission
to a CSV file formatted so it can be imported into Qualtrics — downloadable
any time.

## Running it

```bash
npm install
npm start
```

Then open http://localhost:3000 in a browser (Chrome recommended for
voice-to-text — see below).

## Customizing the EPA(s) and level descriptions

Edit `data/epas.json`. It's an array, so you can define more than one EPA;
each entry needs an `id`, `title`, `description`, and a `levels` object with
keys `"1"`, `"2"`, `"3a"`, `"3b"`, `"4"`, `"5"` describing what that
entrustment level looks like behaviorally for that specific activity. The
shipped entry is a generic placeholder based on the standard entrustment
scale (Ten Cate) — replace it with your program's actual EPA text.

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

## Notes

- This is intentionally a small single-server app (Express + static
  frontend) with no database and no authentication, meant to be run
  locally or on a machine you control. If you want to host it somewhere
  shared, add authentication before exposing it beyond localhost, since
  anyone who can reach it can read and add feedback.
