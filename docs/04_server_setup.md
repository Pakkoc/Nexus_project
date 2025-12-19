# 서버 실행 가이드

개발 환경에서 필요한 서비스들을 실행하는 방법입니다.

## 서비스 구성

| 서비스 | 포트 | 컨테이너명 | 설명 |
|--------|------|-----------|------|
| MySQL | 3306 | topia-mysql | 메인 데이터베이스 |
| Redis | 6379 | topia-redis | 캐시 및 세션 저장소 |
| Adminer | 8080 | topia-adminer | MySQL 웹 관리 도구 |
| Next.js 웹 | 3000 | - | 프론트엔드 대시보드 (npm) |
| Discord 봇 | 3001 | - | 봇 API 서버 (npm) |

---

## 빠른 시작

```bash
# 1. Docker 서비스 시작 (MySQL, Redis, Adminer)
docker-compose up -d

# 2. 개발 서버 시작 (봇 + 웹)
npm run dev
```

끝! 이게 전부입니다.

---

## Docker Compose 명령어

### 서비스 시작
```bash
docker-compose up -d
```

### 서비스 중지
```bash
docker-compose stop
```

### 서비스 중지 및 삭제
```bash
docker-compose down
```

### 서비스 중지 및 볼륨(데이터)까지 삭제
```bash
docker-compose down -v
```

### 로그 확인
```bash
# 전체 로그
docker-compose logs

# 실시간 로그
docker-compose logs -f

# 특정 서비스 로그
docker-compose logs mysql
```

### 상태 확인
```bash
docker-compose ps
```

---

## 개발 서버 (봇 + 웹)

### 동시 실행
```bash
npm run dev
```

이 명령어로 다음이 동시에 실행됩니다:
- `@topia/web` - Next.js 웹 서버 (http://localhost:3000)
- `@topia/bot` - Discord 봇 서버 (http://localhost:3001)

### 개별 실행
```bash
# 웹만 실행
npm run dev --filter=@topia/web

# 봇만 실행
npm run dev --filter=@topia/bot
```

---

## Adminer (DB 관리 도구)

### 접속 정보
- URL: http://localhost:8080
- 시스템: MySQL
- 서버: `mysql` (Docker 내부) 또는 `host.docker.internal` (호스트)
- 사용자명: `root`
- 비밀번호: `.env` 파일의 `DB_PASSWORD` 참조
- 데이터베이스: `topia_empire`

---

## 문제 해결

### 포트 충돌 (3306)
Windows에 MySQL이 설치되어 있으면 포트 충돌이 발생합니다.

```powershell
# PowerShell (관리자 권한) - Windows MySQL 서비스 중지
net stop MySQL93

# Windows MySQL 자동 시작 비활성화 (최초 1회)
Set-Service -Name 'MySQL93' -StartupType Disabled
```

### 컨테이너 재생성
```bash
docker-compose down
docker-compose up -d
```

### 데이터 초기화 (주의: 모든 데이터 삭제)
```bash
docker-compose down -v
docker-compose up -d
```

---

## 데이터 백업/복원

### 백업
```bash
docker exec topia-mysql mysqldump -uroot -p[비밀번호] topia_empire > backup.sql
```

### 복원
```bash
docker exec -i topia-mysql mysql -uroot -p[비밀번호] topia_empire < backup.sql
```
