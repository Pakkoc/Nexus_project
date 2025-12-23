import discord
from discord.ext import commands
from discord import app_commands
import json
import os
from typing import Optional, Dict, Any

class EmbedModal(discord.ui.Modal, title='임베드 편집'):
    def __init__(self, embed_data: Dict[str, Any]):
        super().__init__()
        self.embed_data = embed_data
        
        # 제목 입력
        self.title_input = discord.ui.TextInput(
            label='제목',
            placeholder='임베드 제목을 입력하세요',
            default=embed_data.get('title', ''),
            required=False,
            max_length=256
        )
        self.add_item(self.title_input)
        
        # 설명 입력
        self.description_input = discord.ui.TextInput(
            label='설명',
            placeholder='임베드 설명을 입력하세요',
            default=embed_data.get('description', ''),
            required=False,
            max_length=4000,
            style=discord.TextStyle.paragraph
        )
        self.add_item(self.description_input)
        
        # 색상 입력
        self.color_input = discord.ui.TextInput(
            label='색상 (HEX 코드)',
            placeholder='예: #FF5733',
            default=embed_data.get('color', '#000000'),
            required=False,
            max_length=7
        )
        self.add_item(self.color_input)
        
        # 이미지 URL 입력
        self.image_input = discord.ui.TextInput(
            label='이미지 URL',
            placeholder='이미지 URL을 입력하세요',
            default=embed_data.get('image', ''),
            required=False
        )
        self.add_item(self.image_input)
        
        # 푸터 입력
        self.footer_input = discord.ui.TextInput(
            label='푸터',
            placeholder='푸터 텍스트를 입력하세요',
            default=embed_data.get('footer', ''),
            required=False,
            max_length=2048
        )
        self.add_item(self.footer_input)
    
    async def on_submit(self, interaction: discord.Interaction):
        # 임베드 데이터 업데이트
        self.embed_data['title'] = self.title_input.value
        self.embed_data['description'] = self.description_input.value
        self.embed_data['color'] = self.color_input.value
        self.embed_data['image'] = self.image_input.value
        self.embed_data['footer'] = self.footer_input.value
        
        # 임베드 미리보기 생성
        embed = self.create_embed()
        
        # 새로운 뷰로 업데이트
        view = EmbedEditorView(self.embed_data, interaction.guild_id)
        await interaction.response.edit_message(embed=embed, view=view)
    
    def create_embed(self) -> discord.Embed:
        """임베드 생성"""
        embed = discord.Embed()
        
        if self.embed_data['title']:
            embed.title = self.embed_data['title']
        
        if self.embed_data['description']:
            embed.description = self.embed_data['description']
        
        if self.embed_data['color']:
            try:
                color = int(self.embed_data['color'].replace('#', ''), 16)
                embed.color = discord.Color(color)
            except ValueError:
                embed.color = discord.Color.default()
        
        if self.embed_data['image']:
            embed.set_image(url=self.embed_data['image'])
        
        if self.embed_data['footer']:
            embed.set_footer(text=self.embed_data['footer'])
        
        return embed

class EmbedEditorView(discord.ui.View):
    def __init__(self, embed_data: Dict[str, Any], guild_id: int):
        super().__init__(timeout=300)
        self.embed_data = embed_data
        self.guild_id = guild_id
    
    @discord.ui.button(label='콘텐츠 편집', style=discord.ButtonStyle.primary, emoji='📝')
    async def edit_content(self, interaction: discord.Interaction, button: discord.ui.Button):
        modal = EmbedModal(self.embed_data)
        await interaction.response.send_modal(modal)
    
    @discord.ui.button(label='색상 편집', style=discord.ButtonStyle.secondary, emoji='🎨')
    async def edit_color(self, interaction: discord.Interaction, button: discord.ui.Button):
        # 색상 선택을 위한 간단한 모달
        class ColorModal(discord.ui.Modal, title='색상 편집'):
            def __init__(self, embed_data):
                super().__init__()
                self.embed_data = embed_data
                
                self.color_input = discord.ui.TextInput(
                    label='색상 (HEX 코드)',
                    placeholder='예: #FF5733',
                    default=embed_data.get('color', '#000000'),
                    required=False,
                    max_length=7
                )
                self.add_item(self.color_input)
            
            async def on_submit(self, interaction: discord.Interaction):
                self.embed_data['color'] = self.color_input.value
                embed = self.create_embed()
                view = EmbedEditorView(self.embed_data, interaction.guild_id)
                await interaction.response.edit_message(embed=embed, view=view)
            
            def create_embed(self) -> discord.Embed:
                embed = discord.Embed()
                
                if self.embed_data['title']:
                    embed.title = self.embed_data['title']
                
                if self.embed_data['description']:
                    embed.description = self.embed_data['description']
                
                if self.embed_data['color']:
                    try:
                        color = int(self.embed_data['color'].replace('#', ''), 16)
                        embed.color = discord.Color(color)
                    except ValueError:
                        embed.color = discord.Color.default()
                
                if self.embed_data['image']:
                    embed.set_image(url=self.embed_data['image'])
                
                if self.embed_data['footer']:
                    embed.set_footer(text=self.embed_data['footer'])
                
                return embed
        
        modal = ColorModal(self.embed_data)
        await interaction.response.send_modal(modal)
    
    @discord.ui.button(label='이미지 편집', style=discord.ButtonStyle.secondary, emoji='🖼️')
    async def edit_image(self, interaction: discord.Interaction, button: discord.ui.Button):
        # 이미지 편집 모달
        class ImageModal(discord.ui.Modal, title='이미지 편집'):
            def __init__(self, embed_data):
                super().__init__()
                self.embed_data = embed_data
                
                self.image_input = discord.ui.TextInput(
                    label='이미지 URL',
                    placeholder='이미지 URL을 입력하세요',
                    default=embed_data.get('image', ''),
                    required=False
                )
                self.add_item(self.image_input)
            
            async def on_submit(self, interaction: discord.Interaction):
                self.embed_data['image'] = self.image_input.value
                embed = self.create_embed()
                view = EmbedEditorView(self.embed_data, interaction.guild_id)
                await interaction.response.edit_message(embed=embed, view=view)
            
            def create_embed(self) -> discord.Embed:
                embed = discord.Embed()
                
                if self.embed_data['title']:
                    embed.title = self.embed_data['title']
                
                if self.embed_data['description']:
                    embed.description = self.embed_data['description']
                
                if self.embed_data['color']:
                    try:
                        color = int(self.embed_data['color'].replace('#', ''), 16)
                        embed.color = discord.Color(color)
                    except ValueError:
                        embed.color = discord.Color.default()
                
                if self.embed_data['image']:
                    embed.set_image(url=self.embed_data['image'])
                
                if self.embed_data['footer']:
                    embed.set_footer(text=self.embed_data['footer'])
                
                return embed
        
        modal = ImageModal(self.embed_data)
        await interaction.response.send_modal(modal)
    
    @discord.ui.button(label='보내기', style=discord.ButtonStyle.success, emoji='📤')
    async def send_embed(self, interaction: discord.Interaction, button: discord.ui.Button):
        # 설정된 채널에 임베드 보내기
        channel_id = await self.get_channel_setting(self.guild_id)
        
        if not channel_id:
            await interaction.response.send_message("먼저 /채널설정 명령어로 채널을 설정해주세요!", ephemeral=True)
            return
        
        channel = interaction.guild.get_channel(channel_id)
        if not channel:
            await interaction.response.send_message("설정된 채널을 찾을 수 없습니다!", ephemeral=True)
            return
        
        # 임베드 생성
        embed = self.create_embed()
        
        # 임베드 정보 저장 (이모지 추가를 위해)
        await self.save_embed_data(self.guild_id, embed.to_dict())
        
        # 채널에 임베드 전송
        message = await channel.send(embed=embed)
        
        # 임베드 메시지 ID도 저장
        await self.save_embed_message_id(self.guild_id, message.id)
        
        await interaction.response.send_message(f"임베드가 {channel.mention}에 전송되었습니다!", ephemeral=True)
    
    @discord.ui.button(label='취소', style=discord.ButtonStyle.danger, emoji='❌')
    async def cancel(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.edit_message(content="임베드 편집이 취소되었습니다.", embed=None, view=None)
    
    def create_embed(self) -> discord.Embed:
        """임베드 생성"""
        embed = discord.Embed()
        
        if self.embed_data['title']:
            embed.title = self.embed_data['title']
        
        if self.embed_data['description']:
            embed.description = self.embed_data['description']
        
        if self.embed_data['color']:
            try:
                color = int(self.embed_data['color'].replace('#', ''), 16)
                embed.color = discord.Color(color)
            except ValueError:
                embed.color = discord.Color.default()
        
        if self.embed_data['image']:
            embed.set_image(url=self.embed_data['image'])
        
        if self.embed_data['footer']:
            embed.set_footer(text=self.embed_data['footer'])
        
        return embed
    
    async def get_channel_setting(self, guild_id: int) -> Optional[int]:
        """채널 설정 가져오기"""
        try:
            if os.path.exists('bot_data.json'):
                with open('bot_data.json', 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    return data.get('channels', {}).get(str(guild_id))
        except:
            pass
        return None
    
    async def save_embed_data(self, guild_id: int, embed_data: dict):
        """임베드 데이터 저장"""
        try:
            data = {}
            if os.path.exists('bot_data.json'):
                with open('bot_data.json', 'r', encoding='utf-8') as f:
                    data = json.load(f)
            
            if 'embeds' not in data:
                data['embeds'] = {}
            
            data['embeds'][str(guild_id)] = embed_data
            
            with open('bot_data.json', 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"임베드 데이터 저장 오류: {e}")
    
    async def save_embed_message_id(self, guild_id: int, message_id: int):
        """임베드 메시지 ID 저장"""
        try:
            data = {}
            if os.path.exists('bot_data.json'):
                with open('bot_data.json', 'r', encoding='utf-8') as f:
                    data = json.load(f)
            
            if 'message_ids' not in data:
                data['message_ids'] = {}
            
            data['message_ids'][str(guild_id)] = message_id
            
            with open('bot_data.json', 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"메시지 ID 저장 오류: {e}")

class ReactionRoleView(discord.ui.View):
    def __init__(self, reactions: Dict[str, Any]):
        super().__init__(timeout=None)
        self.reactions = reactions
        
        # 반응 버튼들을 동적으로 생성
        for emoji, role_data in reactions.items():
            button = discord.ui.Button(emoji=emoji, style=discord.ButtonStyle.secondary)
            button.callback = self.create_callback(role_data)
            self.add_item(button)
    
    def create_callback(self, role_data: Dict[str, Any]):
        async def callback(interaction: discord.Interaction):
            role_id = role_data['role_id']
            role_type = role_data['type']
            
            role = interaction.guild.get_role(role_id)
            if not role:
                await interaction.response.send_message("역할을 찾을 수 없습니다!", ephemeral=True)
                return
            
            user = interaction.user
            has_role = role in user.roles
            
            if role_type == '노멀':
                if has_role:
                    await user.remove_roles(role)
                    await interaction.response.send_message(f"{role.name} 역할이 제거되었습니다!", ephemeral=True)
                else:
                    await user.add_roles(role)
                    await interaction.response.send_message(f"{role.name} 역할이 추가되었습니다!", ephemeral=True)
            
            elif role_type == '토글':
                if has_role:
                    await user.remove_roles(role)
                    await interaction.response.send_message(f"{role.name} 역할이 제거되었습니다!", ephemeral=True)
                else:
                    await user.add_roles(role)
                    await interaction.response.send_message(f"{role.name} 역할이 추가되었습니다!", ephemeral=True)
            
            elif role_type == 'Once':
                if not has_role:
                    await user.add_roles(role)
                    await interaction.response.send_message(f"{role.name} 역할이 추가되었습니다!", ephemeral=True)
                else:
                    await interaction.response.send_message("이미 이 역할을 가지고 있습니다!", ephemeral=True)
            
            elif role_type == '제거':
                if has_role:
                    await user.remove_roles(role)
                    await interaction.response.send_message(f"{role.name} 역할이 제거되었습니다!", ephemeral=True)
                else:
                    await interaction.response.send_message("이 역할을 가지고 있지 않습니다!", ephemeral=True)
        
        return callback

class EmbedCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
    
    @app_commands.command(name="채널설정", description="임베드를 보낼 채널을 설정합니다")
    @app_commands.describe(채널="임베드를 보낼 채널")
    async def set_channel(self, interaction: discord.Interaction, 채널: discord.TextChannel):
        """채널 설정"""
        guild_id = interaction.guild_id
        channel_id = 채널.id
        
        # 데이터 저장
        try:
            data = {}
            if os.path.exists('bot_data.json'):
                with open('bot_data.json', 'r', encoding='utf-8') as f:
                    data = json.load(f)
            
            if 'channels' not in data:
                data['channels'] = {}
            
            data['channels'][str(guild_id)] = channel_id
            
            with open('bot_data.json', 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            
            await interaction.response.send_message(f"채널이 {채널.mention}로 설정되었습니다!", ephemeral=True)
        
        except Exception as e:
            await interaction.response.send_message(f"채널 설정 중 오류가 발생했습니다: {e}", ephemeral=True)
    
    @app_commands.command(name="임베드생성", description="임베드를 생성합니다")
    async def create_embed(self, interaction: discord.Interaction):
        """임베드 생성"""
        # 기본 임베드 데이터
        embed_data = {
            'title': '',
            'description': '',
            'color': '#000000',
            'image': '',
            'footer': ''
        }
        
        # 기본 임베드 생성
        embed = discord.Embed(
            title="새로운 임베드",
            description="아래 버튼을 사용하여 임베드를 편집하세요!",
            color=discord.Color.default()
        )
        
        # 편집 뷰 생성
        view = EmbedEditorView(embed_data, interaction.guild_id)
        
        await interaction.response.send_message(embed=embed, view=view, ephemeral=True)
    
    @app_commands.command(name="이모지추가", description="가장 최근 임베드에 이모지 역할을 추가합니다")
    @app_commands.describe(
        타입="역할 타입 (노멀, 토글, Once, 제거)",
        이모지="사용할 이모지",
        역할="지급할 역할"
    )
    @app_commands.choices(타입=[
        app_commands.Choice(name="노멀", value="노멀"),
        app_commands.Choice(name="토글", value="토글"),
        app_commands.Choice(name="Once", value="Once"),
        app_commands.Choice(name="제거", value="제거")
    ])
    async def add_emoji(self, interaction: discord.Interaction, 타입: str, 이모지: str, 역할: discord.Role):
        """이모지 역할 추가"""
        guild_id = interaction.guild_id
        
        try:
            # 저장된 데이터 로드
            if not os.path.exists('bot_data.json'):
                await interaction.response.send_message("먼저 임베드를 생성해주세요!", ephemeral=True)
                return
            
            with open('bot_data.json', 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # 최근 임베드 메시지 ID 가져오기
            message_id = data.get('message_ids', {}).get(str(guild_id))
            if not message_id:
                await interaction.response.send_message("최근에 생성된 임베드를 찾을 수 없습니다!", ephemeral=True)
                return
            
            # 채널 설정 가져오기
            channel_id = data.get('channels', {}).get(str(guild_id))
            if not channel_id:
                await interaction.response.send_message("채널 설정을 찾을 수 없습니다!", ephemeral=True)
                return
            
            channel = interaction.guild.get_channel(channel_id)
            if not channel:
                await interaction.response.send_message("설정된 채널을 찾을 수 없습니다!", ephemeral=True)
                return
            
            # 메시지 가져오기
            try:
                message = await channel.fetch_message(message_id)
            except discord.NotFound:
                await interaction.response.send_message("임베드 메시지를 찾을 수 없습니다!", ephemeral=True)
                return
            
            # 반응 데이터 저장
            if 'reactions' not in data:
                data['reactions'] = {}
            
            if str(guild_id) not in data['reactions']:
                data['reactions'][str(guild_id)] = {}
            
            data['reactions'][str(guild_id)][이모지] = {
                'role_id': 역할.id,
                'type': 타입
            }
            
            with open('bot_data.json', 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            
            # 반응 뷰 생성 및 메시지 업데이트
            reaction_view = ReactionRoleView(data['reactions'][str(guild_id)])
            await message.edit(view=reaction_view)
            
            await interaction.response.send_message(
                f"이모지 {이모지}가 {역할.name} 역할({타입})로 추가되었습니다!",
                ephemeral=True
            )
        
        except Exception as e:
            await interaction.response.send_message(f"이모지 추가 중 오류가 발생했습니다: {e}", ephemeral=True)

async def setup(bot):
    await bot.add_cog(EmbedCog(bot))