import { makeVerifierQR } from './vc'
import { batchCredentialFile, type BatchEntry } from './batch'
import type { MerkleTree } from './merkle'
import type { CredentialType } from './credentialTypes'

export interface BatchSendResult {
  index: number
  name: string
  email: string
  ok: boolean
  error?: string
}

export async function sendBatchEmails(params: {
  entries: BatchEntry[]
  emails: string[]
  tree: MerkleTree
  issuerAccount: string
  issuerDomain?: string
  nftId: string
  type: CredentialType
  concurrency?: number
  onProgress?: (done: number, total: number) => void
  only?: number[]
}): Promise<BatchSendResult[]> {
  const { entries, emails, tree, issuerAccount, issuerDomain, nftId, type } = params
  const concurrency = Math.max(1, Math.min(3, params.concurrency ?? 2))
  const targets = (params.only ?? entries.map((_, index) => index)).filter((index) => emails[index])
  const results: BatchSendResult[] = []
  let done = 0
  let cursor = 0

  async function worker() {
    while (cursor < targets.length) {
      const index = targets[cursor++]
      const entry = entries[index]
      const name = String(entry.record[type.primaryField] ?? '')
      try {
        const qrDataUrl = await makeVerifierQR({
          salt: entry.salt,
          hash: entry.leaf,
          subject: entry.vc.credentialSubject,
          issuerAccount,
          batch: { root: tree.root, proof: tree.proofs[index] },
        })
        const response = await fetch('/api/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: emails[index],
            issuerAccount,
            nftId,
            credential: batchCredentialFile({ entry, index, tree, issuerAccount, nftId, type }),
            qrDataUrl,
            issuerName: issuerDomain || issuerAccount,
            credentialLabel: type.displayName,
            holderName: name,
          }),
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`)
        results.push({ index, name, email: emails[index], ok: true })
      } catch (error: any) {
        results.push({ index, name, email: emails[index], ok: false, error: error?.message || String(error) })
      } finally {
        params.onProgress?.(++done, targets.length)
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, worker))
  return results.sort((a, b) => a.index - b.index)
}