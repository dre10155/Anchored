# Module 2 — Batch email delivery

Implementation guide. Sends every graduate in a batch their own credential and
QR automatically, instead of the registrar distributing a ZIP by hand.

This is the feature SALCC's Vice-President actually asked for, and the one that
makes the pilot visibly different from their current one-at-a-time process.

**Depends on Module 1** (`api/email/send.ts`), which is merged and working. That
endpoint is reused unchanged.

---

## Four things to get right

These are the parts that are easy to get wrong and expensive to discover late.
Read them before writing code.

### 1. The email address must never enter the credential

`buildBatch` does:

```ts
const subject = { ...record, issuerAccount }
const vc = await buildVC({ issuer, subject, claim: {}, salt })
```

Anything in `record` becomes part of the credential — **hashed, permanent, and
visible to every future verifier**. If the address rides along in the record,
every graduate's personal email is baked into their diploma forever.

That directly contradicts the SALCC proposal, which states addresses are used
for delivery and then deleted.

**Today this is safe by accident:** `normaliseRow` keeps only columns matching
known credential fields, so an `email` column is silently discarded. Do not
"fix" that by adding email to `type.fields` — that is precisely the bug.

**Instead:** capture the address in `parseRoster` into a separate array,
returned alongside `records`, and never merge the two.

### 2. Index alignment

`records` skips invalid rows, so `records[3]` is not necessarily CSV row 4.

The addresses array must be built **in the same loop** that pushes records, so
index `i` refers to the same person in both. Building it separately from the raw
rows will silently misalign after the first invalid row — and a misalignment
means **a graduate receives someone else's diploma**.

Treat this as the highest-risk part of the module.

### 3. Batch credentials have a different file shape

Module 1 sends:

```
{ anchoredVersion, credentialType, vc, salt }
```

A batch credential additionally needs its Merkle proof:

```
{ anchoredVersion, credentialType, vc, salt,
  batch: { root, proof, issuerAccount, nftId } }
```

Send the Module 1 shape to a batch graduate and **it will not verify**. Build it
exactly as `makeBatchZip` does (`src/lib/batch.ts`, in the entries loop) — or
better, extract that object into a shared helper both call, so they cannot
drift apart.

### 4. One request per recipient, from the browser

A batch mints **one** NFT for the whole class, so every graduate shares the same
`nftId`.

Do **not** add an endpoint that takes 100 addresses and loops server-side:
Vercel functions time out around 10 seconds, and 100 sends will not fit.

Instead loop in the browser, calling the existing `/api/email/send` once per
graduate with a small concurrency limit (2–3 at a time; Resend's default rate
limit is about 2 requests/second).

---

## Implementation

Code below is the intended shape, not pseudocode — adapt names to match the
file, but keep the behaviour.

### Step 1 — capture addresses in `parseRoster`

`src/lib/batch.ts`. Extend the result type:

```ts
export interface ParsedRoster {
  records: RosterRecord[]
  /** Recipient address per record, aligned by index. '' where none was given. */
  emails: string[]
  errors: RosterError[]
}
```

Add a helper above `parseRoster`, because `normaliseRow` discards unknown
columns and so the address must be read from the **raw** row:

```ts
const EMAIL_KEYS = new Set([
  'email', 'emailaddress', 'e-mail', 'studentemail', 'contactemail', 'recipientemail',
])

/** Reads the address from a raw roster row. Returns '' when absent. */
function readEmail(raw: Record<string, any>): string {
  for (const [key, value] of Object.entries(raw)) {
    if (EMAIL_KEYS.has(normaliseKey(key))) return String(value ?? '').trim()
  }
  return ''
}

function isEmailShaped(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) && v.length <= 254
}
```

Then in `parseRoster`, build both arrays **in the same loop**, pushing to
`emails` only when a record is pushed:

```ts
  const records: RosterRecord[] = []
  const emails: string[] = []
  const errors: RosterError[] = []

  rawRows.forEach((raw, i) => {
    const rowNumber = i + 1
    const { record, error } = validateRow(normaliseRow(raw, aliasMap), rowNumber, type)
    if (!record) {
      if (error) errors.push(error)
      return
    }

    // Read before normalisation: normaliseRow keeps only credential fields, so
    // the address is not in `record` — and must never be, or it would be hashed
    // into the credential and exposed to every future verifier.
    const email = readEmail(raw)
    if (email && !isEmailShaped(email)) {
      // Reported now, while the roster can still be corrected. After minting it
      // is too late: the class is anchored and cannot be un-anchored.
      errors.push({ row: rowNumber, message: `Invalid email "${email}"` })
      return
    }

    records.push(record)
    emails.push(email)
  })

  return { records, emails, errors }
```

Update the existing callers of `parseRoster` for the new field.

### Step 2 — one builder for the credential file

Extract from `makeBatchZip` so the emailed file and the ZIP file cannot drift:

```ts
/** The credential file a batch subject receives — identical in the ZIP and by email. */
export function batchCredentialFile(params: {
  entry: BatchEntry
  index: number
  tree: MerkleTree
  issuerAccount: string
  nftId: string
  type: CredentialType
}) {
  const { entry, index, tree, issuerAccount, nftId, type } = params
  return {
    anchoredVersion: 2,
    credentialType: type.id,
    vc: entry.vc,
    salt: entry.salt,
    batch: { root: tree.root, proof: tree.proofs[index], issuerAccount, nftId },
  }
}
```

Replace the inline object in `makeBatchZip` with a call to this. The `batch`
block is what verification needs to check the Merkle proof; without it the file
cannot verify.

### Step 3 — the send loop

New file `src/lib/batchEmail.ts`, kept out of the component so it is testable:

```ts
export interface BatchSendResult {
  index: number
  name: string
  email: string
  ok: boolean
  error?: string
}

export async function sendBatchEmails(params: {
  entries: BatchEntry[]
  emails: string[]
  tree: MerkleTree
  issuerAccount: string
  issuerDomain?: string
  nftId: string
  type: CredentialType
  /** Resend allows ~2 requests/second; keep this low. */
  concurrency?: number
  onProgress?: (done: number, total: number) => void
  /** Restrict to these indexes — used by "retry failed only". */
  only?: number[]
}): Promise<BatchSendResult[]> {
  const { entries, emails, tree, issuerAccount, issuerDomain, nftId, type } = params
  const concurrency = params.concurrency ?? 2

  const targets = (params.only ?? entries.map((_, i) => i))
    .filter((i) => emails[i])          // no address is a skip, not a failure

  const results: BatchSendResult[] = []
  let done = 0
  let cursor = 0

  async function worker() {
    while (cursor < targets.length) {
      const i = targets[cursor++]
      const entry = entries[i]
      const name = String(entry.record[type.primaryField] ?? '')
      try {
        // Reuse the QR already generated for this entry rather than making a
        // new one — each costs ~13ms and ~22KB, which tells over a full class.
        const qrDataUrl = await makeVerifierQR({
          salt: entry.salt,
          hash: entry.leaf,
          subject: entry.vc.credentialSubject,
          issuerAccount,
          batch: { root: tree.root, proof: tree.proofs[i] },
        })

        const resp = await fetch('/api/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: emails[i],
            issuerAccount,
            nftId,
            credential: batchCredentialFile({ entry, index: i, tree, issuerAccount, nftId, type }),
            qrDataUrl,
            issuerName: issuerDomain || issuerAccount,
            credentialLabel: type.displayName,
            holderName: name,
          }),
        })
        const data = await resp.json().catch(() => ({}))
        if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`)
        results.push({ index: i, name, email: emails[i], ok: true })
      } catch (e: any) {
        // One bad address must never stop the rest of the class.
        results.push({ index: i, name, email: emails[i], ok: false, error: e?.message || String(e) })
      } finally {
        params.onProgress?.(++done, targets.length)
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, worker))
  return results.sort((a, b) => a.index - b.index)
}
```

### Step 4 — cache the anchor check

`server/verifyAnchor.ts` opens a ledger connection per call. A batch shares one
`nftId` across every recipient, so without caching a class of 100 means 100
connections and minutes of waiting.

```ts
// Verified (nftId, issuer) pairs, briefly. A batch sends many messages against
// one anchor, and re-querying the ledger per recipient dominates the run time.
// Short TTL so a burned anchor stops passing quickly.
const verified = new Map<string, number>()
const TTL_MS = 5 * 60 * 1000

export async function assertMintedBy(nftId: string, issuerAccount: string): Promise<void> {
  const key = `${nftId.toUpperCase()}:${issuerAccount}`
  const seen = verified.get(key)
  if (seen && Date.now() - seen < TTL_MS) return
  // ... existing ledger check ...
  // on success:
  verified.set(key, Date.now())
}
```

Do **not** weaken the check itself. It is what keeps the endpoint from being an
open relay, and a batch raises the stakes: one valid `nftId` now authorises many
messages. Consider a per-request recipient cap too.

### Step 5 — the UI

In the batch section of `src/pages/IssueDiploma.vue`:

**Before minting**, once the roster parses, show the address count — the
registrar must see this while the roster can still be fixed:

> "118 of 120 rows include an email address. 2 will need manual delivery."

**After minting**, call `sendBatchEmails` and show progress: "Sent 37 of 118".

**When finished**, a summary — sent / skipped / failed — and for failures a table
of name, address and reason, plus:

- **Retry failed only**, passing those indexes as `only` so nobody is emailed twice
- **Download failures as CSV**, to correct and re-run
- **The ZIP download stays available**, always. It is the fallback when delivery
  is declined or partly fails, and the proposal promises delivery is optional

Amber for partial failure, not red: the class is anchored and the ZIP exists.
Delivery is separate and retryable.

---

## Testing

**Unit, no network:**
- A roster where row 2 is invalid — confirm `records[1]` and `emails[1]` still
  describe the same person. This is trap 2, and it is the test that matters most
- An `email` column never appears in any `vc.credentialSubject`
- Header spellings: `Email`, `E-Mail`, `student_email`
- Blank address is skipped, not an error
- Malformed address is reported as a `RosterError`

**Integration:** a 3-row roster with your own address in all three. Confirm three
messages arrive, each with the correct person's credential, and that **each
attached file verifies green** — this exercises the Merkle proof path, which the
single-mint flow never touches.

**Failure path:** one valid address and one at a non-existent domain. Confirm the
valid one still arrives and the summary reports one failure.

---

## Before merging

- [ ] Build, server typecheck, and tests all clean (66 tests currently passing)
- [ ] No email address appears in any credential file or on the ledger
- [ ] A batch-emailed credential verifies green, including its Merkle proof
- [ ] One bad address does not prevent the rest from sending
- [ ] The ZIP still downloads regardless of delivery outcome
- [ ] Anchor check unchanged in strength

---

## Out of scope

- **Storing addresses.** Nothing persists them, by design.
- **Delivery receipts / bounce tracking.** Would need Resend webhooks and a place
  to store state, which means Module 3.
- **Resend's batch endpoint.** Attachments are not supported there, and every
  graduate needs a different attachment.
