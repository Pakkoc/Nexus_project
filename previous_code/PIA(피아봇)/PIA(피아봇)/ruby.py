# ruby_system.py
import discord
from discord.ext import commands
from discord import app_commands
import sqlite3
from datetime import datetime
import config
from typing import Literal

class RubySystem(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.required_role_id = 1428076013660668068  # 관리 권한 역할 ID
        self.log_channel_id = None  # 로그 채널 ID
        
    def get_db_connection(self):
        return sqlite3.connect(config.DATABASE_FILE)
    
    def init_ruby_tables(self):
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
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
        
        conn.commit()
        conn.close()
    
    def has_required_role(self, user: discord.Member):
        return any(role.id == self.required_role_id for role in user.roles)
    
    def init_user_ruby(self, user_id: int, username: str):
        self.init_ruby_tables()
        
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT OR IGNORE INTO user_rubies (user_id, username, balance)
            VALUES (?, ?, 0)
        ''', (user_id, username))
        
        cursor.execute('''
            UPDATE user_rubies SET username = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE user_id = ?
        ''', (username, user_id))
        
        conn.commit()
        conn.close()
    
    def get_user_balance(self, user_id: int):
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT balance FROM user_rubies WHERE user_id = ?', (user_id,))
        result = cursor.fetchone()
        conn.close()
        
        return result[0] if result else 0
    
    def update_user_balance(self, user_id: int, username: str, amount: int, admin_id: int = None, reason: str = None, transaction_type: str = "system"):
        self.init_user_ruby(user_id, username)
        
        conn = self.get_db_connection()
        cursor = conn.cursor()
        

        current_balance = self.get_user_balance(user_id)
        new_balance = current_balance + amount
        

        if new_balance < 0:
            new_balance = 0
            amount = -current_balance
        

        cursor.execute('''
            UPDATE user_rubies 
            SET balance = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE user_id = ?
        ''', (new_balance, user_id))
        

        cursor.execute('''
            INSERT INTO ruby_transactions 
            (user_id, admin_id, transaction_type, amount, reason, balance_after)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (user_id, admin_id, transaction_type, amount, reason, new_balance))
        
        conn.commit()
        conn.close()
        
        return new_balance
    
    def reset_user_balance(self, user_id: int, username: str, admin_id: int, reason: str = None):

        self.init_user_ruby(user_id, username)
        
        conn = self.get_db_connection()
        cursor = conn.cursor()
        

        current_balance = self.get_user_balance(user_id)
        

        cursor.execute('''
            UPDATE user_rubies 
            SET balance = 0, updated_at = CURRENT_TIMESTAMP 
            WHERE user_id = ?
        ''', (user_id,))
        

        cursor.execute('''
            INSERT INTO ruby_transactions 
            (user_id, admin_id, transaction_type, amount, reason, balance_after)
            VALUES (?, ?, ?, ?, ?, 0)
        ''', (user_id, admin_id, "reset", -current_balance, reason))
        
        conn.commit()
        conn.close()
        
        return current_balance
    
    async def send_ruby_log(self, embed: discord.Embed):

        if not self.log_channel_id:
            return
        
        log_channel = self.bot.get_channel(self.log_channel_id)
        if not log_channel:
            return
        
        try:
            await log_channel.send(embed=embed)
        except Exception as e:
            print(f"로그 전송 실패: {e}")
    
    @app_commands.command(name="루비", description="루비 시스템 관리 및 확인")
    @app_commands.describe(
        기능="사용할 기능을 선택하세요",
        관리유형="관리 기능 유형 (관리 선택 시에만 사용)",
        대상="대상 유저 (관리 기능에서 사용)",
        금액="루비 금액 (추가/차감 시 사용)",
        사유="사유 (관리 기능에서 사용)"
    )
    @app_commands.choices(기능=[
        app_commands.Choice(name="확인", value="확인"),
        app_commands.Choice(name="관리", value="관리")
    ])
    @app_commands.choices(관리유형=[
        app_commands.Choice(name="추가", value="추가"),
        app_commands.Choice(name="차감", value="차감"),
        app_commands.Choice(name="조회", value="조회"),
        app_commands.Choice(name="초기화", value="초기화"),
        app_commands.Choice(name="설정", value="설정")
    ])
    async def ruby_command(
        self, 
        interaction: discord.Interaction, 
        기능: Literal["확인", "관리"],
        관리유형: Literal["추가", "차감", "조회", "초기화", "설정"] = None,
        대상: discord.Member = None,
        금액: int = None,
        사유: str = None
    ):

        if 기능 == "확인":

            self.init_user_ruby(interaction.user.id, interaction.user.display_name)
            

            balance = self.get_user_balance(interaction.user.id)
            
            embed = discord.Embed(
                title="💎 루비 잔액 확인",
                description=f"{interaction.user.mention}님의 루비 잔액입니다.",
                color=0xe74c3c,
                timestamp=datetime.now()
            )
            embed.add_field(name="💰 현재 잔액", value=f"`{balance:,}` 루비", inline=False)
            embed.set_thumbnail(url=interaction.user.display_avatar.url)
            embed.set_footer(text="💎 Ruby System", icon_url=interaction.user.display_avatar.url)
            
            await interaction.response.send_message(embed=embed, ephemeral=True)
            return
        

        if 기능 == "관리":
            if not self.has_required_role(interaction.user):
                embed = discord.Embed(
                    title="❌ 권한 부족",
                    description="이 명령어를 사용할 권한이 없습니다.",
                    color=0xe74c3c,
                    timestamp=datetime.now()
                )
                embed.set_footer(text="💎 Ruby System")
                await interaction.response.send_message(embed=embed, ephemeral=True)
                return
            
            if not 관리유형:
                embed = discord.Embed(
                    title="❌ 관리 유형 미선택",
                    description="관리 기능을 선택했지만 관리 유형을 선택하지 않았습니다.",
                    color=0xe74c3c,
                    timestamp=datetime.now()
                )
                embed.set_footer(text="💎 Ruby System")
                await interaction.response.send_message(embed=embed, ephemeral=True)
                return
            

            if 관리유형 == "추가":
                if not 대상 or not 금액:
                    embed = discord.Embed(
                        title="❌ 필수 정보 누락",
                        description="대상과 금액을 모두 입력해주세요.",
                        color=0xe74c3c,
                        timestamp=datetime.now()
                    )
                    embed.set_footer(text="💎 Ruby System")
                    await interaction.response.send_message(embed=embed, ephemeral=True)
                    return
                
                if 금액 <= 0:
                    embed = discord.Embed(
                        title="❌ 잘못된 금액",
                        description="금액은 1 이상이어야 합니다.",
                        color=0xe74c3c,
                        timestamp=datetime.now()
                    )
                    embed.set_footer(text="💎 Ruby System")
                    await interaction.response.send_message(embed=embed, ephemeral=True)
                    return
                
                new_balance = self.update_user_balance(
                    대상.id,
                    대상.display_name,
                    금액,
                    interaction.user.id,
                    사유,
                    "admin_add"
                )
                
                embed = discord.Embed(
                    title="✅ 루비 추가 완료",
                    description=f"{대상.mention}님에게 루비를 지급했습니다.",
                    color=0x27ae60,
                    timestamp=datetime.now()
                )
                embed.add_field(name="👤 대상", value=대상.mention, inline=True)
                embed.add_field(name="💎 지급 금액", value=f"`{금액:,}` 루비", inline=True)
                embed.add_field(name="💰 현재 잔액", value=f"`{new_balance:,}` 루비", inline=True)
                if 사유:
                    embed.add_field(name="📝 사유", value=사유, inline=False)
                embed.set_footer(text=f"관리자: {interaction.user.display_name}")
                

                log_embed = discord.Embed(
                    title="📈 루비 추가 로그",
                    description=f"관리자가 루비를 지급했습니다.",
                    color=0x27ae60,
                    timestamp=datetime.now()
                )
                log_embed.add_field(name="👤 대상", value=f"{대상.mention} ({대상.display_name})", inline=True)
                log_embed.add_field(name="💎 지급 금액", value=f"`{금액:,}` 루비", inline=True)
                log_embed.add_field(name="💰 현재 잔액", value=f"`{new_balance:,}` 루비", inline=True)
                log_embed.add_field(name="👨‍💼 관리자", value=f"{interaction.user.mention} ({interaction.user.display_name})", inline=True)
                if 사유:
                    log_embed.add_field(name="📝 사유", value=사유, inline=False)
                log_embed.set_footer(text="💎 Ruby System")
                
                await self.send_ruby_log(log_embed)
                await interaction.response.send_message(embed=embed)
            

            elif 관리유형 == "차감":
                if not 대상 or not 금액:
                    embed = discord.Embed(
                        title="❌ 필수 정보 누락",
                        description="대상과 금액을 모두 입력해주세요.",
                        color=0xe74c3c,
                        timestamp=datetime.now()
                    )
                    embed.set_footer(text="💎 Ruby System")
                    await interaction.response.send_message(embed=embed, ephemeral=True)
                    return
                
                if 금액 <= 0:
                    embed = discord.Embed(
                        title="❌ 잘못된 금액",
                        description="금액은 1 이상이어야 합니다.",
                        color=0xe74c3c,
                        timestamp=datetime.now()
                    )
                    embed.set_footer(text="💎 Ruby System")
                    await interaction.response.send_message(embed=embed, ephemeral=True)
                    return
                
                new_balance = self.update_user_balance(
                    대상.id,
                    대상.display_name,
                    -금액,
                    interaction.user.id,
                    사유,
                    "admin_deduct"
                )
                
                embed = discord.Embed(
                    title="📉 루비 차감 완료",
                    description=f"{대상.mention}님의 루비를 차감했습니다.",
                    color=0xe67e22,
                    timestamp=datetime.now()
                )
                embed.add_field(name="👤 대상", value=대상.mention, inline=True)
                embed.add_field(name="💸 차감 금액", value=f"`{금액:,}` 루비", inline=True)
                embed.add_field(name="💰 현재 잔액", value=f"`{new_balance:,}` 루비", inline=True)
                if 사유:
                    embed.add_field(name="📝 사유", value=사유, inline=False)
                embed.set_footer(text=f"관리자: {interaction.user.display_name}")
                

                log_embed = discord.Embed(
                    title="📉 루비 차감 로그",
                    description=f"관리자가 루비를 차감했습니다.",
                    color=0xe67e22,
                    timestamp=datetime.now()
                )
                log_embed.add_field(name="👤 대상", value=f"{대상.mention} ({대상.display_name})", inline=True)
                log_embed.add_field(name="💸 차감 금액", value=f"`{금액:,}` 루비", inline=True)
                log_embed.add_field(name="💰 현재 잔액", value=f"`{new_balance:,}` 루비", inline=True)
                log_embed.add_field(name="👨‍💼 관리자", value=f"{interaction.user.mention} ({interaction.user.display_name})", inline=True)
                if 사유:
                    log_embed.add_field(name="📝 사유", value=사유, inline=False)
                log_embed.set_footer(text="💎 Ruby System")
                
                await self.send_ruby_log(log_embed)
                await interaction.response.send_message(embed=embed)
            

            elif 관리유형 == "조회":
                if not 대상:
                    embed = discord.Embed(
                        title="❌ 대상 미선택",
                        description="조회할 대상을 선택해주세요.",
                        color=0xe74c3c,
                        timestamp=datetime.now()
                    )
                    embed.set_footer(text="💎 Ruby System")
                    await interaction.response.send_message(embed=embed, ephemeral=True)
                    return
                

                self.init_user_ruby(대상.id, 대상.display_name)
                

                balance = self.get_user_balance(대상.id)
                
                embed = discord.Embed(
                    title="🔍 루비 잔액 조회",
                    description=f"{대상.mention}님의 루비 잔액입니다.",
                    color=0x3498db,
                    timestamp=datetime.now()
                )
                embed.add_field(name="👤 대상", value=대상.mention, inline=True)
                embed.add_field(name="💰 현재 잔액", value=f"`{balance:,}` 루비", inline=True)
                embed.set_thumbnail(url=대상.display_avatar.url)
                embed.set_footer(text=f"조회자: {interaction.user.display_name} (관리자)")
                
                await interaction.response.send_message(embed=embed, ephemeral=True)
            

            elif 관리유형 == "초기화":
                if not 대상:
                    embed = discord.Embed(
                        title="❌ 대상 미선택",
                        description="초기화할 대상을 선택해주세요.",
                        color=0xe74c3c,
                        timestamp=datetime.now()
                    )
                    embed.set_footer(text="💎 Ruby System")
                    await interaction.response.send_message(embed=embed, ephemeral=True)
                    return
                
                old_balance = self.reset_user_balance(
                    대상.id,
                    대상.display_name,
                    interaction.user.id,
                    사유
                )
                
                embed = discord.Embed(
                    title="🔄 루비 초기화 완료",
                    description=f"{대상.mention}님의 루비를 초기화했습니다.",
                    color=0x9b59b6,
                    timestamp=datetime.now()
                )
                embed.add_field(name="👤 대상", value=대상.mention, inline=True)
                embed.add_field(name="📊 이전 잔액", value=f"`{old_balance:,}` 루비", inline=True)
                embed.add_field(name="💰 현재 잔액", value="`0` 루비", inline=True)
                if 사유:
                    embed.add_field(name="📝 사유", value=사유, inline=False)
                embed.set_footer(text=f"관리자: {interaction.user.display_name}")
                

                log_embed = discord.Embed(
                    title="🔄 루비 초기화 로그",
                    description=f"관리자가 루비를 초기화했습니다.",
                    color=0x9b59b6,
                    timestamp=datetime.now()
                )
                log_embed.add_field(name="👤 대상", value=f"{대상.mention} ({대상.display_name})", inline=True)
                log_embed.add_field(name="📊 이전 잔액", value=f"`{old_balance:,}` 루비", inline=True)
                log_embed.add_field(name="💰 현재 잔액", value="`0` 루비", inline=True)
                log_embed.add_field(name="👨‍💼 관리자", value=f"{interaction.user.mention} ({interaction.user.display_name})", inline=True)
                if 사유:
                    log_embed.add_field(name="📝 사유", value=사유, inline=False)
                log_embed.set_footer(text="💎 Ruby System")
                
                await self.send_ruby_log(log_embed)
                await interaction.response.send_message(embed=embed)
            

            elif 관리유형 == "설정":
                embed = discord.Embed(
                    title="⚙️ 설정 기능",
                    description="현재 설정할 수 있는 항목이 없습니다.\n추후 업데이트 예정입니다.",
                    color=0x95a5a6,
                    timestamp=datetime.now()
                )
                embed.set_footer(text="💎 Ruby System")
                
                await interaction.response.send_message(embed=embed, ephemeral=True)
    
    @app_commands.command(name="루비로그", description="루비 로그 채널을 설정합니다")
    @app_commands.describe(채널="로그를 보낼 채널")
    async def set_ruby_log_channel(self, interaction: discord.Interaction, 채널: discord.TextChannel):

        if not self.has_required_role(interaction.user):
            embed = discord.Embed(
                title="❌ 권한 부족",
                description="이 명령어를 사용할 권한이 없습니다.",
                color=0xe74c3c,
                timestamp=datetime.now()
            )
            embed.set_footer(text="💎 Ruby System")
            await interaction.response.send_message(embed=embed, ephemeral=True)
            return
        
        self.log_channel_id = 채널.id
        
        embed = discord.Embed(
            title="📋 로그 채널 설정 완료",
            description=f"루비 시스템 로그가 {채널.mention} 채널로 전송됩니다.",
            color=0x27ae60,
            timestamp=datetime.now()
        )
        embed.add_field(name="📍 설정된 채널", value=채널.mention, inline=False)
        embed.set_footer(text=f"설정자: {interaction.user.display_name}")
        

        log_embed = discord.Embed(
            title="⚙️ 로그 채널 설정 로그",
            description="루비 시스템 로그 채널이 설정되었습니다.",
            color=0x3498db,
            timestamp=datetime.now()
        )
        log_embed.add_field(name="📍 설정된 채널", value=f"{채널.mention} ({채널.name})", inline=True)
        log_embed.add_field(name="👨‍💼 설정자", value=f"{interaction.user.mention} ({interaction.user.display_name})", inline=True)
        log_embed.set_footer(text="💎 Ruby System")
        
        await self.send_ruby_log(log_embed)
        await interaction.response.send_message(embed=embed)

async def setup(bot):
    await bot.add_cog(RubySystem(bot))