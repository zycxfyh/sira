# Sira API ドキュメント

## 📋 概要

Sira は、複数のAIサービスプロバイダー間でインテリジェントなルーティングと統合管理を提供する統一されたAIサービスAPIインターフェースを提供します。

**ベースURL**: `https://your-gateway-domain.com/api/v1/ai`

## 🔐 認証

すべてのAPIリクエストは、リクエストヘッダーにAPIキーを含める必要があります：

```
X-API-Key: your_gateway_api_key
```

## 🚀 AI Chat Completions

複数のAIモデルとプロバイダーをサポートするAI会話応答を生成します。

### リクエスト

```http
POST /api/v1/ai/chat/completions
Content-Type: application/json
X-API-Key: your_gateway_api_key

{
  "model": "gpt-3.5-turbo",
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful assistant."
    },
    {
      "role": "user",
      "content": "Hello, how are you?"
    }
  ],
  "temperature": 0.7,
  "max_tokens": 1000,
  "stream": false
}
```

### パラメータ

| パラメータ | タイプ | 必須 | 説明 |
| -------------- | --------- | -------------- | ---------------- |
| `model` | string | はい | AIモデル名 |
| `messages` | array | はい | 会話メッセージ配列 |
| `temperature` | number | いいえ | 温度パラメータ (0-2) |
| `max_tokens` | number | いいえ | 最大トークン数 |
| `stream` | boolean | いいえ | レスポンスをストリーミングするか |

### レスポンス

#### 成功レスポンス

```json
{
  "id": "chatcmpl-123456",
  "object": "chat.completion",
  "created": 1677652288,
  "model": "gpt-3.5-turbo",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! I'm doing well, thank you for asking. How can I help you today?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 13,
    "completion_tokens": 20,
    "total_tokens": 33
  },
  "provider": "openai"
}
```

#### エラーレスポンス

```json
{
  "error": {
    "code": "invalid_request",
    "message": "無効なリクエストパラメータ",
    "details": {}
  }
}
```

## 📚 エラーコード

| エラーコード | 説明 |
| ---------------- | ---------------- |
| `invalid_request` | リクエストパラメータが無効 |
| `unauthorized` | 無効なAPIキー |
| `rate_limited` | レート制限を超過 |
| `service_unavailable` | サービス利用不可 |

## 🎯 例

### 基本会話

```bash
curl -X POST https://your-gateway-domain.com/api/v1/ai/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_gateway_api_key" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [
      {"role": "user", "content": "こんにちは、あなた自身を紹介してください"}
    ]
  }'
```

---

*最終更新: ${new Date().toISOString().split('T')[0]}*

*バージョン: 2.1.0-beta.1*
