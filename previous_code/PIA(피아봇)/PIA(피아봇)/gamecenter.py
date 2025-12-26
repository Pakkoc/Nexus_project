# gamecenter.py
import discord
from discord.ext import commands
from discord import app_commands
import sqlite3
import random
from datetime import datetime
import config

class GameCenter(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
    
    def get_db_connection(self):
        return sqlite3.connect(config.DATABASE_FILE)
    
    def get_bank_system(self):
        """BankSystem Cog 가져오기"""
        return self.bot.get_cog('BankSystem')
    
    def get_user_balance(self, user_id: int):
        """유저 토피 잔액 조회"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT balance FROM user_coins WHERE user_id = ?', (user_id,))
        result = cursor.fetchone()
        conn.close()
        return result[0] if result else 0
    
    def update_balance(self, user_id: int, username: str, amount: int, reason: str, transaction_type: str = "gamecenter"):
        """유저 잔액 업데이트"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT OR IGNORE INTO user_coins (user_id, username, balance)
            VALUES (?, ?, 0)
        ''', (user_id, username))
        
        current_balance = self.get_user_balance(user_id)
        new_balance = max(0, current_balance + amount)
        
        cursor.execute('''
            UPDATE user_coins 
            SET balance = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE user_id = ?
        ''', (new_balance, user_id))
        
        cursor.execute('''
            INSERT INTO coin_transactions 
            (user_id, admin_id, transaction_type, amount, reason, balance_after)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (user_id, None, transaction_type, amount, reason, new_balance))
        
        conn.commit()
        conn.close()
        
        return new_balance
    
    def get_user_item_quantity(self, user_id: int, item_type: str):
        """유저 아이템 수량 조회 (루비 상점 시스템 연동)"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT quantity FROM user_inventory 
            WHERE user_id = ? AND item_type = ?
        ''', (user_id, item_type))
        
        result = cursor.fetchone()
        conn.close()
        
        return result[0] if result else 0
    
    def use_item(self, user_id: int, item_type: str, quantity: int = 1):
        """아이템 사용 (수량 차감)"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        current_quantity = self.get_user_item_quantity(user_id, item_type)
        
        if current_quantity < quantity:
            conn.close()
            return False
        
        new_quantity = current_quantity - quantity
        
        cursor.execute('''
            UPDATE user_inventory 
            SET quantity = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE user_id = ? AND item_type = ?
        ''', (new_quantity, user_id, item_type))
        
        conn.commit()
        conn.close()
        
        return True
    
    def get_fee_rate(self, use_discount: bool = False):
        """수수료율 계산"""
        bank = self.get_bank_system()
        
        if not bank:
            return 0.0
        
        base_fee_rate = bank.get_tax_rate('gamecenter_fee')
        
        # 골드금고 추가 할인 확인
        vault_cog = self.bot.get_cog('VaultSystem')
        gold_discount = False
        
        if vault_cog:
            if vault_cog.has_active_vault(None, 'gold_vault'):  # user_id는 나중에 전달
                gold_discount = True
        
        # 감면권 할인
        if use_discount:
            base_fee_rate = max(0, base_fee_rate - 10.0)  # 10% 감면
        
        # 골드금고 추가 할인
        if gold_discount:
            base_fee_rate = max(0, base_fee_rate - 5.0)  # 5% 추가 할인
        
        return base_fee_rate
    
    def calculate_fee_rate(self, user_id: int, use_discount: bool = False):
        """유저별 수수료율 계산"""
        bank = self.get_bank_system()
        
        if not bank:
            return 0.0
        
        base_fee_rate = bank.get_tax_rate('gamecenter_fee')
        
        # 골드금고 추가 할인 확인
        vault_cog = self.bot.get_cog('VaultSystem')
        if vault_cog and vault_cog.has_active_vault(user_id, 'gold_vault'):
            base_fee_rate = max(0, base_fee_rate - 5.0)  # 5% 추가 할인
        
        # 감면권 할인
        if use_discount:
            base_fee_rate = max(0, base_fee_rate - 10.0)  # 10% 추가 할인
        
        return base_fee_rate
    
    @app_commands.command(name="홀짝", description="홀짝 게임")
    @app_commands.describe(
        선택="홀 또는 짝 선택",
        베팅금액="베팅할 토피 금액"
    )
    @app_commands.choices(선택=[
        app_commands.Choice(name="홀", value="odd"),
        app_commands.Choice(name="짝", value="even")
    ])
    async def odd_even_game(self, interaction: discord.Interaction, 선택: str, 베팅금액: int):
        if 베팅금액 <= 0:
            await interaction.response.send_message("❌ 1 토피 이상 베팅하세요.", ephemeral=True)
            return
        
        # 잔액 확인
        balance = self.get_user_balance(interaction.user.id)
        if balance < 베팅금액:
            embed = discord.Embed(
                title="❌ 잔액 부족",
                description="토피 잔액이 부족합니다.",
                color=0xff0000
            )
            embed.add_field(name="현재 잔액", value=f"{balance:,} 토피", inline=True)
            embed.add_field(name="필요 금액", value=f"{베팅금액:,} 토피", inline=True)
            await interaction.response.send_message(embed=embed, ephemeral=True)
            return
        
        # 감면권 확인
        has_discount = self.get_user_item_quantity(interaction.user.id, 'game_fee_discount') > 0
        
        if has_discount:
            # 감면권 사용 여부 확인
            view = DiscountConfirmView(self, interaction, 선택, 베팅금액, "odd_even")
            
            embed = discord.Embed(
                title="🎫 게임센터 수수료 감면권 사용",
                description=f"게임센터 수수료 10% 감면권을 보유하고 있습니다.\n사용하시겠습니까?",
                color=0x3498db
            )
            embed.add_field(name="보유 수량", value=f"{has_discount}개", inline=True)
            embed.add_field(name="혜택", value="수수료 10% 감면", inline=True)
            
            await interaction.response.send_message(embed=embed, view=view, ephemeral=True)
        else:
            # 감면권 없으면 바로 게임 진행
            await self.play_odd_even(interaction, 선택, 베팅금액, use_discount=False)
    
    async def play_odd_even(self, interaction: discord.Interaction, 선택: str, 베팅금액: int, use_discount: bool):
        """홀짝 게임 실행"""
        # 베팅금만 먼저 차감
        if not interaction.response.is_done():
            await interaction.response.defer()
        
        new_balance = self.update_balance(
            interaction.user.id,
            interaction.user.display_name,
            -베팅금액,
            reason="홀짝 게임 베팅",
            transaction_type="gamecenter_bet"
        )
        
        # 게임 진행 (40% 승률)
        result_number = random.randint(1, 100)
        
        # 1~40: 홀 승리, 41~100: 짝 승리 (40:60 비율)
        is_odd_win = result_number <= 40
        player_odd = (선택 == "odd")
        
        # 실제 표시할 숫자 생성
        if is_odd_win:
            display_number = random.choice([1, 3, 5, 7, 9, 11, 13, 15, 17, 19])
        else:
            display_number = random.choice([2, 4, 6, 8, 10, 12, 14, 16, 18, 20])
        
        win = (is_odd_win == player_odd)
        
        # 수수료율 계산 (골드금고 + 감면권 고려)
        fee_rate = self.calculate_fee_rate(interaction.user.id, use_discount)
        
        # 감면권 사용 처리
        discount_used = False
        if use_discount:
            if self.use_item(interaction.user.id, 'game_fee_discount', 1):
                discount_used = True
        
        # 골드금고 확인
        vault_cog = self.bot.get_cog('VaultSystem')
        has_gold_vault = vault_cog and vault_cog.has_active_vault(interaction.user.id, 'gold_vault')
        
        if win:
            # 승리 - 배팅금의 2배에서 수수료 차감
            gross_win = 베팅금액 * 2
            fee = int(gross_win * (fee_rate / 100))
            net_win = gross_win - fee
            
            final_balance = self.update_balance(
                interaction.user.id,
                interaction.user.display_name,
                net_win,
                reason=f"홀짝 게임 승리 (수수료: {fee} 토피)",
                transaction_type="gamecenter_win"
            )
            
            embed = discord.Embed(
                title="🎉 승리!",
                description=f"결과: **{display_number}** ({'홀' if is_odd_win else '짝'})",
                color=0x00ff00,
                timestamp=datetime.now()
            )
            embed.add_field(name="베팅", value=f"{베팅금액:,} 토피", inline=True)
            embed.add_field(name="당첨금", value=f"{gross_win:,} 토피 (2배)", inline=True)
            
            # 수수료 표시
            bank = self.get_bank_system()
            original_fee_rate = bank.get_tax_rate('gamecenter_fee') if bank else 5.0
            
            fee_info = []
            if has_gold_vault:
                fee_info.append("🥇 골드금고 -5%")
            if discount_used:
                fee_info.append("🎫 감면권 -10%")
            
            if fee_info:
                original_fee = int(gross_win * (original_fee_rate / 100))
                embed.add_field(
                    name="수수료", 
                    value=f"~~{original_fee:,}~~ → {fee:,} 토피 ({' + '.join(fee_info)})", 
                    inline=True
                )
            else:
                embed.add_field(name="수수료", value=f"{fee:,} 토피 ({fee_rate}%)", inline=True)
            
            embed.add_field(name="실수령액", value=f"{net_win:,} 토피", inline=True)
            profit = net_win - 베팅금액
            embed.add_field(name="순수익", value=f"+{profit:,} 토피", inline=True)
            embed.add_field(name="현재 잔액", value=f"{final_balance:,} 토피", inline=True)
        else:
            # 패배 - 베팅금 손실
            embed = discord.Embed(
                title="😢 패배...",
                description=f"결과: **{display_number}** ({'홀' if is_odd_win else '짝'})",
                color=0xff0000,
                timestamp=datetime.now()
            )
            embed.add_field(name="베팅", value=f"{베팅금액:,} 토피", inline=True)
            embed.add_field(name="손실", value=f"-{베팅금액:,} 토피", inline=True)
            embed.add_field(name="현재 잔액", value=f"{new_balance:,} 토피", inline=False)
            
            if discount_used or has_gold_vault:
                embed.set_footer(text="🎮 토피아 게임센터 | 승률: 40% | ❌ 패배 시 할인 미적용")
            else:
                embed.set_footer(text="🎮 토피아 게임센터 | 승률: 40%")
        
        if not embed.footer.text:
            embed.set_footer(text="🎮 토피아 게임센터 | 승률: 40%")
        
        await interaction.followup.send(embed=embed)
    
    @app_commands.command(name="짱깨뽀", description="가위바위보 게임")
    @app_commands.describe(
        선택="가위, 바위, 보 중 선택",
        베팅금액="베팅할 토피 금액"
    )
    @app_commands.choices(선택=[
        app_commands.Choice(name="✂️ 가위", value="scissors"),
        app_commands.Choice(name="🪨 바위", value="rock"),
        app_commands.Choice(name="📄 보", value="paper")
    ])
    async def rps_game(self, interaction: discord.Interaction, 선택: str, 베팅금액: int):
        if 베팅금액 <= 0:
            await interaction.response.send_message("❌ 1 토피 이상 베팅하세요.", ephemeral=True)
            return
        
        # 잔액 확인
        balance = self.get_user_balance(interaction.user.id)
        if balance < 베팅금액:
            embed = discord.Embed(
                title="❌ 잔액 부족",
                description="토피 잔액이 부족합니다.",
                color=0xff0000
            )
            embed.add_field(name="현재 잔액", value=f"{balance:,} 토피", inline=True)
            embed.add_field(name="필요 금액", value=f"{베팅금액:,} 토피", inline=True)
            await interaction.response.send_message(embed=embed, ephemeral=True)
            return
        
        # 감면권 확인
        has_discount = self.get_user_item_quantity(interaction.user.id, 'game_fee_discount') > 0
        
        if has_discount:
            view = DiscountConfirmView(self, interaction, 선택, 베팅금액, "rps")
            
            embed = discord.Embed(
                title="🎫 게임센터 수수료 감면권 사용",
                description=f"게임센터 수수료 10% 감면권을 보유하고 있습니다.\n사용하시겠습니까?",
                color=0x3498db
            )
            embed.add_field(name="보유 수량", value=f"{has_discount}개", inline=True)
            embed.add_field(name="혜택", value="수수료 10% 감면", inline=True)
            
            await interaction.response.send_message(embed=embed, view=view, ephemeral=True)
        else:
            await self.play_rps(interaction, 선택, 베팅금액, use_discount=False)
    
    async def play_rps(self, interaction: discord.Interaction, 선택: str, 베팅금액: int, use_discount: bool):
        """가위바위보 게임 실행"""
        # 베팅금만 먼저 차감
        if not interaction.response.is_done():
            await interaction.response.defer()
        
        new_balance = self.update_balance(
            interaction.user.id,
            interaction.user.display_name,
            -베팅금액,
            reason="짱깨뽀 게임 베팅",
            transaction_type="gamecenter_bet"
        )
        
        # 게임 진행 (33.3% 승률)
        choices = ['scissors', 'rock', 'paper']
        bot_choice = random.choice(choices)
        
        choice_emoji = {
            'scissors': '✂️',
            'rock': '🪨',
            'paper': '📄'
        }
        
        choice_name = {
            'scissors': '가위',
            'rock': '바위',
            'paper': '보'
        }
        
        # 수수료율 계산 (골드금고 + 감면권 고려)
        fee_rate = self.calculate_fee_rate(interaction.user.id, use_discount)
        
        # 감면권 사용 처리
        discount_used = False
        if use_discount:
            if self.use_item(interaction.user.id, 'game_fee_discount', 1):
                discount_used = True
        
        # 골드금고 확인
        vault_cog = self.bot.get_cog('VaultSystem')
        has_gold_vault = vault_cog and vault_cog.has_active_vault(interaction.user.id, 'gold_vault')
        
        # 승패 판정
        if 선택 == bot_choice:
            result = "draw"
            # 무승부 - 베팅금 반환 (수수료 없음)
            final_balance = self.update_balance(
                interaction.user.id,
                interaction.user.display_name,
                베팅금액,
                reason="짱깨뽀 무승부 (베팅금 반환)",
                transaction_type="gamecenter_draw"
            )
        elif (선택 == 'scissors' and bot_choice == 'paper') or \
             (선택 == 'rock' and bot_choice == 'scissors') or \
             (선택 == 'paper' and bot_choice == 'rock'):
            result = "win"
            # 승리 - 베팅금의 2배에서 수수료 차감
            gross_win = int(베팅금액 * 2)
            fee = int(gross_win * (fee_rate / 100))
            net_win = gross_win - fee
            
            final_balance = self.update_balance(
                interaction.user.id,
                interaction.user.display_name,
                net_win,
                reason=f"짱깨뽀 승리 (수수료: {fee} 토피)",
                transaction_type="gamecenter_win"
            )
        else:
            result = "lose"
            final_balance = new_balance
        
        # 결과 임베드
        if result == "win":
            gross_win = int(베팅금액 * 2.5)
            fee = int(gross_win * (fee_rate / 100))
            net_win = gross_win - fee
            
            embed = discord.Embed(
                title="🎉 승리!",
                description=f"{choice_emoji[선택]} {choice_name[선택]} vs {choice_emoji[bot_choice]} {choice_name[bot_choice]}",
                color=0x00ff00,
                timestamp=datetime.now()
            )
            embed.add_field(name="베팅", value=f"{베팅금액:,} 토피", inline=True)
            embed.add_field(name="당첨금", value=f"{gross_win:,} 토피 (2.5배)", inline=True)
            
            # 수수료 표시
            bank = self.get_bank_system()
            original_fee_rate = bank.get_tax_rate('gamecenter_fee') if bank else 5.0
            
            fee_info = []
            if has_gold_vault:
                fee_info.append("🥇 골드금고 -5%")
            if discount_used:
                fee_info.append("🎫 감면권 -10%")
            
            if fee_info:
                original_fee = int(gross_win * (original_fee_rate / 100))
                embed.add_field(
                    name="수수료", 
                    value=f"~~{original_fee:,}~~ → {fee:,} 토피 ({' + '.join(fee_info)})", 
                    inline=True
                )
            else:
                embed.add_field(name="수수료", value=f"{fee:,} 토피 ({fee_rate}%)", inline=True)
            
            embed.add_field(name="실수령액", value=f"{net_win:,} 토피", inline=True)
            profit = net_win - 베팅금액
            embed.add_field(name="순수익", value=f"+{profit:,} 토피", inline=True)
            embed.add_field(name="현재 잔액", value=f"{final_balance:,} 토피", inline=True)
            embed.set_footer(text="🎮 토피아 게임센터 | 승률: 33.3%")
        elif result == "draw":
            embed = discord.Embed(
                title="🤝 무승부",
                description=f"{choice_emoji[선택]} {choice_name[선택]} vs {choice_emoji[bot_choice]} {choice_name[bot_choice]}",
                color=0xffff00,
                timestamp=datetime.now()
            )
            embed.add_field(name="베팅금 반환", value=f"{베팅금액:,} 토피", inline=True)
            embed.add_field(name="손익", value="±0 토피", inline=True)
            embed.add_field(name="현재 잔액", value=f"{final_balance:,} 토피", inline=False)
            
            if discount_used or has_gold_vault:
                embed.set_footer(text="🎮 토피아 게임센터 | 승률: 33.3% | ⚠️ 무승부 시 할인 미적용")
            else:
                embed.set_footer(text="🎮 토피아 게임센터 | 승률: 33.3%")
        else:
            embed = discord.Embed(
                title="😢 패배...",
                description=f"{choice_emoji[선택]} {choice_name[선택]} vs {choice_emoji[bot_choice]} {choice_name[bot_choice]}",
                color=0xff0000,
                timestamp=datetime.now()
            )
            embed.add_field(name="베팅", value=f"{베팅금액:,} 토피", inline=True)
            embed.add_field(name="손실", value=f"-{베팅금액:,} 토피", inline=True)
            embed.add_field(name="현재 잔액", value=f"{final_balance:,} 토피", inline=False)
            
            if discount_used or has_gold_vault:
                embed.set_footer(text="🎮 토피아 게임센터 | 승률: 33.3% | ❌ 패배 시 할인 미적용")
            else:
                embed.set_footer(text="🎮 토피아 게임센터 | 승률: 33.3%")
        
        await interaction.followup.send(embed=embed)
    
    @app_commands.command(name="내아이템", description="보유 중인 아이템을 확인합니다")
    async def my_items(self, interaction: discord.Interaction):
        """보유 아이템 확인"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT item_type, quantity FROM user_inventory 
            WHERE user_id = ? AND quantity > 0
        ''', (interaction.user.id,))
        
        items = cursor.fetchall()
        conn.close()
        
        embed = discord.Embed(
            title="🎒 보유 아이템",
            color=0x9b59b6,
            timestamp=datetime.now()
        )
        
        item_names = {
            'warning_removal': '⚠️ 경고차감권',
            'game_fee_discount': '🎮 게임센터 수수료 10% 감면권',
            'tax_exemption': '💰 세금 3.3% 면제권',
            'color_change': '🎨 색상변경권'
        }
        
        if not items:
            embed.description = "보유 중인 아이템이 없습니다."
        else:
            item_list = []
            for item_type, quantity in items:
                item_name = item_names.get(item_type, item_type)
                item_list.append(f"{item_name}: **{quantity}개**")
            
            embed.description = "\n".join(item_list)
        
        embed.set_thumbnail(url=interaction.user.display_avatar.url)
        embed.set_footer(text=f"{interaction.user.display_name}")
        
        await interaction.response.send_message(embed=embed, ephemeral=True)
    
    @app_commands.command(name="게임센터", description="게임센터 안내")
    async def gamecenter_info(self, interaction: discord.Interaction):
        """게임센터 안내"""
        embed = discord.Embed(
            title="🎮 토피아 게임센터",
            description="다양한 게임으로 토피를 획득하세요!",
            color=0xe74c3c,
            timestamp=datetime.now()
        )
        
        embed.add_field(
            name="🎲 홀짝",
            value=(
                "**승률:** 40% | **배당:** 2배\n"
                "**사용법:** `/홀짝 [홀/짝] [베팅금액]`\n"
                "홀수와 짝수 중 선택하여 베팅하는 게임\n"
                "💡 당첨금에서 수수료 차감"
            ),
            inline=False
        )
        
        embed.add_field(
            name="✂️ 짱깨뽀 (가위바위보)",
            value=(
                "**승률:** 33.3% | **배당:** 2.5배\n"
                "**사용법:** `/짱깨뽀 [가위/바위/보] [베팅금액]`\n"
                "가위바위보로 봇과 대결하는 게임\n"
                "💡 당첨금에서 수수료 차감 | 무승부 시 수수료 없음"
            ),
            inline=False
        )
        
        bank = self.get_bank_system()
        if bank:
            fee_rate = bank.get_tax_rate('gamecenter_fee')
            embed.add_field(
                name="💳 수수료 정책",
                value=(
                    f"• 베팅 시: 베팅금액만 차감\n"
                    f"• 승리 시: 당첨금의 **{fee_rate}%** 수수료 차감\n"
                    f"• 패배 시: 수수료 없음\n"
                    f"• 무승부 시: 수수료 없음 (짱깨뽀만)\n"
                    f"• 🎫 수수료 감면권 사용 시 10% 할인!"
                ),
                inline=False
            )
        
        embed.add_field(
            name="🎫 아이템 사용",
            value=(
                "• 게임센터 수수료 감면권 보유 시 게임 시작 전 사용 여부를 물어봅니다.\n"
                "• 감면권 사용 시 당첨금 수수료가 10% 감소합니다.\n"
                "• ⚠️ 패배/무승부 시에는 감면권이 사용되지 않습니다."
            ),
            inline=False
        )
        
        embed.set_footer(text="💎 루비 무인상점에서 감면권 구매 가능 (5루비/3개)")
        
        await interaction.response.send_message(embed=embed)


class DiscountConfirmView(discord.ui.View):
    """수수료 감면권 사용 확인 뷰"""
    def __init__(self, cog, interaction, choice, bet_amount, game_type):
        super().__init__(timeout=60)
        self.cog = cog
        self.original_interaction = interaction
        self.choice = choice
        self.bet_amount = bet_amount
        self.game_type = game_type
    
    @discord.ui.button(label="사용", style=discord.ButtonStyle.success, emoji="✅")
    async def use_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.defer()
        
        # 원래 메시지 삭제
        await interaction.message.delete()
        
        # 게임 진행
        if self.game_type == "odd_even":
            await self.cog.play_odd_even(self.original_interaction, self.choice, self.bet_amount, use_discount=True)
        elif self.game_type == "rps":
            await self.cog.play_rps(self.original_interaction, self.choice, self.bet_amount, use_discount=True)
    
    @discord.ui.button(label="사용 안함", style=discord.ButtonStyle.secondary, emoji="❌")
    async def no_use_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.defer()
        
        # 원래 메시지 삭제
        await interaction.message.delete()
        
        # 게임 진행
        if self.game_type == "odd_even":
            await self.cog.play_odd_even(self.original_interaction, self.choice, self.bet_amount, use_discount=False)
        elif self.game_type == "rps":
            await self.cog.play_rps(self.original_interaction, self.choice, self.bet_amount, use_discount=False)


async def setup(bot):
    await bot.add_cog(GameCenter(bot))
