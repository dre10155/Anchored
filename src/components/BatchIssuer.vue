<template>
  <div>
    <h2 class="text-2xl font-bold text-brand-black mb-2">Batch Issue {{ credType.displayNamePlural }}</h2>
    <p class="text-sm text-gray-600 mb-6">
      Upload a roster and anchor the whole batch with <span class="font-semibold">one signature</span>.
      Every credential is hashed into a single Merkle tree; only the tree's root goes on the ledger,
      and each {{ credType.subjectNoun.toLowerCase() }} receives a proof that their credential belongs to it.
    </p>

    <!-- Step 1: roster -->
    <div class="space-y-4">
      <input
        type="file"
        accept=".csv,.json"
        @change="handleFileChange"
        :disabled="busy"
        class="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-blue file:text-white hover:file:bg-blue-700 file:cursor-pointer file:transition-all file:duration-200"
      />
      <p class="text-xs text-gray-500">
        CSV or JSON with columns: <span class="font-mono">{{ credType.fields.map(f => f.key).join(', ') }}</span>.
        <a :href="sampleCsvUrl" download="anchored-roster-sample.csv" class="text-primary-blue hover:text-blue-700 font-medium">Download a sample</a>
      </p>
    </div>

    <div v-if="parseError" class="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
      <p class="text-red-700 font-medium">{{ parseError }}</p>
    </div>

    <!-- Row-level validation problems -->
    <div v-if="rosterErrors.length" class="mt-6 p-4 bg-amber-50 border border-amber-300 rounded-lg">
      <p class="text-amber-800 font-medium mb-2">
        {{ rosterErrors.length }} row{{ rosterErrors.length === 1 ? '' : 's' }} skipped — fix and re-upload to include them:
      </p>
      <ul class="text-sm text-amber-800 space-y-1 max-h-40 overflow-y-auto">
        <li v-for="e in rosterErrors" :key="e.row" class="font-mono text-xs">Row {{ e.row }}: {{ e.message }}</li>
      </ul>
    </div>

    <!-- Step 2: preview + anchor -->
    <div v-if="records.length" class="mt-8">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-bold text-brand-black">
          {{ records.length }} credential{{ records.length === 1 ? '' : 's' }} ready
        </h3>
        <span class="text-xs text-gray-500">showing first {{ Math.min(5, records.length) }}</span>
      </div>
      <div class="overflow-x-auto rounded-lg border border-gray-200 mb-6">
        <table class="w-full text-sm bg-white">
          <thead>
            <tr class="bg-gradient-to-r from-primary-blue to-blue-600 text-white">
              <th v-for="field in credType.fields" :key="field.key" class="px-4 py-3 text-left font-semibold">{{ field.label }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in records.slice(0, 5)" :key="i" class="border-t border-gray-200">
              <td v-for="(field, fi) in credType.fields" :key="field.key" class="px-4 py-3" :class="fi === 0 ? 'font-medium text-gray-900' : 'text-gray-700'">{{ r[field.key] }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <button
        @click="handleAnchor"
        :disabled="busy || !issuerAccount"
        class="w-full px-8 py-3 bg-primary-blue text-white rounded-lg hover:bg-blue-700 transition-all duration-200 font-medium shadow-lg shadow-blue-500/30 disabled:bg-gray-400 disabled:shadow-none disabled:cursor-not-allowed"
      >
        {{ busy ? statusLabel : `Anchor ${records.length} credentials with one signature` }}
      </button>
      <p v-if="!issuerAccount" class="text-xs text-amber-700 mt-2">Enter the issuer account above first.</p>

      <div v-if="progressTotal" class="mt-4">
        <div class="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div class="h-full bg-primary-blue transition-all duration-200" :style="{ width: `${Math.round((progressDone / progressTotal) * 100)}%` }"></div>
        </div>
        <p class="text-xs text-gray-500 mt-2">{{ statusLabel }} — {{ progressDone }} / {{ progressTotal }}</p>
      </div>
    </div>

    <div v-if="error" class="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
      <p class="text-red-700 font-medium">{{ error }}</p>
    </div>

    <!-- Step 3: result -->
    <div v-if="result" class="mt-8 p-6 bg-green-50 border border-green-200 rounded-lg">
      <div class="font-bold text-green-700 text-lg mb-4">
        {{ result.count }} credentials anchored in one transaction
      </div>
      <div class="space-y-2 text-sm text-gray-700">
        <div><span class="font-semibold">Merkle root:</span> <span class="font-mono text-xs bg-gray-100 px-2 py-1 rounded break-all">{{ result.root }}</span></div>
        <div><span class="font-semibold">Anchor NFT:</span> <span class="font-mono text-xs bg-gray-100 px-2 py-1 rounded break-all">{{ result.nftId }}</span></div>
      </div>
      <a
        v-if="result.zipUrl"
        :href="result.zipUrl"
        :download="`anchored-batch-${result.root.slice(0, 12)}.zip`"
        class="inline-block mt-4 px-6 py-2 bg-primary-blue text-white rounded-lg hover:bg-blue-700 transition-all duration-200 font-medium"
      >
        Download credential package (.zip)
      </a>
      <p class="text-xs text-gray-600 mt-3">
        Contains one credential file + QR per graduate, a manifest, and distribution instructions.
      </p>
    </div>

    <XamanSignModal
      v-if="xaman.visible"
      title="Sign batch anchor"
      :qr-png="xaman.qrPng"
      :deeplink="xaman.deeplink"
      :status="xaman.status"
      :error-message="xaman.errorMessage"
      :allow-cancel="xaman.status === 'pending'"
      @cancel="cancelXamanSign"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { Buffer } from 'buffer'
import { NFTokenMintFlags } from 'xrpl'
import { parseRoster, buildBatch, makeBatchZip, batchUri, type RosterRecord, type RosterError } from '../lib/batch'
import { withXrpl, resolveMintedNft, validateMintTx } from '../lib/xrplClient'
import { useXamanSign } from '../composables/useXamanSign'
import { DEFAULT_CREDENTIAL_TYPE, type CredentialType } from '../lib/credentialTypes'
import XamanSignModal from './XamanSignModal.vue'

const props = withDefaults(
  defineProps<{ issuerAccount: string; issuerDomain?: string; credentialType?: CredentialType }>(),
  { credentialType: () => DEFAULT_CREDENTIAL_TYPE }
)
const credType = computed(() => props.credentialType)

const records = ref<RosterRecord[]>([])
const rosterErrors = ref<RosterError[]>([])
const parseError = ref('')
const error = ref('')
const busy = ref(false)
const statusLabel = ref('')
const progressDone = ref(0)
const progressTotal = ref(0)
const result = ref<{ root: string; nftId: string; count: number; zipUrl: string } | null>(null)

const { xaman, cancel: cancelXamanSign, close: closeXaman, signViaXaman } = useXamanSign()

const sampleCsvUrl = computed(() => {
  const fields = credType.value.fields
  const header = fields.map((f) => f.key).join(',')
  const sampleRow = (name: string) =>
    fields.map((f) => (f.type === 'number' ? '2026' : `"${f.key === credType.value.primaryField ? name : 'Sample ' + f.label}"`)).join(',')
  const csv = [header, sampleRow('Jane Doe'), sampleRow('Roe, John')].join('\n')
  return URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
})

function resetResult() {
  if (result.value?.zipUrl) URL.revokeObjectURL(result.value.zipUrl)
  result.value = null
}

async function handleFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  parseError.value = ''
  error.value = ''
  records.value = []
  rosterErrors.value = []
  resetResult()
  if (!file) return

  try {
    const parsed = parseRoster(await file.text(), file.name, credType.value)
    records.value = parsed.records
    rosterErrors.value = parsed.errors
    if (!parsed.records.length) {
      parseError.value = 'No valid rows found in this roster.'
    }
  } catch (e: any) {
    parseError.value = e?.message || String(e)
  }
}

async function handleAnchor() {
  error.value = ''
  resetResult()
  busy.value = true
  try {
    // 1. Hash every credential into one Merkle tree (nothing on-chain yet)
    statusLabel.value = 'Hashing credentials'
    progressDone.value = 0
    progressTotal.value = records.value.length
    const { entries, tree } = await buildBatch(
      records.value,
      props.issuerAccount,
      props.issuerDomain,
      (done, total) => {
        progressDone.value = done
        progressTotal.value = total
      }
    )

    // 2. One transaction anchors the whole class — only the root is published
    statusLabel.value = 'Waiting for signature'
    progressTotal.value = 0
    const tx = {
      TransactionType: 'NFTokenMint',
      Account: props.issuerAccount,
      URI: Buffer.from(batchUri(tree.root)).toString('hex'),
      Flags: NFTokenMintFlags.tfBurnable,
      NFTokenTaxon: 0,
      Memos: [
        {
          Memo: {
            MemoType: Buffer.from('vc-batch').toString('hex'),
            MemoData: Buffer.from(
              JSON.stringify({ root: tree.root, count: entries.length })
            ).toString('hex'),
          },
        },
      ],
    }
    validateMintTx(tx)
    const txid = await signViaXaman(tx)

    statusLabel.value = 'Anchoring on the ledger'
    const minted = await withXrpl((client) => resolveMintedNft(client, txid))
    closeXaman()

    // 3. Package a credential + QR for every graduate
    statusLabel.value = 'Building credential package'
    progressDone.value = 0
    progressTotal.value = entries.length
    const blob = await makeBatchZip({
      entries,
      tree,
      issuerAccount: props.issuerAccount,
      issuerDomain: props.issuerDomain,
      nftId: minted.nftId,
      type: credType.value,
      onProgress: (done, total) => {
        progressDone.value = done
        progressTotal.value = total
      },
    })

    result.value = {
      root: tree.root,
      nftId: minted.nftId,
      count: entries.length,
      zipUrl: URL.createObjectURL(blob),
    }
  } catch (e: any) {
    error.value = e?.message || String(e)
    closeXaman()
  } finally {
    busy.value = false
    statusLabel.value = ''
    progressTotal.value = 0
  }
}

onUnmounted(resetResult)
</script>
