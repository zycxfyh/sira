# Sira API Dokumentation

## 📋 Übersicht

Sira bietet eine einheitliche AI-Service-API-Schnittstelle mit intelligentem Routing und einheitlicher Verwaltung über mehrere AI-Service-Anbieter.

**Basis-URL**: `https://your-gateway-domain.com/api/v1/ai`

## 🔐 Authentifizierung

Alle API-Anfragen erfordern einen API-Schlüssel im Anfrage-Header:

```
X-API-Key: your_gateway_api_key
```

## 🚀 AI Chat Completions

Generieren Sie KI-Konversationsantworten mit Unterstützung für mehrere KI-Modelle und Anbieter.

### Anfrage

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

### Parameter

| Parameter | Typ | Erforderlich | Beschreibung |
| -------------- | --------- | -------------- | ---------------- |
| `model` | string | Ja | AIModellname |
| `messages` | array | Ja | Konversationsnachrichten-Array |
| `temperature` | number | Nein | Temperaturparameter (0-2) |
| `max_tokens` | number | Nein | maximale Anzahl von Tokens |
| `stream` | boolean | Nein | ob die Antwort gestreamt werden soll |

### Antworten

#### Erfolgreiche Antwort

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

#### Fehlerantwort

```json
{
  "error": {
    "code": "invalid_request",
    "message": "Ungültige Anforderungsparameter",
    "details": {}
  }
}
```

## 📚 Fehlercodes

| Fehlercode | Beschreibung |
| ---------------- | ---------------- |
| `invalid_request` | Ungültige Anforderungsparameter |
| `unauthorized` | Ungültiger API-Schlüssel |
| `rate_limited` | Ratenlimit überschritten |
| `service_unavailable` | Service nicht verfügbar |

## 🎯 Beispiele

### Grundlegende Konversation

```bash
curl -X POST https://your-gateway-domain.com/api/v1/ai/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_gateway_api_key" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [
      {"role": "user", "content": "Hallo, bitte stellen Sie sich vor"}
    ]
  }'
```

---

*Zuletzt aktualisiert: ${new Date().toISOString().split('T')[0]}*

*Version: 2.1.0-beta.1*
