import Papa from 'papaparse'
import JSZip from 'jszip'
import { buildVC, credentialHash, makeIssuerDID, randomSalt } from './crypto'
import { buildMerkleTree, type MerkleTree } from './merkle'
import { makeVerifierQR } from './vc'
import { DEFAULT_CREDENTIAL_TYPE, normaliseKey, type CredentialType, type CredentialField } from './credentialTypes'

/** A validated roster row — an arbitrary set of the active credential type's fields. */
export type RosterRecord = Record<string, string | number>

export interface RosterError {
  row: number
  message: string
}

export interface ParsedRoster {
  records: RosterRecord[]
  errors: RosterError[]
}

/** Map every accepted header (the field key plus its aliases) to the canonical field. */
function buildAliasMap(type: CredentialType): Map<string, CredentialField> {
  const map = new Map<string, CredentialField>()
  for (const field of type.fields) {
    map.set(normaliseKey(field.key), field)
    map.set(normaliseKey(field.label), field)
    for (const alias of field.aliases || []) map.set(normaliseKey(alias), field)
  }
  return map
}

function normaliseRow(raw: Record<string, any>, aliasMap: Map<string, CredentialField>): Record<string, any> {
  const out: Record<string, any> = {}
  for (const [key, value] of Object.entries(raw)) {
    const field = aliasMap.get(normaliseKey(key))
    if (field && out[field.key] === undefined) out[field.key] = typeof value === 'string' ? value.trim() : value
  }
  return out
}

function validateRow(
  row: Record<string, any>,
  rowNumber: number,
  type: CredentialType
): { record?: RosterRecord; error?: RosterError } {
  const missing = type.fields.filter((f) => row[f.key] === undefined || row[f.key] === '')
  if (missing.length) {
    return { error: { row: rowNumber, message: `Missing ${missing.map((f) => f.key).join(', ')}` } }
  }
  const record: RosterRecord = {}
  for (const field of type.fields) {
    if (field.type === 'number') {
      const n = Number(row[field.key])
      const min = field.min ?? -Infinity
      const max = field.max ?? Infinity
      if (!Number.isInteger(n) || n < min || n > max) {
        return { error: { row: rowNumber, message: `Invalid ${field.label} "${row[field.key]}"` } }
      }
      record[field.key] = n
    } else {
      record[field.key] = String(row[field.key])
    }
  }
  return { record }
}

/**
 * Parse a CSV or JSON roster for a given credential type. Every row is validated
 * up front so the issuer sees all problems before anything is anchored.
 */
export function parseRoster(text: string, filename: string, type: CredentialType = DEFAULT_CREDENTIAL_TYPE): ParsedRoster {
  let rawRows: Record<string, any>[]

  if (filename.toLowerCase().endsWith('.json')) {
    const parsed = JSON.parse(text)
    if (!Array.isArray(parsed)) throw new Error('JSON roster must be an array of records.')
    rawRows = parsed
  } else {
    // Papa handles quoted fields ("Doe, Jane"), CRLF and stray whitespace
    const result = Papa.parse<Record<string, any>>(text, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => h.trim(),
    })
    rawRows = result.data
  }

  const aliasMap = buildAliasMap(type)
  const records: RosterRecord[] = []
  const errors: RosterError[] = []
  rawRows.forEach((raw, i) => {
    const { record, error } = validateRow(normaliseRow(raw, aliasMap), i + 1, type)
    if (record) records.push(record)
    else if (error) errors.push(error)
  })

  return { records, errors }
}

export interface BatchEntry {
  record: RosterRecord
  vc: any
  salt: string
  /** Salted credential hash — this is the Merkle leaf */
  leaf: string
}

export interface BuiltBatch {
  entries: BatchEntry[]
  tree: MerkleTree
}

/**
 * Turn a validated roster into credentials and anchor them into a single Merkle
 * tree. Only the tree's root goes on-chain; each student keeps their credential
 * plus a proof of membership.
 */
export async function buildBatch(
  records: RosterRecord[],
  issuerAccount: string,
  issuerDomain?: string,
  onProgress?: (done: number, total: number) => void
): Promise<BuiltBatch> {
  const issuer = makeIssuerDID(issuerAccount, issuerDomain)
  const entries: BatchEntry[] = []

  for (const [i, record] of records.entries()) {
    const salt = randomSalt()
    const subject = { ...record, issuerAccount }
    const vc = await buildVC({ issuer, subject, claim: {}, salt })
    entries.push({ record, vc, salt, leaf: await credentialHash(vc, salt) })
    if (onProgress && (i % 25 === 0 || i === records.length - 1)) {
      onProgress(i + 1, records.length)
      // yield to the event loop so a large class doesn't freeze the tab
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }

  return { entries, tree: await buildMerkleTree(entries.map((e) => e.leaf)) }
}

/** The on-chain anchor for a batch: only the root, never any student data. */
export function batchUri(root: string): string {
  return `vc:merkle:${root}`
}

function safeFilename(name: string, index: number): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'subject'
  return `${String(index + 1).padStart(4, '0')}-${slug}`
}

export interface BatchZipParams {
  entries: BatchEntry[]
  tree: MerkleTree
  issuerAccount: string
  issuerDomain?: string
  nftId: string
  type?: CredentialType
  onProgress?: (done: number, total: number) => void
}

/**
 * Package one credential file + QR per subject, plus a manifest, into a ZIP the
 * issuer can distribute.
 */
export async function makeBatchZip({
  entries,
  tree,
  issuerAccount,
  issuerDomain,
  nftId,
  type = DEFAULT_CREDENTIAL_TYPE,
  onProgress,
}: BatchZipParams): Promise<Blob> {
  const zip = new JSZip()
  const issuedAt = new Date().toISOString()
  const folder = zip.folder(`anchored-batch-${tree.root.slice(0, 12)}`)!
  const nameOf = (record: RosterRecord) => String(record[type.primaryField] ?? 'subject')

  for (const [i, entry] of entries.entries()) {
    const batch = { root: tree.root, proof: tree.proofs[i] }
    const credentialFile = {
      anchoredVersion: 2,
      credentialType: type.id,
      vc: entry.vc,
      salt: entry.salt,
      batch: { ...batch, issuerAccount, nftId },
    }
    const base = safeFilename(nameOf(entry.record), i)
    folder.file(`${base}.json`, JSON.stringify(credentialFile, null, 2))

    const qrDataUrl = await makeVerifierQR({
      salt: entry.salt,
      hash: entry.leaf,
      subject: entry.vc.credentialSubject,
      issuerAccount,
      batch,
    })
    folder.file(`${base}-qr.png`, qrDataUrl.split(',')[1], { base64: true })

    if (onProgress && (i % 10 === 0 || i === entries.length - 1)) {
      onProgress(i + 1, entries.length)
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }

  folder.file(
    'batch-manifest.json',
    JSON.stringify(
      {
        anchoredVersion: 2,
        issuedAt,
        issuerAccount,
        issuerDomain: issuerDomain || null,
        merkleRoot: tree.root,
        nftId,
        credentialCount: entries.length,
        credentialType: type.id,
        credentials: entries.map((e, i) => ({
          ...e.record,
          leaf: e.leaf,
          file: `${safeFilename(nameOf(e.record), i)}.json`,
        })),
      },
      null,
      2
    )
  )

  folder.file(
    'README.txt',
    [
      'Anchored — batch credential package',
      '===================================',
      '',
      `Issued:          ${issuedAt}`,
      `Institution:     ${issuerDomain || issuerAccount}`,
      `Credentials:     ${entries.length}`,
      `Merkle root:     ${tree.root}`,
      `Anchor NFT ID:   ${nftId}`,
      '',
      `This package contains one credential file and one QR code per ${type.subjectNoun.toLowerCase()}.`,
      `Send each ${type.subjectNoun.toLowerCase()} ONLY their own two files — the .json is their`,
      'credential and the QR is how a verifier checks it in seconds.',
      '',
      'Anyone can verify a credential at https://anchor-ed.vercel.app/verify by',
      'uploading the .json file or scanning the QR code. No login required.',
      '',
      'Privacy: no personal data is on the public ledger. The ledger holds only the',
      'Merkle root above — a fingerprint of the whole batch that reveals nothing',
      'about any individual. batch-manifest.json is YOUR internal record; it lists',
      'every subject, so do not distribute it to third parties.',
    ].join('\n')
  )

  return zip.generateAsync({ type: 'blob' })
}
