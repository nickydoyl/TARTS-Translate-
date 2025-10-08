Voice Chat (Duplex Edition)
----------------------------
Frontend connects to Cloudflare Worker for real-time voice chat using GPT-4o Realtime model.

Setup:
1. Upload all four files to your GitHub repository.
2. Ensure Cloudflare Worker is deployed and reachable (✅ test in browser).
3. Set WORKER_URL in script.js to your worker domain.
4. Deploy via GitHub Pages or Vercel.
5. Open the page, tap the mic button, and speak.

Behavior:
- Mic button turns red while recording.
- Audio chunks stream live to OpenAI through the Worker.
- AI replies with live audio back through same WebSocket.
- Console/log window shows connection state and events.