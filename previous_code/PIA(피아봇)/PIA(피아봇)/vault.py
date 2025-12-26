# vault.py
import discord
from discord.ext import commands, tasks
from discord import app_commands
import sqlite3
from datetime import datetime, timedelta
import config

class VaultSystem(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        
    @commands.Cog.listener()
    async def on_ready(self):
        print("VaultSystem: 디토뱅크 금고 시스템이 준비되었습니다.")
        self.init_database()
        
        if not self.vault_expiry_check.is_running():
            self.vault_expiry_check.start()
        
        if not self.vault_expiry_warning.is_running():
            self.vault_expiry_warning.start()
    
    def cog_unload(self):
        if self.vault_expiry_check.is_running():
            self.vault_expiry_check.cancel()
        
        if self.vault_expiry_warning.is_running():
            self.vault_expiry_warning.cancel()
    
    def get_db_connection(self):
        return sqlite3.connect(config.DATABASE_FILE)
    
    def init_database(self):
        """데이터베이스 초기화"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        # 금고 계좌 테이블
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS vault_accounts (
                user_id INTEGER NOT NULL,
                vault_type TEXT NOT NULL,
                balance INTEGER DEFAULT 0,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, vault_type)
            )
        ''')
        
        # 금고 거래 내역
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS vault_transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                vault_type TEXT NOT NULL,
                transaction_type TEXT NOT NULL,
                amount INTEGER NOT NULL,
                balance_after INTEGER NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        conn.commit()
        conn.close()
    
    def get_bank_system(self):
        """BankSystem Cog 가져오기"""
        return self.bot.get_cog('BankSystem')
    
    def get_user_balance(self, user_id: int):
        """유저 토피 잔액"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT balance FROM user_coins WHERE user_id = ?', (user_id,))
        result = cursor.fetchone()
        conn.close()
        return result[0] if result else 0
    
    def update_balance(self, user_id: int, username: str, amount: int, reason: str):
        """토피 잔액 업데이트"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT OR IGNORE INTO user_coins (user_id, username, balance)
            VALUES (?, ?, 0)
        ''', (user_id, username))
        
        current_balance = self.get_user_balance(user_id)
        new_balance = max(0, current_balance + amount)
        
        cursor.execute('''
            UPDATE user_coins 
            SET balance = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE user_id = ?
        ''', (new_balance, user_id))
        
        cursor.execute('''
            INSERT INTO coin_transactions 
            (user_id, transaction_type, amount, reason, balance_after)
            VALUES (?, 'vault', ?, ?, ?)
        ''', (user_id, amount, reason, new_balance))
        
        conn.commit()
        conn.close()
        
        return new_balance
    
    def get_vault_info(self, user_id: int, vault_type: str):
        """금고 정보 조회"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT balance, expires_at FROM vault_accounts
            WHERE user_id = ? AND vault_type = ?
        ''', (user_id, vault_type))
        
        result = cursor.fetchone()
        conn.close()
        
        if result:
            balance, expires_at = result
            expires_dt = datetime.fromisoformat(expires_at)
            
            # 만료 확인
            if expires_dt > datetime.now():
                return {
                    'balance': balance,
                    'expires_at': expires_dt,
                    'active': True
                }
        
        return None
    
    def get_all_vaults(self, user_id: int):
        """모든 금고 조회"""
        silver = self.get_vault_info(user_id, 'silver_vault')
        gold = self.get_vault_info(user_id, 'gold_vault')
        
        return {
            'silver_vault': silver,
            'gold_vault': gold
        }
    
    def get_vault_limit(self, vault_type: str):
        """금고 한도"""
        if vault_type == 'silver_vault':
            return 100000
        elif vault_type == 'gold_vault':
            return 200000
        return 0
    
    def has_active_vault(self, user_id: int, vault_type: str):
        """활성 금고 확인"""
        vault = self.get_vault_info(user_id, vault_type)
        return vault is not None and vault['active']
    
    def get_total_vault_balance(self, user_id: int):
        """모든 금고 잔액 합계 (정기세금 계산 시 제외용)"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT COALESCE(SUM(balance), 0) FROM vault_accounts
            WHERE user_id = ? AND expires_at > datetime('now')
        ''', (user_id,))
        
        result = cursor.fetchone()
        conn.close()
        
        return result[0] if result else 0
    
    def deposit_to_vault(self, user_id: int, username: str, vault_type: str, amount: int):
        """금고 입금"""
        if amount <= 0:
            return {'success': False, 'message': '입금 금액은 1 이상이어야 합니다.'}
        
        # 금고 활성 확인
        if not self.has_active_vault(user_id, vault_type):
            return {'success': False, 'message': '금고 이용권이 없습니다.'}
        
        # 잔액 확인
        balance = self.get_user_balance(user_id)
        if balance < amount:
            return {'success': False, 'message': '토피 잔액이 부족합니다.'}
        
        # 금고 한도 확인
        vault_info = self.get_vault_info(user_id, vault_type)
        limit = self.get_vault_limit(vault_type)
        
        if vault_info['balance'] + amount > limit:
            return {
                'success': False, 
                'message': f'금고 한도 초과 (최대 {limit:,} 토피)'
            }
        
        # 입금 처리
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        new_vault_balance = vault_info['balance'] + amount
        
        cursor.execute('''
            UPDATE vault_accounts
            SET balance = ?, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ? AND vault_type = ?
        ''', (new_vault_balance, user_id, vault_type))
        
        # 거래 내역
        cursor.execute('''
            INSERT INTO vault_transactions
            (user_id, vault_type, transaction_type, amount, balance_after)
            VALUES (?, ?, 'DEPOSIT', ?, ?)
        ''', (user_id, vault_type, amount, new_vault_balance))
        
        conn.commit()
        conn.close()
        
        # 토피 차감
        new_balance = self.update_balance(
            user_id, username, -amount,
            f"디토뱅크 {vault_type} 입금"
        )
        
        return {
            'success': True,
            'vault_balance': new_vault_balance,
            'topy_balance': new_balance
        }
    
    def withdraw_from_vault(self, user_id: int, username: str, vault_type: str, amount: int):
        """금고 출금"""
        if amount <= 0:
            return {'success': False, 'message': '출금 금액은 1 이상이어야 합니다.'}
        
        # 금고 활성 확인
        if not self.has_active_vault(user_id, vault_type):
            return {'success': False, 'message': '금고 이용권이 없습니다.'}
        
        vault_info = self.get_vault_info(user_id, vault_type)
        
        if vault_info['balance'] < amount:
            return {'success': False, 'message': '금고 잔액이 부족합니다.'}
        
        # 출금 처리
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        new_vault_balance = vault_info['balance'] - amount
        
        cursor.execute('''
            UPDATE vault_accounts
            SET balance = ?, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ? AND vault_type = ?
        ''', (new_vault_balance, user_id, vault_type))
        
        # 거래 내역
        cursor.execute('''
            INSERT INTO vault_transactions
            (user_id, vault_type, transaction_type, amount, balance_after)
            VALUES (?, ?, 'WITHDRAW', ?, ?)
        ''', (user_id, vault_type, -amount, new_vault_balance))
        
        conn.commit()
        conn.close()
        
        # 토피 지급
        new_balance = self.update_balance(
            user_id, username, amount,
            f"디토뱅크 {vault_type} 출금"
        )
        
        return {
            'success': True,
            'vault_balance': new_vault_balance,
            'topy_balance': new_balance
        }
    
    def create_vault(self, user_id: int, vault_type: str, duration_days: int = 30):
        """금고 생성 또는 연장"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        # 기존 금고 확인
        cursor.execute('''
            SELECT expires_at FROM vault_accounts
            WHERE user_id = ? AND vault_type = ?
        ''', (user_id, vault_type))
        
        result = cursor.fetchone()
        
        if result:
            # 기존 금고 연장
            current_expires = datetime.fromisoformat(result[0])
            
            if current_expires > datetime.now():
                # 아직 만료 안됨 - 남은 기간에 추가
                new_expires = current_expires + timedelta(days=duration_days)
            else:
                # 만료됨 - 현재 시간부터
                new_expires = datetime.now() + timedelta(days=duration_days)
            
            cursor.execute('''
                UPDATE vault_accounts
                SET expires_at = ?, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ? AND vault_type = ?
            ''', (new_expires, user_id, vault_type))
        else:
            # 신규 금고 생성
            new_expires = datetime.now() + timedelta(days=duration_days)
            
            cursor.execute('''
                INSERT INTO vault_accounts (user_id, vault_type, balance, expires_at)
                VALUES (?, ?, 0, ?)
            ''', (user_id, vault_type, new_expires))
        
        conn.commit()
        conn.close()
        
        return new_expires
    
    def cancel_vault(self, user_id: int, vault_type: str):
        """금고 해지 (잔액 반환)"""
        vault_info = self.get_vault_info(user_id, vault_type)
        
        if not vault_info:
            return {'success': False, 'message': '금고가 없습니다.'}
        
        vault_balance = vault_info['balance']
        
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        # 금고 삭제
        cursor.execute('''
            DELETE FROM vault_accounts
            WHERE user_id = ? AND vault_type = ?
        ''', (user_id, vault_type))
        
        # 거래 내역
        cursor.execute('''
            INSERT INTO vault_transactions
            (user_id, vault_type, transaction_type, amount, balance_after)
            VALUES (?, ?, 'CANCEL', ?, 0)
        ''', (user_id, vault_type, -vault_balance))
        
        conn.commit()
        conn.close()
        
        # 잔액 반환
        if vault_balance > 0:
            cursor.execute('SELECT username FROM user_coins WHERE user_id = ?', (user_id,))
            result = cursor.fetchone()
            username = result[0] if result else "Unknown"
            
            self.update_balance(
                user_id, username, vault_balance,
                f"디토뱅크 {vault_type} 해지 (잔액 반환)"
            )
        
        return {
            'success': True,
            'returned_balance': vault_balance
        }
    
    @tasks.loop(hours=1)
    async def vault_expiry_check(self):
        """1시간마다 만료된 금고 확인 및 자동 환불"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        # 만료된 금고 찾기
        cursor.execute('''
            SELECT user_id, vault_type, balance FROM vault_accounts
            WHERE expires_at <= datetime('now') AND balance > 0
        ''')
        
        expired_vaults = cursor.fetchall()
        
        for user_id, vault_type, balance in expired_vaults:
            try:
                # 잔액 반환
                cursor.execute('SELECT username FROM user_coins WHERE user_id = ?', (user_id,))
                result = cursor.fetchone()
                username = result[0] if result else "Unknown"
                
                self.update_balance(
                    user_id, username, balance,
                    f"디토뱅크 {vault_type} 만료 (자동 환불)"
                )
                
                # 금고 삭제
                cursor.execute('''
                    DELETE FROM vault_accounts
                    WHERE user_id = ? AND vault_type = ?
                ''', (user_id, vault_type))
                
                # 거래 내역
                cursor.execute('''
                    INSERT INTO vault_transactions
                    (user_id, vault_type, transaction_type, amount, balance_after)
                    VALUES (?, ?, 'EXPIRED', ?, 0)
                ''', (user_id, vault_type, -balance))
                
                conn.commit()
                
                # DM 전송
                try:
                    user = self.bot.get_user(user_id)
                    if user:
                        vault_names = {
                            'silver_vault': '실버금고',
                            'gold_vault': '골드금고'
                        }
                        
                        embed = discord.Embed(
                            title="🏦 디토뱅크 금고 만료 안내",
                            description=f"{vault_names.get(vault_type, vault_type)} 이용권이 만료되었습니다.",
                            color=0xff9900,
                            timestamp=datetime.now()
                        )
                        embed.add_field(name="환불 금액", value=f"{balance:,} 토피", inline=True)
                        embed.add_field(name="환불 계좌", value="메인 계좌", inline=True)
                        embed.set_footer(text="토피아 제국 리턴즈 디토뱅크")
                        
                        await user.send(embed=embed)
                except:
                    pass
                
            except Exception as e:
                print(f"금고 만료 처리 실패 (user_id: {user_id}): {e}")
        
        conn.close()
    
    @vault_expiry_check.before_loop
    async def before_vault_check(self):
        await self.bot.wait_until_ready()
    
    @app_commands.command(name="금고", description="디토뱅크 금고를 관리합니다")
    async def vault_menu(self, interaction: discord.Interaction):
        """금고 메인 메뉴"""
        vaults = self.get_all_vaults(interaction.user.id)
        balance = self.get_user_balance(interaction.user.id)
        
        embed = discord.Embed(
            title="🏦 디토뱅크 금고",
            description="안전하게 토피를 보관하세요!",
            color=0x3498db,
            timestamp=datetime.now()
        )
        
        embed.add_field(name="💰 메인 계좌", value=f"{balance:,} 토피", inline=False)
        
        # 실버금고
        if vaults['silver_vault']:
            silver = vaults['silver_vault']
            days_left = (silver['expires_at'] - datetime.now()).days
            embed.add_field(
                name="🥈 실버금고",
                value=(
                    f"잔액: {silver['balance']:,} / 100,000 토피\n"
                    f"만료: {days_left}일 후\n"
                    f"혜택: 이체 수수료 면제"
                ),
                inline=True
            )
        else:
            embed.add_field(
                name="🥈 실버금고",
                value="❌ 미가입\n루비 무인상점에서 구매",
                inline=True
            )
        
        # 골드금고
        if vaults['gold_vault']:
            gold = vaults['gold_vault']
            days_left = (gold['expires_at'] - datetime.now()).days
            embed.add_field(
                name="🥇 골드금고",
                value=(
                    f"잔액: {gold['balance']:,} / 200,000 토피\n"
                    f"만료: {days_left}일 후\n"
                    f"혜택: 이체수수료+게임수수료 면제"
                ),
                inline=True
            )
        else:
            embed.add_field(
                name="🥇 골드금고",
                value="❌ 미가입\n루비 무인상점에서 구매",
                inline=True
            )
        
        embed.set_footer(text=f"{interaction.user.display_name} | 금고 잔액은 정기세금에서 제외")
        
        view = VaultView(self, interaction.user.id)
        await interaction.response.send_message(embed=embed, view=view, ephemeral=True)
    
    @app_commands.command(name="금고관리", description="금고를 관리합니다 (관리자 전용)")
    @app_commands.describe(
        대상자="대상 유저",
        작업="연장/가입/해지",
        등급="실버/골드"
    )
    @app_commands.choices(
        작업=[
            app_commands.Choice(name="연장", value="extend"),
            app_commands.Choice(name="가입", value="create"),
            app_commands.Choice(name="해지", value="cancel")
        ],
        등급=[
            app_commands.Choice(name="실버금고", value="silver_vault"),
            app_commands.Choice(name="골드금고", value="gold_vault")
        ]
    )
    async def manage_vault(
        self,
        interaction: discord.Interaction,
        대상자: discord.Member,
        작업: str,
        등급: str
    ):
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ 관리자만 사용할 수 있습니다.", ephemeral=True)
            return
        
        vault_names = {
            'silver_vault': '🥈 실버금고',
            'gold_vault': '🥇 골드금고'
        }
        
        if 작업 in ['extend', 'create']:
            # 가입 또는 연장
            new_expires = self.create_vault(대상자.id, 등급, 30)
            
            action_name = "연장" if 작업 == 'extend' else "가입"
            
            embed = discord.Embed(
                title=f"✅ 금고 {action_name} 완료",
                color=0x00ff00,
                timestamp=datetime.now()
            )
            embed.add_field(name="대상자", value=대상자.mention, inline=True)
            embed.add_field(name="금고", value=vault_names[등급], inline=True)
            embed.add_field(name="만료일", value=new_expires.strftime('%Y-%m-%d %H:%M'), inline=True)
            embed.set_footer(text=f"관리자: {interaction.user.display_name}")
            
            await interaction.response.send_message(embed=embed)
            
            # 대상자에게 DM
            try:
                dm_embed = discord.Embed(
                    title=f"🏦 디토뱅크 금고 {action_name}",
                    description=f"{vault_names[등급]} 이용권이 {action_name}되었습니다!",
                    color=0x00ff00,
                    timestamp=datetime.now()
                )
                dm_embed.add_field(name="만료일", value=new_expires.strftime('%Y-%m-%d %H:%M'), inline=False)
                
                if 등급 == 'silver_vault':
                    dm_embed.add_field(
                        name="혜택",
                        value="• 최대 100,000 토피 저축\n• 이체 수수료 면제\n• 정기세금 제외",
                        inline=False
                    )
                else:
                    dm_embed.add_field(
                        name="혜택",
                        value="• 최대 200,000 토피 저축\n• 이체 수수료 면제\n• 게임센터 수수료 5% 추가 할인\n• 정기세금 제외",
                        inline=False
                    )
                
                await 대상자.send(embed=dm_embed)
            except:
                pass
        
        else:  # cancel
            result = self.cancel_vault(대상자.id, 등급)
            
            if not result['success']:
                await interaction.response.send_message(f"❌ {result['message']}", ephemeral=True)
                return
            
            embed = discord.Embed(
                title="✅ 금고 해지 완료",
                color=0xff0000,
                timestamp=datetime.now()
            )
            embed.add_field(name="대상자", value=대상자.mention, inline=True)
            embed.add_field(name="금고", value=vault_names[등급], inline=True)
            embed.add_field(name="환불 금액", value=f"{result['returned_balance']:,} 토피", inline=True)
            embed.set_footer(text=f"관리자: {interaction.user.display_name}")
            
            await interaction.response.send_message(embed=embed)
            
            # 대상자에게 DM
            try:
                dm_embed = discord.Embed(
                    title="🏦 디토뱅크 금고 해지",
                    description=f"{vault_names[등급]}이(가) 해지되었습니다.",
                    color=0xff0000,
                    timestamp=datetime.now()
                )
                dm_embed.add_field(name="환불 금액", value=f"{result['returned_balance']:,} 토피", inline=False)
                
                await 대상자.send(embed=dm_embed)
            except:
                pass
        
        # 로그 채널에 기록
        bank = self.get_bank_system()
        if bank and hasattr(bank, 'log_channel_id') and bank.log_channel_id:
            log_channel = self.bot.get_channel(bank.log_channel_id)
            if log_channel:
                log_embed = discord.Embed(
                    title="🏦 금고 관리 기록",
                    color=0x3498db,
                    timestamp=datetime.now()
                )
                log_embed.add_field(name="관리자", value=interaction.user.mention, inline=True)
                log_embed.add_field(name="대상자", value=대상자.mention, inline=True)
                log_embed.add_field(name="작업", value=작업, inline=True)
                log_embed.add_field(name="금고", value=vault_names[등급], inline=True)
                
                await log_channel.send(embed=log_embed)


class VaultView(discord.ui.View):
    """금고 메인 뷰"""
    def __init__(self, cog, user_id):
        super().__init__(timeout=180)
        self.cog = cog
        self.user_id = user_id
    
    @discord.ui.button(label="실버금고", style=discord.ButtonStyle.secondary, emoji="🥈")
    async def silver_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        if interaction.user.id != self.user_id:
            await interaction.response.send_message("❌ 본인만 사용할 수 있습니다.", ephemeral=True)
            return
        
        view = VaultActionView(self.cog, 'silver_vault')
        
        vault_info = self.cog.get_vault_info(self.user_id, 'silver_vault')
        
        if vault_info:
            days_left = (vault_info['expires_at'] - datetime.now()).days
            embed = discord.Embed(
                title="🥈 실버금고",
                color=0xc0c0c0,
                timestamp=datetime.now()
            )
            embed.add_field(name="잔액", value=f"{vault_info['balance']:,} / 100,000 토피", inline=True)
            embed.add_field(name="만료", value=f"{days_left}일 후", inline=True)
            embed.add_field(
                name="혜택",
                value="• 이체 수수료 면제\n• 정기세금 제외",
                inline=False
            )
        else:
            embed = discord.Embed(
                title="❌ 실버금고 미가입",
                description="루비 무인상점에서 이용권을 구매하세요!",
                color=0xff0000
            )
            view = None
        
        await interaction.response.edit_message(embed=embed, view=view)
    
    @discord.ui.button(label="골드금고", style=discord.ButtonStyle.secondary, emoji="🥇")
    async def gold_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        if interaction.user.id != self.user_id:
            await interaction.response.send_message("❌ 본인만 사용할 수 있습니다.", ephemeral=True)
            return
        
        view = VaultActionView(self.cog, 'gold_vault')
        
        vault_info = self.cog.get_vault_info(self.user_id, 'gold_vault')
        
        if vault_info:
            days_left = (vault_info['expires_at'] - datetime.now()).days
            embed = discord.Embed(
                title="🥇 골드금고",
                color=0xffd700,
                timestamp=datetime.now()
            )
            embed.add_field(name="잔액", value=f"{vault_info['balance']:,} / 200,000 토피", inline=True)
            embed.add_field(name="만료", value=f"{days_left}일 후", inline=True)
            embed.add_field(
                name="혜택",
                value="• 이체 수수료 면제\n• 게임센터 수수료 5% 추가 할인\n• 정기세금 제외",
                inline=False
            )
        else:
            embed = discord.Embed(
                title="❌ 골드금고 미가입",
                description="루비 무인상점에서 이용권을 구매하세요!",
                color=0xff0000
            )
            view = None
        
        await interaction.response.edit_message(embed=embed, view=view)


class VaultActionView(discord.ui.View):
    """금고 입출금 뷰"""
    def __init__(self, cog, vault_type):
        super().__init__(timeout=180)
        self.cog = cog
        self.vault_type = vault_type
    
    @discord.ui.button(label="입금", style=discord.ButtonStyle.success, emoji="💰")
    async def deposit_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        modal = VaultDepositModal(self.cog, self.vault_type)
        await interaction.response.send_modal(modal)
    
    @discord.ui.button(label="출금", style=discord.ButtonStyle.danger, emoji="💸")
    async def withdraw_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        modal = VaultWithdrawModal(self.cog, self.vault_type)
        await interaction.response.send_modal(modal)


class VaultDepositModal(discord.ui.Modal):
    """금고 입금 모달"""
    def __init__(self, cog, vault_type):
        vault_names = {
            'silver_vault': '실버금고',
            'gold_vault': '골드금고'
        }
        super().__init__(title=f"{vault_names[vault_type]} 입금", timeout=300)
        self.cog = cog
        self.vault_type = vault_type
        
        self.amount_input = discord.ui.TextInput(
            label="입금 금액",
            placeholder="입금할 토피 금액을 입력하세요",
            required=True,
            max_length=20
        )
        self.add_item(self.amount_input)
    
    async def on_submit(self, interaction: discord.Interaction):
        try:
            amount = int(self.amount_input.value)
            
            # 입금 처리
            conn = self.cog.get_db_connection()
            cursor = conn.cursor()
            cursor.execute('SELECT username FROM user_coins WHERE user_id = ?', (interaction.user.id,))
            result = cursor.fetchone()
            username = result[0] if result else interaction.user.display_name
            conn.close()
            
            result = self.cog.deposit_to_vault(
                interaction.user.id,
                username,
                self.vault_type,
                amount
            )
            
            if not result['success']:
                embed = discord.Embed(
                    title="❌ 입금 실패",
                    description=result['message'],
                    color=0xff0000
                )
                await interaction.response.send_message(embed=embed, ephemeral=True)
                return
            
            vault_names = {
                'silver_vault': '🥈 실버금고',
                'gold_vault': '🥇 골드금고'
            }
            
            embed = discord.Embed(
                title="✅ 입금 완료",
                color=0x00ff00,
                timestamp=datetime.now()
            )
            embed.add_field(name="금고", value=vault_names[self.vault_type], inline=True)
            embed.add_field(name="입금액", value=f"{amount:,} 토피", inline=True)
            embed.add_field(name="금고 잔액", value=f"{result['vault_balance']:,} 토피", inline=True)
            embed.add_field(name="메인 계좌", value=f"{result['topy_balance']:,} 토피", inline=True)
            embed.set_footer(text="🏦 디토뱅크")
            
            await interaction.response.send_message(embed=embed, ephemeral=True)
            
        except ValueError:
            await interaction.response.send_message("❌ 올바른 숫자를 입력해주세요.", ephemeral=True)


class VaultWithdrawModal(discord.ui.Modal):
    """금고 출금 모달"""
    def __init__(self, cog, vault_type):
        vault_names = {
            'silver_vault': '실버금고',
            'gold_vault': '골드금고'
        }
        super().__init__(title=f"{vault_names[vault_type]} 출금", timeout=300)
        self.cog = cog
        self.vault_type = vault_type
        
        self.amount_input = discord.ui.TextInput(
            label="출금 금액",
            placeholder="출금할 토피 금액을 입력하세요 (전액: all)",
            required=True,
            max_length=20
        )
        self.add_item(self.amount_input)
    
    async def on_submit(self, interaction: discord.Interaction):
        try:
            # 전액 출금 처리
            if self.amount_input.value.lower() == 'all':
                vault_info = self.cog.get_vault_info(interaction.user.id, self.vault_type)
                if not vault_info:
                    await interaction.response.send_message("❌ 금고가 없습니다.", ephemeral=True)
                    return
                amount = vault_info['balance']
            else:
                amount = int(self.amount_input.value)
            
            # 출금 처리
            conn = self.cog.get_db_connection()
            cursor = conn.cursor()
            cursor.execute('SELECT username FROM user_coins WHERE user_id = ?', (interaction.user.id,))
            result = cursor.fetchone()
            username = result[0] if result else interaction.user.display_name
            conn.close()
            
            result = self.cog.withdraw_from_vault(
                interaction.user.id,
                username,
                self.vault_type,
                amount
            )
            
            if not result['success']:
                embed = discord.Embed(
                    title="❌ 출금 실패",
                    description=result['message'],
                    color=0xff0000
                )
                await interaction.response.send_message(embed=embed, ephemeral=True)
                return
            
            vault_names = {
                'silver_vault': '🥈 실버금고',
                'gold_vault': '🥇 골드금고'
            }
            
            embed = discord.Embed(
                title="✅ 출금 완료",
                color=0x00ff00,
                timestamp=datetime.now()
            )
            embed.add_field(name="금고", value=vault_names[self.vault_type], inline=True)
            embed.add_field(name="출금액", value=f"{amount:,} 토피", inline=True)
            embed.add_field(name="금고 잔액", value=f"{result['vault_balance']:,} 토피", inline=True)
            embed.add_field(name="메인 계좌", value=f"{result['topy_balance']:,} 토피", inline=True)
            embed.set_footer(text="🏦 디토뱅크")
            
            await interaction.response.send_message(embed=embed, ephemeral=True)
            
        except ValueError:
            await interaction.response.send_message("❌ 올바른 숫자를 입력해주세요.", ephemeral=True)


async def setup(bot):
    await bot.add_cog(VaultSystem(bot))
