// Vercel serverless function: POST /api/email/send
//
// Emails a freshly issued credential to its holder, with the credential JSON
// and QR code attached. Runs server-side because the mail provider's API key
// must never reach the browser.
//
// Anti-abuse: this endpoint sends attachments to arbitrary addresses, so it
// would be an open spam relay if left unguarded. Rather than introduce
// accounts, we require proof that the credential really exists: the caller
// supplies an NFT ID, and we check against the public ledger that the NFT is
// currently held by the stated issuer. Minting costs XRP and a reserve, so
// abusing this endpoint means paying for every message — which is the point.
//
// Privacy: the recipient address is used to send the message and nothing else.
// It is never stored and never logged.

import { sendCredentialEmail } from '../../server/email'
import { assertMintedBy } from '../../server/verifyAnchor'

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const result = await handleSendCredentialEmail(req.body)
    res.status(200).json(result)
  } catch (err: any) {
    const status = Number(err?.statusCode) || 500
    res.status(status).json({ error: err?.message || String(err) })
  }
}

/**
 * Shared by the Vercel function above and the Express dev server, so both
 * environments enforce exactly the same validation.
 */
export async function handleSendCredentialEmail(body: any) {
  const to = String(body?.to || '').trim()
  const issuerAccount = String(body?.issuerAccount || '').trim()
  const nftId = String(body?.nftId || '').trim()
  const credential = body?.credential
  const qrDataUrl = String(body?.qrDataUrl || '')
  const issuerName = String(body?.issuerName || '').trim()
  const credentialLabel = String(body?.credentialLabel || 'credential').trim()
  const holderName = String(body?.holderName || '').trim()

  if (!isEmail(to)) throw httpError(400, 'A valid recipient email address is required')
  if (!/^r[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(issuerAccount)) {
    throw httpError(400, 'A valid issuer account is required')
  }
  if (!/^[0-9A-F]{64}$/i.test(nftId)) throw httpError(400, 'A valid NFT ID is required')
  if (!credential || typeof credential !== 'object') {
    throw httpError(400, 'The credential document is required')
  }
  if (qrDataUrl && !qrDataUrl.startsWith('data:image/png;base64,')) {
    throw httpError(400, 'QR code must be a PNG data URL')
  }

  // Proof of work, in the literal sense: no anchor on the ledger, no email.
  await assertMintedBy(nftId, issuerAccount)

  await sendCredentialEmail({
    to,
    issuerName: issuerName || issuerAccount,
    credentialLabel,
    holderName,
    credentialJson: JSON.stringify(credential, null, 2),
    qrDataUrl,
  })

  // Deliberately does not echo the address back, so it stays out of any log
  // that records responses.
  return { sent: true }
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) && value.length <= 254
}

function httpError(statusCode: number, message: string) {
  const err: any = new Error(message)
  err.statusCode = statusCode
  return err
}
