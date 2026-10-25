# Shotlist — Northstar launch film (round 3)

**Format:** 15.0 s · 16:9 · 1920×1080 · 30 fps (450 frames) · silent · Remotion
**Style:** the grammar in [`style_guide.md`](style_guide.md) (same reference as round 1), applied to the full product brief.
**Story:** *A bed tonight → a job tomorrow.* The **step-by-step job guide** is the hero: the longest take, about 4.6 s.

---

## Northstar translation of the grammar

| Reference grammar | Northstar version |
|---|---|
| Dusk gradient bookends | Night-navy `#1B273E` → amber `#FFD43B` dawn horizon, with the four-point star from `northstar-mark.svg` as the hero object |
| White field / ink | `#FFFFFF` / `#111111` (`css/app.css`) |
| Neo-grotesk Medium, tight tracking | **Plus Jakarta Sans 600**, −0.025em (the app's real font) |
| Say → show loop | Each type card names the beat that follows it |
| Pull-back reveal from a bubble or widget | From the yellow **"Right now"** card out to the full dashboard in the phone |
| Sticker burst | **Our own glossy tiles**: Material Symbols (bed, restaurant, shower, work, star) on amber, navy and white chips. No third-party or stock objects |
| Caption + curved carousel of widgets | A curved carousel of **real Northstar screens**, including the "Give help" side |
| Accent = the product only | Amber shows up only where the app itself uses it (Right now card, pay label, guide arrow, ring, buttons) |

## Where every pixel comes from

| Element | Source |
|---|---|
| Logo tile, star mark | `assets/brand/northstar-logo.png`, `assets/brand/northstar-mark.svg` |
| Home, Right now card, Near you | Capture of `seeker-dashboard.html` (already in `launch-video/public/screens/dashboard.png`) |
| Map, bottom panel, directions + route | New capture of `resource-map.html` after tapping Directions on Downtown Emergency Service Center. If live transit times come back, I'll use them; otherwise the brief's example `Leave at 5:10 PM · Bus 545` is shown as the departure chip |
| Gig card | Capture of `opportunities.html` ("Get Paid to Lift", $25.00 / hr · Cash, No ID needed) |
| **Job guide** | **Rebuilt in vector from `expo-app/JobGuide.js` + `guideScript.js`**: the exact arrow SVG path (`#FFD43B`, 4px `#111` stroke), the 4px amber ring with its pulse, the bottom card (tag pill, 26/800 title, 16 px `#555` detail, `#FFF7D1` message box, yellow 56 px "Open Gmail" button), the yellow "‹ Northstar" pill, and the step copy verbatim |
| The job post under the guide | **A plain, unbranded post page** (title, pay, body text, `reply` button, `email` option). No Craigslist logo, name or styling |
| Mail compose | **A neutral compose sheet** (To / Subject / message, Send button). No Gmail or Google branding. The guide button keeps its real label, "Open Gmail" |
| Carousel screens | Captures of `index.html` (role: Find help / Give help), `companion.html`, `resume-builder.html`, `progress.html`, `helper-dashboard.html` ("Thanks for helping out today."), `donate.html` |

---

## Shots

### S1 · Dawn open (0.00–1.50 · f0–45) · World A
- Navy-to-amber gradient with a curved horizon. The glossy star rises off it.
- Typewriter in white with caret, 13 characters per second: `help is closer|`
- Crane up with the frame hazing lighter. **1.30–1.50:** luminance bloom to white.

### S2 · Say (1.50–2.40 · f45–72) · World B
- Ghost → ink reveal, centered, 84 px: `A bed tonight.`
- 2% drift, then a hard white-to-white cut.

### S3 · Right now → pull back (2.40–4.40 · f72–132) · World C
- **2.40:** tight crop (scale 1.6) on the real yellow **"Right now · Shelter open all night"** card.
- **2.90–3.50:** pull back to 1.0. The light phone bezel resolves around the whole dashboard (`Hi, Sam`, filters, Near you).
- **3.70:** **Get directions** shows its pressed state (darken + ring ripple, no hand), and the screen swaps to the map.
- **4.00–4.40:** the camera begins sliding the phone left.

### S4 · Directions (4.40–6.00 · f132–180) · World C
- Real map screen. The bottom panel slides up; the place card shows `Verified` and `Open now`.
- **4.80–5.60:** the route line **draws** across the map (stroke-dashoffset), bus segment then walk.
- The departure chip pops in with a spring: `Leave at 5:10 PM · Bus 545`.
- Caption at right of the phone, ghost → ink, 64 px: `Even by bus.`

### S5 · Say, part 2 (6.00–7.00 · f180–210) · World B
- `A bed tonight.` returns, then a **partial dissolve**: `A` stays, `bed tonight.` breaks into grain, and `job tomorrow.` writes on. `A` never moves.

### S6 · The job guide ⭐ (7.00–11.60 · f210–348) · World C, close-up
One continuous take. The camera stays in close-up (scale 1.3–1.5) on the phone, with no cuts.

| Time | Picture | Guide card (verbatim app copy) |
|---|---|---|
| 7.00–7.50 | The real gig card **Get Paid to Lift** · `$25.00 / hr · Cash` (yellow pay label) · `No ID needed`. **View listing** gets its pressed state | — |
| 7.50–7.80 | The listing opens **inside Northstar**: the yellow `‹ Northstar` pill top-left, the plain post below. The guide card rises from the bottom (0.32 s ease-out, matching the app's own `cardIn` timing) | tag **First** · **Tap "reply"** · *The yellow arrow shows you where.* |
| 7.80–8.70 | The **yellow arrow bounces** (14 px, matching the app's `nsBounce`) above `reply`, and the **amber ring pulses** around it. Then pressed state | (same) |
| 8.70–9.40 | A small option list appears. The arrow **glides** to `email` (eased, about 0.4 s), and the ring follows | tag **Next** · **Tap "email"** · *This shows their email address.* |
| 9.40–10.30 | The camera eases down to the card | tag **Finally** · **Open Gmail and send it** · *Your message is already written. Send it to:* `[demo address]` · message box: *"Hi, I'm Sam. I saw your post for moving help. I've unloaded trucks and prepped meals, and I can start today. My phone is (206) 555-0142."* · big yellow **Open Gmail** button, pressed |
| 10.30–11.00 | The neutral compose sheet slides up, **already filled**: To, Subject `Moving help`, and the same message. The **Send** button shows its pressed state with a touch ripple | — |
| 11.00–11.60 | Back in the app: the card turns green-tagged | tag **Done** · **You applied!** · *Nice work. Keep an eye on your phone and email.* |

- **11.00–11.60 energy spike:** Northstar's glossy icon tiles (bed, restaurant, shower, work, star) burst in around the frame edges, spring once, and fly out. The "You applied!" card stays clear at center.
- Ends with a pull-back to the full phone.

### S7 · Caption + carousel (11.60–13.00 · f348–390) · World C
- Caption, ink, 52 px at 20% height: `For finding help — and giving it.`
- Phone at center, bottom-cropped, showing the dashboard. A curved arc of real screen tiles pans behind it:
  role choice (Find help / Give help) · Companion · Resume · Progress · **Volunteer Home ("Thanks for helping out today.")** · Donate.

### S8 · Stars gather (13.00–13.60 · f390–408) · World A
- Back to the dawn. Three stars settle into the app-icon layout, and the sky tightens into the icon tile on white.

### S9 · Lockup (13.60–15.00 · f408–450) · World B
- `Meet [logo tile] Northstar` → `Meet` falls away → tile + `Northstar` re-center.
- `Help is closer than you think.` fades in below in `#737373`. Hold on the last frame.

---

## Rhythm check

| Shot | Length | Role |
|---|---|---|
| S1 | 1.50 | Slow open |
| S2 | 0.90 | Say |
| S3 | 2.00 | Show: help right now |
| S4 | 1.60 | Show: get there |
| S5 | 1.00 | Say: the turn |
| **S6** | **4.60** | **Show: the wow (job guide)** |
| S7 | 1.40 | Breadth + giving side |
| S8 | 0.60 | Bookend |
| S9 | 1.40 | Lockup |
| **Total** | **15.00** | 9 shots |

## Cut for time (from the brief)
Splash / Create account / Allow location (the role screen appears in the carousel instead) · offline saving · spoken job tips · resume Q&A · Companion chat · Stripe checkout · food pickup tracking · "Fill in for me" on employer sites. Any of these can be swapped in; S7's carousel is the easiest place.

---

## Open questions

1. **Thumb tap:** your shot idea has a thumb tapping Send. The reference never shows hands, so I've used the app's own pressed state plus a soft touch ripple. OK, or do you want an actual thumb?
2. **Third-party UI:** I'm drawing the job post and the mail compose as plain, unbranded screens rather than showing Craigslist or Gmail. OK?
3. **Demo details:** the message, phone number (a 555 number) and email address in S6 are made up for a fictional "Sam". OK?
4. **Composition:** this becomes a **third composition**, `NorthstarLaunch3`, so the first two films stay as they are.
