# Module 1 — Email a credential to its holder on issue

Implementation guide for the remaining UI work. The server side is already
built, committed, and pushed on `feat/email-on-issue`.

**Goal:** when a credential is issued successfully, the graduate automatically
receives an email with their credential file and QR code attached, instead of
the registrar downloading both and sending them by hand.

---

## 1. What already exists — do not rebuild this

| File | What it does |
|---|---|
| `api/email/send.ts` | `POST /api/email/send`. Validates input, checks the anchor, sends. Exports `handleSendCredentialEmail()` |
| `server/verifyAnchor.ts` | `assertMintedBy(nftId, issuerAccount)` — throws unless that NFT is really held by that issuer on the ledger |
| `server/email.ts` | `sendCredentialEmail()` — sends via Resend with both attachments |
| `server/index.ts` | Routes `POST /api/email/send` in dev to the same handler |

**Why the anchor check exists:** an endpoint that emails attachments to any
address is an open spam relay, and Anchored has no user accounts to gate it
with. Requiring a real NFT ID means abuse costs the attacker XRP and an owner
reserve on their own account. Do not remove or weaken this.

### Request contract

```
POST /api/email/send
Content-Type: application/json

{
  "to":              "graduate@example.com",   // required, validated
  "issuerAccount":   "rNeqwL8...",             // required, must match the NFT's holder
  "nftId":           "000100...",              // required, 64 hex chars
  "credential":      { ... },                  // required, the full credential object
  "qrDataUrl":       "data:image/png;base64,...", // optional
  "issuerName":      "Sir Arthur Lewis Community College", // optional, used in the copy
  "credentialLabel": "Diploma",                // optional, e.g. "diploma", "licence"
  "holderName":      "Marie Joseph"            // optional, used in the greeting
}
```

**Responses**

| Status | Meaning | What the UI should say |
|---|---|---|
| 200 `{ sent: true }` | Delivered to the provider | "Sent to graduate@example.com" |
| 400 | Bad input (address, account, NFT ID, credential) | Show the returned `error` |
| 403 | NFT is not anchored by this issuer | Show the returned `error` — this is the guard working, not a bug |
| 502 | Provider or ledger failure | "Could not send just now — the credential is safe, try again" |
| 503 | `RESEND_API_KEY` / `EMAIL_FROM` not configured | "Email delivery isn't set up on this deployment" |

---

## 2. Configuration (do this first, or everything returns 503)

Add to `.env` locally, and to the Vercel project settings for deployment:

```
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM=Anchored Credentials <credentials@yourdomain.com>
EMAIL_REPLY_TO=registrar@yourdomain.com        # optional
```

The sending domain must be verified in Resend or mail will be rejected.
`EMAIL_FROM` is read per deployment so an institution can send as itself rather
than as Anchored.

**Never commit these.** Confirm `.env` is gitignored before starting.

---

## 3. The UI work — `src/pages/IssueDiploma.vue`

Everything needed already exists at the point of success. Around **line 295–322**,
after a successful mint, these are in scope:

- `vc` and `salt` — the credential (local consts inside the submit function)
- `nftId.value` — set from the Xaman mint result
- `qrUrl.value` — the QR as a PNG data URL
- `issuerAccount.value`
- `formData` — the typed field values
- `credType.value` — has `displayName` and `primaryField`

### Step 3.1 — add the email field to the single-mint form

Add an optional input bound to a new ref, placed with the other form fields
(near the `issuerDomain` input, which is the closest existing example of an
optional field).

```ts
const holderEmail = ref('')
```

Label it using the credential type's own noun so it reads correctly for every
type, e.g. `` `${credType.displayName} recipient email (optional)` `` or use
`credType.subjectNoun` — "Graduate email", "Licensee email".

Make the optionality explicit in helper text: *"Leave blank to download and
send it yourself."* The SALCC proposal promises delivery is optional, so this
must stay genuinely optional.

### Step 3.2 — add state for the send

```ts
const emailSending = ref(false)
const emailSent = ref('')      // the address it went to, for the confirmation
const emailError = ref('')
```

### Step 3.3 — send after a successful mint

In the submit function, **after** `success.value = true` (line ~322).

Order matters: the mint must be fully complete first. The credential is already
safe on the ledger at that point, so a failed email must never look like a failed
issuance.

```ts
if (holderEmail.value.trim()) {
  await sendCredentialToHolder({ vc, salt })
}
```

Write `sendCredentialToHolder` as a separate function:

```ts
async function sendCredentialToHolder({ vc, salt }: { vc: any; salt: string }) {
  emailSending.value = true
  emailError.value = ''
  emailSent.value = ''
  try {
    const resp = await fetch('/api/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: holderEmail.value.trim(),
        issuerAccount: issuerAccount.value.trim(),
        nftId: nftId.value,
        credential: { anchoredVersion: 2, credentialType: credType.value.id, vc, salt },
        qrDataUrl: qrUrl.value,
        issuerName: issuerDomain.value.trim() || issuerAccount.value.trim(),
        credentialLabel: credType.value.displayName,
        holderName: String(formData[credType.value.primaryField] || ''),
      }),
    })
    const data = await resp.json().catch(() => ({}))
    if (!resp.ok) throw new Error(data.error || `Send failed (HTTP ${resp.status})`)
    emailSent.value = holderEmail.value.trim()
  } catch (e: any) {
    emailError.value = e?.message || String(e)
  } finally {
    emailSending.value = false
  }
}
```

Two details:
- The `credential` object must be shaped **exactly** as the downloaded file is —
  `{ anchoredVersion: 2, credentialType, vc, salt }` — so what the graduate
  receives is byte-identical to what verification expects. `makeDownloadUrlForVC`
  at line ~320 builds the same shape; keep them consistent.
- `holderName` comes from `credType.primaryField`, which is `studentName` for a
  diploma and `holderName` for a licence. Do not hardcode either.

### Step 3.4 — show the result in the success panel

Inside the existing `v-if="success"` block (line ~88), below the download link:

- while `emailSending`: "Sending to <address>…"
- on `emailSent`: a green line, "Sent to {{ emailSent }}"
- on `emailError`: an amber (not red) line with the message, plus
  *"The credential was issued successfully — you can still download and send it
  manually."*

**Amber, not red, matters.** A failed email is not a failed issuance, and the
registrar must not think the credential is lost.

### Step 3.5 — reset between issues

Clear `emailSent`, `emailError`, and `holderEmail` wherever `success.value = false`
is set (lines ~200, ~279, and in `selectType`), so one graduate's confirmation
never shows against the next.

---

## 4. Testing

**Without a Resend key** — the endpoint returns 503. Confirm the UI shows the
"not configured" message and that the success panel still shows the NFT ID,
download link, and QR.

**With a key:**

1. Issue a credential with your own address in the email field
2. Confirm the message arrives with `credential.json` and `credential-qr.png`
3. Upload the attached JSON at `/verify` — it must verify green. This is the
   real test: the emailed file must be identical to the downloaded one
4. Scan the attached QR with a phone — it must also verify

**Test the guard.** Call the endpoint directly with a real address but a made-up
`nftId`:

```bash
curl -X POST http://localhost:8787/api/email/send \
  -H 'Content-Type: application/json' \
  -d '{"to":"you@example.com","issuerAccount":"rNeqwL8sjHvi4TndDCrYqYDh1dQKNBekhv","nftId":"'$(printf 'A%.0s' {1..64})'","credential":{"x":1}}'
```

Expect **403** and no email. If a message arrives, the guard is broken — stop
and fix it before deploying.

**Watch the timing.** The ledger check adds a second or two, and more for an
issuer with many credentials, since `account_nfts` is paginated. The sending
state needs to be visible.

---

## 5. Before merging

- [ ] `npm run build` and `npx tsc -p tsconfig.server.json --noEmit` both clean
- [ ] `npm test` still 60/60
- [ ] `.env` not committed, and no key in any commit
- [ ] `EMAIL_FROM` set in Vercel, on a domain verified in Resend
- [ ] Email field genuinely optional — issuing with it blank behaves as before
- [ ] An emailed credential verifies green after a round trip through email

---

## 6. Deliberately out of scope

- **Batch email** (Module 2) — the roster CSV gains an `email` column and this
  same endpoint is called per graduate with a concurrency limit. Note the known
  QR cost, roughly 13ms and 22KB each, which matters at 400 students.
- **Accounts and dashboard** (Modules 3–4).
- **Storing addresses.** Nothing persists an address, by design. The SALCC
  proposal states addresses are used for delivery and then deleted, so do not
  add a database of recipients without revisiting that promise.
