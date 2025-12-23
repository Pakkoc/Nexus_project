import discord
from discord.ext import commands
from discord import app_commands
import json
import os
from typing import Optional

class WelcomeSystem(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.config_file = "welcome_config.json"
        self.config = self.load_config()
        
        # 미인증 역할 이름
        self.UNVERIFIED_ROLE_NAME = "˚₊·✉️⸝⸝ 미인증 ₊⊹"
        
        # 자동 지급 역할 이름들
        self.AUTO_ROLE_NAMES = ["˚₊·🌱 ⸝⸝  뉴비 ₊⊹", "˚₊·🍀 ⸝⸝  유저 ₊⊹"]
        
        # 1번: 서버 입장 시 환영 채널에 보낼 임베드
        self.WELCOME_EMBED = {
            "title": "",
            "description": """
- <a:A_SMJ_074:1428483713318256691> ┊ <#1428098765604257803>
-# ╰ 규칙을 읽지 않아 생기는 불이익은 부담하지 않습니다 ͙ᐟ

- <a:A_SMJ_084:1428483734335914044>┊ <#1428098826769530980>
-# ╰  위 내용을 읽으셨다면 이모지를 눌러주세요 ͙ᐟ

- <a:A_SMJ_024:1428473991114260490>┊ <#1433194534682234941> 
-# ╰  닉네임 / 나이 (년생) / 성별 / 경로 순으로 작성해주세요 ͙ᐟ

- <a:A_SMJ_044:1428474053533892658>┊ <@&1428113713361064129>
-# ╰  입장이 늦어지면 자기소개 에서 관리자를 불러주세요 ͙ᐟ
""",
            "color": 0x000000
        }
        
        # 2번: /입장 명령어 실행 시 입장 채널에 보낼 임베드
        self.ENTRANCE_CHANNEL_EMBED = {
            "description": """**- <a:A_SMJ_094:1428483772973846683> {member_mention}꒰ 토피아 제국 ꒱ 에 오신 걸 환영합니다  ₊˚⊹**
- <a:A_SMJ_074:1428483713318256691>   ︴<#1428099089786212504> 
-# ╰ 규칙을 꼭 읽고 활동해 주시길 바랍니다  ͙ᐟ

- <a:A_SMJ_084:1428483734335914044>   ︴ <#1433195017010282506>
-# ╰ 서버 내 __**다양한 공지**__를 바로 확인하실 수 있습니다  ͙ᐟ
s
- <a:A_SMJ_024:1428473991114260490>   ︴<#1428099866046894221> 
-# ╰  __**관리진**__을 모집중이니 많은 관심 부탁드립니다  ͙ᐟ

- <a:A_SMJ_004:1429699420148076728>   ︴__**<@&1428113713361064129>**__
-# ╰ 적응이 필요하시면 불러주세요  ͙ᐟ
""",
            "color": 0x000000
        }
        
        # 3번: /입장 명령어 실행 시 유저에게 DM으로 보낼 메시지 (임베드)
        self.ENTRANCE_DM_EMBED = {
            "description": """
• <a:A_SMJ_081:1428483746377629840> ┊ <#1432760322019692574>
-# ╰  도움이 필요한 작은 일은 이곳을 이용해주세요 ͙ᐟ

• <a:A_SMJ_081:1428483746377629840> ┊ <#1428099608214769724>
-# ╰  서버 이용 시 필요한 역할은 이곳에서 받아주세요 ͙ᐟ

• <a:A_SMJ_121:1428483802774114494> ┊ <#1428119346751733760>
-# ╰  서버 이용 시 궁금한 점을 쉽게 해결 가능합니다 ͙ᐟ

• <a:A_SMJ_021:1428473994356719887> ┊<#1429399421539582033>
-# ╰  서버 화폐 이용 시 이곳을 참고해 주세요 ͙ᐟ
""",
            "color": 0x000000
        }

    def load_config(self):
        """설정 파일 로드"""
        if os.path.exists(self.config_file):
            with open(self.config_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {
            "welcome_channel_id": None,
            "entrance_channel_id": None,
            "admin_roles": [],
            "auto_roles": [],
            "auto_pin_channels": {}
        }

    def save_config(self):
        """설정 파일 저장"""
        with open(self.config_file, 'w', encoding='utf-8') as f:
            json.dump(self.config, indent=4, ensure_ascii=False, fp=f)

    def _check_admin_role(self, interaction: discord.Interaction) -> bool:
        """관리 역할 체크 (내부 사용)"""
        if not self.config["admin_roles"]:
            return False
        
        user_role_ids = [role.id for role in interaction.user.roles]
        return any(role_id in self.config["admin_roles"] for role_id in user_role_ids)

    # =====================================================
    # 역할 관리
    # =====================================================
    @app_commands.command(name="환영역할추가", description="환영 시스템 관리 역할 추가 (서버 관리자만)")
    @app_commands.describe(역할="추가할 관리 역할")
    @app_commands.default_permissions(administrator=True)
    async def add_admin_role(self, interaction: discord.Interaction, 역할: discord.Role):
        if 역할.id in self.config["admin_roles"]:
            await interaction.response.send_message(f"❌ {역할.mention}은(는) 이미 관리 역할입니다.", ephemeral=True)
            return
        
        self.config["admin_roles"].append(역할.id)
        self.save_config()
        await interaction.response.send_message(f"✅ {역할.mention}이(가) 관리 역할로 추가되었습니다!")

    @app_commands.command(name="환영역할제거", description="환영 시스템 관리 역할 제거 (서버 관리자만)")
    @app_commands.describe(역할="제거할 관리 역할")
    @app_commands.default_permissions(administrator=True)
    async def remove_admin_role(self, interaction: discord.Interaction, 역할: discord.Role):
        if 역할.id not in self.config["admin_roles"]:
            await interaction.response.send_message(f"❌ {역할.mention}은(는) 관리 역할이 아닙니다.", ephemeral=True)
            return
        
        self.config["admin_roles"].remove(역할.id)
        self.save_config()
        await interaction.response.send_message(f"✅ {역할.mention}이(가) 관리 역할에서 제거되었습니다!")

    @app_commands.command(name="환영자동역할추가", description="/입장 시 자동으로 지급될 역할 추가")
    @app_commands.describe(역할="자동 지급할 역할")
    async def add_auto_role(self, interaction: discord.Interaction, 역할: discord.Role):
        # 권한 체크
        if not self._check_admin_role(interaction):
            await interaction.response.send_message("❌ 이 명령어를 사용할 권한이 없습니다.", ephemeral=True)
            return
        
        if 역할.id in self.config["auto_roles"]:
            await interaction.response.send_message(f"❌ {역할.mention}은(는) 이미 자동 지급 역할입니다.", ephemeral=True)
            return
        
        self.config["auto_roles"].append(역할.id)
        self.save_config()
        await interaction.response.send_message(f"✅ {역할.mention}이(가) 자동 지급 역할로 추가되었습니다!")

    # =====================================================
    # 채널 설정
    # =====================================================
    @app_commands.command(name="환영채널설정", description="서버 입장 시 자동 환영 메시지를 보낼 채널 설정")
    @app_commands.describe(채널="자동 환영 메시지를 보낼 채널")
    async def set_welcome_channel(self, interaction: discord.Interaction, 채널: discord.TextChannel):
        # 권한 체크
        if not self._check_admin_role(interaction):
            await interaction.response.send_message("❌ 이 명령어를 사용할 권한이 없습니다.", ephemeral=True)
            return
        
        self.config["welcome_channel_id"] = 채널.id
        self.save_config()
        await interaction.response.send_message(f"✅ {채널.mention}이(가) 환영 채널로 설정되었습니다!")

    @app_commands.command(name="입장채널설정", description="/입장 명령어 사용 시 메시지를 보낼 채널 설정")
    @app_commands.describe(채널="/입장 명령어로 메시지를 보낼 채널")
    async def set_entrance_channel(self, interaction: discord.Interaction, 채널: discord.TextChannel):
        # 권한 체크
        if not self._check_admin_role(interaction):
            await interaction.response.send_message("❌ 이 명령어를 사용할 권한이 없습니다.", ephemeral=True)
            return
        
        self.config["entrance_channel_id"] = 채널.id
        self.save_config()
        await interaction.response.send_message(f"✅ {채널.mention}이(가) 입장 처리 채널로 설정되었습니다!")

    # =====================================================
    # 서버 입장 이벤트
    # =====================================================
    @commands.Cog.listener()
    async def on_member_join(self, member):
        """새로운 멤버가 서버에 입장할 때"""
        if self.config["welcome_channel_id"]:
            channel = self.bot.get_channel(self.config["welcome_channel_id"])
            if channel:
                # 유저 태그 메시지와 임베드를 한 번에 전송
                embed = discord.Embed(
                    title=self.WELCOME_EMBED["title"].format(member_mention=member.mention),
                    description=self.WELCOME_EMBED["description"],
                    color=self.WELCOME_EMBED["color"]
                )
                embed.set_thumbnail(url=member.avatar.url if member.avatar else member.default_avatar.url)
                
                await channel.send(content=f"{member.mention}", embed=embed)

    # =====================================================
    # /입장 명령어
    # =====================================================
    @app_commands.command(name="입장", description="유저에게 역할 지급 및 환영 메시지 전송")
    @app_commands.describe(
        유저="역할을 지급할 유저",
        이름="유저의 이름 (닉네임으로 설정됨)",
        연령역할="지급할 연령 역할",
        성별역할="지급할 성별 역할"
    )
    async def entrance_command(
        self,
        interaction: discord.Interaction,
        유저: discord.Member,
        이름: str,
        연령역할: discord.Role,
        성별역할: discord.Role
    ):
        # 권한 체크
        if not self._check_admin_role(interaction):
            await interaction.response.send_message("❌ 이 명령어를 사용할 권한이 없습니다.", ephemeral=True)
            return
        
        try:
            # 입장 처리 채널 확인
            if not self.config["entrance_channel_id"]:
                await interaction.response.send_message(
                    "❌ 입장 처리 채널이 설정되지 않았습니다.\n`/입장채널설정` 명령어로 채널을 먼저 설정해주세요.",
                    ephemeral=True
                )
                return
            
            entrance_channel = self.bot.get_channel(self.config["entrance_channel_id"])
            if not entrance_channel:
                await interaction.response.send_message("❌ 설정된 입장 채널을 찾을 수 없습니다.", ephemeral=True)
                return
            
            # 닉네임 변경
            new_nickname = f"「🌱」 {이름}"
            try:
                await 유저.edit(nick=new_nickname)
                nickname_status = f"✅ 닉네임 변경: {new_nickname}"
            except discord.Forbidden:
                nickname_status = "⚠️ 닉네임 변경 실패 (권한 부족)"
            
            # 자동 역할 지급
            roles_to_add = []
            
            # 코드에 직접 지정된 역할들 추가
            for role_name in self.AUTO_ROLE_NAMES:
                role = discord.utils.get(interaction.guild.roles, name=role_name)
                if role:
                    roles_to_add.append(role)
            
            # config에 저장된 역할들도 추가
            for role_id in self.config["auto_roles"]:
                role = interaction.guild.get_role(role_id)
                if role:
                    roles_to_add.append(role)
            
            # 연령 역할 추가
            roles_to_add.append(연령역할)
            
            # 성별 역할 추가
            roles_to_add.append(성별역할)
            
            # 미인증 역할 제거
            unverified_role = discord.utils.get(interaction.guild.roles, name=self.UNVERIFIED_ROLE_NAME)
            if unverified_role and unverified_role in 유저.roles:
                await 유저.remove_roles(unverified_role)
            
            # 역할 지급
            if roles_to_add:
                await 유저.add_roles(*roles_to_add)
            
            # 2번: 입장 채널에 유저 태그 + @here + 임베드를 한 번에 전송
            embed = discord.Embed(
                description=self.ENTRANCE_CHANNEL_EMBED["description"].format(member_mention=유저.mention),
                color=self.ENTRANCE_CHANNEL_EMBED["color"]
            )
            await entrance_channel.send(content=f"{유저.mention} @here", embed=embed)
            
            # 3번: 유저에게 DM 전송 (임베드 + 멘션)
            try:
                # 임베드 생성
                dm_embed = discord.Embed(
                    description=self.ENTRANCE_DM_EMBED["description"],
                    color=self.ENTRANCE_DM_EMBED["color"]
                )
                
                # 멘션 텍스트
                dm_content = f"""{유저.mention} 님 **" 토피아 제국 "** 입장을 환영합니다 ͙ᐟ
-# ╰  서버에서 활동을 위한 **안내 가이드** 보내드립니다"""
                
                await 유저.send(content=dm_content, embed=dm_embed)
                dm_status = "✅ DM 전송 완료"
            except discord.Forbidden:
                dm_status = "⚠️ DM 전송 실패 (DM 수신 거부)"
            
            # 지급된 역할 목록
            roles_text = ", ".join([role.mention for role in roles_to_add])
            
            # 결과 메시지
            result_message = f"""✅ **입장 처리 완료**

**대상 유저:** {유저.mention}
**닉네임:** {nickname_status}
**지급된 역할:** {roles_text}
**DM 상태:** {dm_status}"""
            
            if unverified_role and unverified_role in 유저.roles:
                result_message += f"\n**제거된 역할:** ~~{unverified_role.mention}~~"
            
            await interaction.response.send_message(result_message, ephemeral=True)
            
        except discord.Forbidden:
            await interaction.response.send_message("❌ 봇에게 역할 관리 권한이 없습니다.", ephemeral=True)
        except Exception as e:
            await interaction.response.send_message(f"❌ 오류 발생: {str(e)}", ephemeral=True)

    # =====================================================
    # 도움말
    # =====================================================
    @app_commands.command(name="환영도움말", description="환영 시스템 명령어 가이드")
    async def help_command(self, interaction: discord.Interaction):
        embed = discord.Embed(
            title="🤖 환영 시스템 명령어 가이드",
            color=0x9b59b6
        )
        
        embed.add_field(
            name="🔑 역할 관리 (서버 관리자만)",
            value=(
                "`/환영역할추가` - 시스템 관리 역할 추가\n"
                "`/환영역할제거` - 시스템 관리 역할 제거\n"
                "`/환영자동역할추가` - 자동 지급 역할 추가"
            ),
            inline=False
        )
        
        embed.add_field(
            name="👋 입장 시스템",
            value=(
                "`/환영채널설정` - 서버 입장 시 환영 채널 설정\n"
                "`/입장채널설정` - /입장 처리 채널 설정\n"
                "`/입장 @유저 이름 @연령역할 @성별역할` - 역할 지급 및 환영"
            ),
            inline=False
        )
        
        embed.add_field(
            name="🧹 청소 기능",
            value=(
                "`/청소` - 메시지 삭제\n"
                "`/사용자청소` - 특정 유저 메시지 삭제\n"
                "`/봇청소` - 봇 메시지 삭제\n"
                "`/키워드청소` - 키워드 포함 메시지 삭제\n"
                "`/청소도움말` - 청소 기능 상세 안내"
            ),
            inline=False
        )
        
        await interaction.response.send_message(embed=embed)

    

async def setup(bot):
    await bot.add_cog(WelcomeSystem(bot))
