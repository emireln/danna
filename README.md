# danna

A focused English and TOEFL practice app for Windows. It has its own window bar and a tray icon, so practice stays one click away.

## Two ways to use danna

- **On this device**: no account needed. Everything is stored in a local SQLite database in the app's data folder. Friends and sharing are not part of this mode.
- **Online account**: sync across devices, and connect with friends. Switch between the two at any time in Settings. When you switch, you choose whether to copy your progress along.

## What is inside

- **Today**: a recommended lesson, a diagnostic test, banners, and a countdown to your exam.
- **Roadmap**: six units with lessons, unit checks, stars and unlocking.
- **Self study**: sections for Reading, Listening, Speaking and Writing, language sets, and mini mock tests.
- **Diagnostic and score report**: an estimated TOEFL score out of 120, a five-skill radar, skill cards with tips, and a study plan.
- **Review**: spaced repetition for every missed question.
- **Coach**: an AI tutor chat.
- **Friends** (online only): search by username, requests, a ranking, shared results and sets, and an inbox.
- **What's new**: release notes and banners.
- **AI, bring your own key**: OpenAI, Anthropic, Gemini or OpenRouter. The newest model is selected by default, and you can choose another in Settings.

## Run it

```bash
npm install
npm run dev
```

On this device works straight away. For online accounts, copy `.env.example` to `.env` and fill in your Supabase project URL and anon key. Then run `supabase/schema.sql` once in the Supabase SQL editor.

`npm run web` starts the interface in a browser for quick design checks. The desktop-only features (tray, window bar, AI keys, offline database) run in the desktop app.

## Build the Windows installer

```bash
npm run icons
```

```bash
npm run dist
```

The installer is written to `release/danna-setup-0.2.0-x64.exe`. Run `npm run icons` after changing the logo. It regenerates the installer icon, the tray icon and the favicon.

## Release notes and banners (online accounts)

In the Supabase Table Editor, add rows to `announcements`:

- **Release note**: `kind = 'release_note'`, a `version`, a `title`, and a `body` with one feature per line starting with `- `. Set `published = true`.
- **Banner**: `kind = 'banner'`, a `title`, a short `body`, an `accent` (`blue`, `teal`, `amber` or `ink`), an optional `image_url` from the `banners` bucket, and an optional button (`cta_label` and `cta_url`). `cta_url` can be an in-app path such as `/play/diagnostic` or an `https://` link.

People on this device see the release notes and banner bundled in `src/content/announcements.ts`.

## Where data lives

- **On this device**: `danna.db` (SQLite) and `danna-settings.json` in the app's data folder. Nothing is sent anywhere.
- **Online**: your account, stored in Supabase with row-level security, so only you can read your own rows (shared items are the exception).
- **AI keys**: encrypted by Windows and used only by the app's main process. They are never saved to the online account.

## Project structure

```
electron/      Desktop shell: window, tray, offline database, AI key store, provider adapters
src/           Interface (React and TypeScript)
  components/  Title bar, shared UI, charts, question renderer
  content/     Bundled lessons, passages, the diagnostic, the mini mock and release notes
  lib/         Scoring, grading, review scheduling, AI prompts, data backends, progress copying
  screens/     One file per screen
  state/       Auth, AI, app data and toast providers
supabase/      Online database schema, policies and functions
scripts/       Logo and icon generator
```

## Limits in this version

- TOEFL scores are estimates for practice, not official ETS scores.
- Speaking answers are transcribed with an OpenAI key. Without one, you rate your own answer.
- Automatic updates and Google sign-in are not included yet.
- The online schema has been written and reviewed, but it has not been run against a live Supabase project yet.
