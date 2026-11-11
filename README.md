# danna

A focused English and TOEFL practice app for Windows. It runs as an Electron desktop app, uses Supabase for accounts, friends, sharing and announcements, and works offline on one device when no account is set up.

## What is inside

- **Today**: recommended study, a diagnostic test, a banner area for announcements, the current lesson, and a countdown to your exam.
- **Roadmap**: six units with lessons, unit checks, stars and unlocking. Returning learners start at their level.
- **Self study**: Reading, Listening, Speaking and Writing sections, language sets and mini mock tests.
- **Diagnostic and score report**: an estimated TOEFL score out of 120, a five-skill radar against your goal, skill cards with tips, and a study-plan donut. The report can be shared with a friend or saved as a PNG.
- **Review**: spaced repetition for every question you miss.
- **Coach**: an AI tutor chat that uses the model you choose.
- **Friends**: search by username, requests, a friends ranking, shared results and sets, and an inbox.
- **What's new**: release notes and banners, both managed from Supabase.
- **AI, bring your own key**: paste an OpenAI, Anthropic, Google Gemini or OpenRouter key. danna detects the provider, checks the key, lists the provider's latest models and selects the newest one. You can switch models in Settings. The AI writes new practice sets, gives writing feedback and transcribes speaking answers.

## Set up

1. Create a project at [supabase.com](https://supabase.com).
2. In the dashboard, open **SQL Editor**, paste the contents of `supabase/schema.sql` and run it. It creates the tables, row-level security policies, functions and the `banners` storage bucket.
3. Copy `.env.example` to `.env` and fill in your project URL and anon key from **Project Settings → API**.
4. Install and run:

```bash
npm install
npm run dev
```

`npm run web` starts only the interface in a browser for quick design checks. AI features need the desktop app, because keys are stored with Windows.

## Build the Windows installer

```bash
npm run dist
```

The installer is written to `release/danna-setup-0.1.0-x64.exe`. The first build downloads electron-builder's tools, so it needs an internet connection. To regenerate the icon, run `npm run icons`.

## Publish release notes and banners

Use the Supabase Table Editor, or SQL, on the `announcements` table:

- **Release note**: `kind = 'release_note'`, a `version` such as `0.2.0`, a `title`, and a `body` with one feature per line starting with `- `. Set `published = true`.
- **Banner**: `kind = 'banner'`, a `title`, a short `body`, an `accent` (`blue`, `teal`, `amber` or `ink`), an optional image, and an optional button. Upload images to the `banners` bucket and paste the public URL into `image_url`. `cta_url` can be an in-app route such as `/play/diagnostic` or an `https://` link.
- Use `starts_at` and `ends_at` to schedule a banner.

## How the AI keys are handled

- Keys are encrypted with Windows (Electron `safeStorage`, which uses DPAPI) and stored in the app's user-data folder.
- Only the Electron main process reads them. They are sent only to the provider you chose, and never to Supabase.
- Model lists come from each provider's live API, so new models appear without an app update.
- Speaking transcription uses an OpenAI key (`gpt-4o-transcribe`, falling back to `whisper-1`). Without one, speaking answers are self-rated.

## Security

- Row-level security is enabled on every table. You can read and write only your own rows, unless a friend shared an item with you.
- Sharing requires an accepted friendship and ownership of the shared result or set.
- The renderer runs with `contextIsolation` and `sandbox`, has a strict Content-Security-Policy, and can use only the microphone, and only on danna's own pages.
- The Supabase anon key in `.env` is public by design. The database rules are what protect your data.

## Project structure

```
electron/      Electron main process, preload bridge, AI provider adapters, encrypted key store
src/           React interface (TypeScript)
  content/     Bundled lessons, passages, the diagnostic test and the mini mock
  lib/         Scoring, grading, spaced repetition, AI prompts and validation, data backends
  screens/     One file per screen
  components/  Shared UI, charts and the question renderer
  state/       Auth, AI, app data and toast providers
supabase/      Database schema, policies and functions
scripts/       Icon generator
build/         Application icon used by the installer
```

## Limits in this version

- TOEFL scores are estimates for practice. They are not official ETS scores.
- The bundled content covers six units, a diagnostic and a mini mock. The AI can generate more sets once a key is connected.
- Offline mode keeps everything on one device and has no friends or sharing.
- Not included yet: automatic updates, Google sign-in and a web or mobile version.
- `supabase/schema.sql` was written and reviewed, but it has not yet been run against a live Supabase project.
