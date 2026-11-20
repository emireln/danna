# danna 2.0.0: look and feel

Two looks share one app. The look changes the colours, shapes, buttons, cards, depth and motion. It never changes the layout rules, the words, or what a control does.

## 1. The two looks

**Classic** is the current look, unchanged in 2.0. Inter, navy ink, one blue accent, hairline borders, 6 to 14 px radii, flat cards.

**Playful** is friendlier and gamified: Nunito, bright colours, chunky 3D controls with a visible bottom edge, rounder shapes, progress everywhere, celebrations, and a friendly voice. It is chosen in Settings and saved to the account.

## 2. Reference brief (from the screenshots, 20 November 2026)

We looked at four reference apps: Talkpal, Duolingo, Fluency and FluentU. This is what each one contributes to Playful, and what we leave out.

| Reference | What we take | What we leave out |
| --- | --- | --- |
| Talkpal | Clean light page; heavy, uppercase display headings; outlined rounded cards for each choice; a bold band with a white button for a call to action; testimonial-style cards with stars | Their logo, their flags as art, their indigo |
| Duolingo (dark web view) | Chunky 3D buttons with a bottom edge; uppercase bold micro labels; a bright header band for the current lesson; round path nodes with check marks and a locked state; header counters for streak, XP and league; a quest card with a progress bar and a chest reward | Their owl and characters, their exact greens and blues, the dark theme (not in 2.0) |
| Fluency | One saturated hero per screen with a mint highlight; a progress strip on the hero; a chip for the percentage done; pill-shaped call to action with an arrow; feature cards in strong colours with a category chip, a big number and a dashed link between steps | Their condensed display font, their photos of people, their pink and purple |
| FluentU | One big 3D call to action with a darker edge; star ratings; a video card with large, high-contrast subtitles and a playback bar | Their logos of video sources, their video |

**What Playful adopts, in order of importance:**

1. **Chunky controls.** Every primary button has a bottom edge and sinks into the page when pressed.
2. **One hero per screen.** The hero is violet, with white text and a mint highlight for the big moment.
3. **Bold, short labels.** Section eyebrows are uppercase, 800 weight, letter-spaced. Headings are 900 weight.
4. **Progress everywhere.** Thick rounded bars; round path nodes for lessons; a chest or badge for each reward.
5. **Counters in the title bar.** Streak, XP and the league tier are always visible.
6. **Rounded cards with thick borders.** Feature cards may be coloured; the rest are white.
7. **Subtitle-style reading.** In the reader (F9), large, high-contrast text, with the tapped word highlighted.
8. **Light by default.** A dark variant is a later option, not part of 2.0.

**What we never copy:** logos, mascots, photos of people, the exact brand colours, a condensed display face, or a copied layout. danna uses its own palette (section 3), Nunito, and avatars or initials for people.

## 3. Tokens (Playful)

Defined on `:root[data-look="playful"]` in `src/styles/playful.css`. The contrast test reads these values from that file. Classic keeps the tokens in `app.css`.

| Token | Value | Use |
| --- | --- | --- |
| `--canvas` | `#f1f5ff` | Page background |
| `--canvas-2` | `#e6edff` | Inset areas |
| `--surface-2` | `#eaf0ff` | Chips and hover fills |
| `--ink` | `#1d1a3d` | Main text |
| `--ink-2` | `#41406a` | Secondary text |
| `--muted` | `#5d5b7d` | Hints and labels |
| `--line` | `#dde3f7` | Borders |
| `--line-2` | `#c4cbea` | Card bottom edge |
| `--primary` | `#12803c` | Main actions, success, the active tab. Edge `--primary-700` `#0b5a2a` |
| `--primary-600` | `#0f6f34` | Hover on main actions |
| `--primary-50` / `--primary-100` | `#e8f8ee` / `#c7efd6` | Soft fills for green chips |
| `--blue` | `#1566d6` | Secondary actions and links. Edge `--blue-edge` `#0f4fa3` |
| `--blue-50` | `#e8f1ff` | Soft fill for blue chips |
| `--violet` | `#5b3fd9` | Achievements and streak-of-learning moments. Edge `--violet-edge` `#3f27b0` |
| `--violet-50` / `--violet-100` | `#efeaff` / `#dcd2ff` | Soft fills for violet chips |
| `--hero-a` / `--hero-b` | `#3d24b5` / `#6a4bef` | The hero gradient |
| `--mint` | `#7ef3c2` | The highlight on the hero. Decorative only, never text on white |
| `--sun` | `#ffc62b` | XP and reward highlights. Text on it `--sun-ink` `#3d2b00`. Edge `--sun-edge` `#d89b00` |
| `--red` | `#d9363e` | Danger. Edge `--red-edge` `#a8232b`. Text on the light red fill uses `--red-ink` `#b42318` |
| `--red-50` | `#fdecec` | Soft fill for danger notices |
| `--radius-sm` | `10px` | Chips and inputs |
| `--radius` | `16px` | Buttons and cards |
| `--radius-lg` | `22px` | Heroes, sheets and banners |
| `--radius-pill` | `999px` | Only for chips and segment controls. Never for buttons or the Beta tag |

Text pairs must meet WCAG AA: 4.5 to 1 for normal text and 3 to 1 for large text (18.66 px bold or larger). `tests/look-contrast.test.mjs` checks the pairs listed in its own file against these values, so a palette change that breaks contrast fails the test.

Font: Nunito for body, headings and numbers (weights 600, 800 and 900). Headings use 900, numbers in stats use 900, eyebrows use 800 in uppercase. The wordmark keeps its own logo style.

## 4. 3D controls

- **Shape:** 16 px radius, no outline, and a bottom edge: `box-shadow: 0 4px 0 var(--edge)`.
- **Hover:** lift 1 px and deepen the fill one step.
- **Press:** move down 4 px and drop the edge, so the control sinks into the page. The move takes 80 ms.
- **Disabled:** fill `#d5dbef`, edge `#c4cbea`, text `#6b6f92`, no movement.
- **Focus:** a 3 px outline in `--blue`, 3 px offset. Never removed.
- **Sizes:** default 48 px high, small 40 px, icon 40 px. A block option fills its row.
- **Variants:**
  - `primary`: green, white text, edge `--primary-700`.
  - `blue`: blue, white text, edge `--blue-edge`.
  - `hero`: white on the violet hero, text `--violet`, edge `#c9bdf5`.
  - `sun`: yellow with dark text, for rewards.
  - `danger`: red, white text.
  - `ghost`: white, 2 px `--line` border, edge `--line-2`.

Classic keeps its flat buttons. The same class names carry both looks, so no screen needs separate markup.

## 5. Cards, heroes, nodes and progress

- **Cards:** white, 2 px `--line` border, 16 px radius, a 4 px bottom edge in `--line-2`, 16 to 20 px padding. Hover lifts 2 px.
- **Feature cards:** may use a solid colour fill from the palette (violet for learning, green for practice, sun for rewards). Text on them is white or `--ink`, whichever passes the contrast test.
- **Hero:** one per screen at most. A violet gradient from `--hero-a` to `--hero-b`, white text, a 22 px radius, and a mint progress strip along the top.
- **Path nodes:** 64 px circles with a 5 px bottom edge. Done: green with a check mark. Current: blue with a slow pulsing ring. Locked: grey with `--line-2`. Checkpoint: sun with a chest icon.
- **Progress bars:** 14 px high, rounded ends, a `#dfe5fa` track and a green fill. A fill that is being earned has diagonal stripes. Each bar has `role="progressbar"` and its values.
- **Stat tiles:** 900 weight numbers, a small label, and a coloured icon tile.

## 6. Navigation and title bar

- **Bottom navigation** keeps its four tabs (Today, Self study, Review, Coach) and their labels, which are always visible. In Playful the active tab shows its icon inside a 44 by 32 px square with a 12 px radius, filled with `--primary-50`, and its label in `--primary`. The top line of the old design is removed.
- **Title bar:** the wordmark, then the **Beta** tag. The Beta tag is a small square with a 4 px radius and a 1 px `--ink-2` border, uppercase, 10 px, letter spacing 0.08 em. It is not a pill. In Playful, an XP chip (sun, with its edge) and the streak flame sit before the account picture. A league tier chip (violet) may follow in later milestones.
- The account menu, the search and the window controls keep their places in both looks.

## 7. Motion and celebration

- Page changes keep the existing fade and slide (220 ms).
- Presses take 80 ms. Hover lifts take 150 ms.
- Card flip in study sessions: 3D rotation around the vertical axis, 360 ms, with the back face hidden until the turn is half done.
- Celebrations (Playful only): a short confetti burst in green, violet, sun and blue, on a finished lesson, a finished deck session, or an achievement. Classic shows a quiet check mark instead.
- Every animation is turned off, or shortened to an instant change, when the system asks for reduced motion.

## 8. Voice and copy (Playful)

- Friendly and short. Speak to the learner as "you". Celebrate progress in one line: "Nice! Three more to go."
- Never shame a wrong answer. Say what to do next: "Not quite. Here is the right form, then try once more."
- The same tone in Portuguese: "Boa! Faltam três." Each Portuguese string is written for Brazil, not translated word by word.
- Classic keeps its neutral, precise voice. The words are the same keys; only the look changes.

## 9. Accessibility

- Every action is reachable with the keyboard. Study sessions use Space or Enter to reveal, and 1 to 4 to grade.
- Icon-only buttons have labels. Toggles and the look picker are real buttons with radio or switch semantics.
- Colour is never the only signal: a tone also has a word ("Needs work", "Good", "Excellent").
- Text can grow to 130% without losing a control.

## 10. Components to restyle for Playful

Buttons, feature cards, cards, chips, badges, the banner carousel, heroes, the title bar and its menu, the bottom navigation, inputs and selects, toggles, progress bars, skeletons, roadmap nodes, lesson cards, coach bubbles, tabs, sheets and menus, and the reports (score ring and skill cards).

New in 2.0 and built for both looks from the start: the daily goal ring, quests, the league card, achievements, the deck list and study session, the writing check, and the role-play picker.

Added with the last features of 2.0.0:

- **The word card** (tap to define, `src/components/WordCard.tsx`): a card in the corner of the reader, with the word, its meaning, the sentence it came from, and "Save word". The tapped word is marked in the text with the CSS Custom Highlight API. Classic is a plain white card; Playful adds the rounded edge.
- **The role-play scenes** (`src/components/CoachHome.tsx`): a grid of twelve cards under the coach's modes. Each card shows the scene, the character ("With ...") and the goal. Without an AI key the whole home is disabled, so the cards look faded, as the other modes do.
- **The score report hero** is a blue band in both looks. Its date line is white in Playful, because the Playful eyebrow colour is too dark on the band.
- **Plurals** use `tn()` in every count the learner reads: decks, cards, due cards, and the deletion warning. "1 card" and "2 cards" are different strings in both languages.
