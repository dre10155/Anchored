# AnchorEd — Project Overview & Progress

> Last updated: July 25, 2026

**Live app:** https://anchor-ed.vercel.app · **Repo:** https://github.com/dre10155/AnchorEd

---

## 1. What AnchorEd is

AnchorEd makes credentials **tamper-proof and verifiable in seconds** by anchoring
them on the XRP Ledger. A diploma becomes as verifiable as a blockchain transaction —
because it is one.

**One engine, many credential types.** The anchoring engine is credential-agnostic: it
hashes an opaque document, anchors it, and verifies it, knowing nothing about diplomas.
A credential type (diploma, professional license, workforce credential) is a *config
entry* — field names and labels — not a change to any cryptography or ledger logic.
Academic diplomas are the first deployment target because their fraud is the most acute
and best-documented; the same substrate covers professional licensing and employment
verification. Focused execution on diplomas, platform architecture underneath.

### The problem

Credential fraud is a public-safety crisis in the United States:

- **Operation Nightingale (2023, DOJ/HHS-OIG):** ~7,600 fake nursing diplomas sold by
  Florida schools for ~$114M — fraudulently credentialed nurses reached real patients.
- Diploma mills sell an estimated **100,000+ fake US degrees per year**.
- Legitimate verification still means phone calls to registrars or paying clearinghouses
  **$10–30 per check with days-to-weeks of turnaround**.

### How it works

1. **Issue** — The institution builds a W3C-style Verifiable Credential (VC) for the
   graduate. A **salted SHA-256 fingerprint** of the credential is minted into an NFT from
   the institution's XRPL wallet (hash in both the transaction memo and the NFT URI).
   The student receives the credential file + a QR code.
   **No personal data ever touches the ledger** — only the fingerprint.
2. **Hold** — The graduate owns their credential (JSON + QR). The salt prevents
   dictionary attacks against the on-ledger hash.
3. **Verify** — Any employer, licensing board, or agency scans the QR (or uploads the
   file). AnchorEd recomputes the salted hash and checks it against NFTs minted by the
   issuer's address. Seconds, fractions of a cent, no intermediary.

### Trust model (the four verdicts)

| Verdict | Meaning |
|---|---|
| 🟢 **Verified — issued by \<domain\>** | Hash matches a live NFT **and** the issuing wallet passed the did:web identity handshake |
| 🟡 **Anchored — Issuer Unverified** | Hash matches, but the wallet's identity is unproven (the diploma-mill case, visibly flagged) |
| 🟡 **Revoked** | Hash matches a mint transaction, but the issuer has since burned the NFT (rescinded degree) |
| 🔴 **Not Verified** | No matching anchor — likely fraudulent or tampered |

### The did:web identity handshake

Nothing on a bare ledger binds a wallet to a real university, so AnchorEd requires a
**two-way proof**:

- **Domain → wallet:** the institution hosts a DID document at
  `https://<domain>/.well-known/did.json` listing its official XRPL address
  (only someone controlling the domain can do this)
- **Wallet → domain:** the institution signs one `AccountSet` transaction putting the
  domain in the wallet's on-ledger `Domain` field
  (only someone controlling the wallet can do this)

Impersonating an institution now requires compromising its actual website *and* wallet.

### Why XRPL

- ~3–5 second finality, ~$0.0002 per transaction
- Native NFT primitives (XLS-20) — no smart-contract attack surface
- Soulbound support (non-transferable, issuer-burnable NFTs) fits credentials perfectly
- Carbon-neutral consensus; full public auditability of every credential ever issued

---

## 2. Architecture

| Layer | Tech |
|---|---|
| Frontend | Vue 3 + TypeScript + Vite + Tailwind CSS (mobile-responsive) |
| Ledger | XRPL Testnet (mainnet-ready), xrpl.js v4 |
| Signing | **Xaman (XUMM) app** — QR sign flow; seeds never touch the browser |
| Backend | Express (local dev) + Vercel serverless functions (production): Xaman payload proxy, did:web resolution proxy |
| Hosting | Vercel (auto-deploys from `main`) |
| Credential types | Config registry (`src/lib/credentialTypes.ts`) — diploma, professional license, workforce credential; the engine is type-blind |

Pages: `/` landing · `/issue` (credential-type selector, single + batch mint) · `/verify`
(file or QR camera scan) · `/revoke` (anchor burn or per-credential revocation) ·
`/identity` (did:web onboarding wizard)

---

## 3. Progress

### ✅ Phase 1 — Xaman wallet signing (done)
Removed issuer seeds from the browser entirely. Unsigned `NFTokenMint` goes to a backend
that creates a Xaman sign payload; the registrar scans a QR on their phone; the app polls
until signed and resolves the NFT ID from the validated ledger transaction.
Local-seed signing survives only behind `VITE_DEV_SEED_MODE=true` for testnet development.

### ✅ Phase 2 — Zero PII on-chain (done)
The NFT URI previously embedded raw VC JSON (student name included) truncated to 256
bytes — a permanent PII leak and corrupted data. The URI now carries only
`vc:sha256:<hash>`, giving a second on-chain binding the verifier enforces. FERPA-aligned.

### ✅ Phase 3 — Soulbound diplomas + revocation (done)
Mint flags changed from transferable to **burnable-only**: a diploma is bound to its
graduate, never a tradable asset, while the issuer keeps revocation power. New `/revoke`
page (confirmation dialog + required off-chain reason, Xaman-signed burn). Verifier
gained the amber **REVOKED** state.

### ✅ Phase 4 — did:web issuer identity (done)
Two-way domain/wallet handshake described above. New `/identity` onboarding wizard
(generates the did.json, signs the `AccountSet`, self-checks the handshake). Verifier
distinguishes 🟢 verified-identity from 🟡 anchored-but-unverified.
AnchorEd dogfoods this: `anchor-ed.vercel.app/.well-known/did.json` is live, listing the
demo issuer wallet.

### ✅ Deployed to production (done)
Live at **anchor-ed.vercel.app** with Xaman signing keys in Vercel env vars.
API + SPA routing + payload creation smoke-tested against production.

### ✅ Phase 5 — Scale: batch issuance + verifier robustness (done)
**Merkle batch anchoring, zero custody.** A roster of any size is hashed into one
Merkle tree and anchored by a *single* signed transaction carrying only the root. Each
graduate receives a credential plus a log2(n) membership proof, packaged with QR codes
and a manifest into a downloadable ZIP. A 5,000-student class costs one transaction
instead of 5,000, and AnchorEd never holds a key or mints on anyone's behalf.

The alternative considered — delegating mint authority to an AnchorEd service wallet —
was rejected: a hot key with standing authority to issue credentials for every customer
is exactly the wrong failure mode for an anti-fraud product.

Also in this phase:
- Verification checks the Merkle proof locally first, rejecting forgeries without a
  ledger query, then matches the batch root against the issuer's anchor
- Paginated ledger scans (the old 100-transaction limit silently failed to verify valid
  credentials from busy issuers)
- Credential-level revocation via signed revocation memos, so one graduate can be
  revoked without invalidating their whole class
- Roster parsing via papaparse — quoted fields, header aliases, and row-level
  validation errors surfaced before anything is anchored

**Test suite: 50 tests.** The Merkle tests caught a second-preimage vulnerability during
development (an internal node could be replayed as a leaf with a truncated proof);
leaves and internal nodes now use separate domain prefixes, with a regression test.

### ✅ Credential-type registry — one engine, many configs (done)
Proved the anchoring engine is credential-agnostic by extracting the hardcoded diploma
fields into a config registry (`src/lib/credentialTypes.ts`). A credential type is now
field names, labels, and issuer/subject nouns — the cryptography, Merkle batching, ledger
anchoring, and did:web verification are untouched and type-blind. Three types ship
(diploma, professional license, workforce credential), selectable on the issue page; the
single form, batch roster parser and preview, sample CSV, ZIP manifest, and verifier
detail panel are all config-driven, and the verifier infers a credential's type from its
fields. 51 tests. Also shipped: **mobile responsiveness**, **whitepaper**, and
**security policy**.

### ⏳ Phase 6 — Hardening (next)
Explicit Testnet/Mainnet toggle · GitHub Actions CI · extend the test suite to
canonicalization and hashing (Merkle, batch and verifier logic are already covered)

### Mainnet gate
Flip to mainnet when: Phase 5–6 land **and** the first pilot institution is ready to
issue real credentials. Mainnet launch is itself a PR moment — pair it with an
announcement.

---

## 4. Go-to-market & traction plan

**Business model:** institutions pay to issue (SaaS subscription and/or per-credential);
**verification stays free forever** — every free verification is a reason the next
institution must issue through AnchorEd. Later: a paid verification API for
HR/background-check platforms (incumbents charge $10–30 and take days; AnchorEd answers
in seconds).

**Exposure sequence (in progress):**
1. ✅ Live product + public repo
2. Demo video (mint → verify 🟢 → revoke → verify 🟡) — highest-leverage asset
3. dev.to/Medium article: *"Fighting diploma fraud with the XRP Ledger"*
4. XRPL Grants application (non-dilutive funding + third-party validation)
5. Pilot outreach: coding bootcamps (fastest yes), Saint Lucia institutions
   (home-field advantage), US community colleges / nursing schools (the Nightingale
   story). Free pilots → LOIs → paid conversion at mainnet launch.
6. Custom domain + analytics from day one

---

## 5. Current status in one line

**Five of six engineering phases complete, live in production on XRPL Testnet with
wallet-signed issuance, institutional identity, credential-level revocation, and
zero-custody batch issuance that anchors an entire graduating class in one signature —
now a credential-agnostic engine spanning diplomas, licenses, and workforce credentials,
with a whitepaper, security policy, and mobile-responsive UI. Next: hardening (Phase 6),
then mainnet with the first pilot.**
