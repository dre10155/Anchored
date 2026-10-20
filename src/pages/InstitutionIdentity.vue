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
          <h1 class="text-4xl md:text-5xl font-bold text-white mb-4">Issuer Identity</h1>
          <p class="text-xl text-gray-300 max-w-2xl mx-auto">
            Bind your XRPL wallet to your domain so verifiers see
            <span class="text-green-400 font-medium">"issued by your-organisation.com"</span>
            instead of a wallet address
          </p>
        </div>

        <div class="bg-white rounded-xl shadow-xl p-5 sm:p-8 border border-gray-200">
          <div class="space-y-6">
            <div>
              <label class="block font-medium text-brand-black mb-2">Organisation Domain</label>
              <input v-model="domain" class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-blue focus:border-transparent transition-all font-mono" placeholder="credentials.your-organisation.com" />
            </div>
            <div>
              <label class="block font-medium text-brand-black mb-2">Issuing Wallet Address</label>
              <input v-model="account" class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-blue focus:border-transparent transition-all font-mono" placeholder="r..." />
            </div>
          </div>

          <div class="mt-8 space-y-6">
            <!-- Step 1 -->
            <div class="border border-gray-200 rounded-lg p-4 sm:p-6">
              <div class="font-bold text-brand-black mb-2">Step 1 — Publish your DID document</div>
              <p class="text-sm text-gray-600 mb-4">
                Download this file and host it on your website at
                <span class="font-mono bg-gray-100 px-2 py-1 rounded text-xs break-all">https://{{ domain || 'your-domain' }}/.well-known/did.json</span>.
                Only someone who controls your domain can do this — that's the point.
              </p>
              <button @click="downloadDidJson" :disabled="!ready" class="px-6 py-2 bg-primary-blue text-white rounded-lg hover:bg-blue-700 transition-all duration-200 font-medium text-sm disabled:bg-gray-400 disabled:cursor-not-allowed">
                Download did.json
              </button>
            </div>

            <!-- Step 2 -->
            <div class="border border-gray-200 rounded-lg p-4 sm:p-6">
              <div class="font-bold text-brand-black mb-2">Step 2 — Point your wallet at your domain</div>
              <p class="text-sm text-gray-600 mb-4">
                Sign one transaction setting your wallet's on-ledger <span class="font-mono text-xs">Domain</span> field.
                Only someone who controls the wallet can do this — closing the loop.
              </p>
              <button @click="signDomainSet" :disabled="!ready || signing" class="px-6 py-2 bg-primary-blue text-white rounded-lg hover:bg-blue-700 transition-all duration-200 font-medium text-sm disabled:bg-gray-400 disabled:cursor-not-allowed">
                {{ signing ? 'Waiting for signature…' : 'Sign with Xaman' }}
              </button>
              <span v-if="domainSetMsg" class="block sm:inline sm:ml-3 mt-2 sm:mt-0 text-sm text-green-700 font-medium">{{ domainSetMsg }}</span>
            </div>

            <!-- Step 3 -->
            <div class="border border-gray-200 rounded-lg p-4 sm:p-6">
              <div class="font-bold text-brand-black mb-2">Step 3 — Check your handshake</div>
              <p class="text-sm text-gray-600 mb-4">
                Once both are in place, verify the two-way binding.
              </p>
              <button @click="runCheck" :disabled="!ready || checking" class="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all duration-200 font-medium text-sm disabled:bg-gray-400 disabled:cursor-not-allowed">
                {{ checking ? 'Checking…' : 'Check Identity' }}
              </button>
              <div v-if="checkResult" class="mt-4 p-4 rounded-lg text-sm font-medium" :class="checkOk ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-amber-50 border border-amber-300 text-amber-700'">
                {{ checkResult }}
              </div>
            </div>
          </div>

          <div v-if="error" class="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p class="text-red-700 font-medium">{{ error }}</p>
          </div>
        </div>
      </div>
    </section>

    <XamanSignModal
      v-if="xaman.visible"
      title="Sign domain binding"
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
import { computed, ref } from 'vue'
import { Buffer } from 'buffer'
import { withXrpl, waitForValidatedTx } from '../lib/xrplClient'
import { makeDidDocument, checkDidListsAddress, decodeHexDomain } from '../lib/did'
import { useXamanSign } from '../composables/useXamanSign'
import XamanSignModal from '../components/XamanSignModal.vue'

const domain = ref('')
const account = ref('')
const signing = ref(false)
const checking = ref(false)
const domainSetMsg = ref('')
const checkResult = ref('')
const checkOk = ref(false)
const error = ref('')

const { xaman, cancel: cancelXamanSign, close: closeXaman, signViaXaman } = useXamanSign()

const ready = computed(() =>
  /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(domain.value.trim()) &&
  /^r[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(account.value.trim())
)

function downloadDidJson() {
  const doc = makeDidDocument(domain.value.trim(), account.value.trim())
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'did.json'
  a.click()
  URL.revokeObjectURL(a.href)
}

async function signDomainSet() {
  error.value = ''
  domainSetMsg.value = ''
  signing.value = true
  try {
    const tx = {
      TransactionType: 'AccountSet',
      Account: account.value.trim(),
      Domain: Buffer.from(domain.value.trim().toLowerCase()).toString('hex'),
    }
    const txid = await signViaXaman(tx)
    await withXrpl((client) => waitForValidatedTx(client, txid))
    closeXaman()
    domainSetMsg.value = 'Domain set on-ledger ✓'
  } catch (e: any) {
    error.value = e?.message || String(e)
    closeXaman()
  } finally {
    signing.value = false
  }
}

async function runCheck() {
  error.value = ''
  checkResult.value = ''
  checking.value = true
  try {
    const acct = account.value.trim()
    const claimed = domain.value.trim().toLowerCase()

    const onLedgerDomain = await withXrpl(async (client) => {
      const info = await client.request({ command: 'account_info', account: acct })
      return decodeHexDomain((info.result as any).account_data?.Domain)
    })
    const didCheck = await checkDidListsAddress(claimed, acct)

    const walletOk = onLedgerDomain === claimed
    const domainOk = Boolean(didCheck.ok && didCheck.listsAddress)

    if (walletOk && domainOk) {
      checkOk.value = true
      checkResult.value = `✅ Two-way handshake complete: ${claimed} lists this wallet, and the wallet points back at ${claimed}. Credentials will show "issued by ${claimed}".`
    } else {
      checkOk.value = false
      const parts: string[] = []
      if (!walletOk) parts.push(onLedgerDomain ? `wallet Domain is "${onLedgerDomain}", expected "${claimed}" (redo Step 2)` : 'wallet has no Domain set (do Step 2)')
      if (!domainOk) parts.push(didCheck.ok ? 'did.json found but does not list this wallet (check Step 1 file contents)' : `did.json not reachable: ${didCheck.error} (do Step 1)`)
      checkResult.value = `⚠️ Not yet verified: ${parts.join('; ')}.`
    }
  } catch (e: any) {
    error.value = e?.message || String(e)
  } finally {
    checking.value = false
  }
}
</script>
