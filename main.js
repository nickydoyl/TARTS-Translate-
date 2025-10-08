let ws;
let mediaRecorder;
let audioChunks = [];
let audioCtx;
let source;
let audioBuffer;
let playingAudio = false;

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const avatar = document.querySelector(".avatar");
const logBox = document.getElementById("log");

function log(msg) {
  const el = document.createElement("div");
  el.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logBox.appendChild(el);
  logBox.scrollTop = logBox.scrollHeight;
}

async function startConversation() {
  ws = new WebSocket("wss://broad-hat-1325.nickydoyl.workers.dev");
  ws.binaryType = "arraybuffer";

  ws.onopen = async () => {
    log("✅ Connected to worker");
    avatar.classList.add("active");
    startBtn.disabled = true;
    stopBtn.disabled = false;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });

    mediaRecorder.ondataavailable = e => {
      if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
        ws.send(e.data);
      }
    };
    mediaRecorder.start(250);
    log("🎤 Recording started");
  };

  ws.onmessage = async (event) => {
    const data = event.data;
    if (typeof data === "string") {
      log("📩 " + data);
      return;
    }
    if (data instanceof ArrayBuffer) {
      playPcm16(data);
    }
  };

  ws.onclose = () => {
    log("❌ Connection closed");
    avatar.classList.remove("active");
    startBtn.disabled = false;
    stopBtn.disabled = true;
  };
}

function stopConversation() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.close();
  }
  avatar.classList.remove("active");
  startBtn.disabled = false;
  stopBtn.disabled = true;
  log("🛑 Conversation ended");
}

async function playPcm16(arrayBuffer) {
  if (playingAudio) return;
  playingAudio = true;

  const buffer = new Int16Array(arrayBuffer);
  const float32 = new Float32Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    float32[i] = buffer[i] / 32768;
  }

  audioCtx = audioCtx || new AudioContext();
  const audioBuffer = audioCtx.createBuffer(1, float32.length, 16000);
  audioBuffer.copyToChannel(float32, 0);
  source = audioCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioCtx.destination);
  source.onended = () => (playingAudio = false);
  source.start();
}

startBtn.addEventListener("click", startConversation);
stopBtn.addEventListener("click", stopConversation);
