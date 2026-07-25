/**
 * Credential-type registry.
 *
 * The anchoring engine (hash → Merkle → NFT → did:web verify) is completely
 * credential-agnostic: it operates on an opaque JSON document. A "credential
 * type" is therefore nothing more than a description of which fields that
 * document carries and how to label them. Adding a new kind of credential —
 * a professional license, a government ID, a workforce badge — is a config
 * entry here, not a change to any of the cryptography or ledger logic.
 */

export interface CredentialField {
  /** Key stored in credentialSubject and CSV header */
  key: string
  label: string
  type?: 'text' | 'number'
  min?: number
  max?: number
  placeholder?: string
  /** Header aliases accepted when parsing a roster (normalised, lowercase, no separators) */
  aliases?: string[]
}

export interface CredentialType {
  id: string
  /** e.g. "Diploma" — singular noun for one credential */
  displayName: string
  /** e.g. "Diplomas" */
  displayNamePlural: string
  /** who the credential is about, e.g. "Graduate", "Holder", "Employee" */
  subjectNoun: string
  /** who issues it, e.g. "Institution", "Agency", "Employer" */
  issuerNoun: string
  /** example domain for the did:web field */
  issuerDomainPlaceholder: string
  fields: CredentialField[]
  /** field used as the human label in tables and revocation lists */
  primaryField: string
}

export const CREDENTIAL_TYPES: CredentialType[] = [
  {
    id: 'diploma',
    displayName: 'Diploma',
    displayNamePlural: 'Diplomas',
    subjectNoun: 'Graduate',
    issuerNoun: 'Institution',
    issuerDomainPlaceholder: 'registrar.university.edu',
    primaryField: 'studentName',
    fields: [
      { key: 'studentName', label: 'Student Name', aliases: ['name'] },
      { key: 'university', label: 'University', aliases: ['institution', 'school'] },
      { key: 'degree', label: 'Degree', aliases: ['program', 'qualification'] },
      { key: 'year', label: 'Year', type: 'number', min: 1900, max: 2100, aliases: ['gradyear', 'graduationyear'] },
    ],
  },
  {
    id: 'professional-license',
    displayName: 'Professional License',
    displayNamePlural: 'Professional Licenses',
    subjectNoun: 'Licensee',
    issuerNoun: 'Licensing Body',
    issuerDomainPlaceholder: 'licensing.gov',
    primaryField: 'holderName',
    fields: [
      { key: 'holderName', label: 'Licensee Name', aliases: ['name', 'studentname'] },
      { key: 'profession', label: 'Profession', aliases: ['occupation', 'field'] },
      { key: 'licenseNumber', label: 'License Number', aliases: ['licenseno', 'number'] },
      { key: 'expiryYear', label: 'Expiry Year', type: 'number', min: 2000, max: 2100, aliases: ['expiry', 'expires', 'year'] },
    ],
  },
  {
    id: 'employee-id',
    displayName: 'Workforce Credential',
    displayNamePlural: 'Workforce Credentials',
    subjectNoun: 'Employee',
    issuerNoun: 'Employer',
    issuerDomainPlaceholder: 'company.com',
    primaryField: 'employeeName',
    fields: [
      { key: 'employeeName', label: 'Employee Name', aliases: ['name', 'studentname'] },
      { key: 'position', label: 'Position', aliases: ['title', 'role'] },
      { key: 'employeeId', label: 'Employee ID', aliases: ['empid', 'id', 'number'] },
      { key: 'department', label: 'Department', aliases: ['dept', 'division'] },
    ],
  },
]

export const DEFAULT_CREDENTIAL_TYPE = CREDENTIAL_TYPES[0]

export function getCredentialType(id: string | undefined): CredentialType {
  return CREDENTIAL_TYPES.find((t) => t.id === id) || DEFAULT_CREDENTIAL_TYPE
}

/** Normalise a header/key so "Student Name", "student_name" and "studentname" all match. */
export function normaliseKey(key: string): string {
  return key.toLowerCase().replace(/[\s_-]/g, '')
}

/** Best-effort: given a credentialSubject, find the type whose fields it matches. */
export function inferCredentialType(subject: Record<string, any> | undefined): CredentialType | undefined {
  if (!subject) return undefined
  const keys = new Set(Object.keys(subject).map(normaliseKey))
  let best: { type: CredentialType; score: number } | undefined
  for (const type of CREDENTIAL_TYPES) {
    const score = type.fields.filter((f) => keys.has(normaliseKey(f.key))).length
    if (score && (!best || score > best.score)) best = { type, score }
  }
  return best?.type
}
