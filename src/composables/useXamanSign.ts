import { reactive } from 'vue'
import { createXamanPayload, waitForXamanSignature } from '../lib/xaman'

export type XamanStatus = 'pending' | 'signed' | 'rejected' | 'expired' | 'error'

/** Shared Xaman signing state + flow for any transaction (mint, burn, ...). */
export function useXamanSign() {
  const xaman = reactive({
    visible: false,
    qrPng: '',
    deeplink: '',
    status: 'pending' as XamanStatus,
    errorMessage: '',
    cancelled: false,
  })

  function cancel() {
    xaman.cancelled = true
    xaman.visible = false
  }

  function close() {
    xaman.visible = false
  }

  /** Show the QR modal, wait for the user to sign in Xaman, return the txid. */
  async function signViaXaman(tx: Record<string, any>): Promise<string> {
    xaman.cancelled = false
    xaman.status = 'pending'
    xaman.errorMessage = ''
    xaman.qrPng = ''
    xaman.visible = true

    const payload = await createXamanPayload(tx)
    xaman.qrPng = payload.qrPng
    xaman.deeplink = payload.deeplink

    const resolution = await waitForXamanSignature(payload.uuid)
    if (xaman.cancelled) throw new Error('Signing cancelled.')

    if (resolution.cancelled) {
      xaman.status = 'rejected'
      throw new Error('Signature was rejected in Xaman.')
    }
    if (resolution.expired) {
      xaman.status = 'expired'
      throw new Error('The sign request expired before it was signed.')
    }
    if (!resolution.signed || !resolution.txid) {
      xaman.status = 'error'
      xaman.errorMessage = 'Xaman did not return a signed transaction.'
      throw new Error(xaman.errorMessage)
    }

    xaman.status = 'signed'
    return resolution.txid
  }

  /** Prove control of a wallet without creating a ledger transaction. */
  async function signInViaXaman(): Promise<string> {
    xaman.cancelled = false
    xaman.status = 'pending'
    xaman.errorMessage = ''
    xaman.qrPng = ''
    xaman.visible = true

    const payload = await createXamanPayload({ TransactionType: 'SignIn' })
    xaman.qrPng = payload.qrPng
    xaman.deeplink = payload.deeplink

    const resolution = await waitForXamanSignature(payload.uuid)
    if (xaman.cancelled) throw new Error('Sign-in cancelled.')
    if (resolution.cancelled) {
      xaman.status = 'rejected'
      throw new Error('Sign-in was rejected in Xaman.')
    }
    if (resolution.expired) {
      xaman.status = 'expired'
      throw new Error('The sign-in request expired before it was completed.')
    }
    if (!resolution.signed || !resolution.account) {
      xaman.status = 'error'
      xaman.errorMessage = 'Xaman did not return a wallet address.'
      throw new Error(xaman.errorMessage)
    }

    xaman.status = 'signed'
    return resolution.account
  }

  return { xaman, cancel, close, signViaXaman, signInViaXaman }
}
