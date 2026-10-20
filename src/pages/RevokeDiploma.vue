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
          <h1 class="text-4xl md:text-5xl font-bold text-white mb-4">Revoke a Credential</h1>
          <p class="text-xl text-gray-300 max-w-2xl mx-auto">
            Withdraw a credential so every future check reports it as revoked
          </p>
        </div>

        <div class="bg-white rounded-xl shadow-xl p-5 sm:p-8 border border-gray-200">
          <div>
            <label class="block font-medium text-brand-black mb-2">Issuer Account</label>
            <input v-model="issuerAccount" class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-blue focus:border-transparent transition-all font-mono" placeholder="r..." />
          </div>
          <div v-if="devSeedMode" class="mt-4">
            <label class="block font-medium text-brand-black text-sm mb-2">Issuer Seed (dev only)</label>
            <input v-model="issuerSeed" class="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-blue focus:border-transparent transition-all font-mono" placeholder="s..." />
          </div>

          <div v-if="error" class="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p class="text-red-700 font-medium">{{ error }}</p>
          </div>
          <div v-if="revokedMsg" class="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p class="text-green-700 font-medium">{{ revokedMsg }}</p>
          </div>

          <div v-if="fetching" class="mt-8 text-gray-500 text-center py-6">Loading credentials…</div>
          <div v-else-if="nfts.length" class="mt-8 overflow-x-auto rounded-lg border border-gray-200">
            <table class="w-full text-sm bg-white">
              <thead>
                <tr class="bg-gradient-to-r from-primary-blue to-blue-600 text-white">
                  <th class="px-4 py-3 text-left font-semibold">NFT ID</th>
                  <th class="px-4 py-3 text-left font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="nft in nfts" :key="nft.NFTokenID" class="border-t border-gray-200 hover:bg-gray-50 transition-colors">
                  <td class="px-4 py-3 text-xs break-all">
                    <span class="font-mono bg-gray-100 px-2 py-1 rounded text-primary-blue">{{ nft.NFTokenID }}</span>
                  </td>
                  <td class="px-4 py-3">
                    <button @click="askRevoke(nft.NFTokenID)" :disabled="revoking" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all duration-200 text-xs font-medium disabled:bg-gray-400 disabled:cursor-not-allowed">
                      Revoke
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else-if="issuerAccount" class="mt-8 text-gray-500 text-center py-6">
            No anchor NFTs found for this issuer wallet.
          </div>

          <!-- Individual credential revocation (works for batch-issued credentials) -->
          <div class="mt-10 pt-8 border-t border-gray-200">
            <h2 class="text-xl font-bold text-brand-black mb-2">Revoke a single credential</h2>
            <p class="text-sm text-gray-600 mb-4">
              For batch-issued credentials, burning the anchor above would revoke the entire class.
              Upload one holder's credential file to revoke only theirs — this publishes a signed
              revocation record for that credential's hash, leaving the rest of the batch valid.
            </p>
            <input
              type="file"
              accept=".json"
              @change="handleCredentialUpload"
              class="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-blue file:text-white hover:file:bg-blue-700 file:cursor-pointer file:transition-all file:duration-200"
            />
            <div v-if="credentialToRevoke" class="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <p class="text-sm text-gray-700 mb-1">
                <span class="font-semibold">{{ credentialToRevoke.holderName }}</span><template v-if="credentialToRevoke.detail"> — {{ credentialToRevoke.detail }}</template>
              </p>
              <p class="text-xs font-mono text-gray-500 break-all mb-3">{{ credentialToRevoke.hash }}</p>
              <button
                @click="askRevokeCredential"
                :disabled="revoking || !issuerAccount"
                class="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all duration-200 font-medium text-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Revoke this credential
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Confirmation dialog -->
    <div v-if="pending" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white p-5 sm:p-6 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h3 class="text-xl font-bold text-brand-black mb-3">
          {{ pending.kind === 'burn' ? 'Burn this anchor?' : 'Revoke this credential?' }}
        </h3>
        <p v-if="pending.kind === 'burn'" class="text-sm text-gray-600 mb-2">
          This permanently burns the anchor NFT. Every credential anchored by it — the whole batch,
          if this anchors one — will verify as <span class="font-semibold text-amber-700">REVOKED</span>.
          This cannot be undone.
        </p>
        <p v-else class="text-sm text-gray-600 mb-2">
          This publishes a signed revocation for
          <span class="font-semibold">{{ pending.label }}</span>'s credential only. It will verify as
          <span class="font-semibold text-amber-700">REVOKED</span>; the rest of the batch is unaffected.
          This cannot be undone.
        </p>
        <div class="text-xs font-mono bg-gray-100 p-3 rounded-lg break-all mb-4">{{ pending.target }}</div>
        <label class="block font-medium text-brand-black text-sm mb-2">Reason (required, kept off-chain)</label>
        <textarea v-model="revokeReason" rows="2" class="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-blue focus:border-transparent transition-all" placeholder="e.g. Degree rescinded following academic misconduct finding"></textarea>
        <div class="flex flex-col-reverse sm:flex-row gap-3 mt-5">
          <button @click="pending = null" class="flex-1 px-6 py-3 bg-gray-100 text-brand-black rounded-lg hover:bg-gray-200 transition-all duration-200 font-medium">
            Cancel
          </button>
          <button @click="handleRevoke" :disabled="!revokeReason.trim() || revoking" class="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all duration-200 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed">
            {{ revoking ? 'Revoking…' : 'Confirm' }}
          </button>
        </div>
      </div>
    </div>

    <XamanSignModal
      v-if="xaman.visible"
      title="Sign credential revocation"
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
import { ref, watch } from 'vue'
import { withXrpl, submitAndWait, waitForValidatedTx } from '../lib/xrplClient'
import { useXamanSign } from '../composables/useXamanSign'
import { buildRevocationTx } from '../lib/verify'
import { credentialHash } from '../lib/crypto'
import { getCredentialType, inferCredentialType } from '../lib/credentialTypes'
import { Wallet } from 'xrpl'
import XamanSignModal from '../components/XamanSignModal.vue'

const devSeedMode = import.meta.env.VITE_DEV_SEED_MODE === 'true'

const issuerAccount = ref('')
const issuerSeed = ref('')
const nfts = ref<any[]>([])
const fetching = ref(false)
const revoking = ref(false)
const error = ref('')
const revokedMsg = ref('')
const revokeReason = ref('')

/** Either burn an anchor NFT, or publish a revocation for one credential hash. */
interface PendingRevocation {
  kind: 'burn' | 'credential'
  target: string
  label?: string
}
const pending = ref<PendingRevocation | null>(null)
const credentialToRevoke = ref<{ hash: string; holderName: string; detail: string } | null>(null)

const { xaman, cancel: cancelXamanSign, close: closeXaman, signViaXaman } = useXamanSign()

async function fetchNfts() {
  error.value = ''
  nfts.value = []
  if (!/^r[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(issuerAccount.value.trim())) return
  fetching.value = true
  try {
    await withXrpl(async (client) => {
      const resp = await client.request({ command: 'account_nfts', account: issuerAccount.value.trim() })
      nfts.value = Array.isArray(resp.result?.account_nfts) ? resp.result.account_nfts : []
    })
  } catch (e: any) {
    error.value = e?.message || String(e)
  } finally {
    fetching.value = false
  }
}

function askRevoke(nftId: string) {
  revokedMsg.value = ''
  revokeReason.value = ''
  pending.value = { kind: 'burn', target: nftId }
}

function askRevokeCredential() {
  if (!credentialToRevoke.value) return
  revokedMsg.value = ''
  revokeReason.value = ''
  pending.value = {
    kind: 'credential',
    target: credentialToRevoke.value.hash,
    label: credentialToRevoke.value.holderName,
  }
}

async function handleCredentialUpload(e: Event) {
  error.value = ''
  revokedMsg.value = ''
  credentialToRevoke.value = null
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    const data = JSON.parse(await file.text())
    const vc = data.vc || data
    const salt = data.salt || vc.proof?.salt || ''
    if (!salt) throw new Error('No salt found in this credential file.')
    // Read the holder's name from the credential type's own primary field.
    // Hardcoding studentName/degree showed every licence or workforce
    // credential as "Unknown graduate".
    const subject = vc.credentialSubject || {}
    const type = data.credentialType
      ? getCredentialType(data.credentialType)
      : inferCredentialType(subject) ?? getCredentialType(undefined)
    const detailField = type.fields.find((f) => f.key !== type.primaryField && f.type !== 'number')
    credentialToRevoke.value = {
      hash: await credentialHash(vc, salt),
      holderName: String(subject[type.primaryField] ?? '').trim() || 'Unnamed holder',
      detail: detailField ? String(subject[detailField.key] ?? '') : '',
    }
  } catch (err: any) {
    error.value = 'Could not read credential file: ' + (err?.message || String(err))
  }
}

async function handleRevoke() {
  const request = pending.value
  if (!request) return
  pending.value = null
  error.value = ''
  revokedMsg.value = ''
  revoking.value = true
  try {
    const account = issuerAccount.value.trim()
    const tx =
      request.kind === 'burn'
        ? { TransactionType: 'NFTokenBurn', Account: account, NFTokenID: request.target }
        : buildRevocationTx(account, request.target)

    if (devSeedMode) {
      const wallet = Wallet.fromSeed(issuerSeed.value)
      await withXrpl((client) => submitAndWait(client, wallet, tx))
    } else {
      const txid = await signViaXaman(tx)
      await withXrpl((client) => waitForValidatedTx(client, txid))
      closeXaman()
    }

    revokedMsg.value =
      request.kind === 'burn'
        ? `Anchor burned. Credentials anchored by NFT ${request.target} now verify as REVOKED.`
        : `Revocation published for ${request.label}. Their credential now verifies as REVOKED; the rest of the batch is unaffected.`
    credentialToRevoke.value = null
    await fetchNfts()
  } catch (e: any) {
    error.value = e?.message || String(e)
    closeXaman()
  } finally {
    revoking.value = false
  }
}

watch(issuerAccount, fetchNfts)
</script>
