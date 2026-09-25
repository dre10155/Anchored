<template>
  <div class="min-h-screen pt-20">
    <section class="relative py-12 sm:py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <div class="absolute inset-0 bg-gradient-to-br from-brand-black via-gray-900 to-brand-black"></div>
      <div class="absolute top-0 right-1/3 w-96 h-96 bg-primary-blue rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob"></div>

      <div class="max-w-4xl mx-auto relative z-10">
        <div class="text-center mb-8 sm:mb-12">
          <h1 class="text-4xl md:text-5xl font-bold text-white mb-4">Anchor a Transcript</h1>
          <p class="text-xl text-gray-300 max-w-2xl mx-auto">
            Stamp your own PDF with a verification QR and anchor the document itself
          </p>
        </div>

        <div class="bg-white rounded-xl shadow-xl p-5 sm:p-8 border border-gray-200">
          <form @submit.prevent="handleSubmit" class="space-y-6">
            <div>
              <label class="block font-medium text-brand-black mb-2">Transcript PDF</label>
              <input type="file" accept="application/pdf,.pdf" @change="handleFile"
                class="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-blue file:text-white hover:file:bg-blue-700 file:cursor-pointer" />
              <p class="text-xs text-gray-500 mt-2">
                Exported from your own system. It is stamped and hashed in this browser and never uploaded.
              </p>
            </div>

            <div>
              <label class="block font-medium text-brand-black mb-2">Issuer Account</label>
              <input v-model="issuerAccount" class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-blue focus:border-transparent transition-all font-mono" required placeholder="r..." />
            </div>

            <div>
              <label class="block font-medium text-brand-black mb-2">Institution Domain (optional, for did:web identity)</label>
              <input v-model="issuerDomain" class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-blue focus:border-transparent transition-all font-mono" placeholder="salcc.edu.lc" />
            </div>

            <details class="text-sm">
              <summary class="cursor-pointer text-gray-600 hover:text-brand-black select-none">Stamp placement</summary>
              <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label class="text-xs text-gray-600">Page
                  <select v-model="pageChoice" class="block w-full mt-1 p-2.5 border border-gray-300 rounded-lg text-sm bg-white">
                    <option value="last">Last page</option>
                    <option value="first">First page</option>
                  </select>
                </label>
                <label class="text-xs text-gray-600">QR size
                  <select v-model.number="qrSize" class="block w-full mt-1 p-2.5 border border-gray-300 rounded-lg text-sm bg-white">
                    <option :value="72">Small (1 inch)</option>
                    <option :value="90">Medium</option>
                    <option :value="120">Large</option>
                  </select>
                </label>
              </div>
              <p class="text-xs text-gray-500 mt-2">The QR sits in the bottom-right corner. Check it does not cover anything on your template.</p>
            </details>

            <p class="text-xs text-gray-500">You'll sign this mint with the Xaman app — no seed is ever entered here.</p>

            <button type="submit" :disabled="loading || !pdfFile"
              class="w-full px-6 py-3 bg-primary-blue text-white rounded-lg hover:bg-blue-700 transition-all duration-200 font-medium shadow-lg disabled:bg-gray-400 disabled:shadow-none disabled:cursor-not-allowed">
              {{ loading ? busyNote || 'Working…' : 'Stamp and anchor transcript' }}
            </button>
          </form>

          <div v-if="error" class="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p class="text-red-700 font-medium">{{ error }}</p>
          </div>

          <div v-if="success" class="mt-6 p-6 bg-green-50 border border-green-200 rounded-lg">
            <div class="font-bold text-green-700 text-lg mb-4">Transcript anchored</div>
            <div class="space-y-2 text-sm text-gray-700">
              <div><span class="font-semibold">NFT ID:</span> <span class="font-mono text-xs bg-gray-100 px-2 py-1 rounded break-all">{{ nftId }}</span></div>
              <div v-if="nftMintTime"><span class="font-semibold">Anchored:</span> <span class="font-mono">{{ nftMintTime }}</span></div>
            </div>

            <a :href="downloadUrl" :download="downloadName"
              class="inline-block mt-4 px-6 py-2 bg-primary-blue text-white rounded-lg hover:bg-blue-700 transition-all duration-200 font-medium">
              Download stamped transcript
            </a>

            <div class="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <p class="font-semibold mb-1">Give the graduate this stamped file.</p>
              <p>
                The anchor covers this exact document. Re-saving, re-exporting, or printing and scanning it
                will change the file and it will no longer verify — the original must be kept and shared as it is.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <XamanSignModal v-if="xaman.visible" title="Sign transcript anchor" :qr-png="xaman.qrPng" :deeplink="xaman.deeplink"
      :status="xaman.status" :error-message="xaman.errorMessage" :allow-cancel="xaman.status === 'pending'" @cancel="cancelXamanSign" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Buffer } from 'buffer'
import * as QRCode from 'qrcode'
import { NFTokenMintFlags } from 'xrpl'
import XamanSignModal from '../components/XamanSignModal.vue'
import { useXamanSign } from '../composables/useXamanSign'
import { randomSalt } from '../lib/crypto'
import { pdfCredentialHash, stampCredentialPdf } from '../lib/pdfCredential'
import { resolveMintedNft, validateMintTx, withXrpl } from '../lib/xrplClient'

const issuerAccount = ref('')
const issuerDomain = ref('')
const pdfFile = ref<File | null>(null)
const pageChoice = ref<'last' | 'first'>('last')
const qrSize = ref(90)

const loading = ref(false)
const busyNote = ref('')
const error = ref('')
const success = ref(false)
const nftId = ref('')
const nftMintTime = ref('')
const downloadUrl = ref('')
const downloadName = ref('transcript-anchored.pdf')

const { xaman, cancel: cancelXamanSign, close: closeXaman, signViaXaman } = useXamanSign()

function handleFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0] || null
  pdfFile.value = file
  success.value = false
  error.value = ''
  if (file) downloadName.value = file.name.replace(/\.pdf$/i, '') + '-anchored.pdf'
}

/**
 * The QR on a transcript cannot carry the document's hash: the hash is taken
 * after stamping, so it does not exist yet. It carries what a verifier cannot
 * derive on their own — the salt and the issuer — and the document supplies
 * the rest.
 */
async function makeTranscriptQR(salt: string, account: string): Promise<string> {
  const payload = JSON.stringify({ kind: 'pdf', salt, issuerAccount: account })
  return QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', width: 256 })
}

function buildMintTx(hash: string, account: string) {
  return {
    TransactionType: 'NFTokenMint',
    Account: account,
    URI: Buffer.from(`vc:sha256:${hash}`).toString('hex'),
    // Same shape a field-based credential uses, so verification needs no
    // special case: the ledger scan matches on the hash alone.
    Flags: NFTokenMintFlags.tfBurnable,
    NFTokenTaxon: 0,
    Memos: [
      {
        Memo: {
          MemoType: Buffer.from('vc-hash').toString('hex'),
          MemoData: Buffer.from(JSON.stringify({ hash })).toString('hex'),
        },
      },
    ],
  }
}

async function handleSubmit() {
  error.value = ''
  success.value = false
  nftId.value = ''
  nftMintTime.value = ''
  if (downloadUrl.value) URL.revokeObjectURL(downloadUrl.value)
  downloadUrl.value = ''

  const account = issuerAccount.value.trim()
  if (!/^r[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(account)) {
    error.value = 'Enter a valid XRPL issuer address.'
    return
  }
  if (!pdfFile.value) return

  loading.value = true
  try {
    const original = await pdfFile.value.arrayBuffer()
    const salt = randomSalt()

    // Order matters: stamp first, then hash the finished bytes. Hashing the
    // original would anchor a document nobody ever receives.
    busyNote.value = 'Stamping the document…'
    const qrDataUrl = await makeTranscriptQR(salt, account)
    const stamped = await stampCredentialPdf(original, {
      qrDataUrl,
      salt,
      issuerAccount: account,
      pageIndex: pageChoice.value === 'first' ? 0 : -1,
      size: qrSize.value,
    })

    busyNote.value = 'Hashing…'
    const hash = await pdfCredentialHash(stamped, salt)

    const tx = buildMintTx(hash, account)
    validateMintTx(tx)

    busyNote.value = 'Waiting for signature…'
    const txid = await signViaXaman(tx)
    const minted = await withXrpl((client) => resolveMintedNft(client, txid))
    closeXaman()

    nftId.value = minted.nftId
    nftMintTime.value = minted.mintTime ? new Date(minted.mintTime).toLocaleString() : ''

    // Offer the stamped bytes — the only copy that matches the anchor.
    downloadUrl.value = URL.createObjectURL(new Blob([stamped as BlobPart], { type: 'application/pdf' }))
    success.value = true
  } catch (e: any) {
    error.value = e?.message || String(e)
    closeXaman()
  } finally {
    loading.value = false
    busyNote.value = ''
  }
}
</script>
