// Pushes a single response into a Qualtrics survey using Qualtrics's
// "Start Response Import" API. Confirmed against Qualtrics's own
// auto-generated API client (via the qualtrics-utils PyPI package, whose
// client is generated from Qualtrics's published OpenAPI spec) after an
// earlier version of this file guessed wrong:
//
//   - This endpoint only imports a CSV or TSV FILE. There is no JSON body
//     format for response data itself.
//   - For a file you have locally (not hosted at a public URL), you send
//     the raw file bytes directly as the POST body with
//     Content-Type: text/csv (or text/tab-separated-values) — NOT
//     multipart/form-data, and NOT wrapped in JSON.
//   - Files use the same 3-header-row format as a normal Qualtrics
//     export: row 1 is the field name, row 2 is the question text, row 3
//     is {"ImportId":"..."}. For embedded data (as opposed to real
//     survey questions), the ImportId is just the field's own name.
//
// The target survey must have an Embedded Data element (Survey Flow) with
// these exact field names: EPA_Title, Entrustment_Level, Learner_Name,
// Evaluator_Name, Gestational_Age, Care_Location, Feedback_Text,
// Response_Id.
//
// Note: the field is named Care_Location (not "Location") to avoid
// colliding with Qualtrics's own reserved location-tracking metadata,
// which every response carries regardless of what we send.

const DATACENTER = process.env.QUALTRICS_DATACENTER;
const API_TOKEN = process.env.QUALTRICS_API_TOKEN;
const SURVEY_ID = process.env.QUALTRICS_SURVEY_ID;

const isConfigured = Boolean(DATACENTER && API_TOKEN && SURVEY_ID);

// System metadata columns use Qualtrics's own camelCase ImportIds (the
// same ones a real Qualtrics response export uses); embedded data columns
// use the field's own name as its ImportId (confirmed above).
const COLUMNS = [
  { field: 'StartDate', importId: 'startDate' },
  { field: 'EndDate', importId: 'endDate' },
  { field: 'Status', importId: 'status' },
  { field: 'Progress', importId: 'progress' },
  { field: 'Duration (in seconds)', importId: 'duration' },
  { field: 'Finished', importId: 'finished' },
  { field: 'RecordedDate', importId: 'recordedDate' },
  { field: 'EPA_Title', importId: 'EPA_Title' },
  { field: 'Entrustment_Level', importId: 'Entrustment_Level' },
  { field: 'Learner_Name', importId: 'Learner_Name' },
  { field: 'Evaluator_Name', importId: 'Evaluator_Name' },
  { field: 'Gestational_Age', importId: 'Gestational_Age' },
  { field: 'Care_Location', importId: 'Care_Location' },
  { field: 'Feedback_Text', importId: 'Feedback_Text' },
  { field: 'Response_Id', importId: 'Response_Id' },
];

function csvEscape(value) {
  const str = value === undefined || value === null ? '' : String(value);
  if (/[",\n\r]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function csvRow(values) {
  return values.map(csvEscape).join(',') + '\r\n';
}

function buildImportCsv(rowValues) {
  const header1 = csvRow(COLUMNS.map((c) => c.field));
  const header2 = csvRow(COLUMNS.map((c) => c.field));
  const header3 = csvRow(COLUMNS.map((c) => JSON.stringify({ ImportId: c.importId })));
  const dataRow = csvRow(COLUMNS.map((c) => rowValues[c.field]));
  return header1 + header2 + header3 + dataRow;
}

function baseUrl() {
  return `https://${DATACENTER}.qualtrics.com/API/v3/surveys/${SURVEY_ID}/import-responses`;
}

async function startImportJob(rowValues) {
  const csv = buildImportCsv(rowValues);
  console.log('Qualtrics push target URL:', baseUrl());
  console.log('Qualtrics push payload (CSV):', csv);

  const res = await fetch(baseUrl(), {
    method: 'POST',
    headers: {
      'X-API-TOKEN': API_TOKEN,
      'Content-Type': 'text/csv',
      charset: 'UTF-8',
    },
    body: csv,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(`Qualtrics import start failed (${res.status}): ${JSON.stringify(data)}`);
  }

  const progressId = data?.result?.progressId;
  if (!progressId) {
    throw new Error(`Qualtrics import start returned no progressId: ${JSON.stringify(data)}`);
  }
  return progressId;
}

async function pollImportJob(progressId, { attempts = 10, delayMs = 1000 } = {}) {
  const url = `${baseUrl()}/${progressId}`;
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(url, { headers: { 'X-API-TOKEN': API_TOKEN } });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(`Qualtrics import status check failed (${res.status}): ${JSON.stringify(data)}`);
    }

    const status = data?.result?.status;
    if (status === 'complete') return;
    if (status === 'failed') {
      throw new Error(`Qualtrics import job failed: ${JSON.stringify(data.result)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error('Timed out waiting for Qualtrics import job to complete.');
}

// Qualtrics's CSV import rejects full ISO 8601 timestamps (the
// millisecond precision and trailing "Z" trip its date parser, per
// error IMPORTS_307 "The provided date is invalid"). It wants a plain
// "YYYY-MM-DD HH:MM:SS" — no "T", no milliseconds, no zone suffix.
function qualtricsDate(isoString) {
  return isoString.replace('T', ' ').replace(/\.\d+Z$/, '');
}

// Fire-and-forget from the caller's perspective: resolves/rejects but the
// HTTP handler does not need to await it before responding to the browser.
async function pushResponseToQualtrics(row) {
  if (!isConfigured) return;

  const rowValues = {
    StartDate: qualtricsDate(row.StartDate),
    EndDate: qualtricsDate(row.EndDate),
    Status: 0,
    Progress: 100,
    'Duration (in seconds)': 0,
    Finished: 'True',
    RecordedDate: qualtricsDate(row.RecordedDate),
    EPA_Title: row.EPA_Title,
    Entrustment_Level: row.Entrustment_Level,
    Learner_Name: row.Learner_Name,
    Evaluator_Name: row.Evaluator_Name,
    Gestational_Age: row.Gestational_Age,
    Care_Location: row.Location,
    Feedback_Text: row.Feedback_Text,
    Response_Id: row.ResponseId,
  };

  const progressId = await startImportJob(rowValues);
  await pollImportJob(progressId);
}

module.exports = { pushResponseToQualtrics, isConfigured, getTargetUrl: baseUrl };
