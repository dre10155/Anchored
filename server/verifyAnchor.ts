// Confirms that a credential really was anchored on the ledger by the account
// claiming to have issued it.
//
// This is what keeps /api/email/send from being an open mail relay: an NFT ID
// cannot be invented, because minting one costs XRP and an owner reserve on the
// issuer's own account.

import { Client } from 'xrpl'

const XRPL_WS = process.env.XRPL_WS || 'wss://s.altnet.rippletest.net:51233'

/** Throws unless `nftId` is currently held by `issuerAccount`. */
export async function assertMintedBy(nftId: string, issuerAccount: string): Promise<void> {
  const client = new Client(XRPL_WS)
  await client.connect()
  try {
    // account_nfts is paginated; an issuer with many credentials needs more
    // than the first page, so follow markers until the NFT turns up.
    let marker: unknown
    for (let page = 0; page < 20; page++) {
      const resp: any = await client.request({
        command: 'account_nfts',
        account: issuerAccount,
        limit: 400,
        ...(marker ? { marker } : {}),
      })
      const found = (resp.result?.account_nfts || []).some(
        (n: any) => String(n.NFTokenID).toUpperCase() === nftId.toUpperCase(),
      )
      if (found) return
      marker = resp.result?.marker
      if (!marker) break
    }
    throw Object.assign(
      new Error('That credential is not anchored by this issuer, so no email was sent'),
      { statusCode: 403 },
    )
  } catch (err: any) {
    // A malformed or unfunded account surfaces here rather than as a crash.
    if (err?.statusCode) throw err
    if (err?.data?.error === 'actNotFound') {
      throw Object.assign(new Error('Issuer account not found on the ledger'), { statusCode: 400 })
    }
    throw Object.assign(
      new Error(`Could not confirm the anchor on the ledger: ${err?.message || String(err)}`),
      { statusCode: 502 },
    )
  } finally {
    if (client.isConnected()) await client.disconnect()
  }
}
