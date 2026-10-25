# Style Guide — reference grammar (round 5: VSL edit)

Source: `refs/reference.mp4` (youtube.com/watch?v=NRDQ8erG7Rw), 71.7 s, 1920×1080, encoded at 30 fps.
Studied from 143 frames at 0.5 s intervals in `refs/frames/` (frame `f_NNN` = `(NNN-1) × 0.5 s`), plus runs of
consecutive native frames during push-ins (t = 5.4 s and 44.0 s). Earlier rounds are archived in `docs/v1/`–`docs/v4/`.

This file records **editing grammar only**. None of the reference's people, footage, copy, brand names, logos,
stickers or third-party screenshots carry over. This round is **not for Northstar**.

---

## 1. Character in one line

A **talking-head VSL edit**: one person on camera, and the edit keeps the eye busy every 1–2 seconds with **eased push-in zooms**, **jump cuts that change framing**, **bold caps captions**, and **neon or glossy graphics that act out the key words** around the speaker's head and hands.

---

## 2. Structure (beats, not content)

| Pattern | What happens |
|---|---|
| **Hook (0–3 s)** | The first words land as huge **glowing neon caps** in the upper third, flying in letter by letter while the camera is already pushing in |
| **Say → show, per phrase** | Every phrase gets one visual: a 3D icon, a stat badge, a glass card or a big keyword. Graphics sit in the **negative space** beside the head, never over the face |
| **Proof stack** | Badges and cards **replace each other in the same spot** (one leaves as the next arrives) |
| **Number moments** | Counters roll up (0.0 → 8.0, fast then easing out), with a 3D icon beside the number |
| **Trend moment** | A glowing green line draws upward across the frame behind a keyword |
| **Pattern break** | Every 6–10 s: a **zoom-blur whip**, a red light-leak flash, a desaturated cutaway, or a cut to a dark card wall |
| **CTA / turn** | One short line ("STOP!"-style), in **red**, small, near the hands, plus a quick punch-in |

---

## 3. Palette (measured)

| Role | Hex | Notes |
|---|---|---|
| Neon cyan (headline glow) | `#0FBCF4` / `#11C9EB` | Glowing keywords; the outer glow is the same hue with heavy blur |
| Caption white | `#FFFFFF` | Lower captions, with a soft black shadow (no outline box) |
| Emphasis red | about `#FF2B2B` | One word per caption at most, or the CTA word |
| Badge blue | `#283E91` → `#2A4191` | Rounded stat pills: a gradient deep blue with a bright edge highlight |
| Growth green | `#14FF75` | The trend line and "money/growth" words |
| Footage grade | Cool teal-gray shadows (`#3E4C4F`) | Slight contrast lift and a soft vignette. The speaker's skin stays natural |

**Rule:** at most **two** accent colors on screen at once. Cyan is the default; red and green are reserved for meaning (a warning or turn, and growth or money).

---

## 4. Typography

| Use | Family | Weight | Tracking | Size (1080p) |
|---|---|---|---|---|
| Lower captions | Geometric sans (Montserrat-like) | **ExtraBold 800**, ALL CAPS | +1% | About 30–34 px, centered, about 78% down the frame |
| Neon keywords | Same family | **Black 900**, ALL CAPS | 0 | 90–140 px, upper third, with a cyan glow |
| Badge text | Same family | ExtraBold 800, caps | +2% | About 26 px on the pill |
| Counters | Same family | Black 900 | 0 | About 60 px, with "M"/"+" suffix in the same weight |

Captions are **one phrase** (3–7 words), never two lines.

---

## 5. How text enters and exits

1. **Neon keyword fly-in:** letters arrive **one by one** (about 35 ms apart). Each starts at scale 1.6, blur 12 px, rotateY about 35°, opacity 0, and settles in about 0.25 s with ease-out. The glow blooms after the letter lands.
2. **Caption phrase:** the whole phrase pops in (scale 0.92 → 1, opacity, 0.12 s). A keyword can turn red or green on its spoken beat.
3. **Caption exit:** a fast **glitch dissolve**: the letters smear horizontally and fade (0.15 s) as the next phrase pops in.
4. **Badge entry:** the pill slides up 30 px and scales 0.85 → 1 with one small overshoot (≤ 6%). Its icon pops a few frames later at the pill's edge.
5. **Counter:** rolls with an ease-out over 0.6–0.9 s and holds on the final number.
6. **Exit of graphics:** a scale-down plus blur (0.2 s), or pushed out by the next graphic in the same slot.

---

## 6. Shot lengths

- **Talking-head segments run 1.5–4 s between jump cuts.** The edit hides cuts by **changing framing** (wide ↔ punched-in).
- A new graphic or caption change happens about **every 0.8–1.5 s**.
- Pattern breaks (cutaways, card wall, flash) last **0.5–2 s**.

---

## 7. Transitions

| Type | Use |
|---|---|
| **Jump cut + reframe** | The default. Alternate between wide (1.00) and punched (about 1.15–1.20) so cuts feel deliberate |
| **Zoom-blur whip** | Radial/motion blur through a fast scale change (≈ 0.2 s), to switch topic or speaker |
| **Light-leak flash** | A red or orange streak sweeping across the frame (≈ 0.3 s) on an intense line |
| **Desaturate cutaway** | Black-and-white footage for a "pain" line, then a snap back to color |
| **Dark grid wall** | A cut to a dark grid background with stacked cards (social proof) |

---

## 8. Camera moves (on locked-off footage)

- **Eased push-in per sentence (the signature):** scale 1.00 → about 1.10–1.15 over the sentence (1.5–3 s), **ease-in-out**, anchored a little above the face, so the face stays near the upper-third line.
- **Snap reset:** the next jump cut resets to wide (or to a different punched framing), and the next push begins.
- **Emphasis punch:** on a hard word, a quick extra +6% over 0.15 s (ease-out), holding until the cut.
- Small drift: a subtle 1–2% horizontal pan during long sentences.

---

## 9. Texture and depth

- The footage is clean (no grain), slightly sharpened, with a shallow-depth-of-field look and a soft vignette.
- **Glow:** neon text and lines have a 2-layer glow (tight 6 px plus wide 30 px) at about 60% opacity.
- **Glossy 3D icons:** soft-lit, slightly translucent, with an edge highlight, matching the text color.
- **Glass cards:** a dark blue translucent panel, rounded corners, a 1 px bright border with a dashed glow, and a backdrop blur.
- **Motion blur** on fly-ins, whips and the line draw.

---

## 10. Smoothness at 60 fps

The reference is 30 fps. We deliver **60 fps**: the overlays, zooms, captions and graphics render at true 60 fps from continuous time. The camera footage itself is 30 fps, so each source frame shows for two output frames, and the zoom running on top keeps the motion feeling smooth. Every zoom eases (`cubic-bezier(0.65, 0, 0.35, 1)` for push-ins, `(0.16, 1, 0.3, 1)` for punches), and nothing scales linearly.

---

## 11. Do / Don't

**Do:** push in on every sentence · reframe on every jump cut · act out each phrase with one graphic · caps captions every phrase · neon on keywords · keep the face clear.

**Don't:** cover the face · put more than two accent colors on screen at once · leave a static frame longer than about 1.5 s · use two-line captions · slide graphics linearly.
