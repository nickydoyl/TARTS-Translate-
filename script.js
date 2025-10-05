// CONFIGURATION - Replace with your OpenAI API Key
const OPENAI_API_KEY = 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;

// ELEMENTS
const toggleButton = document.getElementById("toggleButton");
const micIcon = document.getElementById("micIcon");
const statusDiv = document.getElementById("status");
const outputDiv = document.getElementById("output");
const visualizerContainer = document.getElementById("visualizerContainer");
const inputLevelBar = document.getElementById("inputLevel");
const outputLevelBar = document.getElementById("outputLevel");

// STATE
let ws = null;
let mediaStream = null;
let audioContext = null;
let source = null;
let processor = null;
let isConnected = false;
let audioQueue = [];
let isPlayingAudio = false;
let currentAIMessage = null;

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
    // Update UI to connecting state
    toggleButton.classList.add("connecting");
    statusDiv.textContent = "Connecting...";
    statusDiv.className = "connecting";

    // Connect to WebSocket
    ws = new WebSocket(
      "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01",
      ["realtime", `openai-insecure-api-key.${OPENAI_API_KEY}`, "openai-beta.realtime-v1"]
    );

    ws.onopen = async () => {
      console.log("Connected to OpenAI Realtime API");
      
      // Send session configuration
      ws.send(JSON.stringify({
        type: "session.update",
        session: {
          modalities: ["text", "audio"],
          instructions: "You are a helpful and friendly AI assistant. Keep your responses concise and conversational.",
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
            silence_duration_ms: 500
          }
        }
      }));

      // Start capturing audio
      await startAudioCapture();
      
      isConnected = true;
      toggleButton.classList.remove("connecting");
      toggleButton.classList.add("connected");
      statusDiv.textContent = "Connected - Start talking!";
      statusDiv.className = "connected";
      visualizerContainer.classList.add("active");
      
      // Change icon to stop
      micIcon.innerHTML = '<rect x="6" y="6" width="12" height="12" rx="2"/>';
    };

    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      handleRealtimeEvent(data);
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      addMessage("ai", "⚠️ Connection error occurred");
      disconnect();
    };

    ws.onclose = () => {
      console.log("WebSocket closed");
      if (isConnected) {
        disconnect();
      }
    };

  } catch (error) {
    console.error("Connection error:", error);
    statusDiv.textContent = "Failed to connect";
    toggleButton.classList.remove("connecting");
  }
}

// Disconnect from API
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
  
  if (source) {
    source.disconnect();
    source = null;
  }
  
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
  
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }
  
  toggleButton.classList.remove("connected", "connecting", "ai-speaking");
  statusDiv.textContent = "Tap to start conversation";
  statusDiv.className = "";
  visualizerContainer.classList.remove("active");
  
  // Reset icon to microphone
  micIcon.innerHTML = '<path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>';
  
  inputLevelBar.style.width = "0%";
  outputLevelBar.style.width = "0%";
}

// Start capturing audio from microphone
async function startAudioCapture() {
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        channelCount: 1,
        sampleRate: 24000,
        echoCancellation: true,
        noiseSuppression: true
      } 
    });
    
    audioContext = new AudioContext({ sampleRate: 24000 });
    source = audioContext.createMediaStreamSource(mediaStream);
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
      const base64Audio = btoa(String.fromCharCode.apply(null, new Uint8Array(pcmData.buffer)));
      ws.send(JSON.stringify({
        type: "input_audio_buffer.append",
        audio: base64Audio
      }));
    };
    
    source.connect(processor);
    processor.connect(audioContext.destination);
    
  } catch (error) {
    console.error("Error accessing microphone:", error);
    alert("Unable to access microphone. Please check permissions.");
    disconnect();
  }
}

// Handle realtime events from OpenAI
function handleRealtimeEvent(event) {
  console.log("Event:", event.type);
  
  switch (event.type) {
    case "conversation.item.input_audio_transcription.completed":
      if (event.transcript) {
        addMessage("user", event.transcript);
      }
      break;
      
    case "response.audio_transcript.delta":
      if (event.delta) {
        updateAIMessage(event.delta);
      }
      break;
      
    case "response.audio_transcript.done":
      finalizeAIMessage();
      break;
      
    case "response.audio.delta":
      if (event.delta) {
        queueAudio(event.delta);
      }
      break;
      
    case "response.audio.done":
      toggleButton.classList.remove("ai-speaking");
      break;
      
    case "response.done":
      break;
      
    case "input_audio_buffer.speech_started":
      console.log("User started speaking");
      break;
      
    case "input_audio_buffer.speech_stopped":
      console.log("User stopped speaking");
      break;
      
    case "error":
      console.error("API Error:", event.error);
      addMessage("ai", `⚠️ Error: ${event.error.message}`);
      break;
  }
}

// Update or create AI message
function updateAIMessage(text) {
  if (!currentAIMessage) {
    currentAIMessage = document.createElement("div");
    currentAIMessage.className = "message ai partial";
    outputDiv.appendChild(currentAIMessage);
  }
  
  currentAIMessage.textContent += text;
  outputDiv.scrollTop = outputDiv.scrollHeight;
  
  // Add speaking animation
  if (!toggleButton.classList.contains("ai-speaking")) {
    toggleButton.classList.add("ai-speaking");
    
    // Show wave bars
    micIcon.innerHTML = `
      <div class="wave-bars">
        <div class="wave-bar"></div>
        <div class="wave-bar"></div>
        <div class="wave-bar"></div>
        <div class="wave-bar"></div>
        <div class="wave-bar"></div>
      </div>
    `;
  }
}

// Finalize AI message
function finalizeAIMessage() {
  if (currentAIMessage) {
    currentAIMessage.classList.remove("partial");
    currentAIMessage = null;
  }
  
  // Reset icon
  micIcon.innerHTML = '<rect x="6" y="6" width="12" height="12" rx="2"/>';
}

// Queue audio for playback
function queueAudio(base64Audio) {
  audioQueue.push(base64Audio);
  if (!isPlayingAudio) {
    playNextAudio();
  }
}

// Play queued audio
async function playNextAudio() {
  if (audioQueue.length === 0) {
    isPlayingAudio = false;
    outputLevelBar.style.width = "0%";
    return;
  }
  
  isPlayingAudio = true;
  const base64Audio = audioQueue.shift();
  
  try {
    // Decode base64 to PCM16
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const pcm16 = new Int16Array(bytes.buffer);
    
    // Convert PCM16 to Float32 for Web Audio API
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) {
      float32[i] = pcm16[i] / (pcm16[i] < 0 ? 0x8000 : 0x7FFF);
    }
    
    // Create audio buffer
    const playbackContext = new AudioContext({ sampleRate: 24000 });
    const audioBuffer = playbackContext.createBuffer(1, float32.length, 24000);
    audioBuffer.getChannelData(0).set(float32);
    
    // Create and play audio source
    const sourceNode = playbackContext.createBufferSource();
    sourceNode.buffer = audioBuffer;
    
    // Add analyzer for output visualization
    const analyser = playbackContext.createAnalyser();
    analyser.fftSize = 256;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    sourceNode.connect(analyser);
    analyser.connect(playbackContext.destination);
    
    // Visualize output
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
    console.error("Error playing audio:", error);
    playNextAudio();
  }
}

// Update input level visualization
function updateInputLevel(audioData) {
  let sum = 0;
  for (let i = 0; i < audioData.length; i++) {
    sum += audioData[i] * audioData[i];
  }
  const rms = Math.sqrt(sum / audioData.length);
  const level = Math.min(100, rms * 500);
  inputLevelBar.style.width = `${level}%`;
}

// Add message to conversation
function addMessage(type, text) {
  const msg = document.createElement("div");
  msg.className = `message ${type}`;
  msg.textContent = text;
  outputDiv.appendChild(msg);
  outputDiv.scrollTop = outputDiv.scrollHeight;
}