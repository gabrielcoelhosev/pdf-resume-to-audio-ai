const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileName = document.getElementById('file-name');
const btnRun = document.getElementById('btn-run');
const languageSelect = document.getElementById('language');
const audioSelect = document.getElementById('audio');
const loader = document.getElementById('loader');
const results = document.getElementById('results');
const summaryContent = document.getElementById('summary-content');
const audioContainer = document.getElementById('audio-container');
const audioPlayer = document.getElementById('audio-player');
const latencyWarning = document.getElementById('latency-warning');

let currentFileBase64 = null;

// Drag & Drop
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  dropZone.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

['dragenter', 'dragover'].forEach(eventName => {
  dropZone.addEventListener(eventName, () => dropZone.classList.add('drag-over'), false);
});

['dragleave', 'drop'].forEach(eventName => {
  dropZone.addEventListener(eventName, () => dropZone.classList.remove('drag-over'), false);
});

dropZone.addEventListener('drop', handleDrop, false);
dropZone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
  handleFiles(e.target.files);
});

function handleDrop(e) {
  const dt = e.dataTransfer;
  const files = dt.files;
  handleFiles(files);
}

function handleFiles(files) {
  if (files.length === 0) return;
  const file = files[0];

  if (file.type !== 'application/pdf') {
    alert('Por favor, envie apenas arquivos PDF.');
    return;
  }

  fileName.textContent = file.name;
  
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onloadend = () => {
    // Pegamos apenas a parte base64 (removendo prefixo data:...)
    currentFileBase64 = reader.result.split(',')[1];
    btnRun.disabled = false;
  };
}

// Click para resumir
btnRun.addEventListener('click', async () => {
  if (!currentFileBase64) return;

  // UI States
  results.style.display = 'none';
  audioContainer.style.display = 'none';
  loader.style.display = 'block';
  btnRun.disabled = true;
  
  // Aviso de latência se tiver áudio
  latencyWarning.style.display = audioSelect.value === 'true' ? 'block' : 'none';

  try {
    const response = await fetch('/pdf/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pdf: currentFileBase64,
        language: languageSelect.value,
        audio: audioSelect.value === 'true'
      })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.details || data.error || 'Erro desconhecido no servidor.');
    }

    // Renderizar Markdown
    summaryContent.innerHTML = marked.parse(data.summary);
    results.style.display = 'block';

    // Tratar Áudio
    if (data.audio) {
      const audioBlob = base64ToBlob(data.audio, data.audioMimeType || 'audio/wav');
      const audioUrl = URL.createObjectURL(audioBlob);
      
      audioPlayer.src = audioUrl;
      audioContainer.style.display = 'block';
      
      // Força o carregamento e tenta tocar
      audioPlayer.load();
      audioPlayer.play().catch(e => {
        console.warn("Auto-play bloqueado pelo navegador. Clique no play para ouvir.");
      });
    }

    // Scroll suave para o resultado
    results.scrollIntoView({ behavior: 'smooth' });

  } catch (err) {
    console.error(err);
    alert(`Erro ao processar: ${err.message}`);
  } finally {
    loader.style.display = 'none';
    btnRun.disabled = false;
  }
});

function base64ToBlob(base64, mimeType) {
  const byteCharacters = atob(base64);
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  return new Blob(byteArrays, { type: mimeType });
}
