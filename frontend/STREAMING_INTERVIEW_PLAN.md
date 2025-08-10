## Streaming Vocal Interview Frontend Plan (Production)

Scope: Real-time capture, upload, transcription (incremental), evaluation streaming, rubric visualization, persistence.

### Phases

1. Session bootstrap
   - Create streaming session (candidateId) -> sessionId.
   - Open auth SSE to /api/streaming/stt/:sessionId for partial transcripts.
2. Audio capture & chunk push
   - Use ChunkedRecorder; on each chunk, POST to upload endpoint.
   - Track cumulative bytes + elapsed time; enforce local limits.
3. Incremental transcript UX
   - Maintain progressive transcript string; append delta events.
   - Show spinner while awaiting first partial; handle error events.
4. Answer finalization
   - On user stop or silence > threshold, call /complete.
   - Persist full transcript; optionally auto-submit evaluation (future).
5. Evaluation integration (future step)
   - After /complete, hit evaluation streaming endpoint with final transcript.
   - Map reasoning & score events to rubric visualizer.

### Event Handling Contract

STT SSE events:
{ type: 'stt-start', sessionId }
{ type: 'stt-partial', delta, fullTranscript, sessionId, timestamp }
{ type: 'error', code, message }

### State Stores (planned extensions)

streamInterview store:
{ sessionId, transcript, connecting, recording, chunks: number, bytes: number, error?, finalTranscript? }

### Edge Cases

- Network blip: SSE reconnect -> request sessionStatus to rebuild counts.
- Large transcript: limit UI substring (e.g., show last N chars while keeping full hidden).
- Rate limit 429: backoff exponential before re-upload.
- Token expiry mid-session: pause recorder, prompt re-login, resume.

### Security & Privacy

- Never store raw audio locally beyond needed chunks.
- Scrub transcript from memory upon user cancellation.
- Enforce MIME + size before upload.

### Metrics (future instrumentation)

- Frontend custom events: stt_partial_latency_ms (first partial), upload_interval_ms, average_chunk_size_bytes.

### Next Implementation Steps

- Create streamInterview store.
- Integrate createAuthSSE for STT events.
- Wire recorder chunk callback -> api.streaming.uploadChunk + schedule local debounced UI updates.

---

This file guides incremental, production-safe implementation; update as features land.
