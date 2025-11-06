#!/usr/bin/env node
// 文件路径: tools/scripts/generate-encryption-key.js
// 职责: 生成用于 API 密钥加密的加密密钥
//
// 使用方法:
//   pnpm tools:generate-encryption-key
//
// 输出: base64 编码的 32 字节密钥（可以直接用作 ENCRYPTION_KEY 环境变量）

const crypto = require('crypto');

// 生成 32 字节随机密钥
const key = crypto.randomBytes(32);

// 转换为 base64 编码
const base64Key = key.toString('base64');

console.log('🔑 Generated Encryption Key:');
console.log('');
console.log(base64Key);
console.log('');
console.log('📝 Add this to your .env file as:');
console.log(`ENCRYPTION_KEY=${base64Key}`);
console.log('');
console.log('⚠️  Important:');
console.log('   - Keep this key secure and never commit it to version control');
console.log('   - Back up this key in a secure location (e.g., password manager)');
console.log('   - If you lose this key, you cannot decrypt existing encrypted data');
console.log('');
console.log('💡 Recommendation:');
console.log('   - Use ENCRYPTION_USE_SALT=true for better security');
console.log('   - Consider using a key management service (AWS KMS, HashiCorp Vault)');
