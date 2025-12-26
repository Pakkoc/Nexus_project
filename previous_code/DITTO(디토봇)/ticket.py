import discord
from discord.ext import commands
from discord import app_commands
import yaml
import datetime
import io
import config

class TicketModal(discord.ui.Modal):
    def __init__(self, ticket_type, ticket_cog):
        super().__init__(title=f"{ticket_type} 문의")
        self.ticket_type = ticket_type
        self.ticket_cog = ticket_cog
        
        if ticket_type == "일반문의":
            self.add_item(discord.ui.TextInput(
                label="문의 내용(요약)",
                placeholder="문의 내용을 간단히 요약해주세요",
                max_length=100,
                style=discord.TextStyle.short
            ))
            self.add_item(discord.ui.TextInput(
                label="상세 내용",
                placeholder="문의하실 내용을 자세히 작성해주세요",
                max_length=1000,
                style=discord.TextStyle.long
            ))
        elif ticket_type == "신고문의":
            self.add_item(discord.ui.TextInput(
                label="신고 내용",
                placeholder="신고하실 내용을 자세히 작성해주세요",
                max_length=1000,
                style=discord.TextStyle.long
            ))
        elif ticket_type == "항소문의":
            self.add_item(discord.ui.TextInput(
                label="항소 하고자 하는 처벌 링크",
                placeholder="처벌과 관련된 메시지 링크를 입력해주세요",
                max_length=200,
                style=discord.TextStyle.short
            ))
            self.add_item(discord.ui.TextInput(
                label="항소 사유",
                placeholder="항소하시는 사유를 자세히 작성해주세요",
                max_length=1000,
                style=discord.TextStyle.long
            ))

    async def on_submit(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True)
        
        # 티켓 채널 생성
        ticket_data = {}
        for i, item in enumerate(self.children):
            ticket_data[item.label] = item.value
            
        await self.ticket_cog.create_ticket(interaction, self.ticket_type, ticket_data)

class TicketView(discord.ui.View):
    def __init__(self, ticket_cog):
        super().__init__(timeout=None)
        self.ticket_cog = ticket_cog

    @discord.ui.button(label="일반문의", style=discord.ButtonStyle.primary, emoji="📝")
    async def general_inquiry(self, interaction: discord.Interaction, button: discord.ui.Button):
        modal = TicketModal("일반문의", self.ticket_cog)
        await interaction.response.send_modal(modal)

    @discord.ui.button(label="신고문의", style=discord.ButtonStyle.danger, emoji="🚨")
    async def report_inquiry(self, interaction: discord.Interaction, button: discord.ui.Button):
        modal = TicketModal("신고문의", self.ticket_cog)
        await interaction.response.send_modal(modal)

    @discord.ui.button(label="항소문의", style=discord.ButtonStyle.secondary, emoji="⚖️")
    async def appeal_inquiry(self, interaction: discord.Interaction, button: discord.ui.Button):
        modal = TicketModal("항소문의", self.ticket_cog)
        await interaction.response.send_modal(modal)

class TicketControlView(discord.ui.View):
    def __init__(self, ticket_type):
        super().__init__(timeout=None)
        self.ticket_type = ticket_type

    @discord.ui.button(label="티켓 닫기", style=discord.ButtonStyle.secondary, emoji="🔒")
    async def close_ticket(self, interaction: discord.Interaction, button: discord.ui.Button):
        # 해당 티켓 유형의 담당자 역할 확인
        category_map = {
            "일반문의": "general",
            "신고문의": "report", 
            "항소문의": "appeal"
        }
        
        handler_role_id = config.TICKET_CATEGORIES[category_map[self.ticket_type]]["handler_role_id"]
        
        if not any(role.id == handler_role_id for role in interaction.user.roles):
            await interaction.response.send_message("❌ 이 티켓의 담당자만 티켓을 닫을 수 있습니다.", ephemeral=True)
            return
            
        embed = discord.Embed(
            title="🔒 티켓이 닫혔습니다",
            description="이 티켓은 담당자에 의해 닫혔습니다.\n티켓을 삭제하려면 '티켓 삭제' 버튼을 클릭하세요.",
            color=0xff9900,
            timestamp=datetime.datetime.now()
        )
        
        # 권한 업데이트 - 문의자의 메시지 보내기 권한 제거
        overwrites = interaction.channel.overwrites
        for target, permissions in overwrites.items():
            if isinstance(target, discord.Member) and target.id != interaction.guild.me.id:
                permissions.send_messages = False
                await interaction.channel.set_permissions(target, overwrite=permissions)
        
        await interaction.response.send_message(embed=embed)

    @discord.ui.button(label="티켓 삭제", style=discord.ButtonStyle.danger, emoji="🗑️")
    async def delete_ticket(self, interaction: discord.Interaction, button: discord.ui.Button):
        # 해당 티켓 유형의 담당자 역할 확인
        category_map = {
            "일반문의": "general",
            "신고문의": "report", 
            "항소문의": "appeal"
        }
        
        handler_role_id = config.TICKET_CATEGORIES[category_map[self.ticket_type]]["handler_role_id"]
        
        if not any(role.id == handler_role_id for role in interaction.user.roles):
            await interaction.response.send_message("❌ 이 티켓의 담당자만 티켓을 삭제할 수 있습니다.", ephemeral=True)
            return
            
        # 티켓 로그 생성
        await self.create_ticket_log(interaction.channel)
        
        await interaction.response.send_message("🗑️ 3초 후 티켓이 삭제됩니다...")
        await discord.utils.sleep_until(datetime.datetime.now() + datetime.timedelta(seconds=3))
        await interaction.channel.delete()

    async def create_ticket_log(self, channel):
        messages = []
        async for message in channel.history(limit=None, oldest_first=True):
            if not message.author.bot or message.embeds:
                msg_data = {
                    'author': str(message.author),
                    'author_id': message.author.id,
                    'content': message.content,
                    'timestamp': message.created_at.isoformat(),
                    'embeds': [embed.to_dict() for embed in message.embeds] if message.embeds else []
                }
                messages.append(msg_data)
        
        log_data = {
            'channel_name': channel.name,
            'created_at': channel.created_at.isoformat(),
            'deleted_at': datetime.datetime.now().isoformat(),
            'messages': messages
        }
        
        # YAML 파일로 저장
        yaml_content = yaml.dump(log_data, allow_unicode=True, default_flow_style=False)
        
        # 로그 채널에 파일 전송
        log_channel = channel.guild.get_channel(config.TICKET_LOG_CHANNEL_ID)
        if log_channel:
            file = discord.File(
                io.StringIO(yaml_content),
                filename=f"ticket-log-{channel.name}-{datetime.datetime.now().strftime('%Y%m%d-%H%M%S')}.yml"
            )
            
            embed = discord.Embed(
                title="📋 티켓 로그",
                description=f"티켓 채널: {channel.name}\n삭제 시간: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
                color=0x00ff00
            )
            
            await log_channel.send(embed=embed, file=file)

class TicketCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @app_commands.command(name="티켓채널", description="티켓 시스템을 설정합니다.")
    @app_commands.default_permissions(administrator=True)
    async def setup_ticket(self, interaction: discord.Interaction):
        embed = discord.Embed(
            title="DiscordㅣTopia Ticket",
            description="""토피아 서버의 티켓시스템입니다.!
각종 문의를 할 수 있는 장소로써, 많은 이용 부탁드리겠습니다.
```
항시 익명성을 중요시 하고 있습니다.
문의에 불필요한 요소는 작성하지 않으셔도 됩니다.
오류 발생의 경우 관리자에게 제보 해주세요.
신고, 항소의 경우 모든 판단은 운영진에게 있습니다.
운영진의 DM 으로 오는 문의는 받아드려지지 않습니다.
```
> 운영진에게 비방,욕설 및 독촉은 제재를 받을 수 있습니다.

**각종 일반 문의** → 일반문의
**신고관련 문의** → 신고문의  
**기타 처벌에 대한 이의제기 문의** → 항소문의""",
            color=0x00ff88
        )
        
        view = TicketView(self)
        await interaction.response.send_message(embed=embed, view=view)

    async def create_ticket(self, interaction, ticket_type, ticket_data):
        guild = interaction.guild
        user = interaction.user
        
        # 카테고리 결정
        category_map = {
            "일반문의": "general",
            "신고문의": "report", 
            "항소문의": "appeal"
        }
        
        ticket_config = config.TICKET_CATEGORIES.get(category_map[ticket_type])
        category_id = ticket_config["category_id"]
        handler_role_id = ticket_config["handler_role_id"]
        
        category = guild.get_channel(category_id) if category_id else None
        
        # 티켓 채널 이름 생성
        ticket_number = len([ch for ch in guild.channels if ch.name.startswith("ticket-")]) + 1
        channel_name = f"ticket-{ticket_number:04d}"
        
        # 권한 설정
        overwrites = {
            guild.default_role: discord.PermissionOverwrite(view_channel=False),
            user: discord.PermissionOverwrite(
                view_channel=True,
                send_messages=True,
                read_message_history=True
            ),
            guild.me: discord.PermissionOverwrite(
                view_channel=True,
                send_messages=True,
                manage_messages=True,
                read_message_history=True
            )
        }
        
        # 해당 티켓 유형의 담당자 역할 권한 추가
        handler_role = guild.get_role(handler_role_id)
        if handler_role:
            overwrites[handler_role] = discord.PermissionOverwrite(
                view_channel=True,
                send_messages=True,
                manage_messages=True,
                read_message_history=True
            )
        
        # 티켓 채널 생성
        ticket_channel = await guild.create_text_channel(
            name=channel_name,
            category=category,
            overwrites=overwrites,
            topic=f"{ticket_type} - {user.display_name}"
        )
        
        # 티켓 정보 임베드 생성
        embed = discord.Embed(
            title=f"🎫 {ticket_type} 티켓",
            color=0x00ff88,
            timestamp=datetime.datetime.now()
        )
        embed.add_field(name="문의자", value=user.mention, inline=True)
        embed.add_field(name="티켓 번호", value=ticket_number, inline=True)
        embed.add_field(name="생성 시간", value=datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"), inline=True)
        
        # 티켓 데이터 표시
        for label, value in ticket_data.items():
            embed.add_field(name=label, value=value, inline=False)
        
        embed.set_footer(text="DiscordㅣTopia Ticket System")
        
        # 해당 티켓 유형의 담당자 멘션 및 메시지 전송
        mention_text = ""
        if handler_role:
            mention_text = f"{handler_role.mention} "
        
        control_view = TicketControlView(ticket_type)
        await ticket_channel.send(
            content=f"{mention_text}{user.mention}",
            embed=embed,
            view=control_view
        )
        
        await interaction.followup.send(
            f"✅ 티켓이 생성되었습니다: {ticket_channel.mention}",
            ephemeral=True
        )

    @commands.Cog.listener()
    async def on_message(self, message):
        # 봇 메시지 무시
        if message.author.bot:
            return
            
        # 티켓 채널이 아닌 경우 무시
        if not message.channel.name.startswith("ticket-"):
            return
        
        # 채널 토픽에서 티켓 유형 확인
        if not message.channel.topic:
            return
            
        ticket_type = message.channel.topic.split(" - ")[0]
        
        # 카테고리 매핑
        category_map = {
            "일반문의": "general",
            "신고문의": "report", 
            "항소문의": "appeal"
        }
        
        # 해당 티켓 유형의 담당자 역할 확인
        if ticket_type in category_map:
            handler_role_id = config.TICKET_CATEGORIES[category_map[ticket_type]]["handler_role_id"]
            
            # 담당자 역할을 가진 사용자의 메시지 처리
            if any(role.id == handler_role_id for role in message.author.roles):
                # 원본 메시지 삭제
                await message.delete()
                
                # 봇이 임베드로 답변
                embed = discord.Embed(
                    title="📞 문의 응답 시스템",
                    description=message.content,
                    color=0x0099ff,
                    timestamp=datetime.datetime.now()
                )
                embed.set_footer(text=f"{ticket_type} 담당자 답변")
                
                await message.channel.send(embed=embed)

async def setup(bot):
    await bot.add_cog(TicketCog(bot))