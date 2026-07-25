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
          <h1 class="text-4xl md:text-5xl font-bold text-white mb-4">Issue Credentials</h1>
          <p class="text-xl text-gray-300 max-w-2xl mx-auto">
            Anchor verifiable {{ credType.displayName.toLowerCase() }} credentials on the XRP Ledger
          </p>
          <div v-if="devSeedMode" class="inline-block mt-4 px-3 py-1 bg-amber-500/20 border border-amber-500/40 rounded-full text-amber-300 text-xs font-medium">
            Dev seed mode — local signing, testnet only
          </div>
        </div>

        <!-- Credential type: one engine, many configs -->
        <div class="max-w-md mx-auto mb-8">
          <label class="block text-sm font-medium text-gray-300 mb-2 text-center">Credential type</label>
          <div class="flex flex-wrap gap-2 justify-center">
            <button
              v-for="t in credentialTypes"
              :key="t.id"
              @click="selectType(t.id)"
              class="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 border"
              :class="t.id === credTypeId
                ? 'bg-primary-blue text-white border-primary-blue'
                : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'"
            >{{ t.displayName }}</button>
          </div>
        </div>

        <div v-if="!mintMode" class="flex gap-4 justify-center mb-12">
          <button @click="mintMode = 'single'" class="px-8 py-3 bg-primary-blue text-white rounded-lg hover:bg-blue-700 transition-all duration-200 font-medium shadow-lg shadow-blue-500/30">
            Single Mint
          </button>
          <button @click="mintMode = 'batch'" class="px-8 py-3 bg-white text-brand-black rounded-lg hover:bg-gray-50 transition-all duration-200 font-medium shadow-lg border border-gray-200">
            Batch Mint
          </button>
        </div>
        <div v-if="mintMode === 'single'" class="bg-white rounded-xl shadow-xl p-5 sm:p-8 border border-gray-200">
          <form @submit.prevent="handleSubmit" class="space-y-6">
            <div v-for="field in credType.fields" :key="field.key">
              <label class="block font-medium text-brand-black mb-2">{{ field.label }}</label>
              <input
                v-model="formData[field.key]"
                :type="field.type === 'number' ? 'number' : 'text'"
                :min="field.min"
                :max="field.max"
                :placeholder="field.placeholder"
                class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-blue focus:border-transparent transition-all"
                required
              />
            </div>
            <div class="pt-4 border-t border-gray-200">
              <label class="block font-medium text-brand-black text-sm mb-2">Issuer Account</label>
              <input v-model="issuerAccount" class="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-blue focus:border-transparent transition-all font-mono" required placeholder="r..." />
            </div>
            <div>
              <label class="block font-medium text-brand-black text-sm mb-2">{{ credType.issuerNoun }} Domain (optional, for did:web identity)</label>
              <input v-model="issuerDomain" class="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-blue focus:border-transparent transition-all font-mono" :placeholder="credType.issuerDomainPlaceholder" />
              <p class="text-xs text-gray-500 mt-1">
                Verified issuers show a green "issued by" badge.
                <router-link to="/identity" class="text-primary-blue hover:text-blue-700 font-medium">Set up your identity →</router-link>
              </p>
            </div>
            <div v-if="devSeedMode">
              <label class="block font-medium text-brand-black text-sm mb-2">Issuer Seed (dev only)</label>
              <input v-model="issuerSeed" class="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-blue focus:border-transparent transition-all font-mono" required placeholder="s..." />
            </div>
            <p v-else class="text-xs text-gray-500">
              You'll sign this mint with the Xaman app — no seed is ever entered here.
            </p>
            <button type="submit" :disabled="loading" class="w-full px-8 py-3 bg-primary-blue text-white rounded-lg hover:bg-blue-700 transition-all duration-200 font-medium shadow-lg shadow-blue-500/30 disabled:bg-gray-400 disabled:shadow-none disabled:cursor-not-allowed">
              {{ loading ? 'Issuing...' : `Issue ${credType.displayName} NFT` }}
            </button>
          </form>

          <div v-if="error" class="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p class="text-red-700 font-medium">{{ error }}</p>
          </div>

          <div v-if="success" class="mt-6 p-6 bg-green-50 border border-green-200 rounded-lg">
            <div class="font-bold text-green-700 text-lg mb-4">{{ credType.displayName }} NFT minted successfully!</div>
            <div class="space-y-2 text-sm text-gray-700">
              <div><span class="font-semibold">NFT ID:</span> <span class="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{{ nftId }}</span></div>
              <div v-if="nftMintTime"><span class="font-semibold">Minted On:</span> <span class="font-mono">{{ nftMintTime }}</span></div>
            </div>
            <a :href="downloadUrl" download="diploma-vc.json" class="inline-block mt-4 px-6 py-2 bg-primary-blue text-white rounded-lg hover:bg-blue-700 transition-all duration-200 font-medium">
              Download VC JSON
            </a>
            <div class="mt-6 pt-6 border-t border-gray-200">
              <img v-if="qrUrl" :src="qrUrl" alt="Verifier QR" class="w-48 h-48 mx-auto border-4 border-gray-200 rounded-lg" />
              <div class="text-xs text-gray-500 mt-3 text-center">Scan to verify (issuer/hash)</div>
              <div v-if="issuerAccount" class="text-xs text-gray-700 mt-2 text-center">
                Issuer Address: <span class="font-mono bg-gray-100 px-2 py-1 rounded">{{ issuerAccount }}</span>
              </div>
            </div>
          </div>
        </div>
        <div v-if="mintMode === 'batch'" class="bg-white rounded-xl shadow-xl p-5 sm:p-8 border border-gray-200">
          <div class="space-y-6 mb-8 pb-8 border-b border-gray-200">
            <div>
              <label class="block font-medium text-brand-black text-sm mb-2">Issuer Account</label>
              <input v-model="issuerAccount" class="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-blue focus:border-transparent transition-all font-mono" required placeholder="r..." />
            </div>
            <div>
              <label class="block font-medium text-brand-black text-sm mb-2">{{ credType.issuerNoun }} Domain (optional, for did:web identity)</label>
              <input v-model="issuerDomain" class="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-blue focus:border-transparent transition-all font-mono" :placeholder="credType.issuerDomainPlaceholder" />
            </div>
          </div>
          <BatchIssuer :issuer-account="issuerAccount.trim()" :issuer-domain="issuerDomain.trim() || undefined" :credential-type="credType" />
        </div>
        <div v-if="issuerAccount && nftCount !== null" class="mt-12 bg-white rounded-xl shadow-xl p-5 sm:p-8 border border-gray-200">
          <h2 class="text-2xl font-bold text-brand-black mb-4">Anchors Minted by This Issuer</h2>
          <div class="mb-6 text-gray-700">
            Total Anchors Minted: <span class="font-bold text-primary-blue text-xl">{{ nftCount }}</span>
          </div>

          <div v-if="mintedNfts.length" class="overflow-x-auto rounded-lg border border-gray-200">
            <table class="w-full bg-white">
              <thead>
                <tr class="bg-gradient-to-r from-primary-blue to-blue-600 text-white">
                  <th class="px-4 py-3 font-semibold text-left">NFT ID</th>
                  <th class="px-4 py-3 font-semibold text-left">Issuer</th>
                  <th class="px-4 py-3 font-semibold text-left">Minted At</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="nft in mintedNfts" :key="nft.NFTokenID" class="border-t border-gray-200 hover:bg-gray-50 transition-colors">
                  <td class="px-4 py-3 text-xs break-all">
                    <span class="font-mono bg-gray-100 px-2 py-1 rounded text-primary-blue">{{ nft.NFTokenID }}</span>
                  </td>
                  <td class="px-4 py-3 text-xs break-all">
                    <span class="font-mono text-gray-700">{{ nft.Issuer }}</span>
                  </td>
                  <td class="px-4 py-3 text-sm text-gray-700">{{ nft.mintTime || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="text-gray-500 text-center py-8">
            No anchors (NFTs) found for this issuer wallet.
          </div>
        </div>
      </div>
    </section>

    <XamanSignModal
      v-if="xaman.visible"
      title="Sign diploma mint"
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
import { computed, reactive, ref, watch } from 'vue'
import { credentialHash, buildVC, makeIssuerDID, randomSalt } from '../lib/crypto'
import { withXrpl, submitAndWait, resolveMintedNft, validateMintTx } from '../lib/xrplClient'
import { makeDownloadUrlForVC, revokeObjectUrl, makeVerifierQR } from '../lib/vc'
import { useXamanSign } from '../composables/useXamanSign'
import { CREDENTIAL_TYPES, getCredentialType, DEFAULT_CREDENTIAL_TYPE } from '../lib/credentialTypes'
import { Client, Wallet, getNFTokenID, NFTokenMintFlags } from 'xrpl'
import { Buffer } from 'buffer'
import XamanSignModal from '../components/XamanSignModal.vue'
import BatchIssuer from '../components/BatchIssuer.vue'

// Local-seed signing is a testnet development convenience only. It is disabled
// by default; production issuance signs via Xaman so seeds never touch the browser.
const devSeedMode = import.meta.env.VITE_DEV_SEED_MODE === 'true'

// One engine, many configs: the form fields come from the selected credential type.
const credentialTypes = CREDENTIAL_TYPES
const credTypeId = ref(DEFAULT_CREDENTIAL_TYPE.id)
const credType = computed(() => getCredentialType(credTypeId.value))
const formData = reactive<Record<string, string | number>>({})

function resetFormData(typeId: string) {
  for (const key of Object.keys(formData)) delete formData[key]
  for (const field of getCredentialType(typeId).fields) {
    formData[field.key] = field.type === 'number' ? new Date().getFullYear() : ''
  }
}
resetFormData(credTypeId.value)

function selectType(id: string) {
  credTypeId.value = id
  resetFormData(id)
  success.value = false
}

const issuerAccount = ref('')
const issuerDomain = ref('')
const issuerSeed = ref('')
const loading = ref(false)
const error = ref('')
const success = ref(false)
const nftId = ref('')
const downloadUrl = ref('')
const qrUrl = ref('')
const nftMintTime = ref('')

const mintMode = ref<'' | 'single' | 'batch'>('')
const nftCount = ref<number | null>(null)

interface MintedNFT {
  NFTokenID: string
  Issuer: string
  mintTime?: string
  Flags: number
  NFTokenTaxon: number
  URI?: string
  nft_serial: number
}

const mintedNfts = ref<MintedNFT[]>([])
let lastDownloadUrl = ''

const { xaman, cancel: cancelXamanSign, close: closeXaman, signViaXaman } = useXamanSign()

// Privacy model: the full VC (with student PII and salt) lives ONLY in the file/QR
// the graduate holds. On-chain we anchor the salted hash twice — URI and memo —
// so nothing personal ever touches the public ledger (FERPA-safe).
function buildMintTx(_vc: any, hash: string, account: string) {
  return {
    TransactionType: 'NFTokenMint',
    Account: account,
    URI: Buffer.from(`vc:sha256:${hash}`).toString('hex'),
    // Soulbound: burnable by the issuer (revocation) but NOT transferable —
    // a diploma is bound to its graduate, never a tradable bearer asset.
    Flags: NFTokenMintFlags.tfBurnable,
    NFTokenTaxon: 0,
    // Store the salted hash as a memo in the NFT (anchor hash)
    Memos: [
      {
        Memo: {
          MemoType: Buffer.from('vc-hash').toString('hex'),
          // MemoData contains only the salted hash as anchor
          MemoData: Buffer.from(JSON.stringify({ hash })).toString('hex'),
        }
      }
    ]
  }
}

/** Mint via Xaman: QR sign flow, then resolve the NFTokenID from the validated tx. */
async function mintViaXaman(tx: any): Promise<{ nftId: string; mintTime: string }> {
  const txid = await signViaXaman(tx)
  const minted = await withXrpl((client) => resolveMintedNft(client, txid))
  closeXaman()
  return minted
}

function validateIssuer() {
  if (!issuerAccount.value.startsWith('r')) {
    error.value = 'Issuer account must start with r.'
    return false
  }
  if (devSeedMode && !issuerSeed.value.startsWith('s')) {
    error.value = 'Issuer seed must start with s.'
    return false
  }
  return true
}

async function handleSubmit() {
  error.value = ''
  success.value = false
  nftId.value = ''
  nftMintTime.value = ''
  loading.value = true
  if (lastDownloadUrl) revokeObjectUrl(lastDownloadUrl)
  downloadUrl.value = ''
  qrUrl.value = ''

  if (!validateIssuer()) {
    loading.value = false
    return
  }

  try {
    // 1. Build VC — subject fields come from the active credential-type config
    const issuer = makeIssuerDID(issuerAccount.value, issuerDomain.value)
    const subject = { ...formData, issuerAccount: issuerAccount.value }
    const salt = randomSalt()
    const vc = await buildVC({ issuer, subject, claim: {}, salt })
    // 2. Hash
    const hash = await credentialHash(vc, salt)
    // 3. Mint NFT with memo
    const tx = buildMintTx(vc, hash, issuerAccount.value)
    validateMintTx(tx)

    if (devSeedMode) {
      const wallet = Wallet.fromSeed(issuerSeed.value)
      await withXrpl(async (client) => {
        const result = await submitAndWait(client, wallet, tx)
        const meta = result.result?.meta
        nftId.value = getNFTokenID(meta as any) || '(unknown)'
        nftMintTime.value = (result.result as any)?.close_time_iso
          ? new Date((result.result as any).close_time_iso).toLocaleString()
          : ''
      })
    } else {
      const minted = await mintViaXaman(tx)
      nftId.value = minted.nftId
      nftMintTime.value = minted.mintTime ? new Date(minted.mintTime).toLocaleString() : ''
    }

    // 4. Download link and QR
    lastDownloadUrl = makeDownloadUrlForVC({ vc, salt })
    downloadUrl.value = lastDownloadUrl
    qrUrl.value = await makeVerifierQR({ salt, hash, subject, issuerAccount: issuerAccount.value })
    success.value = true
  } catch (e: any) {
    error.value = e?.message || String(e)
  } finally {
    loading.value = false
  }
}

async function fetchMintedNfts() {
  if (!issuerAccount.value || !issuerAccount.value.startsWith('r')) {
    nftCount.value = 0
    mintedNfts.value = []
    return
  }
  let client
  try {
    // Try multiple public XRPL endpoints so we can detect where the account lives
    const endpoints = [
      'wss://s.altnet.rippletest.net:51233', // alt/testnet
      'wss://s1.ripple.com' // mainnet
    ]
    let response: any = null
    let txsResp: any = null
    let usedEndpoint: string | null = null

    for (const url of endpoints) {
      client = new Client(url)
      try {
        await client.connect()
        response = await client.request({ command: 'account_nfts', account: issuerAccount.value })
        // If the server reports the account doesn't exist, try the next endpoint
        if (response && response.result && response.result.error === 'actNotFound') {
          await client.disconnect()
          client = undefined as any
          continue
        }
        // otherwise we found the account (or an empty list)
        usedEndpoint = url
        txsResp = await client.request({ command: 'account_tx', account: issuerAccount.value, limit: 200 })
        break
      } catch (e) {
        // ensure we disconnect before trying the next endpoint
        try { if (client?.isConnected()) await client.disconnect() } catch (_) {}
        client = undefined as any
        // try next endpoint
        continue
      }
    }

    if (!response || !usedEndpoint) {
      // Account wasn't found on any endpoint we tried
      nftCount.value = 0
      mintedNfts.value = []
      error.value = 'Account not found on testnet/mainnet. Verify the address or choose the correct network.'
      return
    }

    const nfts = (response && response.result && Array.isArray(response.result.account_nfts)) ? response.result.account_nfts : [];
    const txs = txsResp && txsResp.result && Array.isArray(txsResp.result.transactions) ? txsResp.result.transactions : []
    const nftsWithTime = nfts.map((nft: any) => {
      let mintTime = ''
      for (const txObj of txs) {
        const tx = txObj.tx || (txObj as any).tx_json
        if (tx && tx.TransactionType === 'NFTokenMint' && typeof txObj.meta === 'object' && 'AffectedNodes' in txObj.meta) {
          const closeTimeIso = (txObj as any).close_time_iso
          if (closeTimeIso) {
            const d = new Date(closeTimeIso)
            const mm = String(d.getMonth() + 1).padStart(2, '0')
            const dd = String(d.getDate()).padStart(2, '0')
            const yyyy = d.getFullYear()
            mintTime = `${mm}/${dd}/${yyyy}`
          }
          break
        }
      }
      return { ...nft, mintTime } as MintedNFT
    })
    nftCount.value = nftsWithTime.length
    mintedNfts.value = nftsWithTime
  } catch (err: any) {
    nftCount.value = 0
    mintedNfts.value = []
    error.value = err?.message || String(err)
  } finally {
    try { if (client?.isConnected()) await client.disconnect() } catch (_) {}
  }
}

watch(issuerAccount, () => {
  fetchMintedNfts()
})
</script>
