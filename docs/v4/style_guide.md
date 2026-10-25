# Style Guide — reference grammar (round 4)

Source: `refs/reference.mp4` (x.com/Motionfly_co/status/2106259342550806993), 66.4 s, 1920×1080, **encoded at 30 fps**.
Studied from 133 frames at 0.5 s intervals in `refs/frames/` (frame `f_NNN` = `(NNN-1) × 0.5 s`), plus runs of
consecutive native frames during fast moves (t = 4.6 s and 18.6 s) to measure how motion is eased.
Earlier rounds are archived in `docs/v1/`–`docs/v3/` and `refs/v1/`–`refs/v3/`.

This file records **grammar only**. None of the reference's copy, product names, logos, UI or characters carry over.

---

## 1. Character in one line

A **typographic product film**. Big confident sans words carry the story, and real UI is shown in short, tilted, constantly drifting vignettes. Light warm chapters alternate with near-black ones, and a single bright accent color "sweeps" across key words. **Nothing ever stands still, and nothing ever pops on**: that's where the smoothness comes from.

---

## 2. Structure (beats, not content)

| Time | Beat | Grammar |
|---|---|---|
| 0.0–2.0 | **Type-on hook** | A huge single word types on with a thick accent-colored caret over a soft pastel aura background |
| 2.0–4.5 | **Logo reveal** | The mark blurs in (blur + scale 1.2 → 1.0). Then the wordmark types on beside it and the letters erase back off |
| 4.5–8.0 | **Stack scroll** | Two stacks of UI cards (above and below a centered word) scroll vertically at a constant speed. The center word swaps its last word on each beat. Then the stacks tilt away in 3D |
| 8.0–10.0 | **Inline chips** | A sentence where small real UI chips (a tiny card, a pill) sit **between words** on the baseline |
| 10.0–12.0 | **Accent sweep** | A sentence on a dot-grid background. The accent color sweeps letter by letter across part of the line |
| 12.0–18.0 | **UI vignettes** | Cards tilted in 3D settle flat. A prompt bar types itself, and a **pointer glides and clicks** the send button |
| 18.0–24.0 | **Dark chapter** | A near-black field. A small spinner, then a status line, then the answer streams in **line by line** with blur-ins |
| 30.0–32.0 | **Version card** | Short bold line on dark, with the last token in the accent |
| 32.0–34.0 | **ALL-CAPS headline** | Two stacked lines in heavy caps with **scale contrast** (one small, one big). UI cards burst out between the lines |
| 38.0–44.0 | **Two-line statements** | Line 1 in ink, line 2 in gray typing on with the caret. Floating labeled chips with their own little pointers drift around them |
| 44.0–50.0 | **Split screen** | A dark left panel holds a two-line caps-ish statement (one word in the accent), and the right panel shows the UI doing it |
| 55.0–58.0 | **Macro type** | The camera is pushed so far into an input box that the typed words are giant |
| 58.0–60.0 | **Device tilt** | A phone held at a 3D angle, slowly rotating |
| 60.0–63.0 | **Orbit pull-out** | A card at the center with icons orbiting on rings. The camera pulls out into a grid of many orbits on dark |
| 63.0–66.4 | **Lockup** | The mark blurs in big, scales down and slides left as the wordmark slides out. A small gray subline sits beneath. Long hold |

---

## 3. Palette (measured)

| Role | Hex | Notes |
|---|---|---|
| Warm field | `#F6F5F0` | The default light chapter (warm off-white) |
| Bright field | `#FDFFFC` | Type cards and the lockup |
| Ink | `#171916` | Near-black for all text on light |
| Dark field | `#171916` | Dark chapters reuse the ink value as the background |
| Gray (secondary line) | `#737572` | Line 2 of two-line statements, sublines |
| Accent | `#2184E1` (caret `#308CE3`) | The only saturated color: caret, sweep, send button, one word per statement |
| Opening aura | `#F2EDF3` / `#D2E5F6` / `#EAF1F7` | Soft lilac-and-sky blur behind the first word only |
| Mid-gray transition | about `#BDBDBD` | Used only while a background crossfades light → dark |

**Rules:** one accent color, used on **one element at a time**. Any other color comes only from the UI itself.

---

## 4. Typography

| Use | Family | Weight | Tracking | Size (1080p) |
|---|---|---|---|---|
| Hook word, statements | Neo-grotesk (Inter-like) | Semibold–Bold 600–700 | −2.5% to −3% | Hook about 190 px; statements 64–90 px |
| ALL-CAPS headline | Same family, caps | Heavy 800 | −2% | Scale contrast: small line about 50 px, big line about 110 px |
| Two-line statement, line 2 | Same | 600 | −2% | Same size as line 1, in gray |
| Sublines | Same | 500 | 0 | About 18 px, gray |
| UI | The product's own UI font | — | — | Real size inside the UI |

- Sentence case for statements, **ALL CAPS for headline beats**.
- Short lines, at most two per frame.

---

## 5. How text enters and exits

1. **Type-on with caret:** about 14 characters per second, with a **thick** caret (≈ 0.08 em wide) in the accent color. The caret blinks twice at the end, then disappears.
2. **Blur-in reveal:** each word or line goes from blur 6–10 px, y +12 px and opacity 0 to sharp in **0.30–0.45 s** (ease-out), staggered **0.08–0.12 s**.
3. **Streaming answer:** lines reveal top to bottom with blur-in while the block **keeps scrolling up** about 2 px per frame, so the newest line is always near the same spot.
4. **Word swap:** only the last word changes. The old word blurs out (0.15 s) and the new one blurs in (0.2 s); the fixed words never move.
5. **Accent sweep:** the accent color fills the line letter by letter from left to right over 0.5 s, then fades back to ink.
6. **Exit:** whole-line blur-out (0.25 s), or the type stays put while the camera pushes through it.
7. **Erase:** letters delete right to left like a backspace, as fast as they typed.

---

## 6. Shot lengths

- **About 22 beats in 66 s, averaging 3 s.**
- Type cards: **1.2–2.0 s**. UI vignettes: **2.5–5 s**. Lockup hold: about 3 s.
- The pace never jolts: each beat begins while the previous one is still drifting.

---

## 7. Transitions

| Type | Use |
|---|---|
| **Type → UI match** | A typed word becomes the text inside an input box |
| **Blur dissolve** (out-blur about 20 px) | Default between beats |
| **Background crossfade** | Light → mid-gray → dark (≈ 0.5 s) with the content drifting on top, used to enter dark chapters |
| **Push-through** | The camera keeps pushing into the UI until it fills the frame and becomes the next beat |
| **Panel slide** | The split-screen dark panel slides in from the left edge |
| **Pull-out** | One element → a grid or orbit of many |

No hard cuts mid-motion. Hard cuts happen only between two type cards that are both at rest.

---

## 8. Camera moves

- **Constant drift on every beat:** about 1–3% scale over the beat, or 10–30 px/s of pan. The frame is never frozen.
- **3D tilt-to-flat:** UI cards enter at rotateX 15–25°, rotateZ −4 to −8°, and settle flat over about 0.8 s.
- **Vertical conveyor:** card stacks scroll at a constant speed (about 200 px/s at 1080p) with perspective falling away.
- **Macro push:** the camera scales 3–5× into an input box, so the typing fills the frame.
- **Device rotation:** the phone at about 15° yaw, slowly rotating by 5°.
- **Orbit pull-out:** scale 1 → 0.25 while rings of icons rotate slowly.

---

## 9. Texture and depth

- No film grain. **Clean.**
- **Dot-grid backgrounds:** small dots on about a 14 px grid, mostly gray, with a few colored dots, at very low contrast. Used behind statements.
- **Soft aura gradients:** only at the opening.
- Cards: white, radius about 14 px, with very soft shadows (0 10px 30px rgba(0,0,0,.06)). They stack with a slight offset and fade into depth.
- **Pointer:** a crisp pointer or hand cursor with a drop shadow. It **glides on eased curves** (never straight teleports) and dips about 10% in scale on click.
- Motion blur appears on fast-moving cards and the pointer (visible as smear on native frames).

---

## 10. Smoothness spec (how to match it at 60 fps)

The reference is only 30 fps. Its smoothness comes from **easing, continuous motion and motion blur**, not frame rate. Our build renders at **60 fps** and follows these rules:

1. **Easing everywhere:** arrivals use ease-out expo/cubic `cubic-bezier(0.16, 1, 0.3, 1)`, travel uses ease-in-out `cubic-bezier(0.65, 0, 0.35, 1)`, and drifts are linear. **No linear starts or stops** on anything that arrives.
2. **Minimum durations:** nothing that moves more than 100 px takes less than **0.35 s**, and a camera move is never shorter than **0.6 s**.
3. **Always something drifting:** every beat carries a 1–3% scale drift or a slow pan, so held frames never look frozen.
4. **No pops:** every appearance is a blur-in (6–10 px) plus a fade plus a ≥ 8 px rise. Every disappearance is a blur-out.
5. **Overlap beats:** the next beat's first element starts 0.1–0.2 s before the previous one finishes its exit.
6. **Motion blur on fast movers:** anything moving faster than about 1,500 px/s (phone swings, pointer glides, card bursts) gets velocity-scaled blur (2–8 px), or a multi-sample trail.
7. **Sub-frame timing:** all animation is computed from continuous time (seconds), not integer 30 fps frames, so every 60 fps frame lands on a distinct position.
8. **Springs only on small objects** (chips, pointer press) with one gentle overshoot of 4% or less. Cameras never spring.

---

## 11. Do / Don't

**Do:** big words carry the story · real UI in short tilted vignettes · one accent at a time · ALL-CAPS for headline beats · constant drift · blur-in everything · gliding pointer.

**Don't:** hard-pop elements · freeze a frame · use more than one accent at once · put three lines of text on screen · bounce the camera · add grain.
