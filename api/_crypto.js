const { createCipheriv, createDecipheriv, randomBytes } = require('crypto')

// Sem fallback: uma chave conhecida cifraria tokens OAuth de calendário de
// forma trivialmente reversível por qualquer um com leitura no banco.
// Falha alto (throw), não silenciosamente inseguro.
const KEY_HEX = process.env.ENCRYPTION_KEY
if (!KEY_HEX) throw new Error('ENCRYPTION_KEY não configurada — obrigatória para cifrar tokens OAuth de calendário')
const KEY = Buffer.from(KEY_HEX.slice(0, 64), 'hex')

function encrypt(text) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', KEY, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

function decrypt(data) {
  if (!data) return ''
  const buf = Buffer.from(data, 'base64')
  const iv = buf.slice(0, 12)
  const tag = buf.slice(12, 28)
  const encrypted = buf.slice(28)
  const decipher = createDecipheriv('aes-256-gcm', KEY, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

module.exports = { encrypt, decrypt }
