# coin.py
import discord
from discord.ext import commands
from discord import app_commands
import sqlite3
import asyncio
from datetime import datetime, date, time
import random
import config

class CoinSystem(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.voice_tracking = {}  # {user_id: {'channel_id': int, 'join_time': datetime, 'daily_duration': int}}
        self.excluded_category_id = 1304491131089715262
        self.log_channel_id = None
        self.voice_check_task = None
        self.daily_ranking_task = None
        self.random_event_task = None
        self.premium_kick_task = None
        
        # 채널 타입별 관리
        self.channel_types = {
            'normal_voice': [],      # 일반 통화방 (1분당 1토피, 핫타임 2토피)
            'music': [],             # 음악감상방 (1분당 0.1토피)
            'normal_afk': [],        # 일반 잠수방 (1분당 0.1토피)
            'premium_afk': []        # 프리미엄 잠수방 (1분당 1토피, 랜덤 추방)
        }
        
        # 핫타임 설정 (19시 ~ 22시)
        self.hot_time_start = time(19, 0)
        self.hot_time_end = time(22, 0)
        
        # 랜덤 이벤트 상태
        self.current_event = None
        self.event_answer = None
        self.event_channel_id = None
        
        # 일일 퀘스트 완료 기록
        self.daily_quest_completed = {}  # {user_id: {'chat_xp': bool, 'voice_time': bool}}
        
    @commands.Cog.listener()
    async def on_ready(self):
        print("CoinSystem: 봇이 준비되었습니다.")
        if self.voice_check_task is None:
            self.voice_check_task = asyncio.create_task(self.voice_activity_loop())
        if self.daily_ranking_task is None:
            self.daily_ranking_task = asyncio.create_task(self.daily_ranking_loop())
        if self.random_event_task is None:
            self.random_event_task = asyncio.create_task(self.random_event_loop())
        if self.premium_kick_task is None:
            self.premium_kick_task = asyncio.create_task(self.premium_kick_loop())
    
    def cog_unload(self):
        if self.voice_check_task:
            self.voice_check_task.cancel()
        if self.daily_ranking_task:
            self.daily_ranking_task.cancel()
        if self.random_event_task:
            self.random_event_task.cancel()
        if self.premium_kick_task:
            self.premium_kick_task.cancel()
    
    def get_db_connection(self):
        return sqlite3.connect(config.DATABASE_FILE)
    
    def init_user_coin(self, user_id: int, username: str):
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT OR IGNORE INTO user_coins (user_id, username, balance)
            VALUES (?, ?, 0)
        ''', (user_id, username))
        
        cursor.execute('''
            UPDATE user_coins SET username = ? WHERE user_id = ?
        ''', (username, user_id))
        
        conn.commit()
        conn.close()
    
    def get_user_balance(self, user_id: int):
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT balance FROM user_coins WHERE user_id = ?', (user_id,))
        result = cursor.fetchone()
        conn.close()
        
        return result[0] if result else 0
    
    def update_user_balance(self, user_id: int, username: str, amount: int, admin_id: int = None, reason: str = None, transaction_type: str = "system"):
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        self.init_user_coin(user_id, username)
        
        current_balance = self.get_user_balance(user_id)
        new_balance = current_balance + amount
        
        if new_balance < 0:
            new_balance = 0
            amount = -current_balance
        
        cursor.execute('''
            UPDATE user_coins 
            SET balance = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE user_id = ?
        ''', (new_balance, user_id))
        
        cursor.execute('''
            INSERT INTO coin_transactions 
            (user_id, admin_id, transaction_type, amount, reason, balance_after)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (user_id, admin_id, transaction_type, amount, reason, new_balance))
        
        conn.commit()
        conn.close()
        
        return new_balance
    
    def get_channel_type(self, channel_id: int):
        """채널 타입 반환"""
        for channel_type, channels in self.channel_types.items():
            if channel_id in channels:
                return channel_type
        return None
    
    def is_hot_time(self):
        """현재 핫타임인지 확인"""
        now = datetime.now().time()
        return self.hot_time_start <= now <= self.hot_time_end
    
    def get_coin_rate(self, channel_id: int):
        """채널별 코인 지급률 반환"""
        channel_type = self.get_channel_type(channel_id)
        
        if channel_type == 'normal_voice':
            return 2.0 if self.is_hot_time() else 1.0
        elif channel_type in ['music', 'normal_afk']:
            return 0.1
        elif channel_type == 'premium_afk':
            return 1.0
        
        return 0  # 미등록 채널은 코인 지급 안함
    
    def format_duration(self, seconds):
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        seconds = int(seconds % 60)
        
        duration_parts = []
        if hours > 0:
            duration_parts.append(f"{hours}시간")
        if minutes > 0:
            duration_parts.append(f"{minutes}분")
        if seconds > 0:
            duration_parts.append(f"{seconds}초")
        
        return "".join(duration_parts) if duration_parts else "0초"
    
    async def send_voice_activity_log(self, user, channel, duration_seconds, coins_earned, new_balance):
        if not self.log_channel_id:
            return
        
        log_channel = self.bot.get_channel(self.log_channel_id)
        if not log_channel:
            return
        
        try:
            duration_str = self.format_duration(duration_seconds)
            channel_type = self.get_channel_type(channel.id)
            type_name = {
                'normal_voice': '일반 통화방',
                'music': '음악감상방',
                'normal_afk': '일반 잠수방',
                'premium_afk': '프리미엄 잠수방'
            }.get(channel_type, '미분류')
            
            embed = discord.Embed(
                title="**DISCORD :: Topia Bot ( JUDY )**",
                description=f"{user.mention} 님 {channel.mention} ({type_name})에서 {duration_str} 만큼 머무셨습니다.\n**{coins_earned:.1f}포인트를 지급합니다**\n현재 잔액 : {new_balance:,}",
                color=0x00ff00,
                timestamp=datetime.now()
            )
            
            await log_channel.send(embed=embed)
        except Exception as e:
            pass
    
    async def voice_activity_loop(self):
        await self.bot.wait_until_ready()
        
        while not self.bot.is_closed():
            try:
                current_time = datetime.now()
                users_to_reward = []
                
                for user_id, data in list(self.voice_tracking.items()):
                    join_time = data['join_time']
                    channel_id = data['channel_id']
                    
                    duration = (current_time - join_time).total_seconds()
                    
                    if duration >= 60:
                        channel = self.bot.get_channel(channel_id)
                        coin_rate = self.get_coin_rate(channel_id)
                        
                        if channel and coin_rate > 0:
                            users_to_reward.append((user_id, channel, coin_rate))
                        
                        # 일일 활동 시간 누적
                        self.voice_tracking[user_id]['daily_duration'] += 60
                        self.voice_tracking[user_id]['join_time'] = current_time
                
                for user_id, channel, coin_rate in users_to_reward:
                    try:
                        user = self.bot.get_user(user_id)
                        if user:
                            coins_to_give = coin_rate
                            new_balance = self.update_user_balance(
                                user_id, 
                                user.display_name, 
                                coins_to_give, 
                                reason=f"음성 활동 보상 ({coin_rate}x)",
                                transaction_type="voice_activity"
                            )
                            
                            conn = self.get_db_connection()
                            cursor = conn.cursor()
                            
                            # 일일 랭킹용 데이터 업데이트
                            today = date.today().isoformat()
                            cursor.execute('''
                                INSERT INTO daily_voice_ranking (user_id, date, duration_minutes, coins_earned)
                                VALUES (?, ?, 1, ?)
                                ON CONFLICT(user_id, date) DO UPDATE SET
                                    duration_minutes = duration_minutes + 1,
                                    coins_earned = coins_earned + ?
                            ''', (user_id, today, coins_to_give, coins_to_give))
                            
                            conn.commit()
                            conn.close()
                    except Exception as e:
                        pass
                
                await asyncio.sleep(60)
                
            except Exception as e:
                await asyncio.sleep(60)
    
    async def daily_ranking_loop(self):
        """매일 23시 59분 50초에 1등에게 보상 지급 및 랭킹 초기화"""
        await self.bot.wait_until_ready()
        
        while not self.bot.is_closed():
            try:
                now = datetime.now()
                target_time = now.replace(hour=23, minute=59, second=50, microsecond=0)
                
                if now > target_time:
                    target_time = target_time.replace(day=target_time.day + 1)
                
                wait_seconds = (target_time - now).total_seconds()
                await asyncio.sleep(wait_seconds)
                
                # 1등 유저 찾기
                conn = self.get_db_connection()
                cursor = conn.cursor()
                today = date.today().isoformat()
                
                cursor.execute('''
                    SELECT user_id, duration_minutes, coins_earned
                    FROM daily_voice_ranking
                    WHERE date = ?
                    ORDER BY duration_minutes DESC
                    LIMIT 1
                ''', (today,))
                
                result = cursor.fetchone()
                
                if result:
                    winner_id, duration, coins = result
                    user = self.bot.get_user(winner_id)
                    
                    if user:
                        # 10토피 지급
                        new_balance = self.update_user_balance(
                            winner_id,
                            user.display_name,
                            10,
                            reason="일일 음성 활동 1등 보상",
                            transaction_type="daily_ranking_reward"
                        )
                        
                        # 로그 채널에 알림
                        if self.log_channel_id:
                            log_channel = self.bot.get_channel(self.log_channel_id)
                            if log_channel:
                                embed = discord.Embed(
                                    title="🏆 일일 음성 활동 랭킹 1위!",
                                    description=f"축하합니다! {user.mention} 님이 오늘의 음성 활동 1위를 달성했습니다!",
                                    color=0xffd700,
                                    timestamp=datetime.now()
                                )
                                embed.add_field(name="활동 시간", value=f"{duration}분", inline=True)
                                embed.add_field(name="획득 코인", value=f"{coins:.1f} 토피", inline=True)
                                embed.add_field(name="보상", value="10 토피", inline=True)
                                embed.add_field(name="현재 잔액", value=f"{new_balance:,} 토피", inline=False)
                                
                                await log_channel.send(embed=embed)
                
                # 랭킹 초기화 (어제 데이터 삭제)
                cursor.execute('DELETE FROM daily_voice_ranking WHERE date < ?', (today,))
                conn.commit()
                conn.close()
                
            except Exception as e:
                await asyncio.sleep(60)
    
    async def random_event_loop(self):
        """하루에 한 번 랜덤 시간에 이벤트 진행"""
        await self.bot.wait_until_ready()
        
        while not self.bot.is_closed():
            try:
                # 다음 이벤트 시간 랜덤 설정 (0시 ~ 23시 59분 사이)
                now = datetime.now()
                random_hour = random.randint(0, 23)
                random_minute = random.randint(0, 59)
                
                target_time = now.replace(hour=random_hour, minute=random_minute, second=0, microsecond=0)
                
                if now > target_time:
                    target_time = target_time.replace(day=target_time.day + 1)
                
                wait_seconds = (target_time - now).total_seconds()
                await asyncio.sleep(wait_seconds)
                
                # 이벤트 실행
                await self.start_random_event()
                
            except Exception as e:
                await asyncio.sleep(3600)
    
    async def start_random_event(self):
        """랜덤 이벤트 시작"""
        if not self.log_channel_id:
            return
        
        event_channel = self.bot.get_channel(self.log_channel_id)
        if not event_channel:
            return
        
        # 이벤트 타입 랜덤 선택
        event_types = ['typing', 'emoji', 'math', 'word']
        event_type = random.choice(event_types)
        
        self.current_event = event_type
        self.event_channel_id = self.log_channel_id
        
        embed = discord.Embed(
            title="🎉 랜덤 이벤트 시작!",
            color=0xff00ff,
            timestamp=datetime.now()
        )
        
        if event_type == 'typing':
            words = ['디스코드', '토피아봇', '랜덤이벤트', '빠른손가락', '타이핑마스터']
            self.event_answer = random.choice(words)
            embed.description = f"**받아쓰기 이벤트!**\n다음 단어를 가장 먼저 정확하게 입력하세요!\n\n`{self.event_answer}`"
            
        elif event_type == 'emoji':
            emojis = ['🎮', '🎨', '🎵', '🎬', '📚', '⚡', '🔥', '💎', '🌟', '🎯']
            self.event_answer = random.choice(emojis)
            embed.description = f"**이모지 이벤트!**\n다음 이모지를 가장 먼저 입력하세요!\n\n{self.event_answer}"
            
        elif event_type == 'math':
            num1 = random.randint(10, 99)
            num2 = random.randint(10, 99)
            self.event_answer = str(num1 + num2)
            embed.description = f"**계산 이벤트!**\n다음 계산의 답을 가장 먼저 입력하세요!\n\n`{num1} + {num2} = ?`"
            
        elif event_type == 'word':
            questions = [
                ('대한민국의 수도는?', '서울'),
                ('1년은 몇 개월?', '12'),
                ('지구에서 가장 큰 대륙은?', '아시아'),
                ('물의 화학식은?', 'H2O'),
            ]
            question, answer = random.choice(questions)
            self.event_answer = answer
            embed.description = f"**퀴즈 이벤트!**\n다음 질문에 답하세요!\n\n**Q.** {question}"
        
        embed.add_field(name="보상", value="30 토피", inline=True)
        embed.add_field(name="제한시간", value="60초", inline=True)
        embed.set_footer(text="가장 먼저 정답을 입력한 사람이 보상을 받습니다!")
        
        await event_channel.send(embed=embed)
        
        # 60초 후 이벤트 종료
        await asyncio.sleep(60)
        if self.current_event:
            self.current_event = None
            await event_channel.send("⏰ 이벤트가 종료되었습니다. 다음 기회에 도전하세요!")
    
    @commands.Cog.listener()
    async def on_message(self, message):
        """이벤트 답변 체크 및 일일 퀘스트 체크"""
        if message.author.bot:
            return
        
        # 랜덤 이벤트 답변 체크
        if self.current_event and message.channel.id == self.event_channel_id:
            if message.content == self.event_answer:
                winner = message.author
                new_balance = self.update_user_balance(
                    winner.id,
                    winner.display_name,
                    30,
                    reason=f"랜덤 이벤트 우승 ({self.current_event})",
                    transaction_type="random_event"
                )
                
                embed = discord.Embed(
                    title="🎊 이벤트 우승자!",
                    description=f"축하합니다! {winner.mention} 님이 이벤트에서 우승했습니다!",
                    color=0x00ff00,
                    timestamp=datetime.now()
                )
                embed.add_field(name="보상", value="30 토피", inline=True)
                embed.add_field(name="현재 잔액", value=f"{new_balance:,} 토피", inline=True)
                
                await message.channel.send(embed=embed)
                
                self.current_event = None
                self.event_answer = None
    
    async def premium_kick_loop(self):
        """프리미엄 잠수방 랜덤 추방"""
        await self.bot.wait_until_ready()
        
        while not self.bot.is_closed():
            try:
                # 2~3시간 랜덤 대기
                wait_hours = random.uniform(2, 3)
                await asyncio.sleep(wait_hours * 3600)
                
                # 프리미엄 잠수방에 있는 유저 찾기
                for guild in self.bot.guilds:
                    for channel_id in self.channel_types['premium_afk']:
                        channel = guild.get_channel(channel_id)
                        if channel and len(channel.members) > 0:
                            # 랜덤 유저 선택
                            victim = random.choice(channel.members)
                            
                            try:
                                # 유저 추방
                                await victim.move_to(None)
                                
                                # DM 전송
                                try:
                                    embed = discord.Embed(
                                        title="⚠️ 프리미엄 잠수방 자동 추방",
                                        description=f"{channel.mention} 채널에서 랜덤으로 추방되었습니다.",
                                        color=0xff9900,
                                        timestamp=datetime.now()
                                    )
                                    embed.add_field(name="사유", value="프리미엄 잠수방 랜덤 추방 시스템", inline=False)
                                    embed.set_footer(text="프리미엄 잠수방은 2~3시간마다 랜덤 추방이 진행됩니다.")
                                    
                                    await victim.send(embed=embed)
                                except:
                                    pass
                            except:
                                pass
                
            except Exception as e:
                await asyncio.sleep(3600)
    
    @commands.Cog.listener()
    async def on_voice_state_update(self, member, before, after):
        user_id = member.id
        current_time = datetime.now()
        
        if before.channel is None and after.channel is not None:
            if after.channel.category and after.channel.category.id == self.excluded_category_id:
                return
            
            self.voice_tracking[user_id] = {
                'channel_id': after.channel.id,
                'join_time': current_time,
                'daily_duration': 0
            }
        
        elif before.channel is not None and after.channel is None:
            if user_id in self.voice_tracking:
                join_time = self.voice_tracking[user_id]['join_time']
                daily_duration = self.voice_tracking[user_id]['daily_duration']
                leave_time = current_time
                total_duration_seconds = (leave_time - join_time).total_seconds()
                
                if total_duration_seconds >= 60:
                    coin_rate = self.get_coin_rate(before.channel.id)
                    if coin_rate > 0:
                        coins_earned = (total_duration_seconds // 60) * coin_rate
                        current_balance = self.get_user_balance(user_id)
                        
                        await self.send_voice_activity_log(
                            member, 
                            before.channel, 
                            total_duration_seconds, 
                            coins_earned, 
                            current_balance
                        )
                
                # 일일 퀘스트 체크 (1시간 이상)
                total_daily_minutes = (daily_duration + total_duration_seconds) // 60
                if total_daily_minutes >= 60:
                    await self.check_voice_quest(member.id, member.display_name)
                
                del self.voice_tracking[user_id]
        
        elif before.channel != after.channel and after.channel is not None:
            if user_id in self.voice_tracking and before.channel:
                join_time = self.voice_tracking[user_id]['join_time']
                leave_time = current_time
                duration_seconds = (leave_time - join_time).total_seconds()
                
                if duration_seconds >= 60:
                    coin_rate = self.get_coin_rate(before.channel.id)
                    if coin_rate > 0:
                        coins_earned = (duration_seconds // 60) * coin_rate
                        current_balance = self.get_user_balance(user_id)
                        
                        await self.send_voice_activity_log(
                            member, 
                            before.channel, 
                            duration_seconds, 
                            coins_earned, 
                            current_balance
                        )
            
            if after.channel.category and after.channel.category.id == self.excluded_category_id:
                if user_id in self.voice_tracking:
                    del self.voice_tracking[user_id]
            else:
                self.voice_tracking[user_id] = {
                    'channel_id': after.channel.id,
                    'join_time': current_time,
                    'daily_duration': self.voice_tracking.get(user_id, {}).get('daily_duration', 0)
                }
    
    async def check_voice_quest(self, user_id: int, username: str):
        """음성 채널 1시간 이상 퀘스트 체크"""
        today = date.today().isoformat()
        
        if user_id not in self.daily_quest_completed:
            self.daily_quest_completed[user_id] = {}
        
        key = f"{today}_voice"
        if key not in self.daily_quest_completed[user_id]:
            new_balance = self.update_user_balance(
                user_id,
                username,
                10,
                reason="일일 퀘스트: 통화방 1시간 이상",
                transaction_type="daily_quest"
            )
            
            self.daily_quest_completed[user_id][key] = True
            
            # DM 전송
            try:
                user = self.bot.get_user(user_id)
                if user:
                    embed = discord.Embed(
                        title="✅ 일일 퀘스트 완료!",
                        description="통화방에서 1시간 이상 활동하셨습니다!",
                        color=0x00ff00,
                        timestamp=datetime.now()
                    )
                    embed.add_field(name="보상", value="10 토피", inline=True)
                    embed.add_field(name="현재 잔액", value=f"{new_balance:,} 토피", inline=True)
                    
                    await user.send(embed=embed)
            except:
                pass
    
    @app_commands.command(name="통화방관리", description="음성 채널 타입을 관리합니다")
    @app_commands.default_permissions(administrator=True)
    @app_commands.describe(
        타입="채널 타입",
        작업="추가/제거/목록",
        채널="대상 음성 채널"
    )
    @app_commands.choices(타입=[
        app_commands.Choice(name="일반통화방", value="normal_voice"),
        app_commands.Choice(name="음악감상방", value="music"),
        app_commands.Choice(name="일반잠수방", value="normal_afk"),
        app_commands.Choice(name="프리미엄잠수방", value="premium_afk")
    ])
    @app_commands.choices(작업=[
        app_commands.Choice(name="추가", value="add"),
        app_commands.Choice(name="제거", value="remove"),
        app_commands.Choice(name="목록", value="list")
    ])
    async def manage_voice_channels(self, interaction: discord.Interaction, 타입: str, 작업: str, 채널: discord.VoiceChannel = None):
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ 관리자만 사용할 수 있는 명령어입니다.", ephemeral=True)
            return
        
        if 작업 == "list":
            embed = discord.Embed(
                title=f"🎤 {타입} 채널 목록",
                color=0x0099ff,
                timestamp=datetime.now()
            )
            
            type_names = {
                'normal_voice': '일반통화방 (1분당 1토피, 핫타임 2토피)',
                'music': '음악감상방 (1분당 0.1토피)',
                'normal_afk': '일반잠수방 (1분당 0.1토피)',
                'premium_afk': '프리미엄잠수방 (1분당 1토피, 랜덤 추방)'
            }
            
            embed.description = type_names.get(타입, 타입)
            
            channels = self.channel_types.get(타입, [])
            if channels:
                channel_list = []
                for ch_id in channels:
                    ch = interaction.guild.get_channel(ch_id)
                    if ch:
                        channel_list.append(f"• {ch.mention} (ID: {ch_id})")
                
                embed.add_field(name="등록된 채널", value="\n".join(channel_list) if channel_list else "없음", inline=False)
            else:
                embed.add_field(name="등록된 채널", value="없음", inline=False)
            
            await interaction.response.send_message(embed=embed)
            return
        
        if not 채널:
            await interaction.response.send_message("❌ 채널을 선택해주세요.", ephemeral=True)
            return
        
        if 작업 == "add":
            if 채널.id not in self.channel_types[타입]:
                self.channel_types[타입].append(채널.id)
                
                embed = discord.Embed(
                    title="✅ 채널 추가 완료",
                    description=f"{채널.mention} 채널이 {타입}으로 등록되었습니다.",
                    color=0x00ff00,
                    timestamp=datetime.now()
                )
                await interaction.response.send_message(embed=embed)
            else:
                await interaction.response.send_message("❌ 이미 등록된 채널입니다.", ephemeral=True)
        
        elif 작업 == "remove":
            if 채널.id in self.channel_types[타입]:
                self.channel_types[타입].remove(채널.id)
                
                embed = discord.Embed(
                    title="✅ 채널 제거 완료",
                    description=f"{채널.mention} 채널이 {타입}에서 제거되었습니다.",
                    color=0xff0000,
                    timestamp=datetime.now()
                )
                await interaction.response.send_message(embed=embed)
            else:
                await interaction.response.send_message("❌ 등록되지 않은 채널입니다.", ephemeral=True)
    
    @app_commands.command(name="음성로그채널설정", description="음성 활동 로그를 보낼 채널을 설정합니다")
    @app_commands.default_permissions(administrator=True)
    @app_commands.describe(채널="로그를 보낼 채널")
    async def set_log_channel(self, interaction: discord.Interaction, 채널: discord.TextChannel):
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ 관리자만 사용할 수 있는 명령어입니다.", ephemeral=True)
            return
        
        self.log_channel_id = 채널.id
        
        embed = discord.Embed(
            title="✅ 로그 채널 설정 완료",
            description=f"음성 활동 로그가 {채널.mention} 채널로 전송됩니다.",
            color=0x00ff00,
            timestamp=datetime.now()
        )
        embed.set_footer(text=f"설정자: {interaction.user.display_name}")
        
        await interaction.response.send_message(embed=embed)
    
    @app_commands.command(name="음성상태확인", description="현재 추적 중인 음성 채널 상태를 확인합니다")
    @app_commands.default_permissions(administrator=True)
    async def check_voice_status(self, interaction: discord.Interaction):
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ 관리자만 사용할 수 있는 명령어입니다.", ephemeral=True)
            return
        
        embed = discord.Embed(
            title="🎤 음성 채널 추적 상태",
            color=0x0099ff,
            timestamp=datetime.now()
        )
        
        if not self.voice_tracking:
            embed.description = "현재 추적 중인 유저가 없습니다."
        else:
            current_time = datetime.now()
            status_text = []
            
            for user_id, data in self.voice_tracking.items():
                user = self.bot.get_user(user_id)
                channel = self.bot.get_channel(data['channel_id'])
                duration = (current_time - data['join_time']).total_seconds()
                
                if user and channel:
                    channel_type = self.get_channel_type(channel.id)
                    coin_rate = self.get_coin_rate(channel.id)
                    status_text.append(f"• {user.display_name}: {channel.name} ({self.format_duration(duration)}, {coin_rate}토피/분)")
            
            embed.description = "\n".join(status_text) if status_text else "추적 중인 유저 정보를 가져올 수 없습니다."
        
        embed.add_field(name="로그 채널", value=f"<#{self.log_channel_id}>" if self.log_channel_id else "설정되지 않음", inline=False)
        embed.add_field(name="핫타임", value=f"{'🔥 활성화' if self.is_hot_time() else '비활성화'} (19:00-22:00)", inline=False)
        
        await interaction.response.send_message(embed=embed, ephemeral=True)
    
    @app_commands.command(name="코인지급", description="유저에게 코인을 지급합니다[관리자용]")
    @app_commands.default_permissions(administrator=True)
    @app_commands.describe(
        유저="코인을 지급할 유저",
        금액="지급할 코인 금액",
        사유="지급 사유"
    )
    async def give_coin(self, interaction: discord.Interaction, 유저: discord.Member, 금액: int, 사유: str = None):
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ 관리자만 사용할 수 있는 명령어입니다.", ephemeral=True)
            return
        
        if 금액 <= 0:
            await interaction.response.send_message("❌ 지급할 금액은 1 이상이어야 합니다.", ephemeral=True)
            return
        
        new_balance = self.update_user_balance(
            유저.id, 
            유저.display_name, 
            금액, 
            interaction.user.id, 
            사유, 
            "admin_give"
        )
        
        embed = discord.Embed(
            title="💰 코인 지급 완료",
            color=0x00ff00,
            timestamp=datetime.now()
        )
        embed.add_field(name="대상", value=유저.mention, inline=True)
        embed.add_field(name="지급 금액", value=f"{금액:,} 코인", inline=True)
        embed.add_field(name="현재 잔액", value=f"{new_balance:,} 코인", inline=True)
        if 사유:
            embed.add_field(name="사유", value=사유, inline=False)
        embed.set_footer(text=f"관리자: {interaction.user.display_name}")
        
        await interaction.response.send_message(embed=embed)
    
    @app_commands.command(name="코인차감", description="유저의 코인을 차감합니다[관리자용]")
    @app_commands.default_permissions(administrator=True)
    @app_commands.describe(
        유저="코인을 차감할 유저",
        금액="차감할 코인 금액",
        사유="차감 사유"
    )
    async def deduct_coin(self, interaction: discord.Interaction, 유저: discord.Member, 금액: int, 사유: str = None):
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ 관리자만 사용할 수 있는 명령어입니다.", ephemeral=True)
            return
        
        if 금액 <= 0:
            await interaction.response.send_message("❌ 차감할 금액은 1 이상이어야 합니다.", ephemeral=True)
            return
        
        new_balance = self.update_user_balance(
            유저.id, 
            유저.display_name, 
            -금액, 
            interaction.user.id, 
            사유, 
            "admin_deduct"
        )
        
        embed = discord.Embed(
            title="💸 코인 차감 완료",
            color=0xff0000,
            timestamp=datetime.now()
        )
        embed.add_field(name="대상", value=유저.mention, inline=True)
        embed.add_field(name="차감 금액", value=f"{금액:,} 코인", inline=True)
        embed.add_field(name="현재 잔액", value=f"{new_balance:,} 코인", inline=True)
        if 사유:
            embed.add_field(name="사유", value=사유, inline=False)
        embed.set_footer(text=f"관리자: {interaction.user.display_name}")
        
        await interaction.response.send_message(embed=embed)
    
    @app_commands.command(name="잔액확인", description="코인 잔액을 확인합니다")
    @app_commands.describe(유저="잔액을 확인할 유저 (관리자만 다른 유저 확인 가능)")
    async def check_balance(self, interaction: discord.Interaction, 유저: discord.Member = None):
        if 유저 and 유저.id != interaction.user.id:
            if not interaction.user.guild_permissions.administrator:
                await interaction.response.send_message("❌ 관리자만 다른 유저의 잔액을 확인할 수 있습니다.", ephemeral=True)
                return
        
        target_user = 유저 if 유저 else interaction.user
        
        self.init_user_coin(target_user.id, target_user.display_name)
        
        balance = self.get_user_balance(target_user.id)
        
        embed = discord.Embed(
            title="💰 코인 잔액",
            color=0x0099ff,
            timestamp=datetime.now()
        )
        embed.add_field(name="유저", value=target_user.mention, inline=True)
        embed.add_field(name="잔액", value=f"{balance:,} 코인", inline=True)
        embed.set_thumbnail(url=target_user.display_avatar.url)
        
        if 유저 and 유저.id != interaction.user.id:
            embed.set_footer(text=f"조회자: {interaction.user.display_name} (관리자)")
        
        is_private = not (유저 and 유저.id != interaction.user.id)
        await interaction.response.send_message(embed=embed, ephemeral=is_private)
    
    @app_commands.command(name="출첵", description="일일 출석체크를 합니다 (10코인 지급)")
    async def daily_checkin(self, interaction: discord.Interaction):
        user_id = interaction.user.id
        username = interaction.user.display_name
        
        self.init_user_coin(user_id, username)
        
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        today = date.today().isoformat()
        cursor.execute('SELECT last_checkin FROM user_coins WHERE user_id = ?', (user_id,))
        result = cursor.fetchone()
        
        if result and result[0] == today:
            conn.close()
            embed = discord.Embed(
                title="❌ 출석체크 실패",
                description="오늘은 이미 출석체크를 완료했습니다!",
                color=0xff0000,
                timestamp=datetime.now()
            )
            await interaction.response.send_message(embed=embed, ephemeral=True)
            return
        
        cursor.execute('''
            UPDATE user_coins 
            SET last_checkin = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE user_id = ?
        ''', (today, user_id))
        
        conn.commit()
        conn.close()
        
        new_balance = self.update_user_balance(
            user_id, 
            username, 
            10, 
            reason="일일 출석체크",
            transaction_type="daily_checkin"
        )
        
        embed = discord.Embed(
            title="✅ 출석체크 완료!",
            description="일일 출석 보상을 받았습니다!",
            color=0x00ff00,
            timestamp=datetime.now()
        )
        embed.add_field(name="보상", value="10 코인", inline=True)
        embed.add_field(name="현재 잔액", value=f"{new_balance:,} 코인", inline=True)
        embed.set_thumbnail(url=interaction.user.display_avatar.url)
        embed.set_footer(text="매일 출석체크하고 코인을 받아보세요!")
        
        await interaction.response.send_message(embed=embed)
    
    @app_commands.command(name="일일랭킹", description="오늘의 음성 활동 랭킹을 확인합니다")
    async def daily_ranking(self, interaction: discord.Interaction):
        conn = self.get_db_connection()
        cursor = conn.cursor()
        today = date.today().isoformat()
        
        cursor.execute('''
            SELECT user_id, duration_minutes, coins_earned
            FROM daily_voice_ranking
            WHERE date = ?
            ORDER BY duration_minutes DESC
            LIMIT 10
        ''', (today,))
        
        results = cursor.fetchall()
        conn.close()
        
        embed = discord.Embed(
            title="🏆 오늘의 음성 활동 랭킹",
            description="23시 59분에 1위에게 10토피 추가 지급!",
            color=0xffd700,
            timestamp=datetime.now()
        )
        
        if not results:
            embed.add_field(name="랭킹", value="아직 기록이 없습니다.", inline=False)
        else:
            ranking_text = []
            medals = ["🥇", "🥈", "🥉"]
            
            for idx, (user_id, duration, coins) in enumerate(results, 1):
                user = self.bot.get_user(user_id)
                if user:
                    medal = medals[idx-1] if idx <= 3 else f"{idx}위"
                    ranking_text.append(f"{medal} **{user.display_name}** - {duration}분 ({coins:.1f} 토피)")
            
            embed.add_field(name="랭킹", value="\n".join(ranking_text), inline=False)
        
        await interaction.response.send_message(embed=embed)
    
    @app_commands.command(name="일일퀘스트", description="일일 퀘스트 현황을 확인합니다")
    async def daily_quest_status(self, interaction: discord.Interaction):
        user_id = interaction.user.id
        today = date.today().isoformat()
        
        embed = discord.Embed(
            title="📋 일일 퀘스트",
            description="매일 자정에 초기화됩니다",
            color=0x00aaff,
            timestamp=datetime.now()
        )
        
        # 음성 채널 퀘스트
        voice_key = f"{today}_voice"
        voice_completed = user_id in self.daily_quest_completed and voice_key in self.daily_quest_completed[user_id]
        voice_status = "✅ 완료" if voice_completed else "⏳ 진행중"
        
        embed.add_field(
            name=f"{voice_status} 통화방 1시간 이상 활동",
            value="**보상:** 10 토피",
            inline=False
        )
        
        # 채팅 XP 퀘스트 (레벨 시스템과 연동 필요)
        embed.add_field(
            name="⏳ 채팅 XP 300 이상 획득",
            value="**보상:** 60 토피\n*레벨 시스템 연동 필요*",
            inline=False
        )
        
        embed.set_footer(text=f"{interaction.user.display_name}의 퀘스트 현황")
        
        await interaction.response.send_message(embed=embed, ephemeral=True)
    
    @app_commands.command(name="이벤트시작", description="랜덤 이벤트를 즉시 시작합니다 (관리자 전용)")
    @app_commands.default_permissions(administrator=True)
    async def start_event_manual(self, interaction: discord.Interaction):
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ 관리자만 사용할 수 있는 명령어입니다.", ephemeral=True)
            return
        
        if self.current_event:
            await interaction.response.send_message("❌ 이미 진행 중인 이벤트가 있습니다.", ephemeral=True)
            return
        
        await interaction.response.send_message("✅ 이벤트를 시작합니다!", ephemeral=True)
        await self.start_random_event()

async def setup(bot):
    await bot.add_cog(CoinSystem(bot))