# Radlay motion specification

**Personality:** mechanical & engineered (construction, engineering, energy). **Intensity:** subtle to moderate.
Motion here should feel measured and competent: things are drawn, filled and switched, never bounced or spun.

**Signature moments (two per site, no more):** the plant schematic draws itself; the process line fills step by step.
**Continuous motion budget:** one effect, the power and signal flows in the schematic. It stops when off screen and has a Pause control.
**Not used, on purpose:** number counters (no verified metrics to count), cursor-following effects, scroll hijacking, pinned sections, 3D scenes, bounce easing.

## Tokens (`assets/css/styles.css`, `:root`)

| Token | Value | Used for |
| --- | --- | --- |
| `--motion-press` | 110ms | button and card press feedback |
| `--motion-fast` | 160ms | colour, border, shadow hovers; error messages |
| `--motion-normal` | 240ms | small transforms, tab switch, menu drawer |
| `--motion-slow` | 420ms | image hover zoom, accent bars, label fades |
| `--motion-reveal` | 500ms | fade + rise on scroll |
| `--motion-image` | 800ms (600ms on phones) | feature photograph reveal |
| `--motion-draw` | 1100ms (900ms on phones) | schematic line drawing |
| `--ease-enter` | `cubic-bezier(0, 0, .2, 1)` | things arriving and settling |
| `--ease-exit` | `cubic-bezier(.4, 0, 1, 1)` | things leaving |
| `--ease-standard` | `cubic-bezier(.2, 0, 0, 1)` | state changes; alias `--ease` |
| `--ease-inout` | `cubic-bezier(.65, 0, .35, 1)` | masks and light sweeps |
| `--rise` | 20px (12px on phones) | reveal travel |

Linear easing is reserved for the process line and the flows, where constant speed reads as mechanical.

## Effects

| Effect | Purpose | Desktop | Mobile | Duration / easing | Repeat | Reduced motion | No-JS / fallback |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Hero entrance | Reading order on arrival | Eyebrow, title, lead, actions, stats fade + rise in sequence | Same, 12px travel | 500ms enter, 70ms stagger | Once | Shown immediately | Visible |
| Hero parallax | Depth on the gear photo | Photo drifts at 0.18× scroll | Off | Scroll-linked, one write per frame | Continuous while in hero | Off | Static |
| Hero photo settle | Atmosphere | Scale 1.1 to 1 | Same | 18s | Once | Instant | Static |
| Scroll reveal | Structure and rhythm | Fade + rise when 15% visible | Same, shorter travel | 500ms enter | Once per element | Shown immediately | Visible (hidden state needs `.js`) |
| Card stagger | Group reads as one set | Children offset 70ms | 50ms | Ease-enter | Once | Instant | Visible |
| **Schematic draw** | Shows the plant as an engineering drawing; explains what connects to what | Outlines plot in order: supply and solar, MCC, gateway, cloud, tank, line; fills, labels, flows and hotspots follow | Same sequence, 900ms | 1100ms standard, 110ms between groups, 350ms hold | Once | Drawn immediately | Drawn |
| Power and signal flows | Energy-flow diagram: power in yellow, data in blue | Dashes travel along cables | Same | Linear, 1.1 to 2.4s loops | Continuous **only while on screen**; Pause button stops all loops | Static | Static |
| Hotspot ring | Marks the selected point | Pulse on the active hotspot only; others show a still ring | Same, tap to select | 1.4s | While active | Still ring | Still ring |
| Solution auto-advance | Tours the six solutions | Advances every 6s with a progress bar | Same | Linear progress | Stops on any pick, on Pause, and off screen | Off | First panel; all panels readable without JS |
| Readout switch | State change | Panel fades and rises | Same | 240ms enter | On each pick | Instant | All panels visible |
| Widget charts | Explain each example value | Trend line draws, OEE ring fills, bars and columns grow | Same | 600 to 900ms enter | On each panel show | End state shown (fixed: ring and trend line were empty) | End state |
| **Process line** | Timeline progression from audit to monitor | Horizontal line fills; each number flashes gold as the line reaches it | Vertical line down the numbered list | 1200ms linear (1000ms phone); steps 300ms apart | Once | Filled immediately | Filled |
| Feature photo reveal | Project image reveal for engineering pages | Photo uncovers from the edge nearest the copy and settles from 1.08 | Same, 600ms | 800ms in-out | Once | Shown | Shown |
| 3D mark light sweep | Brand moment in the CTA | One sheen across the steel mark | Same | 1.8s in-out | Once (was an endless 7s loop) | Instant | Static |
| Footer plate sheen | Light catches the steel plate | Sweep on hover | None (plates already lit) | 900ms in-out | Per hover | Instant | Static |
| Card and image hover | Affordance | Lift 4px, image zoom 1.04 to 1.05, accent bar draws, arrow nudges 4 to 6px, check icons shift 4px | Accent bar draws and arrow nudges on entry; images settle from 1.06 on entry; press scales to 0.985 | 240 to 420ms standard | Per hover / once on entry | Instant | Static |
| Button press | Confirms the tap | Scale 0.97 | Same | 110ms | Per press | Instant | n/a |
| Nav underline | Current and hovered link | Underline sweeps in | Drawer links, no underline | 240ms | Per hover | Instant | Visible state |
| Mobile menu | Navigation | n/a | Drawer fades and drops 12px; page scroll locks | 240ms enter | Per open | Instant | Links in markup |
| Gallery filter | Shows the result of a choice | Matching projects settle in 40ms apart; count announced ("Showing 2 of 8 projects") | Same | 240ms enter | Per filter | Instant swap | All projects shown |
| Form validation | Clear error state | Field rule turns red, message in words under it, focus moves to the first error, summary in the status line | Same | 160ms enter | Per submit | Instant | Browser validation off; mailto still works |
| Form hand-off | Honest outcome | Status says the email app should open; no success tick, because the site cannot know the mail was sent | Same | n/a | Per submit | Same | Same |

## Rules for new motion

1. Name the job first: feedback, structure, explanation or the brand. If removing it changes nothing, do not add it.
2. Hover-only effects go inside `@media (hover: hover) and (pointer: fine)`, and get a touch equivalent in `@media (hover: none)`: entry, press, or visible by default.
3. Animate `transform`, `opacity`, `clip-path` and SVG stroke properties only.
4. Hidden starting states live under `.js` so a script failure never hides content.
5. Anything that loops must stop off screen and be covered by a pause control.
6. Under `prefers-reduced-motion`, animations finish instantly rather than being removed, so end states (filled rings, drawn lines) still show.
7. The Radlay Connect portal is an operations tool: transitions there stay at 250ms or less, and feedback reflects real state.
