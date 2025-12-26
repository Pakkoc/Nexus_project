import discord
from discord import app_commands
from discord.ext import commands, tasks
import sqlite3
from datetime import datetime, timedelta
from typing import Optional
import asyncio

# ==================== 설정 영역 ====================
# 역할 ID 설정 (각 구독권 등급별 역할)
ROLE_IDS = {
    "PREMIUM": 1234567890123456789,    # PREMIUM 역할 ID
    "DELUXE": 1234567890123456789,     # DELUXE 역할 ID
    "STANDARD": 1234567890123456789,   # STANDARD 역할 ID
    "BASIC": 1234567890123456789,      # BASIC 역할 ID
    "CLASSIC": 1234567890123456789,    # CLASSIC 역할 ID
    "TEST": 1234567890123456789        # TEST 역할 ID (테스트용)
}

# 관리자 알림 채널 ID
ADMIN_CHANNEL_ID = 1234567890123456789  # 관리자 알림을 받을 채널 ID

# 구독권 가격 정보
SUBSCRIPTION_PRICES = {
    "PREMIUM": 50000,
    "DELUXE": 25000,
    "STANDARD": 15000,
    "BASIC": 10000,
    "CLASSIC": 5000,
    "TEST": 100  # 테스트용
}
# ================================================

class SubscriptionView(discord.ui.View):
    """구독 메인 메뉴 버튼"""
    def __init__(self):
        super().__init__(timeout=None)
    
    @discord.ui.button(label="📝 구독권 안내", style=discord.ButtonStyle.primary, custom_id="sub_info")
    async def info_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        embed = discord.Embed(
            title="📋 구독권 안내",
            description="종합게임 커뮤니티 구독권 혜택 안내입니다.",
            color=discord.Color.blue()
        )
        
        embed.add_field(
            name="💎 PREMIUM 후원",
            value="50,000원 / 월\n최고급 혜택 제공",
            inline=False
        )
        embed.add_field(
            name="🌟 DELUXE 후원",
            value="25,000원 / 월\n고급 혜택 제공",
            inline=False
        )
        embed.add_field(
            name="⭐ STANDARD 후원",
            value="15,000원 / 월\n표준 혜택 제공",
            inline=False
        )
        embed.add_field(
            name="✨ BASIC 후원",
            value="10,000원 / 월\n기본 혜택 제공",
            inline=False
        )
        embed.add_field(
            name="🎫 CLASSIC 후원",
            value="5,000원 / 월\n클래식 혜택 제공",
            inline=False
        )
        
        await interaction.response.send_message(embed=embed, view=SubscriptionView(), ephemeral=True)
    
    @discord.ui.button(label="📨 구독확인요청", style=discord.ButtonStyle.green, custom_id="sub_request")
    async def request_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        view = SelectSubscriptionView()
        await interaction.response.send_message(
            "구독하실 등급을 선택해주세요:",
            view=view,
            ephemeral=True
        )
    
    @discord.ui.button(label="⏳ 남은구독기간", style=discord.ButtonStyle.gray, custom_id="sub_remaining")
    async def remaining_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        cog = interaction.client.get_cog('SubscriptionCog')
        if cog:
            await cog.check_remaining_time(interaction)

class SelectSubscriptionView(discord.ui.View):
    """구독권 선택 버튼"""
    def __init__(self):
        super().__init__(timeout=300)
    
    @discord.ui.button(label="💎 PREMIUM", style=discord.ButtonStyle.primary)
    async def premium_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self.ask_depositor_name(interaction, "PREMIUM")
    
    @discord.ui.button(label="🌟 DELUXE", style=discord.ButtonStyle.primary)
    async def deluxe_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self.ask_depositor_name(interaction, "DELUXE")
    
    @discord.ui.button(label="⭐ STANDARD", style=discord.ButtonStyle.primary)
    async def standard_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self.ask_depositor_name(interaction, "STANDARD")
    
    @discord.ui.button(label="✨ BASIC", style=discord.ButtonStyle.primary)
    async def basic_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self.ask_depositor_name(interaction, "BASIC")
    
    @discord.ui.button(label="🎫 CLASSIC", style=discord.ButtonStyle.primary)
    async def classic_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self.ask_depositor_name(interaction, "CLASSIC")
    
    async def ask_depositor_name(self, interaction: discord.Interaction, sub_type: str):
        modal = DepositorNameModal(sub_type)
        await interaction.response.send_modal(modal)

class DepositorNameModal(discord.ui.Modal, title="입금자명 입력"):
    """입금자명 입력 모달"""
    def __init__(self, sub_type: str):
        super().__init__()
        self.sub_type = sub_type
    
    depositor_name = discord.ui.TextInput(
        label="입금자명",
        placeholder="예: 홍길동",
        required=True,
        max_length=50
    )
    
    async def on_submit(self, interaction: discord.Interaction):
        view = SelectMonthsView(self.sub_type, self.depositor_name.value)
        await interaction.response.send_message(
            f"구독 기간을 선택해주세요:\n구독권: {self.sub_type}\n입금자명: {self.depositor_name.value}",
            view=view,
            ephemeral=True
        )

class SelectMonthsView(discord.ui.View):
    """구독 기간 선택 버튼"""
    def __init__(self, sub_type: str, depositor_name: str):
        super().__init__(timeout=300)
        self.sub_type = sub_type
        self.depositor_name = depositor_name
    
    @discord.ui.button(label="1개월", style=discord.ButtonStyle.success)
    async def one_month(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self.submit_request(interaction, 1)
    
    @discord.ui.button(label="3개월", style=discord.ButtonStyle.success)
    async def three_months(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self.submit_request(interaction, 3)
    
    @discord.ui.button(label="5개월", style=discord.ButtonStyle.success)
    async def five_months(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self.submit_request(interaction, 5)
    
    async def submit_request(self, interaction: discord.Interaction, months: int):
        cog = interaction.client.get_cog('SubscriptionCog')
        if cog:
            await cog.submit_subscription_request(
                interaction,
                self.sub_type,
                self.depositor_name,
                months
            )

class ApprovalView(discord.ui.View):
    """관리자 승인/미승인 버튼"""
    def __init__(self, user_id: int, sub_type: str, depositor_name: str, months: int):
        super().__init__(timeout=None)
        self.user_id = user_id
        self.sub_type = sub_type
        self.depositor_name = depositor_name
        self.months = months
    
    @discord.ui.button(label="✅ 구독승인", style=discord.ButtonStyle.success, custom_id="approve")
    async def approve_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        cog = interaction.client.get_cog('SubscriptionCog')
        if cog:
            await cog.approve_subscription(
                interaction,
                self.user_id,
                self.sub_type,
                self.depositor_name,
                self.months
            )
            # 버튼 비활성화
            for item in self.children:
                item.disabled = True
            await interaction.message.edit(view=self)
    
    @discord.ui.button(label="❌ 구독미승인", style=discord.ButtonStyle.danger, custom_id="reject")
    async def reject_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        cog = interaction.client.get_cog('SubscriptionCog')
        if cog:
            await cog.reject_subscription(interaction, self.user_id)
            # 버튼 비활성화
            for item in self.children:
                item.disabled = True
            await interaction.message.edit(view=self)

class SubscriptionCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.db_name = "subscriptions.db"
        self.init_database()
        self.check_subscriptions.start()
    
    def init_database(self):
        """데이터베이스 초기화"""
        conn = sqlite3.connect(self.db_name)
        c = conn.cursor()
        c.execute('''
            CREATE TABLE IF NOT EXISTS subscriptions (
                user_id INTEGER PRIMARY KEY,
                username TEXT,
                subscription_type TEXT,
                start_date TEXT,
                end_date TEXT,
                months INTEGER,
                status TEXT,
                depositor_name TEXT,
                role_id INTEGER,
                notified INTEGER DEFAULT 0
            )
        ''')
        conn.commit()
        conn.close()
    
    @app_commands.command(name="구독", description="구독 시스템 메인 메뉴")
    async def subscription(self, interaction: discord.Interaction):
        embed = discord.Embed(
            title="📢 구독 시스템",
            description="아래 버튼을 선택하여 원하시는 작업을 진행해주세요.",
            color=discord.Color.gold()
        )
        view = SubscriptionView()
        await interaction.response.send_message(embed=embed, view=view, ephemeral=True)
    
    async def check_remaining_time(self, interaction: discord.Interaction):
        """남은 구독 기간 확인"""
        conn = sqlite3.connect(self.db_name)
        c = conn.cursor()
        c.execute(
            "SELECT subscription_type, start_date, end_date, status FROM subscriptions WHERE user_id = ?",
            (interaction.user.id,)
        )
        result = c.fetchone()
        conn.close()
        
        if result and result[3] == "active":
            sub_type, start_date, end_date, status = result
            end = datetime.strptime(end_date, "%Y-%m-%d")
            remaining = (end - datetime.now()).days
            
            embed = discord.Embed(
                title="⏳ 구독 정보",
                color=discord.Color.green()
            )
            embed.add_field(name="구독권", value=sub_type, inline=False)
            embed.add_field(name="시작일", value=start_date, inline=True)
            embed.add_field(name="종료일", value=end_date, inline=True)
            embed.add_field(name="남은 일수", value=f"{remaining}일", inline=False)
            
            await interaction.response.send_message(embed=embed, ephemeral=True)
        else:
            embed = discord.Embed(
                title="❌ 구독 정보 없음",
                description="현재 구독권이 없습니다. 구독하시겠습니까?",
                color=discord.Color.red()
            )
            view = discord.ui.View()
            view.add_item(discord.ui.Button(
                label="📨 구독확인요청",
                style=discord.ButtonStyle.green,
                custom_id="sub_request"
            ))
            await interaction.response.send_message(embed=embed, view=SubscriptionView(), ephemeral=True)
    
    async def submit_subscription_request(
        self,
        interaction: discord.Interaction,
        sub_type: str,
        depositor_name: str,
        months: int
    ):
        """구독 요청 제출"""
        start_date = datetime.now().strftime("%Y-%m-%d")
        
        # 관리자 채널로 알림 전송
        admin_channel = self.bot.get_channel(ADMIN_CHANNEL_ID)
        if admin_channel:
            embed = discord.Embed(
                title="🔔 새 구독 요청",
                color=discord.Color.orange()
            )
            embed.add_field(name="유저명", value=f"{interaction.user.name} ({interaction.user.mention})", inline=False)
            embed.add_field(name="입금자명", value=depositor_name, inline=True)
            embed.add_field(name="구독권 종류", value=sub_type, inline=True)
            embed.add_field(name="시작일", value=start_date, inline=True)
            embed.add_field(name="구독 개월", value=f"{months}개월", inline=True)
            embed.add_field(name="총 금액", value=f"{SUBSCRIPTION_PRICES[sub_type] * months:,}원", inline=True)
            
            view = ApprovalView(interaction.user.id, sub_type, depositor_name, months)
            await admin_channel.send(embed=embed, view=view)
        
        await interaction.response.send_message(
            "✅ 구독 요청이 제출되었습니다. 관리자 승인을 기다려주세요.",
            ephemeral=True
        )
    
    async def approve_subscription(
        self,
        interaction: discord.Interaction,
        user_id: int,
        sub_type: str,
        depositor_name: str,
        months: int
    ):
        """구독 승인"""
        user = await self.bot.fetch_user(user_id)
        guild = interaction.guild
        member = guild.get_member(user_id)
        
        # 승인 시각 기준으로 구독 기간 설정
        start_date = datetime.now()
        end_date = start_date + timedelta(days=30 * months)
        
        # 역할 지급
        role_id = ROLE_IDS.get(sub_type)
        if role_id and member:
            role = guild.get_role(role_id)
            if role:
                await member.add_roles(role)
        
        # DB에 저장
        conn = sqlite3.connect(self.db_name)
        c = conn.cursor()
        c.execute('''
            INSERT OR REPLACE INTO subscriptions 
            (user_id, username, subscription_type, start_date, end_date, months, status, depositor_name, role_id, notified)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            user_id,
            user.name,
            sub_type,
            start_date.strftime("%Y-%m-%d"),
            end_date.strftime("%Y-%m-%d"),
            months,
            "active",
            depositor_name,
            role_id,
            0
        ))
        conn.commit()
        conn.close()
        
        # 유저에게 DM 발송
        try:
            embed = discord.Embed(
                title="✅ 구독 승인 완료",
                description=f"{sub_type} 구독이 승인되었습니다!",
                color=discord.Color.green()
            )
            embed.add_field(name="시작일", value=start_date.strftime("%Y-%m-%d"), inline=True)
            embed.add_field(name="종료일", value=end_date.strftime("%Y-%m-%d"), inline=True)
            embed.add_field(name="기간", value=f"{months}개월", inline=True)
            await user.send(embed=embed)
        except:
            pass
        
        await interaction.response.send_message(f"✅ {user.name}님의 구독을 승인했습니다.", ephemeral=True)
    
    async def reject_subscription(self, interaction: discord.Interaction, user_id: int):
        """구독 미승인"""
        user = await self.bot.fetch_user(user_id)
        
        # 유저에게 DM 발송
        try:
            await user.send("❌ 구독권 구매 확인이 되지 않아 요청이 미승인되었습니다.")
        except:
            pass
        
        await interaction.response.send_message(f"❌ {user.name}님의 구독을 미승인했습니다.", ephemeral=True)
    
    @app_commands.command(name="구독자목록", description="구독자 목록 확인 (관리자 전용)")
    @app_commands.describe(옵션="전체/일반/특정유저명")
    async def subscription_list(self, interaction: discord.Interaction, 옵션: Optional[str] = "전체"):
        # 관리자 권한 확인 (필요시 수정)
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ 관리자만 사용할 수 있는 명령어입니다.", ephemeral=True)
            return
        
        conn = sqlite3.connect(self.db_name)
        c = conn.cursor()
        
        if 옵션 == "전체":
            c.execute("SELECT * FROM subscriptions WHERE status = 'active'")
            results = c.fetchall()
            
            # 통계 계산
            total_count = len(results)
            type_counts = {}
            total_revenue = 0
            
            for row in results:
                sub_type = row[2]
                months = row[5]
                type_counts[sub_type] = type_counts.get(sub_type, 0) + 1
                total_revenue += SUBSCRIPTION_PRICES[sub_type] * months
            
            embed = discord.Embed(
                title="📊 전체 구독 현황",
                color=discord.Color.blue()
            )
            embed.add_field(name="전체 구독자 수", value=f"{total_count}명", inline=False)
            
            for sub_type, count in type_counts.items():
                embed.add_field(name=f"{sub_type}", value=f"{count}명", inline=True)
            
            embed.add_field(name="총 누적 수익", value=f"{total_revenue:,}원", inline=False)
            
            # 구독자 목록
            if results:
                sub_list = "\n".join([
                    f"• {row[1]} - {row[2]} ({row[3]} ~ {row[4]})"
                    for row in results[:10]  # 최대 10명만 표시
                ])
                if len(results) > 10:
                    sub_list += f"\n... 외 {len(results) - 10}명"
                embed.add_field(name="구독자 목록", value=sub_list, inline=False)
            
            await interaction.response.send_message(embed=embed, ephemeral=True)
        
        elif 옵션 == "일반":
            c.execute("SELECT username, subscription_type, start_date, end_date FROM subscriptions WHERE status = 'active'")
            results = c.fetchall()
            
            if results:
                sub_list = "\n".join([
                    f"• {row[0]} - {row[1]} ({row[2]} ~ {row[3]})"
                    for row in results
                ])
                embed = discord.Embed(
                    title="📋 일반 구독자 목록",
                    description=sub_list,
                    color=discord.Color.green()
                )
            else:
                embed = discord.Embed(
                    title="📋 일반 구독자 목록",
                    description="구독자가 없습니다.",
                    color=discord.Color.red()
                )
            
            await interaction.response.send_message(embed=embed, ephemeral=True)
        
        else:
            # 특정 유저 검색
            c.execute(
                "SELECT * FROM subscriptions WHERE username LIKE ? AND status = 'active'",
                (f"%{옵션}%",)
            )
            result = c.fetchone()
            
            if result:
                embed = discord.Embed(
                    title=f"👤 {result[1]}님의 구독 정보",
                    color=discord.Color.purple()
                )
                embed.add_field(name="구독권", value=result[2], inline=True)
                embed.add_field(name="시작일", value=result[3], inline=True)
                embed.add_field(name="종료일", value=result[4], inline=True)
                embed.add_field(name="기간", value=f"{result[5]}개월", inline=True)
                embed.add_field(name="입금자명", value=result[7], inline=True)
            else:
                embed = discord.Embed(
                    title="❌ 검색 결과 없음",
                    description=f"'{옵션}' 유저를 찾을 수 없습니다.",
                    color=discord.Color.red()
                )
            
            await interaction.response.send_message(embed=embed, ephemeral=True)
        
        conn.close()
    
    @tasks.loop(hours=24)
    async def check_subscriptions(self):
        """매일 구독 만료 및 알림 체크"""
        conn = sqlite3.connect(self.db_name)
        c = conn.cursor()
        c.execute("SELECT * FROM subscriptions WHERE status = 'active'")
        results = c.fetchall()
        
        today = datetime.now()
        
        for row in results:
            user_id, username, sub_type, start_date, end_date, months, status, depositor_name, role_id, notified = row
            end = datetime.strptime(end_date, "%Y-%m-%d")
            days_remaining = (end - today).days
            
            # 만료 처리
            if days_remaining <= 0:
                user = await self.bot.fetch_user(user_id)
                guild = self.bot.guilds[0]  # 첫 번째 길드 (필요시 수정)
                member = guild.get_member(user_id)
                
                # 역할 제거
                if role_id and member:
                    role = guild.get_role(role_id)
                    if role:
                        await member.remove_roles(role)
                
                # 상태 업데이트
                c.execute(
                    "UPDATE subscriptions SET status = 'expired' WHERE user_id = ?",
                    (user_id,)
                )
                
                try:
                    await user.send(f"❌ {sub_type} 구독이 만료되었습니다.")
                except:
                    pass
            
            # 7일 전 알림
            elif days_remaining == 7 and notified == 0:
                user = await self.bot.fetch_user(user_id)
                try:
                    embed = discord.Embed(
                        title="🔔 구독 만료 알림",
                        description=f"{sub_type} 구독이 7일 후 만료됩니다.",
                        color=discord.Color.orange()
                    )
                    embed.add_field(name="만료일", value=end_date, inline=True)
                    embed.add_field(name="남은 일수", value=f"{days_remaining}일", inline=True)
                    await user.send(embed=embed)
                    
                    # 알림 발송 기록
                    c.execute(
                        "UPDATE subscriptions SET notified = 1 WHERE user_id = ?",
                        (user_id,)
                    )
                except:
                    pass
        
        conn.commit()
        conn.close()
    
    @check_subscriptions.before_loop
    async def before_check_subscriptions(self):
        await self.bot.wait_until_ready()
    
    def cog_unload(self):
        self.check_subscriptions.cancel()

async def setup(bot):
    await bot.add_cog(SubscriptionCog(bot))