
// Duplex voice chat client for Cloudflare Worker proxying OpenAI Realtime
// - Auto-connects to Worker WebSocket
// - Streams mic audio (webm/opus) as input_audio_buffer.append
// - Plays AI audio from response.audio.delta / response.output_audio.delta (base64 PCM16)

(() => {
  const qs = new URLSearchParams(location.search);
  const workerWs = qs.get("worker") ? `wss://${qs.get("worker")}` : (window.APP_CONFIG?.workerWs || "");

  const statusEl = document.getElementById("status");
  const talkBtn = document.getElementById("talkBtn");
  const logBox  = document.getElementById("logBox");

  let ws;
  let mediaRecorder;
  let audioCtx;
  let sourceNode;
  let playing = false;
  let pcmQueue = []; // Float32Array chunks queued for playback
  let scriptNode;

  function log(msg, cls="log") {
    const line = document.createElement("div");
    line.className = cls;
    const ts = new Date().toLocaleTimeString();
    line.textContent = `[${ts}] ${msg}`;
    logBox.appendChild(line);
    logBox.scrollTop = logBox.scrollHeight;
    console.log(msg);
  }

  // Simple PCM16 (LE) base64 -> Float32 conversion
  function b64ToFloat32(b64) {
    const raw = atob(b64);
    const buf = new ArrayBuffer(raw.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
    const int16 = new Int16Array(buf);
    const out = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) out[i] = Math.max(-1, Math.min(1, int16[i] / 32768));
    return out;
  }

  function ensureAudioContext() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
      scriptNode = audioCtx.createScriptProcessor(2048, 1, 1);
      scriptNode.onaudioprocess = (e) => {
        const out = e.outputBuffer.getChannelData(0);
        out.fill(0);
        if (!pcmQueue.length) return;
        const chunk = pcmQueue.shift();
        out.set(chunk.subarray(0, out.length));
        // If chunk longer than buffer, push remainder back
        if (chunk.length > out.length) {
          pcmQueue.unshift(chunk.subarray(out.length));
        }
      };
      scriptNode.connect(audioCtx.destination);
    }
  }

  async function connect() {
    if (!workerWs) {
      statusEl.textContent = "Missing worker URL";
      log("Missing worker URL", "err");
      return;
    }
    statusEl.textContent = "Connecting…";
    ws = new WebSocket(workerWs);
    ws.binaryType = "arraybuffer";

    ws.addEventListener("open", () => {
      statusEl.textContent = "Connected";
      log("WS connected", "ok");
      talkBtn.disabled = false;
    });

    ws.addEventListener("error", (e) => {
      statusEl.textContent = "Error";
      log(`WS error: ${e.message || "unknown"}`, "err");
    });

    ws.addEventListener("close", (e) => {
      statusEl.textContent = `Disconnected`;
      log(`WS closed (${e.code})`, e.code === 1000 ? "log" : "err");
      talkBtn.disabled = false;
      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
      }
    });

    ws.addEventListener("message", (evt) => {
      if (typeof evt.data === "string") {
        // JSON event
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === "info") {
            log("Worker connected to OpenAI", "log");
          } else if (msg.type === "response.audio.delta" || msg.type === "response.output_audio.delta") {
            ensureAudioContext();
            const f32 = b64ToFloat32(msg.audio || msg.delta || msg.data || "");
            pcmQueue.push(f32);
            if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
            log("AI audio chunk", "ai");
          } else if (msg.type === "response.completed") {
            log("AI finished speaking", "ai");
          } else if (msg.type === "error") {
            log(`Upstream error: ${msg.message || JSON.stringify(msg)}`, "err");
          } else {
            // other events
            // log(JSON.stringify(msg), "log");
          }
        } catch (err) {
          // Not JSON
          // log(`Text: ${evt.data}`, "log");
        }
      } else {
        // Binary not expected in this path; drop
      }
    });
  }

  async function startRecording() {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      log("WS not open", "warn");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });

      mediaRecorder.onstart = () => {
        talkBtn.classList.add("recording");
        talkBtn.textContent = "Listening…";
        log("Recording started", "log");
      };
      mediaRecorder.onstop = () => {
        talkBtn.classList.remove("recording");
        talkBtn.textContent = "Tap to talk";
        stream.getTracks().forEach(t => t.stop());
        log("Recording stopped", "log");
        // End of input; commit and ask for response
        ws.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
        ws.send(JSON.stringify({ type: "response.create", response: { modalities: ["audio"], instructions: "Reply concisely." }}));
      };
      mediaRecorder.ondataavailable = async (e) => {
        if (e.data && e.data.size > 0) {
          const buf = await e.data.arrayBuffer();
          const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
          ws.send(JSON.stringify({ type: "input_audio_buffer.append", audio: b64 }));
        }
      };

      mediaRecorder.start(250); // 250ms chunks
    } catch (err) {
      log(`Mic error: ${err.message || err}`, "err");
    }
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
  }

  // UI
  talkBtn.addEventListener("click", () => {
    if (!mediaRecorder || mediaRecorder.state === "inactive") {
      startRecording();
    } else {
      stopRecording();
    }
  });

  // Auto connect
  if (!("mediaDevices" in navigator)) {
    statusEl.textContent = "No mediaDevices in this browser";
    log("Browser missing mediaDevices", "err");
  } else {
    connect();
  }
})();
