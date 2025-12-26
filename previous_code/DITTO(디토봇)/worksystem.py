# worksystem.py
import discord
from discord.ext import commands, tasks
from discord import app_commands
import sqlite3
import datetime
import config
from typing import Literal, Optional
import asyncio

class WorkButtons(discord.ui.View):
    def __init__(self):
        super().__init__(timeout=None)
    
    @discord.ui.button(label='출근하기', style=discord.ButtonStyle.green, emoji='🏢')
    async def work_start(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.defer(ephemeral=True)
        
        user_roles = [role.id for role in interaction.user.roles]
        if not any(role_id in config.WORK_SYSTEM_ROLES for role_id in user_roles):
            embed = discord.Embed(
                title="❌ 권한 없음",
                description="출퇴근 시스템을 사용할 권한이 없습니다.",
                color=0xff0000
            )
            await interaction.followup.send(embed=embed, ephemeral=True)
            return
        
        user_department = None
        for dept, role_id in config.DEPARTMENT_ROLES.items():
            if role_id in user_roles:
                user_department = dept
                break
        
        if not user_department:
            embed = discord.Embed(
                title="❌ 부서 미확인",
                description="소속 부서를 확인할 수 없습니다.",
                color=0xff0000
            )
            await interaction.followup.send(embed=embed, ephemeral=True)
            return
        
        conn = sqlite3.connect(config.DATABASE_FILE)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT * FROM work_records 
            WHERE user_id = ? AND is_working = TRUE
        ''', (interaction.user.id,))
        
        if cursor.fetchone():
            embed = discord.Embed(
                title="⚠️ 이미 출근중입니다",
                description=f"{interaction.user.mention}님은 이미 출근 상태입니다!",
                color=0xffaa00
            )
            embed.set_footer(text="퇴근 후 다시 출근해주세요.")
            await interaction.followup.send(embed=embed, ephemeral=True)
            conn.close()
            return
        
        now = datetime.datetime.now()
        cursor.execute('''
            INSERT INTO work_records (user_id, username, department, start_time, is_working)
            VALUES (?, ?, ?, ?, TRUE)
        ''', (interaction.user.id, interaction.user.display_name, user_department, now))
        
        conn.commit()
        
        cursor.execute('''
            SELECT channel_id FROM channel_settings 
            WHERE guild_id = ? AND setting_type = 'work_start' AND department = ?
        ''', (interaction.guild.id, user_department))
        
        result = cursor.fetchone()
        conn.close()  
        
        if result:
            channel = interaction.guild.get_channel(result[0])
            if channel:
                dept_embed = discord.Embed(
                    title="💼ㅣDISCORD :: TOPIA BOT",
                    description=f"{interaction.user.mention} 님의 근무가 시작되었습니다\n\n**{now.strftime('%Y-%m-%d %H:%M:%S')}**",
                    color=config.BOT_COLOR
                )
                dept_embed.set_footer(text="* 오늘도 서버를 위해 활동해주셔서 감사합니다 *")
                await channel.send(embed=dept_embed)
        
        dm_embed = discord.Embed(
            title="✅ 출근 완료",
            description=f"**{interaction.user.display_name}**님의 출근이 완료되었습니다!",
            color=config.BOT_COLOR
        )
        dm_embed.add_field(name="출근 시간", value=now.strftime("%Y-%m-%d %H:%M:%S"), inline=False)
        dm_embed.add_field(name="소속 부서", value=user_department, inline=False)
        dm_embed.set_footer(text="오늘도 좋은 하루 보내세요! 💪")
        
        try:
            await interaction.user.send(embed=dm_embed)
        except:
            pass
        
        response_embed = discord.Embed(
            title="✅ 출근 처리 완료",
            description="출근이 성공적으로 처리되었습니다!",
            color=config.BOT_COLOR
        )
        await interaction.followup.send(embed=response_embed, ephemeral=True)
    
    @discord.ui.button(label='퇴근하기', style=discord.ButtonStyle.red, emoji='🏠')
    async def work_end(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.defer(ephemeral=True)
        
        user_roles = [role.id for role in interaction.user.roles]
        if not any(role_id in config.WORK_SYSTEM_ROLES for role_id in user_roles):
            embed = discord.Embed(
                title="❌ 권한 없음",
                description="출퇴근 시스템을 사용할 권한이 없습니다.",
                color=0xff0000
            )
            await interaction.followup.send(embed=embed, ephemeral=True)
            return
        
        conn = sqlite3.connect(config.DATABASE_FILE)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT * FROM work_records 
            WHERE user_id = ? AND is_working = TRUE
        ''', (interaction.user.id,))
        
        work_record = cursor.fetchone()
        if not work_record:
            embed = discord.Embed(
                title="⚠️ 출근 기록 없음",
                description=f"{interaction.user.mention}님은 현재 출근 상태가 아닙니다!",
                color=0xffaa00
            )
            embed.set_footer(text="먼저 출근해주세요.")
            await interaction.followup.send(embed=embed, ephemeral=True)
            conn.close()
            return
        
        now = datetime.datetime.now()
        start_time = datetime.datetime.fromisoformat(work_record[4])
        work_duration = int((now - start_time).total_seconds() / 60)
        
        cursor.execute('''
            UPDATE work_records 
            SET end_time = ?, work_duration = ?, is_working = FALSE
            WHERE id = ?
        ''', (now, work_duration, work_record[0]))
        
        conn.commit()
        
        user_department = work_record[3]
        
        dm_embed = discord.Embed(
            title="✅ 퇴근 완료",
            description=f"**{interaction.user.display_name}**님의 퇴근이 완료되었습니다!",
            color=config.BOT_COLOR
        )
        dm_embed.add_field(name="출근 시간", value=start_time.strftime("%Y-%m-%d %H:%M:%S"), inline=True)
        dm_embed.add_field(name="퇴근 시간", value=now.strftime("%Y-%m-%d %H:%M:%S"), inline=True)
        dm_embed.add_field(name="근무 시간", value=f"{work_duration}분", inline=False)
        dm_embed.set_footer(text="수고하셨습니다! 🎉")
        
        try:
            await interaction.user.send(embed=dm_embed)
        except:
            pass
        
        cursor.execute('''
            SELECT channel_id FROM channel_settings 
            WHERE guild_id = ? AND setting_type = 'work_end' AND department = ?
        ''', (interaction.guild.id, user_department))
        
        result = cursor.fetchone()
        conn.close()
        
        if result:
            channel = interaction.guild.get_channel(result[0])
            if channel:
                dept_embed = discord.Embed(
                    title="💼ㅣDISCORD :: TOPIA BOT",
                    description=f"{interaction.user.mention} 님의 근무가 종료되었습니다\n\n**퇴근시간:** {now.strftime('%Y-%m-%d %H:%M:%S')}\n**근무시간:** {work_duration}분",
                    color=config.BOT_COLOR
                )
                dept_embed.set_footer(text="* 오늘도 서버를 위해 활동해주셔서 감사합니다 *")
                await channel.send(embed=dept_embed)
        
        response_embed = discord.Embed(
            title="✅ 퇴근 처리 완료",
            description=f"퇴근이 성공적으로 처리되었습니다!\n근무시간: {work_duration}분",
            color=config.BOT_COLOR
        )
        await interaction.followup.send(embed=response_embed, ephemeral=True)

class WorkSystem(commands.Cog):

    @app_commands.command(name="근무시간", description="사용자의 근무시간을 추가하거나 제거합니다 (관리자 전용)")
    @app_commands.describe(
        작업="추가 또는 제거를 선택하세요",
        사용자="대상 사용자",
        시간="시간 (0-23)",
        분="분 (0-59)",
        사유="추가/제거 사유 (선택사항)"
    )
    @app_commands.choices(작업=[
        app_commands.Choice(name="추가", value="add"),
        app_commands.Choice(name="제거", value="remove")
    ])
    async def manage_work_time(self, interaction: discord.Interaction, 작업: str, 사용자: discord.Member, 시간: int, 분: int, 사유: str = "관리자 조정"):
        if not interaction.user.guild_permissions.administrator:
            embed = discord.Embed(
                title="❌ 권한 없음",
                description="이 명령어는 관리자만 사용할 수 있습니다.",
                color=0xff0000
            )
            await interaction.response.send_message(embed=embed, ephemeral=True)
            return
        
        if not (0 <= 시간 <= 23):
            embed = discord.Embed(
                title="❌ 잘못된 입력",
                description="시간은 0-23 사이의 값이어야 합니다.",
                color=0xff0000
            )
            await interaction.response.send_message(embed=embed, ephemeral=True)
            return
            
        if not (0 <= 분 <= 59):
            embed = discord.Embed(
                title="❌ 잘못된 입력",
                description="분은 0-59 사이의 값이어야 합니다.",
                color=0xff0000
            )
            await interaction.response.send_message(embed=embed, ephemeral=True)
            return
        

        total_minutes = (시간 * 60) + 분
        
        if total_minutes == 0:
            embed = discord.Embed(
                title="❌ 잘못된 입력",
                description="0시간 0분은 추가/제거할 수 없습니다.",
                color=0xff0000
            )
            await interaction.response.send_message(embed=embed, ephemeral=True)
            return
        
        conn = sqlite3.connect(config.DATABASE_FILE)
        cursor = conn.cursor()
        

        user_roles = [role.id for role in 사용자.roles]
        user_department = None
        for dept, role_id in config.DEPARTMENT_ROLES.items():
            if role_id in user_roles:
                user_department = dept
                break
        
        if not user_department:
            embed = discord.Embed(
                title="❌ 부서 미확인",
                description=f"{사용자.mention}님의 소속 부서를 확인할 수 없습니다.",
                color=0xff0000
            )
            await interaction.response.send_message(embed=embed, ephemeral=True)
            conn.close()
            return
        

        now = datetime.datetime.now()
        
        if 작업 == "add":
            start_time = now - datetime.timedelta(minutes=total_minutes)
            
            cursor.execute('''
                INSERT INTO work_records (user_id, username, department, start_time, end_time, work_duration, is_working, manual_adjustment, adjustment_reason, adjusted_by)
                VALUES (?, ?, ?, ?, ?, ?, FALSE, TRUE, ?, ?)
            ''', (사용자.id, 사용자.display_name, user_department, start_time, now, total_minutes, 사유, interaction.user.id))
            
            action_text = "추가"
            color = 0x00ff00
            
        else:  
            cursor.execute('''
                SELECT id, work_duration FROM work_records 
                WHERE user_id = ? AND end_time IS NOT NULL AND work_duration > 0
                ORDER BY end_time DESC LIMIT 1
            ''', (사용자.id,))
            
            latest_record = cursor.fetchone()
            if not latest_record:
                embed = discord.Embed(
                    title="❌ 제거할 기록 없음",
                    description=f"{사용자.mention}님의 근무 기록이 없어 시간을 제거할 수 없습니다.",
                    color=0xff0000
                )
                await interaction.response.send_message(embed=embed, ephemeral=True)
                conn.close()
                return
            
            current_duration = latest_record[1] or 0
            if current_duration < total_minutes:
                embed = discord.Embed(
                    title="❌ 제거할 시간 부족",
                    description=f"제거하려는 시간({total_minutes}분)이 가장 최근 근무시간({current_duration}분)보다 큽니다.",
                    color=0xff0000
                )
                await interaction.response.send_message(embed=embed, ephemeral=True)
                conn.close()
                return
            
            cursor.execute('''
                INSERT INTO work_records (user_id, username, department, start_time, end_time, work_duration, is_working, manual_adjustment, adjustment_reason, adjusted_by)
                VALUES (?, ?, ?, ?, ?, ?, FALSE, TRUE, ?, ?)
            ''', (사용자.id, 사용자.display_name, user_department, now, now, -total_minutes, 사유, interaction.user.id))
            
            action_text = "제거"
            color = 0xff6b6b
        
        conn.commit()
        
        dm_embed = discord.Embed(
            title=f"⏰ 근무시간 {action_text}",
            description=f"**{사용자.display_name}**님의 근무시간이 {action_text}되었습니다.",
            color=color
        )
        dm_embed.add_field(name=f"{action_text}된 시간", value=f"{시간}시간 {분}분 ({total_minutes}분)", inline=True)
        dm_embed.add_field(name="처리자", value=interaction.user.display_name, inline=True)
        dm_embed.add_field(name="사유", value=사유, inline=False)
        dm_embed.add_field(name="처리 시간", value=now.strftime("%Y-%m-%d %H:%M:%S"), inline=False)
        dm_embed.set_footer(text="문의사항이 있으시면 관리자에게 연락해주세요.")
        
        try:
            await 사용자.send(embed=dm_embed)
        except:
            pass
        
        cursor.execute('''
            SELECT channel_id FROM channel_settings 
            WHERE guild_id = ? AND setting_type = 'work_end' AND department = ?
        ''', (interaction.guild.id, user_department))
        
        result = cursor.fetchone()
        conn.close()
        
        if result:
            channel = interaction.guild.get_channel(result[0])
            if channel:
                dept_embed = discord.Embed(
                    title="💼ㅣDISCORD :: TOPIA BOT",
                    description=f"{사용자.mention} 님의 근무시간이 {action_text}되었습니다\n\n**{action_text}된 시간:** {시간}시간 {분}분 ({total_minutes}분)\n**처리자:** {interaction.user.mention}\n**사유:** {사유}",
                    color=color
                )
                dept_embed.set_footer(text=f"* 관리자에 의한 근무시간 {action_text} *")
                await channel.send(embed=dept_embed)
        
        response_embed = discord.Embed(
            title=f"✅ 근무시간 {action_text} 완료",
            description=f"{사용자.mention}님의 근무시간 {action_text}이 완료되었습니다!\n{action_text}된 시간: {시간}시간 {분}분 ({total_minutes}분)",
            color=config.BOT_COLOR
        )
        await interaction.response.send_message(embed=response_embed, ephemeral=True)

    @app_commands.command(name="근무조정기록", description="근무시간 조정 기록을 조회합니다")
    @app_commands.describe(사용자="조회할 사용자 (선택사항)", 기간="조회할 기간")
    @app_commands.choices(기간=[
        app_commands.Choice(name="이번주", value="week"),
        app_commands.Choice(name="이번달", value="month"),
        app_commands.Choice(name="전체", value="all")
    ])
    async def check_adjustment_records(self, interaction: discord.Interaction, 기간: str, 사용자: discord.Member = None):
        if not interaction.user.guild_permissions.administrator:
            embed = discord.Embed(
                title="❌ 권한 없음",
                description="이 명령어는 관리자만 사용할 수 있습니다.",
                color=0xff0000
            )
            await interaction.response.send_message(embed=embed, ephemeral=True)
            return
        
        now = datetime.datetime.now()
        
        if 기간 == "week":
            start_date = now - datetime.timedelta(days=now.weekday())
            start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
            period_text = "이번주"
        elif 기간 == "month":
            start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            period_text = "이번달"
        else: 
            start_date = datetime.datetime(2020, 1, 1)
            period_text = "전체"
        
        conn = sqlite3.connect(config.DATABASE_FILE)
        cursor = conn.cursor()
        
        if 사용자:
            # 특정 사용자의 조정 기록
            cursor.execute('''
                SELECT start_time, work_duration, adjustment_reason, adjusted_by
                FROM work_records 
                WHERE user_id = ? AND manual_adjustment = TRUE AND start_time >= ?
                ORDER BY start_time DESC
                LIMIT 20
            ''', (사용자.id, start_date))
            
            title = f"📝 {사용자.display_name}님의 근무시간 조정 기록 ({period_text})"
        else:
            # 전체 조정 기록
            cursor.execute('''
                SELECT username, start_time, work_duration, adjustment_reason, adjusted_by
                FROM work_records 
                WHERE manual_adjustment = TRUE AND start_time >= ?
                ORDER BY start_time DESC
                LIMIT 20
            ''', (start_date,))
            
            title = f"📝 근무시간 조정 기록 ({period_text})"
        
        results = cursor.fetchall()
        
        embed = discord.Embed(
            title=title,
            color=config.BOT_COLOR
        )
        
        if results:
            record_info = []
            for result in results:
                if 사용자:
                    record_time, duration, reason, adjusted_by_id = result
                    adjusted_by_user = interaction.guild.get_member(adjusted_by_id)
                    adjusted_by_name = adjusted_by_user.display_name if adjusted_by_user else "Unknown"
                    
                    time_str = datetime.datetime.fromisoformat(record_time).strftime('%m/%d %H:%M')
                    duration_text = f"+{duration}분" if duration > 0 else f"{duration}분"
                    
                    record_info.append(f"**{time_str}** | {duration_text} | {reason} | 처리자: {adjusted_by_name}")
                else:
                    # 전체 조회
                    username, record_time, duration, reason, adjusted_by_id = result
                    adjusted_by_user = interaction.guild.get_member(adjusted_by_id)
                    adjusted_by_name = adjusted_by_user.display_name if adjusted_by_user else "Unknown"
                    
                    time_str = datetime.datetime.fromisoformat(record_time).strftime('%m/%d %H:%M')
                    duration_text = f"+{duration}분" if duration > 0 else f"{duration}분"
                    
                    record_info.append(f"**{username}** | {time_str} | {duration_text} | {reason} | {adjusted_by_name}")
            
            current_text = ""
            field_count = 1
            
            for record in record_info:
                if len(current_text + record + "\n") > 1020:  
                    embed.add_field(name=f"조정 기록 {field_count}", value=current_text, inline=False)
                    current_text = record + "\n"
                    field_count += 1
                else:
                    current_text += record + "\n"
            
            if current_text:
                embed.add_field(name=f"조정 기록 {field_count}" if field_count > 1 else "조정 기록", value=current_text, inline=False)
        else:
            embed.add_field(name="조정 기록", value="해당 기간에 조정 기록이 없습니다.", inline=False)
        
        embed.set_footer(text="최근 20개 기록만 표시됩니다.")
        
        conn.close()
        await interaction.response.send_message(embed=embed, ephemeral=True)

    @app_commands.command(name="출근채널지정", description="출근 버튼을 설정할 채널을 지정합니다")
    @app_commands.describe(채널="출근 버튼을 설정할 채널")
    async def set_work_start_channel(self, interaction: discord.Interaction, 채널: discord.TextChannel):
        embed = discord.Embed(
            title="💼ㅣDISCORD :: TOPIA BOT",
            description=f'디스코드 토피아 "{config.BOT_NAME}" 이 관리하는 출퇴근 기능입니다!\n\n임베드 하단의 " 버튼 " 을 통해!\n출/퇴근을 해주세요!\n\n* 오늘도 서버를 위해 활동해주셔서 감사합니다 *',
            color=config.BOT_COLOR
        )
        
        view = WorkButtons()
        await 채널.send(embed=embed, view=view)
        
        conn = sqlite3.connect(config.DATABASE_FILE)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT OR REPLACE INTO channel_settings (guild_id, setting_type, channel_id)
            VALUES (?, 'work_channel', ?)
        ''', (interaction.guild.id, 채널.id))
        conn.commit()
        conn.close()
        
        response_embed = discord.Embed(
            title="✅ 설정 완료",
            description=f"{채널.mention}에 출근 시스템이 설정되었습니다!",
            color=config.BOT_COLOR
        )
        await interaction.response.send_message(embed=response_embed, ephemeral=True)
        
    def __init__(self, bot):
        self.bot = bot
        self.auto_logout_check.start()  

    def cog_unload(self):
        self.auto_logout_check.cancel()  

    @tasks.loop(minutes=5) 
    async def auto_logout_check(self):
        """2시간 이상 근무중인 사용자 자동 퇴근 처리"""
        try:
            conn = sqlite3.connect(config.DATABASE_FILE)
            cursor = conn.cursor()
            
           
            now = datetime.datetime.now()
            two_hours_ago = now - datetime.timedelta(hours=2)
            
            cursor.execute('''
                SELECT * FROM work_records 
                WHERE is_working = TRUE AND start_time <= ?
            ''', (two_hours_ago,))
            
            overdue_records = cursor.fetchall()
            
            for record in overdue_records:
                user_id = record[1]
                username = record[2]
                department = record[3]
                start_time = datetime.datetime.fromisoformat(record[4])
                
                work_duration = 120  
                end_time = start_time + datetime.timedelta(minutes=120)
                
                cursor.execute('''
                    UPDATE work_records 
                    SET end_time = ?, work_duration = ?, is_working = FALSE, auto_logout = TRUE
                    WHERE id = ?
                ''', (end_time, work_duration, record[0]))
                
                user = None
                for guild in self.bot.guilds:
                    user = guild.get_member(user_id)
                    if user:
                        dm_embed = discord.Embed(
                            title="🔄 자동 퇴근 처리",
                            description=f"**{username}**님의 자동 퇴근이 처리되었습니다!",
                            color=0xffa500
                        )
                        dm_embed.add_field(name="출근 시간", value=start_time.strftime("%Y-%m-%d %H:%M:%S"), inline=True)
                        dm_embed.add_field(name="퇴근 시간", value=end_time.strftime("%Y-%m-%d %H:%M:%S"), inline=True)
                        dm_embed.add_field(name="근무 시간", value="120분 (2시간)", inline=False)
                        dm_embed.add_field(name="사유", value="잠수방지를 위한 자동출퇴근 시스템", inline=False)
                        dm_embed.set_footer(text="다시 출근을 원하시면 출근 버튼을 눌러주세요! 💪")
                        
                        try:
                            await user.send(embed=dm_embed)
                        except:
                            pass
                        
                        cursor.execute('''
                            SELECT channel_id FROM channel_settings 
                            WHERE guild_id = ? AND setting_type = 'work_end' AND department = ?
                        ''', (guild.id, department))
                        
                        channel_result = cursor.fetchone()
                        if channel_result:
                            channel = guild.get_channel(channel_result[0])
                            if channel:
                                dept_embed = discord.Embed(
                                    title="💼ㅣDISCORD :: TOPIA BOT",
                                    description=f"{user.mention} 님의 자동 퇴근이 처리되었습니다\n\n**퇴근시간:** {end_time.strftime('%Y-%m-%d %H:%M:%S')}\n**근무시간:** 120분 (2시간)\n**사유:** 자동출퇴근 시스템",
                                    color=0xffa500
                                )
                                dept_embed.set_footer(text="* 2시간 연속 근무로 인한 자동 퇴근 처리 *")
                                await channel.send(embed=dept_embed)
                        break
            
            conn.commit()
            conn.close()
            
        except Exception as e:
            print(f"자동 퇴근 체크 중 오류 발생: {e}")

    @auto_logout_check.before_loop
    async def before_auto_logout_check(self):
        """봇이 준비될 때까지 대기"""
        await self.bot.wait_until_ready()

    @app_commands.command(name="출근채널지정", description="출근 버튼을 설정할 채널을 지정합니다")
    @app_commands.describe(채널="출근 버튼을 설정할 채널")
    async def set_work_start_channel(self, interaction: discord.Interaction, 채널: discord.TextChannel):
        embed = discord.Embed(
            title="💼ㅣDISCORD :: TOPIA BOT",
            description=f'디스코드 토피아 "{config.BOT_NAME}" 이 관리하는 출퇴근 기능입니다!\n\n임베드 하단의 " 버튼 " 을 통해!\n출/퇴근을 해주세요!\n\n⚠️ **2시간 연속 근무 시 자동으로 퇴근 처리됩니다**\n\n* 오늘도 서버를 위해 활동해주셔서 감사합니다 *',
            color=config.BOT_COLOR
        )
        
        view = WorkButtons()
        await 채널.send(embed=embed, view=view)
        
        conn = sqlite3.connect(config.DATABASE_FILE)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT OR REPLACE INTO channel_settings (guild_id, setting_type, channel_id)
            VALUES (?, 'work_channel', ?)
        ''', (interaction.guild.id, 채널.id))
        conn.commit()
        conn.close()
        
        response_embed = discord.Embed(
            title="✅ 설정 완료",
            description=f"{채널.mention}에 출근 시스템이 설정되었습니다!",
            color=config.BOT_COLOR
        )
        await interaction.response.send_message(embed=response_embed, ephemeral=True)

    @app_commands.command(name="퇴근채널지정", description="퇴근 버튼을 설정할 채널을 지정합니다")
    @app_commands.describe(채널="퇴근 버튼을 설정할 채널")
    async def set_work_end_channel(self, interaction: discord.Interaction, 채널: discord.TextChannel):
        embed = discord.Embed(
            title="💼ㅣDISCORD :: TOPIA BOT",
            description=f'디스코드 토피아 "{config.BOT_NAME}" 이 관리하는 출퇴근 기능입니다!\n\n임베드 하단의 " 버튼 " 을 통해!\n출/퇴근을 해주세요!\n\n⚠️ **2시간 연속 근무 시 자동으로 퇴근 처리됩니다**\n\n* 오늘도 서버를 위해 활동해주셔서 감사합니다 *',
            color=config.BOT_COLOR
        )
        
        view = WorkButtons()
        await 채널.send(embed=embed, view=view)
        
        response_embed = discord.Embed(
            title="✅ 설정 완료",
            description=f"{채널.mention}에 퇴근 시스템이 설정되었습니다!",
            color=config.BOT_COLOR
        )
        await interaction.response.send_message(embed=response_embed, ephemeral=True)

    @app_commands.command(name="출근기록채널", description="부서별 출근 기록을 받을 채널을 지정합니다")
    @app_commands.describe(채널="출근 기록을 받을 채널", 부서="부서명")
    @app_commands.choices(부서=[
        app_commands.Choice(name="단속팀", value="단속팀"),
        app_commands.Choice(name="행정팀", value="행정팀"),
        app_commands.Choice(name="사절단", value="사절단"),
        app_commands.Choice(name="총괄팀", value="총괄팀"),
        app_commands.Choice(name="개발팀", value="개발팀")
    ])
    async def set_work_start_record_channel(self, interaction: discord.Interaction, 채널: discord.TextChannel, 부서: str):
        conn = sqlite3.connect(config.DATABASE_FILE)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT OR REPLACE INTO channel_settings (guild_id, setting_type, channel_id, department)
            VALUES (?, 'work_start', ?, ?)
        ''', (interaction.guild.id, 채널.id, 부서))
        conn.commit()
        conn.close()
        
        embed = discord.Embed(
            title="✅ 설정 완료",
            description=f"{부서}의 출근 기록이 {채널.mention}에 전송됩니다!",
            color=config.BOT_COLOR
        )
        await interaction.response.send_message(embed=embed, ephemeral=True)

    @app_commands.command(name="퇴근기록채널", description="부서별 퇴근 기록을 받을 채널을 지정합니다")
    @app_commands.describe(채널="퇴근 기록을 받을 채널", 부서="부서명")
    @app_commands.choices(부서=[
        app_commands.Choice(name="단속팀", value="단속팀"),
        app_commands.Choice(name="행정팀", value="행정팀"),
        app_commands.Choice(name="사절단", value="사절단"),
        app_commands.Choice(name="총괄팀", value="총괄팀"),
        app_commands.Choice(name="개발팀", value="개발팀")
    ])
    async def set_work_end_record_channel(self, interaction: discord.Interaction, 채널: discord.TextChannel, 부서: str):
        conn = sqlite3.connect(config.DATABASE_FILE)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT OR REPLACE INTO channel_settings (guild_id, setting_type, channel_id, department)
            VALUES (?, 'work_end', ?, ?)
        ''', (interaction.guild.id, 채널.id, 부서))
        conn.commit()
        conn.close()
        
        embed = discord.Embed(
            title="✅ 설정 완료",
            description=f"{부서}의 퇴근 기록이 {채널.mention}에 전송됩니다!",
            color=config.BOT_COLOR
        )
        await interaction.response.send_message(embed=embed, ephemeral=True)

    @app_commands.command(name="근무중조회", description="현재 근무중인 인원을 조회합니다")
    @app_commands.describe(종류="조회할 종류를 선택하세요")
    @app_commands.choices(종류=[
        app_commands.Choice(name="전체", value="전체"),
        app_commands.Choice(name="개인", value="개인"),
        app_commands.Choice(name="단속팀", value="단속팀"),
        app_commands.Choice(name="행정팀", value="행정팀"),
        app_commands.Choice(name="사절단", value="사절단"),
        app_commands.Choice(name="총괄팀", value="총괄팀"),
        app_commands.Choice(name="개발팀", value="개발팀")
    ])

    async def check_working(self, interaction: discord.Interaction, 종류: str):
        conn = sqlite3.connect(config.DATABASE_FILE)
        cursor = conn.cursor()
        
        if 종류 == "전체":
            cursor.execute('SELECT COUNT(*) FROM work_records WHERE is_working = TRUE')
            total_count = cursor.fetchone()[0]
            
            embed = discord.Embed(
                title="📊 전체 근무 현황",
                description=f"**현재 근무중인 총 인원: {total_count}명**",
                color=config.BOT_COLOR
            )
            
            for dept in config.DEPARTMENT_ROLES.keys():
                cursor.execute('SELECT username FROM work_records WHERE is_working = TRUE AND department = ?', (dept,))
                working_users = cursor.fetchall()
                
                if working_users:
                    user_list = "\n".join([f"• {user[0]}" for user in working_users])
                    embed.add_field(name=f"{dept} ({len(working_users)}명)", value=user_list, inline=False)
                else:
                    embed.add_field(name=f"{dept} (0명)", value="근무중인 인원 없음", inline=False)
                    
        elif 종류 == "개인":
            cursor.execute('SELECT * FROM work_records WHERE user_id = ? AND is_working = TRUE', (interaction.user.id,))
            user_record = cursor.fetchone()
            
            embed = discord.Embed(
                title="👤 개인 근무 현황",
                color=config.BOT_COLOR
            )
            
            if user_record:
                start_time = datetime.datetime.fromisoformat(user_record[4])
                now = datetime.datetime.now()
                current_duration = int((now - start_time).total_seconds() / 60)
                
                remaining_minutes = 120 - current_duration
                
                embed.description = f"**{interaction.user.display_name}님은 현재 근무중입니다**"
                embed.add_field(name="출근 시간", value=start_time.strftime("%Y-%m-%d %H:%M:%S"), inline=True)
                embed.add_field(name="현재 근무시간", value=f"{current_duration}분", inline=True)
                embed.add_field(name="소속 부서", value=user_record[3], inline=True)
                
                if remaining_minutes > 0:
                    embed.add_field(name="자동 퇴근까지", value=f"{remaining_minutes}분 남음", inline=False)
                else:
                    embed.add_field(name="⚠️ 알림", value="자동 퇴근 처리 대상입니다", inline=False)
            else:
                embed.description = f"**{interaction.user.display_name}님은 현재 근무중이 아닙니다**"
                
        else:
            cursor.execute('SELECT username, start_time FROM work_records WHERE is_working = TRUE AND department = ?', (종류,))
            working_users = cursor.fetchall()
            
            embed = discord.Embed(
                title=f"🏢 {종류} 근무 현황",
                description=f"**현재 근무중인 {종류} 인원: {len(working_users)}명**",
                color=config.BOT_COLOR
            )
            
            if working_users:
                user_info = []
                for user, start_time in working_users:
                    start_dt = datetime.datetime.fromisoformat(start_time)
                    duration = int((datetime.datetime.now() - start_dt).total_seconds() / 60)
                    remaining = 120 - duration
                    
                    if remaining > 0:
                        user_info.append(f"• {user} (근무시간: {duration}분, 자동퇴근까지: {remaining}분)")
                    else:
                        user_info.append(f"• {user} (근무시간: {duration}분, ⚠️자동퇴근 대상)")
                
                embed.add_field(name="근무중인 멤버", value="\n".join(user_info), inline=False)
            else:
                embed.add_field(name="근무중인 멤버", value="현재 근무중인 인원이 없습니다.", inline=False)
        
        conn.close()
        await interaction.response.send_message(embed=embed)

    @app_commands.command(name="근무기록조회", description="근무 기록을 조회합니다 (이번주)")
    @app_commands.describe(종류="조회할 종류를 선택하세요")
    @app_commands.choices(종류=[
        app_commands.Choice(name="전체", value="전체"),
        app_commands.Choice(name="개인", value="개인"),
        app_commands.Choice(name="단속팀", value="단속팀"),
        app_commands.Choice(name="행정팀", value="행정팀"),
        app_commands.Choice(name="사절단", value="사절단"),
        app_commands.Choice(name="총괄팀", value="총괄팀"),
        app_commands.Choice(name="개발팀", value="개발팀")
    ])

    async def check_work_records(self, interaction: discord.Interaction, 종류: str):
        now = datetime.datetime.now()
        week_start = now - datetime.timedelta(days=now.weekday())
        week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
        
        conn = sqlite3.connect(config.DATABASE_FILE)
        cursor = conn.cursor()
        
        if 종류 == "전체":
            embed = discord.Embed(
                title="📈 전체 근무 기록 (이번주)",
                description=f"**기간:** {week_start.strftime('%Y-%m-%d')} ~ {now.strftime('%Y-%m-%d')}",
                color=config.BOT_COLOR
            )
            
            for dept in config.DEPARTMENT_ROLES.keys():
                cursor.execute('''
                    SELECT username, SUM(work_duration) as total_time
                    FROM work_records 
                    WHERE department = ? AND start_time >= ? AND end_time IS NOT NULL
                    GROUP BY user_id, username
                    ORDER BY total_time DESC
                ''', (dept, week_start))
                
                results = cursor.fetchall()
                if results:
                    dept_info = []
                    for username, total_time in results:
                        dept_info.append(f"• {username}: {total_time or 0}분")
                    embed.add_field(name=f"🏢 {dept}", value="\n".join(dept_info), inline=False)
                else:
                    embed.add_field(name=f"🏢 {dept}", value="이번주 근무 기록 없음", inline=False)
                    
        elif 종류 == "개인":
            cursor.execute('''
                SELECT start_time, end_time, work_duration, auto_logout
                FROM work_records 
                WHERE user_id = ? AND start_time >= ? AND end_time IS NOT NULL
                ORDER BY start_time DESC
            ''', (interaction.user.id, week_start))
            
            results = cursor.fetchall()
            total_time = sum([record[2] or 0 for record in results])
            
            embed = discord.Embed(
                title="👤 개인 근무 기록 (이번주)",
                description=f"**{interaction.user.display_name}님의 이번주 총 근무시간: {total_time}분**",
                color=config.BOT_COLOR
            )
            
            if results:
                record_info = []
                for start_time, end_time, duration, auto_logout in results:
                    start_dt = datetime.datetime.fromisoformat(start_time)
                    end_dt = datetime.datetime.fromisoformat(end_time)
                    auto_text = " (자동퇴근)" if auto_logout else ""
                    
                    record_info.append(
                        f"• {start_dt.strftime('%m/%d %H:%M')} ~ {end_dt.strftime('%H:%M')} ({duration}분){auto_text}"
                    )
                
                if len(record_info) > 10:
                    record_info = record_info[:10]
                    record_info.append("... (최근 10개 기록만 표시)")
                
                embed.add_field(name="근무 기록", value="\n".join(record_info), inline=False)
            else:
                embed.add_field(name="근무 기록", value="이번주 근무 기록이 없습니다.", inline=False)
                
        else:
            cursor.execute('''
                SELECT username, SUM(work_duration) as total_time
                FROM work_records 
                WHERE department = ? AND start_time >= ? AND end_time IS NOT NULL
                GROUP BY user_id, username
                ORDER BY total_time DESC
            ''', (종류, week_start))
            
            results = cursor.fetchall()
            total_dept_time = sum([record[1] or 0 for record in results])
            
            embed = discord.Embed(
                title=f"🏢 {종류} 근무 기록 (이번주)",
                description=f"**{종류} 이번주 총 근무시간: {total_dept_time}분**",
                color=config.BOT_COLOR
            )
            
            if results:
                record_info = []
                for username, total_time in results:
                    record_info.append(f"• {username}: {total_time or 0}분")
                
                embed.add_field(name="멤버별 근무시간", value="\n".join(record_info), inline=False)
            else:
                embed.add_field(name="근무 기록", value="이번주 근무 기록이 없습니다.", inline=False)
        
        conn.close()
        await interaction.response.send_message(embed=embed)

    @app_commands.command(name="근무강제퇴근", description="특정 사용자를 강제로 퇴근 처리합니다 (관리자 전용)")
    @app_commands.describe(사용자="강제 퇴근시킬 사용자")
    async def force_logout(self, interaction: discord.Interaction, 사용자: discord.Member):
        if not interaction.user.guild_permissions.administrator:
            embed = discord.Embed(
                title="❌ 권한 없음",
                description="이 명령어는 관리자만 사용할 수 있습니다.",
                color=0xff0000
            )
            await interaction.response.send_message(embed=embed, ephemeral=True)
            return
        
        conn = sqlite3.connect(config.DATABASE_FILE)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT * FROM work_records 
            WHERE user_id = ? AND is_working = TRUE
        ''', (사용자.id,))
        
        work_record = cursor.fetchone()
        if not work_record:
            embed = discord.Embed(
                title="⚠️ 출근 기록 없음",
                description=f"{사용자.mention}님은 현재 출근 상태가 아닙니다!",
                color=0xffaa00
            )
            await interaction.response.send_message(embed=embed, ephemeral=True)
            conn.close()
            return
        
        now = datetime.datetime.now()
        start_time = datetime.datetime.fromisoformat(work_record[4])
        work_duration = int((now - start_time).total_seconds() / 60)  # 분 단위
        
        cursor.execute('''
            UPDATE work_records 
            SET end_time = ?, work_duration = ?, is_working = FALSE, force_logout = TRUE
            WHERE id = ?
        ''', (now, work_duration, work_record[0]))
        
        conn.commit()
        
        user_department = work_record[3]
        
        dm_embed = discord.Embed(
            title="🔨 강제 퇴근 처리",
            description=f"**{사용자.display_name}**님이 관리자에 의해 강제 퇴근 처리되었습니다.",
            color=0xff6b6b
        )
        dm_embed.add_field(name="출근 시간", value=start_time.strftime("%Y-%m-%d %H:%M:%S"), inline=True)
        dm_embed.add_field(name="퇴근 시간", value=now.strftime("%Y-%m-%d %H:%M:%S"), inline=True)
        dm_embed.add_field(name="근무 시간", value=f"{work_duration}분", inline=False)
        dm_embed.add_field(name="처리자", value=interaction.user.display_name, inline=False)
        dm_embed.set_footer(text="문의사항이 있으시면 관리자에게 연락해주세요.")
        
        try:
            await 사용자.send(embed=dm_embed)
        except:
            pass
        
        cursor.execute('''
            SELECT channel_id FROM channel_settings 
            WHERE guild_id = ? AND setting_type = 'work_end' AND department = ?
        ''', (interaction.guild.id, user_department))
        
        result = cursor.fetchone()
        conn.close()
        
        if result:
            channel = interaction.guild.get_channel(result[0])
            if channel:
                dept_embed = discord.Embed(
                    title="💼ㅣDISCORD :: TOPIA BOT",
                    description=f"{사용자.mention} 님이 관리자에 의해 강제 퇴근 처리되었습니다\n\n**퇴근시간:** {now.strftime('%Y-%m-%d %H:%M:%S')}\n**근무시간:** {work_duration}분\n**처리자:** {interaction.user.mention}",
                    color=0xff6b6b
                )
                dept_embed.set_footer(text="* 관리자에 의한 강제 퇴근 처리 *")
                await channel.send(embed=dept_embed)
        
        response_embed = discord.Embed(
            title="✅ 강제 퇴근 처리 완료",
            description=f"{사용자.mention}님의 강제 퇴근이 처리되었습니다!\n근무시간: {work_duration}분",
            color=config.BOT_COLOR
        )
        await interaction.response.send_message(embed=response_embed, ephemeral=True)

    @app_commands.command(name="근무통계", description="근무 통계를 조회합니다")
    @app_commands.describe(기간="조회할 기간을 선택하세요")
    @app_commands.choices(기간=[
        app_commands.Choice(name="오늘", value="today"),
        app_commands.Choice(name="이번주", value="week"),
        app_commands.Choice(name="이번달", value="month")
    ])
    async def work_stats(self, interaction: discord.Interaction, 기간: str):
        now = datetime.datetime.now()
        
        if 기간 == "today":
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
            title = "📊 오늘의 근무 통계"
        elif 기간 == "week":
            start_date = now - datetime.timedelta(days=now.weekday())
            start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
            title = "📊 이번주 근무 통계"
        else:  # month
            start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            title = "📊 이번달 근무 통계"
        
        conn = sqlite3.connect(config.DATABASE_FILE)
        cursor = conn.cursor()
        
        # 전체 통계
        cursor.execute('''
            SELECT COUNT(*), SUM(work_duration), COUNT(DISTINCT user_id)
            FROM work_records 
            WHERE start_time >= ? AND end_time IS NOT NULL
        ''', (start_date,))
        
        total_records, total_minutes, unique_users = cursor.fetchone()
        total_minutes = total_minutes or 0
        unique_users = unique_users or 0
        
        embed = discord.Embed(
            title=title,
            description=f"**기간:** {start_date.strftime('%Y-%m-%d')} ~ {now.strftime('%Y-%m-%d')}",
            color=config.BOT_COLOR
        )
        
        embed.add_field(name="총 근무 기록", value=f"{total_records}건", inline=True)
        embed.add_field(name="총 근무 시간", value=f"{total_minutes}분 ({total_minutes//60}시간 {total_minutes%60}분)", inline=True)
        embed.add_field(name="근무한 인원", value=f"{unique_users}명", inline=True)
        

        dept_stats = []
        for dept in config.DEPARTMENT_ROLES.keys():
            cursor.execute('''
                SELECT COUNT(*), SUM(work_duration), COUNT(DISTINCT user_id)
                FROM work_records 
                WHERE department = ? AND start_time >= ? AND end_time IS NOT NULL
            ''', (dept, start_date))
            
            dept_records, dept_minutes, dept_users = cursor.fetchone()
            dept_minutes = dept_minutes or 0
            dept_users = dept_users or 0
            
            if dept_records > 0:
                dept_stats.append(f"**{dept}**: {dept_records}건, {dept_minutes}분, {dept_users}명")
        
        if dept_stats:
            embed.add_field(name="부서별 통계", value="\n".join(dept_stats), inline=False)
        
        cursor.execute('''
            SELECT COUNT(*) FROM work_records 
            WHERE start_time >= ? AND auto_logout = TRUE
        ''', (start_date,))
        
        auto_logout_count = cursor.fetchone()[0]
        if auto_logout_count > 0:
            embed.add_field(name="자동 퇴근", value=f"{auto_logout_count}건", inline=True)
        
        cursor.execute('''
            SELECT COUNT(*) FROM work_records 
            WHERE start_time >= ? AND force_logout = TRUE
        ''', (start_date,))
        
        force_logout_count = cursor.fetchone()[0]
        if force_logout_count > 0:
            embed.add_field(name="강제 퇴근", value=f"{force_logout_count}건", inline=True)
        
        if total_records > 0:
            avg_minutes = total_minutes // total_records
            embed.add_field(name="평균 근무 시간", value=f"{avg_minutes}분", inline=True)
        
        conn.close()
        await interaction.response.send_message(embed=embed)

    @app_commands.command(name="근무순위", description="근무시간 순위를 조회합니다")
    @app_commands.describe(기간="조회할 기간을 선택하세요", 부서="부서를 선택하세요 (선택사항)")
    @app_commands.choices(
        기간=[
            app_commands.Choice(name="이번주", value="week"),
            app_commands.Choice(name="이번달", value="month")
        ],
        부서=[
            app_commands.Choice(name="전체", value="전체"),
            app_commands.Choice(name="단속팀", value="단속팀"),
            app_commands.Choice(name="행정팀", value="행정팀"),
            app_commands.Choice(name="사절단", value="사절단"),
            app_commands.Choice(name="총괄팀", value="총괄팀"),
            app_commands.Choice(name="개발팀", value="개발팀")
        ]
    )
    
    async def work_ranking(self, interaction: discord.Interaction, 기간: str, 부서: str = "전체"):
        now = datetime.datetime.now()
        
        if 기간 == "week":
            start_date = now - datetime.timedelta(days=now.weekday())
            start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
            period_text = "이번주"
        else: 
            start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            period_text = "이번달"
        
        conn = sqlite3.connect(config.DATABASE_FILE)
        cursor = conn.cursor()
        
        if 부서 == "전체":
            cursor.execute('''
                SELECT username, department, SUM(work_duration) as total_time
                FROM work_records 
                WHERE start_time >= ? AND end_time IS NOT NULL
                GROUP BY user_id, username, department
                ORDER BY total_time DESC
                LIMIT 10
            ''', (start_date,))
            title = f"🏆 {period_text} 근무시간 순위 (전체)"
        else:
            cursor.execute('''
                SELECT username, department, SUM(work_duration) as total_time
                FROM work_records 
                WHERE department = ? AND start_time >= ? AND end_time IS NOT NULL
                GROUP BY user_id, username, department
                ORDER BY total_time DESC
                LIMIT 10
            ''', (부서, start_date))
            title = f"🏆 {period_text} 근무시간 순위 ({부서})"
        
        results = cursor.fetchall()
        
        embed = discord.Embed(
            title=title,
            description=f"**기간:** {start_date.strftime('%Y-%m-%d')} ~ {now.strftime('%Y-%m-%d')}",
            color=config.BOT_COLOR
        )
        
        if results:
            ranking_text = []
            for i, (username, department, total_time) in enumerate(results, 1):
                total_time = total_time or 0
                hours = total_time // 60
                minutes = total_time % 60
                
                if i == 1:
                    emoji = "🥇"
                elif i == 2:
                    emoji = "🥈"
                elif i == 3:
                    emoji = "🥉"
                else:
                    emoji = f"{i}위"
                
                if 부서 == "전체":
                    ranking_text.append(f"{emoji} **{username}** ({department}) - {total_time}분 ({hours}h {minutes}m)")
                else:
                    ranking_text.append(f"{emoji} **{username}** - {total_time}분 ({hours}h {minutes}m)")
            
            embed.add_field(name="순위", value="\n".join(ranking_text), inline=False)
        else:
            embed.add_field(name="순위", value="근무 기록이 없습니다.", inline=False)
        
        conn.close()
        await interaction.response.send_message(embed=embed)

async def setup(bot):
    await bot.add_cog(WorkSystem(bot))