# Shotlist — VSL-style edit of your clip (round 5)

**Format:** 15.0 s · 16:9 · 1920×1080 · **60 fps (900 frames)** · with the clip's own audio · Remotion
**Footage:** `Downloads/20261001_054921000_iOS.MOV` (20.6 s, 1920×1080, 30 fps, talking head in a bedroom setup)
**Style:** the grammar in [`style_guide.md`](style_guide.md): eased push-in on every sentence, reframed jump cuts, caps captions, neon keywords and glossy graphics acting out each phrase.
**Not for Northstar.** All graphics are drawn from scratch (no logos or stickers from the reference).

Transcript (local, `refs/clip/transcript.json`, word timestamps). Whisper heard "$10.50", but the iPhone filename puts this at about 10:50 PM, so it's almost certainly the time.

> "Yeah, so 10:50 right now. I just finished — finished the video. I sent it to my phone, I'll just post it tomorrow morning, and probably right now what I'm gonna do is me and my partner run a DM setting offer just to get some cash to fund our Meta ad campaigns, and… Yeah, I'm just gonna send the daily dose of DMs for that, update the CRM, and I'll hop right into sales after that."

---

## The 15 s cut (20.6 s → 15.0 s with jump cuts)

| Cut | Source (s) | Words kept | Length |
|---|---|---|---|
| A | 0.74 – 1.98 | "so 10:50 right now." (drops "Yeah,") | 1.24 |
| B | 2.08 – 2.62 + 3.14 – 3.88 | "I just finished · the video." (removes the stutter "finished finished") | 1.28 |
| C | 4.36 – 6.50 | "I sent it to my phone, I'll just post it tomorrow morning" | 2.14 |
| D | 7.72 – 13.18 | "what I'm gonna do is me and my partner run a DM setting offer just to get some cash to fund our Meta ad campaigns" | 5.46 |
| E | 14.80 – 19.68 | "I'm just gonna send the daily dose of DMs for that, update the CRM, and I'll hop right into sales" | 4.88 |
| | | **Total** | **15.00** |

Audio: each cut gets a 20 ms crossfade so the jump cuts don't click. Framing alternates on every cut (wide 1.00 ↔ punched 1.16) so the jumps read as intentional.

---

## Shots

### A · Hook: "so 10:50 right now." (0.00–1.24)
- Framing: **punched (1.16)**, then an eased push to 1.24 over the cut.
- **"10:50"** flies in letter by letter as **neon cyan Black caps** (130 px) in the upper-left negative space, with a small "PM" beside it. A glossy cyan **clock icon** (drawn) pops at its right edge.
- Caption: `SO 10:50 RIGHT NOW.`

### B · "I just finished the video." (1.24–2.52)
- Jump cut → **wide (1.00)**, with a push to 1.10.
- A glossy **play-button card** (cyan glass, rounded) pops beside the head, then a green **check** stamps onto it on "video".
- Caption: `I JUST FINISHED THE VIDEO.`, with **FINISHED** in green.

### C · "I sent it to my phone… post it tomorrow morning" (2.52–4.66)
- Jump cut → **punched (1.16)**, with a push to 1.24.
- On "phone": a small glossy **phone icon** with a "1 new" notification dot pops at the upper right.
- On "tomorrow morning": the phone icon is **pushed out** by a **badge pill** (deep blue gradient) that reads `POSTING TOMORROW AM`, with a drawn **sunrise icon** at its edge.
- Caption phrases: `I SENT IT TO MY PHONE` → `I'LL POST IT TOMORROW MORNING`.

### D · The plan (4.66–10.12) · 5.46 s, two internal beats
- Jump cut → **wide (1.00)**, with a slow eased push to 1.14 across the whole sentence plus a 1.5% pan.
- **4.9 s, "what I'm gonna do is":** caption only (build anticipation).
- **5.5 s, "me and my partner":** two small glass **name chips** float up beside the head: `ME` + `PARTNER`, linked by a thin glowing line.
- **6.3 s, "DM setting offer":** the chips are **pushed out** by the hero badge: `DM SETTING OFFER`, with a drawn **chat-bubble icon** at its edge. **Emphasis punch** (+6%).
- **7.6 s, "cash":** the neon keyword **CASH** flies in, in **green** (`#14FF75`).
- **8.4 s, "fund our Meta ad campaigns":** a **green trend line draws** upward across the frame behind the head, and the neon word **ADS** lands at its peak. Counter beside it: `$0 → $$$` (symbolic, no invented numbers).
- Caption phrases follow the speech: `WHAT I'M GONNA DO IS` → `ME AND MY PARTNER` → `RUN A DM SETTING OFFER` → `JUST TO GET SOME CASH` → `TO FUND OUR META AD CAMPAIGNS`.

### Pattern break (10.12)
- **Zoom-blur whip** (0.2 s) into cut E: radial blur through scale 1.14 → 1.30 → snap to the new framing.

### E · The grind (10.12–15.00) · 4.88 s, three beats
- Framing after the whip: **punched (1.16)**, with a push to 1.26 by the end.
- **"daily dose of DMs":** three **DM bubbles** stack up beside the head, one after another (glass cards with blank message lines, no fake names or text), plus a counter chip `DMs ✓`.
- **"update the CRM":** the bubbles are pushed out by a **glass checklist card**, `CRM`, with three rows ticking ✓ in sequence.
- **"hop right into sales":** the neon caps keyword **SALES** flies in big (140 px, cyan) and a **red light-leak flash** sweeps across, with a final **emphasis punch** on "sales".
- Caption phrases: `I'M JUST GONNA SEND THE DAILY DOSE OF DMS` → `UPDATE THE CRM` → `AND I'LL HOP RIGHT INTO SALES`, with **SALES** in red.
- Last 0.25 s: hold on the punched frame with the caption.

---

## Rhythm check

| Beat | Start | Length | Visual event |
|---|---|---|---|
| A | 0.00 | 1.24 | Neon "10:50" + clock |
| B | 1.24 | 1.28 | Play card + green check |
| C | 2.52 | 2.14 | Phone → "POSTING TOMORROW AM" badge |
| D | 4.66 | 5.46 | ME + PARTNER → DM SETTING OFFER → CASH → trend line + ADS |
| E | 10.12 | 4.88 | Whip → DM stack → CRM checklist → SALES + flash |

A new visual about **every 1.0–1.3 s**. A push-in on every cut, alternating wide and punched framing. One pattern break (the whip) at the 2/3 mark.

## Smoothness
- Output **60 fps**. Zooms, captions and graphics are computed from continuous time. The 30 fps footage shows each source frame twice, while the eased zoom on top keeps motion fluid.
- Push-ins use ease-in-out, punches use ease-out, and nothing moves linearly. Motion blur on fly-ins, the whip and the line draw.

---

## Open questions

1. **"10:50":** I'm reading "$10.50" as the time, **10:50 PM**. Correct?
2. **Name chips:** OK to label them `ME` + `PARTNER`, or do you want real names or handles?
3. **Ending:** the cut ends on "…hop right into sales." Do you want an end card (a name, handle or CTA) in the last ~1 s? It would trim about 1 s of speech.
4. **Audio:** keep your original audio only, or add a music bed under it (you'd need to supply a track you have rights to)?
