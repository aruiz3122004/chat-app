import CryptoJS from 'crypto-js'

const SECRET_KEY = 'chat-secret-key-2024'

export const encryptMessage = (message: string): string => {
  return CryptoJS.AES.encrypt(message, SECRET_KEY).toString()
}

export const decryptMessage = (encrypted: string): string => {
  try {
    const bytes = CryptoJS.AES.decrypt(encrypted, SECRET_KEY)
    return bytes.toString(CryptoJS.enc.Utf8)
  } catch {
    return 'Mensaje no disponible'
  }
}