# 코드베이스 아키텍처

## 설계 원칙

### 판단 기준
1. Presentation은 반드시 Business Logic과 분리
2. Pure Business Logic은 반드시 Persistence Layer와 분리
3. Internal Logic은 반드시 외부 연동 Contract, Caller와 분리
4. 하나의 모듈은 반드시 하나의 책임을 가짐
5. **순수함수는 반드시 I/O 로직과 분리** (테스트 용이성)
6. **외부 의존성(시간, 랜덤 등)은 반드시 Port로 추상화**

### 적용 패턴
- Layered Architecture
- SOLID Principles
- Ports & Adapters (Hexagonal)
- **Functional Core, Imperative Shell**

---

## 전체 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────────────────┐
│                         APPLICATIONS                                 │
│  ┌──────────────────────┐        ┌──────────────────────┐           │
│  │    apps/web          │        │    apps/bot          │           │
│  │   (Next.js 14)       │        │   (Discord.js)       │           │
│  │   - Presentation     │        │   - Presentation     │           │
│  │   - API Routes       │        │   - Commands/Events  │           │
│  └──────────┬───────────┘        └──────────┬───────────┘           │
└─────────────┼───────────────────────────────┼───────────────────────┘
              │                               │
              └───────────┬───────────────────┘
                          ▼
              ┌───────────────────────┐
              │  packages/infra       │
              │  - DI Container       │  ◀── 의존성 조립
              │  - Port 구현체        │
              └───────────┬───────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      CORE DOMAIN (packages/core)                     │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Pure Functions Layer                      │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │    │
│  │  │ calculate-  │  │ check-      │  │ validate-   │          │    │
│  │  │ level.ts    │  │ cooldown.ts │  │ settings.ts │          │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘          │    │
│  │  ✅ 100% 순수함수, 단위테스트 용이, Mock 불필요               │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                          │                                           │
│                          ▼                                           │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                   Service Layer (Orchestration)              │    │
│  │  - 순수함수 호출                                              │    │
│  │  - Port를 통한 I/O 조율                                       │    │
│  │  - 트랜잭션 경계 관리                                         │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                          │                                           │
│                          ▼                                           │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                      Port Layer (Interfaces)                 │    │
│  │  - Repository Ports                                          │    │
│  │  - Clock Port (시간 추상화)                                   │    │
│  │  - Event Publisher Port                                      │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
topia_empire/
├── apps/
│   ├── web/                              # 웹 대시보드 (Next.js 14)
│   │   ├── src/
│   │   │   ├── pages/                    # Pages Router
│   │   │   │   ├── api/
│   │   │   │   │   ├── auth/             # NextAuth endpoints
│   │   │   │   │   └── v1/               # REST API v1
│   │   │   │   │       ├── guilds/
│   │   │   │   │       │   └── [guildId]/
│   │   │   │   │       │       └── xp/
│   │   │   │   │       │           └── settings.ts
│   │   │   │   │       └── health.ts
│   │   │   │   │
│   │   │   │   ├── dashboard/
│   │   │   │   │   └── [guildId]/
│   │   │   │   │       ├── xp.tsx
│   │   │   │   │       ├── welcome.tsx
│   │   │   │   │       └── moderation.tsx
│   │   │   │   │
│   │   │   │   ├── _app.tsx
│   │   │   │   └── index.tsx
│   │   │   │
│   │   │   ├── components/
│   │   │   │   ├── ui/                   # shadcn/ui
│   │   │   │   ├── layout/
│   │   │   │   └── features/
│   │   │   │       ├── xp/
│   │   │   │       ├── welcome/
│   │   │   │       └── moderation/
│   │   │   │
│   │   │   ├── hooks/
│   │   │   │   ├── queries/
│   │   │   │   └── mutations/
│   │   │   │
│   │   │   └── lib/
│   │   │       ├── api-client.ts
│   │   │       └── container.ts          # DI Container 접근
│   │   │
│   │   ├── package.json
│   │   └── next.config.js
│   │
│   └── bot/                              # 디스코드 봇 (Discord.js)
│       ├── src/
│       │   ├── index.ts                  # Entry point + Container 초기화
│       │   │
│       │   ├── commands/                 # Slash Commands
│       │   │   ├── xp/
│       │   │   │   ├── rank.ts
│       │   │   │   └── leaderboard.ts
│       │   │   └── admin/
│       │   │       └── settings.ts
│       │   │
│       │   ├── events/                   # Discord Events
│       │   │   ├── message-create.ts
│       │   │   ├── voice-state-update.ts
│       │   │   └── guild-member-add.ts
│       │   │
│       │   ├── handlers/                 # Event → Service 연결
│       │   │   ├── xp.handler.ts
│       │   │   └── welcome.handler.ts
│       │   │
│       │   └── lib/
│       │       ├── client.ts
│       │       └── command-loader.ts
│       │
│       └── package.json
│
├── packages/
│   ├── core/                             # Pure Business Logic
│   │   ├── src/
│   │   │   ├── xp-system/
│   │   │   │   ├── domain/               # Entities, Value Objects
│   │   │   │   │   ├── user-xp.ts
│   │   │   │   │   ├── xp-settings.ts
│   │   │   │   │   ├── level-reward.ts
│   │   │   │   │   └── index.ts
│   │   │   │   │
│   │   │   │   ├── functions/            # ✅ 순수함수 (핵심!)
│   │   │   │   │   ├── calculate-level.ts
│   │   │   │   │   ├── calculate-xp-progress.ts
│   │   │   │   │   ├── check-cooldown.ts
│   │   │   │   │   ├── calculate-voice-xp.ts
│   │   │   │   │   ├── validate-xp-settings.ts
│   │   │   │   │   └── index.ts
│   │   │   │   │
│   │   │   │   ├── service/              # Orchestration
│   │   │   │   │   ├── xp.service.ts
│   │   │   │   │   └── xp-settings.service.ts
│   │   │   │   │
│   │   │   │   ├── port/                 # Interfaces
│   │   │   │   │   ├── xp-repository.port.ts
│   │   │   │   │   ├── xp-settings-repository.port.ts
│   │   │   │   │   └── index.ts
│   │   │   │   │
│   │   │   │   ├── errors/               # ✅ 도메인 에러
│   │   │   │   │   ├── xp-errors.ts
│   │   │   │   │   └── index.ts
│   │   │   │   │
│   │   │   │   └── index.ts              # Public exports
│   │   │   │
│   │   │   ├── welcome/
│   │   │   │   ├── domain/
│   │   │   │   ├── functions/
│   │   │   │   ├── service/
│   │   │   │   ├── port/
│   │   │   │   ├── errors/
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── moderation/
│   │   │   │   ├── domain/
│   │   │   │   ├── functions/
│   │   │   │   ├── service/
│   │   │   │   ├── port/
│   │   │   │   ├── errors/
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   └── shared/                   # 공유 코드
│   │   │       ├── types/
│   │   │       │   ├── result.ts         # ✅ Result<T, E> 패턴
│   │   │       │   ├── guild.ts
│   │   │       │   └── user.ts
│   │   │       │
│   │   │       ├── port/                 # ✅ 공통 Port
│   │   │       │   ├── clock.port.ts
│   │   │       │   └── event-publisher.port.ts
│   │   │       │
│   │   │       └── index.ts
│   │   │
│   │   ├── __tests__/                    # ✅ 테스트 디렉토리
│   │   │   ├── xp-system/
│   │   │   │   ├── functions/            # 순수함수 테스트 (Mock 불필요)
│   │   │   │   │   ├── calculate-level.test.ts
│   │   │   │   │   ├── check-cooldown.test.ts
│   │   │   │   │   └── calculate-xp-progress.test.ts
│   │   │   │   │
│   │   │   │   └── service/              # Service 테스트 (Mock 사용)
│   │   │   │       └── xp.service.test.ts
│   │   │   │
│   │   │   ├── welcome/
│   │   │   │   ├── functions/
│   │   │   │   └── service/
│   │   │   │
│   │   │   └── __fixtures__/             # ✅ 테스트 픽스처
│   │   │       ├── user-xp.fixture.ts
│   │   │       ├── xp-settings.fixture.ts
│   │   │       └── index.ts
│   │   │
│   │   ├── vitest.config.ts              # ✅ 테스트 설정
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── infra/                            # Infrastructure Layer
│   │   ├── src/
│   │   │   ├── database/
│   │   │   │   ├── pool.ts               # MySQL Connection Pool
│   │   │   │   ├── query-builder.ts
│   │   │   │   └── repositories/         # Port 구현체
│   │   │   │       ├── xp.repository.ts
│   │   │   │       ├── xp-settings.repository.ts
│   │   │   │       ├── guild.repository.ts
│   │   │   │       └── index.ts
│   │   │   │
│   │   │   ├── cache/
│   │   │   │   ├── client.ts             # Redis Client
│   │   │   │   ├── cache-manager.ts
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── event-bus/
│   │   │   │   ├── publisher.ts          # Redis Pub
│   │   │   │   ├── subscriber.ts         # Redis Sub
│   │   │   │   ├── events.ts             # Event 타입 정의
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── clock/                    # ✅ Clock 구현체
│   │   │   │   ├── system-clock.ts
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── discord/
│   │   │   │   ├── api-client.ts
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── container/                # ✅ DI Container
│   │   │   │   ├── types.ts              # Container 타입
│   │   │   │   ├── create-container.ts   # Factory
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   └── index.ts
│   │   │
│   │   ├── __tests__/
│   │   │   ├── repositories/             # 통합 테스트
│   │   │   └── __mocks__/                # ✅ Mock 구현체
│   │   │       ├── fake-clock.ts
│   │   │       ├── fake-xp-repository.ts
│   │   │       └── index.ts
│   │   │
│   │   ├── vitest.config.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── shared/                           # 공유 타입/유틸리티
│       ├── src/
│       │   ├── types/
│       │   │   ├── api-response.ts
│       │   │   └── events.ts
│       │   │
│       │   ├── constants/
│       │   │   └── defaults.ts           # ProBot 기본값
│       │   │
│       │   ├── utils/
│       │   │   ├── validation.ts
│       │   │   └── format.ts
│       │   │
│       │   └── index.ts
│       │
│       └── package.json
│
├── sql/
│   ├── schema/
│   │   ├── 001_guilds.sql
│   │   ├── 002_users.sql
│   │   ├── 003_xp_settings.sql
│   │   └── 004_user_xp.sql
│   │
│   └── seeds/
│       └── default_settings.sql
│
├── docs/
│   ├── 00_backgorund.md
│   ├── 01_xp_system.md
│   ├── 02_techstack.md
│   └── 03_architecture.md
│
├── package.json                          # Workspace root
├── turbo.json
├── tsconfig.base.json
└── .eslintrc.js                          # ✅ 의존성 규칙 강제
```

---

## Core Building Blocks

### 1. 순수함수 (Pure Functions)

**100% 테스트 가능, Mock 불필요**

```typescript
// packages/core/src/xp-system/functions/calculate-level.ts
export function calculateLevel(xp: number): number {
  if (xp < 0) return 0;
  return Math.floor(Math.sqrt(xp / 100));
}

export function calculateXpForLevel(level: number): number {
  return level * level * 100;
}
```

```typescript
// packages/core/src/xp-system/functions/calculate-xp-progress.ts
import { calculateLevel, calculateXpForLevel } from './calculate-level';

export interface XpProgress {
  currentXp: number;
  currentLevel: number;
  xpInCurrentLevel: number;
  xpRequiredForNextLevel: number;
  progressPercentage: number;
}

export function calculateXpProgress(totalXp: number): XpProgress {
  const currentLevel = calculateLevel(totalXp);
  const currentLevelXp = calculateXpForLevel(currentLevel);
  const nextLevelXp = calculateXpForLevel(currentLevel + 1);

  const xpInCurrentLevel = totalXp - currentLevelXp;
  const xpRequiredForNextLevel = nextLevelXp - currentLevelXp;
  const progressPercentage = Math.floor((xpInCurrentLevel / xpRequiredForNextLevel) * 100);

  return {
    currentXp: totalXp,
    currentLevel,
    xpInCurrentLevel,
    xpRequiredForNextLevel,
    progressPercentage,
  };
}
```

```typescript
// packages/core/src/xp-system/functions/check-cooldown.ts
export interface CooldownResult {
  canEarnXp: boolean;
  remainingSeconds: number;
}

// ✅ 시간을 파라미터로 받아 순수함수 유지
export function checkCooldown(
  lastActionAt: Date | null,
  cooldownSeconds: number,
  now: Date
): CooldownResult {
  if (!lastActionAt) {
    return { canEarnXp: true, remainingSeconds: 0 };
  }

  const elapsedMs = now.getTime() - lastActionAt.getTime();
  const elapsedSeconds = elapsedMs / 1000;
  const remainingSeconds = Math.max(0, cooldownSeconds - elapsedSeconds);

  return {
    canEarnXp: remainingSeconds === 0,
    remainingSeconds: Math.ceil(remainingSeconds),
  };
}
```

```typescript
// packages/core/src/xp-system/functions/validate-xp-settings.ts
import { XpSettings } from '../domain';

export interface ValidationError {
  field: string;
  message: string;
}

export function validateXpSettings(settings: Partial<XpSettings>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (settings.textXp !== undefined && (settings.textXp < 0 || settings.textXp > 1000)) {
    errors.push({ field: 'textXp', message: '0~1000 사이여야 합니다' });
  }

  if (settings.textCooldown !== undefined && (settings.textCooldown < 0 || settings.textCooldown > 3600)) {
    errors.push({ field: 'textCooldown', message: '0~3600초 사이여야 합니다' });
  }

  // ... 추가 검증

  return errors;
}
```

---

### 2. Port (인터페이스)

```typescript
// packages/core/src/shared/port/clock.port.ts
export interface ClockPort {
  now(): Date;
}

// packages/core/src/shared/port/event-publisher.port.ts
export interface EventPublisherPort {
  publish(channel: string, event: unknown): Promise<void>;
}

// packages/core/src/xp-system/port/xp-repository.port.ts
import { UserXp } from '../domain';
import { Result } from '../../shared/types/result';

export interface XpRepositoryPort {
  findByUser(guildId: string, userId: string): Promise<Result<UserXp | null, RepositoryError>>;
  save(userXp: UserXp): Promise<Result<void, RepositoryError>>;
  getLeaderboard(guildId: string, limit: number): Promise<Result<UserXp[], RepositoryError>>;
}

export type RepositoryError =
  | { type: 'CONNECTION_ERROR'; message: string }
  | { type: 'QUERY_ERROR'; message: string }
  | { type: 'TIMEOUT'; message: string };
```

---

### 3. Result 패턴

```typescript
// packages/core/src/shared/types/result.ts
export type Result<T, E> =
  | { success: true; data: T }
  | { success: false; error: E };

export const Result = {
  ok<T>(data: T): Result<T, never> {
    return { success: true, data };
  },

  err<E>(error: E): Result<never, E> {
    return { success: false, error };
  },

  map<T, U, E>(result: Result<T, E>, fn: (data: T) => U): Result<U, E> {
    if (result.success) {
      return Result.ok(fn(result.data));
    }
    return result;
  },
};
```

---

### 4. Service (Orchestration)

**순수함수 호출 + I/O 조율만 담당**

```typescript
// packages/core/src/xp-system/service/xp.service.ts
import { XpRepositoryPort, XpSettingsRepositoryPort } from '../port';
import { ClockPort } from '../../shared/port/clock.port';
import { checkCooldown, calculateLevel } from '../functions';
import { Result } from '../../shared/types/result';
import { XpError } from '../errors';

export interface XpGrantResult {
  granted: boolean;
  xp?: number;
  level?: number;
  leveledUp?: boolean;
  reason?: 'no_settings' | 'cooldown' | 'excluded_channel' | 'excluded_role';
}

export class XpService {
  constructor(
    private readonly xpRepo: XpRepositoryPort,
    private readonly settingsRepo: XpSettingsRepositoryPort,
    private readonly clock: ClockPort  // ✅ 시간 주입
  ) {}

  async grantTextXp(
    guildId: string,
    userId: string,
    channelId: string,
    roleIds: string[]
  ): Promise<Result<XpGrantResult, XpError>> {
    // 1. 설정 조회 (I/O)
    const settingsResult = await this.settingsRepo.findByGuild(guildId);
    if (!settingsResult.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: settingsResult.error });
    }

    const settings = settingsResult.data;
    if (!settings) {
      return Result.ok({ granted: false, reason: 'no_settings' });
    }

    // 2. 제외 채널/역할 검사 (순수 로직)
    if (settings.excludedChannels.includes(channelId)) {
      return Result.ok({ granted: false, reason: 'excluded_channel' });
    }

    if (roleIds.some(r => settings.excludedRoles.includes(r))) {
      return Result.ok({ granted: false, reason: 'excluded_role' });
    }

    // 3. 현재 XP 조회 (I/O)
    const userXpResult = await this.xpRepo.findByUser(guildId, userId);
    if (!userXpResult.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: userXpResult.error });
    }

    const userXp = userXpResult.data;

    // 4. 쿨타임 검사 (순수함수 호출)
    const now = this.clock.now();
    const cooldownResult = checkCooldown(
      userXp?.lastMessageAt ?? null,
      settings.textCooldown,
      now
    );

    if (!cooldownResult.canEarnXp) {
      return Result.ok({ granted: false, reason: 'cooldown' });
    }

    // 5. 새 XP/레벨 계산 (순수함수 호출)
    const newXp = (userXp?.xp ?? 0) + settings.textXp;
    const newLevel = calculateLevel(newXp);
    const previousLevel = userXp?.level ?? 0;
    const leveledUp = newLevel > previousLevel;

    // 6. 저장 (I/O)
    const saveResult = await this.xpRepo.save({
      guildId,
      userId,
      xp: newXp,
      level: newLevel,
      lastMessageAt: now,
      lastVoiceAt: userXp?.lastVoiceAt ?? null,
    });

    if (!saveResult.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: saveResult.error });
    }

    return Result.ok({
      granted: true,
      xp: newXp,
      level: newLevel,
      leveledUp,
    });
  }
}
```

---

### 5. DI Container

```typescript
// packages/infra/src/container/types.ts
import { XpService, XpSettingsService } from '@topia/core';

export interface Container {
  xpService: XpService;
  xpSettingsService: XpSettingsService;
  // welcomeService: WelcomeService;
  // moderationService: ModerationService;
}

// packages/infra/src/container/create-container.ts
import { XpService, XpSettingsService } from '@topia/core';
import { XpRepository, XpSettingsRepository } from '../database/repositories';
import { SystemClock } from '../clock';
import { EventPublisher } from '../event-bus';
import { getPool } from '../database/pool';
import { getRedisClient } from '../cache/client';
import { Container } from './types';

export function createContainer(): Container {
  const pool = getPool();
  const redis = getRedisClient();

  // Infrastructure
  const clock = new SystemClock();
  const eventPublisher = new EventPublisher(redis);

  // Repositories
  const xpRepo = new XpRepository(pool);
  const xpSettingsRepo = new XpSettingsRepository(pool);

  // Services
  const xpService = new XpService(xpRepo, xpSettingsRepo, clock);
  const xpSettingsService = new XpSettingsService(xpSettingsRepo, eventPublisher);

  return {
    xpService,
    xpSettingsService,
  };
}
```

```typescript
// packages/infra/src/clock/system-clock.ts
import { ClockPort } from '@topia/core';

export class SystemClock implements ClockPort {
  now(): Date {
    return new Date();
  }
}

// packages/infra/__tests__/__mocks__/fake-clock.ts
import { ClockPort } from '@topia/core';

export class FakeClock implements ClockPort {
  private currentTime: Date;

  constructor(initialTime: Date = new Date()) {
    this.currentTime = initialTime;
  }

  now(): Date {
    return new Date(this.currentTime);
  }

  setTime(time: Date): void {
    this.currentTime = time;
  }

  advance(ms: number): void {
    this.currentTime = new Date(this.currentTime.getTime() + ms);
  }
}
```

---

### 6. Handler (apps/bot)

```typescript
// apps/bot/src/handlers/xp.handler.ts
import { Container } from '@topia/infra';
import { CacheManager } from '@topia/infra';

export function createXpHandler(container: Container, cache: CacheManager) {
  return {
    async handleTextMessage(
      guildId: string,
      userId: string,
      channelId: string,
      roleIds: string[]
    ): Promise<void> {
      const result = await container.xpService.grantTextXp(
        guildId,
        userId,
        channelId,
        roleIds
      );

      if (!result.success) {
        console.error('XP grant failed:', result.error);
        return;
      }

      if (result.data.leveledUp) {
        await this.notifyLevelUp(guildId, userId, result.data.level!);
      }
    },

    async notifyLevelUp(guildId: string, userId: string, level: number): Promise<void> {
      // Discord 알림 전송 (Presentation 로직)
    },
  };
}
```

```typescript
// apps/bot/src/index.ts
import { Client, GatewayIntentBits } from 'discord.js';
import { createContainer, CacheManager, startSettingsSync } from '@topia/infra';
import { createXpHandler } from './handlers/xp.handler';

const client = new Client({ intents: [/* ... */] });
const container = createContainer();
const cache = new CacheManager();
const xpHandler = createXpHandler(container, cache);

// 설정 변경 실시간 동기화
startSettingsSync(cache);

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guildId) return;

  const roleIds = message.member?.roles.cache.map(r => r.id) ?? [];
  await xpHandler.handleTextMessage(
    message.guildId,
    message.author.id,
    message.channelId,
    roleIds
  );
});

client.login(process.env.DISCORD_TOKEN);
```

---

## 테스트 전략

### 순수함수 테스트 (Mock 불필요)

```typescript
// packages/core/__tests__/xp-system/functions/calculate-level.test.ts
import { describe, it, expect } from 'vitest';
import { calculateLevel, calculateXpForLevel } from '../../../src/xp-system/functions';

describe('calculateLevel', () => {
  it.each([
    [0, 0],
    [99, 0],
    [100, 1],
    [399, 1],
    [400, 2],
    [900, 3],
    [10000, 10],
  ])('XP %i → 레벨 %i', (xp, expectedLevel) => {
    expect(calculateLevel(xp)).toBe(expectedLevel);
  });

  it('음수 XP는 레벨 0', () => {
    expect(calculateLevel(-100)).toBe(0);
  });
});

describe('calculateXpForLevel', () => {
  it.each([
    [0, 0],
    [1, 100],
    [2, 400],
    [10, 10000],
  ])('레벨 %i → 필요 XP %i', (level, expectedXp) => {
    expect(calculateXpForLevel(level)).toBe(expectedXp);
  });
});
```

```typescript
// packages/core/__tests__/xp-system/functions/check-cooldown.test.ts
import { describe, it, expect } from 'vitest';
import { checkCooldown } from '../../../src/xp-system/functions';

describe('checkCooldown', () => {
  const baseTime = new Date('2024-01-01T12:00:00Z');

  it('첫 메시지는 쿨타임 없음', () => {
    const result = checkCooldown(null, 60, baseTime);

    expect(result.canEarnXp).toBe(true);
    expect(result.remainingSeconds).toBe(0);
  });

  it('쿨타임 중이면 canEarnXp가 false', () => {
    const lastAction = new Date('2024-01-01T11:59:30Z'); // 30초 전

    const result = checkCooldown(lastAction, 60, baseTime);

    expect(result.canEarnXp).toBe(false);
    expect(result.remainingSeconds).toBe(30);
  });

  it('쿨타임이 지나면 canEarnXp가 true', () => {
    const lastAction = new Date('2024-01-01T11:58:00Z'); // 2분 전

    const result = checkCooldown(lastAction, 60, baseTime);

    expect(result.canEarnXp).toBe(true);
    expect(result.remainingSeconds).toBe(0);
  });

  it('정확히 쿨타임이 끝난 시점', () => {
    const lastAction = new Date('2024-01-01T11:59:00Z'); // 정확히 60초 전

    const result = checkCooldown(lastAction, 60, baseTime);

    expect(result.canEarnXp).toBe(true);
  });
});
```

### Service 테스트 (Mock 사용)

```typescript
// packages/core/__tests__/xp-system/service/xp.service.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { XpService } from '../../../src/xp-system/service';
import { createMockXpRepository, createMockSettingsRepository } from '../../__fixtures__';
import { FakeClock } from '@topia/infra/__tests__/__mocks__';
import { Result } from '../../../src/shared/types/result';

describe('XpService', () => {
  let service: XpService;
  let mockXpRepo: ReturnType<typeof createMockXpRepository>;
  let mockSettingsRepo: ReturnType<typeof createMockSettingsRepository>;
  let fakeClock: FakeClock;

  beforeEach(() => {
    mockXpRepo = createMockXpRepository();
    mockSettingsRepo = createMockSettingsRepository();
    fakeClock = new FakeClock(new Date('2024-01-01T12:00:00Z'));

    service = new XpService(mockXpRepo, mockSettingsRepo, fakeClock);
  });

  describe('grantTextXp', () => {
    it('설정이 없으면 XP를 부여하지 않음', async () => {
      mockSettingsRepo.findByGuild.mockResolvedValue(Result.ok(null));

      const result = await service.grantTextXp('guild-1', 'user-1', 'channel-1', []);

      expect(result.success).toBe(true);
      expect(result.data.granted).toBe(false);
      expect(result.data.reason).toBe('no_settings');
    });

    it('제외된 채널에서는 XP를 부여하지 않음', async () => {
      mockSettingsRepo.findByGuild.mockResolvedValue(Result.ok({
        guildId: 'guild-1',
        textXp: 10,
        textCooldown: 60,
        excludedChannels: ['channel-1'],
        excludedRoles: [],
      }));

      const result = await service.grantTextXp('guild-1', 'user-1', 'channel-1', []);

      expect(result.data.granted).toBe(false);
      expect(result.data.reason).toBe('excluded_channel');
    });

    it('쿨타임이 지나면 XP를 부여', async () => {
      mockSettingsRepo.findByGuild.mockResolvedValue(Result.ok({
        guildId: 'guild-1',
        textXp: 15,
        textCooldown: 60,
        excludedChannels: [],
        excludedRoles: [],
      }));

      mockXpRepo.findByUser.mockResolvedValue(Result.ok({
        guildId: 'guild-1',
        userId: 'user-1',
        xp: 100,
        level: 1,
        lastMessageAt: new Date('2024-01-01T11:58:00Z'), // 2분 전
        lastVoiceAt: null,
      }));

      mockXpRepo.save.mockResolvedValue(Result.ok(undefined));

      const result = await service.grantTextXp('guild-1', 'user-1', 'channel-1', []);

      expect(result.success).toBe(true);
      expect(result.data.granted).toBe(true);
      expect(result.data.xp).toBe(115);
      expect(mockXpRepo.save).toHaveBeenCalled();
    });
  });
});
```

### 테스트 픽스처

```typescript
// packages/core/__tests__/__fixtures__/index.ts
import { vi } from 'vitest';
import { XpRepositoryPort, XpSettingsRepositoryPort } from '../../src/xp-system/port';
import { Result } from '../../src/shared/types/result';

export function createMockXpRepository(): XpRepositoryPort & {
  findByUser: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
  getLeaderboard: ReturnType<typeof vi.fn>;
} {
  return {
    findByUser: vi.fn().mockResolvedValue(Result.ok(null)),
    save: vi.fn().mockResolvedValue(Result.ok(undefined)),
    getLeaderboard: vi.fn().mockResolvedValue(Result.ok([])),
  };
}

export function createMockSettingsRepository(): XpSettingsRepositoryPort & {
  findByGuild: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
} {
  return {
    findByGuild: vi.fn().mockResolvedValue(Result.ok(null)),
    save: vi.fn().mockResolvedValue(Result.ok(undefined)),
  };
}

// 기본 테스트 데이터
export const fixtures = {
  userXp: {
    basic: {
      guildId: 'guild-1',
      userId: 'user-1',
      xp: 100,
      level: 1,
      lastMessageAt: null,
      lastVoiceAt: null,
    },
  },
  xpSettings: {
    default: {
      guildId: 'guild-1',
      textXp: 15,
      textCooldown: 60,
      voiceXp: 10,
      voiceCooldown: 60,
      excludedChannels: [],
      excludedRoles: [],
      levelUpChannel: null,
      rewards: [],
    },
  },
};
```

---

## SOLID 원칙 적용

| 원칙 | 적용 |
|------|------|
| **S**ingle Responsibility | functions/는 계산만, service/는 조율만, port/는 계약만 |
| **O**pen/Closed | 새 기능은 새 함수/서비스 추가, 기존 코드 수정 최소화 |
| **L**iskov Substitution | FakeClock, MockRepository로 교체 가능 |
| **I**nterface Segregation | ClockPort, XpRepositoryPort 등 작은 인터페이스 |
| **D**ependency Inversion | Service → Port(추상), Infra가 Port 구현 |

---

## 의존성 규칙

```
apps/web ──┐
           ├──▶ packages/infra ──▶ packages/core
apps/bot ──┘                            │
                                        ▼
                                 packages/shared
```

### ESLint 의존성 규칙 설정

```javascript
// .eslintrc.js
module.exports = {
  rules: {
    'import/no-restricted-paths': [
      'error',
      {
        zones: [
          // core는 infra를 import할 수 없음
          {
            target: './packages/core/src',
            from: './packages/infra/src',
            message: 'core는 infra에 의존할 수 없습니다',
          },
          // core는 apps를 import할 수 없음
          {
            target: './packages/core/src',
            from: './apps',
            message: 'core는 apps에 의존할 수 없습니다',
          },
        ],
      },
    ],
  },
};
```

---

## 새 기능 추가 시 체크리스트

### 1. Core 패키지 (packages/core)
- [ ] `src/{feature}/domain/` - Entity, Value Object 정의
- [ ] `src/{feature}/functions/` - 순수함수 작성
- [ ] `src/{feature}/port/` - Repository 인터페이스 정의
- [ ] `src/{feature}/service/` - Orchestration 서비스 작성
- [ ] `src/{feature}/errors/` - 도메인 에러 정의
- [ ] `__tests__/{feature}/functions/` - 순수함수 테스트
- [ ] `__tests__/{feature}/service/` - 서비스 테스트

### 2. Infra 패키지 (packages/infra)
- [ ] `src/database/repositories/` - Repository 구현
- [ ] `src/container/` - Container에 서비스 등록
- [ ] `__tests__/__mocks__/` - Mock 구현체 추가

### 3. Bot 앱 (apps/bot)
- [ ] `src/handlers/` - Handler 추가
- [ ] `src/events/` 또는 `src/commands/` - Handler 연결

### 4. Web 앱 (apps/web)
- [ ] `src/pages/api/v1/` - API Route 추가
- [ ] `src/components/features/` - UI 컴포넌트 추가
- [ ] `src/hooks/queries/` - React Query 훅 추가

### 5. 데이터베이스
- [ ] `sql/schema/` - 테이블 스키마 추가

---

## 테스트 피라미드

```
          ┌─────────────┐
          │    E2E      │  ← 최소 (Playwright)
          ├─────────────┤
          │ Integration │  ← 중간 (API, Repository)
          ├─────────────┤
          │    Unit     │  ← 최대 (순수함수, Service)
          └─────────────┘

packages/core/functions/  → Unit Test (Mock 불필요)
packages/core/service/    → Unit Test (Mock 사용)
packages/infra/repos/     → Integration Test (실제 DB)
apps/                     → E2E Test (전체 흐름)
```
