# bank.py
import discord
from discord.ext import commands
from discord import app_commands
import sqlite3
from datetime import datetime
import config

class TaxSettingView(discord.ui.View):
    def __init__(self, bank_cog):
        super().__init__(timeout=None)
        self.bank_cog = bank_cog
    
    @discord.ui.button(label="세금설정", style=discord.ButtonStyle.primary, custom_id="tax_setting")
    async def tax_setting_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ 재무관리 권한이 없습니다.", ephemeral=True)
            return
        
        view = TaxDropdownView(self.bank_cog)
        embed = discord.Embed(
            title="🏦 세금 설정",
            description="변경하실 세율을 선택해주세요.",
            color=0x2f3136,
            timestamp=datetime.now()
        )
        
        current_taxes = self.bank_cog.get_all_tax_rates()
        embed.add_field(name="💸 송금수수료", value=f"{current_taxes['transfer_fee']}%", inline=True)
        embed.add_field(name="🎮 게임센터수수료", value=f"{current_taxes['gamecenter_fee']}%", inline=True)
        embed.add_field(name="🛒 상점구매수수료", value=f"{current_taxes['shop_fee']}%", inline=True)
        embed.add_field(name="📋 정기세금", value=f"{current_taxes['regular_tax']}%", inline=True)
        
        await interaction.response.send_message(embed=embed, view=view, ephemeral=True)
    
    @discord.ui.button(label="세금납부실행", style=discord.ButtonStyle.success, custom_id="single_tax")
    async def single_tax_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ 재무관리 권한이 없습니다.", ephemeral=True)
            return
        
        view = ConfirmTaxView(self.bank_cog, target_user=interaction.user, is_single=True)
        
        balance = self.bank_cog.get_user_balance(interaction.user.id)
        tax_rate = self.bank_cog.get_tax_rate('regular_tax')
        tax_amount = int(balance * (tax_rate / 100))
        
        embed = discord.Embed(
            title="⚠️ 세금 납부 실행 확인",
            description="본인의 정기세금을 징수합니다.",
            color=0xff9900,
            timestamp=datetime.now()
        )
        embed.add_field(name="대상자", value=interaction.user.mention, inline=True)
        embed.add_field(name="현재 잔액", value=f"{balance:,} 토피", inline=True)
        embed.add_field(name="세율", value=f"{tax_rate}%", inline=True)
        embed.add_field(name="징수 금액", value=f"{tax_amount:,} 토피", inline=True)
        embed.add_field(name="납부 후 잔액", value=f"{balance - tax_amount:,} 토피", inline=True)
        embed.set_footer(text="이 작업은 되돌릴 수 없습니다. 신중히 선택해주세요.")
        
        await interaction.response.send_message(embed=embed, view=view, ephemeral=True)
    
    @discord.ui.button(label="서버전체 납세 실행", style=discord.ButtonStyle.danger, custom_id="server_tax")
    async def server_tax_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ 재무관리 권한이 없습니다.", ephemeral=True)
            return
        
        view = ConfirmTaxView(self.bank_cog, target_user=None, is_single=False)
        
        total_users, total_balance, estimated_tax = self.bank_cog.calculate_server_tax()
        tax_rate = self.bank_cog.get_tax_rate('regular_tax')
        
        embed = discord.Embed(
            title="⚠️ 서버 전체 납세 실행 확인",
            description="**이 작업은 서버의 모든 유저에게 정기세금을 징수합니다.**",
            color=0xff0000,
            timestamp=datetime.now()
        )
        embed.add_field(name="대상 유저", value=f"{total_users}명", inline=True)
        embed.add_field(name="총 서버 자산", value=f"{total_balance:,} 토피", inline=True)
        embed.add_field(name="세율", value=f"{tax_rate}%", inline=True)
        embed.add_field(name="예상 징수액", value=f"{estimated_tax:,} 토피", inline=True)
        embed.set_footer(text="⚠️ 경고: 이 작업은 되돌릴 수 없으며, 모든 유저에게 DM이 발송됩니다.")
        
        await interaction.response.send_message(embed=embed, view=view, ephemeral=True)
    
    @discord.ui.button(label="현황", style=discord.ButtonStyle.secondary, custom_id="status")
    async def status_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ 재무관리 권한이 없습니다.", ephemeral=True)
            return
        
        current_taxes = self.bank_cog.get_all_tax_rates()
        tax_history = self.bank_cog.get_recent_tax_history()
        
        embed = discord.Embed(
            title="📊 토피아 중앙은행 현황",
            color=0x2f3136,
            timestamp=datetime.now()
        )
        
        # 현재 세율
        tax_info = (
            f"💸 **송금수수료:** {current_taxes['transfer_fee']}%\n"
            f"🎮 **게임센터수수료:** {current_taxes['gamecenter_fee']}%\n"
            f"🛒 **상점구매수수료:** {current_taxes['shop_fee']}%\n"
            f"📋 **정기세금:** {current_taxes['regular_tax']}%"
        )
        embed.add_field(name="📈 현재 세율", value=tax_info, inline=False)
        
        # 최근 징수 내역
        if tax_history:
            history_text = []
            for record in tax_history[:5]:
                user = interaction.guild.get_member(record['user_id'])
                username = user.display_name if user else f"User#{record['user_id']}"
                history_text.append(f"• {username}: {record['amount']:,} 토피 ({record['timestamp']})")
            
            embed.add_field(
                name="📜 최근 징수 내역 (최근 5건)",
                value="\n".join(history_text) if history_text else "내역 없음",
                inline=False
            )
        
        # 서버 통계
        total_users, total_balance, _ = self.bank_cog.calculate_server_tax()
        embed.add_field(name="👥 총 유저 수", value=f"{total_users}명", inline=True)
        embed.add_field(name="💰 총 서버 자산", value=f"{total_balance:,} 토피", inline=True)
        
        embed.set_footer(text=f"조회자: {interaction.user.display_name}")
        
        await interaction.response.send_message(embed=embed, ephemeral=True)


class TaxDropdownView(discord.ui.View):
    def __init__(self, bank_cog):
        super().__init__(timeout=180)
        self.bank_cog = bank_cog
        self.add_item(TaxDropdown(bank_cog))


class TaxDropdown(discord.ui.Select):
    def __init__(self, bank_cog):
        self.bank_cog = bank_cog
        
        options = [
            discord.SelectOption(label="송금수수료", value="transfer_fee", emoji="💸", description="타인에게 토피 이체 시 부과되는 수수료"),
            discord.SelectOption(label="게임센터수수료", value="gamecenter_fee", emoji="🎮", description="게임센터 이용 시 부과되는 수수료"),
            discord.SelectOption(label="상점구매수수료", value="shop_fee", emoji="🛒", description="상점에서 구매 시 부과되는 수수료"),
            discord.SelectOption(label="정기세금", value="regular_tax", emoji="📋", description="정기적으로 징수되는 재산세")
        ]
        
        super().__init__(
            placeholder="세율을 변경할 항목을 선택하세요...",
            options=options,
            custom_id="tax_dropdown"
        )
    
    async def callback(self, interaction: discord.Interaction):
        tax_type = self.values[0]
        
        tax_names = {
            'transfer_fee': '송금수수료',
            'gamecenter_fee': '게임센터수수료',
            'shop_fee': '상점구매수수료',
            'regular_tax': '정기세금'
        }
        
        modal = TaxInputModal(self.bank_cog, tax_type, tax_names[tax_type])
        await interaction.response.send_modal(modal)


class TaxInputModal(discord.ui.Modal):
    def __init__(self, bank_cog, tax_type, tax_name):
        super().__init__(title=f"{tax_name} 설정", timeout=300)
        self.bank_cog = bank_cog
        self.tax_type = tax_type
        self.tax_name = tax_name
        
        current_rate = self.bank_cog.get_tax_rate(tax_type)
        
        self.tax_input = discord.ui.TextInput(
            label="세율 입력 (%)",
            placeholder="예: 3.3 (소수점 입력 가능)",
            default=str(current_rate),
            required=True,
            max_length=10
        )
        self.add_item(self.tax_input)
    
    async def on_submit(self, interaction: discord.Interaction):
        try:
            new_rate = float(self.tax_input.value)
            
            if new_rate < 0 or new_rate > 100:
                await interaction.response.send_message("❌ 세율은 0%에서 100% 사이여야 합니다.", ephemeral=True)
                return
            
            old_rate = self.bank_cog.get_tax_rate(self.tax_type)
            self.bank_cog.set_tax_rate(self.tax_type, new_rate, interaction.user.id)
            
            embed = discord.Embed(
                title="✅ 세율 변경 완료",
                color=0x00ff00,
                timestamp=datetime.now()
            )
            embed.add_field(name="항목", value=self.tax_name, inline=True)
            embed.add_field(name="변경 전", value=f"{old_rate}%", inline=True)
            embed.add_field(name="변경 후", value=f"{new_rate}%", inline=True)
            embed.set_footer(text=f"변경자: {interaction.user.display_name}")
            
            await interaction.response.send_message(embed=embed, ephemeral=True)
            
        except ValueError:
            await interaction.response.send_message("❌ 올바른 숫자를 입력해주세요.", ephemeral=True)


class ConfirmTaxView(discord.ui.View):
    def __init__(self, bank_cog, target_user, is_single):
        super().__init__(timeout=60)
        self.bank_cog = bank_cog
        self.target_user = target_user
        self.is_single = is_single
    
    @discord.ui.button(label="확인", style=discord.ButtonStyle.danger, custom_id="confirm_yes")
    async def confirm_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.defer(ephemeral=True)
        
        if self.is_single:
            # 개인 세금 징수
            result = await self.bank_cog.collect_single_tax(self.target_user)
            
            if result['success']:
                embed = discord.Embed(
                    title="✅ 세금 징수 완료",
                    description=f"{self.target_user.mention} 님의 정기세금이 징수되었습니다.",
                    color=0x00ff00,
                    timestamp=datetime.now()
                )
                embed.add_field(name="징수액", value=f"{result['tax_amount']:,} 토피", inline=True)
                embed.add_field(name="남은 잔액", value=f"{result['new_balance']:,} 토피", inline=True)
            else:
                embed = discord.Embed(
                    title="❌ 세금 징수 실패",
                    description=result['message'],
                    color=0xff0000
                )
        else:
            # 서버 전체 세금 징수
            await interaction.followup.send("⏳ 서버 전체 세금 징수를 시작합니다... 시간이 소요될 수 있습니다.", ephemeral=True)
            
            result = await self.bank_cog.collect_server_tax(interaction.guild)
            
            embed = discord.Embed(
                title="✅ 서버 전체 세금 징수 완료",
                color=0x00ff00,
                timestamp=datetime.now()
            )
            embed.add_field(name="처리 유저", value=f"{result['processed']}명", inline=True)
            embed.add_field(name="총 징수액", value=f"{result['total_collected']:,} 토피", inline=True)
            embed.add_field(name="실패", value=f"{result['failed']}명", inline=True)
            embed.set_footer(text=f"실행자: {interaction.user.display_name}")
        
        await interaction.followup.send(embed=embed, ephemeral=True)
        
        # 버튼 비활성화
        for item in self.children:
            item.disabled = True
        await interaction.message.edit(view=self)
    
    @discord.ui.button(label="취소", style=discord.ButtonStyle.secondary, custom_id="confirm_no")
    async def cancel_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        embed = discord.Embed(
            title="❌ 작업 취소됨",
            description="세금 징수가 취소되었습니다.",
            color=0x808080
        )
        await interaction.response.send_message(embed=embed, ephemeral=True)
        
        for item in self.children:
            item.disabled = True
        await interaction.message.edit(view=self)


class BankSystem(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
    
    def get_db_connection(self):
        return sqlite3.connect(config.DATABASE_FILE)
    
    def get_user_balance(self, user_id: int):
        """코인 시스템에서 유저 잔액 가져오기"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT balance FROM user_coins WHERE user_id = ?', (user_id,))
        result = cursor.fetchone()
        conn.close()
        
        return result[0] if result else 0
    
    def update_balance(self, user_id: int, username: str, amount: int, reason: str = None, transaction_type: str = "system"):
        """유저 잔액 업데이트 (coin.py의 메서드와 동일한 로직)"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        # 유저 초기화
        cursor.execute('''
            INSERT OR IGNORE INTO user_coins (user_id, username, balance)
            VALUES (?, ?, 0)
        ''', (user_id, username))
        
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
        ''', (user_id, None, transaction_type, amount, reason, new_balance))
        
        conn.commit()
        conn.close()
        
        return new_balance
    
    def get_tax_rate(self, tax_type: str):
        """세율 가져오기"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT rate FROM tax_rates WHERE tax_type = ?', (tax_type,))
        result = cursor.fetchone()
        conn.close()
        
        return result[0] if result else 0.0
    
    def get_all_tax_rates(self):
        """모든 세율 가져오기"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT tax_type, rate FROM tax_rates')
        results = cursor.fetchall()
        conn.close()
        
        rates = {
            'transfer_fee': 0.0,
            'gamecenter_fee': 0.0,
            'shop_fee': 0.0,
            'regular_tax': 0.0
        }
        
        for tax_type, rate in results:
            rates[tax_type] = rate
        
        return rates
    
    def set_tax_rate(self, tax_type: str, rate: float, admin_id: int):
        """세율 설정"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO tax_rates (tax_type, rate, updated_by, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(tax_type) DO UPDATE SET
                rate = excluded.rate,
                updated_by = excluded.updated_by,
                updated_at = CURRENT_TIMESTAMP
        ''', (tax_type, rate, admin_id))
        
        conn.commit()
        conn.close()
    
    def calculate_server_tax(self):
        """서버 전체 세금 계산"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT COUNT(*), SUM(balance) FROM user_coins')
        result = cursor.fetchone()
        conn.close()
        
        total_users = result[0] if result[0] else 0
        total_balance = result[1] if result[1] else 0
        
        tax_rate = self.get_tax_rate('regular_tax')
        estimated_tax = int(total_balance * (tax_rate / 100))
        
        return total_users, total_balance, estimated_tax
    
    def get_recent_tax_history(self, limit: int = 10):
        """최근 세금 징수 내역"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT user_id, amount, timestamp
            FROM tax_collection_history
            ORDER BY timestamp DESC
            LIMIT ?
        ''', (limit,))
        
        results = cursor.fetchall()
        conn.close()
        
        history = []
        for user_id, amount, timestamp in results:
            history.append({
                'user_id': user_id,
                'amount': amount,
                'timestamp': timestamp
            })
        
        return history
    
    async def collect_single_tax(self, user: discord.Member):
        """개인 세금 징수"""
        balance = self.get_user_balance(user.id)
        
        # 금고 잔액 제외
        vault_cog = self.bot.get_cog('VaultSystem')
        if vault_cog:
            vault_balance = vault_cog.get_total_vault_balance(user.id)
            taxable_balance = balance - vault_balance
        else:
            taxable_balance = balance
        
        tax_rate = self.get_tax_rate('regular_tax')
        tax_amount = int(taxable_balance * (tax_rate / 100))
        
        if tax_amount <= 0:
            return {'success': False, 'message': '징수할 세금이 없습니다.'}
        
        new_balance = self.update_balance(
            user.id,
            user.display_name,
            -tax_amount,
            reason=f"정기세금 징수 ({tax_rate}%)",
            transaction_type="tax_collection"
        )
        
        # 세금 징수 기록
        conn = self.get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO tax_collection_history (user_id, amount, tax_type, timestamp)
            VALUES (?, ?, 'regular_tax', CURRENT_TIMESTAMP)
        ''', (user.id, tax_amount))
        conn.commit()
        conn.close()
        
        # DM 전송
        try:
            embed = discord.Embed(
                title="📋 정기세금 징수 안내",
                description="토피아 중앙은행에서 정기세금이 징수되었습니다.",
                color=0xff9900,
                timestamp=datetime.now()
            )
            embed.add_field(name="과세 대상", value=f"{taxable_balance:,} 토피", inline=True)
            embed.add_field(name="세율", value=f"{tax_rate}%", inline=True)
            embed.add_field(name="징수액", value=f"{tax_amount:,} 토피", inline=True)
            embed.add_field(name="남은 잔액", value=f"{new_balance:,} 토피", inline=True)
            
            if vault_cog:
                vault_balance = vault_cog.get_total_vault_balance(user.id)
                if vault_balance > 0:
                    embed.add_field(name="💎 금고 잔액 (면세)", value=f"{vault_balance:,} 토피", inline=True)
            
            embed.set_footer(text="토피아 제국 리턴즈 중앙은행 | 금고 잔액은 과세 대상 제외")
            
            await user.send(embed=embed)
        except:
            pass
        
        return {
            'success': True,
            'tax_amount': tax_amount,
            'new_balance': new_balance
        }
    
    async def collect_server_tax(self, guild: discord.Guild):
        """서버 전체 세금 징수"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT user_id, username, balance FROM user_coins WHERE balance > 0')
        users = cursor.fetchall()
        conn.close()
        
        tax_rate = self.get_tax_rate('regular_tax')
        vault_cog = self.bot.get_cog('VaultSystem')
        
        processed = 0
        failed = 0
        total_collected = 0
        
        for user_id, username, balance in users:
            try:
                # 금고 잔액 제외
                if vault_cog:
                    vault_balance = vault_cog.get_total_vault_balance(user_id)
                    taxable_balance = balance - vault_balance
                else:
                    taxable_balance = balance
                    vault_balance = 0
                
                tax_amount = int(taxable_balance * (tax_rate / 100))
                
                if tax_amount > 0:
                    new_balance = self.update_balance(
                        user_id,
                        username,
                        -tax_amount,
                        reason=f"정기세금 징수 ({tax_rate}%)",
                        transaction_type="tax_collection"
                    )
                    
                    # 세금 징수 기록
                    conn = self.get_db_connection()
                    cursor = conn.cursor()
                    cursor.execute('''
                        INSERT INTO tax_collection_history (user_id, amount, tax_type, timestamp)
                        VALUES (?, ?, 'regular_tax', CURRENT_TIMESTAMP)
                    ''', (user_id, tax_amount))
                    conn.commit()
                    conn.close()
                    
                    total_collected += tax_amount
                    processed += 1
                    
                    # DM 전송
                    try:
                        user = guild.get_member(user_id)
                        if user:
                            embed = discord.Embed(
                                title="📋 정기세금 징수 안내",
                                description="토피아 중앙은행에서 정기세금이 징수되었습니다.",
                                color=0xff9900,
                                timestamp=datetime.now()
                            )
                            embed.add_field(name="과세 대상", value=f"{taxable_balance:,} 토피", inline=True)
                            embed.add_field(name="세율", value=f"{tax_rate}%", inline=True)
                            embed.add_field(name="징수액", value=f"{tax_amount:,} 토피", inline=True)
                            embed.add_field(name="남은 잔액", value=f"{new_balance:,} 토피", inline=True)
                            
                            if vault_balance > 0:
                                embed.add_field(name="💎 금고 잔액 (면세)", value=f"{vault_balance:,} 토피", inline=True)
                            
                            embed.set_footer(text="토피아 제국 리턴즈 중앙은행 | 금고 잔액은 과세 대상 제외")
                            
                            await user.send(embed=embed)
                    except:
                        pass
            except:
                failed += 1
        
        return {
            'processed': processed,
            'failed': failed,
            'total_collected': total_collected
        }
    
    @app_commands.command(name="토피송금", description="다른 유저에게 토피를 이체합니다")
    @app_commands.describe(
        대상자="토피를 받을 유저",
        금액="이체할 토피 금액"
    )
    async def transfer_topia(self, interaction: discord.Interaction, 대상자: discord.Member, 금액: int):
        sender = interaction.user
        
        # 자기 자신에게 이체 방지
        if sender.id == 대상자.id:
            await interaction.response.send_message("❌ 자기 자신에게는 이체할 수 없습니다.", ephemeral=True)
            return
        
        # 봇에게 이체 방지
        if 대상자.bot:
            await interaction.response.send_message("❌ 봇에게는 이체할 수 없습니다.", ephemeral=True)
            return
        
        # 금액 검증
        if 금액 <= 0:
            await interaction.response.send_message("❌ 1 토피 이상 이체할 수 있습니다.", ephemeral=True)
            return
        
        # 잔액 확인
        sender_balance = self.get_user_balance(sender.id)
        
        if sender_balance < 금액:
            embed = discord.Embed(
                title="❌ 이체 실패",
                description="잔액이 부족합니다.",
                color=0xff0000,
                timestamp=datetime.now()
            )
            embed.add_field(name="현재 잔액", value=f"{sender_balance:,} 토피", inline=True)
            embed.add_field(name="이체 금액", value=f"{금액:,} 토피", inline=True)
            embed.add_field(name="부족 금액", value=f"{금액 - sender_balance:,} 토피", inline=True)
            
            await interaction.response.send_message(embed=embed, ephemeral=True)
            return
        
        # 금고 수수료 면제 확인
        vault_cog = self.bot.get_cog('VaultSystem')
        fee_exemption = False
        vault_type = None
        
        if vault_cog:
            # 실버금고 또는 골드금고 보유 시 수수료 면제
            if vault_cog.has_active_vault(sender.id, 'silver_vault'):
                fee_exemption = True
                vault_type = 'silver_vault'
            elif vault_cog.has_active_vault(sender.id, 'gold_vault'):
                fee_exemption = True
                vault_type = 'gold_vault'
        
        # 송금 수수료 계산
        if fee_exemption:
            fee = 0
            transfer_fee_rate = 0
        else:
            transfer_fee_rate = self.get_tax_rate('transfer_fee')
            fee = int(금액 * (transfer_fee_rate / 100))
        
        total_deduct = 금액 + fee
        
        # 수수료 포함 잔액 확인
        if sender_balance < total_deduct:
            embed = discord.Embed(
                title="❌ 이체 실패",
                description="수수료를 포함한 금액이 잔액을 초과합니다.",
                color=0xff0000,
                timestamp=datetime.now()
            )
            embed.add_field(name="현재 잔액", value=f"{sender_balance:,} 토피", inline=True)
            embed.add_field(name="이체 금액", value=f"{금액:,} 토피", inline=True)
            embed.add_field(name="송금 수수료", value=f"{fee:,} 토피 ({transfer_fee_rate}%)", inline=True)
            embed.add_field(name="필요 금액", value=f"{total_deduct:,} 토피", inline=True)
            
            await interaction.response.send_message(embed=embed, ephemeral=True)
            return
        
        # 이체 실행
        new_sender_balance = self.update_balance(
            sender.id,
            sender.display_name,
            -total_deduct,
            reason=f"{대상자.display_name}에게 토피 이체 (수수료: {fee} 토피)",
            transaction_type="transfer_send"
        )
        
        new_receiver_balance = self.update_balance(
            대상자.id,
            대상자.display_name,
            금액,
            reason=f"{sender.display_name}로부터 토피 수령",
            transaction_type="transfer_receive"
        )
        
        # 이체 성공 메시지
        embed = discord.Embed(
            title="✅ 토피 이체 완료",
            description=f"{sender.mention} → {대상자.mention}",
            color=0x00ff00,
            timestamp=datetime.now()
        )
        embed.add_field(name="이체 금액", value=f"{금액:,} 토피", inline=True)
        
        if fee_exemption:
            vault_names = {
                'silver_vault': '🥈 실버금고',
                'gold_vault': '🥇 골드금고'
            }
            original_fee = int(금액 * 0.033)
            embed.add_field(
                name="송금 수수료", 
                value=f"~~{original_fee:,}~~ → 0 토피 ({vault_names[vault_type]} 면제)", 
                inline=True
            )
        else:
            embed.add_field(name="송금 수수료", value=f"{fee:,} 토피 ({transfer_fee_rate}%)", inline=True)
        
        embed.add_field(name="총 차감 금액", value=f"{total_deduct:,} 토피", inline=True)
        embed.add_field(name="발신자 잔액", value=f"{new_sender_balance:,} 토피", inline=True)
        embed.add_field(name="수신자 잔액", value=f"{new_receiver_balance:,} 토피", inline=True)
        embed.set_footer(text="토피아 중앙은행 송금 시스템")
        
        await interaction.response.send_message(embed=embed)
        
        # 수신자에게 DM 전송
        try:
            dm_embed = discord.Embed(
                title="💰 토피 수령 알림",
                description=f"{sender.mention} 님으로부터 토피를 받았습니다!",
                color=0x00ff00,
                timestamp=datetime.now()
            )
            dm_embed.add_field(name="수령 금액", value=f"{금액:,} 토피", inline=True)
            dm_embed.add_field(name="현재 잔액", value=f"{new_receiver_balance:,} 토피", inline=True)
            dm_embed.set_footer(text=f"발신자: {sender.display_name}")
            
            await 대상자.send(embed=dm_embed)
        except:
            pass
    
    @app_commands.command(name="토피아중앙은행", description="토피아 중앙은행 관리 시스템")
    @app_commands.default_permissions(administrator=True)
    async def central_bank(self, interaction: discord.Interaction):
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ 재무관리 권한이 없습니다.", ephemeral=True)
            return
        
        embed = discord.Embed(
            title="🏦 Topia Center Control Bank System",
            description=(
                "본 채널은, 토피아 제국 리턴즈 서버의 전반적인 세율등을 조정할 수 있는 채널로써, "
                "재무관리 권한이 있는 사람만 상호작용이 가능합니다.\n\n"
                "**버튼 설명:**\n"
                "🔧 **세금설정** - 각종 수수료 및 세율 조정\n"
                "💳 **세금납부실행** - 본인의 정기세금 징수\n"
                "🌐 **서버전체 납세 실행** - 모든 유저 대상 정기세금 징수\n"
                "📊 **현황** - 현재 세율 및 징수 내역 확인"
            ),
            color=0x2f3136,
            timestamp=datetime.now()
        )
        embed.set_footer(text="토피아 제국 리턴즈 중앙은행", icon_url=interaction.guild.icon.url if interaction.guild.icon else None)
        
        view = TaxSettingView(self)
        await interaction.response.send_message(embed=embed, view=view)
    


async def setup(bot):
    await bot.add_cog(BankSystem(bot))