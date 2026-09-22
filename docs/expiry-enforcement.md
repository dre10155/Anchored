# Expiry enforcement

Implementation guide. Small change, but it closes the largest gap between what
the proposals promise and what the code does.

---

## The problem

`expiryYear` already exists on the `professional-license` credential type
(`src/lib/credentialTypes.ts:69`). It is part of the credential, so it is hashed
and tamper-proof, and it is displayed on the verify page.

**But nothing ever checks it.** A licence that expired in 2024 verifies today
with a green "Verified" badge, because verification only asks three questions:
is the hash anchored, was it revoked, and is the issuer's domain confirmed.

For a diploma that hardly matters — a degree does not expire. For a regulator it
is the opposite of the point. The RSA proposal commits to expiry enforcement as
a Week 1–2 pilot deliverable, and the whole trades/renewals conversation with
SALCC depends on it. "Was issued at some point" and "is valid today" are
different questions, and only the second one matters to an employer.

---

## What to build

A fourth result state, **`expired`**, sitting between verified and invalid.

The distinction that matters: an expired credential is **genuine**. It was
really issued by that institution and has not been tampered with. It is simply
no longer current. So it must not be shown in red like a forgery, and it must
not be shown in green either. Amber, with plain wording.

---

## 1. Decide the rule first

Three things to settle before writing code, because they change the logic:

**Which field?** Only `professional-license` has `expiryYear` today. The check
must be driven by the credential type, not hardcoded — other types have no
expiry and must be unaffected.

**Year granularity.** `expiryYear` is a year, not a date. Treat a credential as
valid through the *end* of that year: expired when
`currentYear > expiryYear`. A licence marked 2026 stays valid until 31 Dec 2026.
Do not use month or day precision — the data does not have it.

**What about revoked and expired together?** Revocation wins. A revoked licence
is revoked whether or not it also expired; that is the stronger statement.

---

## 2. Add the expiry concept to the credential type

In `src/lib/credentialTypes.ts`, add an optional property to the
`CredentialType` interface:

```ts
/** Field holding the expiry year, if this credential type expires at all. */
expiryField?: string
```

Set `expiryField: 'expiryYear'` on `professional-license` only. Leave `diploma`
and `employee-id` without it — they do not expire, and adding it would be wrong.

Driving it from config rather than a hardcoded key is the same pattern as
`primaryField`, and it means adding a future renewable credential type needs no
change to the verifier.

---

## 3. Add the check

Put it in `src/lib/verify.ts` as a small pure function, so it can be unit
tested without touching the UI or the ledger:

```ts
/**
 * Whether a credential's expiry year has passed. Returns false when the type
 * has no expiry, when no year is present, or when the value is unusable —
 * verification must never fail closed on a malformed optional field.
 */
export function isExpired(
  subject: Record<string, unknown>,
  type: CredentialType,
  now: Date = new Date(),
): boolean
```

Behaviour:

| Input | Result |
|---|---|
| Type has no `expiryField` | `false` |
| Field missing or empty | `false` |
| `expiryYear` is 2030, now 2026 | `false` |
| `expiryYear` is 2026, now 2026 | `false` — valid through year end |
| `expiryYear` is 2024, now 2026 | **`true`** |
| `expiryYear` is `"2024"` (string) | **`true`** — rosters and JSON give strings |
| Value is `"soon"` or `NaN` | `false`, and do not throw |

The `now` parameter exists so tests can pin a date instead of depending on the
real clock.

---

## 4. Wire it into the verify page

In `src/pages/VerifyDiploma.vue`:

**Widen the state type** (line ~119):

```ts
const resultState = ref<'verified' | 'anchored' | 'expired' | 'revoked' | 'invalid' | null>(null)
```

**Apply the check where the outcome is decided** (line ~308, where
`identityVerified` currently chooses between `verified` and `anchored`).

Order matters:

1. Not anchored → `invalid`
2. Revoked → `revoked` *(existing, and it must stay ahead of expiry)*
3. **Anchored, genuine, but past its expiry year → `expired`**
4. Issuer identity confirmed → `verified`
5. Otherwise → `anchored`

The expiry check sits **after** the revocation branch and **before** the
verified branch.

**Wording.** State plainly that it is genuine but no longer current, and give
the year, because the verifier's next question is always "expired when?":

> "This licence was genuinely issued by rsa.govt.lc and has not been altered,
> but it expired at the end of 2024 and is no longer current."

Keep naming the issuer when identity is confirmed — that the institution is real
is still useful information.

**Styling** (lines ~63–72): add `expired` to the same amber classes already used
by `anchored` and `revoked`, and add a headline case:

```
: resultState === 'expired' ? `${credentialNoun} Expired ⚠️`
```

Do **not** give it red styling. Red means forged, and this credential is not.

---

## 5. Tests

Add to the existing suite (currently 60 tests, all passing — keep it that way).

Unit tests for `isExpired`, covering every row of the table in section 3. These
need no ledger and no network.

The important cases are the boundary — expiring in the current year must still
be valid — and the string input, since a roster CSV produces `"2024"` rather
than `2024`.

---

## 6. Manual check

There is a real expired-looking licence to hand:
`pitch/screenshots/licence-valid.json` (Caribbean Blasting, `expiryYear: 2027`,
still anchored and verifying green).

To test, copy it and change `expiryYear` to `2024`. **It will then verify as
invalid, not expired** — because changing the field changes the hash, which is
the tamper protection working correctly.

So testing expiry properly means **minting a new credential with a past expiry
year**. Issue one with `expiryYear: 2024` from `rNeqwL8…`, and confirm it shows
amber "Expired" rather than green.

That is one Xaman signature. Do it before demoing this to anyone.

---

## 7. Before merging

- [ ] `npm run build` and `npx tsc -p tsconfig.server.json --noEmit` clean
- [ ] `npm test` passing, with new tests for `isExpired`
- [ ] A diploma still verifies green — types without an expiry field are unaffected
- [ ] A revoked *and* expired credential still reports **revoked**
- [ ] A genuinely expired licence shows amber, names the issuer, and gives the year
- [ ] Nothing shows red unless the credential is actually unanchored or altered

---

## 8. Out of scope

- **Renewal.** Re-issuing a credential and revoking the old one already works
  with existing features; no new code is needed for the pilot.
- **Date-level expiry.** Would require a new field and a credential format
  change. Year granularity is what the data supports today.
- **Warning before expiry** ("expires in 30 days"). Useful for a licensing
  register later; not needed to close the promise made in the proposal.
