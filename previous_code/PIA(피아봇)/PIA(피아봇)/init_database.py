# init_database.py
import sqlite3
from datetime import datetime

# config.py에서 가져온 설정
DATABASE_FILE = "PIADB.db"

def init_all_tables():
    """모든 필요한 데이터베이스 테이블 생성"""
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()
    
    print("=== 데이터베이스 테이블 생성 시작 ===\n")
    
    # 1. 루비 시스템 테이블
    print("1. 루비 시스템 테이블 생성 중...")
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_rubies (
            user_id INTEGER PRIMARY KEY,
            username TEXT NOT NULL,
            balance INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS ruby_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            admin_id INTEGER,
            transaction_type TEXT NOT NULL,
            amount INTEGER NOT NULL,
            reason TEXT,
            balance_after INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    print("   ✓ user_rubies, ruby_transactions 생성 완료")
    
    # 2. 토피 시스템 테이블
    print("\n2. 토피 시스템 테이블 생성 중...")
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_topy (
            user_id INTEGER PRIMARY KEY,
            username TEXT NOT NULL,
            balance INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    print("   ✓ user_topy 생성 완료")
    
    # 3. 세금/수수료 시스템 테이블
    print("\n3. 세금/수수료 시스템 테이블 생성 중...")
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tax_rates (
            tax_type TEXT PRIMARY KEY,
            rate REAL NOT NULL,
            updated_by INTEGER,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tax_collection_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            amount INTEGER NOT NULL,
            tax_type TEXT NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    print("   ✓ tax_rates, tax_collection_history 생성 완료")
    
    # 기본 세율 설정
    default_tax_rates = [
        ('transfer_fee', 3.3),
        ('gamecenter_fee', 5.0),
        ('shop_fee', 0.0),
        ('regular_tax', 3.3)
    ]
    
    for tax_type, rate in default_tax_rates:
        cursor.execute('''
            INSERT OR IGNORE INTO tax_rates (tax_type, rate)
            VALUES (?, ?)
        ''', (tax_type, rate))
    print("   ✓ 기본 세율 설정 완료")
    print("     - transfer_fee: 3.3%")
    print("     - gamecenter_fee: 5.0%")
    print("     - shop_fee: 0.0%")
    print("     - regular_tax: 3.3%")
    
    # 4. 음성 활동 랭킹 테이블
    print("\n4. 음성 활동 랭킹 테이블 생성 중...")
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS daily_voice_ranking (
            user_id INTEGER NOT NULL,
            date DATE NOT NULL,
            duration_minutes INTEGER DEFAULT 0,
            coins_earned REAL DEFAULT 0,
            PRIMARY KEY (user_id, date)
        )
    ''')
    print("   ✓ daily_voice_ranking 생성 완료")
    
    # 5. 역할 보상 테이블 (이미 존재하지만 확인)
    print("\n5. 역할 보상 테이블 확인 중...")
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS reward_roles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            role_id INTEGER NOT NULL UNIQUE,
            reward_coins INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS daily_role_rewards (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            role_id INTEGER NOT NULL,
            coins_earned INTEGER NOT NULL,
            reward_date DATE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, reward_date)
        )
    ''')
    print("   ✓ reward_roles, daily_role_rewards 확인 완료")
    
    # 6. 루비 상점 테이블 (이미 존재하지만 확인)
    print("\n6. 루비 상점 테이블 확인 중...")
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS ruby_shop_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            role_id INTEGER NOT NULL,
            price INTEGER NOT NULL,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS ruby_shop_purchases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            item_name TEXT NOT NULL,
            role_id INTEGER NOT NULL,
            price INTEGER NOT NULL,
            purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    print("   ✓ ruby_shop_items, ruby_shop_purchases 확인 완료")
    
    # 7. 인덱스 생성
    print("\n7. 성능 최적화 인덱스 생성 중...")
    indexes = [
        ("idx_ruby_transactions_user", "CREATE INDEX IF NOT EXISTS idx_ruby_transactions_user ON ruby_transactions(user_id)"),
        ("idx_ruby_transactions_date", "CREATE INDEX IF NOT EXISTS idx_ruby_transactions_date ON ruby_transactions(created_at)"),
        ("idx_coin_transactions_user", "CREATE INDEX IF NOT EXISTS idx_coin_transactions_user ON coin_transactions(user_id)"),
        ("idx_coin_transactions_date", "CREATE INDEX IF NOT EXISTS idx_coin_transactions_date ON coin_transactions(created_at)"),
        ("idx_ditocoin_transactions_user", "CREATE INDEX IF NOT EXISTS idx_ditocoin_transactions_user ON ditocoin_transactions(user_id)"),
        ("idx_vault_transactions_user", "CREATE INDEX IF NOT EXISTS idx_vault_transactions_user ON vault_transactions(user_id)"),
        ("idx_voice_logs_user", "CREATE INDEX IF NOT EXISTS idx_voice_logs_user ON voice_logs(user_id)"),
        ("idx_daily_ranking_date", "CREATE INDEX IF NOT EXISTS idx_daily_ranking_date ON daily_voice_ranking(date)"),
        ("idx_tax_history_user", "CREATE INDEX IF NOT EXISTS idx_tax_history_user ON tax_collection_history(user_id)")
    ]
    
    created_count = 0
    for index_name, index_sql in indexes:
        try:
            cursor.execute(index_sql)
            created_count += 1
        except Exception as e:
            print(f"     ⚠ {index_name} 생성 실패 (이미 존재하거나 테이블 없음)")
    
    print(f"   ✓ {created_count}개 인덱스 생성/확인 완료")
    
    # 8. 변경사항 저장
    conn.commit()
    
    # 9. 데이터베이스 상태 확인
    print("\n8. 데이터베이스 상태 확인 중...")
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    tables = cursor.fetchall()
    print(f"   ✓ 총 {len(tables)}개 테이블 존재")
    
    conn.close()
    
    print("\n" + "="*50)
    print("✅ 데이터베이스 초기화 완료!")
    print("="*50)
    print(f"📁 파일: {DATABASE_FILE}")
    print(f"🕐 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"📊 테이블 수: {len(tables)}개")
    print("\n생성된 주요 테이블:")
    print("  • user_rubies - 루비 잔액 관리")
    print("  • ruby_transactions - 루비 거래 내역")
    print("  • user_topy - 토피 잔액 관리")
    print("  • tax_rates - 세율 설정")
    print("  • tax_collection_history - 세금 징수 내역")
    print("  • daily_voice_ranking - 음성 활동 랭킹")
    print("\n모든 시스템이 정상적으로 작동할 준비가 되었습니다!")
    print("="*50)

if __name__ == "__main__":
    try:
        init_all_tables()
    except Exception as e:
        print(f"\n❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()
        print("\n문제가 지속되면 관리자에게 문의하세요.")
