# Talk live with the coach

Status: built (phase 1). Checked against the live API on 2026-11-21 with the model `gemini-3.8-live`.

## Goal

The coach works in text. The learner also needs to hear and speak English, get an answer within a second or two, and meet a coach that reacts like a person: its mouth moves with the voice, it blinks, it looks at the learner, and turn-taking feels natural.

## What the learner gets

- A "Talk live" card on the coach home. It opens `/coach/live`, a screen with a 3D coach.
- Three real people as coaches, with the same brain: Ana (MakeHuman, CC0), Leo and Mia (Microsoft RocketBox, MIT). Each coach starts with a Gemini voice that suits it, which can be changed on the screen. Only the head is shown.
- A start button. The coach answers with its voice and its face, and stops at once when the learner speaks (barge-in). Captions show both sides of the talk, and the learner can type a message at any time.
- Two ways of taking turns (Gemini engine): talk freely (the server decides when the learner has finished) or hold to talk.
- The coach knows the learner's level, goal, exam date, weakest skill and recent answers to review. It gives at most one gentle correction per turn, then asks a question.
- At the end, the transcript can be saved to the coach's chats. Nothing is saved otherwise.

## Two engines, one screen

1. **Gemini Live.** Used whenever a Gemini key is connected, even when another provider is selected for text. The audio goes both ways in real time, and the transcripts come back with it. The key stays in the main process.
2. **Typed engine (any other key).** The learner types, or holds the voice button when an OpenAI key is connected (speech-to-text, as in speaking practice). The selected text provider writes the reply as it streams, and each finished sentence is read with the voice chosen in Settings (built-in, Windows or cloud). The coach's mouth follows the same audio analysis as in the Gemini engine.

## What was verified against the live API

Checked with Node probes and with the opt-in live test (`tests/live-smoke.test.mjs`). The key was passed through the environment and never written to a file.

- Endpoint: `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent`, with the key as the `key` query parameter. The URL carries the key, so the key must never be logged or sent to the window.
- Setup is accepted with `model`, `generationConfig.responseModalities: ["AUDIO"]`, `speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName`, `systemInstruction`, `inputAudioTranscription: {}`, `outputAudioTranscription: {}`, `realtimeInputConfig.automaticActivityDetection`, `realtimeInputConfig.activityHandling`, `contextWindowCompression: { slidingWindow: {} }` and `sessionResumption`.
- Input audio: 16-bit little-endian PCM, 16 kHz, mono, as `realtimeInput.audio` with `audio/pcm;rate=16000`. Output audio: `serverContent.modelTurn.parts[].inlineData` at `audio/pcm;rate=24000`.
- A text turn gave its first audio after about 1.4 s. A spoken question was transcribed and answered, and the server ended the turn by itself.
- Barge-in: speech during a long answer produced `interrupted` about 3 s in. The client stops playback and clears its queue at that moment.
- Voice names are not validated by the server (any string is accepted at setup), so the app uses the documented prebuilt voices.
- Limits: an audio session without compression ends after 15 minutes, and a connection ends after about 10 minutes, with a `goAway` a minute before. Compression removes the time cap. Resumption handles last 2 hours. The app uses compression and resumes after a dropped connection.

## Architecture

**Main process (`electron/live.cjs`).** One live session at a time. It owns the WebSocket, the key, the setup message, reconnection and the mapping from server messages to small events. Its events go to the window on `live:event`; microphone frames arrive on `live:audio` and turn signals on `live:activity`. Both are fire-and-forget and sender-checked. The IPC wiring is in `electron/main.cjs`, `electron/preload.cjs` and `src/lib/bridge.ts`.

- A dropped connection reconnects with the last resumption handle (up to five attempts, with a growing pause). A `goAway` opens the next socket first, and the old one closes only when the new one is ready.
- If the key cannot use a model, the next one in the list is tried (`gemini-3.8-live`, `gemini-3.1-flash-live-preview`, `gemini-2.5-flash-native-audio-latest`).
- Messages are built and parsed by pure functions, so the tests need no network.

**Renderer (`src/lib/live/`).**
- `mic.ts` opens the microphone (echo cancellation on) and runs `public/mic-worklet.js`, which turns the browser's rate into 16 kHz, 16-bit mono frames of 40 ms.
- `player.ts` plays the coach's voice: PCM at 24 kHz as it arrives, or decoded sound files for the typed engine. Both go through one `AnalyserNode`.
- `analysis.ts` reads a sound (loudness, pitch by autocorrelation, energy in three bands: 80 to 500 Hz, 500 to 1500 Hz and 1500 to 4000 Hz) and maps it to the mouth: open, round and wide. Pure functions.
- `sentences.ts` cuts a streaming reply into sentences and removes markdown before it is spoken.
- `prompt.ts` writes the voice rules, the persona and the learner's facts (`learnerContext`).
- `conversation.ts` joins both engines, the microphone and the player, and gives the screen one state: status, transcript, notices and errors.

**Avatar (`src/avatar/`).** `characters.ts` lists the coaches and their models. `morphs.ts` turns the mouth, eyes and brows of the pose into weights for the ARKit face shapes and the Oculus visemes that every model carries. `rig.ts` computes the body language from the status and the sound: blinks, gaze, head movement, the intonation lift (rising pitch lifts the brows and tilts the head), the thinking pose and the mouth. `coach3d.ts` loads the model (three.js, with meshopt decoding), turns the head and neck bones, and cuts the body away below the neck, so only the head is drawn. `Avatar.tsx` runs the loop. three.js and the models load only when the screen opens.

**Screen.** `src/screens/LiveScreen.tsx`, route `/coach/live`. The coach home card uses the mode `live` (`src/lib/coachModes.ts`), which opens the screen instead of starting a chat.

## Coaches and their models

The models are in `public/characters/`, with their credits and the full MIT license text in `CREDITS.md`.

- **Ana:** MakeHuman with the MPFB plugin (CC0). The file is the MPFB model that the TalkingHead project ships.
- **Leo and Mia:** avatars from the Microsoft RocketBox library (MIT): `Male_Adult_02` and `Female_Adult_15`.
- All three carry the ARKit face shapes and the Oculus visemes, under the same names, so one set of weights moves every face. The check that each file has them is in `tests/live-characters.test.mjs`.
- The RocketBox files were converted with `scripts/characters/convert-rocketbox.py`, which needs Blender's Python module (`bpy` 5.3.0). The textures are converted to WebP and the files are compressed with `gltf-transform` (`optimize --compress meshopt --texture-compress webp --texture-size 2048`).
- The content security policy allows WebAssembly (`'wasm-unsafe-eval'`), which the meshopt decoder needs, and `blob:` addresses, which the loader uses for the textures. Nothing else in the policy changed.

## Privacy, keys and cost

- The first talk on each device shows what is sent: the voice goes to Google for Gemini Live, and the words go to the learner's provider for the typed engine. The notice is stored per device.
- The Gemini key is used only in the main process. Errors are cleaned before they reach the window.
- A talk ends when the learner ends it, and also when danna is hidden, so the microphone never listens out of sight. Live audio is billed by the provider per second.
- The transcript is saved only when the learner chooses to save it at the end.

## Testing

- `npm test` runs the unit tests: the message builders and parsers, the session manager against a fake socket, the sound helpers (including the microphone worklet in a sandbox), the conversation behaviour with fake bridge, microphone, player and reply, the rig, and the Electron channel checks.
- Live check (opt-in): `DANNA_GEMINI_KEY` in the environment runs `tests/live-smoke.test.mjs` against the real service. It is skipped without the variable.
- App check: `npm run dev` with Electron's fake microphone, given a WAV file as its input. The check reads the transcript, the states and the canvas, and it never writes the key to disk.

## Phases

- **Phase 1 (this build):** the Gemini Live engine, the typed engine, three characters with lip sync, the consent notice, captions, the turn modes, the transcript save.
- **Phase 2:** tool calls during the talk (save words to a deck, log mistakes), a recap with corrections at the end, phoneme-accurate lip sync, an OpenAI Realtime engine, and offline speech recognition for learners without a key.
- **Phase 3:** pronunciation feedback, memory of earlier talks, scene scores and VRM character import.
