const WORKER_URL = "wss://broad-hat-1325.nickydoyl.workers.dev"; 
let ws, recorder, audioCtx, speaker;
const logBox = document.getElementById("log");
const statusEl = document.getElementById("status");
const btn = document.getElementById("talkBtn");

function log(msg) {
  const time = new Date().toLocaleTimeString();
  logBox.textContent += `[${time}] ${msg}\n`;
  logBox.scrollTop = logBox.scrollHeight;
  console.log(msg);
}

async function connect() {
  return new Promise((resolve, reject) => {
    ws = new WebSocket(WORKER_URL, "realtime");
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      log("✅ WS connected");
      statusEl.textContent = "Connected";
      resolve();
    };

    ws.onmessage = async (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === "info") log(`🧠 ${msg.message}`);
      } catch {
        if (!audioCtx) audioCtx = new AudioContext();
        const buf = await audioCtx.decodeAudioData(evt.data.slice(0));
        const src = audioCtx.createBufferSource();
        src.buffer = buf;
        src.connect(audioCtx.destination);
        src.start();
      }
    };

    ws.onclose = (e) => {
      log(`🔒 WS closed (${e.code})`);
      statusEl.textContent = "Disconnected";
    };
    ws.onerror = (err) => log(`⚠️ WS error: ${err.message || err}`);
  });
}

async function startTalking() {
  btn.classList.add("active");
  statusEl.textContent = "Talking...";
  log("🎙️ Recording started");

  await connect();

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  recorder = new MediaRecorder(stream, { mimeType: "audio/webm; codecs=opus" });

  recorder.ondataavailable = async (e) => {
    if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
      const buf = await e.data.arrayBuffer();
      ws.send(buf);
    }
  };

  recorder.start(250);
  btn.onclick = stopTalking;
}

function stopTalking() {
  btn.classList.remove("active");
  statusEl.textContent = "Stopped";
  log("🛑 Recording stopped");

  if (recorder && recorder.state !== "inactive") recorder.stop();
  if (ws && ws.readyState === WebSocket.OPEN) ws.close(1000, "done");

  btn.onclick = startTalking;
}

btn.onclick = startTalking;