// Frontend for full-duplex voice via Cloudflare Worker -> OpenAI Realtime
const WORKER_WS = "wss://square-waterfall-2c5d.nickydoyl.workers.dev"; // your Worker URL (root)

const micBtn = document.getElementById("mic");
const statusEl = document.getElementById("status");
const logEl = document.getElementById("log");

let ws = null;
let mediaRecorder = null;
let micStream = null;

// audio element for playback
const speaker = new Audio();
speaker.autoplay = true;

function log(...args) {
  const line = args.map(a => (typeof a === "string" ? a : JSON.stringify(a))).join(" ");
  logEl.textContent += line + "\n";
  logEl.scrollTop = logEl.scrollHeight;
}

function setStatus(t) { statusEl.textContent = t; }

async function startConversation() {
  try {
    setStatus("Connecting…");
    ws = new WebSocket(WORKER_WS);
    ws.binaryType = "arraybuffer";

    ws.onopen = async () => {
      micBtn.classList.add("listening");
      setStatus("🎙️ Connected. Grant mic permission…");
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        setStatus("❌ Microphone permission denied");
        log("mic error:", err);
        stopConversation();
        return;
      }

      setStatus("Listening…");
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : undefined;

      mediaRecorder = new MediaRecorder(micStream, mime ? { mimeType: mime } : undefined);
      mediaRecorder.ondataavailable = (evt) => {
        if (evt.data && evt.data.size > 0 && ws && ws.readyState === WebSocket.OPEN) {
          evt.data.arrayBuffer().then(buf => ws.send(buf)).catch(err => log("send err:", err));
        }
      };
      mediaRecorder.start(200); // send chunks every 200ms
    };

    ws.onmessage = (evt) => {
      if (evt.data instanceof ArrayBuffer) {
        // Treat as audio (mp3/opus) and play
        const blob = new Blob([evt.data], { type: "audio/mpeg" });
        const url = URL.createObjectURL(blob);
        speaker.src = url;
      } else {
        try {
          const msg = JSON.parse(evt.data);
          log("[json]", msg);
        } catch {
          log("[text]", evt.data);
        }
      }
    };

    ws.onerror = (err) => {
      log("ws error:", err);
      setStatus("⚠️ WebSocket error");
    };

    ws.onclose = () => {
      setStatus("🔌 Disconnected");
      micBtn.classList.remove("listening");
      cleanupMedia();
    };
  } catch (e) {
    log("start err:", e);
    setStatus("❌ Failed to start");
    stopConversation();
  }
}

function cleanupMedia() {
  try { if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop(); } catch {}
  mediaRecorder = null;
  try { if (micStream) micStream.getTracks().forEach(t => t.stop()); } catch {}
  micStream = null;
}

function stopConversation() {
  cleanupMedia();
  try { if (ws && ws.readyState === WebSocket.OPEN) ws.close(); } catch {}
  ws = null;
  micBtn.classList.remove("listening");
  setStatus("🛑 Stopped");
}

micBtn.addEventListener("click", () => {
  if (micBtn.classList.contains("listening")) stopConversation();
  else startConversation();
});
