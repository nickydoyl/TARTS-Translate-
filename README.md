
# Voice Chat Duplex (Frontend)

This is the **duplex** browser client for your Cloudflare Worker that proxies OpenAI
Realtime. It uses the Realtime protocol messages for audio:

- `input_audio_buffer.append` (base64 WebM/Opus chunks)
- `input_audio_buffer.commit`
- `response.create` (asks model to speak)
- plays `response.audio.delta` / `response.output_audio.delta` (base64 PCM16)

**Default worker** baked in: `wss://broad-hat-1325.nickydoyl.workers.dev`.  
Override via URL: `?worker=YOUR-WORKER.workers.dev`

Drop these four files into GitHub Pages (or any static host).
