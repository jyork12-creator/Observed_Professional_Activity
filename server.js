const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const EPA_FILE = path.join(DATA_DIR, 'epas.json');
const RESPONSES_FILE = path.join(DATA_DIR, 'responses.csv');

// Column definitions mirror a Qualtrics legacy CSV export: row 1 is the
// field/column name, row 2 is the question text, row 3 is the ImportId
// metadata Qualtrics uses to re-map columns on import.
const COLUMNS = [
  { field: 'StartDate', question: 'Start Date', importId: 'STARTDATE' },
  { field: 'EndDate', question: 'End Date', importId: 'ENDDATE' },
  { field: 'Status', question: 'Response Type', importId: 'STATUS' },
  { field: 'Progress', question: 'Progress', importId: 'PROGRESS' },
  { field: 'Duration (in seconds)', question: 'Duration (in seconds)', importId: 'DURATION' },
  { field: 'Finished', question: 'Finished', importId: 'FINISHED' },
  { field: 'RecordedDate', question: 'Recorded Date', importId: 'RECORDEDDATE' },
  { field: 'ResponseId', question: 'Response ID', importId: '_recordId' },
  { field: 'EPA_Title', question: 'Which EPA was observed?', importId: 'QID1' },
  { field: 'Entrustment_Level', question: 'What entrustment level did the learner demonstrate?', importId: 'QID2' },
  { field: 'Learner_Name', question: 'Learner name / ID', importId: 'QID3' },
  { field: 'Evaluator_Name', question: 'Evaluator name', importId: 'QID4' },
  { field: 'Feedback_Text', question: 'Narrative feedback', importId: 'QID5' },
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

function ensureResponsesFile() {
  if (!fs.existsSync(RESPONSES_FILE)) {
    const header1 = csvRow(COLUMNS.map((c) => c.field));
    const header2 = csvRow(COLUMNS.map((c) => c.question));
    const header3 = csvRow(COLUMNS.map((c) => JSON.stringify({ ImportId: c.importId })));
    fs.writeFileSync(RESPONSES_FILE, header1 + header2 + header3);
  }
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/epas', (req, res) => {
  fs.readFile(EPA_FILE, 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: 'Could not load EPA definitions.' });
    res.type('application/json').send(data);
  });
});

app.post('/api/feedback', (req, res) => {
  const { epaTitle, level, learnerName, evaluatorName, feedbackText } = req.body || {};

  if (!epaTitle || !level || !feedbackText || !feedbackText.trim()) {
    return res.status(400).json({ error: 'epaTitle, level, and feedbackText are required.' });
  }

  const validLevels = ['1', '2', '3a', '3b', '4', '5'];
  if (!validLevels.includes(String(level))) {
    return res.status(400).json({ error: 'level must be one of 1, 2, 3a, 3b, 4, 5.' });
  }

  ensureResponsesFile();

  const now = new Date().toISOString();
  const row = {
    'StartDate': now,
    'EndDate': now,
    'Status': 'IP Address',
    'Progress': '100',
    'Duration (in seconds)': '0',
    'Finished': 'True',
    'RecordedDate': now,
    'ResponseId': 'R_' + crypto.randomBytes(8).toString('hex'),
    'EPA_Title': epaTitle,
    'Entrustment_Level': String(level),
    'Learner_Name': learnerName || '',
    'Evaluator_Name': evaluatorName || '',
    'Feedback_Text': feedbackText,
  };

  const line = csvRow(COLUMNS.map((c) => row[c.field]));
  fs.appendFileSync(RESPONSES_FILE, line);

  res.status(201).json({ ok: true, responseId: row.ResponseId });
});

app.get('/api/export', (req, res) => {
  ensureResponsesFile();
  const date = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Disposition', `attachment; filename="epa_feedback_export_${date}.csv"`);
  res.type('text/csv');
  fs.createReadStream(RESPONSES_FILE).pipe(res);
});

app.listen(PORT, () => {
  console.log(`EPA feedback app running at http://localhost:${PORT}`);
});
