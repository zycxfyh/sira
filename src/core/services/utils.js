const crypto = require('crypto')
const bcrypt = require('bcryptjs')

const config = require('../config')

function appendCreatedAt (obj) {
  Object.assign(obj, {
    createdAt: (new Date()).toString()
  })
}

function appendUpdatedAt (obj) {
  Object.assign(obj, {
    updatedAt: (new Date()).toString()
  })
}

function encrypt (text) {
  const { algorithm, cipherKey } = config.systemConfig.crypto
  const cipher = crypto.createCipheriv(algorithm, Buffer.from(cipherKey, 'hex'), null)
  return cipher.update(text, 'utf8', 'hex') + cipher.final('hex')
}

function decrypt (password) {
  const { algorithm, cipherKey } = config.systemConfig.crypto
  const decipher = crypto.createDecipheriv(algorithm, Buffer.from(cipherKey, 'hex'), null)
  return decipher.update(password, 'hex', 'utf8') + decipher.final('utf8')
}

function compareSaltAndHashed (password, hash) {
  return (!password || !hash) ? null : bcrypt.compare(password, hash)
}

function saltAndHash (password) {
  if (!password || typeof password !== 'string') {
    return Promise.reject(new Error('invalid arguments'))
  }

  return bcrypt
    .genSalt(config.systemConfig.crypto.saltRounds)
    .then((salt) => bcrypt.hash(password, salt))
}

module.exports = {
  appendCreatedAt,
  appendUpdatedAt,
  encrypt,
  decrypt,
  compareSaltAndHashed,
  saltAndHash
}
