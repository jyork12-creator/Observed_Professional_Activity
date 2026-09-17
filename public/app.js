const LEVEL_ORDER = ['1', '2', '3a', '3b', '4', '5'];

let epas = [];

const epaSelect = document.getElementById('epa-select');
const epaDescription = document.getElementById('epa-description');
const levelsTable = document.getElementById('levels-table');
const feedbackText = document.getElementById('feedback-text');
const voiceBtn = document.getElementById('voice-btn');
const voiceStatus = document.getElementById('voice-status');
const submitBtn = document.getElementById('submit-btn');
const submitStatus = document.getElementById('submit-status');

function renderEpa(epa) {
  epaDescription.textContent = epa.description;
  levelsTable.innerHTML = '';
  LEVEL_ORDER.forEach((lvl) => {
    const row = document.createElement('div');
    row.className = 'level-row';
    const badge = document.createElement('div');
    badge.className = 'level-badge';
    badge.textContent = lvl;
    const text = document.createElement('div');
    text.className = 'level-text';
    text.textContent = (epa.levels && epa.levels[lvl]) || '(no description provided)';
    row.appendChild(badge);
    row.appendChild(text);
    levelsTable.appendChild(row);
  });
}

async function loadEpas() {
  const res = await fetch('/api/epas');
  epas = await res.json();
  epaSelect.innerHTML = '';
  epas.forEach((epa, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = epa.title;
    epaSelect.appendChild(opt);
  });
  if (epas.length) renderEpa(epas[0]);
}

epaSelect.addEventListener('change', () => {
  const epa = epas[Number(epaSelect.value)];
  if (epa) renderEpa(epa);
});

// --- Voice to text (Web Speech API) ---
let recognition = null;
let recognizing = false;

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  let finalTranscript = '';

  recognition.addEventListener('start', () => {
    finalTranscript = feedbackText.value;
    voiceStatus.textContent = 'Listening...';
  });

  recognition.addEventListener('result', (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += (finalTranscript && !finalTranscript.endsWith(' ') ? ' ' : '') + transcript.trim();
      } else {
        interim += transcript;
      }
    }
    feedbackText.value = (finalTranscript + ' ' + interim).trim();
  });

  recognition.addEventListener('error', (event) => {
    voiceStatus.textContent = 'Voice recognition error: ' + event.error;
  });

  recognition.addEventListener('end', () => {
    recognizing = false;
    voiceBtn.textContent = '🎤 Start voice-to-text';
    voiceBtn.classList.remove('recording');
    voiceStatus.textContent = '';
  });

  voiceBtn.addEventListener('click', () => {
    if (recognizing) {
      recognition.stop();
      return;
    }
    recognizing = true;
    voiceBtn.textContent = '⏹ Stop recording';
    voiceBtn.classList.add('recording');
    recognition.start();
  });
} else {
  voiceBtn.disabled = true;
  voiceStatus.textContent = 'Voice-to-text is not supported in this browser (try Chrome).';
}

// --- Submit feedback ---
submitBtn.addEventListener('click', async () => {
  const epa = epas[Number(epaSelect.value)];
  const levelInput = document.querySelector('input[name="level"]:checked');
  const learnerName = document.getElementById('learner-name').value.trim();
  const evaluatorName = document.getElementById('evaluator-name').value.trim();
  const text = feedbackText.value.trim();

  if (!epa) {
    submitStatus.textContent = 'Please select an EPA.';
    return;
  }
  if (!levelInput) {
    submitStatus.textContent = 'Please select an entrustment level.';
    return;
  }
  if (!text) {
    submitStatus.textContent = 'Please enter or dictate feedback text.';
    return;
  }

  submitBtn.disabled = true;
  submitStatus.textContent = 'Saving...';

  try {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        epaTitle: epa.title,
        level: levelInput.value,
        learnerName,
        evaluatorName,
        feedbackText: text,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to save feedback.');
    }

    submitStatus.textContent = 'Saved. You can download the CSV export below.';
    feedbackText.value = '';
    document.getElementById('learner-name').value = '';
    if (levelInput) levelInput.checked = false;
  } catch (e) {
    submitStatus.textContent = e.message;
  } finally {
    submitBtn.disabled = false;
  }
});

loadEpas();
