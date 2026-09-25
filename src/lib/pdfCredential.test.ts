import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { pdfCredentialHash, readPdfAnchorMetadata, stampCredentialPdf } from './pdfCredential'

/** A 1x1 transparent PNG, standing in for a real QR. */
const QR_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

async function blankPdf(pages = 1) {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pages; i++) doc.addPage([595, 842]) // A4
  return doc.save()
}

const OPTIONS = {
  qrDataUrl: QR_PNG,
  salt: 'a1b2c3d4e5f6',
  issuerAccount: 'rNeqwL8sjHvi4TndDCrYqYDh1dQKNBekhv',
}

describe('stampCredentialPdf', () => {
  it('returns a readable PDF with the salt and issuer recoverable', async () => {
    const stamped = await stampCredentialPdf(await blankPdf(), OPTIONS)
    const meta = await readPdfAnchorMetadata(stamped)
    expect(meta.salt).toBe(OPTIONS.salt)
    expect(meta.issuerAccount).toBe(OPTIONS.issuerAccount)
  })

  it('changes the bytes — which is why hashing must come after stamping', async () => {
    const original = await blankPdf()
    const stamped = await stampCredentialPdf(original, OPTIONS)
    const before = await pdfCredentialHash(original, OPTIONS.salt)
    const after = await pdfCredentialHash(stamped, OPTIONS.salt)
    // If these were ever equal, anchoring the unstamped file would be safe.
    // They are not, and that is the whole reason for the ordering constraint.
    expect(before).not.toBe(after)
  })

  it('preserves the original page count', async () => {
    const stamped = await stampCredentialPdf(await blankPdf(3), OPTIONS)
    expect((await PDFDocument.load(stamped)).getPageCount()).toBe(3)
  })

  it('keeps keywords the document already had', async () => {
    const doc = await PDFDocument.create()
    doc.addPage([595, 842])
    doc.setKeywords(['registrar-copy', 'transcript'])
    const stamped = await stampCredentialPdf(await doc.save(), OPTIONS)
    const keywords = (await PDFDocument.load(stamped)).getKeywords() || ''
    expect(keywords).toContain('registrar-copy')
    expect(keywords).toContain(OPTIONS.salt)
  })

  it('rejects a file that is not a PDF', async () => {
    // The likeliest wrong pick is the credential JSON sitting beside it.
    await expect(stampCredentialPdf(new TextEncoder().encode('{"not":"a pdf"}'), OPTIONS))
      .rejects.toThrow()
  })
})

describe('pdfCredentialHash', () => {
  it('is stable for the same bytes and salt', async () => {
    const stamped = await stampCredentialPdf(await blankPdf(), OPTIONS)
    expect(await pdfCredentialHash(stamped, OPTIONS.salt))
      .toBe(await pdfCredentialHash(stamped, OPTIONS.salt))
  })

  it('changes when a single byte of the document changes', async () => {
    const stamped = await stampCredentialPdf(await blankPdf(), OPTIONS)
    const tampered = Uint8Array.from(stamped)
    tampered[tampered.length - 40] ^= 0xff
    expect(await pdfCredentialHash(tampered, OPTIONS.salt))
      .not.toBe(await pdfCredentialHash(stamped, OPTIONS.salt))
  })

  it('changes with the salt, so an unsalted copy cannot be confirmed', async () => {
    const stamped = await stampCredentialPdf(await blankPdf(), OPTIONS)
    expect(await pdfCredentialHash(stamped, 'different-salt'))
      .not.toBe(await pdfCredentialHash(stamped, OPTIONS.salt))
  })

  it('produces a 64-character hex digest', async () => {
    const hash = await pdfCredentialHash(await blankPdf(), 'salt')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('readPdfAnchorMetadata', () => {
  it('returns empty values for a PDF that was never stamped', async () => {
    expect(await readPdfAnchorMetadata(await blankPdf())).toEqual({ salt: '', issuerAccount: '' })
  })

  it('reports a file that is not a PDF', async () => {
    await expect(readPdfAnchorMetadata(new TextEncoder().encode('not a pdf')))
      .rejects.toThrow(/could not be read as a PDF/)
  })
})

describe('the full issue-then-verify round trip', () => {
  it('a stamped document verifies against the hash taken after stamping', async () => {
    // Issue: stamp first, then hash the finished bytes.
    const stamped = await stampCredentialPdf(await blankPdf(), OPTIONS)
    const anchored = await pdfCredentialHash(stamped, OPTIONS.salt)

    // Verify: the graduate hands over only the file. Everything else comes
    // from its own metadata.
    const { salt } = await readPdfAnchorMetadata(stamped)
    expect(await pdfCredentialHash(stamped, salt)).toBe(anchored)
  })
})
