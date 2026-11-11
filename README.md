# danna

A focused English and TOEFL practice app for Windows. It has its own window bar and a tray icon, so practice stays one click away.

## Two ways to use danna

- **On this device**: no account needed. Everything is stored in a local SQLite database in the app's data folder. Friends and sharing are not part of this mode.
- **Online account**: sync across devices, and connect with friends. Switch between the two at any time in Settings. When you switch, you choose whether to copy your progress along. Progress saved on a device can also be added to your account later, from Settings.

Your profile picture works in both modes. Pictures are converted to a small WebP file (256 px, under 300 KB).

## What is inside

- **Today**: a recommended lesson, a diagnostic test, banners, and a countdown to your exam.
- **Roadmap**: six units with lessons, unit checks, stars and unlocking.
- **Self study**: sections for Reading, Listening, Speaking and Writing, language sets, and mini mock tests.
- **Diagnostic and score report**: an estimated TOEFL score out of 120, a five-skill radar, skill cards with tips, and a study plan.
- **Review**: spaced repetition for every missed question.
- **Coach**: an AI tutor chat.
- **Friends** (online only): search by username from three letters, requests, a ranking, shared results and sets, and an inbox.
- **What's new**: release notes and banners.
- **AI, bring your own key**: OpenAI, Anthropic, Gemini or OpenRouter. The newest model is selected by default, and you can choose another in Settings.

## Run it

```bash
npm install
npm run dev
```

The project settings for the online account are bundled in `.env.development` and `.env.production`. They hold only public values: the project URL and the publishable key. To use another Supabase project, copy `.env.example` to `.env.local` and fill it in.

`npm run web` starts the interface in a browser for quick design checks. The desktop-only features (tray, window bar, AI keys, offline database, encrypted sign-in) run in the desktop app.

## Tests

```bash
npm test
```

- `tests/migrate.test.mjs` checks how progress is copied between a device and an account: nothing is lost, running the copy twice adds nothing, and the higher numbers win.
- `supabase/tests/policies.test.mjs` runs the real schema on PostgreSQL (PGlite, in-process) and checks what each person can and cannot do: row-level security on every table, friend requests, sharing, private pictures, limits, quotas, and an upgrade from the first schema version.

## Logo and icons

`brand/logo.png` is the master logo. After changing it, run:

```bash
npm run icons
```

This writes the files the app uses. In the interface, the logo and the icon are WebP (`src/assets/logo.webp`, `src/assets/icon.webp`, `public/favicon.webp`). The installer, the window and the tray need PNG or ICO, so those are generated as well: `build/icon.ico`, `build/icon.png`, and `electron/assets/`. The app icon is the logo on a white rounded square.

## Build the Windows installer

```bash
npm run dist
```

The installer is written to `release/danna-setup-0.2.0-x64.exe`. Delete the `release` folder first if an earlier build is there.

## Online accounts (Supabase)

1. In the Supabase dashboard, open **SQL Editor**, paste the whole of `supabase/schema.sql`, and run it. It is safe to run again. It creates the tables, the row-level security rules, the private picture bucket and the release notes.
2. In **Authentication**, keep email confirmation on. Set the Site URL and redirect URLs for the app.
3. Never add a service-role or secret key to the app. Only the publishable key is bundled.

## Release notes and banners (online accounts)

In the Supabase Table Editor, add rows to `announcements`:

- **Release note**: `kind = 'release_note'`, a `version`, a `title`, and a `body` with one feature per line starting with `- `. Set `published = true`.
- **Banner**: `kind = 'banner'`, a `title`, a short `body`, an `accent` (`blue`, `teal`, `amber` or `ink`), an optional `image_url` (an `https://` link, for example from the `banners` bucket), and an optional button (`cta_label` and `cta_url`). `cta_url` can be an in-app path such as `/play/diagnostic` or an `https://` link.

People on this device see the release notes and banner bundled in `src/content/announcements.ts`.

## Where data lives

- **On this device**: `danna.db` (SQLite, including the profile picture) and `danna-settings.json` in the app's data folder. Nothing is sent anywhere.
- **Sign-in session**: `danna-session.bin`, encrypted by Windows and readable only by this app for this Windows user.
- **Online**: your account, stored in Supabase with row-level security, so only you can read your own rows. Shared results and sets are visible to the friend they were shared with, and only while you are still friends. Your picture is private: only you and your friends can download it.
- **AI keys**: encrypted by Windows and used only by the app's main process. They are never saved to the online account.

## Security

- The desktop window has no Node access, runs sandboxed with context isolation, and opens links only over `https`.
- The page can contact only the project's own address. Images, scripts and frames are restricted by a content security policy.
- The packaged app turns off Electron features that allow running as Node, loading code from outside the app package, and debugging through command-line switches.
- Friend requests cannot be forged or accepted on someone else's behalf. XP never goes down online.
- Limits on text, data and rows per person keep one account from filling the database.
- The XP and streak are calculated on the device. The database keeps them from going down, but cannot check how they were earned.

## Project structure

```
brand/         Master logo
electron/      Desktop shell: window, tray, offline database, sign-in session, AI key store, provider adapters
src/           Interface (React and TypeScript)
  assets/      Logo and icon (WebP)
  components/  Title bar, shared UI, charts, question renderer
  content/     Bundled lessons, passages, the diagnostic, the mini mock and release notes
  lib/         Scoring, grading, review scheduling, AI prompts, data backends, progress copying, pictures
  screens/     One file per screen
  state/       Auth, AI, app data and toast providers
supabase/      Online database schema (schema.sql) and its tests
tests/         Progress copy tests
scripts/       Logo and icon generator
```

## Limits in this version

- TOEFL scores are estimates for practice, not official ETS scores.
- Speaking answers are transcribed with an OpenAI key. Without one, you rate your own answer.
- Automatic updates and Google sign-in are not included yet.
- The online schema is covered by the tests above, but it must be run once on the Supabase project (see Online accounts).

## Versions and releases

Every commit bumps the patch number automatically (a pre-commit hook in `.husky/`). To start a new feature release, run `npm run bump -- minor` and commit it: a version changed by hand in a commit is kept as it is.

To publish the current version to GitHub with its Windows installer: run `npm run dist` to build it, push the commit, then run `npm run release`. The release is named after the version (tag `v<version>`), and the commit messages since the previous release become its notes.
