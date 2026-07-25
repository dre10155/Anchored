import { describe, it, expect } from 'vitest'
import { credentialHash, buildVC, makeIssuerDID } from './crypto'

const SALT = 'a'.repeat(32)

const sampleCredential = {
  '@context': ['https://www.w3.org/2018/credentials/v1'],
  type: ['VerifiableCredential'],
  issuer: 'did:web:anchor-ed.vercel.app',
  issuanceDate: '2026-07-25T18:30:16.306Z',
  credentialSubject: { studentName: 'Jane Doe', degree: 'BSc Nursing', year: 2026 },
  claim: {},
}

describe('credentialHash', () => {
  it('is deterministic for the same content and salt', async () => {
    const a = await credentialHash(sampleCredential, SALT)
    const b = await credentialHash(sampleCredential, SALT)
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
  })

  it('changes when any content field changes', async () => {
    const base = await credentialHash(sampleCredential, SALT)
    const altered = await credentialHash(
      { ...sampleCredential, credentialSubject: { ...sampleCredential.credentialSubject, degree: 'PhD' } },
      SALT
    )
    expect(altered).not.toBe(base)
  })

  it('changes with the salt (dictionary-attack resistance)', async () => {
    const a = await credentialHash(sampleCredential, SALT)
    const b = await credentialHash(sampleCredential, 'b'.repeat(32))
    expect(a).not.toBe(b)
  })

  it('is independent of object key order (canonicalization)', async () => {
    const reordered = {
      claim: {},
      credentialSubject: { year: 2026, degree: 'BSc Nursing', studentName: 'Jane Doe' },
      issuanceDate: '2026-07-25T18:30:16.306Z',
      issuer: 'did:web:anchor-ed.vercel.app',
      type: ['VerifiableCredential'],
      '@context': ['https://www.w3.org/2018/credentials/v1'],
    }
    expect(await credentialHash(reordered, SALT)).toBe(await credentialHash(sampleCredential, SALT))
  })

  it('ignores the proof envelope entirely — no separate inner digest', async () => {
    const withoutProof = await credentialHash(sampleCredential, SALT)
    const withProof = await credentialHash(
      { ...sampleCredential, proof: { type: 'SaltedHashProof', created: 'x', salt: SALT } },
      SALT
    )
    const withDifferentProof = await credentialHash(
      { ...sampleCredential, proof: { type: 'Other', created: 'y', salt: SALT, hash: 'legacy' } },
      SALT
    )
    expect(withProof).toBe(withoutProof)
    expect(withDifferentProof).toBe(withoutProof)
  })
})

describe('buildVC', () => {
  it('does not store a redundant hash in the proof', async () => {
    const vc: any = buildVC({ issuer: 'did:web:x.com', subject: { studentName: 'Jane' }, claim: {}, salt: SALT })
    expect(vc.proof.hash).toBeUndefined()
    expect(vc.proof.salt).toBe(SALT)
    expect(vc.proof.type).toBe('SaltedHashProof')
  })

  it('produces a credential whose hash equals the hash of the same VC carrying its proof', async () => {
    // Issuance hashes the full VC (with proof); verification recomputes from the
    // stored VC (with proof). Because proof is excluded, both equal the content hash.
    const vc = buildVC({ issuer: 'did:web:x.com', subject: { studentName: 'Jane' }, claim: {}, salt: SALT })
    const atIssuance = await credentialHash(vc, SALT)
    const atVerification = await credentialHash(JSON.parse(JSON.stringify(vc)), SALT)
    expect(atVerification).toBe(atIssuance)
  })
})

describe('makeIssuerDID', () => {
  it('emits a spec-shaped did:web when a domain is given', () => {
    expect(makeIssuerDID('rXXXX', 'Registrar.University.EDU')).toBe('did:web:registrar.university.edu')
  })
  it('falls back to the raw address without a domain', () => {
    expect(makeIssuerDID('rXXXX')).toBe('rXXXX')
  })
})
