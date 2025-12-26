# ditocoin.py
import discord
from discord.ext import commands, tasks
from discord import app_commands
import sqlite3
from datetime import datetime
import random
import config

class DitoCoinMarket(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.market_channel_id = None
        self.market_message_id = None
        self.price_channel_id = None
        self.price_message_id = None  # 시세변동 메시지 ID 추가
        self.history_channel_id = None
        
    @commands.Cog.listener()
    async def on_ready(self):
        print("DitoCoinMarket: 디토코인 거래 시스템이 준비되었습니다.")
        self.init_database()
        
        if not self.market_update_loop.is_running():
            self.market_update_loop.start()
    
    def cog_unload(self):
        if self.market_update_loop.is_running():
            self.market_update_loop.cancel()
    
    def get_db_connection(self):
        return sqlite3.connect(config.DATABASE_FILE)
    
    def init_database(self):
        """데이터베이스 초기화"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        # 디토코인 종목 테이블
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS ditocoin_listings (
                symbol TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                current_price INTEGER NOT NULL,
                previous_price INTEGER NOT NULL,
                base_price INTEGER NOT NULL,
                change_percent REAL DEFAULT 0.0,
                listed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_active INTEGER DEFAULT 1
            )
        ''')
        
        # 유저 디토코인 보유 테이블
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_ditocoins (
                user_id INTEGER NOT NULL,
                symbol TEXT NOT NULL,
                quantity REAL NOT NULL,
                average_price REAL NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, symbol)
            )
        ''')
        
        # 거래 내역 테이블
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS ditocoin_transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                symbol TEXT NOT NULL,
                transaction_type TEXT NOT NULL,
                quantity REAL NOT NULL,
                price INTEGER NOT NULL,
                total_amount INTEGER NOT NULL,
                fee INTEGER NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # 가격 변동 이력 테이블
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS price_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol TEXT NOT NULL,
                price INTEGER NOT NULL,
                change_percent REAL NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        conn.commit()
        conn.close()
    
    def get_bank_system(self):
        """BankSystem Cog 가져오기"""
        return self.bot.get_cog('BankSystem')
    
    def get_user_balance(self, user_id: int):
        """유저 토피 잔액"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT balance FROM user_coins WHERE user_id = ?', (user_id,))
        result = cursor.fetchone()
        conn.close()
        return result[0] if result else 0
    
    def update_balance(self, user_id: int, username: str, amount: int, reason: str):
        """토피 잔액 업데이트"""
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
            (user_id, transaction_type, amount, reason, balance_after)
            VALUES (?, 'ditocoin_trade', ?, ?, ?)
        ''', (user_id, amount, reason, new_balance))
        
        conn.commit()
        conn.close()
        
        return new_balance
    
    def get_all_listings(self):
        """모든 상장 코인 조회"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT symbol, name, current_price, previous_price, change_percent
            FROM ditocoin_listings
            WHERE is_active = 1
            ORDER BY symbol
        ''')
        
        results = cursor.fetchall()
        conn.close()
        
        return results
    
    def get_listing(self, symbol: str):
        """특정 코인 정보"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT symbol, name, current_price, previous_price, change_percent, base_price
            FROM ditocoin_listings
            WHERE symbol = ? AND is_active = 1
        ''', (symbol.upper(),))
        
        result = cursor.fetchone()
        conn.close()
        
        return result
    
    def get_user_holdings(self, user_id: int):
        """유저 보유 코인"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT uh.symbol, uh.quantity, uh.average_price, dl.current_price, dl.name
            FROM user_ditocoins uh
            JOIN ditocoin_listings dl ON uh.symbol = dl.symbol
            WHERE uh.user_id = ? AND uh.quantity > 0 AND dl.is_active = 1
            ORDER BY uh.symbol
        ''', (user_id,))
        
        results = cursor.fetchall()
        conn.close()
        
        return results
    
    def update_prices(self):
        """20분마다 가격 변동"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT symbol, current_price FROM ditocoin_listings WHERE is_active = 1')
        listings = cursor.fetchall()
        
        changes = []
        
        for symbol, current_price in listings:
            # -10% ~ +10% 랜덤 변동
            change_rate = random.uniform(-0.10, 0.10)
            new_price = int(current_price * (1 + change_rate))
            new_price = max(1, new_price)  # 최소 1토피
            
            change_percent = ((new_price - current_price) / current_price) * 100
            
            cursor.execute('''
                UPDATE ditocoin_listings
                SET previous_price = current_price,
                    current_price = ?,
                    change_percent = ?
                WHERE symbol = ?
            ''', (new_price, change_percent, symbol))
            
            # 가격 이력 저장
            cursor.execute('''
                INSERT INTO price_history (symbol, price, change_percent)
                VALUES (?, ?, ?)
            ''', (symbol, new_price, change_percent))
            
            changes.append({
                'symbol': symbol,
                'old_price': current_price,
                'new_price': new_price,
                'change_percent': change_percent
            })
        
        conn.commit()
        conn.close()
        
        return changes
    
    def create_market_embed(self):
        """거래소 메인 임베드"""
        listings = self.get_all_listings()
        
        embed = discord.Embed(
            title="📊 디토코인 거래증권",
            description="실시간 암호화폐 거래소",
            color=0x2ecc71,
            timestamp=datetime.now()
        )
        
        if not listings:
            embed.add_field(name="📋 상장 종목", value="현재 상장된 코인이 없습니다.", inline=False)
        else:
            coin_list = []
            for symbol, name, current_price, previous_price, change_percent in listings:
                # 등락 표시
                if change_percent > 0:
                    change_emoji = "📈"
                    change_color = "🟢"
                elif change_percent < 0:
                    change_emoji = "📉"
                    change_color = "🔴"
                else:
                    change_emoji = "➡️"
                    change_color = "⚪"
                
                coin_list.append(
                    f"{change_emoji} **{symbol}** ({name})\n"
                    f"  └ {current_price:,} 토피 {change_color} {change_percent:+.2f}%"
                )
            
            embed.add_field(
                name="📋 상장 종목",
                value="\n\n".join(coin_list),
                inline=False
            )
        
        embed.add_field(
            name="💡 사용 방법",
            value=(
                "**매수** - 디토코인 구매\n"
                "**매도** - 보유 코인 판매\n"
                "**내정보** - 보유 현황 확인"
            ),
            inline=False
        )
        
        embed.set_footer(text="🔄 20분마다 가격 자동 변동 | 거래 수수료 5%")
        
        return embed
    
    def create_price_change_embed(self, changes):
        """가격 변동 임베드 - 계속 수정될 메시지"""
        embed = discord.Embed(
            title="📊 실시간 디토코인 시세",
            description="20분마다 자동 업데이트",
            color=0x3498db,
            timestamp=datetime.now()
        )
        
        rising = []
        falling = []
        stable = []
        
        for change in changes:
            symbol = change['symbol']
            new_price = change['new_price']
            change_percent = change['change_percent']
            
            price_text = f"**{symbol}** - {new_price:,}토피 ({change_percent:+.2f}%)"
            
            if change_percent > 0:
                rising.append(f"🔺 {price_text}")
            elif change_percent < 0:
                falling.append(f"🔻 {price_text}")
            else:
                stable.append(f"➡️ {price_text}")
        
        if rising:
            embed.add_field(name="🟢 상승", value="\n".join(rising), inline=False)
        if falling:
            embed.add_field(name="🔴 하락", value="\n".join(falling), inline=False)
        if stable:
            embed.add_field(name="⚪ 보합", value="\n".join(stable), inline=False)
        
        if not rising and not falling and not stable:
            embed.description = "거래 가능한 코인이 없습니다."
        
        embed.set_footer(text="🔄 다음 업데이트까지 20분")
        
        return embed
    
    @tasks.loop(minutes=20)
    async def market_update_loop(self):
        """20분마다 시장 업데이트"""
        if not self.price_channel_id:
            return
        
        try:
            # 가격 변동
            changes = self.update_prices()
            
            if not changes:
                return
            
            # 메인 거래소 임베드 업데이트
            if self.market_channel_id and self.market_message_id:
                try:
                    market_channel = self.bot.get_channel(self.market_channel_id)
                    if market_channel:
                        market_message = await market_channel.fetch_message(self.market_message_id)
                        if market_message:
                            embed = self.create_market_embed()
                            view = MarketView(self)
                            await market_message.edit(embed=embed, view=view)
                except:
                    pass
            
            # 가격 변동 채널에 알림 (수정 방식)
            price_channel = self.bot.get_channel(self.price_channel_id)
            if price_channel:
                price_embed = self.create_price_change_embed(changes)
                
                # 기존 메시지가 있으면 수정, 없으면 새로 생성
                if self.price_message_id:
                    try:
                        price_message = await price_channel.fetch_message(self.price_message_id)
                        await price_message.edit(embed=price_embed)
                    except discord.NotFound:
                        # 메시지를 찾을 수 없으면 새로 생성
                        new_message = await price_channel.send(embed=price_embed)
                        self.price_message_id = new_message.id
                else:
                    # 첫 실행시 메시지 생성
                    new_message = await price_channel.send(embed=price_embed)
                    self.price_message_id = new_message.id
            
        except Exception as e:
            print(f"시장 업데이트 실패: {e}")
    
    @market_update_loop.before_loop
    async def before_market_update(self):
        await self.bot.wait_until_ready()
    
    @app_commands.command(name="디토코인거래시장", description="디토코인 거래소를 설정합니다 (관리자 전용)")
    @app_commands.default_permissions(administrator=True)
    @app_commands.describe(
        채널지정="거래소 메인 채널",
        시장변동채널지정="가격 변동 알림 채널",
        거래기록채널지정="거래 기록 채널"
    )
    async def setup_market(
        self, 
        interaction: discord.Interaction, 
        채널지정: discord.TextChannel,
        시장변동채널지정: discord.TextChannel,
        거래기록채널지정: discord.TextChannel
    ):
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ 관리자만 사용할 수 있습니다.", ephemeral=True)
            return
        
        # 채널 ID 저장
        self.market_channel_id = 채널지정.id
        self.price_channel_id = 시장변동채널지정.id
        self.history_channel_id = 거래기록채널지정.id
        
        # 거래소 임베드 생성
        embed = self.create_market_embed()
        view = MarketView(self)
        
        message = await 채널지정.send(embed=embed, view=view)
        self.market_message_id = message.id
        
        # 확인 메시지
        confirm_embed = discord.Embed(
            title="✅ 디토코인 거래소 설정 완료",
            color=0x00ff00,
            timestamp=datetime.now()
        )
        confirm_embed.add_field(name="거래소 채널", value=채널지정.mention, inline=False)
        confirm_embed.add_field(name="시장 변동 채널", value=시장변동채널지정.mention, inline=False)
        confirm_embed.add_field(name="거래 기록 채널", value=거래기록채널지정.mention, inline=False)
        
        await interaction.response.send_message(embed=confirm_embed, ephemeral=True)
        
        # 업데이트 루프 시작
        if not self.market_update_loop.is_running():
            self.market_update_loop.start()
    
    @app_commands.command(name="디토코인관리", description="디토코인을 관리합니다 (관리자 전용)")
    @app_commands.default_permissions(administrator=True)
    @app_commands.describe(
        작업="상장 또는 상장폐지",
        심볼="코인 심볼 (예: FBI, BTC)",
        이름="코인 이름",
        기초시작가="초기 가격 (토피)"
    )
    @app_commands.choices(작업=[
        app_commands.Choice(name="상장", value="list"),
        app_commands.Choice(name="상장폐지", value="delist")
    ])
    async def manage_coin(
        self,
        interaction: discord.Interaction,
        작업: str,
        심볼: str,
        이름: str = None,
        기초시작가: int = None
    ):
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ 관리자만 사용할 수 있습니다.", ephemeral=True)
            return
        
        symbol = 심볼.upper()
        
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        if 작업 == "list":
            # 상장
            if not 이름 or not 기초시작가:
                await interaction.response.send_message("❌ 이름과 기초시작가를 입력해주세요.", ephemeral=True)
                conn.close()
                return
            
            if 기초시작가 <= 0:
                await interaction.response.send_message("❌ 기초시작가는 1 이상이어야 합니다.", ephemeral=True)
                conn.close()
                return
            
            # 중복 확인
            cursor.execute('SELECT symbol FROM ditocoin_listings WHERE symbol = ?', (symbol,))
            if cursor.fetchone():
                await interaction.response.send_message(f"❌ {symbol}은(는) 이미 상장되어 있습니다.", ephemeral=True)
                conn.close()
                return
            
            # 상장 등록
            cursor.execute('''
                INSERT INTO ditocoin_listings 
                (symbol, name, current_price, previous_price, base_price, is_active)
                VALUES (?, ?, ?, ?, ?, 1)
            ''', (symbol, 이름, 기초시작가, 기초시작가, 기초시작가))
            
            conn.commit()
            conn.close()
            
            embed = discord.Embed(
                title="✅ 디토코인 상장 완료",
                color=0x00ff00,
                timestamp=datetime.now()
            )
            embed.add_field(name="심볼", value=symbol, inline=True)
            embed.add_field(name="이름", value=이름, inline=True)
            embed.add_field(name="시작가", value=f"{기초시작가:,} 토피", inline=True)
            
            await interaction.response.send_message(embed=embed)
            
            # 거래소 임베드 업데이트
            if self.market_channel_id and self.market_message_id:
                try:
                    channel = self.bot.get_channel(self.market_channel_id)
                    message = await channel.fetch_message(self.market_message_id)
                    new_embed = self.create_market_embed()
                    view = MarketView(self)
                    await message.edit(embed=new_embed, view=view)
                except:
                    pass
        
        else:
            # 상장폐지
            cursor.execute('''
                UPDATE ditocoin_listings
                SET is_active = 0
                WHERE symbol = ?
            ''', (symbol,))
            
            if cursor.rowcount == 0:
                await interaction.response.send_message(f"❌ {symbol}을(를) 찾을 수 없습니다.", ephemeral=True)
                conn.close()
                return
            
            conn.commit()
            conn.close()
            
            embed = discord.Embed(
                title="✅ 디토코인 상장폐지 완료",
                description=f"**{symbol}**이(가) 상장폐지되었습니다.",
                color=0xff0000,
                timestamp=datetime.now()
            )
            
            await interaction.response.send_message(embed=embed)
            
            # 거래소 임베드 업데이트
            if self.market_channel_id and self.market_message_id:
                try:
                    channel = self.bot.get_channel(self.market_channel_id)
                    message = await channel.fetch_message(self.market_message_id)
                    new_embed = self.create_market_embed()
                    view = MarketView(self)
                    await message.edit(embed=new_embed, view=view)
                except:
                    pass


class MarketView(discord.ui.View):
    """거래소 메인 뷰"""
    def __init__(self, cog):
        super().__init__(timeout=None)
        self.cog = cog
    
    @discord.ui.button(label="매수", style=discord.ButtonStyle.success, emoji="💰", custom_id="buy_coin")
    async def buy_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        listings = self.cog.get_all_listings()
        
        if not listings:
            await interaction.response.send_message("❌ 현재 거래 가능한 코인이 없습니다.", ephemeral=True)
            return
        
        view = BuyCoinView(self.cog, listings)
        
        embed = discord.Embed(
            title="💰 디토코인 매수",
            description="구매할 코인을 선택하세요.",
            color=0x2ecc71
        )
        
        balance = self.cog.get_user_balance(interaction.user.id)
        embed.add_field(name="보유 토피", value=f"{balance:,} 토피", inline=False)
        
        await interaction.response.send_message(embed=embed, view=view, ephemeral=True)
    
    @discord.ui.button(label="매도", style=discord.ButtonStyle.danger, emoji="💸", custom_id="sell_coin")
    async def sell_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        holdings = self.cog.get_user_holdings(interaction.user.id)
        
        if not holdings:
            await interaction.response.send_message("❌ 보유 중인 디토코인이 없습니다.", ephemeral=True)
            return
        
        view = SellCoinView(self.cog, holdings)
        
        embed = discord.Embed(
            title="💸 디토코인 매도",
            description="판매할 코인을 선택하세요.",
            color=0xe74c3c
        )
        
        await interaction.response.send_message(embed=embed, view=view, ephemeral=True)
    
    @discord.ui.button(label="내정보", style=discord.ButtonStyle.primary, emoji="📊", custom_id="my_info")
    async def info_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        holdings = self.cog.get_user_holdings(interaction.user.id)
        balance = self.cog.get_user_balance(interaction.user.id)
        
        embed = discord.Embed(
            title="📊 내 디토코인 정보",
            color=0x3498db,
            timestamp=datetime.now()
        )
        
        embed.add_field(name="💰 보유 토피", value=f"{balance:,} 토피", inline=False)
        
        if not holdings:
            embed.add_field(name="📋 보유 코인", value="보유 중인 코인이 없습니다.", inline=False)
        else:
            total_value = 0
            total_profit = 0
            
            coin_list = []
            for symbol, quantity, avg_price, current_price, name in holdings:
                buy_value = quantity * avg_price
                current_value = quantity * current_price
                profit = current_value - buy_value
                profit_percent = (profit / buy_value) * 100
                
                total_value += current_value
                total_profit += profit
                
                profit_emoji = "📈" if profit >= 0 else "📉"
                profit_color = "🟢" if profit >= 0 else "🔴"
                
                coin_list.append(
                    f"{profit_emoji} **{symbol}** ({name})\n"
                    f"  └ 수량: {quantity:.4f}개\n"
                    f"  └ 평단가: {avg_price:,.0f} 토피\n"
                    f"  └ 현재가: {current_price:,} 토피\n"
                    f"  └ 평가액: {current_value:,.0f} 토피\n"
                    f"  └ {profit_color} {profit:+,.0f} 토피 ({profit_percent:+.2f}%)"
                )
            
            embed.add_field(
                name="📋 보유 코인",
                value="\n\n".join(coin_list),
                inline=False
            )
            
            total_profit_percent = (total_profit / (total_value - total_profit)) * 100 if total_value != total_profit else 0
            
            embed.add_field(name="💎 총 평가액", value=f"{total_value:,.0f} 토피", inline=True)
            embed.add_field(name="📊 총 손익", value=f"{total_profit:+,.0f} 토피 ({total_profit_percent:+.2f}%)", inline=True)
        
        embed.set_thumbnail(url=interaction.user.display_avatar.url)
        embed.set_footer(text=f"{interaction.user.display_name}")
        
        await interaction.response.send_message(embed=embed, ephemeral=True)


class BuyCoinView(discord.ui.View):
    """매수 뷰"""
    def __init__(self, cog, listings):
        super().__init__(timeout=180)
        self.cog = cog
        self.add_item(BuyCoinSelect(cog, listings))


class BuyCoinSelect(discord.ui.Select):
    """매수 코인 선택"""
    def __init__(self, cog, listings):
        self.cog = cog
        
        options = []
        for symbol, name, current_price, previous_price, change_percent in listings:
            emoji = "📈" if change_percent >= 0 else "📉"
            options.append(
                discord.SelectOption(
                    label=f"{symbol} - {current_price:,} 토피",
                    description=f"{name} | {change_percent:+.2f}%",
                    value=symbol,
                    emoji=emoji
                )
            )
        
        super().__init__(
            placeholder="구매할 코인을 선택하세요...",
            options=options,
            custom_id="buy_coin_select"
        )
    
    async def callback(self, interaction: discord.Interaction):
        symbol = self.values[0]
        
        modal = BuyModal(self.cog, symbol)
        await interaction.response.send_modal(modal)


class BuyModal(discord.ui.Modal):
    """매수 모달"""
    def __init__(self, cog, symbol):
        super().__init__(title=f"{symbol} 매수", timeout=300)
        self.cog = cog
        self.symbol = symbol
        
        self.quantity_input = discord.ui.TextInput(
            label="구매 수량",
            placeholder="구매할 코인 수량을 입력하세요",
            required=True,
            max_length=20
        )
        self.add_item(self.quantity_input)
    
    async def on_submit(self, interaction: discord.Interaction):
        try:
            quantity = float(self.quantity_input.value)
            
            if quantity <= 0:
                await interaction.response.send_message("❌ 수량은 0보다 커야 합니다.", ephemeral=True)
                return
            
            # 코인 정보
            listing = self.cog.get_listing(self.symbol)
            if not listing:
                await interaction.response.send_message("❌ 코인 정보를 찾을 수 없습니다.", ephemeral=True)
                return
            
            symbol, name, current_price, previous_price, change_percent, base_price = listing
            
            # 총 금액 계산
            total_cost = int(quantity * current_price)
            
            # 수수료 계산
            bank = self.cog.get_bank_system()
            if bank:
                fee_rate = bank.get_tax_rate('gamecenter_fee')
            else:
                fee_rate = 5.0
            
            fee = int(total_cost * (fee_rate / 100))
            final_cost = total_cost + fee
            
            # 잔액 확인
            balance = self.cog.get_user_balance(interaction.user.id)
            if balance < final_cost:
                embed = discord.Embed(
                    title="❌ 잔액 부족",
                    color=0xff0000
                )
                embed.add_field(name="필요 금액", value=f"{final_cost:,} 토피", inline=True)
                embed.add_field(name="보유 토피", value=f"{balance:,} 토피", inline=True)
                await interaction.response.send_message(embed=embed, ephemeral=True)
                return
            
            # 구매 처리
            conn = self.cog.get_db_connection()
            cursor = conn.cursor()
            
            # 기존 보유 확인
            cursor.execute('''
                SELECT quantity, average_price FROM user_ditocoins
                WHERE user_id = ? AND symbol = ?
            ''', (interaction.user.id, symbol))
            
            existing = cursor.fetchone()
            
            if existing:
                old_quantity, old_avg_price = existing
                new_quantity = old_quantity + quantity
                new_avg_price = ((old_quantity * old_avg_price) + (quantity * current_price)) / new_quantity
                
                cursor.execute('''
                    UPDATE user_ditocoins
                    SET quantity = ?, average_price = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = ? AND symbol = ?
                ''', (new_quantity, new_avg_price, interaction.user.id, symbol))
            else:
                cursor.execute('''
                    INSERT INTO user_ditocoins (user_id, symbol, quantity, average_price)
                    VALUES (?, ?, ?, ?)
                ''', (interaction.user.id, symbol, quantity, current_price))
            
            # 거래 내역 저장
            cursor.execute('''
                INSERT INTO ditocoin_transactions 
                (user_id, symbol, transaction_type, quantity, price, total_amount, fee)
                VALUES (?, ?, 'BUY', ?, ?, ?, ?)
            ''', (interaction.user.id, symbol, quantity, current_price, total_cost, fee))
            
            conn.commit()
            conn.close()
            
            # 토피 차감
            new_balance = self.cog.update_balance(
                interaction.user.id,
                interaction.user.display_name,
                -final_cost,
                f"디토코인 매수: {symbol} {quantity}개"
            )
            
            # 성공 메시지
            embed = discord.Embed(
                title="✅ 매수 완료",
                color=0x00ff00,
                timestamp=datetime.now()
            )
            embed.add_field(name="코인", value=f"{symbol} ({name})", inline=True)
            embed.add_field(name="수량", value=f"{quantity:.4f}개", inline=True)
            embed.add_field(name="단가", value=f"{current_price:,} 토피", inline=True)
            embed.add_field(name="구매금액", value=f"{total_cost:,} 토피", inline=True)
            embed.add_field(name="수수료", value=f"{fee:,} 토피 ({fee_rate}%)", inline=True)
            embed.add_field(name="총 지불", value=f"{final_cost:,} 토피", inline=True)
            embed.add_field(name="남은 잔액", value=f"{new_balance:,} 토피", inline=False)
            embed.set_footer(text="💎 디토코인 거래소")
            
            await interaction.response.send_message(embed=embed, ephemeral=True)
            
            # 거래 기록 채널에 알림
            if self.cog.history_channel_id:
                history_channel = self.cog.bot.get_channel(self.cog.history_channel_id)
                if history_channel:
                    history_embed = discord.Embed(
                        title="💰 매수 거래 발생",
                        color=0x2ecc71,
                        timestamp=datetime.now()
                    )
                    history_embed.add_field(name="유저", value=interaction.user.mention, inline=True)
                    history_embed.add_field(name="코인", value=symbol, inline=True)
                    history_embed.add_field(name="수량", value=f"{quantity:.4f}개", inline=True)
                    history_embed.add_field(name="단가", value=f"{current_price:,} 토피", inline=True)
                    history_embed.add_field(name="총액", value=f"{total_cost:,} 토피", inline=True)
                    
                    await history_channel.send(embed=history_embed)
            
        except ValueError:
            await interaction.response.send_message("❌ 올바른 숫자를 입력해주세요.", ephemeral=True)
        except Exception as e:
            await interaction.response.send_message(f"❌ 오류가 발생했습니다: {str(e)}", ephemeral=True)


class SellCoinView(discord.ui.View):
    """매도 뷰"""
    def __init__(self, cog, holdings):
        super().__init__(timeout=180)
        self.cog = cog
        self.add_item(SellCoinSelect(cog, holdings))


class SellCoinSelect(discord.ui.Select):
    """매도 코인 선택"""
    def __init__(self, cog, holdings):
        self.cog = cog
        
        options = []
        for symbol, quantity, avg_price, current_price, name in holdings:
            profit = (current_price - avg_price) * quantity
            profit_percent = ((current_price - avg_price) / avg_price) * 100
            emoji = "📈" if profit >= 0 else "📉"
            
            options.append(
                discord.SelectOption(
                    label=f"{symbol} - {quantity:.4f}개",
                    description=f"{name} | {profit:+,.0f} 토피 ({profit_percent:+.2f}%)",
                    value=symbol,
                    emoji=emoji
                )
            )
        
        super().__init__(
            placeholder="판매할 코인을 선택하세요...",
            options=options,
            custom_id="sell_coin_select"
        )
    
    async def callback(self, interaction: discord.Interaction):
        symbol = self.values[0]
        
        modal = SellModal(self.cog, symbol)
        await interaction.response.send_modal(modal)


class SellModal(discord.ui.Modal):
    """매도 모달"""
    def __init__(self, cog, symbol):
        super().__init__(title=f"{symbol} 매도", timeout=300)
        self.cog = cog
        self.symbol = symbol
        
        self.quantity_input = discord.ui.TextInput(
            label="판매 수량",
            placeholder="판매할 코인 수량을 입력하세요 (전체 판매: all)",
            required=True,
            max_length=20
        )
        self.add_item(self.quantity_input)
    
    async def on_submit(self, interaction: discord.Interaction):
        try:
            # 보유 확인
            conn = self.cog.get_db_connection()
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT uh.quantity, uh.average_price, dl.current_price, dl.name
                FROM user_ditocoins uh
                JOIN ditocoin_listings dl ON uh.symbol = dl.symbol
                WHERE uh.user_id = ? AND uh.symbol = ?
            ''', (interaction.user.id, self.symbol))
            
            holding = cursor.fetchone()
            
            if not holding:
                await interaction.response.send_message("❌ 보유 중인 코인이 아닙니다.", ephemeral=True)
                conn.close()
                return
            
            owned_quantity, avg_price, current_price, name = holding
            
            # 수량 처리
            if self.quantity_input.value.lower() == "all":
                quantity = owned_quantity
            else:
                quantity = float(self.quantity_input.value)
            
            if quantity <= 0:
                await interaction.response.send_message("❌ 수량은 0보다 커야 합니다.", ephemeral=True)
                conn.close()
                return
            
            if quantity > owned_quantity:
                await interaction.response.send_message(
                    f"❌ 보유 수량({owned_quantity:.4f}개)보다 많이 판매할 수 없습니다.", 
                    ephemeral=True
                )
                conn.close()
                return
            
            # 판매 금액 계산
            gross_amount = int(quantity * current_price)
            
            # 수수료 계산
            bank = self.cog.get_bank_system()
            if bank:
                fee_rate = bank.get_tax_rate('gamecenter_fee')
            else:
                fee_rate = 5.0
            
            fee = int(gross_amount * (fee_rate / 100))
            net_amount = gross_amount - fee
            
            # 손익 계산
            buy_cost = quantity * avg_price
            profit = net_amount - buy_cost
            profit_percent = (profit / buy_cost) * 100
            
            # 보유 수량 업데이트
            new_quantity = owned_quantity - quantity
            
            if new_quantity <= 0.0001:  # 거의 0에 가까우면 삭제
                cursor.execute('''
                    DELETE FROM user_ditocoins
                    WHERE user_id = ? AND symbol = ?
                ''', (interaction.user.id, self.symbol))
            else:
                cursor.execute('''
                    UPDATE user_ditocoins
                    SET quantity = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = ? AND symbol = ?
                ''', (new_quantity, interaction.user.id, self.symbol))
            
            # 거래 내역 저장
            cursor.execute('''
                INSERT INTO ditocoin_transactions 
                (user_id, symbol, transaction_type, quantity, price, total_amount, fee)
                VALUES (?, ?, 'SELL', ?, ?, ?, ?)
            ''', (interaction.user.id, self.symbol, quantity, current_price, gross_amount, fee))
            
            conn.commit()
            conn.close()
            
            # 토피 지급
            new_balance = self.cog.update_balance(
                interaction.user.id,
                interaction.user.display_name,
                net_amount,
                f"디토코인 매도: {self.symbol} {quantity}개"
            )
            
            # 성공 메시지
            embed = discord.Embed(
                title="✅ 매도 완료",
                color=0xe74c3c,
                timestamp=datetime.now()
            )
            embed.add_field(name="코인", value=f"{self.symbol} ({name})", inline=True)
            embed.add_field(name="수량", value=f"{quantity:.4f}개", inline=True)
            embed.add_field(name="단가", value=f"{current_price:,} 토피", inline=True)
            embed.add_field(name="판매금액", value=f"{gross_amount:,} 토피", inline=True)
            embed.add_field(name="수수료", value=f"{fee:,} 토피 ({fee_rate}%)", inline=True)
            embed.add_field(name="실수령액", value=f"{net_amount:,} 토피", inline=True)
            
            profit_emoji = "📈" if profit >= 0 else "📉"
            profit_color = "🟢" if profit >= 0 else "🔴"
            embed.add_field(
                name=f"{profit_emoji} 손익", 
                value=f"{profit_color} {profit:+,.0f} 토피 ({profit_percent:+.2f}%)", 
                inline=True
            )
            embed.add_field(name="현재 잔액", value=f"{new_balance:,} 토피", inline=True)
            
            if new_quantity > 0.0001:
                embed.add_field(name="남은 수량", value=f"{new_quantity:.4f}개", inline=True)
            
            embed.set_footer(text="💎 디토코인 거래소")
            
            await interaction.response.send_message(embed=embed, ephemeral=True)
            
            # 거래 기록 채널에 알림
            if self.cog.history_channel_id:
                history_channel = self.cog.bot.get_channel(self.cog.history_channel_id)
                if history_channel:
                    history_embed = discord.Embed(
                        title="💸 매도 거래 발생",
                        color=0xe74c3c,
                        timestamp=datetime.now()
                    )
                    history_embed.add_field(name="유저", value=interaction.user.mention, inline=True)
                    history_embed.add_field(name="코인", value=self.symbol, inline=True)
                    history_embed.add_field(name="수량", value=f"{quantity:.4f}개", inline=True)
                    history_embed.add_field(name="단가", value=f"{current_price:,} 토피", inline=True)
                    history_embed.add_field(name="총액", value=f"{gross_amount:,} 토피", inline=True)
                    history_embed.add_field(name="손익", value=f"{profit:+,.0f} 토피", inline=True)
                    
                    await history_channel.send(embed=history_embed)
            
        except ValueError:
            await interaction.response.send_message("❌ 올바른 숫자를 입력해주세요.", ephemeral=True)
        except Exception as e:
            await interaction.response.send_message(f"❌ 오류가 발생했습니다: {str(e)}", ephemeral=True)


async def setup(bot):
    await bot.add_cog(DitoCoinMarket(bot))