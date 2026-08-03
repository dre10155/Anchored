# Anchored: Zero-Custody Anchoring of Academic Credentials on the XRP Ledger

**Andreas Mendes**
Version 0.1 — July 2026
Reference implementation: https://github.com/dre10155/Anchored · Live system: https://anchor-ed.vercel.app

---

## Abstract

Academic credential fraud is a persistent public-safety problem in the United States, most visibly in healthcare, where fraudulently credentialed practitioners have reached patients. The countermeasure — verification — remains slow and costly because it depends on contacting the issuing institution or a commercial intermediary.

Anchored is a credential verification system that anchors a salted cryptographic fingerprint of each credential on the XRP Ledger, so that any party can verify a diploma in seconds, at negligible cost, with no intermediary and no account. Three design decisions distinguish it from prior blockchain credentialing work: (1) **zero custody** — the system never holds an institution's signing key and cannot issue on its behalf; (2) **Merkle batch anchoring**, which lets an institution anchor an entire graduating class with a single signed transaction while preserving per-credential revocation; and (3) an explicit **issuer identity handshake** based on `did:web`, which separates the claim "this hash is anchored" from the far stronger claim "this credential was issued by a named institution."

Although the motivating application is academic diplomas, the anchoring engine is credential-agnostic: it operates on an opaque document and knows nothing about diplomas. A credential type — a diploma, a professional license, a workforce identity — is a configuration of which fields the document carries, not a change to the cryptography. The same protocol therefore addresses credential fraud across education, professional licensing, and employment from a single verification substrate.

This paper describes the threat model, the construction, its security and privacy properties, and the limitations of the current implementation. The system is operational on the XRP Ledger Testnet.

---

## 1. The problem

### 1.1 Fraud

In January 2023 the U.S. Department of Justice announced the results of *Operation Nightingale*, a federal investigation that uncovered the sale of more than **7,600 fraudulent nursing diplomas and transcripts** by several South Florida nursing schools, at roughly **$10,000–$17,000 per credential**. Approximately **2,500 purchasers used the documents to pass a national licensing examination and obtain employment** in hospitals and care facilities before being caught. The case is notable not because it was unusual in kind, but because it demonstrated scale: thousands of unqualified individuals entered a licensure pipeline that had no cryptographic means of distinguishing a genuine institutional record from a manufactured one.

Diploma mills — entities that sell credentials without meaningful academic requirements — are a long-standing and widely documented industry. Published estimates of the number of fraudulent U.S. degrees issued annually run into the tens of thousands or higher; these figures are estimates derived from investigative work rather than measured counts, and should be treated as indicative of magnitude, not precise.

The structural point is independent of any particular number: **a paper or PDF credential carries no verifiable link to the institution that supposedly issued it.** Its trustworthiness depends entirely on a verifier's willingness and ability to contact the issuer.

### 1.2 Verification

That contact is expensive. Employers, licensing boards, and immigration authorities verify education either by contacting registrars directly or through commercial clearinghouses, at typical costs in the range of tens of dollars per check and turnaround measured in days. The result is predictable rationing: high-stakes roles get verified, and a large share of credential claims are never checked at all. Fraud survives in the gap.

### 1.3 What a solution must do

An effective system must let a verifier answer, in seconds and without contacting anyone:

1. Was this exact credential document issued, unaltered? (**integrity**)
2. Who issued it, and are they who they claim to be? (**issuer authenticity**)
3. Is it still valid, or has it been rescinded? (**revocation**)

It must do so without publishing student data, without requiring institutions to surrender control of their signing keys, and at a cost per credential low enough that a community college can issue thousands.

---

## 2. Why existing approaches fall short

**Commercial verification services** (clearinghouses, background-check vendors) solve authenticity by centralizing trust, but they reintroduce cost, latency, and a single point of failure, and they cannot serve institutions outside their network.

**PDF signatures and secure portals** bind a document to an institution but require the verifier to trust a specific vendor's infrastructure indefinitely. A portal that goes offline takes its credentials' verifiability with it.

**Prior blockchain credentialing systems** — notably MIT's Blockcerts, the work of the Digital Credentials Consortium, and the European Blockchain Services Infrastructure (EBSI) — established the essential insight that a hash anchored on a public ledger provides durable, vendor-independent integrity. Anchored builds directly on that lineage. Where it differs:

- Most such systems anchor **one transaction per credential**, which is economically painful on high-fee chains and pushes implementers toward custodial batching services.
- The **issuer-identity problem is frequently underspecified**. A verifier is told a hash matches an address; whether that address belongs to a real university is often left to an out-of-band registry or to the vendor's assurance. This is precisely the gap a diploma mill exploits: anyone can create an address and anchor a self-issued credential that verifies as "on-chain."
- **Revocation** is often absent or all-or-nothing.

---

## 3. Threat model

We assume a public, permissionless ledger with immutable, timestamped, publicly readable transactions, and that SHA-256 is collision- and preimage-resistant.

| # | Adversary capability | Goal | Mitigation |
|---|---|---|---|
| T1 | Holds a genuine credential, edits a field (e.g. degree level) | Forge an upgrade | Anchor hash is over the whole document; any edit changes it |
| T2 | Observes the public ledger | Learn who graduated with what | Only salted hashes are published; salt blocks dictionary attack over a low-entropy credential space |
| T3 | Creates their own XRPL wallet | Issue credentials in a university's name | did:web two-way handshake (§4.5); unbound issuers are surfaced to the verifier as unverified |
| T4 | Holds a valid credential from a batch | Claim membership in a batch they are not in | Merkle proof must reproduce the anchored root |
| T5 | Knows the internal structure of a Merkle tree | Present an internal node as a credential | Domain-separated leaf and node hashing (§4.3) |
| T6 | Holds a credential the issuer has rescinded | Continue to verify as valid | Revocation records and anchor burn (§4.6) |
| T7 | Compromises Anchored's servers | Issue fraudulent credentials for every customer | **Not possible by construction** — the system holds no issuing keys (§4.7) |
| T8 | Compromises an institution's wallet | Issue fraudulent credentials for that institution | Out of scope; equivalent to compromising the institution itself |

T7 deserves emphasis. For a system whose purpose is fraud prevention, a service that can mint credentials on behalf of many institutions is a concentration of exactly the authority an attacker wants. Anchored is designed so that this component does not exist.

---

## 4. Construction

### 4.1 Credential document

For each graduate the issuer constructs a credential document in the shape of a W3C Verifiable Credential:

```json
{
  "@context": ["https://www.w3.org/2018/credentials/v1"],
  "type": ["VerifiableCredential"],
  "issuer": "did:web:registrar.university.edu",
  "issuanceDate": "2026-06-15T10:00:00.000Z",
  "credentialSubject": {
    "studentName": "Jane Doe",
    "university": "Saint Lucia National University",
    "degree": "BSc Nursing",
    "year": 2026,
    "issuerAccount": "rNeqw…"
  },
  "proof": { "type": "SaltedHashProof", "salt": "…" }
}
```

A fresh 128-bit random salt is generated per credential. The **anchor hash** is

```
H = SHA-256( salt ‖ canonicalJSON(content) )
```

where `content` is the credential with its `proof` block removed, and `canonicalJSON` recursively sorts object keys before serialization, so that semantically identical documents produce identical digests regardless of field ordering. Excluding the proof envelope from the hash (the W3C Data Integrity model) means the same value is computed at issuance, in the on-ledger anchor, and at verification — there is no second digest that can diverge.

The salt is essential. Credential fields are drawn from a small space — a few thousand plausible names crossed with a few dozen degrees and a handful of years. An unsalted hash of such a document is trivially brute-forced from the public ledger, which would turn an integrity mechanism into a disclosure mechanism. The salt lives only in the graduate's copy.

**On the "proof" field.** Anchored does not attach a digital signature to the credential document. Authority comes from the ledger: the anchoring transaction is signed by the institution's XRPL wallet, so the ledger entry *is* the institution's signature over the hash. This is a deliberate simplification, and it is also a departure from the W3C Data Integrity specifications — see §8.

### 4.2 Anchoring a single credential

The issuer submits an `NFTokenMint` transaction carrying the hash in two independent places:

- `URI` = `vc:sha256:<H>` (hex-encoded)
- A memo of type `vc-hash` with payload `{"hash": "<H>"}`

The NFT is minted with `tfBurnable` and **without** `tfTransferable`. A credential is a statement about a person, not a bearer asset; making it non-transferable prevents a secondary market in issued diplomas, while burnability preserves the issuer's ability to revoke.

**No personal data is written to the ledger.** The URI carries a fixed-length digest; the memo carries the same digest. Both are opaque without the salt.

### 4.3 Merkle batch anchoring

Anchoring one transaction per credential does not scale to a graduating class — not because of transaction fees, which are negligible on XRPL, but because **each transaction requires a human signature**. A registrar cannot approve 300 wallet prompts.

The obvious industry answer is delegation: the institution authorizes a service to mint on its behalf. Anchored rejects this (T7). Instead, the class is anchored as a single Merkle tree.

Given credential hashes `H₁ … Hₙ`, define:

```
leaf(H)      = SHA-256( "ANCHORED-LEAF:" ‖ H )
node(a, b)   = SHA-256( "ANCHORED-NODE:" ‖ min(a,b) ‖ max(a,b) )
```

Leaves are combined pairwise up to a single root `R`. A node without a partner at some level is promoted unchanged to the next level. The issuer signs **one** `NFTokenMint` with `URI = vc:merkle:<R>` and a `vc-batch` memo recording the root and the credential count. Each graduate receives their credential document plus a **membership proof**: the ⌈log₂ n⌉ sibling hashes needed to recompute `R`.

Three details are load-bearing:

**Sorted pairs.** Hashing `min ‖ max` makes the combination commutative, so a proof needs no direction bits and verification is a simple fold.

**Distinct domain prefixes for leaves and internal nodes.** This prevents the classic Merkle second-preimage attack. If leaves and nodes were hashed identically, an adversary who knows an internal node could submit that node as their credential hash together with the remaining sibling chain; the fold would reach the genuine root and the forgery would verify. Domain separation makes an internal node an invalid leaf by construction. This follows the design used in Certificate Transparency (RFC 6962).

*This was not a theoretical concern.* The first implementation of this construction domain-separated only internal nodes. The vulnerability was caught by a unit test written to attempt exactly this attack, before the code was deployed. The regression test remains in the suite.

**Promotion rather than duplication of odd nodes.** Duplicating a lone node to pad a level allows two trees of different sizes to produce the same root, which admits forged membership claims. Promotion avoids this.

**Cost.** For a class of 5,000, individual anchoring requires 5,000 signed transactions and — because each NFT occupies ledger state — roughly 31 XRP of owner reserve locked in the institution's account (~157 `NFTokenPage` objects at 0.2 XRP each, 32 NFTs per page). Merkle anchoring requires **one** transaction and one page, for 0.2 XRP of reserve. Transaction fees in both cases are dominated by the base fee of 10 drops (0.00001 XRP), a small fraction of a U.S. cent per transaction.

### 4.4 Scale and throughput

Because a batch of any size resolves to a single 32-byte root, ledger cost is a function of the number of *batches*, not the number of credentials. The following are measured against the reference implementation (Node 22, Apple Silicon), building complete trees with per-credential salts, W3C-shaped credential documents, and full proof generation:

| Class size | Tree build | Proof length | Verify one credential |
|---|---|---|---|
| 1,000 | 65 ms | 10 hashes | ~1 ms |
| 5,000 | 264 ms | 13 hashes | <1 ms |
| 10,000 | 514 ms | 14 hashes | <1 ms |

Build time is linear in class size and proof length grows logarithmically, so a national-scale cohort remains a sub-second operation on commodity hardware. Verification is independent of class size: a graduate from a 10,000-credential batch is checked with 14 hash operations.

Projecting to sustained national volume — 10,000 credentials issued per day — the difference between the two designs is not incremental:

| | Individual anchoring | Merkle batch anchoring |
|---|---|---|
| Transactions/day | 10,000 | 1 (per issuing batch) |
| Ledger fees/year | ~US$37 | **under US$0.10** |
| Owner reserve accrued/day | ~833 XRP | ~0.2 XRP |

The reserve figure is the operative constraint. Individual anchoring would require an institution to lock hundreds of XRP of capital *per day* in ledger reserves — economically prohibitive at national scale, and the reason systems anchoring one transaction per credential tend toward custodial batching services. Merkle anchoring reduces locked capital by roughly three orders of magnitude while preserving per-credential revocation (§4.6) and the zero-custody property (§3, T7).

**Amendment independence.** This construction requires no pending or optional protocol features. The XRP Ledger's proposed Batch amendment (XLS-56), which would allow multiple inner transactions to be submitted atomically, was blocked from production networks in February 2026 after a signature-validation vulnerability was identified in its signer-verification logic, and remains unavailable pending a rewrite. Anchored's batching is performed entirely in the credential layer and depends on nothing beyond `NFTokenMint`, which has been stable since XLS-20. If Batch is subsequently activated it would offer a modest additional benefit — atomically anchoring several institutions' roots in one transaction — but the system's scaling properties do not rely on it.

### 4.5 Issuer identity: the did:web handshake

A hash match proves that *some* wallet anchored a document. It does not prove that wallet belongs to a university. Closing that gap requires binding an on-ledger identifier to an off-ledger institutional identity that the public already trusts. The strongest such identifier available is the institution's **domain name**.

Anchored requires a bidirectional proof:

- **Domain → wallet.** The institution publishes a DID document at `https://<domain>/.well-known/did.json` (the `did:web` method) listing its official XRPL address as a verification method. Only a party controlling the institution's web infrastructure can do this.
- **Wallet → domain.** The institution signs an `AccountSet` transaction writing that same domain into the account's on-ledger `Domain` field. Only a party controlling the wallet's keys can do this.

Neither direction alone suffices. Publishing a `did.json` naming an address you do not control proves nothing; setting a `Domain` field to a domain you do not control proves nothing. Together they establish that a single party controls both, and impersonating an institution requires compromising its actual website *and* matching its published wallet.

The verifier reflects this distinction in its output rather than hiding it:

| Verdict | Meaning |
|---|---|
| 🟢 **Verified — issued by `<domain>`** | Integrity holds, anchor is live, and the handshake completes |
| 🟡 **Anchored — issuer unverified** | Integrity holds, but the wallet is not bound to any institution |
| 🟡 **Revoked** | Integrity holds, but the issuer has rescinded the credential |
| 🔴 **Not verified** | No matching anchor |

The amber "anchored but unverified" state is the diploma-mill case made legible. A system that reported this as a green checkmark — as a naive hash-match implementation would — would be actively misleading.

### 4.6 Revocation

Degrees are rescinded: academic misconduct, admissions fraud, findings that emerge years later. A credential system without revocation is, in this narrow respect, *worse* than paper, because it makes the discredited claim permanently and cheaply verifiable.

Anchored supports two mechanisms:

- **Anchor burn** (`NFTokenBurn`) — removes the anchor. For a single credential this revokes that credential; for a batch it revokes the entire class. Appropriate when a whole cohort's records are invalidated.
- **Revocation record** — the issuer signs a no-op `AccountSet` carrying a memo of type `vc-revoke` with payload `{"hash": "<H>"}`. This revokes exactly one credential and leaves the rest of its batch valid. It is cheap (one base-fee transaction), publicly auditable, and cryptographically attributable to the issuer.

Revocation is monotonic and non-repudiable: an issuer can add a revocation but cannot retract one, since the ledger record is permanent.

### 4.7 Verification algorithm

Verification requires no account, no API key, and no contact with Anchored or the institution — only a public XRPL node and, for the identity check, an HTTPS request to the institution's own domain.

```
INPUT: credential document C, salt s, optional (root R, proof P), issuer address A

1. H ← SHA-256(s ‖ canonicalJSON(C))
2. if batched:
       if fold(leaf(H), P) ≠ R:  return NOT VERIFIED   // local; no network
3. scan A's transaction history (paginated) for:
       anchor    — an NFTokenMint whose memo or URI carries H (or R)
       revocation — any transaction with a vc-revoke memo for H
4. if no anchor:                  return NOT VERIFIED
5. if revocation found:           return REVOKED
6. if anchor NFT no longer exists: return REVOKED
7. if anchor NFT URI disagrees with H (or R): return NOT VERIFIED
8. identity ← (on-ledger Domain of A = D) ∧ (did.json at D lists A)
9. return identity ? VERIFIED(D) : ANCHORED-UNVERIFIED
```

Step 2 is deliberately ordered before any network access: a forged credential is rejected locally, in microseconds, without a ledger query.

Step 3 is paginated. An earlier implementation read only the most recent 100 transactions, which caused valid credentials from any active institution to fail verification — a silent false negative that is arguably worse than a false positive, because it erodes trust in genuine credentials. The current implementation follows pagination markers to a bounded limit and reports explicitly when a scan is truncated rather than returning a negative result.

### 4.8 A credential-agnostic engine

Nothing in §4.1–4.7 refers to a diploma. The document hashed in §4.1 is an arbitrary JSON object; the Merkle tree of §4.3 combines opaque digests; the identity handshake of §4.5 binds a *domain* to a *wallet* irrespective of what that domain issues; the verification algorithm of §4.7 recomputes a hash and matches it against a ledger anchor. "Diploma" appears nowhere in the trust-bearing path.

A **credential type** is therefore a description of the document's fields, not a variant of the protocol:

```
{
  id: "professional-license",
  displayName: "Professional License",
  subjectNoun: "Licensee",       // vs "Graduate", "Employee"
  issuerNoun:  "Licensing Body",  // vs "Institution", "Employer"
  fields: [ "holderName", "profession", "licenseNumber", "expiryYear" ]
}
```

Swapping this configuration changes the fields captured at issuance, the roster columns accepted at batch time, and the labels shown to a verifier — while the salted hash, the Merkle construction, the soulbound NFT anchor, the did:web handshake, and the revocation records are byte-for-byte identical. A verifier need not be told the type in advance: it infers the type from the fields present in the credential it is handed, and falls back to a generic rendering when it recognizes none.

This is not a claimed extensibility; it is the shape of the implementation. The reference system ships three types — academic diplomas, professional licenses, and workforce credentials — exercised through the same issuance, batch, and verification code paths. The consequence is that credential fraud in three distinct domains — a fraudulent nursing diploma, a lapsed or forged professional license presented as current, a fabricated employment record — is addressed by one verification substrate rather than three bespoke systems. The diploma case is the initial deployment target because its fraud dynamics are the most acute and best documented (§1.1), not because the engine is specific to it.

---

## 5. Privacy

The ledger record for a credential consists of a 256-bit digest, a timestamp, and the issuer's address. It contains no name, no degree, no date of birth, and no institution-internal identifier.

This matters legally as well as ethically. Under **FERPA** (20 U.S.C. § 1232g), education records are protected, and publishing student data to an immutable public ledger would be both non-compliant and irreversible — there is no delete. The same reasoning applies to the erasure expectations of GDPR-style regimes: because no personal data is published, there is nothing on-chain to erase, and a graduate who destroys their credential file removes the only artifact linking them to the anchor.

Two residual exposures should be stated plainly:

1. **Aggregate metadata is public.** Anyone can see that a given institution anchored a batch of *n* credentials on a given date. Class sizes and issuance cadence are inferable. This is generally not sensitive, but it is not nothing.
2. **The graduate's file is the disclosure surface.** Sharing a credential file (or QR code) discloses its full contents to the recipient. Selective disclosure — proving "holds a BSc" without revealing name or year — is not supported in this version (§8).

---

## 6. Implementation

The reference implementation is source-available (Business Source License 1.1, converting to
Apache-2.0 in 2030) and comprises:

| Component | Role |
|---|---|
| Vue 3 + TypeScript SPA | Issuance, verification, revocation, and institution-onboarding interfaces |
| `xrpl.js` v4 | Ledger interaction |
| Xaman (XUMM) | Wallet signing — the institution signs on their own device; keys never enter the browser or reach any Anchored server |
| Serverless functions | Two stateless proxies: creating Xaman sign requests, and fetching `did.json` (to avoid browser CORS restrictions on institutional domains). Neither handles credential data or keys. |

**Status.** The system is operational on the **XRP Ledger Testnet**: single and batch issuance, verification of both anchor types, both revocation mechanisms, and the identity handshake are implemented and exercised end-to-end, across three credential types (diploma, professional license, workforce credential) sharing one code path. Anchored publishes its own `did.json` and operates its demonstration issuer under the same handshake it asks of institutions.

The cryptographic core — Merkle construction, roster processing, and ledger-scan logic — is covered by 60 unit tests, including adversarial cases: tampered leaves, tampered proofs, cross-batch proof replay, internal-node substitution, single-credential revocation within a batch, roster parsing across credential types, and canonicalization and proof-independence of the anchor hash.

**Not yet done:** mainnet deployment, and any production pilot. No institution has yet issued credentials of record through the system. This paper describes a working prototype with a defined security model, not a deployed production service.

---

## 7. Economics

Verification is free and unauthenticated, permanently and by design. This is a deliberate asymmetry: every free verification increases the value of being an issuer, and charging verifiers would suppress the very checking the system exists to enable. Costs fall on issuance, where they are trivially absorbed — an entire graduating class costs one transaction.

The intended sustainable model is institutional subscription, with a verification API for high-volume integrators (HR platforms, licensing boards, background-check providers) as a later addition. The relevant comparison is not "cheaper blockchain" but the incumbent verification workflow: tens of dollars and days per check, versus seconds and a fraction of a cent.

---

## 8. Limitations and future work

Stated plainly, because a security document that lists no weaknesses is not a security document.

1. **Canonicalization is not JCS.** The implementation sorts object keys recursively but does not implement RFC 8785 (JSON Canonicalization Scheme). Edge cases in number formatting and Unicode normalization could in principle produce divergent digests across implementations. Adopting JCS is the correct fix.
2. **No cryptographic signature on the credential document.** Authority derives from the signed ledger transaction. This works but is not W3C Data Integrity conformant, and it means a credential file cannot be validated offline. Adding an Ed25519 Data Integrity proof over the credential is planned.
3. ~~**A redundant inner digest.**~~ *(Resolved.)* Earlier credentials carried a second digest inside the `proof` block, computed over the credential before the proof was attached and distinct from the anchor hash. The anchor hash is now computed over the credential *content only* — the `proof` envelope is excluded from hashing, in line with the W3C Data Integrity model — so a single value is produced identically at issuance, in the anchor and QR, and at verification. The inner digest has been removed.
4. **Issuer identity rests on Web PKI and DNS.** An adversary who compromises an institution's DNS or web server can publish a `did.json` naming their own wallet. This is a strictly higher bar than creating a wallet, but it is not unconditional. Certificate Transparency monitoring and multi-source attestation would strengthen it.
5. **Verification scans are bounded.** Very long issuer histories are truncated at a fixed limit; the verifier reports truncation rather than concluding falsely, but an indexing layer is the durable answer.
6. **No selective disclosure.** Verification requires the full credential document. BBS+ signatures or a zero-knowledge membership proof would let a graduate prove a claim without revealing the rest.
7. **Key loss.** If an institution loses its signing key it cannot revoke, and if a graduate loses their credential file it cannot be reconstructed from the ledger — by design, since the ledger holds no recoverable data. Institutional key rotation via the DID document, and issuer-side re-issuance, are open work.
8. **Batch privacy.** A batch anchor reveals class size. Padding to a fixed power of two would obscure it at negligible cost.

---

## 9. Conclusion

Credential fraud persists because verification is expensive and the credential itself carries no proof of origin. Anchored addresses both: a salted fingerprint anchored on a public ledger makes verification free, instant, and independent of any intermediary, while a domain-bound issuer identity turns "this hash exists on-chain" into the materially stronger claim "this credential was issued by a named institution."

The two design choices we consider most consequential are negative ones. **Anchored holds no institutional keys**, so compromising it cannot produce a single fraudulent credential. And **it refuses to display a green checkmark for an unbound issuer**, because a verification system that validates anything a diploma mill anchors has inverted its own purpose.

Because the engine is credential-agnostic (§4.8), these properties are not specific to diplomas. The same substrate verifies professional licenses, workforce identities, and other institutional credentials without change to its cryptography or trust model — a single verification layer for a class of fraud that today is fought, where it is fought at all, one document type and one institution at a time.

---

## References

1. U.S. Department of Justice / HHS-OIG, *Operation Nightingale* — nationwide fraudulent nursing diploma investigation, 2023. See e.g. DOJ SDFL, "Fraud Charges Filed Against 12 Defendants (Phase II)": https://www.justice.gov/usao-sdfl/pr/fraud-charges-filed-against-12-defendants-phase-ii-operation-nightingale
2. W3C, *Verifiable Credentials Data Model*. https://www.w3.org/TR/vc-data-model/
3. W3C, *Decentralized Identifiers (DIDs) v1.0*. https://www.w3.org/TR/did-core/
4. W3C CCG, *did:web Method Specification*. https://w3c-ccg.github.io/did-method-web/
5. Laurie, B., Langley, A., Kasper, E., *Certificate Transparency*, RFC 6962, 2013. https://datatracker.ietf.org/doc/html/rfc6962
6. Rundgren, A., Jordan, B., Erdtman, S., *JSON Canonicalization Scheme (JCS)*, RFC 8785, 2020.
7. XRP Ledger, *XLS-20: Non-Fungible Tokens*. https://xrpl.org/non-fungible-tokens.html
8. Family Educational Rights and Privacy Act (FERPA), 20 U.S.C. § 1232g.
9. MIT Media Lab, *Blockcerts: The Open Standard for Blockchain Credentials*. https://www.blockcerts.org/
10. Digital Credentials Consortium. https://digitalcredentials.mit.edu/
11. European Commission, *European Blockchain Services Infrastructure (EBSI)*.
12. XRP Ledger, *NFT Reserve Requirements*. https://xrpl.org/docs/concepts/tokens/nfts/reserve-requirements
13. XRP Ledger, *Reserves*. https://xrpl.org/docs/concepts/accounts/reserves
14. XRPL Foundation / RippleX, *rippled 3.1.1 release* — Batch (XLS-56) and `fixBatchInnerSigs` marked unsupported following the February 2026 signer-verification vulnerability disclosure.

*Figures attributed to investigative estimates (§1.1) are cited as orders of magnitude. Readers evaluating this work for funding, procurement, or policy purposes are encouraged to verify primary sources independently.*
