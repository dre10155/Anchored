# Module 4 — Dashboard implementation

Prescriptive guide. The companion document `module-4-dashboard.md` covers the
brief and the constraints; this one is the code.

**Scope:** a read-only `/dashboard` page showing every credential an institution
has anchored and revoked, for a given issuing wallet.

---

## The central problem

The obvious implementation — list the wallet's NFTs with `account_nfts` — is
wrong, and wrong in a way that looks fine in testing.

**Revocation burns the NFT.** A burned NFT is gone from `account_nfts`
entirely. So a dashboard built from current holdings shows live credentials and
**silently omits every revoked one** — the precise opposite of what a registrar
needs, since revocations are what they most need to see.

The dashboard must therefore be built from **transaction history**
(`account_tx`), which retains both the `NFTokenMint` and the `NFTokenBurn`.

`src/lib/verify.ts` already walks this history for a single credential. Read
`scanIssuerLedger` (line ~81) before writing anything — the new function is the
same traversal answering a different question.

---

## Step 1 — the ledger scan

New export in `src/lib/verify.ts`, beside `scanIssuerLedger` so they share the
memo constants and helpers.

```ts
export interface IssuedAnchor {
  nftId: string
  /** 'single' = one credential; 'batch' = a whole class under one Merkle root */
  kind: 'single' | 'batch'
  /** Credential hash for a single anchor, Merkle root for a batch */
  reference: string
  mintDate: string
  revoked: boolean
  revokedAt: string
  /** Hash of the transaction that minted it, for the explorer link */
  txHash: string
}

export interface IssuerAnchors {
  anchors: IssuedAnchor[]
  scannedTx: number
  /** True when maxTx was hit — older history exists but was not read */
  truncated: boolean
}

/**
 * Every anchor an issuer has minted, with its current revoked state.
 *
 * Built from transaction history rather than account_nfts: revoking burns the
 * NFT, so current holdings cannot show a revoked credential at all.
 */
export async function scanIssuerAnchors(
  client: { request: (req: any) => Promise<any> },
  account: string,
  { pageSize = 200, maxTx = 2000, onProgress }: {
    pageSize?: number
    maxTx?: number
    onProgress?: (scanned: number) => void
  } = {},
): Promise<IssuerAnchors>
```

### How to implement it

Page through `account_tx` exactly as `scanIssuerLedger` does — same request
shape, same `marker` loop, same `maxTx` guard. For each transaction:

**`NFTokenMint`** — an anchor. Read its kind and reference from the memo first,
falling back to the URI, mirroring `matchesAnchor` but without a target to
compare against:

```ts
// memo first
for (const memo of decodeMemos(tx)) {
  if (memo.type === MEMO_SINGLE && memo.data?.hash) {
    kind = 'single'; reference = memo.data.hash; break
  }
  if (memo.type === MEMO_BATCH && memo.data?.root) {
    kind = 'batch'; reference = memo.data.root; break
  }
}
// then the URI: vc:sha256:<hash> or vc:merkle:<root>
```

Skip mints that match neither — the wallet may hold unrelated NFTs, and they are
not credentials.

Get the id with `getNFTokenID(txObj.meta)` inside a `try/catch`; it throws on
malformed metadata, and one bad entry must not abort the scan.

**`NFTokenBurn`** — a revocation. `tx.NFTokenID` gives the id directly. Record
it in a `Set<string>` of burned ids with its date.

**Any transaction carrying a `vc-revoke` memo** — a single credential inside a
batch was revoked. `memo.data.hash` is the credential hash, not an NFT id, so
these do **not** map to a row; the batch anchor stays live. Count them
separately and surface the number ("3 individual credentials revoked within
batches"). Do not mark the batch revoked — the rest of the class is still valid.

**Then join:** after the walk, mark each anchor `revoked` if its `nftId` is in
the burned set.

**Order matters:** a burn can appear in history before its mint, since
`account_tx` returns newest first. Collect both, then join at the end. Do not
try to resolve it inline.

### Tests

`isExpired` has unit tests already; follow that pattern. Build fake `account_tx`
responses — no network needed:

- A mint with a `vc-hash` memo produces a `single` anchor
- A mint with a `vc-merkle` URI and no memo produces a `batch` anchor
- A burn **appearing before its mint** still marks that anchor revoked
- A `vc-revoke` memo does not mark the batch anchor revoked
- An unrelated NFT mint is ignored
- `truncated` is true when `maxTx` is reached with a marker outstanding

---

## Step 2 — the page

`src/pages/Dashboard.vue`, registered in `src/router/index.ts`:

```ts
{ path: '/dashboard', name: 'dashboard', component: () => import('../pages/Dashboard.vue') },
```

and linked in the nav in `src/App.vue` beside Issue / Revoke / Identity / Verify.

### Wallet input

One address field, and a **Load** button. The page is entirely scoped to that
one wallet.

Remember addresses in `localStorage` — you have two (`rUfojae…` bound to
mendesdigital.com, `rNeqwL8…` bound to anchor-ed.vercel.app), and an institution
may well have more than one. Store a small list and offer them as a dropdown.

```ts
// localStorage throws in private windows and when site data is blocked
function loadSaved(): string[] {
  try { return JSON.parse(localStorage.getItem('anchored:issuers') || '[]') } catch { return [] }
}
```

Validate with the same pattern used elsewhere: `/^r[1-9A-HJ-NP-Za-km-z]{25,34}$/`.

### Fetching

```ts
const result = await withXrpl((client) =>
  scanIssuerAnchors(client, address.value, {
    onProgress: (n) => { progressNote.value = `Scanned ${n} transactions…` },
  }),
)
```

`withXrpl` is in `src/lib/xrplClient.ts` and handles connect/disconnect.

A full scan takes several seconds, so the progress line is not optional.

### Summary row

Above the table: **Total anchored · Live · Revoked**, plus the count of
individual in-batch revocations if any.

### The table

| Column | Notes |
|---|---|
| Type | "Credential" / "Class (batch)" — friendlier than single/batch |
| Anchored | Date, formatted |
| Reference | First 16 chars + ellipsis, click to copy |
| NFT ID | First 16 chars + ellipsis, click to copy |
| Status | Live (green) · Revoked (amber) |
| | Explorer link, `https://testnet.xrpl.org/transactions/<txHash>` |

Newest first. **Amber for revoked, not red** — a revoked credential was
legitimately issued and legitimately withdrawn; nothing failed.

Wrap the table in `overflow-x-auto` so it scrolls inside its own container. The
page itself must never scroll sideways on a phone.

### Truncation notice

When `truncated` is true, say so plainly above the table:

> "Showing the most recent 2,000 transactions. Older credentials exist but are
> not listed."

Silently dropping history would be worse than the limit itself.

### Filters

Type, status, and a date range — client-side over the loaded array. Keep it
simple.

### CSV export

Registrars live in spreadsheets; this is often the most-used feature.

Export the filtered rows: type, reference, NFT id, anchored date, status,
revoked date. Quote fields and escape embedded quotes. Build the file with a
`Blob` and an object URL, the same approach as `makeDownloadUrlForVC` in
`src/lib/crypto.ts`.

---

## Style

Match `/issue` and `/verify`: dark gradient section, white rounded card,
Tailwind, `primary-blue` for actions. Copy an existing page's outer structure
rather than inventing one.

---

## Definition of done

- [ ] `/dashboard` route registered and linked in the nav
- [ ] Entering a wallet lists its anchors, newest first
- [ ] **Revoked credentials appear and are marked revoked** — the whole point
- [ ] A burn recorded before its mint in history still marks the anchor revoked
- [ ] Totals for anchored / live / revoked
- [ ] Truncation is stated in the UI when the 2,000-transaction cap is reached
- [ ] Filters and CSV export work on the filtered set
- [ ] Empty state for a wallet with no credentials; clear error for an account
      that does not exist
- [ ] Progress shown during the scan
- [ ] Table scrolls inside its container on a phone
- [ ] `npm run build` clean, `npx tsc -p tsconfig.server.json --noEmit` clean,
      `npm test` passing with new tests for `scanIssuerAnchors`

---

## Do not

- **Read personal data from the ledger.** It is not there. Only hashes are
  published, deliberately. The dashboard can show what was issued and when, not
  whose it is.
- **Use `account_nfts` as the source.** It cannot show revocations.
- **Add write actions.** Revoking stays on `/revoke`, behind its confirmation
  dialog. This page signs nothing.
- **Ask for a seed.** Ever. Signing happens in Xaman, on the user's phone.
- **Expand a batch into per-student rows.** The ledger holds one anchor for the
  whole class; the roster belongs to the institution, not to us.

---

## Verifying it by hand

`rNeqwL8sjHvi4TndDCrYqYDh1dQKNBekhv` on testnet has real history: several single
credentials, and one burned anchor (the Vieux Fort petroleum licence, revoked on
11 September 2026).

**That burned one is the test.** If it does not appear in the dashboard marked
as revoked, the implementation is reading current holdings rather than history —
go back to Step 1.
