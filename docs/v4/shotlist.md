# Shotlist — Northstar launch film (round 4)

**Format:** 15.0 s · 16:9 · 1920×1080 · **60 fps (900 frames)** · silent · Remotion
**Style:** the grammar in [`style_guide.md`](style_guide.md). The smoothness rules in §10 apply to every shot.
**Structure (your brief):** three ALL-CAPS promises, each followed straight away by the app proving it.
`GET A JOB` → job guide · `NO TECH SKILLS REQUIRED` → Companion · `WIFI INCLUDED` → map offline + Wi-Fi spots.

---

## Northstar translation of the grammar

| Reference grammar | Northstar version |
|---|---|
| Warm field / bright field / ink / dark | Warm `#F7F6F2`, bright `#FFFFFF`, ink `#111111` (`css/app.css`), dark `#111111` |
| Single accent (blue) | **Amber `#FFD43B`**, Northstar's one signature color. On light backgrounds it's used as a **highlighter sweep behind the word** (amber text on white fails contrast); on dark it can color the word itself |
| Thick accent caret | Ink caret on light, amber caret on dark |
| Inter-like 600–800 | **Plus Jakarta Sans** 600 for statements, **800 ALL CAPS** for the three promises (the app's real font) |
| Product logo | **The new N★ mark** (`assets/brand/northstar-mark.svg`: cream N + amber star) on its own dark rounded tile, exactly as drawn |
| Pointer cursor | **Touch dot**: a soft 44 px circle (ink at 20%, white ring) that glides between targets on eased curves and dips on tap. It's the phone-app version of the gliding pointer |
| Dot-grid background | Same grammar, with dots in ink and gray plus a few **amber** dots |
| Floating labeled chips | Northstar's own chips: `Beds`, `Meals`, `Wi-Fi`, `No ID needed`, `$25/hr · Cash` |

## Where every pixel comes from

| Element | Source |
|---|---|
| Logo | `assets/brand/northstar-mark.svg` (newest mark, Sep 30) |
| Gig cards | `launch-video/public/screens/gigs.png` (real `opportunities.html`), plus vector chips in the app's styles |
| Job guide | The round-3 rebuild from `expo-app/JobGuide.js` + `guideScript.js` (arrow, ring, card styles, verbatim step copy), retimed to this film's smoothness rules |
| Companion | `companion.html` capture (real header, chips, input) with the conversation drawn in the app's own bubble styles |
| Resume step | `resume-builder.html` capture ("How can employers reach you?", Step 1 of 5) |
| Map + Wi-Fi | **New capture** of `resource-map.html` after tapping the real **Wi-Fi** chip (`toggleCategoryFilter('wifi')`) |
| Offline | **New capture** of the map's real **Offline** panel ("Download a list of shelters, food and health care near Seattle, with a map. It opens on your phone with no signal.") with the button's real states **Download → Downloading... → Saved** (`js/offline-map.js`) |

---

## Shots

### S1 · Logo hook (0.00–1.40 · f0–84)
- Soft aura background: warm `#F7F6F2` with a faint amber glow and a faint navy glow drifting slowly.
- **0.10–0.60:** the N★ tile blurs in (blur 20 → 0, scale 1.2 → 1.0, ease-out expo).
- **0.60–1.10:** `Northstar` types on beside it (Jakarta 700, 120 px, about 14 characters per second, ink caret). The tile slides left as the word grows, keeping the pair centered.
- **1.10–1.40:** the caret blinks once, then the whole lockup blurs out as the camera keeps pushing (+3%).

### S2 · GET A JOB (1.40–2.60 · f84–156)
- Bright white field.
- ALL-CAPS headline with scale contrast: `GET A` (small, 56 px) stacked over `JOB` (big, 200 px). Each line blurs in, staggered 0.1 s.
- **1.80–2.20:** an **amber highlighter sweeps** behind `JOB`, left to right.
- **2.00–2.60:** three real gig cards (pay chip `$25.00 / hr`, `No ID needed`) **burst out between the lines** at small 3D angles, drifting. The camera pushes toward the center card.

### S3 · The job guide (2.60–6.20 · f156–372) · the proof
- **Push-through:** the center gig card becomes the phone screen. The phone enters tilted (rotateX 18°, rotateZ −6°) and **settles flat** over 0.8 s.
- One continuous take inside the phone, retimed from round 3:

| Time | Action | Guide card (verbatim app copy) |
|---|---|---|
| 2.80 | The touch dot glides to **View listing**, taps; the listing opens inside Northstar (yellow `‹ Northstar` pill) | — |
| 3.30 | The arrow bounces on `reply`, the ring pulses; the touch dot glides in and taps | **First** · Tap "reply" |
| 4.00 | The options open; the arrow **glides** to `email`; tap | **Next** · Tap "email" |
| 4.60 | The card grows; the message box **streams in line by line** (blur-in, block drifting up) | **Finally** · Open Gmail and send it |
| 5.30 | Tap **Open Gmail**; the plain, unbranded compose sheet slides up already filled; tap **Send** | — |
| 5.80 | Card turns green | **Done** · You applied! |

- Camera: a slow 3% drift, gliding between the post (top) and the card (bottom), never cutting.
- Exit: background crossfades **white → mid-gray → dark** while the phone drifts down and out.

### S4 · NO TECH SKILLS REQUIRED (6.20–7.40 · f372–444) · split screen
- **The dark panel slides in** from the left over the crossfade (it covers 45% of the frame).
- On the panel, ALL CAPS in white, three lines blurring in one after another: `NO TECH` / `SKILLS` / `REQUIRED.`. **`REQUIRED.` is amber** (on dark it's legible).
- Right panel (warm field): the real Companion input bar ("Ask Companion"), large and tilted 8°, settling flat.

### S5 · Companion (7.40–10.20 · f444–612)
- **7.40–8.20 · macro type:** the camera pushes 3.5× into the Companion input. The words type on **giant**: `how do i make a resume?`, lowercase, the way people actually type.
- **8.20–8.60:** the touch dot taps send. Pull back to the full phone (Companion screen), and the question becomes the black user pill.
- **8.60–9.50 · streaming answer:** the Companion bubble streams line by line (blur-in, block drifting up):
  `Easy. Tap Resume and answer 5 short questions.`
  `I'll turn them into a clean resume for you.`
  Then an amber button chip blurs in: `Start my resume`.
- **9.50–10.20:** the touch dot glides and taps it, and the screen pushes through to the real **Resume, Step 1 of 5: "How can employers reach you?"**. A floating chip drifts by beside the phone: `Everyday work counts.`

### S6 · WIFI INCLUDED (10.20–11.20 · f612–672)
- Bright field with a **dot grid** (gray dots plus a few amber ones twinkling like map spots).
- ALL CAPS with an **inline chip** (the reference's chip-between-words grammar): `WIFI` **[amber chip with the Wi-Fi icon]** `INCLUDED`. The words blur in and the chip springs in between them.

### S7 · Map: Wi-Fi spots + offline (11.20–13.80 · f672–828)
- The phone settles in from a 3D tilt, showing the real map.
- **11.40:** the touch dot taps the real **Wi-Fi** chip. The map swaps to the Wi-Fi-filtered capture, and its Wi-Fi pins **blur in one by one** (staggered 0.06 s).
- **12.30:** the touch dot taps **Filters → Offline**; the real offline panel slides up (its real copy).
- **12.90:** tap **Download** → `Downloading...` (with a thin progress shimmer) → **`Saved`**.
- **13.30:** a floating chip drifts in beside the phone, with the dark tile and amber icon: `wifi_off` · `Opens with no signal.`

### S8 · Lockup (13.80–15.00 · f828–900)
- Bright field. The N★ tile blurs in big (scale 1.4 → 1.0), then **slides left** as `Northstar` slides out from behind it (Jakarta 700, 96 px).
- Gray subline: `Help is closer than you think.` (the app's real tagline).
- Hold with a 1.5% drift until the last frame.

---

## Rhythm check

| Shot | Length | Role |
|---|---|---|
| S1 | 1.40 | Logo hook |
| S2 | 1.20 | **GET A JOB** |
| S3 | 3.60 | Proof: job guide |
| S4 | 1.20 | **NO TECH SKILLS REQUIRED** |
| S5 | 2.80 | Proof: Companion → resume |
| S6 | 1.00 | **WIFI INCLUDED** |
| S7 | 2.60 | Proof: Wi-Fi spots + offline |
| S8 | 1.20 | Lockup |
| **Total** | **15.00** | 8 shots; each promise is followed straight away by its proof |

## Smoothness, specifically
- Rendered at **60 fps**. All timing uses continuous seconds (no 30 fps steps). The round-3 job guide gets retimed onto this.
- Every arrival is eased (`0.16, 1, 0.3, 1`) and every move takes ≥ 0.35 s. Every beat drifts, nothing pops, and beats overlap by 0.1–0.2 s.
- Velocity-scaled motion blur on the phone swings, the card burst, the touch-dot glides and the split-panel slide.

---

## Open questions

1. **Logo:** I'm using the newest mark, the **N★** (`northstar-mark.svg`, cream N + amber star on dark). There's also a gold tile version (`assets/northstar-logo-new.png`, Sep 13), but neither file is referenced by the app's HTML yet. Which one is "the new logo"?
2. **Companion answer:** the two lines in S5 are demo copy in Companion's voice, not live AI output. OK?
3. **Touch dot vs. cursor:** the reference uses a desktop pointer. For a phone app I'd use a gliding touch dot. OK?
4. **Composition:** this becomes `NorthstarLaunch4` (16:9, 60 fps). Want a 9:16 reel version too, like round 3?
