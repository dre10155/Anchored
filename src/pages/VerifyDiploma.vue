<template>
  <div class="min-h-screen pt-20">
    <section class="relative py-12 sm:py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <div class="absolute inset-0 bg-gradient-to-br from-brand-black via-gray-900 to-brand-black"></div>

      <div class="absolute inset-0">
        <div class="absolute top-0 right-1/3 w-96 h-96 bg-primary-blue rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob"></div>
        <div class="absolute bottom-0 left-1/3 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000"></div>
      </div>

      <div class="max-w-4xl mx-auto relative z-10">
        <div class="text-center mb-8 sm:mb-12">
          <h1 class="text-4xl md:text-5xl font-bold text-white mb-4">Verify a Credential</h1>
          <p class="text-xl text-gray-300 max-w-2xl mx-auto">
            Check any Anchored credential against the XRP Ledger
          </p>
        </div>

        <div class="bg-white rounded-xl shadow-xl p-5 sm:p-8 border border-gray-200">
          <form @submit.prevent="handleVerify" class="space-y-6">
            <div>
              <label class="block font-medium text-brand-black mb-2">Issuer Account</label>
              <input v-model="issuerAccount" class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-blue focus:border-transparent transition-all font-mono" required placeholder="r..." />
            </div>
            <div>
              <label class="block font-medium text-brand-black mb-2">Upload VC File</label>
              <input type="file" @change="handleFileUpload" class="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-blue file:text-white hover:file:bg-blue-700 file:cursor-pointer file:transition-all file:duration-200" accept=".json" />
            </div>
            <div class="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button type="button" @click="showQrScanner = true" class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 font-medium shadow-lg">
                Scan QR Code
              </button>
              <button type="submit" :disabled="loading || !vcFile" class="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all duration-200 font-medium shadow-lg disabled:bg-gray-400 disabled:shadow-none disabled:cursor-not-allowed">
                {{ loading ? 'Verifying...' : 'Verify Credential' }}
              </button>
            </div>
          </form>

          <p v-if="batch" class="mt-4 text-xs text-gray-500">
            Batch-issued credential — checking its Merkle proof against the anchored class root.
          </p>
          <p v-if="progressNote" class="mt-4 text-sm text-gray-500">{{ progressNote }}</p>

          <div v-if="error" class="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p class="text-red-700 font-medium">{{ error }}</p>
          </div>

          <div v-if="resultState !== null" class="mt-6 p-4 sm:p-6 rounded-lg border-2"
            :class="{
              'bg-green-50 border-green-200': resultState === 'verified',
              'bg-amber-50 border-amber-300': resultState === 'anchored' || resultState === 'revoked',
              'bg-red-50 border-red-200': resultState === 'invalid',
            }">
            <div class="font-bold text-lg sm:text-xl mb-3 break-words"
              :class="{
                'text-green-700': resultState === 'verified',
                'text-amber-700': resultState === 'anchored' || resultState === 'revoked',
                'text-red-700': resultState === 'invalid',
              }">
              {{ resultState === 'verified' ? `${credentialNoun} Verified ✅ — issued by ${issuerDomain}`
                : resultState === 'anchored' ? 'Anchored — Issuer Unverified ⚠️'
                : resultState === 'revoked' ? `${credentialNoun} Revoked ⚠️`
                : `${credentialNoun} Not Verified ❌` }}
            </div>
            <div class="text-sm text-gray-700 mb-4">{{ resultReason }}</div>
            <div v-if="detailRows.length" class="mt-4 p-4 bg-white rounded-lg border border-gray-200">
              <h3 class="font-semibold text-brand-black mb-3 text-lg">{{ detailTitle }}</h3>
              <div class="space-y-2 text-sm">
                <p v-for="row in detailRows" :key="row.label" class="text-gray-700">
                  <strong class="text-brand-black">{{ row.label }}:</strong> {{ row.value }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <div v-if="showQrScanner" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white p-6 rounded-xl shadow-2xl relative max-w-lg w-full">
        <button @click="showQrScanner = false" class="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl font-bold w-8 h-8 flex items-center justify-center">
          ✕
        </button>
        <h3 class="text-xl font-bold text-brand-black mb-4">Scan QR Code</h3>
        <QrcodeStream @decode="onDecode" @init="onInit" class="rounded-lg overflow-hidden" />
        <div v-if="qrError" class="text-red-600 mt-4 p-3 bg-red-50 rounded-lg">{{ qrError }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { credentialHash } from '../lib/crypto'
import { verifyMerkleProof } from '../lib/merkle'
import { scanIssuerLedger, decodeHex } from '../lib/verify'
import { checkDidListsAddress, decodeHexDomain } from '../lib/did'
import { inferCredentialType, normaliseKey } from '../lib/credentialTypes'
import { Client } from 'xrpl'
import { QrcodeStream } from 'qrcode-reader-vue3'

const issuerAccount = ref('')
const diplomaDetails = ref<any>(null)
const loading = ref(false)
const error = ref('')
const resultState = ref<'verified' | 'anchored' | 'revoked' | 'invalid' | null>(null)
const resultReason = ref('')
const issuerDomain = ref('')
const vcFile = ref<File | null>(null)
const salt = ref('')
const hash = ref('')
const batch = ref<{ root: string; proof: string[] } | null>(null)
const showQrScanner = ref(false)
const qrError = ref('')
const progressNote = ref('')

// Render whatever fields the credential carries, labelled by its inferred type —
// so the verifier works for diplomas, licenses, workforce credentials, etc.
const detailType = computed(() => inferCredentialType(diplomaDetails.value))
const detailTitle = computed(() => (detailType.value ? `${detailType.value.displayName} Details` : 'Credential Details'))
const credentialNoun = computed(() => detailType.value?.displayName || 'Credential')
const detailRows = computed(() => {
  const subject = diplomaDetails.value
  if (!subject) return [] as { label: string; value: any }[]
  const labelFor = (key: string) =>
    detailType.value?.fields.find((f) => normaliseKey(f.key) === normaliseKey(key))?.label ||
    key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())
  return Object.entries(subject)
    .filter(([key]) => key !== 'issuerAccount')
    .map(([key, value]) => ({ label: labelFor(key), value }))
})

function cleanAccount(account: string) {
  if (!account) return ''
  let acc = account.trim()
  if (acc.startsWith('did:web:')) acc = acc.replace('did:web:', '')
  if (!/^r[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(acc)) return ''
  return acc
}

/**
 * Load a credential from either payload shape:
 *  - a full credential file: { vc, salt, batch? } (or a bare VC) — recompute the hash
 *    from the document so the displayed data is bound to what we check
 *  - a compact QR payload: { salt, hash, subject, issuerAccount, batch? } — no full VC
 *    is present, so trust the hash carried in the QR
 */
async function loadCredential(data: any) {
  const vc = data.vc || (data['@context'] && data.proof ? data : null)
  salt.value = data.salt || vc?.proof?.salt || ''

  if (vc) {
    hash.value = await credentialHash(vc, salt.value)
    diplomaDetails.value = vc.credentialSubject
  } else {
    // QR payload — the full document isn't available to rehash
    hash.value = data.hash || ''
    diplomaDetails.value = data.subject
  }

  batch.value = data.batch?.root && Array.isArray(data.batch.proof)
    ? { root: data.batch.root, proof: data.batch.proof }
    : null
  if (!issuerAccount.value) {
    issuerAccount.value = data.issuerAccount || data.batch?.issuerAccount || cleanAccount(vc?.issuer || '')
  }
  resultState.value = null
  resultReason.value = ''
  error.value = ''
}

const handleFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  vcFile.value = file
  try {
    await loadCredential(JSON.parse(await file.text()))
  } catch (err: any) {
    error.value = 'Invalid VC file: ' + err.message
    resultState.value = null
    resultReason.value = ''
  }
}

const handleVerify = async () => {
  loading.value = true
  error.value = ''
  resultState.value = null
  resultReason.value = ''
  progressNote.value = ''
  const account = cleanAccount(issuerAccount.value)
  if (!account) {
    error.value = 'Issuer account is malformed. Please check the address.'
    resultState.value = 'invalid'
    resultReason.value = 'Malformed XRPL account address.'
    loading.value = false
    return
  }

  let client
  try {
    // 1. Batched credential: the membership proof is checked locally first —
    // no point querying the ledger for a credential that isn't in its own batch.
    if (batch.value) {
      const inBatch = await verifyMerkleProof(hash.value, batch.value.proof, batch.value.root)
      if (!inBatch) {
        resultState.value = 'invalid'
        resultReason.value = 'This credential is not a member of the batch it claims — the Merkle proof does not reproduce the batch root.'
        return
      }
    }

    client = new Client('wss://s.altnet.rippletest.net:51233')
    await client.connect()

    // 2. One paginated pass over the issuer's history finds the anchor and any revocation
    const scan = await scanIssuerLedger(
      client,
      account,
      { hash: hash.value, batchRoot: batch.value?.root },
      { onProgress: (n) => { progressNote.value = `Scanned ${n} issuer transactions…` } }
    )
    progressNote.value = ''

    if (!scan.anchor) {
      resultState.value = 'invalid'
      resultReason.value = scan.truncated
        ? `No anchor found in the issuer's most recent ${scan.scannedTx} transactions. This issuer's history is longer than the scan limit.`
        : batch.value
          ? 'This issuer never anchored the batch this credential claims to belong to.'
          : 'No NFT anchor found for this credential.'
      return
    }

    const issuedOn = scan.anchor.mintDate ? ` on ${new Date(scan.anchor.mintDate).toLocaleDateString()}` : ''

    // 3. Revoked explicitly by the issuer?
    if (scan.revoked) {
      resultState.value = 'revoked'
      resultReason.value = `This credential was issued${issuedOn} but has since been REVOKED by the issuer${scan.revokedAt ? ` on ${new Date(scan.revokedAt).toLocaleDateString()}` : ''}.`
      return
    }

    // 4. Or revoked by burning the anchor NFT
    const nftsResp = await client.request({ command: 'account_nfts', account })
    const nfts: any[] = Array.isArray((nftsResp.result as any)?.account_nfts) ? (nftsResp.result as any).account_nfts : []
    const liveNft = scan.anchor.nftId ? nfts.find((n) => n.NFTokenID === scan.anchor!.nftId) : undefined
    if (scan.anchor.nftId && !liveNft) {
      resultState.value = 'revoked'
      resultReason.value = batch.value
        ? `The batch anchoring this credential was issued${issuedOn} but has since been burned by the issuer — the whole batch is REVOKED.`
        : `This diploma was issued${issuedOn} but has since been REVOKED by the issuer. NFT ID: ${scan.anchor.nftId}`
      return
    }

    // 5. Second on-chain binding: the NFT's URI must agree with the anchor
    if (liveNft) {
      const uri = decodeHex(liveNft.URI)
      const expected = batch.value ? `vc:merkle:${batch.value.root}` : `vc:sha256:${hash.value}`
      if ((uri.startsWith('vc:sha256:') || uri.startsWith('vc:merkle:')) && uri !== expected) {
        resultState.value = 'invalid'
        resultReason.value = 'On-ledger URI anchor does not match this credential.'
        return
      }
    }

    // 6. Issuer identity — two-way did:web handshake:
    //    wallet → domain (on-ledger Domain field) and domain → wallet (did.json)
    let identityVerified = false
    issuerDomain.value = ''
    try {
      const info = await client.request({ command: 'account_info', account })
      const domain = decodeHexDomain((info.result as any).account_data?.Domain)
      if (domain) {
        issuerDomain.value = domain
        const didCheck = await checkDidListsAddress(domain, account)
        identityVerified = Boolean(didCheck.ok && didCheck.listsAddress)
      }
    } catch {}

    const provenance = batch.value
      ? `Proven member of a batch of credentials anchored${issuedOn}.`
      : `Anchored${issuedOn}.`

    if (identityVerified) {
      resultState.value = 'verified'
      resultReason.value = `Authentic credential issued by ${issuerDomain.value} — institution identity confirmed via did:web handshake. ${provenance}`
    } else {
      resultState.value = 'anchored'
      resultReason.value = issuerDomain.value
        ? `${provenance} But ${issuerDomain.value} did not confirm this wallet in its did.json — issuer identity UNVERIFIED.`
        : `${provenance} But the issuer wallet has no domain set — issuer identity UNVERIFIED. Anyone can create a wallet; treat with caution.`
    }
  } catch (err: any) {
    error.value = 'Error verifying credential: ' + err.message
    resultState.value = 'invalid'
    resultReason.value = 'Verification failed due to an error.'
  } finally {
    loading.value = false
    progressNote.value = ''
    if (client?.isConnected()) await client.disconnect()
  }
}

const onDecode = async (result: string) => {
  try {
    const data = JSON.parse(result)
    await loadCredential(data)
    showQrScanner.value = false
    vcFile.value = new File([JSON.stringify(data)], 'scanned-vc.json', { type: 'application/json' })
    await handleVerify()
  } catch (err: any) {
    qrError.value = 'Invalid QR code: ' + err.message
  }
}

const onInit = async (capabilities: any) => {
  try {
    await capabilities.requestCamera()
  } catch (error: any) {
    if (error.name === 'NotAllowedError') {
      qrError.value = 'Camera access denied. Please grant permission in your browser settings.'
    } else if (error.name === 'NotFoundError') {
      qrError.value = 'No camera found on this device.'
    } else {
      qrError.value = `Error initializing camera: ${error.message}`
    }
  }
}
</script>
