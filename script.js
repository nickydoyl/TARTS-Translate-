const button = document.getElementById("recordButton");
const status = document.getElementById("status");
const output = document.getElementById("output");
let recording = false;

button.addEventListener("click", async () => {
  if (!recording) {
    recording = true;
    status.textContent = "🎙️ Recording...";
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    const chunks = [];

    recorder.ondataavailable = e => chunks.push(e.data);
    recorder.onstop = async () => {
      const blob = new Blob(chunks, { type: "audio/webm" });
      const arrayBuffer = await blob.arrayBuffer();
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      status.textContent = "⏳ Sending audio to server...";

      const response = await fetch("https://tight-fire-bddf.nickydoyl.workers.dev", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini-transcribe",
          input: base64Audio
        })
      });

      const data = await response.json();
      output.textContent = data.text || JSON.stringify(data);
      status.textContent = "✅ Done";
    };

    recorder.start();
    setTimeout(() => recorder.stop(), 5000); // auto-stop after 5 seconds
  } else {
    recording = false;
    status.textContent = "🛑 Stopped.";
  }
});
