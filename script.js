document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("toggleBtn");
  const logBox = document.getElementById("logBox");
  const status = document.getElementById("status");
  const canvas = document.getElementById("waveform");
  const ctx = canvas.getContext("2d");

  const ding = new Audio("data:audio/mp3;base64,//uQxAAAAAAAAAAAA...");
  const buzz = new Audio("data:audio/mp3;base64,//uQxAAAAAAAAAAAA...");

  let wavePhase = 0, active = false;

  log("✅ Page loaded — ready.", "info");

  function drawWave() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    for (let x = 0; x < canvas.width; x++) {
      const y = canvas.height/2 + Math.sin((x+wavePhase)/15) * 20 * (active ? 1 : 0.2);
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = active ? "#00ff99" : "#333";
    ctx.lineWidth = 2;
    ctx.stroke();
    wavePhase += 5;
    requestAnimationFrame(drawWave);
  }
  drawWave();

  function log(msg, type = "info") {
    const time = new Date().toLocaleTimeString();
    const color = type === "error" ? "#ff7777" : "#7fff7f";
    const line = document.createElement("div");
    line.style.color = color;
    line.textContent = `[${time}] ${msg}`;
    logBox.appendChild(line);
    logBox.scrollTop = logBox.scrollHeight;
  }

  btn.addEventListener("click", () => {
    log("🎤 Button pressed");
    ding.play();
    status.textContent = "Connecting...";
    active = true;
    try {
      const ws = new WebSocket("wss://tarts-translate-2vxuakkft-nickydoyls-projects.vercel.app");
      ws.onopen = () => {
        log("✅ Connected to Vercel WebSocket endpoint");
        status.textContent = "Connected";
      };
      ws.onmessage = (e) => log(`📩 ${e.data}`);
      ws.onerror = (err) => {
        buzz.play();
        log(`❌ WebSocket error: ${err.message}`, "error");
        status.textContent = "Error";
        active = false;
      };
      ws.onclose = (e) => {
        buzz.play();
        log(`🔒 Connection closed (${e.code})`);
        status.textContent = "Closed";
        active = false;
      };
    } catch (err) {
      buzz.play();
      log(`💥 Fatal error: ${err.message}`, "error");
      status.textContent = "Failed";
      active = false;
    }
  });
});
