/* Frontend for full-duplex Realtime via Cloudflare Worker */
const WORKER_WSS = "wss://broad-hat-1325.nickydoyl.workers.dev"; // your existing worker

const logEl = document.getElementById("log");
const chatEl = document.getElementById("chat");
const statusEl = document.getElementById("status");
const micBtn = document.getElementById("micBtn");

let ws = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let audioCtx;
let pcmQueue = [];

function log(msg) {
  const t = new Date().toLocaleTimeString();
  logEl.innerHTML += `[${t}] ${msg}<br/>`;
  logEl.scrollTop = logEl.scrollHeight;
}
function chat(role, text) {
  const div = document.createElement("div");
  div.className = role === "user" ? "u" : "ai";
  div.textContent = (role === "user" ? "You: " : "AI: ") + text;
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
}
function setStatus(s) { statusEl.textContent = s; }

function connect() {
  return new Promise((resolve, reject) => {
    ws = new WebSocket(WORKER_WSS);
    ws.binaryType = "arraybuffer";

    ws.onopen = () => { log("✅ WS connected"); setStatus("Connected"); resolve(); };
    ws.onmessage = evt => handleServerMessage(evt.data);
    ws.onerror = evt => { log("❌ WS error"); };
    ws.onclose = evt => { log(`🔒 WS closed (${evt.code})`); setStatus("Disconnected"); };
  });
}

function handleServerMessage(data) {
  if (typeof data === "string") {
    // JSON event
    try {
      const ev = JSON.parse(data);
      if (ev.type === "info") log(`ℹ️ ${ev.message}`);
      if (ev.type === "response.text.delta" && ev.delta) {
        // Text streaming (if provided by model)
        chat("ai", ev.delta);
      }
      if (ev.type === "transcript" && ev.text) {
        chat("ai", ev.text);
      }
      // Some models deliver audio frames inside JSON as base64
      if (ev.type === "response.audio.delta" && ev.audio) {
        playPCM16(base64ToBytes(ev.audio));
      }
    } catch (e) {
      log("📩 " + data.substring(0,180));
    }
  } else if (data instanceof ArrayBuffer) {
    // Treat as PCM16 frame from upstream
    playPCM16(new Uint8Array(data));
  }
}

async function startRecording() {
  if (!ws || ws.readyState !== 1) await connect();

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  audioChunks = [];
  mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm; codecs=opus" });

  mediaRecorder.ondataavailable = e => {
    if (e.data && e.data.size > 0) {
      e.data.arrayBuffer().then(buf => ws.send(buf));
    }
  };
  mediaRecorder.onstart = () => { isRecording = true; micBtn.classList.add("active"); log("🎙️ Recording started"); };
  mediaRecorder.onstop = () => {
    isRecording = false; micBtn.classList.remove("active");
    log("🛑 Recording stopped");
    // Let the assistant speak/respond now (no special message needed; audio already streamed)
  };

  mediaRecorder.start(250); // chunk every 250ms
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(t => t.stop());
  }
}

async function toggleMic() {
  try {
    if (!isRecording) {
      await startRecording();
    } else {
      stopRecording();
    }
  } catch (e) {
    log("⚠️ Mic error: " + (e.message || e));
  }
}

micBtn.addEventListener("click", toggleMic);

// ===== Playback (PCM16 mono 24kHz expected) =====
function ensureCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
  }
}
function playPCM16(bytes) {
  ensureCtx();
  const samples = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength/2));
  const float32 = new Float32Array(samples.length);
  for (let i=0;i<samples.length;i++) float32[i] = samples[i] / 32768.0;
  const buf = audioCtx.createBuffer(1, float32.length, 24000);
  buf.copyToChannel(float32, 0);
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  src.connect(audioCtx.destination);
  src.start();
}
function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Auto-connect once to be ready
connect().catch(()=>{});
