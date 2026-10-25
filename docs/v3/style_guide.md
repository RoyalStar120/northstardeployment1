# Style Guide — reference grammar (round 3)

Source: `refs/reference.mp4` (x.com/wabi/status/2104721766690222087), 80.5 s, 3840×2160 @ 60 fps.
Studied from 161 frames at 0.5 s intervals in `refs/frames/` (frame `f_NNN` = `(NNN-1) × 0.5 s`).
This is the same reference as round 1 (the frames match byte for byte), so sections 1–10 carry over from `docs/v1/style_guide.md`. Section 11 adds the beats this round leans on.
Round 2 (a different reference) is archived in `docs/v2/` and `refs/v2/`.

This document records **grammar only**: color logic, type behavior, rhythm, transitions, camera.
None of the reference's copy, logos, characters, 3D objects or UI is carried into our video.

---

## 1. Structure at a glance

The film alternates between three "worlds," and the alternation *is* the rhythm:

| World | Share of runtime | What it looks like | Used for |
|---|---|---|---|
| **A. Dusk gradient** | ~12% (open + close only) | Full-bleed soft 3D gradient, glossy objects, depth of field | Bookends: intro and logo reveal |
| **B. White type card** | ~35% | Near-white field, one centered line of dark type, nothing else | Every idea gets stated in words first |
| **C. White UI** | ~53% | Same white field, chat bubbles → phone frame → app screens | The idea, proven in product |

The pattern is a strict **say → show → say → show** loop. A type card almost always comes right before the UI beat it names, and nearly every cut between B and C is white to white, so you barely notice it.

Beat map of the reference (timings, not content):

```
0.0 ─ 6.5   A  gradient open → "Introducing" → typewriter line → oversized blur line
6.5 ─ 10.0  B  word-by-word reveal line
10.0 ─ 11.0 C  burst of 3D stickers around a chat bubble (energy spike)
11.0 ─ 18.0 C  chat bubbles stack → pull back to reveal phone → scroll to widget
18.0 ─ 22.0 B+C spaced words + avatars flying in with motion blur
22.0 ─ 32.0 C  group chat, floating reactions, pull back, map screen
32.0 ─ 35.5 B  line with glyph-scramble → resolves, second clause appends
35.5 ─ 45.0 C  chat → phone → data screen   /  B word reveal ×2
40.0 ─ 44.0 B+C vertical word roll with phone overlaid, screens swap in sync
44.0 ─ 55.0 C  chat → phone → full-screen mini-app, reactions
55.0 ─ 60.0 B  line → partial dissolve → new ending
60.0 ─ 69.5 C  home screen; widgets fan out on a curved carousel under a caption
69.5 ─ 72.0 B  two-word platform line, second word ghost → ink
72.0 ─ 75.0 A  back to gradient; objects gather and form the mark
75.0 ─ 80.5 B  lockup: word · icon tile · word → collapses to icon + name → + URL
```

---

## 2. Palette

Sampled from frames (hex values are measured unless marked ≈).

### World A: dusk gradient (bookends only)
| Role | Hex | Where sampled |
|---|---|---|
| Night floor | `#110921` | f_001 bottom |
| Deep violet | `#412782` / `#513A8C` | f_001–003 horizon band |
| Violet mid | `#6846A5` | f_004 |
| Magenta | `#8C42A3` / `#8A2994` | f_001, f_145 |
| Cobalt sky | `#4D6CBC` / `#5D74C2` | f_008–010 top |
| Ember orange | `#C7562C` / `#EE732D` | f_001 edge, f_145 |
| Peach | `#DCA89A` / `#E99567` | f_001 center, f_145 |
| Haze (end state before white) | `#E2D6D8` → `#E7E0D8` | f_004, f_013 |

How it works: a **horizon** (a curved planet-edge or a swirl) splits a dark cool top from a warm bright bottom. The camera slowly lifts, so the frame gets lighter and hazier until it is almost white. That slow brightening is the handoff into World B.

### Worlds B and C: white
| Role | Hex | Notes |
|---|---|---|
| Field | `#FEFFFD` | A very slightly green-tinted white, not pure `#FFF` |
| Ink | `#161815` | Near-black with a matching warm-green tint (`#121413`–`#181A19`) |
| Ghost ink | ≈ `#B4B6B3` (≈ 30–40% ink) | Words that haven't landed yet, and receding words |
| Bubble fill | `#F3F5F2` | Assistant/other-person chat bubbles |
| User bubble | `#161815` fill, white text | Pill-shaped, right-aligned |
| Phone bezel | ≈ `#E4E6E3` hairline + soft shadow | Light-colored device, never a black slab |

**Rule:** outside the bookends, the only saturated color on screen comes from the **product itself** (screens, stickers, reactions). The frame never adds color of its own.

---

## 3. Typography

| Property | Reference |
|---|---|
| Family | A neo-grotesk sans (Inter Display / Suisse-like): single-story `g`, round `a`, tight apertures |
| Weight | **Medium (~500)** for every line. No bold, no light. |
| Tracking | **Tight, about −2% to −3%.** Big headlines go tighter (≈ −3.5%). |
| Case | Sentence case or all lowercase. Never all caps. |
| Alignment | Optically centered. One line per card. Two lines never happen. |
| Size, standard line | ≈ 4.5% of frame height (≈ 48 px at 1080p) |
| Size, hero word | ≈ 11–12% of frame height (≈ 125 px at 1080p): single words like a category name |
| Size, caption over UI | ≈ 2.8% of frame height, sits at the top third, ink |
| Size, oversized blur line (World A) | ≈ 9% of height, lavender/violet tint, with a soft glow |
| Punctuation | A period ending a short declarative line is part of the voice ("X. Y.") |

---

## 4. How text enters and exits

Five text behaviors in total. Each appears more than once, and no others are used.

1. **Ghost → ink word reveal** (the workhorse).
   Words appear left to right. Each word enters at **ghost gray, about 35% opacity, with about 4 px blur**, then settles to full ink over about 0.25 s. The next word starts about 0.18–0.25 s later. The line stays centered while it grows, so earlier words drift left as later words land.
   *Exit:* the whole line fades back to ghost (about 0.3 s), or it's a hard cut to the next white card.

2. **Typewriter with caret** (World A only).
   Characters appear at about 12–14 per second with a thin `|` caret after the last one. The caret blinks twice once the line is done, then disappears.

3. **Oversized blur-in** (World A only).
   A large, tinted line comes into focus word by word, going from about 20 px blur to sharp while scaling 1.04 → 1.00. There is a soft glow behind it. *Exit:* it drifts out of frame as the camera pushes past it, blurring back out.

4. **Partial dissolve and replace.**
   The first word of a line stays put. The remaining words break into **noise/particle dither** (a grainy smear that blows off to the right) over about 0.4 s. A new ending then writes on with the ghost → ink reveal. The kept word never moves.

5. **Glyph scramble.**
   Letters of the line flicker through emoji or icon glyphs for about 0.4 s before settling on the real characters. It's used once, on a punchline.

Also used:
- **Spaced-word kinetic line.** The words are set far apart, then objects (avatars, in the reference) fly into the gaps with heavy motion blur, and the words blur away.
- **Vertical word roll.** One hero word in ink sits above a column of ghost words. The stack scrolls up one slot at a time, like a slot machine, and each new top word turns to ink. A phone sits on top of the stack, covering the middle of the words, and its screen swaps in sync with each roll.
- **Lockup collapse.** The lockup reads `word · [icon tile] · word`. The outer words fade to ghost and fall away, the icon and name slide together, and the name then extends (for example, adds a URL).

---

## 5. Shot lengths

- **About 32 shots in 80 s, averaging 2.5 s.** The film moves quickly but never feels rushed.
- Type cards: **1.0–2.5 s** (just long enough to read, plus about 0.5 s).
- UI beats: **2.5–5.0 s**, broken up by internal moves such as a new bubble or a pull-back.
- Energy spikes (sticker burst, reactions): **0.5–1.0 s**.
- Bookends (World A): **about 6 s** open, **about 3 s** close. These are the only long, slow shots.
- Tempo: the opening is slow, the middle has a steady pulse of about 2 s, the carousel gets a lift, and then the ending settles into calm.

---

## 6. Transitions

| Type | Frequency | Description |
|---|---|---|
| **White-to-white hard cut** | Most common | Type card → UI, or UI → type card. The field color never changes, so the cut is almost invisible. |
| **Pull-back reveal** | About 6× | Begins tight on chat bubbles floating on white. The camera pulls back (scale about 1.6 → 1.0) until a phone frame surrounds them. The phone was there all along. |
| **Push/scroll inside the phone** | Frequent | The screen content scrolls up to reveal a widget, then the camera pushes into that widget. |
| **Luminance bloom** | 2× | World A brightens and hazes into white (f_013 → f_014): about 0.3 s from haze to `#FEFFFD`. |
| **Blur cross-dissolve** | Occasional | A blurred placeholder card sharpens into the real image or widget (about 0.4 s). |
| **Match on object** | At the close | Glossy objects in World A gather into the logo mark, and the mark becomes the app-icon tile in World B. |

No wipes, no slides, no zoom-blur transitions, no flashes.

---

## 7. Camera moves

- **There is always a slow drift.** Even "static" holds push in about 2–4% over the shot. Nothing is ever fully frozen.
- **Pull-back** is the signature reveal (see transitions).
- **Lateral phone shifts.** The phone sits left of center, centered, or right of center from beat to beat, which gives rhythm without cuts.
- **Arc carousel.** Widget tiles move along a shallow curve below the phone and tilt toward the camera near the center, like a cover-flow in 3D.
- **Crane/tilt** in World A only: the camera rises over the horizon.
- Easing is soft ease-out on arrivals and gentle ease-in-out on drifts, with no bounce on the camera. Springs appear only on **objects** (stickers, reactions, avatars) as a single overshoot of about 8%.

---

## 8. Texture, depth and grain

- **World A:** glossy, soft-lit 3D with heavy depth of field, bloom on highlights, and slight banding and dithering in the gradients. The objects are translucent and pearlescent, with reflections of the gradient.
- **Worlds B and C:** no grain and no texture at all. The white is clean, and depth comes only from:
  - a soft phone shadow (large blur, low opacity, offset downward)
  - motion blur on anything that flies in (avatars, reactions, stickers)
  - a slight defocus on ghost words
- Chat bubbles are flat, with no shadow and large radii (about 18 px at 1080p). The user pill is fully rounded.

---

## 9. Sound (for reference; not required)

Soft ambient pad under World A, then a light percussive tick on each word reveal and bubble arrival. The music swells at the carousel and resolves on the lockup.

---

## 10. Do / Don't

**Do:** one idea per card · white field between every idea · let the product provide the color · pull back to reveal · ease everything · short declarative lines.

**Don't:** put two lines of copy on screen · use color blocks behind type · use slide or wipe transitions · use drop-shadowed text · add grain on white · use more than one new text behavior per shot.

---

## 11. Beats this round leans on (new detail)

### 11a. Sticker burst (energy spike), f_019–f_021, about 1.0 s
- About 8–10 glossy, soft-lit 3D objects ring the **edges** of the frame around one centered chat bubble. The center stays clear and readable.
- They enter at scale about 0.6 with 15–30° of rotation, spring to 1.0 with a single overshoot (about 8%), and carry heavy motion blur on the way in.
- They hold for about 0.3 s, then fly **outward** off the frame edges (blur again), leaving the bubble alone on white.
- Objects are full-color and saturated. This is the only time the white world gets a burst of color that doesn't come from the product.

### 11b. Caption + curved carousel, f_128–f_139, about 5 s
- A one-line caption sits in ink at about 20% height, about 2.8% of frame height (the caption size from §3).
- A phone sits at center, bottom-cropped by the frame.
- Behind it, square tiles (radius about 22%, about 0.45 × phone width) run on a **shallow arc**: the arc is highest behind the phone and droops toward the frame edges.
- Tiles turn to face the arc (rotateY up to about ±35° at the edges), shrink toward the edges (about 0.75×), and soften slightly at the far ends.
- The whole arc pans laterally at a steady rate (about one tile per 0.5 s). Tiles pass *behind* the phone, so the phone reads as the hero.

### 11c. Close-up product beats, f_040–f_060
- Tight crops (camera scale 1.3–1.6) on one region of a screen; the rest of the phone is off-frame.
- New content arrives **inside** the crop (a bubble, a widget). The camera then eases back to reveal context, never cutting.

### 11d. What the reference never does
- **No hands, fingers or cursors** inside product beats (the one arrow cursor is a sticker in the burst, not an interaction).
- So a tap has to be shown with a UI-native cue (the button's own pressed state, a ring or a ripple) rather than a drawn hand.
