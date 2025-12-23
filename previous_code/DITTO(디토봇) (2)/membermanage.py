# membermanage.py
import discord
from discord.ext import commands
from discord import app_commands
import sqlite3
import asyncio
from datetime import datetime, timedelta
import config

class MemberManage(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.init_database()
    
    def init_database(self):
        """회원 관리 시스템용 데이터베이스 테이블 초기화"""
        conn = sqlite3.connect(config.DATABASE_FILE)
        cursor = conn.cursor()
        
        # 경고 시스템 테이블
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS warnings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                username TEXT NOT NULL,
                admin_id INTEGER NOT NULL,
                admin_username TEXT NOT NULL,
                reason TEXT NOT NULL,
                warning_count INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # 타임아웃 기록 테이블
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS timeouts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                username TEXT NOT NULL,
                admin_id INTEGER NOT NULL,
                admin_username TEXT NOT NULL,
                reason TEXT NOT NULL,
                duration_seconds INTEGER NOT NULL,
                start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                end_time DATETIME NOT NULL,
                is_active BOOLEAN DEFAULT TRUE
            )
        ''')
        
        # 이의제기 테이블
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS appeals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                username TEXT NOT NULL,
                punishment_type TEXT NOT NULL,
                appeal_content TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                admin_response TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                responded_at DATETIME
            )
        ''')
        
        # 채널 설정 테이블 (로그 채널용)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS log_channels (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id INTEGER NOT NULL,
                channel_type TEXT NOT NULL,
                channel_id INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # 정지된 사용자 테이블
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS suspended_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                username TEXT NOT NULL,
                guild_id INTEGER NOT NULL,
                suspended_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                is_active BOOLEAN DEFAULT TRUE
            )
        ''')
        
        conn.commit()
        conn.close()
    
    def get_user_warnings(self, user_id):
        """사용자의 총 경고 횟수 조회"""
        conn = sqlite3.connect(config.DATABASE_FILE)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT COALESCE(SUM(warning_count), 0) as total_warnings
            FROM warnings 
            WHERE user_id = ?
        ''', (user_id,))
        
        result = cursor.fetchone()
        conn.close()
        return result[0] if result else 0
    
    def get_log_channels(self, guild_id):
        """로그 채널 설정 조회"""
        conn = sqlite3.connect(config.DATABASE_FILE)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT channel_type, channel_id 
            FROM log_channels 
            WHERE guild_id = ?
        ''', (guild_id,))
        
        channels = {}
        for row in cursor.fetchall():
            channels[row[0]] = row[1]
        
        conn.close()
        return channels
    
    def suspend_user(self, user_id, username, guild_id):
        """사용자 정지 처리"""
        conn = sqlite3.connect(config.DATABASE_FILE)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO suspended_users (user_id, username, guild_id)
            VALUES (?, ?, ?)
        ''', (user_id, username, guild_id))
        
        conn.commit()
        conn.close()
    
    def is_user_suspended(self, user_id, guild_id):
        """사용자 정지 상태 확인"""
        conn = sqlite3.connect(config.DATABASE_FILE)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT COUNT(*) FROM suspended_users 
            WHERE user_id = ? AND guild_id = ? AND is_active = TRUE
        ''', (user_id, guild_id))
        
        result = cursor.fetchone()
        conn.close()
        return result[0] > 0
    
    async def send_user_log(self, guild, punishment_type, target_user, reason, count_or_duration, admin_user=None):
        """사용자 로그 채널에 로그 전송"""
        try:
            channels = self.get_log_channels(guild.id)
            if 'user_log' not in channels:
                return
        
            channel = guild.get_channel(channels['user_log'])
            if not channel:
                return
            
            # 처벌 타입에 따른 색상과 아이콘 설정
            if punishment_type == "warning_add":
                color = 0xff6b6b
                emoji = "⚠️"
                title = "경고 부여"
                # 현재 누적 경고 수 계산
                current_warnings = self.get_user_warnings(target_user.id)
                description = (f"⚠️ **경고가 부여되었습니다.**\n\n"
                            f"👤 **처벌대상**: @{target_user.name}\n"
                            f"⚖️ **처벌내용**: 경고 부여\n"
                            f"📊 **경고 수**: {count_or_duration}회\n"
                            f"📈 **누적경고**: {current_warnings}회\n"
                            f"📝 **사유**: {reason}")
            elif punishment_type == "warning_remove":
                color = 0x00ff00
                emoji = "✅"
                title = "경고 차감"
                # 현재 누적 경고 수 계산 (차감 후의 결과를 반영)
                current_warnings = self.get_user_warnings(target_user.id)
                description = (f"✅ **경고가 차감되었습니다.**\n\n"
                            f"👤 **처벌대상**: @{target_user.name}\n"
                            f"⚖️ **처벌내용**: 경고 차감\n"
                            f"📊 **경고 수**: {count_or_duration}회\n"
                            f"📈 **누적경고**: {current_warnings}회\n"
                            f"📝 **사유**: {reason}")
            elif punishment_type == "timeout":
                color = 0xff9900
                emoji = "🔇"
                title = "타임아웃"
                description = (f"🔇 **타임아웃이 적용되었습니다.**\n\n"
                            f"👤 **처벌대상**: {target_user.mention}\n"
                            f"⚖️ **처벌내용**: 타임아웃\n"
                            f"⏰ **기간**: {count_or_duration}\n"
                            f"📝 **사유**: {reason}")
            elif punishment_type == "timeout_remove":
                color = 0x00ff00
                emoji = "🔊"
                title = "타임아웃 해제"
                description = (f"🔊 **타임아웃이 해제되었습니다.**\n\n"
                            f"👤 **처벌대상**: {target_user.mention}\n"
                            f"⚖️ **처벌내용**: 타임아웃 해제\n"
                            f"📝 **사유**: {reason}")
            elif punishment_type == "notice":
                color = 0xffff00
                emoji = "📋"
                title = "주의"
                description = (f"📋 **주의가 전달되었습니다.**\n\n"
                            f"👤 **처벌대상**: {target_user.mention}\n"
                            f"⚖️ **처벌내용**: 주의\n"
                            f"📝 **사유**: {reason}")
            else:
                # 기본값 설정
                color = 0x3498db
                emoji = "📋"
                title = punishment_type
                description = f"처벌 대상: {target_user.mention}\n사유: {reason}"
            
            embed = discord.Embed(
                title=f"{emoji} {title}",
                description=description,
                color=color,
                timestamp=datetime.now()
            )
            
            embed.set_footer(text="이의가 있으시면 하단 버튼을 이용해 주시기 바랍니다.")
            
            # 이의제기 버튼 추가
            view = AppealView(target_user.id, punishment_type)
            await channel.send(embed=embed, view=view)
        except Exception as e:
            print(f"사용자 로그 전송 중 오류 발생: {e}")

    async def send_admin_log(self, guild, punishment_type, target_user, admin_user, reason, count_or_duration):
        """관리자 전용 로그 채널에 로그 전송"""
        try:
            channels = self.get_log_channels(guild.id)
            if 'admin_log' not in channels:
                return
            
            channel = guild.get_channel(channels['admin_log'])
            if not channel:
                return
            
            # 처벌 타입에 따른 설명 구성
            if punishment_type in ["경고 추가", "경고 차감"]:
                description = (f"🔒 **관리자 로그**\n\n"
                            f"👤 **대상자**: {target_user.mention} ({target_user.name})\n"
                            f"👮 **처벌자**: {admin_user.mention} ({admin_user.name})\n"
                            f"⚖️ **처벌 유형**: {punishment_type}\n"
                            f"🔢 **횟수**: {count_or_duration}회\n"
                            f"📝 **사유**: {reason}")
            elif punishment_type == "타임아웃":
                description = (f"🔒 **관리자 로그**\n\n"
                            f"👤 **대상자**: {target_user.mention} ({target_user.name})\n"
                            f"👮 **처벌자**: {admin_user.mention} ({admin_user.name})\n"
                            f"⚖️ **처벌 유형**: {punishment_type}\n"
                            f"⏰ **기간**: {count_or_duration}\n"
                            f"📝 **사유**: {reason}")
            else:
                description = (f"🔒 **관리자 로그**\n\n"
                            f"👤 **대상자**: {target_user.mention} ({target_user.name})\n"
                            f"👮 **처벌자**: {admin_user.mention} ({admin_user.name})\n"
                            f"⚖️ **처벌 유형**: {punishment_type}\n"
                            f"📝 **사유**: {reason}")
            
            embed = discord.Embed(
                title="🔒 관리자 로그",
                description=description,
                color=0x3498db,
                timestamp=datetime.now()
            )
            
            await channel.send(embed=embed)
        except Exception as e:
            print(f"관리자 로그 전송 중 오류 발생: {e}")

    async def send_dm_notification(self, user, punishment_type, reason):
        """사용자에게 DM으로 처벌 알림 전송"""
        try:
            description = (f"💼 **처벌 알림**\n\n"
                        f"💾ㅣ 귀하의 대한 처벌이 진행되었습니다. 공식 디스코드 https://discordapp.com/channels/1304451047330283520/1371112970423242853 채널을 확인 부탁드립니다."
                        f"📋 **안내사항**: *커뮤니티 규칙을 준수하시고, 올바른 소통 문화를 만들어 주시기 바랍니다.*")
            
            embed = discord.Embed(
                title="💼ㅣDISCORD :: TOPIA BOT",
                description=description,
                color=0xff6b6b,
                timestamp=datetime.now()
            )
            
            embed.set_footer(text="이의가 있으시면 서버 내 이의제기 시스템을 이용해 주시기 바랍니다.")
            
            await user.send(embed=embed)
        except discord.Forbidden:
            pass  # DM을 받을 수 없는 경우 무시
        except Exception as e:
            print(f"DM 알림 전송 중 오류 발생: {e}")

    async def send_warning_reduction_dm(self, user):
        """경고 5회 도달 시 경고차감권 사용 여부 문의"""
        try:
            description = (f"⚠️ **경고가 5회에 도달하여 활동이 정지되었습니다.**\n"
                        f"경고차감권을 사용하시겠습니까?\n\n"
                        f"📋 **안내사항**: 경고차감권을 사용하면 경고 1회가 차감되고 활동을 재개할 수 있습니다.\n"
                        f"사용하지 않으면 관리자의 추가 조치를 기다려야 합니다.")
            
            embed = discord.Embed(
                title="⚠️ 경고 5회 누적 안내",
                description=description,
                color=0xff0000,
                timestamp=datetime.now()
            )
            
            view = WarningReductionView(user.id)
            await user.send(embed=embed, view=view)
        except discord.Forbidden:
            pass  # DM을 받을 수 없는 경우 무시
        except Exception as e:
            print(f"경고차감권 DM 전송 중 오류 발생: {e}")
    
    # 로그 채널 설정 명령어
    @app_commands.command(name="로그채널설정", description="유저 로그 채널과 관리자 로그 채널을 설정합니다")
    @app_commands.describe(
        유저로그채널="유저에게 보여질 로그 채널",
        관리자로그채널="관리자 전용 로그 채널"
    )
    async def set_log_channels(self, interaction: discord.Interaction, 유저로그채널: discord.TextChannel, 관리자로그채널: discord.TextChannel):
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ 관리자 권한이 필요합니다.", ephemeral=True)
            return
        
        try:
            conn = sqlite3.connect(config.DATABASE_FILE)
            cursor = conn.cursor()
            
            # 기존 설정 삭제
            cursor.execute('DELETE FROM log_channels WHERE guild_id = ?', (interaction.guild_id,))
            
            # 새 설정 추가
            cursor.execute('''
                INSERT INTO log_channels (guild_id, channel_type, channel_id)
                VALUES (?, ?, ?), (?, ?, ?)
            ''', (interaction.guild_id, 'user_log', 유저로그채널.id,
                  interaction.guild_id, 'admin_log', 관리자로그채널.id))
            
            conn.commit()
            conn.close()
            
            embed = discord.Embed(
                title="✅ 로그 채널 설정 완료",
                color=0x00ff00
            )
            embed.add_field(name="유저 로그 채널", value=유저로그채널.mention, inline=False)
            embed.add_field(name="관리자 로그 채널", value=관리자로그채널.mention, inline=False)
            
            await interaction.response.send_message(embed=embed, ephemeral=True)
        except Exception as e:
            await interaction.response.send_message(f"❌ 로그 채널 설정 중 오류가 발생했습니다: {str(e)}", ephemeral=True)
    
    # 주의 명령어
    # 주의 명령어 (완전 수정)
    @app_commands.command(name="주의", description="사용자에게 주의를 줍니다")
    @app_commands.describe(대상="주의를 줄 사용자")
    async def notice_user(self, interaction: discord.Interaction, 대상: discord.Member):
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ 관리자 권한이 필요합니다.", ephemeral=True)
            return
        
        try:
            embed = discord.Embed(
                title="주의 처분 시스템",
                description="하단의 드롭다운에서 주의를 주고자 하였던 사유를 고르세요",
                color=0xffff00
            )
            
            view = NoticeReasonView(대상, interaction.user)
            await interaction.response.send_message(embed=embed, view=view, ephemeral=True)
        except Exception as e:
            await interaction.response.send_message(f"❌ 주의 처분 중 오류가 발생했습니다: {str(e)}", ephemeral=True)

    @app_commands.command(name="경고관리", description="사용자에게 경고를 추가하거나 차감합니다")
    @app_commands.describe(
        행동="추가 또는 차감",
        대상="경고를 받을 사용자",
        사유="경고 사유",
        횟수="경고 횟수"
    )
    @app_commands.choices(행동=[
        app_commands.Choice(name="추가", value="add"),
        app_commands.Choice(name="차감", value="remove")
    ])
    async def warning_manage(self, interaction: discord.Interaction, 행동: app_commands.Choice[str], 대상: discord.Member, 사유: str, 횟수: int):
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ 관리자 권한이 필요합니다.", ephemeral=True)
            return
        
        if 횟수 <= 0:
            await interaction.response.send_message("❌ 횟수는 1 이상이어야 합니다.", ephemeral=True)
            return
        
        try:
            conn = sqlite3.connect(config.DATABASE_FILE)
            cursor = conn.cursor()
            
            if 행동.value == "add":
                # 경고 추가
                cursor.execute('''
                    INSERT INTO warnings (user_id, username, admin_id, admin_username, reason, warning_count)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (대상.id, 대상.name, interaction.user.id, interaction.user.name, 사유, 횟수))
                
                conn.commit()
                
                # 추가 후 총 경고 수 계산
                total_warnings = self.get_user_warnings(대상.id)
                
                # 유저 로그 전송
                await self.send_user_log(interaction.guild, "warning_add", 대상, 사유, 횟수, interaction.user)
                
                # DM 알림 전송
                await self.send_dm_notification(대상, f"{횟수}회 경고", 사유)
                
                # 관리자 로그 전송
                await self.send_admin_log(interaction.guild, "경고 추가", 대상, interaction.user, 사유, 횟수)
                
                # 5회 경고 시 정지 처리 및 경고차감권 문의
                if total_warnings >= 5:
                    # 사용자 정지 처리
                    self.suspend_user(대상.id, 대상.name, interaction.guild_id)
                    
                    # 경고차감권 사용 여부 DM 전송
                    await self.send_warning_reduction_dm(대상)
                    
                    suspend_embed = discord.Embed(
                        title="⚠️ 자동 정지 실행",
                        description=f"{대상.mention}이 경고 5회 누적으로 인해 활동이 정지되었습니다.\n사용자에게 경고차감권 사용 여부를 문의했습니다.",
                        color=0xff0000
                    )
                    await self.send_admin_log(interaction.guild, "자동 정지", 대상, self.bot.user, "경고 5회 누적", "활동 정지")
                    
                    channels = self.get_log_channels(interaction.guild.id)
                    if 'admin_log' in channels:
                        admin_channel = interaction.guild.get_channel(channels['admin_log'])
                        if admin_channel:
                            await admin_channel.send(embed=suspend_embed)
                
                embed = discord.Embed(
                    title="✅ 경고 추가 완료",
                    description=f"{대상.mention}에게 {횟수}회 경고가 추가되었습니다.\n총 경고: {total_warnings}회",
                    color=0x00ff00
                )
                
            else:
                # 경고 차감
                cursor.execute('''
                    INSERT INTO warnings (user_id, username, admin_id, admin_username, reason, warning_count)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (대상.id, 대상.name, interaction.user.id, interaction.user.name, 사유, -횟수))
                
                conn.commit()
                
                # 차감 후 총 경고 수 계산
                total_warnings = max(0, self.get_user_warnings(대상.id))
                
                # 유저 로그 전송
                await self.send_user_log(interaction.guild, "warning_remove", 대상, 사유, 횟수, interaction.user)
                
                # DM 알림 전송
                await self.send_dm_notification(대상, f"{횟수}회 경고 차감", 사유)
                
                # 관리자 로그 전송
                await self.send_admin_log(interaction.guild, "경고 차감", 대상, interaction.user, 사유, 횟수)
                
                embed = discord.Embed(
                    title="✅ 경고 차감 완료",
                    description=f"{대상.mention}의 경고 {횟수}회가 차감되었습니다.\n현재 경고: {total_warnings}회",
                    color=0x00ff00
                )
            
            conn.close()
            
            await interaction.response.send_message(embed=embed, ephemeral=True)
        except Exception as e:
            await interaction.response.send_message(f"❌ 경고 관리 중 오류가 발생했습니다: {str(e)}", ephemeral=True)
    
    # 경고 조회 명령어
    @app_commands.command(name="경고조회", description="사용자의 경고 현황을 조회합니다")
    @app_commands.describe(대상="조회할 사용자")
    async def warning_check(self, interaction: discord.Interaction, 대상: discord.Member):
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ 관리자 권한이 필요합니다.", ephemeral=True)
            return
        
        try:
            total_warnings = self.get_user_warnings(대상.id)
            
            conn = sqlite3.connect(config.DATABASE_FILE)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT reason, warning_count, admin_username, created_at
                FROM warnings 
                WHERE user_id = ?
                ORDER BY created_at DESC
                LIMIT 10
            ''', (대상.id,))
            
            records = cursor.fetchall()
            conn.close()
            
            embed = discord.Embed(
                title="📋 경고 현황 조회",
                description=f"**대상자:** {대상.mention}\n**총 경고:** {total_warnings}회",
                color=0x3498db
            )
            
            if records:
                history = ""
                for record in records:
                    reason, count, admin, created = record
                    sign = "+" if count > 0 else ""
                    history += f"• {sign}{count}회 - {reason} (처리자: {admin})\n"
                    history += f"  └ {created[:16]}\n\n"
                
                # 임베드 필드 길이 제한 처리
                if len(history) > 1024:
                    history = history[:1020] + "..."
                
                embed.add_field(name="📝 최근 경고 기록", value=history, inline=False)
            else:
                embed.add_field(name="📝 경고 기록", value="경고 기록이 없습니다.", inline=False)
            
            await interaction.response.send_message(embed=embed, ephemeral=True)
        except Exception as e:
            await interaction.response.send_message(f"❌ 경고 조회 중 오류가 발생했습니다: {str(e)}", ephemeral=True)
    
    # 타임아웃 관리 명령어
    @app_commands.command(name="타임아웃관리", description="사용자를 타임아웃 처리합니다")
    @app_commands.describe(
        대상="타임아웃할 사용자",
        일="일 (0-27)",
        시간="시간 (0-23)",
        분="분 (0-59)",
        초="초 (0-59)",
        사유="타임아웃 사유"
    )
    async def timeout_manage(self, interaction: discord.Interaction, 대상: discord.Member, 일: int, 시간: int, 분: int, 초: int, 사유: str):
        if not interaction.user.guild_permissions.moderate_members:
            await interaction.response.send_message("❌ 멤버 관리 권한이 필요합니다.", ephemeral=True)
            return
        
        # 시간 유효성 검사
        if not (0 <= 일 <= 27 and 0 <= 시간 <= 23 and 0 <= 분 <= 59 and 0 <= 초 <= 59):
            await interaction.response.send_message("❌ 올바른 시간을 입력해주세요.", ephemeral=True)
            return
        
        # 총 시간 계산
        total_seconds = 일 * 86400 + 시간 * 3600 + 분 * 60 + 초
        
        if total_seconds == 0:
            await interaction.response.send_message("❌ 타임아웃 기간을 설정해주세요.", ephemeral=True)
            return
        
        if total_seconds > 2419200:  # 28일 제한
            await interaction.response.send_message("❌ 타임아웃 기간은 최대 28일입니다.", ephemeral=True)
            return
        
        try:
            # 타임아웃 적용
            timeout_until = datetime.now() + timedelta(seconds=total_seconds)
            await 대상.timeout(timeout_until, reason=사유)
            
            # 데이터베이스에 기록
            conn = sqlite3.connect(config.DATABASE_FILE)
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT INTO timeouts (user_id, username, admin_id, admin_username, reason, duration_seconds, end_time)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (대상.id, 대상.name, interaction.user.id, interaction.user.name, 사유, total_seconds, timeout_until))
            
            conn.commit()
            conn.close()
            
            # 기간 문자열 생성
            # 기간 문자열 생성
            duration_str = ""
            if 일 > 0:
                duration_str += f"{일}일 "
            if 시간 > 0:
                duration_str += f"{시간}시간 "
            if 분 > 0:
                duration_str += f"{분}분 "
            if 초 > 0:
                duration_str += f"{초}초"
            
            duration_str = duration_str.strip()
            
            # 유저 로그 전송
            await self.send_user_log(interaction.guild, "timeout", 대상, 사유, duration_str, interaction.user)
            
            # DM 알림 전송
            await self.send_dm_notification(대상, f"타임아웃 ({duration_str})", 사유)
            
            # 관리자 로그 전송
            await self.send_admin_log(interaction.guild, "타임아웃", 대상, interaction.user, 사유, duration_str)
            
            embed = discord.Embed(
                title="🔇 타임아웃 처리 완료",
                description=f"{대상.mention}에게 {duration_str} 타임아웃이 적용되었습니다.",
                color=0xff9900
            )
            embed.add_field(name="해제 시간", value=f"<t:{int(timeout_until.timestamp())}:F>", inline=False)
            
            await interaction.response.send_message(embed=embed, ephemeral=True)
        except Exception as e:
            await interaction.response.send_message(f"❌ 타임아웃 처리 중 오류가 발생했습니다: {str(e)}", ephemeral=True)
    
    # 타임아웃 해제 명령어
    @app_commands.command(name="타임아웃해제", description="사용자의 타임아웃을 해제합니다")
    @app_commands.describe(
        대상="타임아웃을 해제할 사용자",
        사유="해제 사유"
    )
    async def timeout_remove(self, interaction: discord.Interaction, 대상: discord.Member, 사유: str):
        if not interaction.user.guild_permissions.moderate_members:
            await interaction.response.send_message("❌ 멤버 관리 권한이 필요합니다.", ephemeral=True)
            return
        
        try:
            # 타임아웃 해제
            await 대상.timeout(None, reason=사유)
            
            # 데이터베이스에서 활성 타임아웃 비활성화
            conn = sqlite3.connect(config.DATABASE_FILE)
            cursor = conn.cursor()
            
            cursor.execute('''
                UPDATE timeouts 
                SET is_active = FALSE 
                WHERE user_id = ? AND is_active = TRUE
            ''', (대상.id,))
            
            conn.commit()
            conn.close()
            
            # 유저 로그 전송
            await self.send_user_log(interaction.guild, "timeout_remove", 대상, 사유, "", interaction.user)
            
            # DM 알림 전송
            await self.send_dm_notification(대상, "타임아웃 해제", 사유)
            
            # 관리자 로그 전송
            await self.send_admin_log(interaction.guild, "타임아웃 해제", 대상, interaction.user, 사유, "해제")
            
            embed = discord.Embed(
                title="🔊 타임아웃 해제 완료",
                description=f"{대상.mention}의 타임아웃이 해제되었습니다.",
                color=0x00ff00
            )
            
            await interaction.response.send_message(embed=embed, ephemeral=True)
        except Exception as e:
            await interaction.response.send_message(f"❌ 타임아웃 해제 중 오류가 발생했습니다: {str(e)}", ephemeral=True)

# 주의 사유 선택 뷰
class NoticeReasonView(discord.ui.View):
    def __init__(self, target_user, admin_user):
        super().__init__(timeout=300)
        self.target_user = target_user
        self.admin_user = admin_user
        self.selected_category = None
        self.selected_reason = None
        
        # 카테고리 드롭다운 추가
        self.add_item(NoticeCategoryDropdown(self))
    
    def update_view(self):
        """뷰 업데이트"""
        self.clear_items()
        
        # 카테고리 드롭다운은 항상 표시
        self.add_item(NoticeCategoryDropdown(self))
        
        # 카테고리가 선택되면 세부 사유 드롭다운 추가
        if self.selected_category:
            self.add_item(NoticeDetailDropdown(self, self.selected_category))
        
        # 세부 사유까지 선택되면 전송 버튼 추가
        if self.selected_category and self.selected_reason:
            self.add_item(NoticeSendButton(self))


class NoticeCategoryDropdown(discord.ui.Select):
    def __init__(self, parent_view):
        self.parent_view = parent_view
        
        options = [
            discord.SelectOption(
                label="차단사유",
                description="차단에 해당하는 사유들",
                emoji="🚫"
            ),
            discord.SelectOption(
                label="경고대상",
                description="경고에 해당하는 사유들",
                emoji="⚠️"
            ),
            discord.SelectOption(
                label="방생성 봇 및 기타 봇 사용",
                description="봇 사용 관련 사유들",
                emoji="🤖"
            ),
            discord.SelectOption(
                label="기타 규칙",
                description="기타 서버 규칙 위반",
                emoji="📋"
            )
        ]
        
        super().__init__(
            placeholder="주의 사유 카테고리를 선택하세요...",
            options=options,
            custom_id="category_select"
        )
    
    async def callback(self, interaction: discord.Interaction):
        self.parent_view.selected_category = self.values[0]
        self.parent_view.selected_reason = None  # 세부 사유 초기화
        
        # 임베드 업데이트
        embed = discord.Embed(
            title="주의 처분 시스템",
            description=f"**선택된 카테고리**: {self.values[0]}\n\n하단의 드롭다운에서 세부 사유를 선택하세요",
            color=0xffff00
        )
        
        self.parent_view.update_view()
        await interaction.response.edit_message(embed=embed, view=self.parent_view)


class NoticeDetailDropdown(discord.ui.Select):
    def __init__(self, parent_view, category):
        self.parent_view = parent_view
        self.category = category
        
        # config에서 해당 카테고리의 세부 사유들을 가져옴
        reasons = config.NOTICE_REASONS.get(category, [])
        
        options = []
        for i, reason in enumerate(reasons):
            options.append(discord.SelectOption(
                label=reason,
                description=f"{category} - {reason}",
                value=reason
            ))
        
        super().__init__(
            placeholder="세부 사유를 선택하세요...",
            options=options,
            custom_id="detail_select"
        )
    
    async def callback(self, interaction: discord.Interaction):
        self.parent_view.selected_reason = self.values[0]
        
        # 임베드 업데이트
        embed = discord.Embed(
            title="주의 처분 시스템",
            description=f"**선택된 카테고리**: {self.parent_view.selected_category}\n**선택된 사유**: {self.values[0]}\n\n하단의 전송 버튼을 눌러 주의를 전송하세요",
            color=0xffff00
        )
        
        self.parent_view.update_view()
        await interaction.response.edit_message(embed=embed, view=self.parent_view)


class NoticeSendButton(discord.ui.Button):
    def __init__(self, parent_view):
        self.parent_view = parent_view
        super().__init__(
            label="전송",
            style=discord.ButtonStyle.green,
            emoji="📤",
            custom_id="send_notice"
        )
    
    async def callback(self, interaction: discord.Interaction):
        try:
            # 대상자에게 DM 전송
            notice_embed = discord.Embed(
                title="𝐃𝐢𝐬𝐜𝐨𝐫𝐝ㆍ𝐭𝐨𝐩𝐢𝐚 단속팀에서 안내드립니다.",
                description=f"{self.parent_view.target_user.mention} 님 안녕하세요,\n\n다름이 아니라 저희 𝐭𝐨𝐩𝐢𝐚 서버를 이용중, 서버 규칙 **{self.parent_view.selected_reason}** 위반 관련으로 주의 차 메시지를 전송하게 되었습니다.\n\n서버 규칙을 확인 후 수정을 부탁드립니다. 추가로 24시간 이내로 티켓으로 이의제기가 가능하며 그 후에는 경고가 지급이 될 수 있습니다. 감사합니다.",
                color=0xffff00,
                timestamp=datetime.now()
            )
            
            try:
                await self.parent_view.target_user.send(embed=notice_embed)
                dm_status = "✅ DM 전송 완료"
            except discord.Forbidden:
                dm_status = "❌ DM 전송 실패 (DM 차단됨)"
            except Exception as e:
                dm_status = f"❌ DM 전송 실패: {str(e)}"
            
            # 유저 로그 전송
            member_cog = interaction.client.get_cog('MemberManage')
            if member_cog:
                await member_cog.send_user_log(
                    interaction.guild, 
                    "notice", 
                    self.parent_view.target_user, 
                    f"{self.parent_view.selected_category} - {self.parent_view.selected_reason}", 
                    "", 
                    self.parent_view.admin_user
                )
                
                # 관리자 로그 전송
                await member_cog.send_admin_log(
                    interaction.guild, 
                    "주의", 
                    self.parent_view.target_user, 
                    self.parent_view.admin_user, 
                    f"{self.parent_view.selected_category} - {self.parent_view.selected_reason}", 
                    "주의"
                )
            
            # 완료 메시지
            success_embed = discord.Embed(
                title="✅ 주의 처분 완료",
                description=f"**대상자**: {self.parent_view.target_user.mention}\n**사유**: {self.parent_view.selected_category} - {self.parent_view.selected_reason}\n**상태**: {dm_status}",
                color=0x00ff00
            )
            
            # 모든 버튼 비활성화
            for item in self.parent_view.children:
                item.disabled = True
            
            await interaction.response.edit_message(embed=success_embed, view=self.parent_view)
            
        except Exception as e:
            error_embed = discord.Embed(
                title="❌ 주의 처분 실패",
                description=f"오류가 발생했습니다: {str(e)}",
                color=0xff0000
            )
            await interaction.response.edit_message(embed=error_embed, view=self.parent_view)
    

# 이의제기 버튼 뷰
class AppealView(discord.ui.View):
    def __init__(self, user_id, punishment_type):
        super().__init__(timeout=None)
        self.user_id = user_id
        self.punishment_type = punishment_type
    
    @discord.ui.button(label="이의제기", style=discord.ButtonStyle.secondary, emoji="📝")
    async def appeal_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        if interaction.user.id != self.user_id:
            await interaction.response.send_message("❌ 본인만 이의제기를 할 수 있습니다.", ephemeral=True)
            return
        
        modal = AppealModal(self.punishment_type)
        await interaction.response.send_modal(modal)


# 이의제기 모달
class AppealModal(discord.ui.Modal):
    def __init__(self, punishment_type):
        super().__init__(title="이의제기")
        self.punishment_type = punishment_type
        
        self.appeal_content = discord.ui.TextInput(
            label="이의제기 내용",
            placeholder="이의제기 사유를 상세히 작성해주세요...",
            style=discord.TextStyle.paragraph,
            required=True,
            max_length=1000
        )
        self.add_item(self.appeal_content)
    
    async def on_submit(self, interaction: discord.Interaction):
        try:
            conn = sqlite3.connect(config.DATABASE_FILE)
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT INTO appeals (user_id, username, punishment_type, appeal_content)
                VALUES (?, ?, ?, ?)
            ''', (interaction.user.id, interaction.user.name, self.punishment_type, self.appeal_content.value))
            
            conn.commit()
            conn.close()
            
            # 관리자에게 이의제기 알림
            member_cog = interaction.client.get_cog('MemberManage')
            if member_cog:
                channels = member_cog.get_log_channels(interaction.guild_id)
                if 'admin_log' in channels:
                    admin_channel = interaction.guild.get_channel(channels['admin_log'])
                    if admin_channel:
                        embed = discord.Embed(
                            title="📝 새로운 이의제기",
                            description=f"**신청자**: {interaction.user.mention}\n**처벌 유형**: {self.punishment_type}\n**내용**: {self.appeal_content.value}",
                            color=0xffff00,
                            timestamp=datetime.now()
                        )
                        await admin_channel.send(embed=embed)
            
            embed = discord.Embed(
                title="✅ 이의제기 접수 완료",
                description="이의제기가 접수되었습니다. 관리자 검토 후 답변드리겠습니다.",
                color=0x00ff00
            )
            
            await interaction.response.send_message(embed=embed, ephemeral=True)
        except Exception as e:
            await interaction.response.send_message(f"❌ 이의제기 접수 중 오류가 발생했습니다: {str(e)}", ephemeral=True)


# 경고차감권 사용 뷰
class WarningReductionView(discord.ui.View):
    def __init__(self, user_id):
        super().__init__(timeout=300)  # 5분 타임아웃
        self.user_id = user_id
    
    @discord.ui.button(label="경고차감권 사용", style=discord.ButtonStyle.green, emoji="✅")
    async def use_reduction(self, interaction: discord.Interaction, button: discord.ui.Button):
        if interaction.user.id != self.user_id:
            await interaction.response.send_message("❌ 본인만 사용할 수 있습니다.", ephemeral=True)
            return
        
        try:
            # 경고 1회 차감
            conn = sqlite3.connect(config.DATABASE_FILE)
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT INTO warnings (user_id, username, admin_id, admin_username, reason, warning_count)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (self.user_id, interaction.user.name, interaction.user.id, "시스템", "경고차감권 사용", -1))
            
            # 정지 상태 해제
            cursor.execute('''
                UPDATE suspended_users 
                SET is_active = FALSE 
                WHERE user_id = ? AND is_active = TRUE
            ''', (self.user_id,))
            
            conn.commit()
            conn.close()
            
            # 새로운 경고 수 계산
            member_cog = interaction.client.get_cog('MemberManage')
            if member_cog:
                new_warnings = member_cog.get_user_warnings(self.user_id)
                
                # 관리자 로그 전송
                channels = member_cog.get_log_channels(interaction.guild_id)
                if 'admin_log' in channels:
                    admin_channel = interaction.guild.get_channel(channels['admin_log'])
                    if admin_channel:
                        embed = discord.Embed(
                            title="🎫 경고차감권 사용",
                            description=f"**사용자**: {interaction.user.mention}\n**내용**: 경고차감권을 사용하여 경고 1회 차감\n**현재 경고**: {new_warnings}회",
                            color=0x00ff00,
                            timestamp=datetime.now()
                        )
                        await admin_channel.send(embed=embed)
            
            embed = discord.Embed(
                title="✅ 경고차감권 사용 완료",
                description=f"경고차감권을 사용하여 경고 1회가 차감되었습니다.\n현재 경고: {new_warnings if 'member_cog' in locals() and member_cog else '확인 불가'}회\n\n활동 정지가 해제되었습니다.",
                color=0x00ff00
            )
            
            # 버튼 비활성화
            self.use_reduction.disabled = True
            self.decline_reduction.disabled = True
            
            await interaction.response.edit_message(embed=embed, view=self)
        except Exception as e:
            await interaction.response.send_message(f"❌ 경고차감권 사용 중 오류가 발생했습니다: {str(e)}", ephemeral=True)
    
    @discord.ui.button(label="사용 안함", style=discord.ButtonStyle.red, emoji="❌")
    async def decline_reduction(self, interaction: discord.Interaction, button: discord.ui.Button):
        if interaction.user.id != self.user_id:
            await interaction.response.send_message("❌ 본인만 선택할 수 있습니다.", ephemeral=True)
            return
        
        embed = discord.Embed(
            title="❌ 경고차감권 사용 거부",
            description="경고차감권 사용을 거부했습니다.\n관리자의 추가 조치를 기다려주세요.",
            color=0xff0000
        )
        
        # 버튼 비활성화
        self.use_reduction.disabled = True
        self.decline_reduction.disabled = True
        
        await interaction.response.edit_message(embed=embed, view=self)


async def setup(bot):
    await bot.add_cog(MemberManage(bot))