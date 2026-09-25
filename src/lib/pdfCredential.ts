// Anchoring a document the institution already produces — a transcript PDF —
// rather than a credential built from form fields.
//
// THE ORDERING CONSTRAINT
//
// The obvious sequence does not work: hash the PDF, anchor it, then stamp on a
// QR. Stamping changes the bytes, so the document the graduate receives no
// longer matches its own anchor and fails verification.
//
// So the order is inverted: stamp the QR and embed the salt FIRST, then hash
// the finished bytes, then anchor that hash. The QR therefore cannot contain
// the hash — it does not exist yet, and including it would be circular. It
// carries the salt and issuer, which is all a verifier needs: they supply the
// document itself, and its bytes are the rest of the input.
//
// WHAT THIS BUYS, AND WHAT IT COSTS
//
// Hashing the bytes protects the whole document — every mark, grade and
// signature on it — not just a handful of fields. The cost is brittleness: any
// re-save, re-compression, or a print-then-scan round trip changes the bytes
// and the document will no longer verify. That is a property to explain to a
// registrar, not a bug to work around.
//
// PRIVACY
//
// Everything here runs in the browser. A transcript is the most sensitive
// document an institution holds, and it never reaches a server: only its hash
// is anchored, and only the graduate holds the file.



/** Marks the PDF as carrying an Anchored credential, and holds its salt. */
const SALT_PREFIX = 'anchored-salt:'
const ISSUER_PREFIX = 'anchored-issuer:'

export interface StampOptions {
  /** PNG data URL of the QR to place on the document */
  qrDataUrl: string
  salt: string
  issuerAccount: string
  /** Which page to stamp. -1 (default) is the last page. */
  pageIndex?: number
  /** Size of the QR square, in PDF points. 72pt = 1 inch. */
  size?: number
  /** Margin from the page edges, in points */
  margin?: number
  caption?: string
}

/**
 * Place the QR on the document and record the salt in its metadata.
 *
 * Returns the finished bytes. Hash THESE — never the original — or the
 * anchor will not match the file the graduate is given.
 */
export async function stampCredentialPdf(
  pdfBytes: ArrayBuffer | Uint8Array,
  options: StampOptions,
): Promise<Uint8Array> {
  // Loaded on demand: pdf-lib is large, and most sessions never stamp a PDF.
  const { PDFDocument } = await import('pdf-lib')

  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: false })
  const pages = doc.getPages()
  if (!pages.length) throw new Error('That PDF has no pages.')

  const index = options.pageIndex === undefined || options.pageIndex < 0
    ? pages.length - 1
    : Math.min(options.pageIndex, pages.length - 1)
  const page = pages[index]

  const size = options.size ?? 90
  const margin = options.margin ?? 36

  const png = await doc.embedPng(options.qrDataUrl)
  page.drawImage(png, {
    x: page.getWidth() - size - margin,
    y: margin,
    width: size,
    height: size,
  })

  if (options.caption !== '') {
    const { StandardFonts, rgb } = await import('pdf-lib')
    const font = await doc.embedFont(StandardFonts.Helvetica)
    const caption = options.caption ?? 'Verify at anchor-ed.vercel.app/verify'
    const fontSize = 6.5
    page.drawText(caption, {
      x: page.getWidth() - size - margin,
      y: margin - 10,
      size: fontSize,
      font,
      color: rgb(0.35, 0.38, 0.44),
      maxWidth: size,
    })
  }

  // The salt must travel with the document, or a verifier holding only the PDF
  // cannot reproduce its hash. Keywords survive a plain save; they are part of
  // the bytes, which is fine because hashing happens after this.
  const existing = doc.getKeywords()
  const keywords = [
    ...(existing ? existing.split(/[;,]\s*/).filter(Boolean) : []),
    `${SALT_PREFIX}${options.salt}`,
    `${ISSUER_PREFIX}${options.issuerAccount}`,
  ]
  doc.setKeywords(keywords)

  return doc.save({ useObjectStreams: false })
}

/** The salt and issuer a stamped document carries, or nulls if it has none. */
export async function readPdfAnchorMetadata(
  pdfBytes: ArrayBuffer | Uint8Array,
): Promise<{ salt: string; issuerAccount: string }> {
  const { PDFDocument } = await import('pdf-lib')
  let keywords = ''
  try {
    const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: false })
    keywords = doc.getKeywords() || ''
  } catch {
    throw new Error('That file could not be read as a PDF.')
  }

  const find = (prefix: string) => {
    const match = keywords.split(/[;,]\s*|\s+/).find((part) => part.startsWith(prefix))
    return match ? match.slice(prefix.length).trim() : ''
  }

  return { salt: find(SALT_PREFIX), issuerAccount: find(ISSUER_PREFIX) }
}

/**
 * The anchor hash for a document: SHA-256(salt ‖ bytes).
 *
 * Salted for the same reason credential hashes are — without it, anyone holding
 * a copy of a common document could confirm it had been anchored.
 */
export async function pdfCredentialHash(
  pdfBytes: ArrayBuffer | Uint8Array,
  salt: string,
): Promise<string> {
  const bytes = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes)
  const saltBytes = new TextEncoder().encode(salt)

  // Digest the salt and the raw bytes together, rather than building a string:
  // a transcript can run to megabytes, and this avoids both the memory cost and
  // any question of how the bytes were re-encoded on the way in.
  const input = new Uint8Array(saltBytes.length + bytes.length)
  input.set(saltBytes, 0)
  input.set(bytes, saltBytes.length)

  const digest = await globalThis.crypto.subtle.digest('SHA-256', input)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
