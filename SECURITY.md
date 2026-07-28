# Security Policy

Anchored exists to prevent credential fraud. A vulnerability here could allow a forged
credential to verify as genuine, or a valid credential to be wrongly rejected — so
security reports are genuinely welcome and will be taken seriously.

## Reporting a vulnerability

**Please do not open a public GitHub issue for security problems.** Public disclosure
before a fix exists puts any institution relying on the system at risk.

Instead, email **andreas.mendes94@gmail.com** with `[Anchored Security]` in the subject.

Helpful to include, where you can:

- What the flaw allows an attacker to do
- Steps to reproduce, or a proof-of-concept credential / transaction
- Affected component (verifier, Merkle construction, identity handshake, issuance)
- Any suggested fix

You may also use GitHub's private vulnerability reporting on this repository.

## What to expect

This project is currently maintained by one person, so the timelines below are honest
rather than aspirational:

| Stage | Target |
|---|---|
| Acknowledgement of your report | 3 business days |
| Initial assessment and severity call | 10 business days |
| Fix for a critical issue | As fast as possible; you'll get progress updates |
| Public disclosure | Coordinated with you, normally after a fix ships |

Reporters are credited by name or handle in the fix commit and release notes unless you
prefer to stay anonymous. There is no paid bounty programme.

## In scope

Anything that breaks the guarantees the system claims:

- **Forgery** — a credential that verifies without having been anchored by the stated issuer
- **Merkle flaws** — membership proofs that verify for non-members, second-preimage or
  cross-batch replay attacks, tree-construction ambiguity
- **Identity spoofing** — completing the `did:web` handshake without controlling both the
  domain and the wallet
- **Revocation bypass** — a revoked or burned credential still verifying as valid
- **False negatives** — a genuine credential failing to verify (this erodes trust in real
  credentials and is treated as a real bug, not a nuisance)
- **Privacy leaks** — any path by which personal data reaches the ledger, or by which a
  credential's contents can be recovered from public data alone
- **Key exposure** — any path by which an issuer's seed or the Xaman API credentials could
  leak to the browser, a log, or a third party

## Out of scope

- **Compromise of an institution's own wallet or DNS.** These are equivalent to
  compromising the institution itself and are outside the system's trust boundary.
- **Testnet demonstration wallets and credentials** published in this repository. They hold
  no value and are intentionally public.
- Denial of service against public XRPL nodes or third-party services.
- Findings that require physical access to a user's unlocked device.
- Missing hardening headers or similar findings with no demonstrated impact on the
  guarantees above.

## Known limitations

Section 8 of the [whitepaper](WHITEPAPER.md) documents the current design's known
weaknesses — canonicalization not yet conforming to RFC 8785, no offline-verifiable
signature on the credential document, issuer identity resting on DNS and Web PKI, bounded
verification scans, and no selective disclosure. These are acknowledged rather than
reported; new reports that sharpen or exploit them are still valuable.

## Design notes relevant to security researchers

- Anchored **holds no institutional signing keys**. Issuers sign on their own devices via
  Xaman; the server side is two stateless proxies (Xaman sign requests, `did.json`
  fetching) that never touch credential data or keys. A full compromise of Anchored's
  infrastructure should not permit issuing a single credential — reports demonstrating
  otherwise are the highest-value findings against this project.
- No personal data is written to the ledger; only salted SHA-256 digests.
- The system currently runs on the **XRP Ledger Testnet**. No credentials of record have
  been issued.

## Supported versions

The `main` branch is the only supported version while the project is pre-1.0.
