// CONFIGURATION - Replace with your OpenAI API Key
const OPENAI_API_KEY = "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";

// ELEMENTS
const toggleButton = document.getElementById("toggleButton");
const buttonIcon = document.getElementById("buttonIcon");
const statusDiv = document.getElementById("status");
const outputDiv = document.getElementById("output");
const visualizerContainer = document.getElementById("visualizerContainer");
const inputLevelBar = document.getElementById("inputLevel");
const outputLevelBar = document.getElementById("outputLevel");

// STATE
let ws = null;
let audioContext = null;
let mediaStream = null;
let processor = null;
let isConnected = false;
let audioQueue = [];
let isPlayingAudio = false;

// Icons
const MIC_ICON = `<path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>`;
const STOP_ICON = `<rect x="6" y="6" width="12" height="12" rx="2"/>`;
const WAVE_ICON = `<g class="wave-bars">
  <rect x="2" y="8" width="3" height="8" rx="1.5" class="wave-bar"/>
  <rect x="7" y="5" width="3" height="14" rx="1.5" class="wave-bar"/>
  <rect x="12" y="2" width="3" height="20" rx="1.5" class="wave-bar"/>
  <rect x="17" y="5" width="3" height="14" rx="1.5" class="wave-bar"/>
</g>`;

// Toggle button handler
toggleButton.onclick = () => {
  if (isConnected) {
    disconnect();
  } else {
    connect();
  }
};

// Connect to OpenAI Realtime API
async function connect() {
  if (!OPENAI_API_KEY || OPENAI_API_KEY === "YOUR_API_KEY_HERE") {
    alert("Please add your OpenAI API key in script.js");
    return;
  }

  try {
    updateUI("connecting", "Connecting...");

    // Connect to WebSocket with proper headers
    const url = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-09-30";
    
    ws = new WebSocket(url, [
      "realtime",
      `openai-insecure-api-key.${OPENAI_API_KEY}`,
      "openai-beta.realtime-v1"
    ]);

    ws.onopen = async () => {
      console.log("✅ Connected to OpenAI Realtime API");
      ws.send(JSON.stringify({
        type: "session.update",
        session: {
          modalities: ["text", "audio"],
          instructions: "You are a helpful and friendly AI assistant.",
          voice: "alloy",
          input_audio_format: "pcm16",
          output_audio_format: "pcm16"
        }
      }));
      await startAudioCapture();
      isConnected = true;
      updateUI("connected", "Listening - Start talking!");
      visualizerContainer.classList.add("active");
    };

    ws.onmessage = (event) => handleRealtimeEvent(JSON.parse(event.data));
    ws.onerror = (error) => {
      console.error("❌ WebSocket error:", error);
      addMessage("ai", "⚠️ Connection error. Check your API key and network.");
      disconnect();
    };
    ws.onclose = () => {
      if (isConnected) addMessage("ai", "Connection closed");
      disconnect();
    };
  } catch (error) {
    console.error("Connection error:", error);
    updateUI("idle", "Connection failed");
    alert("Failed to connect. Check your internet and API key.");
  }
}

function disconnect() {
  isConnected = false;
  if (ws) ws.close();
  if (processor) processor.disconnect();
  if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
  if (audioContext) audioContext.close();
  updateUI("idle", "Tap to start conversation");
  visualizerContainer.classList.remove("active");
  inputLevelBar.style.width = "0%";
  outputLevelBar.style.width = "0%";
}

// Simplified audio capture
async function startAudioCapture() {
  mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  audioContext = new AudioContext({ sampleRate: 24000 });
  const source = audioContext.createMediaStreamSource(mediaStream);
  processor = audioContext.createScriptProcessor(4096, 1, 1);
  source.connect(processor);
  processor.connect(audioContext.destination);

  processor.onaudioprocess = (e) => {
    if (!isConnected || ws.readyState !== WebSocket.OPEN) return;
    const data = e.inputBuffer.getChannelData(0);
    const int16 = new Int16Array(data.length);
    for (let i = 0; i < data.length; i++) int16[i] = Math.max(-1, Math.min(1, data[i])) * 0x7fff;
    ws.send(JSON.stringify({ type: "input_audio_buffer.append", audio: btoa(String.fromCharCode(...new Uint8Array(int16.buffer))) }));
    updateInputLevel(data);
  };
}

function handleRealtimeEvent(event) {
  switch (event.type) {
    case "response.audio_transcript.delta":
      updateAITranscript(event.delta);
      break;
    case "response.audio_transcript.done":
      finalizeAITranscript(event.transcript);
      break;
    case "error":
      addMessage("ai", `⚠️ Error: ${event.error.message}`);
      break;
  }
}

let currentTranscript = null;
function updateAITranscript(delta) {
  if (!currentTranscript) {
    currentTranscript = document.createElement("div");
    currentTranscript.className = "message ai partial";
    outputDiv.appendChild(currentTranscript);
  }
  currentTranscript.textContent += delta;
  outputDiv.scrollTop = outputDiv.scrollHeight;
}
function finalizeAITranscript(fullText) {
  if (currentTranscript) {
    currentTranscript.className = "message ai";
    currentTranscript.textContent = fullText;
    currentTranscript = null;
  }
}

function updateInputLevel(data) {
  const rms = Math.sqrt(data.reduce((a, b) => a + b * b, 0) / data.length);
  inputLevelBar.style.width = `${Math.min(100, rms * 400)}%`;
}

function updateUI(state, message) {
  statusDiv.textContent = message;
  toggleButton.className = "";
  if (state === "idle") buttonIcon.innerHTML = MIC_ICON;
  if (state === "connecting") buttonIcon.innerHTML = MIC_ICON;
  if (state === "connected") buttonIcon.innerHTML = STOP_ICON;
}

function addMessage(type, text) {
  const msg = document.createElement("div");
  msg.className = `message ${type}`;
  msg.textContent = text;
  outputDiv.appendChild(msg);
  outputDiv.scrollTop = outputDiv.scrollHeight;
}
