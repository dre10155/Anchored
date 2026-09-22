import { describe, it, expect } from 'vitest'
import { Buffer } from 'buffer'
import { CREDENTIAL_TYPES } from './credentialTypes'
import { scanIssuerLedger, buildRevocationTx, decodeHex, MEMO_SINGLE, MEMO_BATCH, MEMO_REVOKE, isExpired } from './verify'

const ISSUER = 'rNeqwL8sjHvi4TndDCrYqYDh1dQKNBekhv'
const HASH = 'a'.repeat(64)
const ROOT = 'b'.repeat(64)
const NFT_ID = '000100001234567890ABCDEF1234567890ABCDEF1234567890ABCDEF'

const hex = (s: string) => Buffer.from(s).toString('hex')

function memo(type: string, data: unknown) {
  return { Memo: { MemoType: hex(type), MemoData: hex(JSON.stringify(data)) } }
}

function mintMeta(nftId = NFT_ID) {
  return {
    AffectedNodes: [
      {
        CreatedNode: {
          LedgerEntryType: 'NFTokenPage',
          NewFields: { NFTokens: [{ NFToken: { NFTokenID: nftId } }] },
        },
      },
    ],
  }
}

function mintTx(opts: { memos?: any[]; uri?: string; date?: string; nftId?: string } = {}) {
  return {
    tx: {
      TransactionType: 'NFTokenMint',
      Account: ISSUER,
      ...(opts.uri ? { URI: hex(opts.uri) } : {}),
      ...(opts.memos ? { Memos: opts.memos } : {}),
    },
    meta: mintMeta(opts.nftId),
    close_time_iso: opts.date || '2026-06-15T10:00:00Z',
  }
}

function revokeTx(hash: string, date = '2026-07-01T10:00:00Z') {
  return {
    tx: { TransactionType: 'AccountSet', Account: ISSUER, Memos: [memo(MEMO_REVOKE, { hash })] },
    meta: {},
    close_time_iso: date,
  }
}

/** Mock rippled that serves transactions one page at a time. */
function mockClient(pages: any[][]) {
  const calls: any[] = []
  return {
    calls,
    request: async (req: any) => {
      calls.push(req)
      const index = req.marker ? Number(req.marker) : 0
      const transactions = pages[index] ?? []
      const hasMore = index + 1 < pages.length
      return { result: { transactions, ...(hasMore ? { marker: String(index + 1) } : {}) } }
    },
  }
}

describe('isExpired', () => {
  const type = CREDENTIAL_TYPES.find((t) => t.id === 'professional-license')!

  it('returns false when the type has no expiry field', () => {
    expect(isExpired({ studentName: 'Jane' }, CREDENTIAL_TYPES[0], new Date('2026-06-01'))).toBe(false)
  })

  it('returns false when the field is missing', () => {
    expect(isExpired({ holderName: 'Jane' }, type, new Date('2026-06-01'))).toBe(false)
  })

  it('returns false for the current-year boundary', () => {
    expect(isExpired({ expiryYear: 2026 }, type, new Date('2026-06-01'))).toBe(false)
  })

  it('returns true when the expiry year is in the past', () => {
    expect(isExpired({ expiryYear: 2024 }, type, new Date('2026-06-01'))).toBe(true)
  })

  it('accepts string values from JSON and roster data', () => {
    expect(isExpired({ expiryYear: '2024' }, type, new Date('2026-06-01'))).toBe(true)
  })

  it('returns false for malformed values without throwing', () => {
    expect(isExpired({ expiryYear: 'soon' }, type, new Date('2026-06-01'))).toBe(false)
    expect(isExpired({ expiryYear: NaN }, type, new Date('2026-06-01'))).toBe(false)
  })
})

describe('scanIssuerLedger — single-mint credentials', () => {
  it('finds an anchor by memo', async () => {
    const client = mockClient([[mintTx({ memos: [memo(MEMO_SINGLE, { hash: HASH })] })]])
    const scan = await scanIssuerLedger(client, ISSUER, { hash: HASH })
    expect(scan.anchor).toMatchObject({ nftId: NFT_ID, kind: 'single' })
    expect(scan.revoked).toBe(false)
  })

  it('finds an anchor by URI when the memo is absent', async () => {
    const client = mockClient([[mintTx({ uri: `vc:sha256:${HASH}` })]])
    const scan = await scanIssuerLedger(client, ISSUER, { hash: HASH })
    expect(scan.anchor?.kind).toBe('single')
  })

  it('does not match a different credential', async () => {
    const client = mockClient([[mintTx({ memos: [memo(MEMO_SINGLE, { hash: 'c'.repeat(64) })] })]])
    const scan = await scanIssuerLedger(client, ISSUER, { hash: HASH })
    expect(scan.anchor).toBeNull()
  })

  it('ignores unrelated and malformed memos without failing', async () => {
    const client = mockClient([
      [
        { tx: { TransactionType: 'Payment', Account: ISSUER, Memos: [{ Memo: { MemoType: hex('other'), MemoData: 'zzzz' } }] }, meta: {} },
        { tx: { TransactionType: 'NFTokenMint', Account: ISSUER, Memos: [{ Memo: {} }] }, meta: {} },
        mintTx({ memos: [memo(MEMO_SINGLE, { hash: HASH })] }),
      ],
    ])
    const scan = await scanIssuerLedger(client, ISSUER, { hash: HASH })
    expect(scan.anchor?.kind).toBe('single')
  })

  it('survives a mint whose metadata is missing', async () => {
    const client = mockClient([
      [{ tx: { TransactionType: 'NFTokenMint', Account: ISSUER, Memos: [memo(MEMO_SINGLE, { hash: HASH })] } }],
    ])
    const scan = await scanIssuerLedger(client, ISSUER, { hash: HASH })
    expect(scan.anchor).toMatchObject({ nftId: '', kind: 'single' })
  })
})

describe('scanIssuerLedger — batched credentials', () => {
  it('finds the batch anchor by root, not by individual hash', async () => {
    const client = mockClient([[mintTx({ memos: [memo(MEMO_BATCH, { root: ROOT, count: 250 })] })]])
    const scan = await scanIssuerLedger(client, ISSUER, { hash: HASH, batchRoot: ROOT })
    expect(scan.anchor).toMatchObject({ kind: 'batch', nftId: NFT_ID })
  })

  it('finds the batch anchor by URI', async () => {
    const client = mockClient([[mintTx({ uri: `vc:merkle:${ROOT}` })]])
    const scan = await scanIssuerLedger(client, ISSUER, { hash: HASH, batchRoot: ROOT })
    expect(scan.anchor?.kind).toBe('batch')
  })

  it("rejects a credential claiming a root this issuer never anchored", async () => {
    const client = mockClient([[mintTx({ memos: [memo(MEMO_BATCH, { root: ROOT })] })]])
    const scan = await scanIssuerLedger(client, ISSUER, { hash: HASH, batchRoot: 'd'.repeat(64) })
    expect(scan.anchor).toBeNull()
  })

  it('does not accept a single-mint anchor for a batched credential', async () => {
    const client = mockClient([[mintTx({ memos: [memo(MEMO_SINGLE, { hash: HASH })] })]])
    const scan = await scanIssuerLedger(client, ISSUER, { hash: HASH, batchRoot: ROOT })
    expect(scan.anchor).toBeNull()
  })
})

describe('scanIssuerLedger — revocation', () => {
  it('detects a revocation memo for this credential', async () => {
    const client = mockClient([[mintTx({ memos: [memo(MEMO_SINGLE, { hash: HASH })] }), revokeTx(HASH)]])
    const scan = await scanIssuerLedger(client, ISSUER, { hash: HASH })
    expect(scan.revoked).toBe(true)
    expect(scan.revokedAt).toBe('2026-07-01T10:00:00Z')
  })

  it('revokes one graduate out of a batch without touching the others', async () => {
    const pages = [[mintTx({ memos: [memo(MEMO_BATCH, { root: ROOT })] }), revokeTx(HASH)]]
    const revoked = await scanIssuerLedger(mockClient(pages), ISSUER, { hash: HASH, batchRoot: ROOT })
    const classmate = await scanIssuerLedger(mockClient(pages), ISSUER, { hash: 'e'.repeat(64), batchRoot: ROOT })
    expect(revoked.revoked).toBe(true)
    expect(classmate.revoked).toBe(false)
    expect(classmate.anchor?.kind).toBe('batch')
  })

  it("ignores a revocation aimed at somebody else's credential", async () => {
    const client = mockClient([[mintTx({ memos: [memo(MEMO_SINGLE, { hash: HASH })] }), revokeTx('f'.repeat(64))]])
    const scan = await scanIssuerLedger(client, ISSUER, { hash: HASH })
    expect(scan.revoked).toBe(false)
  })

  it('finds a revocation issued long after the anchor, on a later page', async () => {
    const client = mockClient([
      [mintTx({ memos: [memo(MEMO_SINGLE, { hash: HASH })] })],
      [{ tx: { TransactionType: 'Payment', Account: ISSUER }, meta: {} }],
      [revokeTx(HASH)],
    ])
    const scan = await scanIssuerLedger(client, ISSUER, { hash: HASH })
    expect(scan.anchor).not.toBeNull()
    expect(scan.revoked).toBe(true)
  })
})

describe('scanIssuerLedger — pagination', () => {
  const filler = (n: number) => Array.from({ length: n }, () => ({ tx: { TransactionType: 'Payment', Account: ISSUER }, meta: {} }))

  it('follows markers past the first page — the old 100-tx limit missed these', async () => {
    const client = mockClient([filler(200), filler(200), [mintTx({ memos: [memo(MEMO_SINGLE, { hash: HASH })] })]])
    const scan = await scanIssuerLedger(client, ISSUER, { hash: HASH })
    expect(scan.anchor?.kind).toBe('single')
    expect(scan.scannedTx).toBe(401)
    expect(client.calls.length).toBe(3)
  })

  it('stops at maxTx and flags the result as truncated', async () => {
    const client = mockClient([filler(200), filler(200), filler(200), [mintTx({ memos: [memo(MEMO_SINGLE, { hash: HASH })] })]])
    const scan = await scanIssuerLedger(client, ISSUER, { hash: HASH }, { maxTx: 400 })
    expect(scan.anchor).toBeNull()
    expect(scan.truncated).toBe(true)
  })

  it('reports progress as it pages', async () => {
    const seen: number[] = []
    const client = mockClient([filler(200), filler(50)])
    await scanIssuerLedger(client, ISSUER, { hash: HASH }, { onProgress: (n) => seen.push(n) })
    expect(seen).toEqual([200, 250])
  })

  it('handles an issuer with no transactions at all', async () => {
    const scan = await scanIssuerLedger(mockClient([[]]), ISSUER, { hash: HASH })
    expect(scan.anchor).toBeNull()
    expect(scan.truncated).toBe(false)
  })
})

describe('buildRevocationTx', () => {
  it('builds a signable no-op AccountSet carrying the revoked hash', () => {
    const tx = buildRevocationTx(ISSUER, HASH)
    expect(tx.TransactionType).toBe('AccountSet')
    expect(tx.Account).toBe(ISSUER)
    expect(decodeHex(tx.Memos[0].Memo.MemoType)).toBe(MEMO_REVOKE)
    expect(JSON.parse(decodeHex(tx.Memos[0].Memo.MemoData))).toEqual({ hash: HASH })
  })

  it('round-trips through the scanner', async () => {
    const tx = buildRevocationTx(ISSUER, HASH)
    const client = mockClient([[mintTx({ memos: [memo(MEMO_SINGLE, { hash: HASH })] }), { tx, meta: {} }]])
    const scan = await scanIssuerLedger(client, ISSUER, { hash: HASH })
    expect(scan.revoked).toBe(true)
  })
})
