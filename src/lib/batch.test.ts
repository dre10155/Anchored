import { describe, it, expect } from 'vitest'
import { parseRoster, buildBatch, batchUri } from './batch'
import { verifyMerkleProof } from './merkle'
import { credentialHash } from './crypto'
import { getCredentialType } from './credentialTypes'

const ISSUER = 'rNeqwL8sjHvi4TndDCrYqYDh1dQKNBekhv'

describe('parseRoster', () => {
  it('parses a plain CSV', () => {
    const csv = 'studentName,university,degree,year\nJane Doe,SALCC,BSc Nursing,2026'
    const { records, errors } = parseRoster(csv, 'roster.csv')
    expect(errors).toEqual([])
    expect(records).toEqual([{ studentName: 'Jane Doe', university: 'SALCC', degree: 'BSc Nursing', year: 2026 }])
  })

  it('handles quoted fields containing commas', () => {
    const csv = 'studentName,university,degree,year\n"Doe, Jane",SALCC,"BSc Nursing, Honours",2026'
    const { records, errors } = parseRoster(csv, 'roster.csv')
    expect(errors).toEqual([])
    expect(records[0].studentName).toBe('Doe, Jane')
    expect(records[0].degree).toBe('BSc Nursing, Honours')
  })

  it('accepts header aliases and stray whitespace', () => {
    const csv = 'Student Name , Institution ,Program,Graduation Year\n Jane Doe ,SALCC,BSc Nursing,2026'
    const { records, errors } = parseRoster(csv, 'roster.csv')
    expect(errors).toEqual([])
    expect(records[0]).toEqual({ studentName: 'Jane Doe', university: 'SALCC', degree: 'BSc Nursing', year: 2026 })
  })

  it('tolerates CRLF line endings and blank lines', () => {
    const csv = 'studentName,university,degree,year\r\nJane Doe,SALCC,BSc,2026\r\n\r\nJohn Roe,SALCC,BA,2025\r\n'
    const { records, errors } = parseRoster(csv, 'roster.csv')
    expect(errors).toEqual([])
    expect(records).toHaveLength(2)
  })

  it('reports row-level errors instead of throwing', () => {
    const csv = [
      'studentName,university,degree,year',
      'Jane Doe,SALCC,BSc Nursing,2026',
      ',SALCC,BSc,2026',
      'John Roe,SALCC,BA,not-a-year',
      'Kim Loe,SALCC,BA,1723',
    ].join('\n')
    const { records, errors } = parseRoster(csv, 'roster.csv')
    expect(records).toHaveLength(1)
    expect(errors).toHaveLength(3)
    expect(errors[0].message).toMatch(/Missing studentName/)
    expect(errors[1].message).toMatch(/Invalid Year/)
    expect(errors[2].message).toMatch(/Invalid Year/)
  })

  it('parses a roster for a different credential type — same engine, new config', () => {
    const type = getCredentialType('professional-license')
    const csv = 'Licensee Name,Profession,License Number,Expiry Year\n"Nurse, Jane",Registered Nurse,RN-4471,2028'
    const { records, errors } = parseRoster(csv, 'licenses.csv', type)
    expect(errors).toEqual([])
    expect(records[0]).toEqual({
      holderName: 'Nurse, Jane',
      profession: 'Registered Nurse',
      licenseNumber: 'RN-4471',
      expiryYear: 2028,
    })
  })

  it('parses a JSON roster', () => {
    const json = JSON.stringify([{ studentName: 'Jane Doe', university: 'SALCC', degree: 'BSc', year: 2026 }])
    const { records, errors } = parseRoster(json, 'roster.json')
    expect(errors).toEqual([])
    expect(records).toHaveLength(1)
  })

  it('rejects a JSON roster that is not an array', () => {
    expect(() => parseRoster('{"studentName":"Jane"}', 'roster.json')).toThrow(/array/)
  })
})

describe('buildBatch', () => {
  const roster = Array.from({ length: 7 }, (_, i) => ({
    studentName: `Student ${i}`,
    university: 'Saint Lucia National University',
    degree: 'BSc Computer Science',
    year: 2026,
  }))

  it('gives every graduate a credential and a working membership proof', async () => {
    const { entries, tree } = await buildBatch(roster, ISSUER, 'anchor-ed.vercel.app')
    expect(entries).toHaveLength(7)
    for (const [i, entry] of entries.entries()) {
      expect(await verifyMerkleProof(entry.leaf, tree.proofs[i], tree.root)).toBe(true)
    }
  })

  it('gives each credential a unique salt, so identical records differ on-chain', async () => {
    const twins = [roster[0], { ...roster[0] }]
    const { entries } = await buildBatch(twins, ISSUER)
    expect(entries[0].salt).not.toBe(entries[1].salt)
    expect(entries[0].leaf).not.toBe(entries[1].leaf)
  })

  it("uses did:web as the credential issuer when a domain is supplied", async () => {
    const { entries } = await buildBatch([roster[0]], ISSUER, 'anchor-ed.vercel.app')
    expect(entries[0].vc.issuer).toBe('did:web:anchor-ed.vercel.app')
  })

  it('falls back to the raw address when no domain is supplied', async () => {
    const { entries } = await buildBatch([roster[0]], ISSUER)
    expect(entries[0].vc.issuer).toBe(ISSUER)
  })

  it('rejects a tampered credential against the anchored root', async () => {
    const { entries, tree } = await buildBatch(roster, ISSUER)
    const forgedVc = {
      ...entries[0].vc,
      credentialSubject: { ...entries[0].vc.credentialSubject, degree: 'PhD Computer Science' },
    }
    const forgedLeaf = await credentialHash(forgedVc, entries[0].salt)
    expect(await verifyMerkleProof(forgedLeaf, tree.proofs[0], tree.root)).toBe(false)
  })

  it('reports progress while hashing', async () => {
    const seen: number[] = []
    await buildBatch(roster, ISSUER, undefined, (done) => seen.push(done))
    expect(seen[seen.length - 1]).toBe(7)
  })
})

describe('batchUri', () => {
  it('anchors only the root, and fits the 256-byte NFT URI limit', () => {
    const root = 'a'.repeat(64)
    const uri = batchUri(root)
    expect(uri).toBe(`vc:merkle:${root}`)
    expect(new TextEncoder().encode(uri).length).toBeLessThanOrEqual(256)
  })
})
