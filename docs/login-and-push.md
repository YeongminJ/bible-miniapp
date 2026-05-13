# 토스 로그인 + 푸시 알림 통합 가이드

bible-mini 미니앱의 로그인·푸시 알림 시스템 전체 정리.
**클라이언트(React + 앱인토스 SDK)** + **서버(Cloudflare Workers + D1)** + **토스 API(mTLS OAuth + 스마트 발송)** 3단 구성.

---

## 1. 전체 흐름

```
[사용자 폰]                       [클라 미니앱]                [Cloudflare Worker]                [토스 API]
   │                                  │                            │                                │
   │ ① 미니앱 진입 (첫 실행)           │                            │                                │
   ├────────────────────────────────→ │                            │                                │
   │                                  │ getAnonymousKey()           │                                │
   │                                  │ → hash 발급 (localStorage 캐시)                              │
   │                                  │                            │                                │
   │ ② OnboardingSheet                │                            │                                │
   │    "오늘의 말씀" 기능 안내         │                            │                                │
   │    알림 토글 (디폴트 ON)          │                            │                                │
   │    시간 선택 (10:00, 20:00 디폴트) │                            │                                │
   │                                  │                            │                                │
   │ ③ "시작하기" 버튼 클릭            │                            │                                │
   │ ───────────────────────────────→ │                            │                                │
   │                                  │ POST /api/auth/migration/status               │              │
   │                                  │ { hash } ─────────────────→│                                │
   │                                  │                            │ DB 조회 → toss_user_key NULL    │
   │                                  │ ← { isMapped: false }      │                                │
   │                                  │                            │                                │
   │                                  │ appLogin() 호출 (SDK)        │                                │
   │ ← 토스 로그인 동의 화면           │                            │                                │
   │ ── "동의" ─────────────────────→ │                            │                                │
   │                                  │ ← { authorizationCode,     │                                │
   │                                  │     referrer }             │                                │
   │                                  │                            │                                │
   │                                  │ POST /api/auth/migration/link                                 │
   │                                  │ { hash, authorizationCode, │                                │
   │                                  │   referrer } ──────────────→                                │
   │                                  │                            │ ① mTLS POST /generate-token    │
   │                                  │                            │ ────────────────────────────→ │
   │                                  │                            │ ← { success: { accessToken } } │
   │                                  │                            │                                │
   │                                  │                            │ ② mTLS GET /login-me           │
   │                                  │                            │   Bearer {accessToken}         │
   │                                  │                            │ ────────────────────────────→ │
   │                                  │                            │ ← { success: { userKey } }     │
   │                                  │                            │                                │
   │                                  │                            │ DB upsert:                     │
   │                                  │                            │  users.toss_user_key = userKey │
   │                                  │ ← { success: true }        │                                │
   │                                  │                            │                                │
   │                                  │ POST /api/users             │                                │
   │                                  │ { userKey: hash,           │                                │
   │                                  │   reminderMinute } ────────→│                                │
   │                                  │                            │ DB upsert: reminder_minute      │
   │                                  │ ← { ok: true }             │                                │
   │                                  │                            │                                │
   │ ④ 매일 정해진 시각 (예: 10:00 KST)│                            │                                │
   │                                  │                            │ ⏰ Cron 매분 실행                │
   │                                  │                            │ KST 600분 == reminder_minute    │
   │                                  │                            │ → 발송 후보 선정                │
   │                                  │                            │ → toss_user_key로 sendMessage   │
   │                                  │                            │ ────────────────────────────→ │
   │                                  │                            │   POST /messenger/send-message │
   │                                  │                            │   x-toss-user-key: 344387236   │
   │                                  │                            │   { templateSetCode,           │
   │                                  │                            │     context: { streak } }      │
   │                                  │                            │ ← { resultType: "SUCCESS" }    │
   │                                  │                            │                                │
   │ 📱 토스앱 푸시 도착                                                                              │
   │ ← "오늘 받기로 한 구절이 왔어요"                                                                 │
```

---

## 2. 핵심 키 두 종류

| | `hash` (anonymousKey) | `tossUserKey` |
|---|---|---|
| 발급 방법 | `getAnonymousKey()` SDK | 토스 OAuth (`appLogin` → `/oauth2/login-me`) |
| 용도 | **클라 식별** (모든 데이터 키) | **푸시 라우팅** (`x-toss-user-key` 헤더) |
| 라우팅 가능? | ❌ "내부 식별용 키"라 토스 서버에 직접 요청 불가 | ✅ |
| 저장 위치 | localStorage (`anonymousKey.v1`) + D1 `users.user_key` | D1 `users.toss_user_key` |

→ **클라는 hash만 알면 됨**. 매핑은 서버 `users` 테이블 한 컬럼이 관리.

---

## 3. 서버 구성

### 3.1 Cloudflare Workers
- **Worker**: `bible-mini-noti-api` (`https://bible-mini-noti-api.hohostd.workers.dev`)
- **D1 Database**: `bible-mini-noti-db` (`f6ffebc0-96d4-48d4-b5f0-fab3a85247e6`)
- **mTLS Certificate**: `e5306fb5-ff9b-4413-b48f-e9f0c03e00c7` (`bible-mini-toss`, 만료 2027-05-26)
- **Cron**: `* * * * *` (매 분, KST 분 매칭)

### 3.2 환경변수 (`server/wrangler.toml`)
```toml
[vars]
TOSS_MODE = "real"                                  # mock | real
TOSS_TEMPLATE_DAILY = "bible-mini-daily-noti"       # 콘솔 승인 템플릿 코드
TOSS_TEMPLATE_STREAK_WARN = ""                      # 미사용 (캠페인 미등록)
```

### 3.3 D1 스키마 (`server/src/db/schema.ts`)

v0.3에서 다중 reminder 지원 추가 — 사용자 한 명이 여러 시각(예: 10:00 + 20:00)을 등록할 수 있음.

```sql
CREATE TABLE users (
  user_key             TEXT PRIMARY KEY,         -- 클라 hash
  toss_user_key        TEXT,                     -- 토스 OAuth userKey (NULL이면 푸시 라우팅 불가)
  reminder_minute      INTEGER,                   -- @deprecated (v0.x 호환용, 현재 코드 미사용)
  daily_enabled        INTEGER NOT NULL DEFAULT 1,
  streak_warn_enabled  INTEGER NOT NULL DEFAULT 1,
  last_played_at       INTEGER,                   -- 마지막 플레이 epoch ms
  current_streak       INTEGER NOT NULL DEFAULT 0,
  timezone             TEXT NOT NULL DEFAULT 'Asia/Seoul',
  created_at           INTEGER NOT NULL,
  updated_at           INTEGER NOT NULL
);
CREATE INDEX users_toss_user_key_idx ON users (toss_user_key);

-- v0.3 추가: 사용자당 다중 reminder 시각
CREATE TABLE user_reminders (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_key    TEXT NOT NULL,
  minute      INTEGER NOT NULL,                   -- KST 분 (0~1439), 600=10:00, 1200=20:00
  created_at  INTEGER NOT NULL
);
CREATE UNIQUE INDEX user_reminders_user_minute_uniq ON user_reminders (user_key, minute);
CREATE INDEX user_reminders_minute_idx ON user_reminders (minute);  -- cron WHERE minute=? 빠른 lookup

CREATE TABLE notifications (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_key  TEXT NOT NULL,
  date      TEXT NOT NULL,                        -- KST 'YYYY-MM-DD'
  type      TEXT NOT NULL,                        -- 'daily' | 'streak_warn'
  status    TEXT NOT NULL,                        -- 'sent' | 'failed' | 'skipped'
  sent_at   INTEGER NOT NULL,
  error     TEXT,
  minute    INTEGER                                -- v0.3 추가. 발송된 reminder의 분. 레거시 row는 NULL
);
CREATE UNIQUE INDEX notifications_user_date_type_minute ON notifications (user_key, date, type, minute);
```

**중요 동작 메모**:
- `users.reminder_minute`은 더 이상 cron이 읽지 않음. v0.3 코드는 `user_reminders` 테이블을 JOIN.
- `users.reminder_minute`은 호환성을 위해 남겨두되 `/api/users` POST 시 첫 reminder를 미러링 (다른 도구에서 단일 값으로 읽고 싶을 때 대응).
- `notifications.minute`이 unique key의 일부 → 같은 날 사용자가 등록한 여러 시각마다 1건씩 sent 기록 가능. SQLite에서 NULL은 unique 제약상 distinct이므로 v0.x 레거시 row(minute=NULL)는 새 row와 충돌하지 않음.

### 3.4 API 엔드포인트

| Method   | Path                          | 용도 |
| -------- | ----------------------------- | ---- |
| `POST`   | `/api/auth/migration/status`  | hash로 매핑 여부 조회 → `{ isMapped }` |
| `POST`   | `/api/auth/migration/link`    | 인가코드 → mTLS OAuth 2단계 → `toss_user_key` 저장 |
| `POST`   | `/api/users`                  | 사용자 upsert + reminder 교체 (`{ userKey, reminders: number[] }`). `user_reminders`를 받은 배열로 replace-all. 빈 배열이면 모든 알림 비활성. `reminderMinute`(단일)도 호환성 유지. |
| `PATCH`  | `/api/users/:hash/play`       | 플레이 기록 (스트릭 갱신) |
| `DELETE` | `/api/users`                  | 구독 해지 (사용자 + reminders + 발송이력 모두 삭제) |
| `GET`    | `/api/users/:hash`            | 디버그용 사용자 조회 (응답에 `reminders: number[]` 포함) |
| `GET`    | `/api/health`                 | 헬스체크 |

`/migration/exchange` 도 호환성을 위해 유지하지만 신규 흐름은 `/migration/link` 사용.

### 3.5 Cron 로직 (`server/src/cron/tick.ts`)

매 분 실행:
1. `user_reminders` 중 `minute == 현재 KST 분`인 row를 `users` JOIN으로 조회 (한 사용자가 같은 분에 중복 등록 불가능 → 각 row는 1:1로 사용자 후보)
2. **`toss_user_key`가 NULL이면 skip** (라우팅 불가)
3. `last_played_at` 의 KST 날짜 == 오늘이면 skip (이미 플레이)
4. 어제 플레이 + `streak > 0` 이면 `streak_warn` 타입, 아니면 `daily` 타입
5. `notifications` 에 같은 (사용자, 오늘 KST 날짜, 타입, **minute**)으로 `sent` 있으면 skip
6. mTLS로 토스 `/messenger/send-message` 호출:
   ```
   POST /api-partner/v1/apps-in-toss/messenger/send-message
   x-toss-user-key: {tossUserKey}
   { "templateSetCode": "bible-mini-daily-noti",
     "context": { "streak": 7 } }
   ```
7. 결과를 `notifications` 에 `sent` / `failed` 로 기록 (minute 컬럼에 발화 분 저장)

> **다중 reminder 동작**: 사용자가 [10:00, 20:00] 등록 시 cron은 10:00 KST에 1번, 20:00 KST에 또 1번 발화. 각각 다른 (date, type, minute) 키로 dedup. 사용자가 10:00 발화 후 플레이를 마치고 20:00 cron이 돌 때는 `last_played_at == 오늘`이라 skip.

---

## 4. 토스 OAuth 2단계 교환 (`server/src/routes/auth.ts`)

### Step 1: `generate-token`
```
POST /api-partner/v1/apps-in-toss/user/oauth2/generate-token
mTLS (Cloudflare cert binding)
{ "authorizationCode": "...", "referrer": "DEFAULT" }
↓
{ "resultType": "SUCCESS",
  "success": {
    "accessToken": "eyJ...",
    "refreshToken": "...",
    "scope": "user_name",
    "expiresIn": 3599 } }
```
> 응답 필드는 **`success`** (구 문서에 표기된 `result`가 아님).

### Step 2: `login-me`
```
GET /api-partner/v1/apps-in-toss/user/oauth2/login-me
mTLS + Authorization: Bearer {accessToken}
↓
{ "resultType": "SUCCESS",
  "success": {
    "userKey": 344387236,
    "scope": "...",
    "agreedTerms": [...] } }
```
- `userKey` 는 number — 우리는 `String(userKey)` 로 저장
- 콘솔 동의 항목에 `user_key` 가 명시적으로 없어도 login-me는 항상 userKey 반환

---

## 5. 클라이언트 구성

### 5.1 핵심 모듈
- [`src/lib/user-key.ts`](../src/lib/user-key.ts) — `ensureUserKey()` (anonymousKey 캐시)
- [`src/lib/notify-settings.ts`](../src/lib/notify-settings.ts) — 알림 설정 localStorage (`notifySettings.v1`)
- [`src/lib/notify-api.ts`](../src/lib/notify-api.ts) — 서버 호출 + `ensureMapped(hash)` 헬퍼
- [`src/lib/mapping-cache.ts`](../src/lib/mapping-cache.ts) — `mappingVerified.v1` localStorage 플래그
- [`src/lib/onboarding.ts`](../src/lib/onboarding.ts) — `onboarded.v1` 플래그
- [`src/components/OnboardingSheet.tsx`](../src/components/OnboardingSheet.tsx) — 첫 진입 시트(+ recovery 모드)
- [`src/components/NotifySettingsModal.tsx`](../src/components/NotifySettingsModal.tsx) — 알림 설정 변경 시트

### 5.2 `ensureMapped(hash)` 호출 시점
- **OnboardingSheet "시작하기" / "알림 다시 연결하기"** 클릭 시 1회 → `appLogin()` 트리거
- **NotifySettingsModal 토글**에서는 **호출 안 함** (사용자 의도 없는 OAuth 화면 방지)
  - 매핑 안된 사용자는 토글 ON 해도 `toss_user_key=NULL` 상태라 cron에서 skip
  - 매핑 복구가 필요한 케이스는 **§5.5 자동 복구 흐름**에서 별도 처리

### 5.3 동시 호출 보호
`ensureMapped` 안에 **mutex(`_mappingInflight`)** 가 있어 같은 시점에 두 번 호출돼도 `appLogin()` 화면이 두 번 뜨지 않음.

### 5.4 매핑 검증 캐시 (`mappingVerified.v1`)
서버에서 한 번 `isMapped=true`로 확인되거나 `createMapping`이 성공하면 `localStorage.mappingVerified.v1 = "1"`. 다음 세션부터는 매핑 상태 체크 자체를 skip해서 불필요한 네트워크 호출 0회.

설정/해제 위치:
- **설정**: `checkMappingStatus(hash)` 가 `isMapped=true` 응답 받았을 때, 또는 `createMapping(...)` 성공 직후
- **해제**: `unsubscribeNotify(...)` 가 200 응답 받았을 때 (다시 구독 시 재인증 필요)

### 5.5 자동 복구 흐름 (broken state recovery)

**문제**: 기존 유저가 OAuth 매핑 코드 추가 *전*에 온보딩을 끝냈거나 `appLogin()`이 silently 실패했던 경우 → `users.toss_user_key`가 NULL로 고립. 이후엔 `OnboardingSheet`도 안 뜨므로 `ensureMapped()`도 호출되지 않아 영영 매핑 안 됨.

**감지 조건** (App.tsx 마운트 시 1회):
1. `hasOnboarded() === true` (온보딩은 끝남)
2. `isMappingVerified() === false` (검증 캐시 없음)
3. `loadNotifySettings().enabled === true` (알림 받기로 한 의사 있음)
4. `checkMappingStatus(hash)` 가 `{ ok: true, isMapped: false }` 명확한 응답 (네트워크 오류 ≠ 미매핑)

**복구 동작**:
1. `resetOnboarded()` → `onboarded.v1` 플래그 제거
2. `setOnboardingMode("recovery")` + `setShowOnboarding(true)` → OnboardingSheet 다시 표시
3. recovery 모드에서는 노란 배너 ("🔔 알림 연결을 마무리해 주세요") + 기능 소개 리스트 숨김 + 버튼 텍스트가 "알림 다시 연결하기" / "알림 끄기"
4. 사용자 탭 → `ensureMapped()` → `appLogin()` (이미 동의한 사용자면 silent로 인가코드 발급) → `createMapping()` → 서버에 `toss_user_key` 저장 + `mappingVerified.v1` 캐시
5. 다음 세션부터 자동 복구 체크는 skip

**중요: 복구는 한 세션에 한 번만**

[`App.tsx`](../src/App.tsx)의 `recoveryCheckedRef` ref가드가 있어 useEffect 의존성 변경(예: `showOnboarding` 토글)으로 재실행되어도 복구 로직은 다시 실행되지 않음. 이 가드가 없으면 사용자가 "알림 다시 연결하기" 탭하는 즉시 `onDone()` → `showOnboarding=false` → useEffect 재실행 → `checkMappingStatus`가 아직 매핑 진행 중이라 또 `{isMapped:false}` 응답 → 다시 `setShowOnboarding(true)` 무한 루프 발생.

**증상**: 사용자가 "2-3회 탭해야 진입됨" / "토스 로그인 화면이 안 뜸" — 이는 루프 도중 `appLogin()`이 다른 마운트 사이클로 가려진 것.

**네트워크 오류 안전장치**: `checkMappingStatus`가 `{ ok: false }` 반환(서버 타임아웃/오프라인 등)하면 절대 `resetOnboarded()` 호출 안 함. 비행기/지하철 환경에서 멀쩡한 유저를 잘못 reset하는 사고 방지.

---

## 5.6 사용자 이름 (`name`) — 암호화된 PII 처리

**현 상태**: login-me 응답의 `name` 필드는 **AES-256-GCM 암호문(base64)** 으로 반환됨. 서버는 이를 평문화할 복호화 키가 없으므로 **저장하지 않음** ([server/src/routes/auth.ts](../server/src/routes/auth.ts) 의 `exchangeWithToss` 참조). 클라 공유 메시지는 항상 fallback 텍스트 사용 중.

**이전 사고**: 클라 캐시 v1(`userName.v1`)에 암호문이 저장돼 공유 시 `LVeEJz26xKXmkrklPGrxWWImYGdLIjAg5hbd2uyfugEWxX/D8g==님과 가장 닮은 성경 인물은…` 처럼 gibberish가 노출됐었음. 캐시 키를 `userName.v2`로 bump + DB의 `users.name` 컬럼 wipe로 해결.

**복호화를 활성화하려면** (운영 작업):

1. 토스 콘솔 → 토스로 로그인 메뉴 → **복호화 키 + AAD 신청** → 이메일로 수령
2. Worker secret 등록:
   ```bash
   cd server
   npx wrangler secret put TOSS_LOGIN_DECRYPT_KEY
   npx wrangler secret put TOSS_LOGIN_DECRYPT_AAD
   ```
3. `server/src/env.ts`에 두 시크릿 타입 추가
4. `server/src/lib/decrypt.ts` 생성 — AES-256-GCM 복호화 함수 (Web Crypto API 기반):
   - 입력: base64 ciphertext, key (base64 디코드된 32바이트), AAD (string → bytes)
   - 처리: ciphertext의 앞 12바이트 = IV, 뒤가 ciphertext+tag (마지막 16바이트가 GCM tag)
   - 출력: 평문 string (UTF-8)
5. [`server/src/routes/auth.ts`](../server/src/routes/auth.ts) `exchangeWithToss` 의 주석 처리된 부분 활성화 → `decrypt(meData.success?.name, env.TOSS_LOGIN_DECRYPT_KEY, env.TOSS_LOGIN_DECRYPT_AAD)` 호출 → 결과를 `name`으로 반환
6. DB users.name 컬럼은 자동으로 평문 채워짐 (다음 신규 매핑부터)
7. 기존 매핑 사용자는 [src/lib/notify-api.ts](../src/lib/notify-api.ts) 의 `ensureUserName()` 가 silent appLogin → backfill로 자동 복구

> Toss SDK는 클라용 `tosscertEncrypt` 도 제공하지만 그건 본인확인(tosscert) 용이지 OAuth login-me PII 복호화와는 다른 기능. 반드시 서버에서 콘솔 발급 키로 풀어야 함.

---

## 6. 토스 콘솔 설정 체크리스트

- ✅ **mTLS 인증서 발급** (콘솔에서 다운로드 → `wrangler mtls-certificate upload`)
- ✅ **토스 로그인 약관 동의** (대표 관리자) + 동의 항목 최소 1개 체크 (예: `user_name`)
- ✅ **스마트 발송 캠페인 등록**
  - 캠페인 유형: **기능성**
  - 발송 코드 (templateSetCode): `bible-mini-daily-noti`
  - 메시지: 사실 전달형 (제목 7자/본문 25자 이내)
    - 제목: `오늘의 말씀`
    - 본문: `오늘 받기로 한 구절이 왔어요.`
  - 검수 신청 → 영업일 2~3일 후 승인

> **검수 통과 팁**: "포인트 드려요", "지금 풀어보세요", "혜택 놓치지 마세요" 같은 유도/혜택 표현은 광고성으로 분류돼 기능성 검수 거절. 사용자가 본인이 신청한 알림 시간에 사실만 전달하는 톤이 통과 가능성 높음.

---

## 7. 운영 명령어

### 셋업 (최초 1회)
```bash
cd server
npm install
npx wrangler login
npx wrangler d1 create bible-mini-noti-db          # database_id를 wrangler.toml에 입력
npx wrangler mtls-certificate upload \              # certificate_id를 wrangler.toml에 입력
  --cert ~/Downloads/bible_mTls/bible-mTls_public.crt \
  --key ~/Downloads/bible_mTls/bible-mTls_private.key \
  --name bible-mini-toss
npm run db:migrate:remote
npm run deploy
```

### 일상 운영
```bash
cd server

# 실시간 로그
npx wrangler tail

# DB 조회
npx wrangler d1 execute bible-mini-noti-db --remote \
  --command "SELECT user_key, toss_user_key, reminder_minute FROM users LIMIT 10"

npx wrangler d1 execute bible-mini-noti-db --remote \
  --command "SELECT * FROM notifications ORDER BY sent_at DESC LIMIT 20"

# 코드 수정 후 배포
npm run deploy
```

### 로컬 개발
```bash
# 서버
cd server
npm run dev                                          # localhost:8787
npm run dev:scheduled                                # cron 트리거 테스트

# 클라
cd ..
npm run dev                                          # vite + Metro (8081, 5173)
```

### 미니앱 빌드/배포
```bash
# 프로젝트 루트
npm run build                                        # bible-mini.ait 생성
npm run deploy                                       # 콘솔에 업로드 → deploymentId 발급
```
샌드박스/토스앱에서 진입 스킴: `intoss-private://bible-mini?_deploymentId=<id>`

---

## 8. 트러블슈팅

| 증상 | 원인 | 해결 |
|---|---|---|
| `[toss-oauth] generate-token failed` `error: invalid_grant` | 인가코드 만료(10분) 또는 재사용 | 사용자가 OAuth 다시 받도록 — `appLogin()` 한 번만 호출되게 mutex 확인 |
| `[toss-oauth] login-me failed` `userKey == null` | scope에 `user_key` 미포함 | 토스앱 설정 → 토스로 로그인한 서비스 → 미니앱 연결 끊기 후 재시도 |
| 푸시 안 옴 | `toss_user_key` NULL | 사용자가 OnboardingSheet 단계에서 OAuth 동의 안 한 상태. 디버그 화면 또는 D1 직접 갱신으로 강제 매핑 가능 |
| 푸시 안 옴 | `TOSS_MODE = "mock"` | wrangler.toml에서 `real` 로 변경 + 재배포 |
| 푸시 안 옴 | 같은 (사용자, 날짜, 타입) 이미 sent | `notifications` 테이블에 sent 기록 있음 — 중복 방지로 skip. 하루 1번만 발송 정상 |
| `toss_oauth_failed` (이전 코드) | 응답 필드 `result` ↔ `success` 차이, login-me 단계 누락 | 현재 코드는 수정 완료. 옛 빌드면 재배포 |
| 기존 유저 푸시 안 옴 (`toss_user_key` NULL) | OAuth 매핑 추가 *전*에 온보딩 완료 / `appLogin()` silent 실패 | §5.5 자동 복구 흐름이 다음 진입 시 OnboardingSheet(recovery 모드)로 띄워 재매핑 유도. 즉시 강제 복구하려면 `localStorage.removeItem("onboarded.v1"); localStorage.removeItem("mappingVerified.v1")` 후 앱 재진입 |
| Recovery 온보딩이 무한히 다시 뜸 | 복구 useEffect의 deps가 `[showOnboarding]`이라 onDone 후 재실행되며 매핑이 아직 진행 중일 때 또 `isMapped:false` 응답 → reset 반복 | `recoveryCheckedRef` ref 가드가 한 세션 1회만 실행되도록 막음. 옛 빌드면 재배포 (deploymentId ≥ `019e0a33-ad0d-7b4c-bfc1-5493bcd148ea`) |
| Recovery 모드에서 `appLogin()` UI 안 뜸 | 토스가 이미 동의한 사용자의 인가코드를 silent하게 발급 (정상 동작) | 매핑이 silent하게 완료된 것 — `users.toss_user_key`가 채워졌는지 D1 조회로 확인 |

---

## 9. 검증 절차 (테스트 발송)

```bash
cd server

# 1) 테스트 사용자가 매핑돼있는지 확인
npx wrangler d1 execute bible-mini-noti-db --remote \
  --command "SELECT user_key, toss_user_key, reminder_minute FROM users WHERE toss_user_key IS NOT NULL"

# 2) reminder_minute을 +2분으로 설정
KST_HHMM=$(TZ=Asia/Seoul date +"%H %M")
H=$(echo $KST_HHMM | awk '{print $1}'); M=$(echo $KST_HHMM | awk '{print $2}')
TARGET=$(( (10#$H * 60 + 10#$M + 2) % 1440 ))
npx wrangler d1 execute bible-mini-noti-db --remote \
  --command "UPDATE users SET reminder_minute=$TARGET, last_played_at=NULL WHERE toss_user_key='344387236'; DELETE FROM notifications;"

# 3) 약 2~3분 대기 후 로그 확인
npx wrangler tail
# [tick] {"kstMinute":..., "candidateCount":1, "sendCount":1}
# (real) → POST /messenger/send-message 200 OK
# (mock) → [MockToss] sendMessage {...}

# 4) 폰 토스앱에 푸시 도착하는지 확인
# 5) reminder_minute 원래 값(예: 600=10:00)으로 복원
npx wrangler d1 execute bible-mini-noti-db --remote \
  --command "UPDATE users SET reminder_minute=600 WHERE toss_user_key='344387236'"
```

---

## 10. 보안 / 개인정보 메모

- **mTLS 인증 키 파일** (`bible-mTls_private.key`)는 절대 git에 올리지 않음. `~/Downloads/bible_mTls/` 또는 별도 secret store에 보관.
- **토스 응답 본문 로깅 주의** — `accessToken`, `refreshToken`, 사용자 PII (`name`, `phone`, `birthday`, `ci`) 가 포함될 수 있어 `JSON.stringify(meData)` 통째로 찍지 말 것. 현재 코드는 `error` 필드와 metadata 만 로깅.
- **`tossUserKey`는 토스 식별자**로 외부에 노출되면 안 됨. D1 격리 + `/api/users/:hash` 응답은 hash 기반 사용자 정보만.
- 사용자 옵트아웃: `DELETE /api/users` 호출 → `users` + `notifications` 모두 삭제. 클라에서는 NotifySettingsModal 토글 OFF로 트리거.
