const WORKER_URL = "wss://broad-hat-1325.nickydoyl.workers.dev";
const btn = document.getElementById('startBtn');
const logEl = document.getElementById('log');
const statusEl = document.getElementById('status');
let ws, audioCtx, processor;

function log(msg){
  const t = new Date().toLocaleTimeString();
  logEl.textContent += `[${t}] ${msg}\n`;
  logEl.scrollTop = logEl.scrollHeight;
  console.log(msg);
}

btn.onclick = async () => {
  if (ws && ws.readyState === WebSocket.OPEN){
    ws.close();
    btn.classList.remove('active');
    statusEl.textContent = 'Stopped';
    return;
  }

  try {
    log('🎤 Requesting microphone...');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    log('✅ Microphone access granted');

    audioCtx = new AudioContext();
    const src = audioCtx.createMediaStreamSource(stream);
    processor = audioCtx.createScriptProcessor(4096, 1, 1);
    src.connect(processor);
    processor.connect(audioCtx.destination);

    log(`🌐 Connecting to ${WORKER_URL}`);
    statusEl.textContent = 'Connecting...';
    ws = new WebSocket(WORKER_URL);
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      log('✅ WebSocket connected');
      statusEl.textContent = 'Connected';
      btn.classList.add('active');
      log('🎧 Starting audio stream...');
      processor.onaudioprocess = e => {
        const input = e.inputBuffer.getChannelData(0);
        const buffer = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) buffer[i] = input[i] * 0x7fff;
        if (ws.readyState === WebSocket.OPEN) ws.send(buffer);
      };
    };

    ws.onmessage = (event) => {
      log('📩 Message: ' + event.data.slice(0,120));
    };

    ws.onerror = (err) => {
      log('❌ WebSocket Error: ' + (err.message || JSON.stringify(err)));
    };

    ws.onclose = (e) => {
      log(`🔒 Closed: code=${e.code}, reason=${e.reason || 'none'}`);
      btn.classList.remove('active');
      statusEl.textContent = 'Closed';
    };

  } catch (err) {
    log('🚫 Mic error: ' + err.message);
    statusEl.textContent = 'Error';
  }
};
