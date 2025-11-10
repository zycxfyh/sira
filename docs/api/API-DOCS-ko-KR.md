# Sira API 문서

## 📋 개요

Sira 는 여러 AI 서비스 제공업체에서 지능형 라우팅과 통합 관리를 제공하는 통합 AI 서비스 API 인터페이스를 제공합니다.

**기본 URL**: `https://your-gateway-domain.com/api/v1/ai`

## 🔐 인증

모든 API 요청은 요청 헤더에 API 키를 포함해야 합니다:

```
X-API-Key: your_gateway_api_key
```

## 🚀 AI 채팅 완성

여러 AI 모델과 제공업체를 지원하는 AI 대화 응답을 생성합니다.

### 요청

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

### 매개변수

| 매개변수 | 유형 | 필수 | 설명 |
| -------------- | --------- | -------------- | ---------------- |
| `model` | string | 예 | AI모델 이름 |
| `messages` | array | 예 | 대화 메시지 배열 |
| `temperature` | number | 아니오 | 온도 매개변수 (0-2) |
| `max_tokens` | number | 아니오 | 최대 토큰 수 |
| `stream` | boolean | 아니오 | 응답을 스트리밍할지 여부 |

### 응답

#### 성공 응답

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

#### 오류 응답

```json
{
  "error": {
    "code": "invalid_request",
    "message": "잘못된 요청 매개변수",
    "details": {}
  }
}
```

## 📚 오류 코드

| 오류 코드 | 설명 |
| ---------------- | ---------------- |
| `invalid_request` | 요청 매개변수가 잘못됨 |
| `unauthorized` | 잘못된 API 키 |
| `rate_limited` | 요율 제한 초과 |
| `service_unavailable` | 서비스를 사용할 수 없음 |

## 🎯 예제

### 기본 대화

```bash
curl -X POST https://your-gateway-domain.com/api/v1/ai/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_gateway_api_key" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [
      {"role": "user", "content": "안녕하세요, 자신을 소개해 주세요"}
    ]
  }'
```

---

*마지막 업데이트: ${new Date().toISOString().split('T')[0]}*

*버전: 2.1.0-beta.1*
