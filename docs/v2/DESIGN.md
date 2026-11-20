# danna 2.0.0: look and feel

Two looks share one app. The look changes the colours, shapes, buttons, cards, depth and motion. It never changes the layout rules, the words, or what a control does.

## 1. The two looks

**Classic** is the current look, unchanged in 2.0. Inter, navy ink, one blue accent, hairline borders, 6 to 14 px radii, flat cards.

**Playful** is friendlier and gamified: Nunito, bright colours, chunky 3D buttons, rounder shapes, cards with a visible bottom edge, celebrations and a friendly voice. It is the look for learners who want a game-like app. It is chosen in Settings, and saved to the account.

## 2. Tokens (Playful)

Defined on `:root[data-look="playful"]` in `src/styles/playful.css`. Classic keeps the tokens in `app.css`.

| Token | Value | Use |
| --- | --- | --- |
| `--canvas` | `#eef6ff` | Page background |
| `--canvas-2` | `#e2efff` | Inset areas |
| `--surface` | `#ffffff` | Cards and menus |
| `--ink` | `#17233d` | Main text |
| `--ink-2` | `#3f4b66` | Secondary text |
| `--muted` | `#5b6780` | Hints and labels (checked for contrast on white and on canvas) |
| `--line` | `#d6e4f5` | Borders |
| `--line-2` | `#b9cde6` | Card bottom edge |
| `--green` | `#128a4e` | Main actions and success. Edge `--green-edge` `#0c6b3b` |
| `--blue` | `#1f6fd1` | Secondary actions and links. Edge `#1656a6` |
| `--yellow` | `#ffc21a` | XP and streak highlights. Text on it `#3b2a00`. Edge `#d99a00` |
| `--red` | `#d9363e` | Danger and hearts. Edge `#a92830` |
| `--purple` | `#7c4dff` | Achievements. Edge `#5b2fd6` |
| `--radius-sm` | `10px` | Chips, inputs |
| `--radius` | `16px` | Buttons and cards |
| `--radius-lg` | `22px` | Heroes and sheets |

Text pairs must meet WCAG AA: 4.5 to 1 for normal text and 3 to 1 for large text (18.66 px bold or larger). `tests/look-contrast.test.mjs` checks every pair listed in this file, so a palette change that breaks contrast fails the test.

Font: Nunito for body, headings and numbers (weights 600, 800 and 900). Numbers in stats use 900. The wordmark stays in its own logo style.

## 3. 3D buttons

- Shape: 16 px radius, no outline, a bottom edge made with `box-shadow: 0 4px 0 var(--edge)`.
- Hover: lift 1 px and brighten the fill by 3%.
- Press: move down 4 px and drop the edge, so the button sinks into the surface.
- Disabled: fill `#cfd8e6`, edge `#b7c2d4`, text `#6b7790`, no movement.
- Focus: a 3 px outline in `--blue`, 3 px offset. Never removed.
- Sizes: default 48 px high, small 40 px. A block option fills its row.
- Variants: `primary` (green), `blue`, `yellow` (text dark), `danger` (red), `ghost` (white, 2 px `--line` border, edge `--line-2`).

Classic keeps its flat buttons. The same class names carry both looks, so no screen needs separate markup.

## 4. Cards and surfaces

- Playful cards: white, 2 px `--line` border, 16 px radius, a 4 px bottom edge in `--line-2`, 16 to 20 px padding.
- A screen has one hero at most. A hero uses a gradient of blue to purple (or green for a success state).
- Progress bars: 14 px high, rounded, with a striped fill when a value is being earned. Each bar has `role="progressbar"` and its values.
- Stat tiles use 900 weight numbers and a small label.

## 5. Navigation and title bar

- Bottom navigation keeps its four tabs (Today, Self study, Review, Coach). In Playful the active tab shows its icon on a coloured square with a 14 px radius (not a pill). Labels are always visible.
- Title bar: the wordmark, then the **Beta** tag. The Beta tag is a small square (4 px radius, 1 px `--ink-2` border, uppercase, 10 px, letter spacing 0.08 em), not a pill. In Playful, an XP chip (yellow, with its edge) sits before the streak flame.
- The account menu, the search and the window controls keep their places in both looks.

## 6. Motion

- Page changes keep the existing fade and slide (220 ms).
- Card flip in study sessions: 3D rotation around the vertical axis, 360 ms, with the back face hidden until the turn is half done.
- Celebrations (Playful only): a short confetti burst on a finished lesson, a finished deck session, or an achievement. Classic shows a quiet check mark instead.
- Every animation is turned off, or shortened to an instant change, when the system asks for reduced motion.

## 7. Voice and copy (Playful)

- Friendly and short. Speak to the learner as "you". Celebrate progress in one line: "Nice! Three more to go."
- Never shame a wrong answer. Say what to do next: "Not quite. Here is the right form, then try once more."
- The same tone in Portuguese: "Boa! Faltam três." Each Portuguese string is written for Brazil, not translated word by word.
- Classic keeps its neutral, precise voice. The words are the same keys; only the look changes.

## 8. Accessibility

- Every action is reachable with the keyboard. Study sessions use Space or Enter to reveal, and 1 to 4 to grade.
- Icon-only buttons have labels. Toggles and the look picker are real buttons with `aria-pressed` or radio semantics.
- Colour is never the only signal: a tone also has a word ("Needs work", "Good", "Excellent").
- Text can grow to 130% without losing a control.

## 9. Components to restyle for Playful

Buttons, feature cards, cards, chips, badges, the banner carousel, heroes, the title bar and its menu, the bottom navigation, inputs and selects, toggles, progress bars, skeletons, roadmap nodes, lesson cards, coach bubbles, tabs, and the reports (score ring and skill cards).

New in 2.0 and built for both looks from the start: the daily goal ring, quests, the league card, achievements, the deck list and study session, the writing check, and the role-play picker.
