const btn = document.getElementById('toggleBtn');
const logDiv = document.getElementById('log');
const canvas = document.getElementById('waveform');
const ding = document.getElementById('ding');
const buzz = document.getElementById('buzz');
let ws, ctx, analyser, micStream, dataArray, audioCtx, source;
let running = false;

function log(msg, type='info') {
  const el = document.createElement('div');
  el.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  el.style.color = type === 'error' ? '#ff5555' : '#00e676';
  logDiv.appendChild(el);
  logDiv.scrollTop = logDiv.scrollHeight;
}

btn.onclick = async () => {
  if (running) {
    stopAll();
    return;
  }
  try {
    ding.play();
    btn.classList.add('active');
    log('Requesting microphone...');
    audioCtx = new AudioContext();
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    source = audioCtx.createMediaStreamSource(micStream);
    analyser = audioCtx.createAnalyser();
    source.connect(analyser);
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    drawWave();

    log('Connecting to worker...');
    ws = new WebSocket('wss://tarts-translate-2vxuakkft-nickydoyls-projects.vercel.app');
    ws.onopen = () => log('✅ Connected to worker.');
    ws.onerror = (e) => { log('❌ WebSocket error', 'error'); buzz.play(); stopAll(); };
    ws.onclose = () => { log('🔒 Disconnected.'); buzz.play(); stopAll(); };

    running = true;
  } catch (err) {
    log('❌ Mic access error: ' + err.message, 'error');
    buzz.play();
  }
};

function stopAll() {
  if (micStream) micStream.getTracks().forEach(t => t.stop());
  if (audioCtx) audioCtx.close();
  if (ws && ws.readyState === WebSocket.OPEN) ws.close();
  btn.classList.remove('active');
  running = false;
  log('🛑 Stopped.');
}

function drawWave() {
  if (!analyser) return;
  if (!ctx) ctx = canvas.getContext('2d');
  const WIDTH = canvas.width = canvas.offsetWidth;
  const HEIGHT = canvas.height = canvas.offsetHeight;

  function draw() {
    if (!running) return;
    requestAnimationFrame(draw);
    analyser.getByteTimeDomainData(dataArray);
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#00e676';
    ctx.beginPath();
    const sliceWidth = WIDTH * 1.0 / dataArray.length;
    let x = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const v = dataArray[i] / 128.0;
      const y = v * HEIGHT / 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.lineTo(WIDTH, HEIGHT/2);
    ctx.stroke();
  }
  draw();
}
