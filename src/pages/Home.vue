<template>
  <div class="min-h-screen pt-20">
    <section class="relative py-16 sm:py-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <div class="absolute inset-0 bg-gradient-to-br from-brand-black via-gray-900 to-brand-black"></div>

      <div class="absolute inset-0">
        <div class="absolute top-0 right-1/3 w-96 h-96 bg-primary-blue rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob"></div>
        <div class="absolute bottom-0 left-1/3 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000"></div>
      </div>

      <div class="max-w-4xl mx-auto relative z-10 text-center">
        <h1 class="text-4xl md:text-6xl font-bold text-white mb-6">
          Every diploma, <span class="text-primary-blue">anchored.</span>
        </h1>
        <p class="text-xl text-gray-300 max-w-2xl mx-auto mb-4">
          Credential fraud costs the United States billions and puts patients, employers,
          and institutions at risk. Anchored makes a diploma as verifiable as a blockchain
          transaction — because it is one.
        </p>
        <p class="text-gray-400 max-w-2xl mx-auto mb-10">
          Institutions anchor a salted fingerprint of each credential on the XRP Ledger.
          Anyone can verify it in seconds — no phone calls, no fees, no forgeries.
        </p>
        <div class="flex gap-4 justify-center">
          <router-link to="/issue" class="px-8 py-3 bg-primary-blue text-white rounded-lg hover:bg-blue-700 transition-all duration-200 font-medium shadow-lg shadow-blue-500/30">
            Issue Credentials
          </router-link>
          <router-link to="/verify" class="px-8 py-3 bg-white text-brand-black rounded-lg hover:bg-gray-50 transition-all duration-200 font-medium shadow-lg">
            Verify a Diploma
          </router-link>
        </div>

        <div class="grid md:grid-cols-3 gap-6 mt-20 text-left">
          <div class="bg-white/5 border border-white/10 rounded-xl p-6">
            <div class="text-primary-blue font-bold text-lg mb-2">Tamper-proof</div>
            <p class="text-gray-400 text-sm">
              A salted SHA-256 hash of each credential is minted into an NFT from the
              institution's wallet. Alter one character and verification fails.
            </p>
          </div>
          <div class="bg-white/5 border border-white/10 rounded-xl p-6">
            <div class="text-primary-blue font-bold text-lg mb-2">Private by design</div>
            <p class="text-gray-400 text-sm">
              Student data never touches the ledger — only a cryptographic fingerprint.
              The graduate holds the credential; the chain holds the proof.
            </p>
          </div>
          <div class="bg-white/5 border border-white/10 rounded-xl p-6">
            <div class="text-primary-blue font-bold text-lg mb-2">Seconds, not weeks</div>
            <p class="text-gray-400 text-sm">
              Verification is a QR scan or file upload against the public ledger —
              3–5 second finality at a fraction of a cent per credential.
            </p>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
