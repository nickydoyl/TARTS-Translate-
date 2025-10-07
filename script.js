const WORKER_URL = "wss://broad-hat-1325.nickydoyl.workers.dev";
const micButton = document.getElementById("micButton");
const statusText = document.getElementById("status");
const log = document.getElementById("log");

let ws = null;
let audioContext = null;

function addLog(msg) {
  const t = new Date().toLocaleTimeString();
  log.textContent += `[${t}] ${msg}\n`;
  log.scrollTop = log.scrollHeight;
  console.log(msg);
}

async function startChat() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    stopChat();
    return;
  }

  addLog("🎤 Requesting microphone access...");
  statusText.textContent = "Requesting mic...";

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    addLog("✅ Microphone access granted.");

    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);

    addLog("🔌 Connecting to Worker: " + WORKER_URL);
    statusText.textContent = "Connecting to Worker...";

    ws = new WebSocket(WORKER_URL);
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      addLog("✅ WebSocket connection established.");
      statusText.textContent = "Listening";
      micButton.classList.add("listening");

      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) pcm16[i] = input[i] * 0x7fff;
        if (ws.readyState === WebSocket.OPEN) ws.send(pcm16.buffer);
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
    };

    ws.onmessage = (e) => {
      addLog("📨 Message from Worker: " + e.data);
      try {
        const data = JSON.parse(e.data);
        if (data.type === "status") {
          statusText.textContent = data.status;
        } else if (data.type === "audio") {
          playAudio(data.chunk);
        }
      } catch (err) {
        addLog("⚠️ Non-JSON message: " + e.data);
      }
    };

    ws.onerror = (e) => {
      addLog("❌ WebSocket error: " + e.message);
      statusText.textContent = "Error";
    };

    ws.onclose = (e) => {
      addLog(`🔒 Connection closed (code=${e.code}, reason=${e.reason})`);
      micButton.classList.remove("listening", "speaking", "processing");
      statusText.textContent = "Disconnected";
    };
  } catch (err) {
    addLog("🚫 Mic error: " + err.message);
    statusText.textContent = "Mic error";
  }
}

function stopChat() {
  if (ws) {
    ws.close();
    addLog("🛑 Stopped connection.");
    micButton.classList.remove("listening");
    statusText.textContent = "Ready";
  }
}

function playAudio(chunk) {
  micButton.classList.remove("listening");
  micButton.classList.add("speaking");
  statusText.textContent = "Speaking...";

  const audioData = new Uint8Array(chunk);
  const blob = new Blob([audioData], { type: "audio/wav" });
  const audioURL = URL.createObjectURL(blob);
  const audio = new Audio(audioURL);
  audio.play();
  audio.onended = () => {
    micButton.classList.remove("speaking");
    micButton.classList.add("listening");
    statusText.textContent = "Listening";
  };
}

micButton.addEventListener("click", startChat);
