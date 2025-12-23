import discord
from discord.ext import commands
from discord import app_commands
import asyncio

class NicknameCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @app_commands.command(name="별명변경", description="서버 멤버들의 별명을 일괄 변경합니다")
    @app_commands.describe(
        기존별명="변경할 기존 별명 (부분 일치)",
        바꿀별명="새로운 별명으로 교체할 내용"
    )
    async def change_nickname(
        self, 
        interaction: discord.Interaction, 
        기존별명: str, 
        바꿀별명: str
    ):
        # 관리자 권한 확인
        if not interaction.user.guild_permissions.manage_nicknames:
            await interaction.response.send_message("❌ 별명 관리 권한이 없습니다!", ephemeral=True)
            return

        # 봇 권한 확인
        if not interaction.guild.me.guild_permissions.manage_nicknames:
            await interaction.response.send_message("❌ 봇에게 별명 관리 권한이 없습니다!", ephemeral=True)
            return

        # 초기 응답
        embed = discord.Embed(
            title="🔄 별명 변경 작업 시작",
            description=f"**기존 별명:** `{기존별명}`\n**바꿀 별명:** `{바꿀별명}`\n\n📊 멤버 스캔 중...",
            color=0x3498db
        )
        await interaction.response.send_message(embed=embed)

        # 멤버 목록 가져오기
        guild = interaction.guild
        members = guild.members
        
        # 매칭되는 멤버 찾기
        matching_members = []
        total_members = len(members)
        
        # 진행 상황 업데이트를 위한 임베드
        progress_embed = discord.Embed(
            title="🔍 멤버 스캔 중",
            description=f"**총 멤버 수:** {total_members}명\n**확인 중:** 0명",
            color=0xf39c12
        )
        
        # 20초 후 첫 업데이트
        await asyncio.sleep(20)
        
        checked_count = 0
        for i, member in enumerate(members):
            checked_count += 1
            
            # 별명이 있으면 별명 확인, 없으면 사용자명 확인
            display_name = member.display_name
            
            if 기존별명 in display_name:
                matching_members.append(member)
            
            # 매 40명마다 또는 끝에서 진행상황 업데이트
            if checked_count % 40 == 0 or i == len(members) - 1:
                progress_embed.description = f"**총 멤버 수:** {total_members}명\n**확인 중:** {checked_count}명\n**매칭된 멤버:** {len(matching_members)}명"
                try:
                    await interaction.edit_original_response(embed=progress_embed)
                except:
                    pass
                await asyncio.sleep(1)  # API 제한 방지

        # 결과 표시
        if not matching_members:
            final_embed = discord.Embed(
                title="❌ 변경 완료",
                description=f"**`{기존별명}`**이 포함된 멤버를 찾을 수 없습니다.\n\n**스캔한 멤버:** {total_members}명",
                color=0xe74c3c
            )
            await interaction.edit_original_response(embed=final_embed)
            return

        # 별명 변경 작업
        success_count = 0
        failed_count = 0
        
        change_embed = discord.Embed(
            title="🔧 별명 변경 중",
            description=f"**매칭된 멤버:** {len(matching_members)}명\n**변경 완료:** 0명",
            color=0x9b59b6
        )
        await interaction.edit_original_response(embed=change_embed)

        for i, member in enumerate(matching_members):
            try:
                # 기존 별명에서 텍스트 교체
                old_name = member.display_name
                new_name = old_name.replace(기존별명, 바꿀별명)
                
                # 별명 변경 (32자 제한)
                if len(new_name) > 32:
                    new_name = new_name[:32]
                
                await member.edit(nick=new_name)
                success_count += 1
                
            except discord.Forbidden:
                failed_count += 1
            except discord.HTTPException:
                failed_count += 1
            except Exception:
                failed_count += 1
            
            # 진행상황 업데이트 (매 5명마다)
            if (i + 1) % 5 == 0 or i == len(matching_members) - 1:
                change_embed.description = f"**매칭된 멤버:** {len(matching_members)}명\n**변경 완료:** {success_count}명\n**실패:** {failed_count}명"
                try:
                    await interaction.edit_original_response(embed=change_embed)
                except:
                    pass
                await asyncio.sleep(1)  # API 제한 방지

        # 최종 결과
        final_embed = discord.Embed(
            title="✅ 별명 변경 완료!",
            color=0x27ae60
        )
        
        final_embed.add_field(
            name="📊 변경 결과",
            value=f"**총 스캔:** {total_members}명\n**매칭됨:** {len(matching_members)}명\n**성공:** {success_count}명\n**실패:** {failed_count}명",
            inline=False
        )
        
        final_embed.add_field(
            name="🔄 변경 내용",
            value=f"**기존:** `{기존별명}`\n**변경:** `{바꿀별명}`",
            inline=False
        )
        
        if failed_count > 0:
            final_embed.add_field(
                name="⚠️ 실패 사유",
                value="권한 부족, 봇보다 높은 역할, 서버 소유자 등",
                inline=False
            )

        await interaction.edit_original_response(embed=final_embed)

async def setup(bot):
    await bot.add_cog(NicknameCog(bot))