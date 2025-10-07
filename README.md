# Duplex Voice Chat (Frontend)

- Auto-connects to your Cloudflare Worker WS.
- Streams mic audio as `audio/webm; codecs=opus` chunks (250ms).
- Plays back AI audio (expects PCM16 24kHz from upstream).
- Shows simple text/chat log if text deltas are provided.

Edit `script.js` → `WORKER_WSS` to your Worker URL:
`wss://broad-hat-1325.nickydoyl.workers.dev`
