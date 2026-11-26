# Setup and releases

For the people who build, publish and host Danna. Nothing here is needed to use the app.

## Run the tests

```bash
npm test
```

The tests check the things that would hurt most if they broke: the lessons, copying progress between devices and accounts, how AI keys are sealed, the library, links, the coach, the decks, the Portuguese translations, and the database rules. The database tests run a real PostgreSQL schema in memory, so there's nothing extra to install.

## Logos and icons

`brand/logo.png` is the master logo, `brand/icon.png` is the app icon, `brand/tray-icon.png` is the tray icon, and `brand/banner.png` is the installer's side picture. The icon is a finished picture with its own rounded square, so it is used as it is, with no frame. After you change either file, or add a platform logo, run:

```bash
npm run art
```

That makes everything the app and the installer need:

- The app logo, the app icon for the window, the installer and the browser tab, and the tray icon (`npm run icons`).
- Logos for learning platforms like YouTube and Coursera (`npm run logos`). A platform without an official logo shows its first letter until one is added to `brand/platforms/`.
- The side picture of the installer and the uninstaller, from the banner (`npm run installer-art`).

## Avatars

People without a picture get one of 96 built-in avatars: WebP pictures made with [DiceBear](https://www.dicebear.com) under the CC0 licence, listed in `src/assets/avatars/CREDITS.md`. Each person's avatar is chosen from their id, so it stays the same on every screen. The app bundles the pictures and never converts them. Pictures people upload are converted to WebP on their device. To rebuild the pack, run `npm run avatars`.

## Build the Windows installer

```bash
npm run dist
```

The installer lands in `release/danna-setup-<version>-x64.exe`. If there's an older `release` folder, delete it first.

## Set up the online account (Supabase)

You only need this if you want accounts.

1. **New project.** In the Supabase dashboard, open **SQL Editor**, paste all of `supabase/schema.sql`, and run it. It's safe to run again.
2. **Existing project.** Run the migration files below in the **SQL Editor**, one at a time, in order. Each one is safe to run again.

| File | What it adds |
| --- | --- |
| `supabase/migrations/0002_library.sql` | My library and its private files |
| `supabase/migrations/0003_general_english.sql` | The learning goal and the A1 level |
| `supabase/migrations/0004_release_0_5_0.sql` | The 0.5.0 release notes |
| `supabase/migrations/0005_release_0_6_0.sql` | Coach chats, and the 0.6.0 release notes |
| `supabase/migrations/0006_release_0_7_0.sql` | Profile banners, friends' profiles, and the 0.7.0 release notes |
| `supabase/migrations/0007_account_ai_keys.sql` | AI keys saved to your account, sealed with your password |
| `supabase/migrations/0008_release_0_8_0.sql` | The 0.8.0 release notes |
| `supabase/migrations/0009_feedback.sql` | Feedback from the account |
| `supabase/migrations/0010_release_0_9_0.sql` | The 0.9.0 release notes |
| `supabase/migrations/0011_release_1_0_0.sql` | The name of the exam, and the 1.0.0 release notes |
| `supabase/migrations/0012_release_1_1_0.sql` | The 1.1.0 release notes |
| `supabase/migrations/0013_coach_modes.sql` | The coach's modes, and longer coach messages |
| `supabase/migrations/0014_release_1_2_0.sql` | The 1.2.0 release notes |
| `supabase/migrations/0015_exam_paused.sql` | Pausing the exam |
| `supabase/migrations/0016_release_1_3_0.sql` | The 1.3.0 release notes |
| `supabase/migrations/0017_feedback_limit.sql` | One feedback message an hour |
| `supabase/migrations/0018_release_1_4_0.sql` | The 1.4.0 release notes |
| `supabase/migrations/0019_release_1_4_3.sql` | The 1.4.1, 1.4.2 and 1.4.3 release notes |
| `supabase/migrations/0020_v2_schema.sql` | The look you chose, and the XP of each practice run (2.0.0) |
| `supabase/migrations/0021_v2_league.sql` | The weekly league with your friends (2.0.0) |
| `supabase/migrations/0022_v2_decks.sql` | Decks and flashcards (2.0.0) |
| `supabase/migrations/0023_release_2_0_0.sql` | The 2.0.0 release notes |
| `supabase/migrations/0024_release_2_1_0.sql` | The 2.1.0 release notes |

The coach needs `0013` before it shows the chat list. Version 2.0.0 needs `0020` to `0023`, in that order: they add the look, the XP, the league, the decks and the 2.0.0 release notes. Version 2.1.0 needs `0024`, which adds its release notes.

3. In **Authentication**, keep email confirmation on, and set the Site URL and the redirect URLs for the app.
4. Never put a service-role or secret key into the app. Only the publishable key goes in.

## Release notes and banners

In the Supabase Table Editor, add rows to `announcements`:

- **A release note.** Set `kind` to `release_note`, add a `version`, a `title` and a `body`. Put one feature per line, each starting with `- `, and set `published` to true.
- **A banner.** Set `kind` to `banner`, add a `title` and a short `body`, pick an `accent` (`blue`, `teal`, `amber` or `ink`), and optionally add a picture (`image_url`) and a button (`cta_label` and `cta_url`). The button can open a page in the app, like `/play/diagnostic`, or any `https://` link.

People on this device see the release notes and banners bundled in `src/content/announcements.ts`.

## Where your data lives

- **On this device.** Your progress, your decks and cards, your picture, and your library files and links are kept in a small database (`danna.db`) in the app's data folder. Nothing is sent anywhere.
- **Sign-in.** The session is saved in `danna-session.bin`, encrypted by Windows, so only this app and this Windows user can read it.
- **Online.** Your account lives in Supabase, and each person can only see their own rows. Friends see the results and sets you share with them, for as long as you stay friends. Your picture, your banner and your library files are private: friends can see your picture and banner, but never your files. Your decks and cards are private too. Feedback you send is kept in the database, where only the project owner can read it.
- **AI keys.** On your device, Windows encrypts each key, and only the app's main process can use it. With an online account, each key is also saved to your account, sealed with your password. The database only ever sees scrambled text, so you add a key once. When the tutor reads your files, it sends only the parts you picked, to the provider you connected.

## How it's kept safe

- The desktop window runs sandboxed, with no direct access to Node, and it only opens `https` links.
- The app can only talk to its own project address, and a content security policy limits what images, scripts and frames can load.
- The packaged app turns off the Electron features that would let code run from outside, or be debugged from the command line.
- Friend requests can't be forged or accepted for someone else. Your XP never goes down online.
- Everyone has limits on how much they can store, so one account can't fill the database. For example, the library allows 300 files of up to 20 MB each, and 2,000 links.
- XP and streaks are worked out on your device. The database stops them from going down, but it can't check how you earned them.
- Keys saved to an account are sealed before they leave your device. A password reset from the email link can't open them, so you'll add those keys again once.

## Project structure

```
brand/         The master logo and app icon, and the platform logos (brand/platforms)
docs/          Screenshots, the tour GIF and these notes
electron/      The desktop shell: window, tray, offline database, sign-in, AI keys and providers
scripts/       Logo, icon and installer art, plus the version bump and the release
src/           The interface (React and TypeScript)
  assets/      Logo, icon and platform logos
  components/  Title bar, shared pieces, file viewer, tutor, charts, question renderer
  content/     Lessons for A1 to C1 and the TOEFL warm-up (units/), passages, tests and release notes
  lib/         Scoring, grading, review, AI prompts, data backends, progress copying, library and platforms
  screens/     One file per screen
  state/       Auth, AI, app data and toasts
  styles/      The two looks: Classic in the app styles, and Playful in playful.css
supabase/      The database schema, the migrations for existing projects, and the database tests
tests/         Tests for lessons, copying, the library, platforms and AI providers
```

## Limits in this version

- TOEFL scores are estimates for practice, not official scores.
- Speaking answers are transcribed with an OpenAI key. Without one, you rate your own answer.
- The tutor needs an AI key. A scanned PDF has no text until it's converted with OCR.
- Platform logos come from the open Simple Icons set. Some platforms (Alura, BBC Learning English, Cambridge and ETS) don't have an open logo yet, so they show their first letter.
- Tap to define works in text and Markdown files. PDF pages are pictures, so their words can't be tapped. Save a PDF's text as a Markdown file to tap its words.
- The writing check and tap to define give their full answers with an AI key. Without one, the basics are checked on the device, and you type the meaning of a word yourself.
- The weekly league shows your friends with an online account. It counts the XP earned from 2.0.0 on.
- A role-play summary is scored from the coach's reply when the reply follows the format the app reads. A reply that leaves the format out still shows, but it isn't scored.
- Google sign-in isn't included yet.

## Versions and releases

Each commit adds 1 to the patch number, automatically, with a pre-commit hook in `.husky/`. When you start a new feature release, run `npm run bump -- minor` and commit it. A version you set by hand in a commit stays as it is.

To publish the current version: push the commit, run `npm run dist` to build the installer, and then run `npm run release`. The release is named after the version (tag `v<version>`), and the commit messages since the last release become its notes.
