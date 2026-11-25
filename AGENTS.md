# AGENTS.md

Guidance for coding agents working on the Danna desktop app in this repository. README.md is for people; this file is for agents. Read the Repositories section first: Danna is three repositories. Botdanna and the website are kept inside this folder, but they are not part of this one.

## What this is

Danna is an English learning app for Windows: a roadmap from A1 to C1, an optional TOEFL warm-up, decks with spaced repetition, a writing check and an AI coach. It is an Electron 45 shell around a React 19 and TypeScript interface built with Vite 8. Data lives on the device (SQLite through `node:sqlite`) or in an optional Supabase account. AI features use the learner's own provider key.

## Repositories

- **This repository, `emireln/danna`** (public, branch `main`): the desktop app, at the root of this folder. Every commit bumps the patch version (see Git and releases).
- **`botdanna/`, `emireln/botdanna`** (public, branch `main`): the AI English coach app. It is its own repository, kept in this folder and git-ignored here, so it is never committed in this repository. It shares this repository's accounts, database and `supabase/` folder, which is byte-identical in both.
- **`website/`, `emireln/danna-website`** (private, branch `main`): the landing page at danna.run, and the hub and the account pages at hub.danna.run. It is git-ignored here. Commit and push it in its own folder; Vercel deploys its `main` branch. It has no version number.
- **The design** of all three is in `website/DESIGN.md`: the brand, the tokens, the pages, the Classic look of both apps, the brand images and the repositories. Read it before any visible change. If the `website/` folder is not here, read that file from `emireln/danna-website`.
- **Shared rules.** The vault string `danna-ai-key:<provider>` (`src/lib/vault.ts`) is shared with Botdanna: changing it stops the AI keys saved by the other app from opening. `supabase/` must stay identical in both apps.

## Commands

- `npm ci` or `npm install`: install dependencies. Installing sets up the git hooks (husky), so run it inside the git checkout.
- `npm run dev`: the desktop app with hot reload (Vite on port 5173, plus Electron).
- `npm run web`: the interface in a browser on port 5173. Desktop-only features are missing there: AI keys, the tray, library files, updates and the built-in and Windows voices. Data is kept in browser storage.
- `npm run build`: typecheck, then the production build into `dist/`. `npm start` opens that build, so build first.
- `npm test`: every test, using node:test. `npm run test:sync` runs the progress-copy tests and `npm run test:db` the database policy tests.
- `DANNA_GEMINI_KEY=<key> node --test tests/live-smoke.test.mjs`: one live talk against the real Gemini Live service. It is skipped without the variable. Never write the key to a file or to the repository.
- `npm run typecheck`: TypeScript without emitting files.
- `npm run dist`: the Windows installer in `release/`. It fetches the built-in voice first (`tts:fetch`). Delete an older `release/` folder before building.
- `npm run release`: publishes the installer as a GitHub release for the current version. See Git and releases.
- `npm run brand`, `npm run icons`, `npm run installer-art`, `npm run logos`, `npm run art`, `npm run avatars` and `npm run bump -- minor|major`: see Generated files and Git and releases.

There is no CI. Run the checks yourself.

## Layout

- `electron/`: the desktop process. Window, tray, IPC, the local database, AI keys and providers, speech and updates.
- `src/`: the React interface. `screens/` has one file per screen, `components/` the shared pieces, `state/` the providers, `lib/` the rules and backends, `content/` the lessons, tests and announcements, and `styles/` the two looks.
- `src/lib/data/`: the `DataBackend` contract and its three implementations (see Architecture).
- `supabase/`: `schema.sql` for fresh projects, `migrations/` for existing ones, and `tests/policies.test.mjs`. It is identical in Botdanna.
- `tests/`: 69 node:test suites. Many load TypeScript through Vite's `createServer` and `ssrLoadModule`. Some render components to markup with `react-dom/server`.
- `brand/`: the brand masters: `icon.png` and `logo.png` (from the designer), and `tray-icon.png` and `banner.png` (made from the logo by `npm run brand`). `build/`, `electron/assets/`, `public/favicon.webp` and `src/assets/` hold generated copies.
- `scripts/`: the build helpers: `make-brand.mjs`, `make-icons.mjs`, `make-installer-art.mjs`, `make-platform-logos.mjs`, `make-avatars.mjs`, `fetch-tts-model.mjs`, `bump-version.mjs` and `release.mjs`.
- `docs/`: screenshots, the tour GIF, the 2.0.0 design (`docs/v2/DESIGN.md`, whose section 3 holds the Playful tokens) and plan (`docs/v2/PLAN.md`), and the live coach design (`docs/live-coach.md`).
- `website/`: git-ignored. It is a separate repository (`emireln/danna-website`) cloned into this folder. Never commit it to this repository.
- `botdanna/`: git-ignored. It is a separate repository (`emireln/botdanna`). Never commit it to this repository.

## Architecture

- There are two modes, `local` (this device) and `supabase` (an online account). `src/lib/session.ts` picks the backend, and the mode is stored in localStorage as `danna.mode`.
- The renderer reads and writes data only through `DataBackend` (`src/lib/data/backend.ts`):
  - `src/lib/data/supabaseBackend.ts` talks to the online account.
  - `src/lib/data/sqliteBackend.ts` is the desktop database. It goes through `window.danna.local.call` to `electron/localdb.cjs`, which keeps `danna.db` in the app data folder.
  - `src/lib/data/localBackend.ts` keeps data in browser storage, for `npm run web`.
- The renderer reaches the main process only through `window.danna`. `electron/preload.cjs` exposes it, and `src/lib/bridge.ts` types it. The handlers are in `electron/main.cjs`, and every handler checks the sender.
- AI keys are stored with Electron `safeStorage` (`electron/keystore.cjs`), and every provider request is made in `electron/ai.cjs`. A key crosses into the renderer only to be sealed for an account (`keys:export` and `keys:import`).
- Google sign-in: the sign-in page opens in the browser through `auth:open-sign-in`, which opens only the project's Supabase Google page. The hub's `/app-danna` page sends the browser back to `danna://auth-callback` with the session in the address, and `electron/main.cjs` takes it only after a sign-in this app started (`electron/authLink.cjs`). `src/state/auth.tsx` sets the session. A Google account has no password, so the AI keys sealed with the password do not open on that sign-in.
- Speech: `electron/speech-service.cjs` chooses between the built-in Kokoro voice (`electron/kokoro.cjs`), a Windows voice (`electron/winvoices.cjs`) and a cloud voice.
- Talk live (`/coach/live`, switched off by `LIVE_TALK_ENABLED` in `src/lib/features.ts`): `electron/live.cjs` holds the Gemini Live session, and the renderer's `src/lib/live/` holds the microphone, the coach's voice (`voice.ts`, with the word timing in `wordTiming.ts`) and the conversation. `src/avatar/` mounts the coach with TalkingHead (MIT, `@met4citizen/talkinghead`), loaded only on that screen; its lip-sync modules are served from `public/talkinghead/`. The coach is a real person model in `public/characters/` (credits in `CREDITS.md`). See `docs/live-coach.md`.
- The look is `classic` (the default) or `playful`. It is saved on the profile (`ui_style`), or on the device when there is no account. `src/state/look.tsx` sets `data-look` on `<html>`. Before the profile loads, the page is Classic.
- The window frame, the title bar and the wordmark are in `src/styles/frame.css`. The wordmark uses the display face (see Conventions).
- Rules live in `src/lib`: grading (`src/lib/grading.ts`), scoring (`src/lib/scoring.ts`), review and flashcards (`src/lib/srs.ts`), the roadmap (`src/lib/roadmap.ts`), the coach and the writing check. Screens stay thin.

## Rules the tests enforce

- Every string passed to `t()` or `tn()` needs a Portuguese entry in `src/lib/i18n/pt/`, with the same `{placeholders}` (`tests/i18n.test.mjs`).
- Every static `className` in a screen needs a CSS rule. Screens use no hex colours, except the data screens listed in `tests/ui-consistency.test.mjs`.
- Playful rules sit under `:root[data-look='playful']`, and the listed Playful text pairs meet 4.5 to 1 (`tests/look-contrast.test.mjs`).
- Lessons and tests in `src/content` are well formed, and their ids are unique (`tests/content.test.mjs`).
- The two offline backends must give the same answers (`tests/data-parity.test.mjs`).

## Conventions

- The English text is the translation key. Write `t('Some text')`, and do not invent keys.
- Components are PascalCase files. Library modules are camelCase. Tests are `*.test.mjs`.
- TypeScript is strict, with `noUnusedLocals` and `noUnusedParameters`.
- Source files are stored with LF line endings.
- A new `DataBackend` method goes into all three backends. On the desktop it also needs a handler in `electron/localdb.cjs`, and the parity test should cover it.
- The limits shared by the desktop and online databases must change together, in `electron/localdb.cjs` and `src/lib/data/rules.ts`. The code comments say so.
- For a schema change, add the next numbered file in `supabase/migrations/` (each one is safe to run twice) and keep `supabase/schema.sql` in step, so a fresh project gets the same schema. Desktop tables are created and upgraded in `electron/localdb.cjs`. Botdanna uses the same database, so make the change in both apps.
- For a new IPC channel, update `electron/main.cjs`, `electron/preload.cjs` and `src/lib/bridge.ts` together.
- Styles: the Classic tokens and rules are in `src/styles/app.css`, and the Playful ones in `src/styles/playful.css`. `src/styles/design.css` holds the Classic overrides of the website's design. `src/styles/frame.css` holds the window frame, the title bar, the wordmark and the welcome screens, `src/styles/system.css` the shared screen pieces, and the other files one feature each. Use a token for every colour; a shared gradient takes its colours from tokens, so each look keeps its own.
- **The name.** Danna and Botdanna have only their first letter in capitals in every visible text: menus, messages, the title bar, the tray, the installer and the shortcuts, the release titles and the notes, the page titles. Never all capitals. Technical names stay lowercase, because the code reads them: storage keys (`danna.*`), file names (`danna.db`, `danna-session.bin`, `danna-settings.json`, `danna-ai.json`), hosts and URLs (`danna.run`, `hub.danna.run`, `emireln/danna`), the custom protocol (`app://danna`), the identifiers (`app.danna.desktop`, the npm name `danna`), `window.danna`, event names (`danna:language`), the vault string, and notification tags. A new visible string uses Danna; a new key or file name does not.
- **The wordmark.** The wordmark and the hero use the display face: Unbounded at weight 800 with tracking -0.02em (`.wordmark` and `.wordmark--xl` in `src/styles/frame.css`, and `.wordmark` on the website). Do not set the name in another face.

## Generated files and brand images

The masters are `brand/icon.png` and `brand/logo.png`, which come from the designer. `brand/tray-icon.png` and `brand/banner.png` are made from the logo. Edit the masters, then run the script; do not hand-edit an output.

- `npm run brand`: writes `brand/tray-icon.png` (the logo, trimmed and centred at 88% of a 512 px square, in its own colours) and `brand/banner.png` (492 × 942 px: the accent colour, the logo in white centred at 70% of the width, nothing else). The accent is set in `scripts/make-brand.mjs` (`#5236d1` for Danna).
- `npm run icons`: writes `build/icon.png`, `build/icon.ico`, `electron/assets/icon.png`, `electron/assets/tray.png` and `tray@2x.png`, `src/assets/icon.webp`, `src/assets/logo.webp` and `public/favicon.webp`.
- `npm run installer-art`: writes `build/installerSidebar.bmp` and `build/uninstallerSidebar.bmp` from `brand/banner.png`.
- `npm run logos`: writes the platform logos from `brand/platforms/` into `src/assets/platforms/`. Until a platform has its logo, the Library shows a monogram.
- `npm run avatars`: fetches DiceBear avatars into `src/assets/avatars/`. It needs the network and accepts only CC0 styles.
- `npm run art` runs `brand`, `icons`, `logos` and `installer-art` together.

**A new icon or logo** arrives as files in `public/` (for example `icon-v5.png` and `logo-v5.png`). Copy them to `brand/icon.png` and `brand/logo.png`, run `npm run art`, delete the copies from `public/`, and copy the new icon to the website's `assets/` (see `website/DESIGN.md`). Remove the old icon, logo and banner files rather than keeping them beside the new ones. A stray file in `public/` blocks the release, because the release needs a clean tree.

## Data, secrets and what not to commit

- `.env.development` and `.env.production` hold only public values: the project URL and the publishable key. Never add a service-role or secret key to the app, and never commit `.env.local`.
- Never commit `node_modules/`, `dist/`, `release/`, `resources/tts/` (it is fetched and about 100 MB), `danna.db`, `botdanna/` or `website/`.
- Never log an AI key. Keys cross into the renderer only in the account sealing path (`keys:export` and `keys:import`).
- Pictures that people upload are converted to WebP in the app (`prepareAvatar` and `prepareBanner`). The built-in avatars are already WebP, and nothing converts them at runtime.

## Git and releases

- Work lands on `main`. A short-lived branch is fine, but fast-forward `main`, push it, and delete the branch. Do not leave other branches behind.
- Each commit bumps the patch version. `.husky/pre-commit` runs `scripts/bump-version.mjs`, which stages `package.json` and `package-lock.json`. For a feature release, run `npm run bump -- minor` and commit the result. A version written by hand in a commit is kept.
- Commit messages use `type(scope): summary` in lowercase, for example `fix(gaps): keep the spaces of a phrase`. Put the reason in the body when it is not obvious. The name in a subject is written Danna.
- **A release, in order.** Commit and push `main`. Then `rm -rf release` (the old installer), `npm run dist` (about 10 minutes: it fetches the voice, builds and packages the installer), and `npm run release`. `npm run release` publishes `vX.Y.Z` on `emireln/danna` from HEAD: HEAD must already be on `origin/main`, and the tree must be clean. It uploads the installer, its blockmap and `latest.yml`, which the auto-update reads. The release is titled `Danna X.Y.Z`; its notes are the commit subjects since the previous tag. Check it with `gh release view vX.Y.Z --repo emireln/danna`.
- `npm run release` needs an authenticated `gh`. The in-app release notes are in `src/content/announcements.ts`.

## Before you finish

- Run `npm test` and `npm run typecheck`. Run `npm run build` too if you changed Electron, styles or assets.
- For interface changes, check the screen in `npm run web`. Check desktop-only parts in `npm run dev`.
- If the design changes (a token, a font, a page, a brand image or a repository), update `website/DESIGN.md`.
- Say what you could not verify.
