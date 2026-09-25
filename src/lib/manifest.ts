// Reading a batch manifest so a registrar can find a credential by name.
//
// The ledger deliberately holds no personal data, so the dashboard can show
// what was issued but not whose it is. The institution already holds that
// mapping: makeBatchZip writes a batch-manifest.json into every batch package,
// listing each subject alongside their leaf hash.
//
// Loading one here is purely client-side. The file is read in the browser, held
// in memory for the session, and never uploaded or persisted — so the promise
// that there is no central database of graduates to query stays literally true.

import { CREDENTIAL_TYPES, DEFAULT_CREDENTIAL_TYPE, type CredentialType } from './credentialTypes'

export interface ManifestSubject {
  /** Display name, taken from the credential type's primary field */
  name: string
  /** Salted credential hash — the Merkle leaf, and the join key to the ledger */
  leaf: string
  /** Filename within the batch package, so staff can locate the file itself */
  file: string
  /** Remaining fields, for display */
  record: Record<string, unknown>
}

export interface ParsedManifest {
  /** Merkle root — matches the `reference` of the batch anchor on the ledger */
  root: string
  nftId: string
  issuerAccount: string
  credentialType: CredentialType
  issuedAt: string
  subjects: ManifestSubject[]
}

/**
 * Parse a batch-manifest.json. Throws with a message fit for display when the
 * file is not a manifest — a registrar is as likely to pick the wrong file as
 * the right one.
 */
export function parseManifest(text: string): ParsedManifest {
  let raw: any
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('That file is not valid JSON.')
  }

  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.credentials)) {
    throw new Error('That does not look like a batch manifest — expected a "credentials" list.')
  }
  const root = String(raw.merkleRoot || '')
  if (!root) {
    throw new Error('That manifest has no Merkle root, so it cannot be matched to a batch.')
  }

  const type =
    CREDENTIAL_TYPES.find((candidate) => candidate.id === raw.credentialType) ?? DEFAULT_CREDENTIAL_TYPE

  const subjects: ManifestSubject[] = []
  for (const entry of raw.credentials) {
    if (!entry || typeof entry !== 'object') continue
    const { leaf, file, ...record } = entry as Record<string, unknown>
    subjects.push({
      name: String(record[type.primaryField] ?? '').trim(),
      leaf: String(leaf ?? ''),
      file: String(file ?? ''),
      record,
    })
  }

  return {
    root,
    nftId: String(raw.nftId || ''),
    issuerAccount: String(raw.issuerAccount || ''),
    credentialType: type,
    issuedAt: String(raw.issuedAt || ''),
    subjects,
  }
}

/** Case- and accent-insensitive contains, so "jose" finds "José". */
export function matchesName(name: string, query: string): boolean {
  if (!query) return true
  const fold = (value: string) =>
    value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  return fold(name).includes(fold(query))
}
