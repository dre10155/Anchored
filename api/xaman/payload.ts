import { XummSdk } from 'xumm-sdk'

// Vercel serverless function: POST /api/xaman/payload
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  try {
    const { txjson } = req.body || {}
    const isSignIn = txjson?.TransactionType === 'SignIn'
    if (!txjson || typeof txjson !== 'object' || !txjson.TransactionType || (!isSignIn && !txjson.Account)) {
      res.status(400).json({ error: 'txjson with TransactionType and Account is required' })
      return
    }

    const xumm = new XummSdk(process.env.XUMM_APIKEY!, process.env.XUMM_APISECRET!)
    const created = await xumm.payload.create({ txjson })
    if (!created) {
      res.status(502).json({ error: 'Xaman did not return a payload' })
      return
    }

    res.status(200).json({
      uuid: created.uuid,
      qrPng: created.refs.qr_png,
      deeplink: created.next.always,
      websocketUrl: created.refs.websocket_status,
    })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || String(err) })
  }
}
