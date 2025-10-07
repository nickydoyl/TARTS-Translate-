const WORKER_URL = "wss://broad-hat-1325.nickydoyl.workers.dev";
const micButton = document.getElementById("micButton");
const statusText = document.getElementById("status");
const log = document.getElementById("log");

let ws = null;
let mediaRecorder = null;
let audioChunks = [];
let audioContext = null;

function addLog(msg) {
  const t = new Date().toLocaleTimeString();
  log.textContent += `[${t}] ${msg}\n`;
  log.scrollTop = log.scrollHeight;
}

async function startChat() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    stopChat();
    return;
  }

  addLog("Connecting to worker...");
  statusText.textContent = "Connecting...";
  ws = new WebSocket(WORKER_URL);
  
  ws.onopen = async () => {
    addLog("Connected to worker.");
    statusText.textContent = "Listening";
    micButton.classList.add("listening");

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);

    source.connect(processor);
    processor.connect(audioContext.destination);

    processor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);
      const pcm16 = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) {
        pcm16[i] = Math.min(1, input[i]) * 0x7fff;
      }
      ws.send(pcm16.buffer);
    };

    ws.onmessage = async (e) => {
      const data = JSON.parse(e.data || "{}");
      if (data.type === "info") {
        addLog(data.message);
      }
      if (data.type === "audio") {
        micButton.classList.remove("listening");
        micButton.classList.add("speaking");
        statusText.textContent = "Speaking...";
        const audioData = new Uint8Array(data.chunk);
        const blob = new Blob([audioData], { type: "audio/wav" });
        const audioURL = URL.createObjectURL(blob);
        const audio = new Audio(audioURL);
        audio.onended = () => {
          micButton.classList.remove("speaking");
          micButton.classList.add("listening");
          statusText.textContent = "Listening";
        };
        audio.play();
      }
    };

    ws.onclose = () => {
      addLog("Connection closed.");
      micButton.classList.remove("listening", "speaking", "processing");
      statusText.textContent = "Disconnected";
    };

    ws.onerror = (err) => {
      addLog("Error: " + err.message);
      statusText.textContent = "Error";
    };
  };
}

function stopChat() {
  if (ws) {
    ws.close();
    addLog("Stopped connection.");
    micButton.classList.remove("listening");
    statusText.textContent = "Ready";
  }
}

micButton.addEventListener("click", startChat);
