import discord
from discord.ext import commands
from discord import app_commands
import json
import os
from typing import Optional

class AutoPinSystem(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.config_file = "autopin_config.json"
        self.config = self.load_config()
        self.waiting_for_message = {}  # {user_id: channel_id}

    def load_config(self):
        """설정 파일 로드"""
        if os.path.exists(self.config_file):
            with open(self.config_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {
            "admin_roles": [],
            "auto_pin_channels": {}
        }

    def save_config(self):
        """설정 파일 저장"""
        with open(self.config_file, 'w', encoding='utf-8') as f:
            json.dump(self.config, indent=4, ensure_ascii=False, fp=f)

    def has_admin_role(self):
        """관리 역할 체크 데코레이터"""
        async def predicate(interaction: discord.Interaction):
            if not self.config["admin_roles"]:
                await interaction.response.send_message("❌ 설정된 관리 역할이 없습니다.", ephemeral=True)
                return False
            
            user_role_ids = [role.id for role in interaction.user.roles]
            has_permission = any(role_id in self.config["admin_roles"] for role_id in user_role_ids)
            
            if not has_permission:
                await interaction.response.send_message("❌ 이 명령어를 사용할 권한이 없습니다.", ephemeral=True)
            
            return has_permission
        
        return app_commands.check(predicate)

    # =====================================================
    # 역할 관리
    # =====================================================
    @app_commands.command(name="고정역할추가", description="자동 고정 시스템 관리 역할 추가 (서버 관리자만)")
    @app_commands.describe(역할="추가할 관리 역할")
    @app_commands.default_permissions(administrator=True)
    async def add_admin_role(self, interaction: discord.Interaction, 역할: discord.Role):
        if 역할.id in self.config["admin_roles"]:
            await interaction.response.send_message(f"❌ {역할.mention}은(는) 이미 관리 역할입니다.", ephemeral=True)
            return
        
        self.config["admin_roles"].append(역할.id)
        self.save_config()
        await interaction.response.send_message(f"✅ {역할.mention}이(가) 자동 고정 관리 역할로 추가되었습니다!")

    @app_commands.command(name="고정역할제거", description="자동 고정 시스템 관리 역할 제거 (서버 관리자만)")
    @app_commands.describe(역할="제거할 관리 역할")
    @app_commands.default_permissions(administrator=True)
    async def remove_admin_role(self, interaction: discord.Interaction, 역할: discord.Role):
        if 역할.id not in self.config["admin_roles"]:
            await interaction.response.send_message(f"❌ {역할.mention}은(는) 관리 역할이 아닙니다.", ephemeral=True)
            return
        
        self.config["admin_roles"].remove(역할.id)
        self.save_config()
        await interaction.response.send_message(f"✅ {역할.mention}이(가) 자동 고정 관리 역할에서 제거되었습니다!")

    # =====================================================
    # 자동 고정 시스템
    # =====================================================
    @commands.Cog.listener()
    async def on_message(self, message):
        """메시지가 전송될 때마다 실행"""
        # 봇 메시지는 무시
        if message.author.bot:
            return
        
        # 사용자가 메시지 입력 대기 중인지 확인
        if message.author.id in self.waiting_for_message:
            target_channel_id = self.waiting_for_message[message.author.id]
            
            # 대기 상태 제거
            del self.waiting_for_message[message.author.id]
            
            # 고정 메시지 설정
            self.config["auto_pin_channels"][str(target_channel_id)] = {
                "message": message.content,
                "last_bot_message_id": None
            }
            self.save_config()
            
            # 확인 메시지 전송
            target_channel = self.bot.get_channel(target_channel_id)
            await message.channel.send(f"✅ {target_channel.mention}에 자동 고정 메시지가 설정되었습니다!\n**메시지 내용:**\n```{message.content}```")
            
            # 원본 메시지 삭제 (선택사항)
            try:
                await message.delete()
            except:
                pass
            
            return
        
        channel_id = str(message.channel.id)
        
        # 자동 고정이 설정된 채널인지 확인
        if channel_id in self.config["auto_pin_channels"]:
            pin_config = self.config["auto_pin_channels"][channel_id]
            
            # 이전 봇 메시지 삭제
            if pin_config.get("last_bot_message_id"):
                try:
                    old_message = await message.channel.fetch_message(pin_config["last_bot_message_id"])
                    await old_message.delete()
                except:
                    pass
            
            # 새 메시지 전송
            bot_message = await message.channel.send(pin_config["message"])
            
            # 설정 업데이트
            self.config["auto_pin_channels"][channel_id]["last_bot_message_id"] = bot_message.id
            self.save_config()

    @app_commands.command(name="고정설정", description="채널에 자동 고정 메시지 설정")
    @app_commands.describe(
        채널="자동 고정을 설정할 채널",
        설정채널="고정할 메시지를 입력받을 채널 (선택사항, 기본값: 현재 채널)"
    )
    async def set_auto_pin(self, interaction: discord.Interaction, 채널: discord.TextChannel, 설정채널: Optional[discord.TextChannel] = None):
        # 권한 체크
        if not self.config["admin_roles"]:
            await interaction.response.send_message("❌ 설정된 관리 역할이 없습니다.", ephemeral=True)
            return
        
        user_role_ids = [role.id for role in interaction.user.roles]
        if not any(role_id in self.config["admin_roles"] for role_id in user_role_ids):
            await interaction.response.send_message("❌ 이 명령어를 사용할 권한이 없습니다.", ephemeral=True)
            return
        
        # 설정 채널이 지정되지 않으면 현재 채널 사용
        if 설정채널 is None:
            설정채널 = interaction.channel
        
        # 사용자를 대기 목록에 추가
        self.waiting_for_message[interaction.user.id] = 채널.id
        
        # 안내 메시지 전송
        await interaction.response.send_message(
            f"📌 {설정채널.mention}에 **{채널.mention}**에 고정할 메시지를 입력해주세요!\n"
            f"⏱️ 입력한 메시지가 자동으로 고정 메시지로 설정됩니다.",
            ephemeral=True
        )
        
        # 설정 채널에도 안내 메시지 전송
        if 설정채널.id != interaction.channel.id:
            await 설정채널.send(
                f"📌 {interaction.user.mention}님, **{채널.mention}**에 고정할 메시지를 여기에 입력해주세요!"
            )

    @app_commands.command(name="고정해제", description="채널의 자동 고정 해제")
    @app_commands.describe(채널="자동 고정을 해제할 채널")
    async def remove_auto_pin(self, interaction: discord.Interaction, 채널: discord.TextChannel):
        # 권한 체크
        if not self.config["admin_roles"]:
            await interaction.response.send_message("❌ 설정된 관리 역할이 없습니다.", ephemeral=True)
            return
        
        user_role_ids = [role.id for role in interaction.user.roles]
        if not any(role_id in self.config["admin_roles"] for role_id in user_role_ids):
            await interaction.response.send_message("❌ 이 명령어를 사용할 권한이 없습니다.", ephemeral=True)
            return
        
        channel_id = str(채널.id)
        
        if channel_id in self.config["auto_pin_channels"]:
            # 마지막 고정 메시지 삭제 (선택사항)
            pin_config = self.config["auto_pin_channels"][channel_id]
            if pin_config.get("last_bot_message_id"):
                try:
                    old_message = await 채널.fetch_message(pin_config["last_bot_message_id"])
                    await old_message.delete()
                except:
                    pass
            
            del self.config["auto_pin_channels"][channel_id]
            self.save_config()
            await interaction.response.send_message(f"✅ {채널.mention}의 자동 고정이 해제되었습니다!")
        else:
            await interaction.response.send_message(f"❌ {채널.mention}에는 자동 고정이 설정되어 있지 않습니다.", ephemeral=True)

    @app_commands.command(name="고정취소", description="메시지 입력 대기 상태 취소")
    async def cancel_pin_setup(self, interaction: discord.Interaction):
        if interaction.user.id in self.waiting_for_message:
            del self.waiting_for_message[interaction.user.id]
            await interaction.response.send_message("✅ 메시지 입력 대기가 취소되었습니다.", ephemeral=True)
        else:
            await interaction.response.send_message("❌ 진행 중인 설정이 없습니다.", ephemeral=True)

    @app_commands.command(name="고정목록", description="자동 고정이 설정된 채널 목록")
    async def list_auto_pins(self, interaction: discord.Interaction):
        if not self.config["auto_pin_channels"]:
            await interaction.response.send_message("자동 고정이 설정된 채널이 없습니다.", ephemeral=True)
            return
        
        embed = discord.Embed(title="📌 자동 고정 설정 목록", color=0xf1c40f)
        
        for channel_id, pin_data in self.config["auto_pin_channels"].items():
            channel = self.bot.get_channel(int(channel_id))
            if channel:
                embed.add_field(
                    name=f"#{channel.name}",
                    value=f"```{pin_data['message']}```",
                    inline=False
                )
        
        await interaction.response.send_message(embed=embed)

    # =====================================================
    # 도움말
    # =====================================================
    @app_commands.command(name="고정도움말", description="자동 고정 시스템 명령어 가이드")
    async def help_command(self, interaction: discord.Interaction):
        embed = discord.Embed(
            title="📌 자동 고정 시스템 명령어 가이드",
            color=0xf1c40f
        )
        
        embed.add_field(
            name="🔑 역할 관리 (서버 관리자만)",
            value=(
                "`/고정역할추가` - 시스템 관리 역할 추가\n"
                "`/고정역할제거` - 시스템 관리 역할 제거"
            ),
            inline=False
        )
        
        embed.add_field(
            name="📌 자동 고정 관리",
            value=(
                "`/고정설정 #채널 [설정채널]` - 자동 고정 설정\n"
                "  → 명령어 실행 후 메시지를 입력하면 자동 설정됩니다\n"
                "`/고정취소` - 메시지 입력 대기 취소\n"
                "`/고정해제 #채널` - 자동 고정 해제\n"
                "`/고정목록` - 설정된 채널 목록 확인"
            ),
            inline=False
        )
        
        embed.add_field(
            name="💡 작동 방식",
            value=(
                "**설정 방법:**\n"
                "1. `/고정설정 #대상채널` 명령어 실행\n"
                "2. 현재 채널 또는 지정한 채널에 메시지 입력\n"
                "3. 입력한 메시지가 자동 전송 메시지로 설정\n\n"
                "**자동 전송:**\n"
                "설정된 채널에 메시지가 전송되면:\n"
                "1. 이전 봇 메시지 삭제\n"
                "2. 새로운 메시지 자동 전송"
            ),
            inline=False
        )
        
        embed.add_field(
            name="📝 예시",
            value=(
                "`/고정설정 #공지채널` - 현재 채널에서 메시지 입력 대기\n"
                "`/고정설정 #공지채널 #관리자채널` - 관리자채널에서 메시지 입력 대기"
            ),
            inline=False
        )
        
        await interaction.response.send_message(embed=embed)

async def setup(bot):
    await bot.add_cog(AutoPinSystem(bot))
