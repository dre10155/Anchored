import { ref } from 'vue'
import { useXamanSign } from './useXamanSign'

const ACCOUNT_PATTERN = /^r[1-9A-HJ-NP-Za-km-z]{25,34}$/

function loadSaved(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem('anchored:issuers') || '[]')
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && ACCOUNT_PATTERN.test(item)) : []
  } catch {
    return []
  }
}

export function useIssuerAddress() {
  const address = ref('')
  const connectedViaXaman = ref(false)
  const saved = ref(loadSaved())
  const { xaman, cancel, close, signInViaXaman } = useXamanSign()

  function remember(value: string) {
    if (!ACCOUNT_PATTERN.test(value)) return
    saved.value = [value, ...saved.value.filter((item) => item !== value)].slice(0, 10)
    try { localStorage.setItem('anchored:issuers', JSON.stringify(saved.value)) } catch {}
  }

  function setManual(value: string) {
    address.value = value.trim()
    connectedViaXaman.value = false
    if (ACCOUNT_PATTERN.test(address.value)) remember(address.value)
  }

  async function connect() {
    const account = await signInViaXaman()
    address.value = account
    connectedViaXaman.value = true
    remember(account)
    return account
  }

  function disconnect() {
    address.value = ''
    connectedViaXaman.value = false
  }

  return { address, connectedViaXaman, saved, setManual, connect, disconnect, xaman, cancel, close }
}

export { ACCOUNT_PATTERN }