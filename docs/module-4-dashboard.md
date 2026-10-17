# Module 4 — Registrar dashboard

Implementation guide, written as a handoff for a developer new to this
codebase.

**What it is:** a page where an institution sees every credential it has issued
and revoked, in one place, read from its own wallet.

**Why it matters:** SALCC's Vice-President asked for this directly, and it is
named as a committed deliverable in the pilot proposal. Today a registrar can
issue and revoke, but has no way to see what they have done.

---

## Getting set up

```bash
git clone https://github.com/dre10155/Anchored.git
cd Anchored
npm install
npm run dev          # app on :5173, API on :8787
```

You do **not** need an XRPL wallet, testnet XRP, or any API key to build this
module. It reads public ledger data. Use this account, which has real
credentials anchored on the XRPL **testnet**:

```
rNeqwL8sjHvi4TndDCrYqYDh1dQKNBekhv
```

Useful background, in reading order: `README.md`, then `WHITEPAPER.md` sections
4.1–4.3 if you want the cryptography (you do not need it for this module).

**Branch:** off `anchored_mvp2/develop`, named something like
`feature/module4-dashboard`. Open a PR when ready; do not push to `main`.

---

## How the system works, in one page

An institution issues a credential by writing a **salted SHA-256 hash** of it
into an NFT minted from the institution's own XRPL wallet. **No personal data
ever goes on the ledger** — only the hash. The graduate keeps the actual
credential file.

Revocation means **burning** that NFT, or publishing a signed revocation record
for a single credential inside a batch.

Two shapes of issuance:

| | On the ledger | Notes |
|---|---|---|
| **Single** | One NFT per credential, URI `vc:sha256:<hash>` | |
| **Batch** | One NFT per class, URI `vc:merkle:<root>` | Covers every graduate in it |

So a wallet holding 11 NFTs might represent 11 credentials, or 2 credentials and
a class of 400.

**The privacy consequence, and the central design constraint of this module:**
the ledger cannot tell you *who* a credential belongs to. Names, programmes and
grades are not there, by design. A dashboard can therefore show *what was
issued and when*, but not *whose it is* — unless the institution supplies that
from its own records. Do not try to work around this. It is the property the
whole product is sold on.

---

## What to build

A new page at `/dashboard`, registered in `src/router/index.ts` alongside the
existing routes, and linked from the navigation in `src/App.vue`.

### Input

One field: the institution's issuing wallet address. No login — accounts are
Module 3, and this must work without them.

Persist the last-used address in `localStorage` so a registrar is not retyping
it. Wrap reads and writes in `try/catch`; private windows throw.

### The table

For each anchor held by that wallet:

| Column | Source |
|---|---|
| Type | `vc:sha256:` → Single · `vc:merkle:` → Batch (decode the NFT `URI` from hex) |
| Anchored | Transaction date |
| Reference | The hash or Merkle root, truncated, with copy-to-clipboard |
| NFT ID | Truncated, with copy |
| Status | Live, or Revoked |
| Link | To the transaction on an XRPL explorer |

Sort newest first. Include a summary row above: total anchored, live, revoked.

### Revoked entries are the hard part

A burned NFT **no longer appears** in `account_nfts` — that is what revocation
means. So a dashboard built only from `account_nfts` shows live credentials and
silently loses every revoked one, which is the opposite of what a registrar
needs.

To show revocations you must read the wallet's **transaction history** rather
than its current holdings: `account_tx` surfaces both `NFTokenMint` and
`NFTokenBurn`. `src/lib/verify.ts` already does exactly this kind of scan —
read `scanIssuerLedger` before writing anything, and reuse its pagination
approach rather than writing a new one.

Known limit: that scan caps at 2,000 transactions. Say so in the UI when the cap
is hit ("showing the most recent 2,000 transactions") rather than quietly
truncating. Fixing it properly needs an indexer and is out of scope.

### Filters

Credential type, status (live/revoked), and a date range. Keep it simple; a
registrar with 400 credentials mostly wants "what did we issue this year".

### Export

Download the table as CSV. Registrars live in spreadsheets, and this is often
the feature they use most.

---

## Constraints — please do not work around these

1. **Never put personal data on the ledger, and never expect to read it from
   there.** If the dashboard seems to need a name to be useful, that is a
   product conversation, not a code problem.
2. **No private keys, ever.** The app never asks for a seed. Everything that
   signs goes through the Xaman app on the user's phone. This module signs
   nothing — it is read-only.
3. **Read-only.** No minting, no burning. Revocation stays on its own page,
   behind its existing confirmation dialog.
4. **Testnet.** `wss://s.altnet.rippletest.net:51233` is hardcoded in
   `src/lib/xrplClient.ts`. Leave it; making the network switchable is a
   separate piece of work.
5. **Match the existing look.** Tailwind, the dark gradient page with a white
   card, as on `/issue` and `/verify`. Reuse those patterns rather than
   introducing a new style.
6. **Mobile matters.** Wide tables must scroll inside their own container —
   the page itself must never scroll sideways.

---

## Definition of done

- [ ] `/dashboard` route, linked in the nav
- [ ] Entering a wallet address lists its anchors, newest first
- [ ] **Revoked credentials appear, marked as revoked** — the part most likely
      to be missed
- [ ] Counts for total, live and revoked
- [ ] Filter by type, status and date; export to CSV
- [ ] The 2,000-transaction cap is stated in the UI when reached
- [ ] Sensible empty state for a wallet with no credentials, and a clear error
      for an address that does not exist on the ledger
- [ ] Loading state — a ledger scan takes a few seconds
- [ ] Works on a phone
- [ ] `npm run build` clean, `npm test` still passing (66 tests today)

---

## Where to look

| File | Why |
|---|---|
| `src/lib/verify.ts` | `scanIssuerLedger` — transaction scanning, pagination, revocation detection. **Read this first** |
| `src/pages/IssueDiploma.vue` | `fetchMintedNfts` already lists a wallet's NFTs; the closest existing example |
| `src/lib/credentialTypes.ts` | The credential type registry, for labels |
| `src/router/index.ts` | Where to register the route |
| `src/pages/VerifyDiploma.vue` | Result-state styling conventions to match |

---

## Out of scope

- **Login and accounts** (Module 3) — the dashboard takes an address for now
- **Anything that writes to the ledger**
- **An indexer** to get past the 2,000-transaction cap
- **Per-graduate rows for a batch.** The ledger holds one anchor for a whole
  class; expanding it into individual students would need the roster, which the
  institution holds, not us

---

## Questions

Ask. Several constraints here exist for security or privacy reasons that are
not obvious from the code, and a reasonable-looking shortcut can undo a property
the product is sold on.
