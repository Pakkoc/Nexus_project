# 화폐 시스템 구현 계획 (Phase 2)

## 현재 구현 완료

### Phase 1: 기반 구축 ✅
- [x] SQL 스키마 (10~18번 파일)
- [x] Core 패키지: domain/, errors/, port/, functions/, service/
- [x] Infra: Repository 구현 (4개)
- [x] Infra: Container에 등록
- [x] Bot: currency.handler.ts
- [x] Bot: messageCreate, voiceStateUpdate 이벤트 연동

### Phase 2: 웹 대시보드 설정 ✅
- [x] 화폐 설정 페이지 (`/currency/settings`)
- [x] 화폐 규칙 페이지 (`/currency/rules`)
  - [x] 핫타임 설정
  - [x] 채널/역할별 배율
  - [x] 토피 차단 (채널/역할)

---

## 앞으로 구현할 기능

### Phase 3: `/내정보` 통합 명령어 (우선순위: 최상)

> **변경사항**: 기존 `/지갑`, `/랭킹` 명령어를 삭제하고 `/내정보` 명령어로 통합
> **이유**: 명령어가 많으면 사용자가 헷갈리고 관리가 어려움

#### 3-1. 명령어 개요

| 명령어 | 설명 |
|--------|------|
| `/내정보` | Canvas 이미지로 유저 종합 정보 표시 |
| `/내정보 @유저` | 다른 유저 정보 조회 |

#### 3-2. Canvas 이미지 표시 내용

```
┌─────────────────────────────────────────────────┐
│  [아바타]   닉네임                              │
│            📅 2025년 9월 14일 가입 | 출석 20회  │
│            상태메시지: 하나면 쪔찍기 1일차       │
│                                                 │
│  Voice Lv 17    |    Chat Lv 11                │
│                                                 │
│  [닉네임] 님의 서버구독: 없음 / PREMIUM 등      │
│                                                 │
│  ─────────────────────────────────────────────  │
│  보유자금                     소속 클랜         │
│  토피      15,103 🪙          X                │
│  루비      0 💎               없음             │
│                                                 │
│  ─────────────────────────────────────────────  │
│  [구독플랜] [디토뱅크] [경고: 0] [경고차감권: 0]│
│  [색상선택권: 0]                                │
└─────────────────────────────────────────────────┘
```

#### 3-3. 하단 인터랙션 (버튼/Select Menu)

| 컴포넌트 | 기능 |
|----------|------|
| 버튼: 경고차감권 사용 | 보유 시 경고 1회 차감 |
| Select Menu: 색상 변경 | 색상선택권 보유 시 닉네임 색상 변경 |

#### 3-4. 기술 스택

- **이미지 생성**: `@napi-rs/canvas` (Node.js Canvas 라이브러리)
- **폰트**: Pretendard 또는 Noto Sans KR
- **인터랙션**: Discord.js Button, StringSelectMenu

#### 3-5. 구현 파일

| 파일 | 작업 |
|------|------|
| `apps/bot/src/commands/my-info.ts` | `/내정보` 명령어 |
| `apps/bot/src/utils/canvas/profile-card.ts` | Canvas 이미지 생성 |
| `apps/bot/src/utils/canvas/fonts/` | 폰트 파일 |
| `apps/bot/src/commands/wallet.ts` | **삭제** |
| `apps/bot/src/commands/leaderboard.ts` | **삭제** |

#### 3-6. 필요한 데이터

| 데이터 | 출처 |
|--------|------|
| 닉네임, 아바타, 가입일 | Discord API (GuildMember) |
| 상태메시지 | Discord API (Presence) |
| Voice Lv, Chat Lv | XP 시스템 (xp_users 테이블) |
| 니트로 부스트 여부 | Discord API (GuildMember.premiumSince) |
| 토피/루비 잔액 | 화폐 시스템 (topy_wallets, ruby_wallets) |
| 구독플랜 | 추후 구현 (일단 "미등록") |
| 디토뱅크 | 추후 구현 (일단 "미등록") |
| 소속클랜 | 추후 구현 (일단 "미등록") |
| 경고 개수 | 추후 구현 (일단 0) |
| 경고차감권 | 추후 구현 (일단 0) |
| 색상선택권 | 추후 구현 (일단 0) |

#### 3-7. 웹 API (기존 유지)

| 라우트 | 메서드 | 설명 | 상태 |
|--------|--------|------|------|
| `/api/guilds/[guildId]/currency/wallets` | GET | 지갑 목록 (페이지네이션) | ✅ |
| `/api/guilds/[guildId]/currency/wallets/[userId]` | GET | 특정 유저 지갑 | ✅ |
| `/api/guilds/[guildId]/currency/leaderboard` | GET | 리더보드 | ✅ |

---

### Phase 4: 거래 기록 조회 (우선순위: 높음)

#### 4-1. 표시 방식
- `/내정보` 이미지에 "거래내역 보기" 버튼 추가
- 버튼 클릭 시 Embed로 최근 10건 표시

#### 4-2. 웹 API
| 라우트 | 메서드 | 설명 |
|--------|--------|------|
| `/api/guilds/[guildId]/currency/transactions` | GET | 거래 기록 목록 |

#### 4-3. 웹 페이지
- `apps/web/src/app/dashboard/[guildId]/currency/transactions/page.tsx`

---

### Phase 5: 유저 이체 (우선순위: 높음)

#### 5-1. 표시 방식
- `/내정보` 이미지에 "이체하기" 버튼 추가
- 버튼 클릭 시 Modal로 이체 정보 입력

#### 5-2. Core 서비스
```typescript
// packages/core/src/currency-system/service/currency.service.ts
async transfer(
  guildId: string,
  fromUserId: string,
  toUserId: string,
  amount: bigint
): Promise<Result<TransferResult, CurrencyError>>
```

#### 5-3. 구현 파일
| 파일 | 작업 |
|------|------|
| `packages/core/src/currency-system/functions/calculate-fee.ts` | 수수료 계산 함수 |
| `packages/core/src/currency-system/service/currency.service.ts` | transfer 메서드 추가 |

---

### Phase 6: 상점 시스템 (우선순위: 중간)

#### 6-1. 데이터베이스
```sql
-- sql/20_shop_items.sql
CREATE TABLE shop_items (
    id INT NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price BIGINT NOT NULL,
    currency_type ENUM('topy', 'ruby') NOT NULL,
    item_type ENUM('role', 'color', 'premium_room', 'random_box', 'warning_remove', 'custom') NOT NULL,
    duration_days INT NULL,  -- NULL이면 영구
    role_id VARCHAR(20) NULL,
    stock INT NULL,  -- NULL이면 무제한
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

-- sql/21_shop_purchases.sql (유저 아이템 보유량)
CREATE TABLE user_items (
    id BIGINT NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(20) NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    item_type ENUM('color', 'warning_remove', 'custom') NOT NULL,
    quantity INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_user_item (guild_id, user_id, item_type)
);
```

#### 6-2. 표시 방식
- `/상점` 명령어로 상점 목록 표시 (Embed + 버튼)
- 또는 `/내정보`에서 "상점" 버튼 추가

#### 6-3. 웹 페이지
- `apps/web/src/app/dashboard/[guildId]/currency/shop/page.tsx`

---

### Phase 7: 기타 활동 보상 (우선순위: 중간)

#### 7-1. 출석 보상
- `/내정보` 이미지에 "출석체크" 버튼 추가
- 24시간 쿨다운, 10토피 지급

#### 7-2. 데이터베이스
```sql
-- sql/22_daily_rewards.sql
CREATE TABLE daily_rewards (
    guild_id VARCHAR(20) NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    reward_type ENUM('attendance', 'subscription') NOT NULL,
    last_claimed_at DATETIME NOT NULL,
    streak_count INT NOT NULL DEFAULT 0,  -- 연속 출석 횟수
    total_count INT NOT NULL DEFAULT 0,   -- 총 출석 횟수
    PRIMARY KEY (guild_id, user_id, reward_type)
);
```

---

### Phase 8: 장터 시스템 (우선순위: 낮음)

#### 8-1. 데이터베이스
```sql
-- sql/25_market_listings.sql
CREATE TABLE market_listings (
    id BIGINT NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(20) NOT NULL,
    seller_id VARCHAR(20) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    price BIGINT NOT NULL,
    currency_type ENUM('topy', 'ruby') NOT NULL,
    status ENUM('active', 'sold', 'cancelled') NOT NULL DEFAULT 'active',
    buyer_id VARCHAR(20) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sold_at DATETIME NULL,
    PRIMARY KEY (id)
);
```

#### 8-2. 수수료
- 토피 장터: 5%
- 루비 장터: 3%

---

### Phase 9: 고급 기능 (우선순위: 낮음)

| 기능 | 설명 |
|------|------|
| 디토뱅크 | 실버/골드 등급, 보관 한도, 수수료 면제 |
| 시즌 환급 | 분기제, 루비 → 현금 환급 |
| 월말 세금 | 3.3% 자동 차감 |
| 게임센터 | 내전 배팅, 수수료 20% |

---

## 구현 순서 요약

```
Phase 3: /내정보 통합 명령어 (Canvas 이미지)
    ↓
Phase 4: 거래 기록 조회 (버튼으로 연동)
    ↓
Phase 5: 유저 이체 (버튼 + Modal)
    ↓
Phase 6: 상점 시스템
    ↓
Phase 7: 기타 활동 보상 (출석)
    ↓
Phase 8: 장터 시스템
    ↓
Phase 9: 고급 기능
```

---

## 다음 작업 (Phase 3 상세)

### Step 1: 패키지 설치
```bash
npm install @napi-rs/canvas --workspace=apps/bot
```

### Step 2: Canvas 유틸리티 구현
- `apps/bot/src/utils/canvas/profile-card.ts`
- 폰트 로드, 이미지 생성 함수

### Step 3: 명령어 구현
- `apps/bot/src/commands/my-info.ts`
- 기존 wallet.ts, leaderboard.ts 삭제

### Step 4: 인터랙션 핸들러
- 버튼 클릭 핸들러 (경고차감권, 색상변경)
- Select Menu 핸들러 (색상 선택)
