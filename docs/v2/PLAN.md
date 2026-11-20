# danna 2.0.0: plan

Status: in progress. The live checklist is in section 11. This file is the source of truth for scope, decisions and acceptance criteria. Update it when a decision changes.

## 1. Goal

danna becomes the most complete English-learning app on the desktop. It keeps its structured roadmap, lessons and AI coach, and adds the strongest ideas from six apps (section 2). Users choose one of two looks in Settings:

- **Classic**: the current professional look. It stays as it is.
- **Playful**: a new look with chunky 3D buttons, bright colours and gamification (daily goal, quests, league, achievements).

The chosen look is saved to the account in the cloud, or to the device when the app is used without an account.

Release: **2.0.0**, labelled **Beta** in the title bar. The version is set to 2.0.0 in the release commit (see section 9).

## 2. Research: what we take from each app

Sources were searched on 2026-11-20. The results were search snippets and public descriptions, not hands-on use, so feature claims are approximate. Pricing and plan names were left out on purpose.

| Reference | What we take | Where it lives in danna 2.0 |
| --- | --- | --- |
| Anki ([Anki manual, deck options](https://docs.ankiweb.net/deck-options.html); [Anki on Wikipedia](https://en.wikipedia.org/wiki/Anki_(software))) | Decks of cards, spaced repetition, four grades (Again, Hard, Good, Easy) that set the next interval | Decks and study sessions (F7) |
| Grammarly ([tone suggestions](https://support.grammarly.com/hc/en-us/articles/10674801783309-How-do-Grammarly-s-tone-suggestions-work); [tone detector design](https://builtin.com/articles/grammarly-tone-detector-design)) | Suggestions with a category, a reason and a rewrite; a tone label; sorted by impact | Writing check (F8) |
| Duolingo ([gamification analysis](https://www.deconstructoroffun.com/blog/2025/4/14/duolingo-how-the-15b-app-uses-gaming-principles-to-supercharge-dau-growth); [Duolingo 101](https://blog.duolingo.com/duolingo-101-how-to-learn-a-language-on-duolingo)) | Streaks, XP, daily goals, quests, weekly leagues in cohorts, badges, chunky 3D buttons, celebrations | Playful look (F1, F2); Today goal and quests (F4); league (F5); achievements (F6) |
| FluentU ([FluentU](https://fluentu.com/)) | Real content with words you can tap for a meaning and an example; saved words are reviewed with spaced repetition | Tap-to-define in the library reader, saved to a deck (F9) |
| "Fluency" apps ([Fluency Drop](https://apps.apple.com/app/fluency-drop/id6745232382); [Superfluent](https://apps.apple.com/app/id6471920464); [Fluently](https://apps.apple.com/app/id6445847787)) | Immediate spoken feedback; a single fluency score. No app named exactly "Fluency" was found, so these three were used as the reference. | Speaking feedback in the coach (existing) and a fluency score in role-play summaries (F10) |
| Talkpal ([review](https://www.unite.ai/talkpal-review/); [App Store](https://apps.apple.com/us/app/talkpal-ai/id6468219825)) | Scenario-based conversations with an AI partner, voice replies, a call-style mode, pronunciation notes | Role-play scenarios in the coach (F10) |

What we deliberately do not copy: brand names, logos, mascots, exact colour palettes, and copyrighted lesson text. The Playful look uses its own palette and its own shapes. Its "3D" buttons are a common interface pattern, not a copy of any product.

## 3. Scope of 2.0.0

**Must (release blockers):** F1, F2, F3, F4, F5, F6, F7, F11, F12.

**Should:** F8, F9, F10. If one of them is not finished to the standard in section 8, it moves to 2.1 and the release notes say so. It is never shipped half-done.

**Could (after 2.0.0):** a mascot, sounds, streak freezes, shared decks between accounts, FSRS scheduling, on-device speech scoring.

## 4. Features and acceptance criteria

**F1. Two looks, chosen in Settings.** Settings gets a "Look" section with two cards: Classic and Playful. The choice is stored in `profile.ui_style` (values `classic` or `playful`, default `classic`).
- Signed in: saved to the account in Supabase. It follows the account to other devices.
- Without an account: saved to the device profile (SQLite on desktop, browser store in the preview).
- Applied at once. The root element gets `data-look="classic"` or `data-look="playful"`.
- Accept: the choice survives a restart on both backends; the parity test and the policy tests pass.

**F2. Playful design system.** Tokens, 3D buttons, cards, navigation and motion, as specified in [DESIGN.md](DESIGN.md). Every screen must look right in both looks at 960 by 540 and at 1280 by 720.
- Accept: the contrast test passes for every text pair; no screen loses a control in either look.

**F3. Beta badge in the title bar.** A small square tag reading "Beta" (uppercase, 4 px radius, not a pill) sits beside the "danna" wordmark, in both looks.

**F4. Today: daily goal and quests.**
- A daily goal ring shows minutes practised today against `profile.daily_minutes`. Minutes come from the attempts of today (`duration_s`).
- Three daily quests, computed from today's data: finish one lesson or test; study 10 flashcards (from F7); practise for 5 minutes. A quest is done when its count is reached. Quests give no XP in 2.0, so the league stays a clean measure of practice.
- Accept: the numbers match the attempts of the day in both backends; the pure functions are unit-tested in `lib/quests.ts`.

**F5. Weekly league.**
- Each run stores the XP it earned in a new column `attempts.xp` (cloud and device). The league counts XP from 2.0.0 onward. XP earned before 2.0.0 stays in the total.
- Signed in: a ranking of you and your accepted friends for the last seven days. A `security definer` function returns only one aggregate row per person (name, picture, week XP), never their attempts.
- Without an account: your own last seven days as a bar chart, and a note that friends need an online account.
- Tiers from Bronze to Diamond, set by week XP, computed in `lib/league.ts`.
- Accept: the friends function returns no rows for strangers and for pending friends (policy test).

**F6. Achievements.** Ten badges computed from existing data, shown on the profile in both looks: first lesson, 7-day streak, 30-day streak, 1000 XP, 25 lessons, first deck, 100 flashcards studied, 5 writing checks, 10 saved words, 3 role-play scenarios. Locked badges show what is needed. Computed in `lib/achievements.ts`.

**F7. Decks and spaced repetition (Anki-like).**
- Decks with a title, a description and a colour. Cards with a front, a back and an optional note.
- Study session: the due cards first, then up to 10 new cards. Show the front, reveal the back, grade with Again, Hard, Good or Easy (keys 1 to 4). Each button shows the next interval before it is pressed.
- Scheduling is the existing SM-2 style engine in `lib/srs.ts`, extended with a four-grade function `gradeCard`. Intervals: Again returns the card in 10 minutes; Hard, Good and Easy grow the interval by 1.2, ease and 1.3 times ease.
- A session ends in a summary. The session is saved as an attempt (kind `practice`, ref `flashcards`, its XP and its duration), so it counts in the profile and the league.
- Import: paste lines of `front; back` (or a tab). Up to 500 lines per import.
- Limits (cloud): 100 decks per account, 5000 cards per account, field lengths checked in the database.
- Accept: CRUD and grading behave the same in both offline backends (parity test); the policies test shows that other users cannot read or write a deck.

**F8. Writing check (Grammarly-like).**
- A writing page with a text box (up to 1500 words), a word count and a "Check my writing" button.
- With the user's AI key: the model returns JSON with issues (start, end, category, reason in the user's language, a suggested replacement) and an overall score and tone. The response is validated; an invalid response shows a clear message and is never shown raw.
- Without a key: basic local checks (repeated words, a lowercase "i", a missing capital after a full stop, double spaces, common misspellings, missing apostrophes in contractions).
- Actions: accept a suggestion (it replaces the text), ignore it, or add the correction to a deck.
- Accept: the parser and the local checks have unit tests with valid, invalid and adversarial responses.

**F9. Tap to define (FluentU-like).** In the library text reader, a tapped word opens a card with its meaning and the sentence it came from. With an AI key the meaning comes from the model. Without a key the card shows the sentence and lets you type the meaning. "Save word" adds the word to a deck called "Saved words", with the sentence as its note. Accept: the card works offline with no key; the saved word appears in the deck.

**F10. Role-play scenarios (Talkpal-like).** The coach gets a role-play mode with twelve scenarios (for example ordering at a café, a job interview, airport check-in, a doctor's visit, asking for directions, a complaint at a shop). A scenario is a chat with mode `roleplay-<id>`, which the existing mode format allows. The coach plays a character, gives one goal to the learner, and at the end a summary gives a fluency score, the main mistakes and the new words. Voice works where the existing voice tools work. Accept: every scenario has an English and a Portuguese title, a goal and a character; the catalogue test checks them.

**F11. Release 2.0.0.** Release notes in the app (bundled, and migration `0023_release_2_0_0.sql`), the README, this plan, the design file and the migrations table are updated. Screenshots of both looks are added to the README.

**F12. Portuguese (Brazil) for everything.** Every new string has a Portuguese translation. A test scans the source for every `t('...')` and fails on a missing translation, so this cannot be forgotten.

## 5. Data model

Cloud (`supabase/migrations/0020_v2_schema.sql`, also appended to `supabase/schema.sql`):
- `profiles.ui_style text not null default 'classic'`, checked to be `classic` or `playful`. A column grant lets the owner update it.
- `attempts.xp int not null default 0`, checked to be zero or more. Existing rows keep 0.
- `decks` (id, owner, title, description, colour, created and updated times). `cards` (id, deck, owner, front, back, note, state `new`, `learning` or `review`, ease, interval days, reps, lapses, due time, last review time, created and updated times). Both have owner-only row security, touch triggers, and the limits in F7.
- `friends_week_xp(days int)`: a `security definer` function returning one row per accepted friend and one for the caller. Columns: user id, display name, username, colour, picture path, week XP.

Device (`electron/localdb.cjs`, guarded `ALTER TABLE` like the earlier upgrades): the same profile column, the same `attempts.xp` column, and the `decks` and `cards` tables. The browser preview keeps the same shapes in its store.

Migration files, in order: `0020_v2_schema.sql` (the look and the XP of each run), `0021_v2_league.sql` (the `friends_week_xp` function), `0022_v2_decks.sql` (decks and cards), and `0023_release_2_0_0.sql` (the release notes). Each one is safe to run again. The release notes use the same upsert pattern as 0018 and 0019.

No new coach table: chat modes are free text matched by `^[a-z-]{1,40}$`, so `roleplay-cafe` is valid.

## 6. Backend contract (`DataBackend`)

New or changed methods, implemented in all three backends (`sqliteBackend`, `localBackend`, `supabaseBackend`) and covered by the parity and contract tests:
- `updateProfile` accepts `ui_style`.
- `insertAttempt` accepts `xp`.
- `listDecks`, `createDeck`, `updateDeck`, `deleteDeck`.
- `listCards(deckId?)`, `createCards(deckId, rows)` (all or nothing), `updateCard(id, patch)`, `deleteCard(id)`, `listDueCards(now, limit)`.
- `weekLeague(now)`: the caller's XP per day for seven days, and, online only, the friends ranking.

`migrate.ts` (copying progress between device and account) also copies decks and cards, with their ids and times. Its test is extended.

## 7. Architecture

- `state/look.tsx`: a provider that reads `profile.ui_style` and sets `data-look` on the root element. Playful styles live in `src/styles/playful.css`, in a `looks` layer after `app.css`. Classic is the default and has no extra file.
- Pure logic in `src/lib/`: `look.ts`, `quests.ts`, `league.ts`, `achievements.ts`, `deck.ts` (import parsing, grading, intervals), `writingCheck.ts` (prompt, JSON parsing and validation), `writingLocal.ts` (basic checks), `define.ts` (the tap card's logic), `scenarios.ts` (the role-play catalogue).
- Screens: `DecksScreen` (`/decks`), `DeckScreen` (`/decks/:id`), `StudyDeckScreen` (`/decks/:id/study`), `WriteScreen` (`/write`). The study page links from Self study and the title bar search. The role-play picker lives in the coach.
- Components: `DailyGoal`, `QuestList`, `LeagueCard`, `AchievementGrid`, `XpChip`, `BetaTag`, `FlipCard`, `GradeBar`, `Celebrate` (confetti, Playful only), `WordCard` (tap to define).

## 8. Quality bar and tests

Every feature is finished when all of these hold:
1. Typecheck passes, and every existing and new test passes.
2. New pure logic has unit tests, including invalid input.
3. Parity: the desktop and browser backends agree for every new method. The contract test checks the cloud backend against `schema.sql`.
4. Policies (PGlite, `supabase/tests/policies.test.mjs`): owner-only rows for decks and cards, limits, the `ui_style` check and grant, and the friends function.
5. i18n: every new `t('...')` has a Portuguese translation (`tests/i18n-coverage.test.mjs`), and every bundled release note has one too.
6. Contrast: `tests/look-contrast.test.mjs` checks every text and background pair in both looks against WCAG AA.
7. Visual QA in the built-in browser at 960 by 540 for both looks, with screenshots kept under `docs/screenshots/`.
8. Keyboard and screen reader basics: visible focus, labels on icon buttons, progress with values.
9. Reduced motion: the card flip and the celebration respect `prefers-reduced-motion`.

## 9. Release process

- Each commit during the work bumps the patch number through the existing hook. Nothing else changes the version.
- The release commit runs `npm run bump -- major` (1.x becomes 2.0.0) and says so in its message: "chore(release): the release is 2.0.0, with its release note". The hook keeps a version that was set by hand.
- Then: push to `origin/main`, run `npm run dist` (about ten minutes), then `npm run release`. The release notes come from the commits since v1.4.3.
- The owner must run `0020_v2_schema.sql`, `0021_v2_league.sql`, `0022_v2_decks.sql` and `0023_release_2_0_0.sql`, in that order, in the Supabase SQL Editor before the online features work. The app keeps working without them: the look falls back to Classic, and the online-only parts say so.

## 10. Decisions and risks

- **Font:** Nunito for the Playful look, bundled through `@fontsource-variable/nunito` (open-font licence). Classic keeps Inter.
- **AI features need the user's own key** (already the case for the coach). Writing check and tap-to-define each have a complete offline fallback, so the app is useful without a key.
- **League needs an online account** for friends. Without one, the screen shows the personal week and says why.
- **XP history:** the league cannot rank XP that was never stored. It starts in 2.0.0 and says so in the release notes.
- **Portuguese terms:** "Classic" is "Clássico", "Playful" is "Divertido". Decks are "Baralhos", quests "Missões", the league "Liga", achievements "Conquistas", the writing check "Revisão de texto".
- **Trademarks:** no third-party names appear in the UI. This document names them only as sources.
- **Risk: scope.** The work is large. The release is cut only when the must items pass section 8. Should items that are not ready move to 2.1 with a note.

## 11. Milestones and checklist

- [x] M0. Research and the codebase map (this document)
- [x] M1. This plan and the design spec (committed)
- [x] M2. `ui_style` and `attempts.xp` in every backend; migration 0020; parity and policy tests (F1 data)
- [x] M3. Settings "Look" picker; `LookSync`; Classic unchanged (F1 UI)
- [x] M4. Playful design system: tokens, 3D buttons, cards, navigation, font; contrast test (F2). The reference brief from the screenshots (Talkpal, Duolingo, Fluency, FluentU) is in DESIGN.md, section 2. Still to restyle in M16: roadmap nodes, coach bubbles, the score reports and the skill cards.
- [x] M5. Title bar: Beta tag (both looks) and XP chip (Playful), tested (F3)
- [x] M6. Today: daily goal and quests (F4). Quest 2 counts flashcards once M10 saves them.
- [x] M7. League: attempts XP, weekly ranking, friends function, tiers (F5)
- [x] M8. Achievements on the profile (F6). Two of them (first deck, 10 saved words) count once M9 and M10 save decks.
- [x] M9. Decks: data, parity, policies, the four grades and the import (F7 data). Migration 0022.
- [x] M10. Decks: screens, study session, import, summary (F7 UI). The flashcards quest counts from here on.
- [x] M11. Writing check: model check with validated replies, local rules, accept, ignore, save as a card (F8)
- [ ] M12. Tap to define and "Saved words" (F9)
- [ ] M13. Role-play scenarios in the coach (F10)
- [ ] M14. Portuguese coverage test and every translation (F12)
- [ ] M15. Release notes, migration 0021, README, screenshots (F11)
- [ ] M16. QA pass in both looks; fixes
- [ ] M17. Release commit 2.0.0, push, build, publish

## 12. Sources

- Anki manual, deck options: https://docs.ankiweb.net/deck-options.html
- Anki on Wikipedia: https://en.wikipedia.org/wiki/Anki_(software)
- Grammarly, how tone suggestions work: https://support.grammarly.com/hc/en-us/articles/10674801783309-How-do-Grammarly-s-tone-suggestions-work
- Grammarly tone detector design: https://builtin.com/articles/grammarly-tone-detector-design
- Duolingo gamification analysis: https://www.deconstructoroffun.com/blog/2025/4/14/duolingo-how-the-15b-app-uses-gaming-principles-to-supercharge-dau-growth
- Duolingo 101: https://blog.duolingo.com/duolingo-101-how-to-learn-a-language-on-duolingo
- FluentU: https://fluentu.com/
- Fluency Drop: https://apps.apple.com/app/fluency-drop/id6745232382
- Superfluent: https://apps.apple.com/app/id6471920464
- Fluently: https://apps.apple.com/app/id6445847787
- Talkpal review: https://www.unite.ai/talkpal-review/
- Talkpal on the App Store: https://apps.apple.com/us/app/talkpal-ai/id6468219825
