# config.py
import discord
from typing import Optional

# ===================================================
# 기본 봇 설정
# ===================================================

# 봇 토큰 (실제 토큰으로 교체해주세요)
BOT_TOKEN = "YOUR_BOT_TOKEN_HERE"

# 봇 정보
BOT_NAME = "DISCORD :: TOPIA BOT"
BOT_COLOR = 0x00ff00  # 임베드 색상 (녹색)

# 데이터베이스 파일명
DATABASE_FILE = "bot_database.db"

# ===================================================
# 역할 ID 설정
# ===================================================

# 회원 관리 관련 역할
DEFAULT_ROLE_ID = 1304462251306254357  # 기본 역할
MALE_ROLE_ID = 1304463797909590029     # 남자 역할
FEMALE_ROLE_ID = 1304463741265514599   # 여자 역할
ADULT_ROLE_ID = 1304464035198013450    # 성인 역할 (20세 이상)
MINOR_ROLE_ID = 1304463968672157856    # 미성년자 역할 (19세 이하)

# 부서별 역할 ID
DEPARTMENT_ROLES = {
    "단속팀": 1428113658097172520,
    "행정팀": 1428113713361064129,
    "사절단": 1428113713638146058,  
    "총괄팀": 1428076013660668068,
    "개발팀": 1383842778504499411
}

# 관리자 역할 ID (근무기록 초기화 권한)
ADMIN_ROLE_ID = 1428076013660668068

# 상급 관리자 역할 ID (주간 초기화 권한)
SENIOR_ADMIN_ROLE_ID = 1428076013660668068

# 출퇴근 시스템 사용 가능한 역할 ID들
WORK_SYSTEM_ROLES = [
    1428113658097172520,  # 단속팀
    1428113713361064129,  # 행정팀
    1428113713638146058,  # 사절단 (행사팀 + 영업팀)
    1428076013660668068,  # 총괄팀
    1383842778504499411   # 개발팀
]

# ===================================================
# 채널 ID 설정
# ===================================================

# 규칙방 링크
RULE_LINK = "https://discordapp.com/channels/1304451047330283520/1304469047043293204"

# 음성 채널 로그 채널
VOICE_JOIN_LOG_CHANNEL_ID = 1377989965371408624   # 음성입장기록 채널 ID
VOICE_LEAVE_LOG_CHANNEL_ID = 1377989985269190738  # 음성퇴장기록 채널 ID

# 부서별 알림 채널
DEPARTMENT_CHANNELS = {
    "단속팀": 1383317912550379623,
    "행정팀": 1383318972237353010,
    "사절단": 1383318217950363729,  # 행사팀 채널을 사절단으로 사용
    "총괄팀": 123456789012345687,
    "개발팀": 1384113042647810090,
}

# 티켓 로그 채널 ID
TICKET_LOG_CHANNEL_ID = 1432381217696911580

# 로그 채널 ID (선택사항)
LOG_CHANNEL_ID = None

# 동적 채널 설정 (실행 중 수정 가능)
CHANNEL_CONFIG = {
    "input_modal_channel": None,
    "photo_verification_channel": None,
    "alert_channel": None,
    "log_channel": None,
}

def set_channel_config(key: str, value: Optional[int]):
    """채널 설정 업데이트"""
    if key in CHANNEL_CONFIG:
        CHANNEL_CONFIG[key] = value

def get_channel_config(key: str) -> Optional[int]:
    """채널 설정 조회"""
    return CHANNEL_CONFIG.get(key)

#===================================================
#티켓 시스템 설정
#===================================================
#티켓 카테고리 및 담당자 설정

TICKET_CATEGORIES = {
    "general": {
        "category_id": 1434167424940249121,     # 일반문의 카테고리 ID
        "handler_role_id": 1428113658097172520  # 일반문의 담당자 역할 ID
    },
    "report": {
        "category_id": 1434167476874117120,     # 신고문의 카테고리 ID
        "handler_role_id": 1428113658097172520  # 신고문의 담당자 역할 ID
    },
    "appeal": {
        "category_id": 1434167476874117120,     # 항소문의 카테고리 ID
        "handler_role_id": 1428113658097172520  # 항소문의 담당자 역할 ID
    }
}

# 차단/경고 사유 템플릿
NOTICE_REASONS = {
    "차단사유": [
        "스팸/도배 행위",
        "욕설 및 비방",
        "개인정보 노출",
        "불법 콘텐츠 공유",
        "광고/홍보 무단 게시",
        "사기 및 피싱 시도"
    ],
    "경고대상": [
        "부적절한 언행",
        "채널 목적에 맞지 않는 게시물",
        "타인에 대한 비하/조롱",
        "논쟁 유발 행위",
        "허위정보 유포",
        "과도한 감정표현"
    ],
    "방생성 봇 및 기타 봇 사용": [
        "음성채널 봇 오남용",
        "뮤직봇 독점 사용",
        "봇 명령어 스팸",
        "봇을 이용한 도배",
        "게임봇 규칙 위반",
        "봇 기능 악용"
    ],
    "기타 규칙": [
        "닉네임 규칙 위반",
        "프로필 사진 부적절",
        "상태메시지 부적절",
        "역할 요청 규칙 위반",
        "이벤트 참여 규칙 위반",
        "기타 서버 규칙 위반"
    ]
}

# ===================================================
# 디자인 설정
# ===================================================

# 색상 설정
COLORS = {
    "SUCCESS": discord.Color.green(),
    "ERROR": discord.Color.red(),
    "INFO": discord.Color.blue(),
    "WARNING": discord.Color.orange(),
    "VOICE_JOIN": discord.Color.from_rgb(88, 101, 242),
    "VOICE_LEAVE": discord.Color.from_rgb(237, 66, 69)
}

# 이모지 설정
EMOJIS = {
    "VOICE_JOIN": "🔊",
    "VOICE_LEAVE": "🔇",
    "STATS": "📊",
    "TIME": "⏰",
    "USER": "👤",
    "CALENDAR": "📅",
    "RESET": "🗑️",
    "SUCCESS": "✅",
    "ERROR": "❌",
    "WARNING": "⚠️"
}
