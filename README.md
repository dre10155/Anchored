# ⚓ Anchored

**Tamper-proof academic credentials, anchored on the XRP Ledger.**

**🔗 Live app: [anchor-ed.vercel.app](https://anchor-ed.vercel.app)** · Beta on XRPL Testnet

📄 **[Read the whitepaper](WHITEPAPER.md)** — threat model, Merkle batch construction, issuer-identity handshake, and limitations.

Credential fraud is a public-safety crisis. In 2023, *Operation Nightingale* uncovered ~7,600
fake nursing diplomas sold in Florida — fraudulent nurses reached real patients. Diploma mills
sell an estimated 100,000+ fake degrees in the US every year, while legitimate verification
still means days of phone calls and per-check fees.

Anchored makes a diploma as verifiable as a blockchain transaction — because it is one.

## How it works

1. **Issue** — The institution builds a W3C-style Verifiable Credential for the graduate.
   A salted SHA-256 fingerprint of the credential is minted into an NFT from the
   institution's XRPL wallet (hash in the transaction memo). The student receives the
   credential file + a QR code. **No personal data touches the ledger** — only the fingerprint.
2. **Hold** — The graduate owns their credential (JSON + QR). The salt in the credential
   prevents dictionary attacks against the on-ledger hash.
3. **Verify** — Any employer, licensing board, or agency scans the QR (or uploads the file).
   Anchored recomputes the salted hash and checks it against NFTs minted by the issuer's
   address on the public ledger. Match → authentic. Tampered → fail. Seconds, fractions of
   a cent, no intermediary.

## Why XRPL

- ~3–5 second finality, ~$0.0002 per transaction
- Native NFT primitives (XLS-20) — no smart-contract attack surface
- Carbon-neutral consensus
- Full public auditability of every credential an institution has ever issued

## Stack

Vue 3 · TypeScript · Vite · Tailwind CSS · xrpl.js v4

## Run locally

```bash
npm install
npm run dev
```

Currently runs against **XRPL Testnet** (`wss://s.altnet.rippletest.net:51233`).
Create and fund a testnet issuer wallet at the [XRPL faucet](https://xrpl.org/resources/dev-tools/xrp-faucets).

## Roadmap

- [x] Xaman (XUMM) wallet signing — no seeds in the browser
- [x] Hash-only NFT URIs (zero PII on-chain, FERPA-aligned)
- [x] Soulbound (non-transferable) diploma NFTs + issuer revocation
- [x] `did:web` issuer identity — cryptographically bind XRPL addresses to institution domains
- [x] Verifier pagination for high-volume issuers
- [x] Merkle-batch anchoring for graduating classes — one signature per class, zero custody
- [ ] Verification API for ATS / licensing-board integration

## Institution onboarding (did:web identity)

Anchored distinguishes **anchored** credentials (hash matches an NFT) from **verified**
credentials (the issuing wallet provably belongs to a real institution). To get the green
"issued by your-domain.edu" badge, an institution completes a two-way handshake:

1. **Domain → wallet:** host a DID document at `https://<your-domain>/.well-known/did.json`
   listing your official XRPL issuing address (the `/identity` page generates this file).
2. **Wallet → domain:** sign one `AccountSet` transaction (via Xaman, on the `/identity`
   page) setting your wallet's on-ledger `Domain` field to the same domain.

Impersonating an institution now requires compromising its actual website *and* its
wallet keys. Either side can be checked independently by anyone, forever.

## Security model (current, testnet)

The issuer seed input in the UI is a **development convenience only** and will be removed
in favor of Xaman signing before any mainnet deployment. Never enter a mainnet seed.

## License

[Business Source License 1.1](LICENSE) © Andreas Mendes — source-available. Free to view, self-host,
and run for your own credential issuance/verification; production use as a competing hosted
service to third parties requires a commercial license. Converts to Apache-2.0 on 2030-07-28.
