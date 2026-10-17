import { Buffer } from 'buffer'
import { getNFTokenID } from 'xrpl'
import type { CredentialType } from './credentialTypes'

/** Memo types Anchored writes to the ledger. */
export const MEMO_SINGLE = 'vc-hash'
export const MEMO_BATCH = 'vc-batch'
export const MEMO_REVOKE = 'vc-revoke'

export interface AnchorMatch {
  nftId: string
  mintDate: string
  kind: 'single' | 'batch'
}

export interface LedgerScan {
  anchor: AnchorMatch | null
  /** The issuer published a revocation memo for this exact credential */
  revoked: boolean
  revokedAt: string
  scannedTx: number
  /** True when the cap was hit before the issuer's history ran out */
  truncated: boolean
}

export interface IssuedAnchor {
  nftId: string
  kind: 'single' | 'batch'
  reference: string
  mintDate: string
  revoked: boolean
  revokedAt: string
  txHash: string
}

export interface IssuerAnchors {
  anchors: IssuedAnchor[]
  scannedTx: number
  truncated: boolean
  individualRevocations: number
}

export interface ScanTarget {
  /** Salted credential hash — the leaf, and what single mints anchor directly */
  hash: string
  /** Merkle root, when the credential was issued as part of a batch */
  batchRoot?: string
}

/**
 * Whether a credential's expiry year has passed. Returns false when the type
 * has no expiry, when no year is present, or when the value is unusable.
 */
export function isExpired(
  subject: Record<string, unknown>,
  type: CredentialType,
  now: Date = new Date(),
): boolean {
  if (!type.expiryField) return false

  const raw = subject[type.expiryField]
  if (raw === undefined || raw === null || raw === '') return false

  const year = Number(raw)
  if (!Number.isFinite(year)) return false

  return now.getFullYear() > year
}

export function decodeHex(hex?: string): string {
  if (!hex) return ''
  try {
    return Buffer.from(hex, 'hex').toString('utf8')
  } catch {
    return ''
  }
}

interface DecodedMemo {
  type: string
  data: any
}

function decodeMemos(tx: any): DecodedMemo[] {
  if (!Array.isArray(tx?.Memos)) return []
  const out: DecodedMemo[] = []
  for (const entry of tx.Memos) {
    const memo = entry?.Memo
    if (!memo) continue
    const type = decodeHex(memo.MemoType)
    try {
      out.push({ type, data: JSON.parse(decodeHex(memo.MemoData)) })
    } catch {
      // A memo we didn't write, or malformed — ignore rather than fail the check
    }
  }
  return out
}

/** Does this mint transaction anchor the credential we're checking? */
function matchesAnchor(tx: any, target: ScanTarget): AnchorMatch['kind'] | null {
  for (const memo of decodeMemos(tx)) {
    if (target.batchRoot && memo.type === MEMO_BATCH && memo.data?.root === target.batchRoot) return 'batch'
    if (!target.batchRoot && memo.type === MEMO_SINGLE && memo.data?.hash === target.hash) return 'single'
  }
  // Fall back to the URI anchor (older credentials, or memos stripped by a relay)
  const uri = decodeHex(tx?.URI)
  if (target.batchRoot && uri === `vc:merkle:${target.batchRoot}`) return 'batch'
  if (!target.batchRoot && uri === `vc:sha256:${target.hash}`) return 'single'
  return null
}

/**
 * Walk an issuer's transaction history looking for this credential's anchor and
 * for any revocation the issuer published. Paginated, because a real institution
 * accumulates far more than one page of transactions — the previous single
 * 100-transaction request silently failed to verify valid credentials.
 */
export async function scanIssuerLedger(
  client: { request: (req: any) => Promise<any> },
  account: string,
  target: ScanTarget,
  { pageSize = 200, maxTx = 2000, onProgress }: { pageSize?: number; maxTx?: number; onProgress?: (scanned: number) => void } = {}
): Promise<LedgerScan> {
  let marker: unknown
  let scannedTx = 0
  let anchor: AnchorMatch | null = null
  let revoked = false
  let revokedAt = ''

  do {
    const resp: any = await client.request({
      command: 'account_tx',
      account,
      limit: pageSize,
      ...(marker ? { marker } : {}),
    })
    const txs: any[] = Array.isArray(resp?.result?.transactions) ? resp.result.transactions : []

    for (const txObj of txs) {
      const tx = txObj.tx || txObj.tx_json
      if (!tx) continue

      // Revocation can ride on any transaction type the issuer signs
      if (!revoked) {
        for (const memo of decodeMemos(tx)) {
          if (memo.type === MEMO_REVOKE && memo.data?.hash === target.hash) {
            revoked = true
            revokedAt = txObj.close_time_iso || ''
            break
          }
        }
      }

      if (!anchor && tx.TransactionType === 'NFTokenMint') {
        const kind = matchesAnchor(tx, target)
        if (kind) {
          let nftId = ''
          try {
            // Throws on missing/!unparseable metadata — a malformed entry must
            // not abort the scan, so fall back to an empty id.
            nftId = getNFTokenID(txObj.meta) || ''
          } catch {}
          anchor = { nftId, mintDate: txObj.close_time_iso || '', kind }
        }
      }
    }

    scannedTx += txs.length
    onProgress?.(scannedTx)
    marker = resp?.result?.marker

    // A revoked credential can stop early; otherwise keep paging until we find
    // the anchor, because a revocation could still appear later in the history.
  } while (marker && scannedTx < maxTx && !(anchor && revoked))

  return { anchor, revoked, revokedAt, scannedTx, truncated: Boolean(marker) && scannedTx >= maxTx }
}

/** Walk all credential anchors in an issuer's history, including burned NFTs. */
export async function scanIssuerAnchors(
  client: { request: (req: any) => Promise<any> },
  account: string,
  { pageSize = 200, maxTx = 2000, onProgress }: { pageSize?: number; maxTx?: number; onProgress?: (scanned: number) => void } = {}
): Promise<IssuerAnchors> {
  let marker: unknown
  let scannedTx = 0
  const anchors: IssuedAnchor[] = []
  const burned = new Map<string, string>()
  let individualRevocations = 0

  do {
    const resp: any = await client.request({
      command: 'account_tx',
      account,
      limit: pageSize,
      ...(marker ? { marker } : {}),
    })
    const txs: any[] = Array.isArray(resp?.result?.transactions) ? resp.result.transactions : []

    for (const txObj of txs) {
      const tx = txObj.tx || txObj.tx_json
      if (!tx) continue
      const date = txObj.close_time_iso || ''

      for (const memo of decodeMemos(tx)) {
        if (memo.type === MEMO_REVOKE && memo.data?.hash) individualRevocations++
      }

      if (tx.TransactionType === 'NFTokenBurn' && tx.NFTokenID) {
        burned.set(tx.NFTokenID, date)
        continue
      }

      if (tx.TransactionType !== 'NFTokenMint') continue

      let kind: IssuedAnchor['kind'] | null = null
      let reference = ''
      for (const memo of decodeMemos(tx)) {
        if (memo.type === MEMO_SINGLE && memo.data?.hash) {
          kind = 'single'
          reference = memo.data.hash
          break
        }
        if (memo.type === MEMO_BATCH && memo.data?.root) {
          kind = 'batch'
          reference = memo.data.root
          break
        }
      }
      if (!kind) {
        const uri = decodeHex(tx.URI)
        if (uri.startsWith('vc:sha256:')) {
          kind = 'single'
          reference = uri.slice('vc:sha256:'.length)
        } else if (uri.startsWith('vc:merkle:')) {
          kind = 'batch'
          reference = uri.slice('vc:merkle:'.length)
        }
      }
      if (!kind) continue

      let nftId = ''
      try {
        nftId = getNFTokenID(txObj.meta) || ''
      } catch {}
      anchors.push({
        nftId,
        kind,
        reference,
        mintDate: date,
        revoked: false,
        revokedAt: '',
        txHash: txObj.hash || tx.hash || '',
      })
    }

    scannedTx += txs.length
    onProgress?.(scannedTx)
    marker = resp?.result?.marker
  } while (marker && scannedTx < maxTx)

  for (const anchor of anchors) {
    const revokedAt = burned.get(anchor.nftId)
    if (revokedAt !== undefined) {
      anchor.revoked = true
      anchor.revokedAt = revokedAt
    }
  }

  return { anchors, scannedTx, truncated: Boolean(marker) && scannedTx >= maxTx, individualRevocations }
}

/** The transaction an issuer signs to revoke a single credential. */
export function buildRevocationTx(account: string, credentialHash: string) {
  return {
    TransactionType: 'AccountSet',
    Account: account,
    Memos: [
      {
        Memo: {
          MemoType: Buffer.from(MEMO_REVOKE).toString('hex'),
          MemoData: Buffer.from(JSON.stringify({ hash: credentialHash })).toString('hex'),
        },
      },
    ],
  }
}
