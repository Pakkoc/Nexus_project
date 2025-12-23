# main.py
import discord
from discord.ext import commands
import asyncio
import sqlite3
import config
from coin import CoinSystem
from shop import ShopSystem
from rubyshop import RubyShopSystem

# 봇 인텐트 설정
intents = discord.Intents.default()
intents.message_content = True
intents.members = True
intents.guilds = True
intents.voice_states = True  # 음성 채널 활동 감지를 위해 추가

# 봇 인스턴스 생성
bot = commands.Bot(command_prefix='!', intents=intents)

# 데이터베이스 초기화
def init_database():
    conn = sqlite3.connect(config.DATABASE_FILE)
    cursor = conn.cursor()
    
    # 출퇴근 기록 테이블
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS work_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            username TEXT NOT NULL,
            department TEXT NOT NULL,
            start_time DATETIME,
            end_time DATETIME,
            work_duration INTEGER DEFAULT 0,
            is_working BOOLEAN DEFAULT FALSE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # 채널 설정 테이블
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS channel_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id INTEGER NOT NULL,
            setting_type TEXT NOT NULL,
            channel_id INTEGER NOT NULL,
            department TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # 코인 시스템 테이블
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_coins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL UNIQUE,
            username TEXT NOT NULL,
            balance INTEGER DEFAULT 0,
            last_checkin DATE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # 코인 거래 기록 테이블
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS coin_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            admin_id INTEGER,
            transaction_type TEXT NOT NULL,
            amount INTEGER NOT NULL,
            reason TEXT,
            balance_after INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # 음성 활동 추적 테이블
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS voice_activity (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            channel_id INTEGER NOT NULL,
            join_time DATETIME NOT NULL,
            leave_time DATETIME,
            duration_minutes INTEGER DEFAULT 0,
            coins_earned INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # 음성 로그 테이블 (입/퇴장 기록용)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS voice_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            username TEXT NOT NULL,
            channel_id INTEGER NOT NULL,
            channel_name TEXT NOT NULL,
            join_time DATETIME NOT NULL,
            leave_time DATETIME,
            duration_seconds INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()

@bot.event
async def on_ready():
    print(f'{bot.user} 봇이 준비되었습니다!')
    print(f'봇 ID: {bot.user.id}')
    print('------')
    
    # 슬래시 커맨드 동기화
    try:
        synced = await bot.tree.sync()
        print(f'슬래시 커맨드 {len(synced)}개 동기화 완료')
    except Exception as e:
        print(f'슬래시 커맨드 동기화 실패: {e}')

# 봇 에러 핸들링
@bot.event
async def on_command_error(ctx, error):
    if isinstance(error, commands.CommandNotFound):
        return
    elif isinstance(error, commands.MissingPermissions):
        await ctx.send("이 명령어를 사용할 권한이 없습니다.")
    else:
        print(f"에러 발생: {error}")

# 워크 시스템, 코인 시스템, 회원 관리 시스템, 음성 추적 시스템 코그 로드
async def load_extensions():
    try:
        # 기존 시스템들
        
        shop = ShopSystem(bot)
        await bot.add_cog(shop)
        print("Shop 코그 로드 완료")

        
        # 새로운 음성 추적 시스템
        coin = CoinSystem(bot)
        await bot.add_cog(coin)
        print("coin 코그 로드 완료")
        
        await bot.load_extension('ruby')
        print('ruby.py COG가 로드되었습니다.')

        ruby_shop = RubyShopSystem(bot)
        await bot.add_cog(ruby_shop)
        print("RubyShopSystem 코그 로드 완료")
        #==========================
        await bot.load_extension('bank')
        print('bank Cog가 성공적으로 로드되었습니다.')
        await bot.load_extension('ditocoin')
        print('ditocoin Cog가 성공적으로 로드되었습니다.')
        await bot.load_extension('ranking')
        print('ranking Cog가 성공적으로 로드되었습니다.')
        await bot.load_extension('vault')
        print('vault Cog가 성공적으로 로드되었습니다.')
        await bot.load_extension('ruby_vending_shop')
        print('ruby_vending_shop Cog가 성공적으로 로드되었습니다.')
        await bot.load_extension('gamecenter')
        print('gamecenter Cog가 성공적으로 로드되었습니다.')
        await bot.load_extension('subscription')
        print('subscription Cog가 성공적으로 로드되었습니다.')
        

    except Exception as e:
        print(f"코그 로드 실패: {e}")

async def main():
    # 데이터베이스 초기화
    init_database()
    
    # 확장 로드
    await load_extensions()
    
    # 봇 실행
    await bot.start(config.BOT_TOKEN)

if __name__ == '__main__':
    asyncio.run(main())