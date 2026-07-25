function canonicalize(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(canonicalize);
  } else if (obj && typeof obj === 'object') {
    return Object.keys(obj)
      .sort()
      .reduce((acc, key) => {
        acc[key] = canonicalize(obj[key]);
        return acc;
      }, {} as Record<string, any>);
  }
  return obj;
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function sha256Hex(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  // globalThis (not window) so hashing also runs under Node in the test suite
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
  return bufferToHex(hashBuffer);
}

/** Per-credential random salt — keeps the on-ledger hash safe from dictionary attacks. */
export function randomSalt(len = 16): string {
  const arr = new Uint8Array(len);
  globalThis.crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * The single anchor hash for a credential: SHA-256(salt ‖ canonicalJSON(content)).
 *
 * The `proof` block is excluded from the hash. A proof is an envelope wrapped
 * around the credential *after* it is hashed (the W3C Data Integrity model), so
 * hashing it would be circular. Excluding it means one value is computed
 * identically at issuance, in the QR/anchor, and at verification — there is no
 * separate inner digest to fall out of sync.
 */
export async function credentialHash(credential: any, salt: string): Promise<string> {
  const content = { ...credential };
  delete content.proof;
  const canonical = JSON.stringify(canonicalize(content));
  return await sha256Hex(salt + canonical);
}

/**
 * Issuer identifier for the VC. With a domain we emit a spec-compliant did:web
 * (resolvable at https://<domain>/.well-known/did.json); without one we fall
 * back to the raw XRPL address.
 */
export function makeIssuerDID(issuerAccount: string, domain?: string): string {
  const d = domain?.trim().toLowerCase();
  return d ? `did:web:${d}` : issuerAccount;
}

interface BuildVCParams {
  issuer: string;
  subject: Record<string, any>;
  claim: Record<string, any>;
  salt: string;
}

export function buildVC({ issuer, subject, claim, salt }: BuildVCParams) {
  const issuanceDate = new Date().toISOString();
  const credential = {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    type: ['VerifiableCredential'],
    issuer,
    issuanceDate,
    credentialSubject: subject,
    claim,
  };
  // The proof carries the salt (the anchor hash is derivable from content + salt,
  // so it is not duplicated here); it is excluded from credentialHash by design.
  return {
    ...credential,
    proof: {
      type: 'SaltedHashProof',
      created: issuanceDate,
      salt,
    },
  };
}
