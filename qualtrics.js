// Pushes a single response into a Qualtrics survey using Qualtrics's
// "Response Import" API: https://api.qualtrics.com/ (Import Responses).
// That API is file-upload + async-job based (there is no simple
// single-response "create" endpoint), so each push starts a job with a
// one-row JSON file, then polls until Qualtrics reports it complete.
//
// The target survey must have an Embedded Data element (Survey Flow) with
// these exact field names, or Qualtrics will silently ignore unknown
// fields: EPA_Title, Entrustment_Level, Learner_Name, Evaluator_Name,
// Gestational_Age, Care_Location, Feedback_Text, Response_Id.
//
// Note: the field is named Care_Location (not "Location") to avoid
// colliding with Qualtrics's own reserved location-tracking metadata,
// which every response carries regardless of what we send.

const DATACENTER = process.env.QUALTRICS_DATACENTER;
const API_TOKEN = process.env.QUALTRICS_API_TOKEN;
const SURVEY_ID = process.env.QUALTRICS_SURVEY_ID;

const isConfigured = Boolean(DATACENTER && API_TOKEN && SURVEY_ID);

function baseUrl() {
  return `https://${DATACENTER}.qualtrics.com/API/v3/surveys/${SURVEY_ID}/import-responses`;
}

async function startImportJob(embeddedData) {
  const fileContents = JSON.stringify({
    responses: [
      {
        values: {
          finished: true,
          ...embeddedData,
        },
      },
    ],
  });

  console.log('Qualtrics push payload:', JSON.stringify(embeddedData));

  const form = new FormData();
  form.append('file', new Blob([fileContents], { type: 'application/json' }), 'response.json');
  form.append('fileType', 'json');

  const res = await fetch(baseUrl(), {
    method: 'POST',
    headers: { 'X-API-TOKEN': API_TOKEN },
    body: form,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(`Qualtrics import start failed (${res.status}): ${JSON.stringify(data)}`);
  }

  const progressId = data?.result?.progressId || data?.result?.id;
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

// Fire-and-forget from the caller's perspective: resolves/rejects but the
// HTTP handler does not need to await it before responding to the browser.
async function pushResponseToQualtrics(row) {
  if (!isConfigured) return;

  const embeddedData = {
    EPA_Title: row.EPA_Title,
    Entrustment_Level: row.Entrustment_Level,
    Learner_Name: row.Learner_Name,
    Evaluator_Name: row.Evaluator_Name,
    Gestational_Age: row.Gestational_Age,
    Care_Location: row.Location,
    Feedback_Text: row.Feedback_Text,
    Response_Id: row.ResponseId,
  };

  const progressId = await startImportJob(embeddedData);
  await pollImportJob(progressId);
}

module.exports = { pushResponseToQualtrics, isConfigured };
