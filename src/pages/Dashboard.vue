<template>
  <div class="min-h-screen pt-20">
    <section class="relative py-12 sm:py-16 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <div class="absolute inset-0 bg-gradient-to-br from-brand-black via-gray-900 to-brand-black"></div>
      <div class="absolute top-0 right-1/3 w-96 h-96 bg-primary-blue rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob"></div>

      <div class="max-w-6xl mx-auto relative z-10">
        <div class="mb-8">
          <p class="text-primary-blue uppercase tracking-widest text-xs font-bold mb-3">Issuer workspace</p>
          <h1 class="text-4xl md:text-5xl font-bold text-white mb-3">Credential Dashboard</h1>
          <p class="text-lg text-gray-300 max-w-2xl">Review every credential anchored by an institution, including credentials that were later revoked.</p>
        </div>

        <div class="bg-white rounded-xl shadow-xl p-5 sm:p-8 border border-gray-200">
          <form @submit.prevent="loadAnchors" class="space-y-4">
            <div class="flex flex-col lg:flex-row gap-3">
              <div class="flex-1">
                <label for="issuer-address" class="block text-sm font-medium text-brand-black mb-2">Issuer wallet</label>
                <input id="issuer-address" :value="address" @input="handleAddressInput" class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-blue focus:border-transparent font-mono" placeholder="r..." autocomplete="off" />
              </div>
              <div v-if="saved.length" class="lg:w-72">
                <label for="saved-issuers" class="block text-sm font-medium text-brand-black mb-2">Remembered wallets</label>
                <select id="saved-issuers" :value="address" @change="handleSavedSelection" class="w-full p-3 border border-gray-300 rounded-lg bg-white font-mono text-sm">
                  <option value="">Choose a wallet</option>
                  <option v-for="wallet in saved" :key="wallet" :value="wallet">{{ wallet }}</option>
                </select>
              </div>
              <div class="flex items-end gap-3">
                <button type="button" @click="connectWallet" :disabled="loading" class="px-4 py-3 border border-primary-blue text-primary-blue rounded-lg hover:bg-blue-50 font-medium whitespace-nowrap disabled:opacity-50">Connect with Xaman</button>
                <button type="submit" :disabled="loading" class="px-6 py-3 bg-primary-blue text-white rounded-lg hover:bg-blue-700 font-medium whitespace-nowrap disabled:bg-gray-400">{{ loading ? 'Scanning...' : 'Load' }}</button>
              </div>
            </div>
            <p class="text-xs text-gray-500">Enter a public XRPL address or prove control of it with Xaman SignIn. This dashboard is read-only.</p>
            <p v-if="connectedViaXaman" class="text-sm text-green-700 font-medium">Connected with Xaman. Wallet control was proven for this sign-in.</p>
          </form>

          <p v-if="progressNote" class="mt-5 text-sm text-gray-600">{{ progressNote }}</p>
          <div v-if="error" class="mt-5 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{{ error }}</div>
        </div>

        <div v-if="hasLoaded" class="mt-8 space-y-6">
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div v-for="stat in summary" :key="stat.label" class="bg-white rounded-xl p-5 border border-gray-200 shadow-lg">
              <p class="text-sm text-gray-500">{{ stat.label }}</p>
              <p class="text-3xl font-bold mt-1" :class="stat.color">{{ stat.value }}</p>
            </div>
          </div>

          <div class="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
            <div class="p-5 sm:p-6 border-b border-gray-200 flex flex-col xl:flex-row xl:items-end justify-between gap-4">
              <div>
                <h2 class="text-xl font-bold text-brand-black">Anchored credentials</h2>
                <p class="text-sm text-gray-500 mt-1">{{ filteredAnchors.length }} of {{ anchors.length }} shown</p>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <select v-model="typeFilter" class="p-2.5 border border-gray-300 rounded-lg text-sm bg-white" aria-label="Filter by type">
                  <option value="all">All types</option><option value="single">Credential</option><option value="batch">Class (batch)</option>
                </select>
                <select v-model="statusFilter" class="p-2.5 border border-gray-300 rounded-lg text-sm bg-white" aria-label="Filter by status">
                  <option value="all">All statuses</option><option value="live">Live</option><option value="revoked">Revoked</option>
                </select>
                <button type="button" @click="exportCsv" :disabled="!filteredAnchors.length" class="px-4 py-2.5 bg-brand-black text-white rounded-lg hover:bg-gray-800 text-sm font-medium disabled:bg-gray-300">Export CSV</button>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 xl:max-w-md">
                <label class="text-xs text-gray-500">Find by name
                  <input v-model="nameQuery" :disabled="!namedSubjectCount" type="search" placeholder="Student or licensee" class="block w-full mt-1 p-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-50 disabled:placeholder-gray-300" />
                </label>
                <label class="text-xs text-gray-500">Load batch manifest
                  <input type="file" accept=".json" multiple @change="handleManifestUpload" class="block w-full mt-1 text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:bg-gray-100 file:text-brand-black hover:file:bg-gray-200 file:cursor-pointer" />
                </label>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 xl:max-w-md">
                <label class="text-xs text-gray-500">From<input v-model="dateFrom" type="date" class="block w-full mt-1 p-2 border border-gray-300 rounded-lg text-sm" /></label>
                <label class="text-xs text-gray-500">To<input v-model="dateTo" type="date" class="block w-full mt-1 p-2 border border-gray-300 rounded-lg text-sm" /></label>
              </div>
            </div>

            <div v-if="manifestError" class="mx-5 mt-5 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{{ manifestError }}</div>
            <div v-if="namedSubjectCount" class="mx-5 mt-5 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900 flex flex-wrap items-center justify-between gap-3">
              <span>{{ manifestNote || `${namedSubjectCount} names available from loaded manifests.` }}</span>
              <button type="button" @click="forgetNames" class="font-semibold underline whitespace-nowrap">Forget these names</button>
            </div>
            <p v-else class="mx-5 mt-5 text-xs text-gray-500">
              The ledger holds no personal data, so names are not shown here. Load a batch manifest from your credential package to search by name — it is read on this device and never uploaded.
            </p>

            <div v-if="truncated" class="mx-5 mt-5 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">Showing the most recent 2,000 transactions. Older credentials exist but are not listed.</div>
            <div v-if="individualRevocations" class="mx-5 mt-5 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">{{ individualRevocations }} individual credentials revoked within batches.</div>

            <div v-if="!filteredAnchors.length" class="p-10 text-center text-gray-500">{{ anchors.length ? 'No credentials match these filters.' : 'No credentials were found for this wallet.' }}</div>
            <div v-else class="overflow-x-auto">
              <table class="w-full min-w-[780px] text-left">
                <thead class="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr><th class="px-5 py-3">Type</th><th class="px-5 py-3">Anchored</th><th class="px-5 py-3">Reference</th><th class="px-5 py-3">NFT ID</th><th class="px-5 py-3">Status</th><th class="px-5 py-3">Ledger</th></tr>
                </thead>
                <tbody>
                  <template v-for="anchor in filteredAnchors" :key="`${anchor.txHash}-${anchor.nftId}`">
                  <tr class="border-t border-gray-100 hover:bg-gray-50">
                    <td class="px-5 py-4 text-sm font-medium text-brand-black">{{ anchor.kind === 'batch' ? 'Class (batch)' : 'Credential' }}</td>
                    <td class="px-5 py-4 text-sm text-gray-600 whitespace-nowrap">{{ formatDate(anchor.mintDate) }}</td>
                    <td class="px-5 py-4"><button type="button" @click="copy(anchor.reference)" class="font-mono text-xs text-primary-blue hover:underline" :title="`Copy ${anchor.reference}`">{{ shorten(anchor.reference) }}</button></td>
                    <td class="px-5 py-4"><button type="button" @click="copy(anchor.nftId)" class="font-mono text-xs text-primary-blue hover:underline" :title="`Copy ${anchor.nftId}`">{{ shorten(anchor.nftId) }}</button></td>
                    <td class="px-5 py-4"><span class="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold" :class="anchor.revoked ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-700'">{{ anchor.revoked ? 'Revoked' : 'Live' }}</span><span v-if="anchor.revokedAt" class="block text-xs text-gray-500 mt-1">{{ formatDate(anchor.revokedAt) }}</span></td>
                    <td class="px-5 py-4"><a :href="`https://testnet.xrpl.org/transactions/${anchor.txHash}`" target="_blank" rel="noreferrer" class="text-primary-blue hover:underline text-sm">View</a></td>
                  </tr>
                  <!-- Names for this batch, from a manifest the registrar loaded. -->
                  <tr v-if="manifests.has(anchor.reference)" class="border-t border-gray-100 bg-gray-50/60">
                    <td colspan="6" class="px-5 py-3">
                      <button type="button" @click="toggleExpanded(anchor.reference)" class="text-sm font-medium text-primary-blue hover:underline">
                        {{ expandedRoot === anchor.reference ? 'Hide' : 'Show' }} {{ subjectsFor(anchor.reference).length }} named
                        {{ subjectsFor(anchor.reference).length === 1 ? 'subject' : 'subjects' }}
                      </button>
                      <ul v-if="expandedRoot === anchor.reference" class="mt-3 grid gap-2 sm:grid-cols-2">
                        <li v-for="subject in subjectsFor(anchor.reference)" :key="subject.leaf" class="p-3 bg-white border border-gray-200 rounded-lg">
                          <p class="font-medium text-brand-black text-sm">{{ subject.name || 'Unnamed' }}</p>
                          <p class="text-xs text-gray-500 font-mono mt-1 break-all">{{ subject.file }}</p>
                          <button type="button" @click="copy(subject.leaf)" class="text-xs text-primary-blue hover:underline mt-1" :title="`Copy ${subject.leaf}`">Copy credential hash</button>
                        </li>
                      </ul>
                    </td>
                  </tr>
                  </template>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </section>

    <XamanSignModal v-if="xaman.visible" title="Connect issuer wallet" :qr-png="xaman.qrPng" :deeplink="xaman.deeplink" :status="xaman.status" :error-message="xaman.errorMessage" :allow-cancel="true" @cancel="cancel" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import XamanSignModal from '../components/XamanSignModal.vue'
import { useIssuerAddress } from '../composables/useIssuerAddress'
import { scanIssuerAnchors, type IssuedAnchor } from '../lib/verify'
import { withXrpl } from '../lib/xrplClient'
import { matchesName, parseManifest, type ParsedManifest } from '../lib/manifest'

const { address, connectedViaXaman, saved, setManual, connect, xaman, cancel } = useIssuerAddress()
const anchors = ref<IssuedAnchor[]>([])
const scannedTx = ref(0)
const truncated = ref(false)
const individualRevocations = ref(0)
const loading = ref(false)
const hasLoaded = ref(false)
const error = ref('')
const progressNote = ref('')
const typeFilter = ref('all')
const statusFilter = ref('all')
const dateFrom = ref('')
const dateTo = ref('')

// Manifests the registrar has opened this session, keyed by Merkle root. Held
// in memory only: these carry student names, and this is often a shared
// workstation. Closing the tab forgets them.
const manifests = ref(new Map<string, ParsedManifest>())
const nameQuery = ref('')
const expandedRoot = ref('')
const manifestNote = ref('')
const manifestError = ref('')

const namedSubjectCount = computed(() =>
  [...manifests.value.values()].reduce((total, manifest) => total + manifest.subjects.length, 0),
)

/** Subjects of a batch whose manifest is loaded, narrowed by the name search. */
function subjectsFor(root: string) {
  const manifest = manifests.value.get(root)
  if (!manifest) return []
  return manifest.subjects.filter((subject) => matchesName(subject.name, nameQuery.value))
}

const filteredAnchors = computed(() => anchors.value.filter((anchor) => {
  const date = anchor.mintDate.slice(0, 10)
  const matchesFilters = (typeFilter.value === 'all' || anchor.kind === typeFilter.value) &&
    (statusFilter.value === 'all' || (statusFilter.value === 'revoked' ? anchor.revoked : !anchor.revoked)) &&
    (!dateFrom.value || date >= dateFrom.value) && (!dateTo.value || date <= dateTo.value)
  if (!matchesFilters) return false

  // A name search can only speak for batches whose manifest is loaded. Anchors
  // with no manifest are hidden while searching rather than shown as
  // non-matches, since we genuinely cannot say who they belong to.
  if (!nameQuery.value) return true
  return subjectsFor(anchor.reference).length > 0
}))

const summary = computed(() => [
  { label: 'Total anchored', value: anchors.value.length, color: 'text-primary-blue' },
  { label: 'Live', value: anchors.value.filter((anchor) => !anchor.revoked).length, color: 'text-green-600' },
  { label: 'Revoked', value: anchors.value.filter((anchor) => anchor.revoked).length, color: 'text-amber-600' },
])

function formatDate(value: string) { return value ? new Date(value).toLocaleDateString() : 'Unknown' }
function shorten(value: string) { return value ? `${value.slice(0, 16)}…` : 'Unavailable' }
function handleAddressInput(event: Event) { setManual((event.target as HTMLInputElement).value) }
function handleSavedSelection(event: Event) { setManual((event.target as HTMLSelectElement).value) }

async function loadAnchors() {
  error.value = ''
  hasLoaded.value = false
  progressNote.value = ''
  const account = address.value.trim()
  if (!/^r[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(account)) {
    error.value = 'Enter a valid XRPL wallet address.'
    return
  }
  loading.value = true
  try {
    const result = await withXrpl((client) => scanIssuerAnchors(client, account, {
      onProgress: (count) => { scannedTx.value = count; progressNote.value = `Scanned ${count} transactions…` },
    }))
    anchors.value = result.anchors.sort((left, right) => right.mintDate.localeCompare(left.mintDate))
    scannedTx.value = result.scannedTx
    truncated.value = result.truncated
    individualRevocations.value = result.individualRevocations
    hasLoaded.value = true
  } catch (err: any) {
    const message = err?.data?.error === 'actNotFound' || err?.message?.includes('actNotFound')
      ? 'This wallet does not exist on the XRP Ledger testnet.'
      : err?.message || String(err)
    error.value = message
  } finally {
    loading.value = false
    progressNote.value = ''
  }
}

async function connectWallet() {
  error.value = ''
  try { await connect() } catch (err: any) { error.value = err?.message || String(err) }
}

async function handleManifestUpload(event: Event) {
  const input = event.target as HTMLInputElement
  manifestError.value = ''
  manifestNote.value = ''
  let added = 0

  for (const file of Array.from(input.files || [])) {
    try {
      // Read in the browser. Nothing is uploaded, and nothing is stored.
      const parsed = parseManifest(await file.text())
      manifests.value.set(parsed.root, parsed)
      added += parsed.subjects.length
    } catch (err: any) {
      manifestError.value = `${file.name}: ${err?.message || String(err)}`
    }
  }

  if (added) {
    const known = anchors.value.some((anchor) => manifests.value.has(anchor.reference))
    manifestNote.value = known
      ? `${added} names loaded. They stay on this device and are forgotten when you close the tab.`
      : `${added} names loaded, but no batch on this wallet matches them — check the manifest belongs to this issuer.`
  }
  // Allow re-picking the same file after a correction.
  input.value = ''
}

function toggleExpanded(root: string) {
  expandedRoot.value = expandedRoot.value === root ? '' : root
}

function forgetNames() {
  manifests.value = new Map()
  nameQuery.value = ''
  expandedRoot.value = ''
  manifestNote.value = ''
  manifestError.value = ''
}

async function copy(value: string) {
  if (value) await navigator.clipboard?.writeText(value)
}

function csvField(value: string) { return `"${value.replace(/"/g, '""')}"` }
function exportCsv() {
  const header = ['Type', 'Reference', 'NFT ID', 'Anchored Date', 'Status', 'Revoked Date']
  const rows = filteredAnchors.value.map((anchor) => [anchor.kind === 'batch' ? 'Class (batch)' : 'Credential', anchor.reference, anchor.nftId, anchor.mintDate, anchor.revoked ? 'Revoked' : 'Live', anchor.revokedAt])
  const csv = [header, ...rows].map((row) => row.map(csvField).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'anchored-credentials.csv'
  link.click()
  URL.revokeObjectURL(url)
}
</script>