# ranking.py
import discord
from discord.ext import commands, tasks
from discord import app_commands
import sqlite3
from datetime import datetime
import config

class RankingSystem(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.ranking_channel_id = None
        self.ranking_message_id = None
        
    @commands.Cog.listener()
    async def on_ready(self):
        print("RankingSystem: 랭킹 시스템이 준비되었습니다.")
        if not self.ranking_update_loop.is_running():
            self.ranking_update_loop.start()
    
    def cog_unload(self):
        if self.ranking_update_loop.is_running():
            self.ranking_update_loop.cancel()
    
    def get_db_connection(self):
        return sqlite3.connect(config.DATABASE_FILE)
    
    def get_top_users(self, limit: int = 10):
        """상위 유저 조회"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT user_id, username, balance
            FROM user_coins
            ORDER BY balance DESC
            LIMIT ?
        ''', (limit,))
        
        results = cursor.fetchall()
        conn.close()
        
        return results
    
    def create_ranking_embed(self):
        """랭킹 임베드 생성"""
        top_users = self.get_top_users(10)
        
        embed = discord.Embed(
            title="🏆 토피아 토피 랭킹 TOP 10",
            description="서버 내 토피 보유 상위 10명",
            color=0xffd700,
            timestamp=datetime.now()
        )
        
        if not top_users:
            embed.add_field(name="랭킹", value="아직 기록이 없습니다.", inline=False)
        else:
            medals = ["🥇", "🥈", "🥉"]
            ranking_text = []
            
            for idx, (user_id, username, balance) in enumerate(top_users, 1):
                if idx <= 3:
                    rank_icon = medals[idx-1]
                else:
                    rank_icon = f"`{idx}위`"
                
                # 유저 멘션 시도
                user = self.bot.get_user(user_id)
                if user:
                    user_display = user.mention
                else:
                    user_display = f"**{username}**"
                
                ranking_text.append(f"{rank_icon} {user_display} - `{balance:,}` 토피")
            
            embed.add_field(
                name="💰 랭킹",
                value="\n".join(ranking_text),
                inline=False
            )
        
        embed.set_footer(text="🔄 매시 정각 및 30분에 자동 갱신됩니다")
        
        # 총 서버 자산 추가
        conn = self.get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT SUM(balance) FROM user_coins')
        total_balance = cursor.fetchone()[0] or 0
        cursor.execute('SELECT COUNT(*) FROM user_coins')
        total_users = cursor.fetchone()[0] or 0
        conn.close()
        
        embed.add_field(
            name="📊 서버 통계",
            value=f"총 유저: {total_users}명\n총 자산: {total_balance:,} 토피",
            inline=False
        )
        
        return embed
    
    @tasks.loop(minutes=30)
    async def ranking_update_loop(self):
        """30분마다 랭킹 업데이트"""
        if not self.ranking_channel_id or not self.ranking_message_id:
            return
        
        try:
            channel = self.bot.get_channel(self.ranking_channel_id)
            if not channel:
                return
            
            message = await channel.fetch_message(self.ranking_message_id)
            if not message:
                return
            
            embed = self.create_ranking_embed()
            await message.edit(embed=embed)
            
        except Exception as e:
            print(f"랭킹 업데이트 실패: {e}")
    
    @ranking_update_loop.before_loop
    async def before_ranking_update(self):
        await self.bot.wait_until_ready()
    
    @app_commands.command(name="토피랭킹출력", description="토피 랭킹을 출력합니다 (관리자 전용)")
    @app_commands.default_permissions(administrator=True)
    async def show_ranking(self, interaction: discord.Interaction):
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ 관리자만 사용할 수 있는 명령어입니다.", ephemeral=True)
            return
        
        embed = self.create_ranking_embed()
        
        await interaction.response.send_message("✅ 랭킹을 출력합니다...", ephemeral=True)
        
        # 랭킹 메시지 전송
        message = await interaction.channel.send(embed=embed)
        
        # 채널 및 메시지 ID 저장
        self.ranking_channel_id = interaction.channel.id
        self.ranking_message_id = message.id
        
        # 즉시 업데이트 시작
        if not self.ranking_update_loop.is_running():
            self.ranking_update_loop.start()
    
    @app_commands.command(name="랭킹", description="현재 토피 랭킹을 확인합니다")
    async def check_ranking(self, interaction: discord.Interaction):
        """일반 유저용 랭킹 확인"""
        embed = self.create_ranking_embed()
        await interaction.response.send_message(embed=embed, ephemeral=True)
    
    @app_commands.command(name="내순위", description="내 토피 순위를 확인합니다")
    async def my_rank(self, interaction: discord.Interaction):
        """개인 순위 확인"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        # 전체 유저 중 내 순위 찾기
        cursor.execute('''
            SELECT COUNT(*) + 1
            FROM user_coins
            WHERE balance > (
                SELECT balance FROM user_coins WHERE user_id = ?
            )
        ''', (interaction.user.id,))
        
        rank = cursor.fetchone()[0]
        
        cursor.execute('SELECT balance FROM user_coins WHERE user_id = ?', (interaction.user.id,))
        result = cursor.fetchone()
        balance = result[0] if result else 0
        
        cursor.execute('SELECT COUNT(*) FROM user_coins')
        total_users = cursor.fetchone()[0]
        
        conn.close()
        
        embed = discord.Embed(
            title="📊 내 순위",
            color=0x3498db,
            timestamp=datetime.now()
        )
        
        embed.add_field(name="순위", value=f"**{rank}위** / {total_users}명", inline=True)
        embed.add_field(name="보유 토피", value=f"{balance:,} 토피", inline=True)
        embed.set_thumbnail(url=interaction.user.display_avatar.url)
        embed.set_footer(text=f"{interaction.user.display_name}")
        
        await interaction.response.send_message(embed=embed, ephemeral=True)


async def setup(bot):
    await bot.add_cog(RankingSystem(bot))
