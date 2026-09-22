// Sends a credential to its holder.
//
// Resend is used because it is already in use elsewhere for this project's
// domains, but nothing outside this file knows that — swapping providers means
// rewriting `deliver()` only.
//
// Configuration (never committed):
//   RESEND_API_KEY   the provider API key
//   EMAIL_FROM       e.g. "SALCC Credentials <credentials@salcc.edu.lc>"
//   EMAIL_REPLY_TO   optional, e.g. the registrar's own address

export type CredentialEmail = {
  to: string
  issuerName: string
  credentialLabel: string
  holderName: string
  credentialJson: string
  qrDataUrl: string
}

export async function sendCredentialEmail(msg: CredentialEmail): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!apiKey || !from) {
    throw Object.assign(
      new Error('Email delivery is not configured on this deployment'),
      { statusCode: 503 },
    )
  }

  const greeting = msg.holderName ? `Hello ${msg.holderName},` : 'Hello,'
  const label = msg.credentialLabel.toLowerCase()

  const attachments: Array<{ filename: string; content: string }> = [
    {
      filename: 'credential.json',
      content: Buffer.from(msg.credentialJson, 'utf8').toString('base64'),
    },
  ]
  if (msg.qrDataUrl) {
    attachments.push({
      filename: 'credential-qr.png',
      content: msg.qrDataUrl.replace(/^data:image\/png;base64,/, ''),
    })
  }

  await deliver(apiKey, {
    from,
    to: [msg.to],
    ...(process.env.EMAIL_REPLY_TO ? { reply_to: process.env.EMAIL_REPLY_TO } : {}),
    subject: `Your ${label} from ${msg.issuerName}`,
    text: plainBody(greeting, label, msg.issuerName),
    html: htmlBody(greeting, label, msg.issuerName),
    attachments,
  })
}

async function deliver(apiKey: string, payload: Record<string, unknown>) {
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  if (!resp.ok) {
    // The provider's error body can quote the recipient address, so report the
    // status only — this message may end up in a log.
    throw Object.assign(
      new Error(`Email provider rejected the message (HTTP ${resp.status})`),
      { statusCode: 502 },
    )
  }
}

function plainBody(greeting: string, label: string, issuerName: string) {
  return `${greeting}

Your ${label} from ${issuerName} is attached, along with a QR code.

Anyone you share it with — an employer, a university, or an immigration office —
can confirm it is genuine in seconds, free of charge, at:

  https://anchor-ed.vercel.app/verify

They upload the attached file, or scan the QR code. No account is needed, there
is no fee, and the link never expires.

Keep both files somewhere safe. They are yours.

${issuerName}
`
}

function htmlBody(greeting: string, label: string, issuerName: string) {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1a202c;max-width:560px">
  <p>${escapeHtml(greeting)}</p>
  <p>Your ${escapeHtml(label)} from <strong>${escapeHtml(issuerName)}</strong> is attached, along with a QR code.</p>
  <p>Anyone you share it with — an employer, a university, or an immigration office — can confirm it is genuine in seconds, free of charge:</p>
  <p><a href="https://anchor-ed.vercel.app/verify" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Verify this credential</a></p>
  <p style="color:#4a5568">They upload the attached file, or scan the QR code. No account is needed, there is no fee, and the link never expires.</p>
  <p style="color:#4a5568">Keep both files somewhere safe. They are yours.</p>
  <p>${escapeHtml(issuerName)}</p>
</div>`
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string),
  )
}
