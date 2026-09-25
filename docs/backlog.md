# Backlog

Ideas considered and deliberately deferred, with the reasoning — so they can be
picked up later without re-deriving why they were shaped the way they were.

---

## Student ID as the lookup key

**Idea:** index credentials by the institution's own student number rather than
by name, so staff can search the dashboard by ID.

**Why it matters:** it changes what may be stored, and therefore where.

The ledger carries only a **salted** hash, and the salt is random per
credential, so a student ID cannot be used to derive the hash. Lookup always
needs a mapping held off-ledger. (Deriving the salt from the ID *would* make the
ledger searchable and must not be done — it would let anyone brute-force which
credentials exist for a given student.)

But the mapping itself becomes far less sensitive:

| Stored | Risk | Can live |
|---|---|---|
| `name → nftId` | Directly identifying | On the issuing device only |
| `studentId → nftId` | Pseudonymous — resolvable only in SONIS | Defensibly server-side, so lookup works across devices |

That is the route to cross-device search without Anchored holding student names.

**Shape when built:**

- Add `studentId` as an **optional** field on the `diploma` credential type. It
  sits in the credential (visible to whoever the graduate shares it with, which
  is normal for a transcript) and still never reaches the ledger.
- Index locally by both name and ID; let the dashboard search either. This needs
  no policy change and works immediately.
- Only if SALCC asks for cross-device lookup, propose the **ID-only** index as a
  hosted service.

**Before any hosted version:** a student number is still personal data under
most privacy regimes — pseudonymous, not anonymous — and combined with
institution and programme it can re-identify someone in a small cohort. It would
need the College's explicit agreement and an update to Section 7 of the SALCC
proposal, not a quiet addition.

---

## Capture names at mint time

**Idea:** save `nftId → name` to `localStorage` as a credential is issued, so
the dashboard names it automatically with no manifest to load.

**Why it is still worth doing:** single mints produce **no manifest at all**, so
the file-import route can never name them. This is the only way to cover them.

**Constraints:** per-browser, per-device, per-profile, per-origin — invisible in
another browser or after site data is cleared. Should be **opt-in** at mint
(default off), visible in the dashboard as a count, and clearable, since student
names at rest on a shared registrar workstation is real PII.

Pair with an **Export names** button so the mapping is portable, the same way a
batch manifest already is.

---

## PDF stamping (Module 1.5)

Stamp the QR onto the institution's own transcript PDF, so the graduate receives
their real document rather than a JSON file.

**Blocked on:** whether the SALCC pilot covers diplomas or transcripts. If
transcripts, this stops being optional.

**Known design points:** stamp the QR and embed the salt *before* hashing, or
the stamped file will not match its own anchor. Hashing bytes is brittle —
printing and rescanning breaks verification — so consider anchoring both the
structured fields and the PDF bytes. Do the stamping client-side with `pdf-lib`
so transcripts never reach the server.

---

## Network toggle (mainnet gate)

Testnet is hardcoded in `src/lib/xrplClient.ts` and referenced in the verify and
issue pages. This is the real gate on any pilot issuing credentials of record.
Not blocking while the pilot runs on testnet, as the proposals state.

---

## Scale limits, fine for a pilot

- **Verification scans cap at 2,000 transactions** — surfaced honestly in the
  dashboard, but needs an indexer at multi-year volumes.
- **QR generation costs ~13ms and ~22KB each** — roughly 124s and 218MB for
  10,000 in the browser. Options: SVG instead of PNG, a Web Worker, streaming
  ZIP, or making QRs optional above a threshold.

---

## Small fixes

- **Trim form inputs.** Values are hashed as typed, so "John Doe " is baked into
  the credential permanently with its trailing space.
- **Wire `disconnect`** into the dashboard — `useIssuerAddress` exports it, the
  page does not use it, so a connected wallet cannot be cleared.
- **`PR_DESCRIPTION.md`** is untracked in the repo root; delete or gitignore.
