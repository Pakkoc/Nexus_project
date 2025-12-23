import discord
from discord.ext import commands
from discord import app_commands
from typing import Optional

class PatchNotes(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.dev_role_id = 1383842778504499411
    
    def has_dev_role(self, user: discord.Member) -> bool:
        """개발팀 역할을 가지고 있는지 확인"""
        return any(role.id == self.dev_role_id for role in user.roles)
    
    @app_commands.command(name="패치노트", description="패치노트를 생성합니다.")
    @app_commands.describe(
        버전="패치 버전을 입력하세요 (예: v1.2.3)",
        번호="패치 번호를 입력하세요"
    )
    async def patch_notes(self, interaction: discord.Interaction, 버전: str, 번호: str):
        """패치노트 슬래시 커맨드"""
        
        # 권한 확인
        if not self.has_dev_role(interaction.user):
            error_embed = discord.Embed(
                title="🚫 액세스 거부됨",
                description="```fix\n⚠️  개발팀 전용 명령어입니다  ⚠️\n```",
                color=0xFF4757
            )
            error_embed.add_field(
                name="🔐 필요 권한",
                value="**개발팀** 역할이 필요합니다",
                inline=False
            )
            await interaction.response.send_message(embed=error_embed, ephemeral=True)
            return
        
        # 그라데이션 컬러 (보라-파랑 계열)
        embed_color = 0x667EEA
        
        # 메인 패치노트 임베드 생성
        embed = discord.Embed(
            color=embed_color,
            timestamp=discord.utils.utcnow()
        )
        
        # 화려한 타이틀 설정
        embed.set_author(
            name="🌟 TOPIA SERVER DITTO BOT 🌟",
            icon_url="https://cdn.discordapp.com/emojis/848556248200716308.gif"  # 애니메이션 이모지 (선택사항)
        )
        
        # 메인 헤더
        header_text = f"""```yaml
╔══════════════════════════════════════════╗
║            🚀  패 치  업 데 이 트  🚀            ║
╚══════════════════════════════════════════╝
```"""
        
        embed.add_field(
            name="",
            value=header_text,
            inline=False
        )
        
        # 버전 정보 섹션
        version_info = f"""```ini
[ 📦 패치 정보 ]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏷️ 버전        : {버전}
🔢 패치 번호    : #{번호}
📅 배포 일시    : {discord.utils.format_dt(discord.utils.utcnow(), 'F')}
👨‍💻 담당자       : {interaction.user.display_name}
```"""
        
        embed.add_field(
            name="📋 **패치 세부사항**",
            value=version_info,
            inline=False
        )
        
        # 패치 내용
        patch_details = f"""```diff
+ ✨ 새로운 기능 추가
  └─ 새로운 명령어 및 기능이 추가되었습니다 ( 자세한 사항은 위키를 참고해주세요 )

+ 🔧 버그 수정 및 성능 최적화
  └─ 기존 알려진 이슈들을 해결했습니다
  └─ 전반적인 봇 성능이 향상되었습니다

+ 🛡️ 보안 및 안정성 강화
  └─ 더욱 안전하고 안정적인 서비스를 제공합니다
```"""
        
        embed.add_field(
            name="🚛 **업데이트 내용**",
            value=patch_details,
            inline=False
        )
        
        # 추가 정보 섹션
        additional_info = """```css
⚡ 적용 상태: 즉시 적용됨
🔄 재시작 필요: 없음  
📞 문의사항: 개발팀 DM
```"""
        
        embed.add_field(
            name="ℹ️ **추가 정보**",
            value=additional_info,
            inline=False
        )
        
        # 구분선과 마무리
        footer_decoration = """```
🚛 ═══════════════════════════════════════════════════ 🚛
     감사합니다! TOPIA SERVER와 함께 즐거운 시간 보내세요
🚛 ═══════════════════════════════════════════════════ 🚛
```"""
        
        embed.add_field(
            name="",
            value=footer_decoration,
            inline=False
        )
        
        # 푸터 설정
        embed.set_footer(
            text=f"🏷️ 패치 ID: {번호} | 💎 TOPIA Development Team",
            icon_url=interaction.user.display_avatar.url
        )
        
        # 썸네일 설정 (로봇 또는 서버 아이콘)
        if interaction.guild and interaction.guild.icon:
            embed.set_thumbnail(url=interaction.guild.icon.url)
        
        await interaction.response.send_message(embed=embed)
    
    @patch_notes.error
    async def patch_notes_error(self, interaction: discord.Interaction, error: app_commands.AppCommandError):
        """패치노트 명령어 오류 처리"""
        if isinstance(error, app_commands.MissingPermissions):
            embed = discord.Embed(
                title="❌ 권한 오류",
                description="이 명령어를 사용할 권한이 없습니다.",
                color=discord.Color.red()
            )
        else:
            embed = discord.Embed(
                title="❌ 오류 발생",
                description=f"명령어 실행 중 오류가 발생했습니다: {str(error)}",
                color=discord.Color.red()
            )
        
        if not interaction.response.is_done():
            await interaction.response.send_message(embed=embed, ephemeral=True)
        else:
            await interaction.followup.send(embed=embed, ephemeral=True)

async def setup(bot):
    await bot.add_cog(PatchNotes(bot))