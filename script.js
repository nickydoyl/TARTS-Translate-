window.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('toggleBtn');
  const logBox = document.getElementById('logBox');
  const status = document.getElementById('status');
  const canvas = document.getElementById('waveform');
  const ctx = canvas.getContext('2d');

  let wavePhase = 0;
  let active = false;
  let ws = null;
  let micStream = null;
  let audioCtx = null;

  log('✅ Page loaded — ready.');
  drawWave();

  function drawWave() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    for (let x = 0; x < canvas.width; x++) {
      const y = canvas.height / 2 + Math.sin((x + wavePhase) / 15) * 20 * (active ? 1 : 0.2);
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = active ? '#00ff99' : '#333';
    ctx.lineWidth = 2;
    ctx.stroke();
    wavePhase += 5;
    requestAnimationFrame(drawWave);
  }

  function log(msg) {
    const time = new Date().toLocaleTimeString();
    const line = document.createElement('div');
    line.textContent = `[${time}] ${msg}`;
    logBox.appendChild(line);
    logBox.scrollTop = logBox.scrollHeight;
    console.log(msg);
  }

  async function startConnection() {
    try {
      status.textContent = 'Requesting microphone...';
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      log('🎤 Microphone active');

      status.textContent = 'Connecting...';
      ws = new WebSocket('wss://tarts-translate-81ika3pu0-nickydoyls-projects.vercel.app');

      ws.onopen = () => {
        log('✅ Connected to Vercel WebSocket');
        status.textContent = 'Connected';
        active = true;
      };

      ws.onmessage = (e) => log(`📩 ${e.data}`);

      ws.onerror = (err) => {
        log(`❌ WebSocket error: ${err.message}`);
        status.textContent = 'Error';
        stopConnection();
      };

      ws.onclose = (e) => {
        log(`🔒 Connection closed (${e.code})`);
        status.textContent = 'Closed';
        stopConnection();
      };
    } catch (err) {
      log(`💥 Mic/WebSocket error: ${err.message}`);
      stopConnection();
    }
  }

  function stopConnection() {
    if (micStream) micStream.getTracks().forEach(track => track.stop());
    if (audioCtx) audioCtx.close();
    if (ws && ws.readyState === WebSocket.OPEN) ws.close();
    active = false;
    status.textContent = 'Idle';
  }

  btn.addEventListener('click', () => {
    log(active ? '🛑 Stopping connection...' : '🎤 Starting connection...');
    active ? stopConnection() : startConnection();
  });
});