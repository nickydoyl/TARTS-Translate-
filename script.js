// CONFIGURATION - Replace with your OpenAI API Key
const OPENAI_API_KEY = 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;

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
    const url = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17";
    
    ws = new WebSocket(url, [
      "realtime",
      `openai-insecure-api-key.${OPENAI_API_KEY}`,
      "openai-beta.realtime-v1"
    ]);

    ws.onopen = async () => {
      console.log("✅ Connected to OpenAI Realtime API");
      
      // Configure session with proper settings
      ws.send(JSON.stringify({
        type: "session.update",
        session: {
          modalities: ["text", "audio"],
          instructions: "You are a helpful and friendly AI assistant. Keep responses natural and conversational. Speak clearly and at a moderate pace.",
          voice: "alloy",
          input_audio_format: "pcm16",
          output_audio_format: "pcm16",
          input_audio_transcription: {
            model: "whisper-1"
          },
          turn_detection: {
            type: "server_vad",
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 700
          },
          temperature: 0.8
        }
      }));

      // Start capturing audio
      await startAudioCapture();
      
      isConnected = true;
      updateUI("connected", "Listening - Start talking!");
      visualizerContainer.classList.add("active");
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleRealtimeEvent(data);
    };

    ws.onerror = (error) => {
      console.error("❌ WebSocket error:", error);
      addMessage("ai", "⚠️ Connection error. Please check your API key and access.");
      disconnect();
    };

    ws.onclose = (event) => {
      console.log("WebSocket closed:", event.code, event.reason);
      if (isConnected) {
        addMessage("ai", "Connection closed");
        disconnect();
      }
    };

  } catch (error) {
    console.error("Connection error:", error);
    updateUI("idle", "Connection failed");
    alert("Failed to connect. Please check your API key and internet connection.");
  }
}

// Disconnect
function disconnect() {
  isConnected = false;
  
  if (ws) {
    ws.close();
    ws = null;
  }
  
  if (processor) {
    processor.disconnect();
    processor = null;
  }
  
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }
  
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
  
  audioQueue = [];
  isPlayingAudio = false;
  
  updateUI("idle", "Tap to start conversation");
  visualizerContainer.classList.remove("active");
  inputLevelBar.style.width = "0%";
  outputLevelBar.style.width = "0%";
}

// Start audio capture
async function startAudioCapture() {
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        channelCount: 1,
        sampleRate: 24000,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      } 
    });
    
    audioContext = new AudioContext({ sampleRate: 24000 });
    const source = audioContext.createMediaStreamSource(mediaStream);
    processor = audioContext.createScriptProcessor(4096, 1, 1);
    
    processor.onaudioprocess = (e) => {
      if (!isConnected || !ws || ws.readyState !== WebSocket.OPEN) return;
      
      const inputData = e.inputBuffer.getChannelData(0);
      
      // Update input level visualization
      updateInputLevel(inputData);
      
      // Convert float32 to int16 PCM
      const pcmData = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]));
        pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      
      // Send audio to OpenAI
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
      ws.send(JSON.stringify({
        type: "input_audio_buffer.append",
        audio: base64Audio
      }));
    };
    
    source.connect(processor);
    processor.connect(audioContext.destination);
    
  } catch (error) {
    console.error("Microphone error:", error);
    alert("Unable to access microphone. Please grant permission.");
    disconnect();
  }
}

// Handle realtime events
function handleRealtimeEvent(event) {
  console.log("📨", event.type);
  
  switch (event.type) {
    case "session.created":
      console.log("Session created:", event.session);
      break;
      
    case "session.updated":
      console.log("Session updated");
      break;
      
    case "conversation.item.input_audio_transcription.completed":
      if (event.transcript) {
        addMessage("user", event.transcript);
      }
      break;
      
    case "response.audio_transcript.delta":
      if (event.delta) {
        updateAITranscript(event.delta);
      }
      break;
      
    case "response.audio_transcript.done":
      finalizeAITranscript(event.transcript);
      break;
      
    case "response.audio.delta":
      if (event.delta) {
        queueAudio(event.delta);
        updateUI("speaking", "AI is speaking...");
      }
      break;
      
    case "response.audio.done":
      updateUI("connected", "Listening - Your turn!");
      break;
      
    case "response.done":
      console.log("Response complete");
      break;
      
    case "input_audio_buffer.speech_started":
      console.log("🎤 User started speaking");
      updateUI("user-speaking", "You're speaking...");
      break;
      
    case "input_audio_buffer.speech_stopped":
      console.log("🎤 User stopped speaking");
      updateUI("processing", "Processing...");
      break;
      
    case "error":
      console.error("API Error:", event.error);
      addMessage("ai", `⚠️ Error: ${event.error.message}`);
      break;
  }
}

let currentTranscript = null;

function updateAITranscript(delta) {
  if (!currentTranscript) {
    currentTranscript = document.createElement("div");
    currentTranscript.className = "message ai partial";
    currentTranscript.textContent = "";
    outputDiv.appendChild(currentTranscript);
  }
  currentTranscript.textContent += delta;
  outputDiv.scrollTop = outputDiv.scrollHeight;
}

function finalizeAITranscript(fullText) {
  if (currentTranscript) {
    currentTranscript.className = "message ai";
    if (fullText) {
      currentTranscript.textContent = fullText;
    }
    currentTranscript = null;
  } else if (fullText) {
    addMessage("ai", fullText);
  }
}

// Queue and play audio
function queueAudio(base64Audio) {
  audioQueue.push(base64Audio);
  if (!isPlayingAudio) {
    playNextAudio();
  }
}

async function playNextAudio() {
  if (audioQueue.length === 0) {
    isPlayingAudio = false;
    outputLevelBar.style.width = "0%";
    return;
  }
  
  isPlayingAudio = true;
  const base64Audio = audioQueue.shift();
  
  try {
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const pcm16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) {
      float32[i] = pcm16[i] / (pcm16[i] < 0 ? 0x8000 : 0x7FFF);
    }
    
    const playbackContext = new AudioContext({ sampleRate: 24000 });
    const audioBuffer = playbackContext.createBuffer(1, float32.length, 24000);
    audioBuffer.getChannelData(0).set(float32);
    
    const sourceNode = playbackContext.createBufferSource();
    sourceNode.buffer = audioBuffer;
    
    const analyser = playbackContext.createAnalyser();
    analyser.fftSize = 256;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    sourceNode.connect(analyser);
    analyser.connect(playbackContext.destination);
    
    const visualize = () => {
      if (!isPlayingAudio) return;
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      outputLevelBar.style.width = `${Math.min(100, (average / 256) * 200)}%`;
      requestAnimationFrame(visualize);
    };
    visualize();
    
    sourceNode.onended = () => {
      playbackContext.close();
      playNextAudio();
    };
    
    sourceNode.start();
    
  } catch (error) {
    console.error("Audio playback error:", error);
    playNextAudio();
  }
}

// Update input level
function updateInputLevel(audioData) {
  let sum = 0;
  for (let i = 0; i < audioData.length; i++) {
    sum += audioData[i] * audioData[i];
  }
  const rms = Math.sqrt(sum / audioData.length);
  const level = Math.min(100, rms * 500);
  inputLevelBar.style.width = `${level}%`;
}

// UI Updates
function updateUI(state, message) {
  statusDiv.textContent = message;
  toggleButton.className = "";
  
  switch (state) {
    case "idle":
      buttonIcon.innerHTML = MIC_ICON;
      statusDiv.className = "";
      break;
    case "connecting":
      toggleButton.classList.add("connecting");
      buttonIcon.innerHTML = MIC_ICON;
      statusDiv.className = "connecting";
      break;
    case "connected":
      toggleButton.classList.add("connected");
      buttonIcon.innerHTML = STOP_ICON;
      statusDiv.className = "connected";
      break;
    case "user-speaking":
      toggleButton.classList.add("connected", "user-speaking");
      buttonIcon.innerHTML = STOP_ICON;
      statusDiv.className = "connected";
      break;
    case "processing":
      toggleButton.classList.add("connected", "processing");
      buttonIcon.innerHTML = STOP_ICON;
      statusDiv.className = "connecting";
      break;
    case "speaking":
      toggleButton.classList.add("connected", "ai-speaking");
      buttonIcon.innerHTML = WAVE_ICON;
      statusDiv.className = "connected";
      break;
  }
}

// Add message
function addMessage(type, text) {
  const msg = document.createElement("div");
  msg.className = `message ${type}`;
  msg.textContent = text;
  outputDiv.appendChild(msg);
  outputDiv.scrollTop = outputDiv.scrollHeight;
}