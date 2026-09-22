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

### Step 1 — capture addresses in `parseRoster`

`src/lib/batch.ts`.

Extend `ParsedRoster`:

```ts
export interface ParsedRoster {
  records: RosterRecord[]
  /** Recipient address per record, aligned by index. '' where none was given. */
  emails: string[]
  errors: RosterError[]
}
```

In the `rawRows.forEach` loop, find the email column on the raw row **before**
normalisation (since `normaliseRow` discards it). Accept the usual header
spellings via `normaliseKey`: `email`, `emailaddress`, `e-mail`, `studentemail`,
`contactemail`.

Push to `emails` **only when a record is pushed**, so the arrays stay aligned.

Validate the address shape here and report a `RosterError` for a malformed one.
Catching it now matters: minting is irreversible, so a bad address should be
fixed **before** the class is anchored, not after.

An empty address is not an error — delivery is optional, per the proposal.

### Step 2 — a shared credential-file builder

Extract from `makeBatchZip` into an exported function:

```ts
export function batchCredentialFile(
  entry: BatchEntry, index: number, tree: MerkleTree,
  issuerAccount: string, nftId: string, type: CredentialType,
): object
```

Have `makeBatchZip` call it too, so the emailed file and the ZIP file are
guaranteed identical. This is the one change that prevents trap 3 recurring.

### Step 3 — the send loop

New file, `src/lib/batchEmail.ts`, so it is testable away from the UI:

```ts
export interface BatchSendResult {
  index: number
  name: string      // for the results table
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
  concurrency?: number                         // default 2
  onProgress?: (done: number, total: number) => void
}): Promise<BatchSendResult[]>
```

Behaviour:

- Skip entries with an empty address — not an error, just not sent
- At most `concurrency` requests in flight
- **Never throw.** One bad address must not stop the other 99; record the
  failure and continue
- Reuse the QR already produced for that entry rather than regenerating it
  (roughly 13ms and 22KB each, which adds up over a class)
- Report progress so the UI can show "37 of 120 sent"

### Step 4 — cache the anchor check

`server/verifyAnchor.ts` opens a fresh ledger connection per call. With one
shared `nftId` across 100 sends, that is 100 connections and several minutes of
pure waiting.

Add a small in-memory cache of verified `nftId + issuerAccount` pairs with a
short TTL (5–10 minutes). Serverless instances are reused often enough that this
helps substantially, and it is harmless when they are not.

**Do not weaken the check itself.** It is what stops the endpoint being an open
spam relay, and a batch makes that more important, not less: one valid `nftId`
now authorises many messages. Consider a per-request recipient cap as well.

### Step 5 — the UI

In the batch section of `src/pages/IssueDiploma.vue`:

**Before minting**, once the roster is parsed, show how many rows carry an
address: *"118 of 120 rows include an email address. 2 will need manual
delivery."* The registrar should see this **before** signing, since the mint
cannot be undone.

**After minting**, send automatically, with a progress line.

**When finished**, show a summary — sent, skipped, failed — and for failures a
table of name, address and reason, plus:

- **Retry failed only** — never resend to those who already received theirs
- **Download failures as CSV**, so the registrar can correct and re-run
- **The ZIP download stays available regardless.** It is the fallback when
  delivery is declined or partly fails, and the proposal promises delivery is
  optional

Use amber for partial failure, not red. The class is anchored and the ZIP
exists; delivery is a separate, retryable concern.

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
