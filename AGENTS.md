# AGENTS.md

Guidance for coding agents working on the danna desktop app in this repository. README.md is for people; this file is for agents. The landing page is a separate repository and is not part of this one.

## What this is

danna is an English learning app for Windows: a roadmap from A1 to C1, an optional TOEFL warm-up, decks with spaced repetition, a writing check and an AI coach. It is an Electron 45 shell around a React 19 and TypeScript interface built with Vite 8. Data lives on the device (SQLite through `node:sqlite`) or in an optional Supabase account. AI features use the learner's own provider key.

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
- `npm run icons`, `npm run logos`, `npm run installer-art`, `npm run art`, `npm run avatars` and `npm run bump -- minor|major`: see Generated files and Git and releases.

There is no CI. Run the checks yourself.

## Layout

- `electron/`: the desktop process. Window, tray, IPC, the local database, AI keys and providers, speech and updates.
- `src/`: the React interface. `screens/` has one file per screen, `components/` the shared pieces, `state/` the providers, `lib/` the rules and backends, `content/` the lessons, tests and announcements, and `styles/` the two looks.
- `src/lib/data/`: the `DataBackend` contract and its three implementations (see Architecture).
- `supabase/`: `schema.sql` for fresh projects, `migrations/` for existing ones, and `tests/policies.test.mjs`.
- `tests/`: 69 node:test suites. Many load TypeScript through Vite's `createServer` and `ssrLoadModule`. Some render components to markup with `react-dom/server`.
- `brand/`: the master images. `build/`, `electron/assets/`, `public/favicon.webp` and `src/assets/` hold generated copies.
- `docs/`: screenshots, the tour GIF, and the 2.0.0 design (`docs/v2/DESIGN.md`) and plan (`docs/v2/PLAN.md`).
- `website/`: git-ignored. It is a separate repository (emireln/danna-website) cloned into this folder. Never commit it to this repository.

## Architecture

- There are two modes, `local` (this device) and `supabase` (an online account). `src/lib/session.ts` picks the backend, and the mode is stored in localStorage as `danna.mode`.
- The renderer reads and writes data only through `DataBackend` (`src/lib/data/backend.ts`):
  - `src/lib/data/supabaseBackend.ts` talks to the online account.
  - `src/lib/data/sqliteBackend.ts` is the desktop database. It goes through `window.danna.local.call` to `electron/localdb.cjs`, which keeps `danna.db` in the app data folder.
  - `src/lib/data/localBackend.ts` keeps data in browser storage, for `npm run web`.
- The renderer reaches the main process only through `window.danna`. `electron/preload.cjs` exposes it, and `src/lib/bridge.ts` types it. The handlers are in `electron/main.cjs`, and every handler checks the sender.
- AI keys are stored with Electron `safeStorage` (`electron/keystore.cjs`), and every provider request is made in `electron/ai.cjs`. A key crosses into the renderer only to be sealed for an account (`keys:export` and `keys:import`).
- Speech: `electron/speech-service.cjs` chooses between the built-in Kokoro voice (`electron/kokoro.cjs`), a Windows voice (`electron/winvoices.cjs`) and a cloud voice.
- Talk live (`/coach/live`): `electron/live.cjs` holds the Gemini Live session, and the renderer's `src/lib/live/` holds the microphone, the voice player and the conversation. `src/avatar/` draws the three characters with three.js, loaded only on that screen. See `docs/live-coach.md`.
- The look is `classic` (the default) or `playful`. It is saved on the profile (`ui_style`), or on the device when there is no account. `src/state/look.tsx` sets `data-look` on `<html>`. Before the profile loads, the page is Classic.
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
- For a schema change, add the next numbered file in `supabase/migrations/` (each one is safe to run twice) and keep `supabase/schema.sql` in step, so a fresh project gets the same schema. Desktop tables are created and upgraded in `electron/localdb.cjs`.
- For a new IPC channel, update `electron/main.cjs`, `electron/preload.cjs` and `src/lib/bridge.ts` together.
- Styles: the Classic tokens and rules are in `src/styles/app.css`, and the Playful ones in `src/styles/playful.css`. `src/styles/frame.css` holds the window frame, the title bar and the welcome screens, `src/styles/system.css` the shared screen pieces, and the other files one feature each.

## Generated files

Edit the masters, then run the script. Do not hand-edit the outputs.

- `brand/icon.png` and `brand/tray-icon.png`: `npm run icons` writes `build/icon.*`, `electron/assets/*.png`, `src/assets/icon.webp` and `public/favicon.webp`.
- `brand/banner.png`: `npm run installer-art` writes `build/installerSidebar.bmp` and `build/uninstallerSidebar.bmp`.
- `brand/logo.png` and `brand/platforms/`: `npm run logos` writes the platform logos. `npm run art` runs the icon, logo and installer builders together.
- `src/assets/avatars/`: `npm run avatars` fetches DiceBear avatars and needs the network. It accepts only CC0 styles.

## Data, secrets and what not to commit

- `.env.development` and `.env.production` hold only public values: the project URL and the publishable key. Never add a service-role or secret key to the app, and never commit `.env.local`.
- Never commit `node_modules/`, `dist/`, `release/`, `resources/tts/` (it is fetched and about 100 MB), `danna.db` or `website/`.
- Never log an AI key. Keys cross into the renderer only in the account sealing path (`keys:export` and `keys:import`).
- Pictures that people upload are converted to WebP in the app (`prepareAvatar` and `prepareBanner`). The built-in avatars are already WebP, and nothing converts them at runtime.

## Git and releases

- Work lands on `main`. A short-lived branch is fine, but fast-forward `main`, push it, and delete the branch. Do not leave other branches behind.
- Each commit bumps the patch version. `.husky/pre-commit` runs `scripts/bump-version.mjs`, which stages `package.json` and `package-lock.json`. For a feature release, run `npm run bump -- minor` and commit the result. A version written by hand in a commit is kept.
- Commit messages use `type(scope): summary` in lowercase, for example `fix(gaps): keep the spaces of a phrase`. Put the reason in the body when it is not obvious.
- `npm run release` publishes `vX.Y.Z` from a commit that is already on `origin/main`. It needs a clean working tree and an authenticated `gh`. The release notes are the commit subjects since the previous tag. The in-app release notes are in `src/content/announcements.ts`.

## Before you finish

- Run `npm test` and `npm run typecheck`. Run `npm run build` too if you changed Electron, styles or assets.
- For interface changes, check the screen in `npm run web`. Check desktop-only parts in `npm run dev`.
- Say what you could not verify.
