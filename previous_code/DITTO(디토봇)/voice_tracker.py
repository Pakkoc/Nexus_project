# voice_tracker.py
import discord
from discord.ext import commands
from discord import app_commands
import sqlite3
import datetime
from typing import Optional, Dict, List
import config
import asyncio

class VoiceTracker(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.voice_sessions = {}  # user_id: {'channel_id': int, 'join_time': datetime, 'channel_name': str}

    def get_user_department(self, member: discord.Member) -> Optional[str]:
        """사용자의 부서를 확인"""
        for dept, role_id in config.DEPARTMENT_ROLES.items():
            role = discord.utils.get(member.roles, id=role_id)
            if role:
                return dept
        return None

    def has_admin_permission(self, member: discord.Member) -> bool:
        """관리자 권한 확인"""
        # 서버 관리자 권한 또는 특정 관리자 역할 확인
        if member.guild_permissions.administrator:
            return True
        
        # config에 ADMIN_ROLE_ID가 정의되어 있다면 해당 역할 확인
        if hasattr(config, 'ADMIN_ROLE_ID'):
            admin_role = discord.utils.get(member.roles, id=config.ADMIN_ROLE_ID)
            if admin_role:
                return True
        
        # config에 MODERATOR_ROLE_ID가 정의되어 있다면 해당 역할 확인
        if hasattr(config, 'MODERATOR_ROLE_ID'):
            mod_role = discord.utils.get(member.roles, id=config.MODERATOR_ROLE_ID)
            if mod_role:
                return True
        
        return False

    def has_senior_admin_permission(self, member: discord.Member) -> bool:
        """상급 관리자 권한 확인"""
        # 서버 소유자는 항상 상급 관리자
        if member.guild.owner_id == member.id:
            return True
        
        # 서버 관리자 권한이 있으면 상급 관리자
        if member.guild_permissions.administrator:
            return True
        
        # 특정 상급 관리자 역할 확인
        if hasattr(config, 'SENIOR_ADMIN_ROLE_ID'):
            senior_admin_role = discord.utils.get(member.roles, id=config.SENIOR_ADMIN_ROLE_ID)
            if senior_admin_role:
                return True
        
        return False

    def get_db_connection(self):
        """데이터베이스 연결"""
        return sqlite3.connect(config.DATABASE_FILE)

    async def log_voice_activity(self, user_id: int, username: str, channel_id: int, 
                               channel_name: str, join_time: datetime.datetime, 
                               leave_time: Optional[datetime.datetime] = None):
        """음성 활동을 데이터베이스에 기록"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        duration_seconds = 0
        if leave_time:
            duration_seconds = int((leave_time - join_time).total_seconds())
        
        cursor.execute('''
            INSERT INTO voice_logs (user_id, username, channel_id, channel_name, 
                                  join_time, leave_time, duration_seconds)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (user_id, username, channel_id, channel_name, join_time, leave_time, duration_seconds))
        
        conn.commit()
        conn.close()

    async def send_department_notification(self, department: str, member: discord.Member, 
                                         channel: discord.VoiceChannel, action: str, duration: int = 0):
        """부서별 채널에 알림 전송 (UI 개선)"""
        channel_id = config.DEPARTMENT_CHANNELS.get(department)
        if not channel_id:
            return
        
        notification_channel = self.bot.get_channel(channel_id)
        if not notification_channel:
            return
        
        if action == "join":
            embed = discord.Embed(
                title=f"🎤 음성 채널 입장",
                description=f"✨ **{department}** 부서 소속\n👤 **{member.display_name}**님이 음성 채널에 참가했습니다.",
                color=0x00FF7F,  # 밝은 초록색
                timestamp=datetime.datetime.now()
            )
            embed.add_field(
                name="📍 입장 채널", 
                value=f"🔊 **{channel.name}**", 
                inline=False
            )
            embed.add_field(
                name="🕐 입장 시간",
                value=f"{datetime.datetime.now().strftime('%H:%M:%S')}",
                inline=True
            )
            embed.set_thumbnail(url=member.display_avatar.url)
            
        else:  # leave
            duration_str = self.format_duration(duration)
            
            # 활동 시간에 따른 색상 변경
            if duration >= 3600:  # 1시간 이상
                color = 0xFF6B6B  # 빨간색
                activity_level = "🔥 장시간 활동"
            elif duration >= 1800:  # 30분 이상
                color = 0xFFD93D  # 노란색
                activity_level = "⚡ 활발한 활동"
            elif duration >= 300:  # 5분 이상
                color = 0x6BCF7F  # 초록색
                activity_level = "✨ 적절한 활동"
            else:
                color = 0xA8A8A8  # 회색
                activity_level = "💨 짧은 활동"
            
            embed = discord.Embed(
                title=f"👋 음성 채널 퇴장",
                description=f"✨ **{department}** 부서 소속\n👤 **{member.display_name}**님이 음성 채널에서 나갔습니다.",
                color=color,
                timestamp=datetime.datetime.now()
            )
            embed.add_field(
                name="📍 퇴장 채널", 
                value=f"🔊 **{channel.name}**", 
                inline=True
            )
            embed.add_field(
                name="⏱️ 활동 시간", 
                value=f"**{duration_str}**", 
                inline=True
            )
            embed.add_field(
                name="📊 활동 수준",
                value=activity_level,
                inline=True
            )
            embed.add_field(
                name="🕐 퇴장 시간",
                value=f"{datetime.datetime.now().strftime('%H:%M:%S')}",
                inline=True
            )
            embed.set_thumbnail(url=member.display_avatar.url)

        embed.set_footer(
            text=f"User ID: {member.id} | {department} 부서",
            icon_url=member.guild.icon.url if member.guild.icon else None
        )
        
        try:
            await notification_channel.send(embed=embed)
        except Exception as e:
            print(f"알림 전송 실패: {e}")

    @commands.Cog.listener()
    async def on_voice_state_update(self, member: discord.Member, before: discord.VoiceState, after: discord.VoiceState):
        """음성 상태 변경 감지 (수정된 버전)"""
        department = self.get_user_department(member)
        if not department:
            return
        
        now = datetime.datetime.now()
        
        # 음성 채널 입장
        if before.channel is None and after.channel is not None:
            # 세션 정보 저장
            self.voice_sessions[member.id] = {
                'channel_id': after.channel.id,
                'channel_name': after.channel.name,
                'join_time': now
            }
            
            # 데이터베이스에 입장 기록
            await self.log_voice_activity(
                member.id, str(member), after.channel.id, 
                after.channel.name, now
            )
            
            # 입장 알림 전송
            await self.send_department_notification(department, member, after.channel, "join")
        
        # 음성 채널 퇴장
        elif before.channel is not None and after.channel is None:
            if member.id in self.voice_sessions:
                session = self.voice_sessions[member.id]
                join_time = session['join_time']
                duration = int((now - join_time).total_seconds())
                
                # 데이터베이스 업데이트 (수정된 쿼리)
                conn = self.get_db_connection()
                cursor = conn.cursor()
                
                # 가장 최근의 해당 사용자와 채널의 미완료 세션 찾기
                cursor.execute('''
                    SELECT id FROM voice_logs 
                    WHERE user_id = ? AND channel_id = ? AND leave_time IS NULL
                    ORDER BY join_time DESC LIMIT 1
                ''', (member.id, before.channel.id))
                
                result = cursor.fetchone()
                if result:
                    log_id = result[0]
                    cursor.execute('''
                        UPDATE voice_logs 
                        SET leave_time = ?, duration_seconds = ?
                        WHERE id = ?
                    ''', (now, duration, log_id))
                    conn.commit()
                
                conn.close()
                
                # 퇴장 알림 전송 (duration 포함)
                await self.send_department_notification(department, member, before.channel, "leave", duration)
                
                # 세션 정리
                del self.voice_sessions[member.id]
        
        # 음성 채널 이동
        elif before.channel != after.channel and before.channel is not None and after.channel is not None:
            # 이전 채널에서 퇴장 처리
            if member.id in self.voice_sessions:
                session = self.voice_sessions[member.id]
                join_time = session['join_time']
                duration = int((now - join_time).total_seconds())
                
                # 데이터베이스 업데이트 (수정된 쿼리)
                conn = self.get_db_connection()
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT id FROM voice_logs 
                    WHERE user_id = ? AND channel_id = ? AND leave_time IS NULL
                    ORDER BY join_time DESC LIMIT 1
                ''', (member.id, before.channel.id))
                
                result = cursor.fetchone()
                if result:
                    log_id = result[0]
                    cursor.execute('''
                        UPDATE voice_logs 
                        SET leave_time = ?, duration_seconds = ?
                        WHERE id = ?
                    ''', (now, duration, log_id))
                    conn.commit()
                
                conn.close()
                
                # 퇴장 알림 전송
                await self.send_department_notification(department, member, before.channel, "leave", duration)
            
            # 새 채널에 입장 처리
            self.voice_sessions[member.id] = {
                'channel_id': after.channel.id,
                'channel_name': after.channel.name,
                'join_time': now
            }
            
            # 새 채널 입장 기록
            await self.log_voice_activity(
                member.id, str(member), after.channel.id, 
                after.channel.name, now
            )
            
            # 입장 알림 전송
            await self.send_department_notification(department, member, after.channel, "join")

    async def get_voice_stats(self, user_id: int, date: Optional[datetime.date] = None) -> Dict:
        """음성 활동 통계 조회"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        if date:
            # 특정 날짜의 기록
            cursor.execute('''
                SELECT channel_name, SUM(duration_seconds) as total_duration, COUNT(*) as session_count
                FROM voice_logs 
                WHERE user_id = ? AND DATE(join_time) = ?
                GROUP BY channel_id, channel_name
                ORDER BY total_duration DESC
            ''', (user_id, date.strftime('%Y-%m-%d')))
        else:
            # 전체 기록
            cursor.execute('''
                SELECT channel_name, SUM(duration_seconds) as total_duration, COUNT(*) as session_count
                FROM voice_logs 
                WHERE user_id = ?
                GROUP BY channel_id, channel_name
                ORDER BY total_duration DESC
            ''', (user_id,))
        
        results = cursor.fetchall()
        
        # 총 시간 계산
        if date:
            cursor.execute('''
                SELECT SUM(duration_seconds) as total_time, COUNT(*) as total_sessions
                FROM voice_logs 
                WHERE user_id = ? AND DATE(join_time) = ?
            ''', (user_id, date.strftime('%Y-%m-%d')))
        else:
            cursor.execute('''
                SELECT SUM(duration_seconds) as total_time, COUNT(*) as total_sessions
                FROM voice_logs 
                WHERE user_id = ?
            ''', (user_id,))
        
        total_result = cursor.fetchone()
        conn.close()
        
        return {
            'channels': results,
            'total_time': total_result[0] or 0,
            'total_sessions': total_result[1] or 0
        }

    async def get_weekly_stats(self, user_id: int) -> Dict:
        """주간 통계 조회"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        # 최근 7일간의 일별 통계
        cursor.execute('''
            SELECT DATE(join_time) as date, SUM(duration_seconds) as total_duration
            FROM voice_logs 
            WHERE user_id = ? AND join_time >= DATE('now', '-7 days')
            GROUP BY DATE(join_time)
            ORDER BY date DESC
        ''', (user_id,))
        
        results = cursor.fetchall()
        conn.close()
        
        return results

    def format_duration(self, seconds: int) -> str:
        """초를 시분초 형태로 변환 (개선된 버전)"""
        if seconds == 0:
            return "0초"
        
        hours = seconds // 3600
        minutes = (seconds % 3600) // 60
        secs = seconds % 60
        
        parts = []
        if hours > 0:
            parts.append(f"{hours}시간")
        if minutes > 0:
            parts.append(f"{minutes}분")
        if secs > 0 or len(parts) == 0:
            parts.append(f"{secs}초")
        
        return " ".join(parts)

    def get_activity_emoji(self, duration: int) -> str:
        """활동 시간에 따른 이모지 반환"""
        if duration >= 7200:  # 2시간 이상
            return "🏆"
        elif duration >= 3600:  # 1시간 이상
            return "🔥"
        elif duration >= 1800:  # 30분 이상
            return "⚡"
        elif duration >= 900:  # 15분 이상
            return "✨"
        elif duration >= 300:  # 5분 이상
            return "💫"
        else:
            return "💨"

    @app_commands.command(name="음성실적조회", description="사용자의 음성 채널 활동 실적을 조회합니다.")
    @app_commands.describe(user="조회할 사용자")
    async def voice_stats(self, interaction: discord.Interaction, user: discord.Member):
        """음성 실적 조회 명령어 (UI 개선)"""
        await interaction.response.defer()
        
        stats = await self.get_voice_stats(user.id)
        
        # 활동 레벨 계산
        total_hours = stats['total_time'] / 3600
        if total_hours >= 100:
            level = "🏆 음성 마스터"
            color = 0xFFD700  # 금색
        elif total_hours >= 50:
            level = "🔥 음성 베테랑"
            color = 0xFF6B6B  # 빨간색
        elif total_hours >= 20:
            level = "⚡ 음성 전문가"
            color = 0xFF9500  # 주황색
        elif total_hours >= 10:
            level = "✨ 음성 애호가"
            color = 0x00D4FF  # 파란색
        elif total_hours >= 5:
            level = "💫 음성 입문자"
            color = 0x9D00FF  # 보라색
        else:
            level = "💨 음성 뉴비"
            color = 0x808080  # 회색
        
        embed = discord.Embed(
            title=f"📊 {user.display_name}님의 음성 활동 통계",
            description=f"🎯 **활동 레벨**: {level}",
            color=color,
            timestamp=datetime.datetime.now()
        )
        
        # 메인 통계
        embed.add_field(
            name="⏱️ 총 활동 시간",
            value=f"**{self.format_duration(stats['total_time'])}**\n({total_hours:.1f}시간)",
            inline=True
        )
        
        embed.add_field(
            name="📈 총 접속 횟수",
            value=f"**{stats['total_sessions']:,}회**",
            inline=True
        )
        
        # 평균 활동 시간
        avg_duration = stats['total_time'] / stats['total_sessions'] if stats['total_sessions'] > 0 else 0
        embed.add_field(
            name="📊 평균 활동 시간",
            value=f"**{self.format_duration(int(avg_duration))}**",
            inline=True
        )
        
        # 채널별 활동
        if stats['channels']:
            channel_list = []
            for i, (channel_name, duration, count) in enumerate(stats['channels'][:5]):  # 상위 5개 채널
                emoji = self.get_activity_emoji(duration)
                percentage = (duration / stats['total_time'] * 100) if stats['total_time'] > 0 else 0
                channel_list.append(
                    f"{emoji} **{channel_name}**\n"
                    f"   └ {self.format_duration(duration)} ({count}회) - {percentage:.1f}%"
                )
            
            embed.add_field(
                name="🏆 채널별 활동 순위 (TOP 5)",
                value="\n\n".join(channel_list) if channel_list else "활동 기록이 없습니다.",
                inline=False
            )
        
        embed.set_thumbnail(url=user.display_avatar.url)
        embed.set_footer(
            text=f"User ID: {user.id} | 데이터 수집 시작일: 2024년",
            icon_url=interaction.guild.icon.url if interaction.guild.icon else None
        )
        
        # 날짜별 조회 드롭다운 추가
        view = DateSelectView(self, user.id)
        
        await interaction.followup.send(embed=embed, view=view)

    @app_commands.command(name="음성실적초기화", description="특정 사용자의 음성 활동 실적을 초기화합니다. (관리자 전용)")
    @app_commands.describe(user="초기화할 사용자")
    async def reset_voice_stats(self, interaction: discord.Interaction, user: discord.Member):
        """개별 사용자 음성 실적 초기화 (관리자 전용, UI 개선)"""
        
        # 권한 체크
        if not self.has_admin_permission(interaction.user):
            embed = discord.Embed(
                title="🚫 접근 권한 없음",
                description="❌ 이 명령어는 **관리자 권한**이 필요합니다.",
                color=0xFF0000,
                timestamp=datetime.datetime.now()
            )
            embed.add_field(
                name="🔒 필요 권한",
                value="• 서버 관리자 권한\n• 관리자 역할\n• 모더레이터 역할",
                inline=False
            )
            embed.add_field(
                name="👤 요청자",
                value=f"{interaction.user.mention}",
                inline=True
            )
            embed.add_field(
                name="📝 요청 대상",
                value=f"{user.mention}",
                inline=True
            )
            embed.set_footer(
                text="권한이 없어 요청이 거부되었습니다.",
                icon_url=interaction.user.display_avatar.url
            )
            await interaction.response.send_message(embed=embed, ephemeral=True)
            return
        
        # 확인 메시지 먼저 보여주기
        confirm_embed = discord.Embed(
            title="⚠️ 음성 실적 초기화 확인",
            description=f"🗑️ **{user.display_name}**님의 모든 음성 활동 기록을 삭제하시겠습니까?\n\n**이 작업은 되돌릴 수 없습니다.**",
            color=0xFFAA00,
            timestamp=datetime.datetime.now()
        )
        confirm_embed.add_field(
            name="🎯 대상 사용자",
            value=f"{user.mention}",
            inline=True
        )
        confirm_embed.add_field(
            name="👤 실행자",
            value=f"{interaction.user.mention}",
            inline=True
        )
        confirm_embed.set_footer(
            text="아래 버튼을 눌러 진행하거나 취소하세요.",
            icon_url=interaction.user.display_avatar.url
        )
        
        view = ConfirmResetView(self, user, interaction.user)
        await interaction.response.send_message(embed=confirm_embed, view=view, ephemeral=True)

    @app_commands.command(name="음성실적주간초기화", description="모든 사용자의 음성 활동 실적을 초기화합니다. (상급 관리자 전용)")
    async def reset_all_voice_stats(self, interaction: discord.Interaction):
        """전체 음성 실적 초기화 (상급 관리자 전용, UI 개선)"""
        
        # 권한 체크
        if not self.has_senior_admin_permission(interaction.user):
            embed = discord.Embed(
                title="🔒 최고 권한 필요",
                description="❌ 이 명령어는 **상급 관리자 권한**이 필요합니다.",
                color=0xFF0000,
                timestamp=datetime.datetime.now()
            )
            embed.add_field(
                name="🛡️ 필요 권한",
                value="• 서버 소유자\n• 서버 관리자 권한\n• 상급 관리자 역할",
                inline=False
            )
            embed.add_field(
                name="⚠️ 위험도",
                value="🔥 **매우 높음**\n모든 사용자 데이터 삭제",
                inline=True
            )
            embed.add_field(
                name="👤 요청자",
                value=f"{interaction.user.mention}",
                inline=True
            )
            embed.set_footer(
                text="권한 부족으로 요청이 거부되었습니다.",
                icon_url=interaction.user.display_avatar.url
            )
            await interaction.response.send_message(embed=embed, ephemeral=True)
            return
        
        # 확인 메시지
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        # 현재 통계 확인
        cursor.execute('SELECT COUNT(*) FROM voice_logs')
        total_records = cursor.fetchone()[0]
        
        cursor.execute('SELECT COUNT(DISTINCT user_id) FROM voice_logs')
        total_users = cursor.fetchone()[0]
        
        conn.close()
        
        confirm_embed = discord.Embed(
            title="🚨 전체 음성 실적 초기화 확인",
            description=f"⚠️ **모든 사용자**의 음성 활동 기록을 삭제하시겠습니까?\n\n**이 작업은 절대 되돌릴 수 없습니다!**",
            color=0xFF0000,
            timestamp=datetime.datetime.now()
        )
        confirm_embed.add_field(
            name="📊 삭제될 데이터",
            value=f"🗂️ **{total_records:,}개** 기록\n👥 **{total_users:,}명** 사용자",
            inline=True
        )
        confirm_embed.add_field(
            name="👤 실행자",
            value=f"{interaction.user.mention}",
            inline=True
        )
        confirm_embed.add_field(
            name="⚠️ 위험도",
            value="🔥 **최고 위험**",
            inline=True
        )
        confirm_embed.set_footer(
            text="신중히 생각한 후 결정하세요. 이 작업은 되돌릴 수 없습니다.",
            icon_url=interaction.user.display_avatar.url
        )
        
        view = ConfirmResetAllView(self, interaction.user, total_records, total_users)
        await interaction.response.send_message(embed=confirm_embed, view=view, ephemeral=True)


class ConfirmResetView(discord.ui.View):
    def __init__(self, voice_tracker: VoiceTracker, target_user: discord.Member, executor: discord.Member):
        super().__init__(timeout=60)
        self.voice_tracker = voice_tracker
        self.target_user = target_user
        self.executor = executor

    @discord.ui.button(label="🗑️ 삭제 확인", style=discord.ButtonStyle.danger, emoji="⚠️")
    async def confirm_reset(self, interaction: discord.Interaction, button: discord.ui.Button):
        if interaction.user.id != self.executor.id:
            await interaction.response.send_message("❌ 명령어를 실행한 사용자만 확인할 수 있습니다.", ephemeral=True)
            return
        
        conn = self.voice_tracker.get_db_connection()
        cursor = conn.cursor()
        
        # 기존 기록 수 확인
        cursor.execute('SELECT COUNT(*) FROM voice_logs WHERE user_id = ?', (self.target_user.id,))
        record_count = cursor.fetchone()[0]
        
        # 기록 삭제
        cursor.execute('DELETE FROM voice_logs WHERE user_id = ?', (self.target_user.id,))
        conn.commit()
        conn.close()
        
        embed = discord.Embed(
            title="✅ 음성 실적 초기화 완료",
            description=f"🗑️ **{self.target_user.display_name}**님의 모든 음성 활동 기록이 성공적으로 삭제되었습니다.",
            color=0x00FF7F,
            timestamp=datetime.datetime.now()
        )
        
        embed.add_field(
            name="📊 삭제된 기록",
            value=f"**{record_count:,}개**",
            inline=True
        )
        
        embed.add_field(
            name="👤 대상 사용자",
            value=f"{self.target_user.mention}",
            inline=True
        )
        
        embed.add_field(
            name="👮 실행자",
            value=f"{self.executor.mention}",
            inline=True
        )
        
        embed.set_footer(
            text=f"작업 완료 시간: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            icon_url=self.executor.display_avatar.url
        )
        
        # 버튼 비활성화
        for item in self.children:
            item.disabled = True
        
        await interaction.response.edit_message(embed=embed, view=self)

    @discord.ui.button(label="❌ 취소", style=discord.ButtonStyle.secondary)
    async def cancel_reset(self, interaction: discord.Interaction, button: discord.ui.Button):
        if interaction.user.id != self.executor.id:
            await interaction.response.send_message("❌ 명령어를 실행한 사용자만 취소할 수 있습니다.", ephemeral=True)
            return
        
        embed = discord.Embed(
            title="❌ 음성 실적 초기화 취소",
            description=f"🛡️ **{self.target_user.display_name}**님의 음성 활동 기록 삭제가 취소되었습니다.",
            color=0x808080,
            timestamp=datetime.datetime.now()
        )
        
        embed.add_field(
            name="👤 대상 사용자",
            value=f"{self.target_user.mention}",
            inline=True
        )
        
        embed.add_field(
            name="👮 실행자",
            value=f"{self.executor.mention}",
            inline=True
        )
        
        embed.add_field(
            name="📊 상태",
            value="✅ 데이터 보존됨",
            inline=True
        )
        
        embed.set_footer(
            text="작업이 안전하게 취소되었습니다.",
            icon_url=self.executor.display_avatar.url
        )
        
        # 버튼 비활성화
        for item in self.children:
            item.disabled = True
        
        await interaction.response.edit_message(embed=embed, view=self)


class ConfirmResetAllView(discord.ui.View):
    def __init__(self, voice_tracker: VoiceTracker, executor: discord.Member, total_records: int, total_users: int):
        super().__init__(timeout=120)  # 전체 삭제는 더 긴 시간 제공
        self.voice_tracker = voice_tracker
        self.executor = executor
        self.total_records = total_records
        self.total_users = total_users

    @discord.ui.button(label="🔥 전체 삭제 확인", style=discord.ButtonStyle.danger, emoji="⚠️")
    async def confirm_reset_all(self, interaction: discord.Interaction, button: discord.ui.Button):
        if interaction.user.id != self.executor.id:
            await interaction.response.send_message("❌ 명령어를 실행한 사용자만 확인할 수 있습니다.", ephemeral=True)
            return
        
        await interaction.response.defer()
        
        conn = self.voice_tracker.get_db_connection()
        cursor = conn.cursor()
        
        # 모든 기록 삭제
        cursor.execute('DELETE FROM voice_logs')
        conn.commit()
        conn.close()
        
        embed = discord.Embed(
            title="🔥 전체 음성 실적 초기화 완료",
            description=f"🗑️ **모든 사용자**의 음성 활동 기록이 성공적으로 삭제되었습니다.",
            color=0xFF0000,
            timestamp=datetime.datetime.now()
        )
        
        embed.add_field(
            name="📊 삭제된 데이터",
            value=f"🗂️ **{self.total_records:,}개** 기록\n👥 **{self.total_users:,}명** 사용자",
            inline=True
        )
        
        embed.add_field(
            name="👮 실행자",
            value=f"{self.executor.mention}",
            inline=True
        )
        
        embed.add_field(
            name="⚠️ 결과",
            value="🔥 **완전 삭제됨**",
            inline=True
        )
        
        embed.set_footer(
            text=f"작업 완료 시간: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            icon_url=self.executor.display_avatar.url
        )
        
        # 버튼 비활성화
        for item in self.children:
            item.disabled = True
        
        await interaction.edit_original_response(embed=embed, view=self)

    @discord.ui.button(label="❌ 취소", style=discord.ButtonStyle.secondary)
    async def cancel_reset(self, interaction: discord.Interaction, button: discord.ui.Button):
        if interaction.user.id != self.executor.id:
            await interaction.response.send_message("❌ 명령어를 실행한 사용자만 취소할 수 있습니다.", ephemeral=True)
            return
        
        embed = discord.Embed(
            title="❌ 음성 실적 초기화 취소",
            description=f"🛡️ **{self.target_user.display_name}**님의 음성 활동 기록 삭제가 취소되었습니다.",
            color=0x808080,
            timestamp=datetime.datetime.now()
        )
        
        embed.add_field(
            name="👤 대상 사용자",
            value=f"{self.target_user.mention}",
            inline=True
        )
        
        embed.add_field(
            name="👮 실행자",
            value=f"{self.executor.mention}",
            inline=True
        )
        
        embed.add_field(
            name="📊 상태",
            value="✅ 데이터 보존됨",
            inline=True
        )
        
        embed.set_footer(
            text="작업이 안전하게 취소되었습니다.",
            icon_url=self.executor.display_avatar.url
        )
        
        # 버튼 비활성화
        for item in self.children:
            item.disabled = True
        
        await interaction.response.edit_message(embed=embed, view=self)


class ConfirmResetAllView(discord.ui.View):
    def __init__(self, voice_tracker: VoiceTracker, executor: discord.Member, total_records: int, total_users: int):
        super().__init__(timeout=120)  # 전체 삭제는 더 긴 시간 제공
        self.voice_tracker = voice_tracker
        self.executor = executor
        self.total_records = total_records
        self.total_users = total_users

    @discord.ui.button(label="🔥 전체 삭제 확인", style=discord.ButtonStyle.danger, emoji="⚠️")
    async def confirm_reset_all(self, interaction: discord.Interaction, button: discord.ui.Button):
        if interaction.user.id != self.executor.id:
            await interaction.response.send_message("❌ 명령어를 실행한 사용자만 확인할 수 있습니다.", ephemeral=True)
            return
        
        await interaction.response.defer()
        
        conn = self.voice_tracker.get_db_connection()
        cursor = conn.cursor()
        
        # 모든 기록 삭제
        cursor.execute('DELETE FROM voice_logs')
        conn.commit()
        conn.close()
        
        embed = discord.Embed(
            title="🔥 전체 음성 실적 초기화 완료",
            description=f"🗑️ **모든 사용자**의 음성 활동 기록이 성공적으로 삭제되었습니다.",
            color=0xFF0000,
            timestamp=datetime.datetime.now()
        )
        
        embed.add_field(
            name="📊 삭제된 데이터",
            value=f"🗂️ **{self.total_records:,}개** 기록\n👥 **{self.total_users:,}명** 사용자",
            inline=True
        )
        
        embed.add_field(
            name="👮 실행자",
            value=f"{self.executor.mention}",
            inline=True
        )
        
        embed.add_field(
            name="⚠️ 결과",
            value="🔥 **완전 삭제됨**",
            inline=True
        )
        
        embed.set_footer(
            text=f"작업 완료 시간: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            icon_url=self.executor.display_avatar.url
        )
        
        # 버튼 비활성화
        for item in self.children:
            item.disabled = True
        
        await interaction.edit_original_response(embed=embed, view=self)

    @discord.ui.button(label="❌ 취소", style=discord.ButtonStyle.secondary)
    async def cancel_reset_all(self, interaction: discord.Interaction, button: discord.ui.Button):
        if interaction.user.id != self.executor.id:
            await interaction.response.send_message("❌ 명령어를 실행한 사용자만 취소할 수 있습니다.", ephemeral=True)
            return
        
        embed = discord.Embed(
            title="❌ 전체 음성 실적 초기화 취소",
            description=f"🛡️ **모든 사용자**의 음성 활동 기록 삭제가 취소되었습니다.",
            color=0x808080,
            timestamp=datetime.datetime.now()
        )
        
        embed.add_field(
            name="📊 보존된 데이터",
            value=f"🗂️ **{self.total_records:,}개** 기록\n👥 **{self.total_users:,}명** 사용자",
            inline=True
        )
        
        embed.add_field(
            name="👮 실행자",
            value=f"{self.executor.mention}",
            inline=True
        )
        
        embed.add_field(
            name="📊 상태",
            value="✅ 모든 데이터 보존됨",
            inline=True
        )
        
        embed.set_footer(
            text="작업이 안전하게 취소되었습니다.",
            icon_url=self.executor.display_avatar.url
        )
        
        # 버튼 비활성화
        for item in self.children:
            item.disabled = True
        
        await interaction.response.edit_message(embed=embed, view=self)


class DateSelectView(discord.ui.View):
    def __init__(self, voice_tracker: VoiceTracker, user_id: int):
        super().__init__(timeout=300)
        self.voice_tracker = voice_tracker
        self.user_id = user_id

    @discord.ui.select(
        placeholder="📅 날짜별 통계 조회",
        options=[
            discord.SelectOption(
                label="오늘",
                value="today",
                emoji="📅",
                description="오늘의 음성 활동 통계"
            ),
            discord.SelectOption(
                label="어제",
                value="yesterday",
                emoji="📆",
                description="어제의 음성 활동 통계"
            ),
            discord.SelectOption(
                label="이번 주",
                value="this_week",
                emoji="📊",
                description="이번 주의 음성 활동 통계"
            ),
            discord.SelectOption(
                label="지난 주",
                value="last_week",
                emoji="📈",
                description="지난 주의 음성 활동 통계"
            ),
            discord.SelectOption(
                label="이번 달",
                value="this_month",
                emoji="📋",
                description="이번 달의 음성 활동 통계"
            )
        ]
    )
    async def date_select(self, interaction: discord.Interaction, select: discord.ui.Select):
        await interaction.response.defer()
        
        today = datetime.date.today()
        target_date = None
        date_range = None
        
        if select.values[0] == "today":
            target_date = today
            date_name = "오늘"
        elif select.values[0] == "yesterday":
            target_date = today - datetime.timedelta(days=1)
            date_name = "어제"
        elif select.values[0] == "this_week":
            # 이번 주 월요일부터 오늘까지
            days_since_monday = today.weekday()
            start_date = today - datetime.timedelta(days=days_since_monday)
            date_range = (start_date, today)
            date_name = "이번 주"
        elif select.values[0] == "last_week":
            # 지난 주 월요일부터 일요일까지
            days_since_monday = today.weekday()
            this_monday = today - datetime.timedelta(days=days_since_monday)
            last_sunday = this_monday - datetime.timedelta(days=1)
            last_monday = last_sunday - datetime.timedelta(days=6)
            date_range = (last_monday, last_sunday)
            date_name = "지난 주"
        elif select.values[0] == "this_month":
            # 이번 달 1일부터 오늘까지
            start_date = today.replace(day=1)
            date_range = (start_date, today)
            date_name = "이번 달"
        
        # 사용자 정보 가져오기
        user = interaction.guild.get_member(self.user_id)
        if not user:
            await interaction.followup.send("❌ 사용자를 찾을 수 없습니다.", ephemeral=True)
            return
        
        # 통계 조회
        if target_date:
            stats = await self.voice_tracker.get_voice_stats(self.user_id, target_date)
        else:
            stats = await self.voice_tracker.get_date_range_stats(self.user_id, date_range[0], date_range[1])
        
        # 임베드 생성
        embed = discord.Embed(
            title=f"📊 {user.display_name}님의 {date_name} 음성 활동 통계",
            color=0x00D4FF,
            timestamp=datetime.datetime.now()
        )
        
        if target_date:
            embed.description = f"📅 **{target_date.strftime('%Y년 %m월 %d일')}** 활동 기록"
        else:
            embed.description = f"📅 **{date_range[0].strftime('%Y년 %m월 %d일')}** ~ **{date_range[1].strftime('%Y년 %m월 %d일')}** 활동 기록"
        
        if stats['total_time'] > 0:
            # 활동 시간 정보
            embed.add_field(
                name="⏱️ 총 활동 시간",
                value=f"**{self.voice_tracker.format_duration(stats['total_time'])}**",
                inline=True
            )
            
            embed.add_field(
                name="📈 접속 횟수",
                value=f"**{stats['total_sessions']:,}회**",
                inline=True
            )
            
            # 평균 시간
            avg_duration = stats['total_time'] / stats['total_sessions'] if stats['total_sessions'] > 0 else 0
            embed.add_field(
                name="📊 평균 시간",
                value=f"**{self.voice_tracker.format_duration(int(avg_duration))}**",
                inline=True
            )
            
            # 채널별 활동
            if stats['channels']:
                channel_list = []
                for channel_name, duration, count in stats['channels'][:3]:  # 상위 3개 채널
                    emoji = self.voice_tracker.get_activity_emoji(duration)
                    channel_list.append(f"{emoji} **{channel_name}** - {self.voice_tracker.format_duration(duration)} ({count}회)")
                
                embed.add_field(
                    name="🏆 주요 활동 채널",
                    value="\n".join(channel_list),
                    inline=False
                )
        else:
            embed.add_field(
                name="📊 활동 기록",
                value="해당 기간에 음성 활동 기록이 없습니다.",
                inline=False
            )
        
        embed.set_thumbnail(url=user.display_avatar.url)
        embed.set_footer(
            text=f"User ID: {user.id}",
            icon_url=interaction.guild.icon.url if interaction.guild.icon else None
        )
        
        await interaction.followup.send(embed=embed, ephemeral=True)

    async def get_date_range_stats(self, user_id: int, start_date: datetime.date, end_date: datetime.date) -> Dict:
        """날짜 범위별 통계 조회"""
        conn = self.voice_tracker.get_db_connection()
        cursor = conn.cursor()
        
        # 날짜 범위 내 채널별 통계
        cursor.execute('''
            SELECT channel_name, SUM(duration_seconds) as total_duration, COUNT(*) as session_count
            FROM voice_logs 
            WHERE user_id = ? AND DATE(join_time) BETWEEN ? AND ?
            GROUP BY channel_id, channel_name
            ORDER BY total_duration DESC
        ''', (user_id, start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d')))
        
        results = cursor.fetchall()
        
        # 총 시간 계산
        cursor.execute('''
            SELECT SUM(duration_seconds) as total_time, COUNT(*) as total_sessions
            FROM voice_logs 
            WHERE user_id = ? AND DATE(join_time) BETWEEN ? AND ?
        ''', (user_id, start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d')))
        
        total_result = cursor.fetchone()
        conn.close()
        
        return {
            'channels': results,
            'total_time': total_result[0] or 0,
            'total_sessions': total_result[1] or 0
        }


async def setup(bot):
    await bot.add_cog(VoiceTracker(bot))