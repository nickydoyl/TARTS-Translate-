const WORKER_URL = "wss://tarts-translate-2vxuakkft-nickydoyls-projects.vercel.app";

const micButton = document.getElementById('micButton');
const statusEl = document.getElementById('status');
const logEl = document.getElementById('log');

let ws = null;
let mediaRecorder = null;
let isRecording = false;

function log(msg, type = 'info') {
  const time = new Date().toLocaleTimeString();
  const el = document.createElement('div');
  el.textContent = `[${time}] ${msg}`;
  el.style.color = type === 'error' ? '#ff6b6b' : '#66fcf1';
  logEl.appendChild(el);
  logEl.scrollTop = logEl.scrollHeight;
}

async function toggleMic() {
  if (isRecording) {
    stopRecording();
    return;
  }

  try {
    log('Requesting microphone...');
    statusEl.textContent = 'Requesting mic...';
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    log('Microphone access granted ✅');

    ws = new WebSocket(WORKER_URL);
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      log(`Connected to ${WORKER_URL}`);
      statusEl.textContent = 'Connected';
      startRecording(stream);
    };

    ws.onerror = (err) => log('WebSocket error: ' + err.message, 'error');

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'response' && msg.text) {
          log('🤖 AI: ' + msg.text);
        } else if (msg.type === 'error') {
          log('Server error: ' + msg.message, 'error');
        } else {
          log('Message: ' + event.data);
        }
      } catch (e) {
        log('Raw message: ' + event.data);
      }
    };

    ws.onclose = () => {
      log('Connection closed ❌');
      statusEl.textContent = 'Closed';
      stopRecording();
    };
  } catch (err) {
    log('Mic error: ' + err.message, 'error');
  }
}

function startRecording(stream) {
  mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0 && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(e.data);
      log('🎙️ Sent audio chunk');
    }
  };
  mediaRecorder.start(300);
  isRecording = true;
  micButton.classList.add('active');
  statusEl.textContent = 'Recording...';
  log('🎤 Recording started');
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.close();
  }
  isRecording = false;
  micButton.classList.remove('active');
  statusEl.textContent = 'Stopped';
  log('🛑 Recording stopped');
}

micButton.addEventListener('click', toggleMic);
