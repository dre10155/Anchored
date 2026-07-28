# Anchored — Pitch Deck Build Kit
### Institution-first · Free-pilot ask · Built for Canva

This is your deck, written slide by slide. Each slide gives you: the **title**, the exact
**on-slide copy** (paste this into Canva), a **visual** instruction (what image/screenshot
goes there), and **say out loud** (what you actually speak — this is NOT on the slide).

> **Golden rule:** the slide holds few words; *you* provide the words. Never read the slide
> to them. One idea per slide. Big text. Real screenshots, not clip art.

---

## How to build it in Canva (10 minutes of setup)

1. Canva → **Create a design → Presentation (16:9)**.
2. Search templates for **"Pitch Deck"** — pick a **clean, corporate** one (lots of white
   space, one accent colour, simple sans-serif font). Avoid anything flashy or "techy."
3. Set the accent colour to Anchored blue: **#2563EB**. Background: white or very dark navy
   (#0B0F19) — pick one and stay consistent.
4. Font: a clean sans-serif (Inter, Montserrat, or Poppins). One font, two sizes.
5. Paste each slide's copy below into the matching template slide. Delete filler slides.
6. Capture the screenshots listed in the "Screenshots to grab" section and drop them in.
7. Export: **Share → Download → PDF Standard** (to email) and present live from Canva.

**12 slides. Aim for a 7–10 minute talk, leaving lots of room for their questions.**

---

## Screenshots to grab first (from anchor-ed.vercel.app)

Take these on a clean browser window, then crop tight:

1. **The Verify page showing 🟢 green** — "Credential Verified ✅ — issued by \<domain\>"
   with the credential details below. (Verify a real credential to get this.)
2. **The Verify page showing 🔴 red** — "Not Verified ❌" (upload a tampered file, or edit
   one field in a credential's JSON and verify it).
3. **The Issue page** — the form with a credential type selected.
4. **The success screen** — "minted successfully" with the QR code visible.
5. *(Optional)* the batch screen — "Anchor 50 credentials with one signature."

Also: **record a 90-second screen video** of the full flow (issue → verify green → tamper →
verify red). Live demos fail on bad wifi — you must have this as backup on your laptop and
phone.

---

# THE 12 SLIDES

---

## Slide 1 — Title
**On slide:**
> # Anchored
> ### Tamper-proof credentials, verifiable in seconds.
> Andreas Mendes · anchor-ed.vercel.app

**Visual:** the anchor icon + wordmark, centred, lots of space. Clean.

**Say:** "Thank you for making the time. In the next few minutes I'll show you a way to make
your institution's credentials impossible to forge, and verifiable by anyone in the world in
seconds — and I'll demonstrate it working, live."

---

## Slide 2 — The problem
**On slide:**
> ## A credential is only as good as someone's ability to check it.
> - A graduate applies for a job or visa abroad → the credential must be verified
> - Today that means phone calls, emails, or paid agencies — days to weeks
> - Forged diplomas and transcripts are a real, growing industry

**Visual:** a diploma with a large "REAL OR FAKE?" overlay, or a clock/hourglass.

**Say:** Open with *their* reality. "When an employer overseas contacts you to confirm one of
your graduates — how does that work today? How long does it take?" Let them answer. Then:
"That gap is the problem. And it's the same gap a forger walks through."

---

## Slide 3 — The cost  (Template 4 — reuse the 3 number blocks; DELETE the TAM/SAM/SOM labels)
Title: **THE COST**

Fill the three number blocks with these verified stats (drop the "TAM/SAM/SOM" labels):

| Number | Caption |
|---|---|
| **7,600** | Fake nursing credentials made in one 2023 U.S. scheme (Operation Nightingale) |
| **2,500** | Passed the national exam and were hired into hospitals before being caught |
| **$10K–17K** | The price of a single fake diploma |

**Bottom paragraph (replaces the "65M SMEs" text):**
> Today, verifying one credential costs money and takes days to weeks — so most are never
> checked at all. That gap is where fraud survives.

**Source line (small footer):** U.S. DOJ / HHS-OIG, *Operation Nightingale* (2023)
**Center image:** swap the building for a hospital / nurse / diploma image.

**Say:** "Seven thousand six hundred fake nursing credentials, in one scheme. Twenty-five
hundred of those people passed the national exam and were *working in hospitals* before
anyone caught it — and each fake sold for ten to seventeen thousand dollars. There's a
lucrative market in forgery, and the only thing standing against it is verification — the
same gap that lets a fake [Institution] diploma pass as real."

*(All three figures verified against DOJ/HHS-OIG reporting. The "$114M" total sometimes
cited was NOT confirmable — use these counts, not a dollar total.)*

---

## Slide 4 — The solution
**On slide:**
> ## Anchored makes every credential you issue tamper-proof and instantly verifiable — free, forever.
> You issue. The graduate holds. Anyone verifies in seconds. Forgery becomes impossible.

**Visual:** three simple icons in a row — **Issue → Hold → Verify**.

**Say:** "Here's the whole idea in one sentence." Read the headline slowly. "Verification is
free and permanent. You'll never pay to check a credential, and neither will an employer."

---

## Slide 5 — How it works  (4-step lifecycle — the 4 real product features)
Title: **HOW IT WORKS**

Four steps (add a 4th column to the template — copy a column, narrow all four):

| # | Title | One line |
|---|---|---|
| 01 | **ESTABLISH IDENTITY** | The institution links its wallet to its own domain, once. Every credential then shows "issued by your-domain.edu" — provably yours. |
| 02 | **ISSUE** | Enter a graduate's details, or upload a whole class, and approve on your phone. A salted fingerprint is anchored on the ledger — no student data is ever published. |
| 03 | **VERIFY** | Anyone scans the QR or uploads the file. In seconds: genuine or not. Free, no login, no phone calls. |
| 04 | **REVOKE** | Rescinded a degree? Revoke it. Verifiers instantly see it as revoked — something paper can never do. |

**Caption (the differentiator):** Most systems stop at "issue and verify." Anchored covers
the whole lifecycle — identity, issuance, verification, and revocation.

**Top images:** two real screenshots — the `/identity` handshake and the green "Verified"
result.

**Say:** "Four steps. First the institution proves who it is — one setup binding its wallet
to its domain, so its credentials always show 'issued by your university.' Then it issues —
one graduate or a whole class in a single approval. Anyone can verify in seconds, free. And
if a degree is ever rescinded, the institution revokes it. Most systems only do the middle
two — we do the whole lifecycle."

*(Confirmed against the codebase: routes /identity, /issue, /verify, /revoke.)*

---

## Slide 6 — See it live
**On slide:**
> ## Let me show you.
> Issue → Verify ✅ → Tamper → Verify ❌

**Visual:** side-by-side screenshots of 🟢 **Verified** and 🔴 **Not Verified** (so the slide
still tells the story if the live demo fails).

**Say:** Switch to the live app (or the video). Do the 3-minute demo: issue a credential,
verify it green, change one letter, verify it red. Narrate simply: "Watch — genuine. Now I
change one character… and it's rejected. There's no way to fake it."

---

## Slide 7 — Why you can trust it
**On slide:**
> ## Built on proven, secure public infrastructure.
> - The verification record lives on the **XRP Ledger** — established public infrastructure,
>   energy-efficient and carbon-neutral
> - **No cryptocurrency, no tokens, no fees** to issue or verify
> - **Open-source** and independently auditable — nothing hidden
> - **We never hold your keys** — only your institution can issue in your name

**Visual:** simple trust icons (shield, lock, open-book).

**Say:** Defuse the blockchain concern directly. "You may hear the word 'blockchain.' Here's
what it means for you: a permanent, tamper-proof public record — the same kind of secure
infrastructure banks use. Here's what it does *not* mean: no crypto, no fees, no volatility,
nothing for you or your graduates to buy or manage."

---

## Slide 8 — What it means for Saint Lucians
**On slide:**
> ## A Saint Lucian credential, trusted anywhere in the world.
> - Every graduate working abroad carries a credential a foreign employer can verify instantly
> - Nurses, teachers, hospitality professionals, tradespeople — verifiable globally
> - Controlled by Saint Lucia, not a foreign vendor
> - No graduate waiting weeks for a verification that decides their future

**Visual:** a world map with Saint Lucia highlighted, or a graduate + passport image.

**Say:** This is the heart of the pitch — slow down here. "Our people work everywhere. Every
one of them, applying abroad, has to prove their credential is real. This makes a Saint
Lucian diploma instantly trusted, anywhere. That's not just convenience — that's
opportunity for our graduates and a competitive edge for the country."

---

## Slide 9 — The vision
**On slide:**
> ## [Institution] can be first.
> - The first institution in Saint Lucia — among the first in the Caribbean — to issue
>   credentials this way
> - A clear signal to students, employers, and partners: your credentials are modern and trustworthy
> - A foundation the whole country could build on

**Visual:** the institution's logo (if appropriate) beside a "1st" / pioneer motif.

**Say:** "Someone will be first to do this in Saint Lucia. It should be you. It costs little
to lead, and it says everything about how seriously you take the value of your credentials."

---

## Slide 10 — The ask
**On slide:**
> ## Let's run a free 60-day pilot.
> - We issue **50 real credentials** for one program — at **no cost** to you
> - You see the full flow: issue, distribute, verify
> - **Success =** credentials issued, graduates can verify, your team is comfortable
> - At the end, we decide together whether to expand

**Visual:** a simple 60-day timeline, or a checklist.

**Say:** "I'm not asking you to buy anything today. I'm asking for a small, no-risk trial —
one program, 50 credentials, sixty days, free. If it works, we talk about more. If it
doesn't, you've lost nothing." Then stop talking and let them respond.

---

## Slide 11 — Who's behind this
**On slide:**
> ## Who's behind Anchored.
> - **Andreas Mendes** — Saint Lucian · Lead Frontend Developer, CIBC · builds secure
>   financial software
> - Anchored is **live, open-source, and documented** with a full technical whitepaper
> - Built here, for Saint Lucia first

**Visual:** a simple headshot + the CIBC / whitepaper as small credibility marks.

**Say:** Keep it brief and humble. "I build secure software for a bank by day. I built this
because it's a real problem I can solve, and I wanted to build it for home first."

---

## Slide 12 — Close
**On slide:**
> ## Let's make Saint Lucian credentials unforgeable.
> **Try it now:** anchor-ed.vercel.app
> Andreas Mendes · [email] · [phone]

**Visual:** the Anchored wordmark, calm and confident. Big QR code linking to the live site
is a nice touch.

**Say:** "I'd love to set up that pilot. What would be the right next step on your side —
and is there anyone else who should see this?" (You're asking for the next meeting and the
next contact. That's the only goal of this meeting.)

---

# Adapting this for the GOVERNMENT pitch (later)

When you eventually pitch a Ministry, keep slides 1–8 almost unchanged and swap three:

- **Slide 9 → "A national credential system."** Position it as Saint Lucia becoming the first
  country in the region with verifiable national credentials — a legacy/nation-building
  framing a Minister responds to.
- **Slide 10 → the ask becomes an endorsement + a pilot with ONE government-run institution**
  (e.g. a nursing school or the licensing council), not a purchase.
- Add a slide on **diaspora & labour mobility** — verifiable credentials help Saint Lucians
  get jobs abroad and protect the country's professional reputation. Government cares about
  this more than any single institution does.

Lead every government meeting with *"I'm already piloting this with [Institution]"* — walk in
with proof, never just an idea.

---

# Presentation-day checklist

- [ ] Deck exported as PDF (on laptop + emailed to yourself as backup)
- [ ] 90-second demo video downloaded to laptop AND phone (for when wifi fails)
- [ ] Live app open and tested on the venue wifi *before* you start
- [ ] Printed one-page leave-behind to hand over
- [ ] Dress: bank-meeting formal, not startup casual
- [ ] Business cards or a written contact
- [ ] **Follow up within 24 hours** of the meeting — every time

---

*This is a private working document. It is intentionally not committed to the public repo.*
