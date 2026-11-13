# danna

An English learning app for Windows, from A1 to C1, with an optional TOEFL warm-up. It has its own window bar and a tray icon, so practice stays one click away.

## Two ways to use danna

- **On this device**: no account needed. Everything is stored in a local SQLite database in the app's data folder. Friends and sharing are not part of this mode.
- **Online account**: sync across devices, and connect with friends. Switch between the two at any time in Settings. When you switch, you choose whether to copy your progress along. Progress saved on a device can also be added to your account later, from Settings.

Your profile picture works in both modes. Pictures are converted to a small WebP file (256 px, under 300 KB).

## What is inside

- **Today**: your next lesson, the level check, banners, and an optional exam countdown.
- **Roadmap**: General English from A1 to C1. Each unit has lessons, a unit check, stars and unlocking. Your level decides where you start.
- **Self study**: sections for Reading, Listening, Speaking, Writing and Language, a level test for each level, and the optional TOEFL warm-up.
- **Level check and report**: your level, a five-skill radar, skill cards with tips, and a study plan. With the TOEFL warm-up, the report also shows an estimated score out of 120.
- **Review**: spaced repetition for every missed question.
- **Coach**: an AI tutor chat.
- **My library** (from your profile): keep PDF, TXT and Markdown files and read them in the app. Save learning links from YouTube, Coursera, Khan Academy and other platforms, with the platform's logo, and sort them into categories. Ask the tutor questions about the files you choose; it answers only from them and names the file.
- **Friends** (online only): search by username from three letters, requests, a ranking, shared results and sets, and an inbox.
- **What's new**: release notes and banners.
- **AI, bring your own key**: OpenAI, Anthropic, Google Gemini, OpenRouter or DeepSeek. The newest model is selected by default, and you can choose another in Settings. DeepSeek's live model list is read from its API, and the newest version is chosen.

## Run it

```bash
npm install
npm run dev
```

The project settings for the online account are bundled in `.env.development` and `.env.production`. They hold only public values: the project URL and the publishable key. To use another Supabase project, copy `.env.example` to `.env.local` and fill it in.

`npm run web` starts the interface in a browser for quick design checks. The desktop-only features (tray, window bar, AI keys, offline database, encrypted sign-in, library files) run in the desktop app.

## Tests

```bash
npm test
```

- `tests/migrate.test.mjs` checks how progress and library items are copied between a device and an account: nothing is lost, running the copy twice adds nothing, and the higher numbers win.
- `tests/library.test.mjs` checks the library helpers: the file kinds it keeps, and the passages the tutor reads for a question.
- `tests/platforms.test.mjs` checks how links are matched to platforms and how pasted links are checked.
- `tests/content.test.mjs` checks every bundled lesson item (choices, gaps, ordering, writing and speaking), the unique and short lesson ids, the level and TOEFL tests, and the placement of a new learner.
- `tests/ai-providers.test.mjs` checks key detection, DeepSeek's model ranking, and the model and chat requests (without the network).
- `supabase/tests/policies.test.mjs` runs the real schema on PostgreSQL (PGlite, in-process) and checks what each person can and cannot do: row-level security on every table, friend requests, sharing, private pictures and library files, limits, quotas, and an upgrade from the first schema version.

## Logos, icons and the installer banner

`brand/logo.png` is the master logo. After changing it, or after adding a platform logo, run:

```bash
npm run art
```

This writes everything the app and the installer use:

- `npm run icons`: the app logo and icon. In the interface they are WebP (`src/assets/logo.webp`, `src/assets/icon.webp`, `public/favicon.webp`). The installer, the window and the tray need PNG or ICO, so those are generated too: `build/icon.ico`, `build/icon.png`, and `electron/assets/`. The app icon is the logo on a white rounded square.
- `npm run logos`: the platform logos for learning links (`src/assets/platforms/`). Most come from the open Simple Icons set. A platform without one shows its initial until its official logo is added to `brand/platforms/` (see the README there).
- `npm run installer-art`: the installer's side banner (`build/installerSidebar.bmp`, 164 x 314), with the letters of danna stacked on `#2f6bff`.

## Build the Windows installer

```bash
npm run dist
```

The installer is written to `release/danna-setup-<version>-x64.exe`. Delete the `release` folder first if an earlier build is there.

## Online accounts (Supabase)

1. For a new project: in the Supabase dashboard, open **SQL Editor**, paste the whole of `supabase/schema.sql`, and run it. It is safe to run again. It creates the tables, the row-level security rules, the private picture bucket, the library and the release notes.
2. For a project that already runs an earlier version, run these in the **SQL Editor**, in order, each one whole: `supabase/migrations/0002_library.sql` (My library, its private `library` bucket and the 0.3.0 release note, if not run yet), then `supabase/migrations/0003_general_english.sql` (the learning goal, the A1 level and the 0.4.0 release note), then `supabase/migrations/0004_release_0_5_0.sql` (the 0.5.0 release note), then `supabase/migrations/0005_release_0_6_0.sql` (coach chats, the files in the coach, and the 0.6.0 release note). All four are safe to run again.
3. In **Authentication**, keep email confirmation on. Set the Site URL and redirect URLs for the app.
4. Never add a service-role or secret key to the app. Only the publishable key is bundled.

## Release notes and banners (online accounts)

In the Supabase Table Editor, add rows to `announcements`:

- **Release note**: `kind = 'release_note'`, a `version`, a `title`, and a `body` with one feature per line starting with `- `. Set `published = true`.
- **Banner**: `kind = 'banner'`, a `title`, a short `body`, an `accent` (`blue`, `teal`, `amber` or `ink`), an optional `image_url` (an `https://` link, for example from the `banners` bucket), and an optional button (`cta_label` and `cta_url`). `cta_url` can be an in-app path such as `/play/diagnostic` or an `https://` link.

People on this device see the release notes and banner bundled in `src/content/announcements.ts`.

## Where data lives

- **On this device**: `danna.db` (SQLite: progress, the profile picture, library files and links) and `danna-settings.json` in the app's data folder. Nothing is sent anywhere.
- **Sign-in session**: `danna-session.bin`, encrypted by Windows and readable only by this app for this Windows user.
- **Online**: your account, stored in Supabase with row-level security, so only you can read your own rows. Shared results and sets are visible to the friend they were shared with, and only while you are still friends. Your picture is private: only you and your friends can download it. Your library files are private to you, not even friends can open them.
- **AI keys**: encrypted by Windows and used only by the app's main process. They are never saved to the online account. The tutor sends only the excerpts of the files you chose to the AI provider you connected.

## Security

- The desktop window has no Node access, runs sandboxed with context isolation, and opens links only over `https`.
- The page can contact only the project's own address. Images, scripts and frames are restricted by a content security policy.
- The packaged app turns off Electron features that allow running as Node, loading code from outside the app package, and debugging through command-line switches.
- Friend requests cannot be forged or accepted on someone else's behalf. XP never goes down online.
- Limits on text, data and rows per person keep one account from filling the database (library: 300 files of up to 20 MB, 2000 links).
- The XP and streak are calculated on the device. The database keeps them from going down, but cannot check how they were earned.

## Project structure

```
brand/         Master logo, and platform logos (brand/platforms)
electron/      Desktop shell: window, tray, offline database, sign-in session, AI key store, provider adapters
scripts/       Logo, icon, platform and installer art generators; version bump and release
src/           Interface (React and TypeScript)
  assets/      Logo, icon and platform logos (WebP)
  components/  Title bar, shared UI, file viewer, tutor, platform logos, charts, question renderer
  content/     Bundled lessons for A1 to C1 and the TOEFL warm-up (units/), passages, the level check, level tests and release notes
  lib/         Scoring, grading, review scheduling, AI prompts, data backends, progress copying,
               library, platforms and PDF support
  screens/     One file per screen
  state/       Auth, AI, app data and toast providers
supabase/      Online database schema (schema.sql), the migration for existing projects, and the database tests
tests/         Tests for copying, the library, platforms and AI providers
```

## Limits in this version

- TOEFL scores are estimates for practice, not official ETS scores.
- Speaking answers are transcribed with an OpenAI key. Without one, you rate your own answer.
- The tutor needs an AI key. A scanned PDF has no text to read until it is converted with OCR.
- Platform logos come from the open Simple Icons set. Some platforms (for example Alura, BBC Learning English, Cambridge and ETS) have no open logo: they show their initial until their official logo is added to `brand/platforms/`.
- Automatic updates and Google sign-in are not included yet.

## Versions and releases

Every commit bumps the patch number automatically (a pre-commit hook in `.husky/`). To start a new feature release, run `npm run bump -- minor` and commit it: a version changed by hand in a commit is kept as it is.

To publish the current version to GitHub with its Windows installer: push the commit, run `npm run dist` to build the installer, then run `npm run release`. The release is named after the version (tag `v<version>`), and the commit messages since the previous release become its notes.
