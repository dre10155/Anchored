import { describe, expect, it } from 'vitest'
import { matchesName, parseManifest } from './manifest'

/** Shaped exactly as makeBatchZip writes it. */
function manifestJson(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    anchoredVersion: 2,
    issuedAt: '2026-09-24T10:00:00.000Z',
    issuerAccount: 'rNeqwL8sjHvi4TndDCrYqYDh1dQKNBekhv',
    issuerDomain: 'salcc.edu.lc',
    merkleRoot: 'abc123',
    nftId: '000100AA',
    credentialCount: 2,
    credentialType: 'diploma',
    credentials: [
      { studentName: 'Marie Joseph', university: 'SALCC', degree: 'Nursing', year: 2026, leaf: 'leaf-1', file: '0001-marie-joseph.json' },
      { studentName: 'John Doe', university: 'SALCC', degree: 'IT', year: 2026, leaf: 'leaf-2', file: '0002-john-doe.json' },
    ],
    ...overrides,
  })
}

describe('parseManifest', () => {
  it('reads subjects, keyed to the ledger by leaf hash', () => {
    const parsed = parseManifest(manifestJson())
    expect(parsed.root).toBe('abc123')
    expect(parsed.subjects).toHaveLength(2)
    expect(parsed.subjects[0]).toMatchObject({ name: 'Marie Joseph', leaf: 'leaf-1', file: '0001-marie-joseph.json' })
  })

  it('takes the display name from the credential type primaryField', () => {
    // A licence names its holder in holderName, not studentName.
    const licence = manifestJson({
      credentialType: 'professional-license',
      credentials: [{ holderName: 'Caribbean Blasting Ltd.', profession: 'Explosives', leaf: 'leaf-9', file: 'a.json' }],
    })
    expect(parseManifest(licence).subjects[0].name).toBe('Caribbean Blasting Ltd.')
  })

  it('keeps the remaining fields for display, without leaf or file', () => {
    const { record } = parseManifest(manifestJson()).subjects[0]
    expect(record).toMatchObject({ degree: 'Nursing', year: 2026 })
    expect(record).not.toHaveProperty('leaf')
    expect(record).not.toHaveProperty('file')
  })

  it('falls back to the default type when the manifest names an unknown one', () => {
    const parsed = parseManifest(manifestJson({ credentialType: 'not-a-real-type' }))
    expect(parsed.credentialType.id).toBe('diploma')
  })

  it('rejects a file that is not JSON', () => {
    expect(() => parseManifest('not json at all')).toThrow(/not valid JSON/)
  })

  it('rejects JSON that is not a manifest', () => {
    // The likeliest wrong pick: a student's own credential file.
    expect(() => parseManifest(JSON.stringify({ anchoredVersion: 2, vc: {}, salt: 'x' }))).toThrow(/batch manifest/)
  })

  it('rejects a manifest with no Merkle root, since it cannot be matched', () => {
    expect(() => parseManifest(manifestJson({ merkleRoot: '' }))).toThrow(/Merkle root/)
  })

  it('skips malformed entries rather than failing the whole file', () => {
    const parsed = parseManifest(manifestJson({ credentials: [null, { studentName: 'Ada', leaf: 'l', file: 'f' }] }))
    expect(parsed.subjects).toHaveLength(1)
    expect(parsed.subjects[0].name).toBe('Ada')
  })
})

describe('matchesName', () => {
  it('matches case-insensitively on a partial name', () => {
    expect(matchesName('Marie Joseph', 'jose')).toBe(true)
    expect(matchesName('Marie Joseph', 'MARIE')).toBe(true)
  })

  it('ignores accents, so a typed ascii name still finds the record', () => {
    expect(matchesName('José Régis', 'jose')).toBe(true)
    expect(matchesName('José Régis', 'regis')).toBe(true)
  })

  it('matches everything on an empty query', () => {
    expect(matchesName('Anyone', '')).toBe(true)
  })

  it('does not match an unrelated name', () => {
    expect(matchesName('Marie Joseph', 'zulu')).toBe(false)
  })
})
