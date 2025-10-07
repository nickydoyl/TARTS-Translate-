const btn = document.getElementById('toggleBtn');
const logDiv = document.getElementById('log');
let mediaRecorder, ws, audioChunks = [], isRecording = false, stream;

function log(message, type='info') {
  const line = document.createElement('div');
  line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  if (type === 'user') line.className = 'user';
  if (type === 'ai') line.className = 'ai';
  logDiv.appendChild(line);
  logDiv.scrollTop = logDiv.scrollHeight;
  console.log(message);
}

function connectWebSocket() {
  log('🌐 Connecting to worker...');
  ws = new WebSocket('wss://broad-hat-1325.nickydoyl.workers.dev');
  ws.onopen = () => log('✅ Connected to Worker');
  ws.onmessage = (msg) => log('🧠 AI: ' + msg.data, 'ai');
  ws.onclose = (e) => {
    log(`🔒 Disconnected (code=${e.code})`);
    ws = null;
  };
  ws.onerror = (e) => log('❌ WebSocket error: ' + e.message);
}

async function startRecording() {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    log('🔄 Reconnecting...');
    connectWebSocket();
    setTimeout(startRecording, 1500);
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
    mediaRecorder.onstop = () => {
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      blob.arrayBuffer().then(buffer => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(buffer);
          log('📤 Sent audio to worker');
        } else {
          log('⚠️ WebSocket not open');
        }
      });
      stopMic();
    };
    mediaRecorder.start();
    isRecording = true;
    btn.classList.add('active');
    log('🎙️ Recording started');
  } catch (err) {
    log('❌ Microphone error: ' + err.message);
  }
}

function stopMic() {
  if (stream) {
    const tracks = stream.getTracks();
    tracks.forEach(track => track.stop());
    log('🎧 Mic stopped');
  }
}

function stopRecording() {
  if (mediaRecorder && isRecording) {
    mediaRecorder.stop();
    isRecording = false;
    btn.classList.remove('active');
    log('🛑 Recording stopped');
  }
}

btn.addEventListener('click', () => {
  if (!isRecording) startRecording();
  else stopRecording();
});

window.onload = connectWebSocket;
