# ruby_vending_machine.py
import discord
from discord.ext import commands
from discord import app_commands
import sqlite3
from datetime import datetime, timedelta
import config

class RubyVendingMachine(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        
    @commands.Cog.listener()
    async def on_ready(self):
        """봇이 준비되면 데이터베이스 초기화"""
        self.init_database()
        print("RubyVendingMachine: 루비 무인상점 시스템이 준비되었습니다.")
    
    def get_db_connection(self):
        """데이터베이스 연결 반환"""
        return sqlite3.connect(config.DATABASE_FILE)
    
    def init_database(self):
        """데이터베이스 테이블 초기화"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        # 사용자 아이템 인벤토리 테이블
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_inventory (
                user_id INTEGER NOT NULL,
                item_type TEXT NOT NULL,
                quantity INTEGER DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, item_type)
            )
        ''')
        
        # 사용자 구독 서비스 테이블
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_subscriptions (
                user_id INTEGER NOT NULL,
                subscription_type TEXT NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, subscription_type)
            )
        ''')
        
        # 루비 무인상점 구매 기록
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS vending_purchases (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                item_name TEXT NOT NULL,
                item_type TEXT NOT NULL,
                price INTEGER NOT NULL,
                currency TEXT NOT NULL,
                purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        conn.commit()
        conn.close()
    
    def get_user_ruby_balance(self, user_id: int):
        """유저 루비 잔액 조회"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT balance FROM user_rubies WHERE user_id = ?', (user_id,))
        result = cursor.fetchone()
        conn.close()
        
        return result[0] if result else 0
    
    def get_user_topy_balance(self, user_id: int):
        """유저 토피 잔액 조회"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT balance FROM user_topy WHERE user_id = ?', (user_id,))
        result = cursor.fetchone()
        conn.close()
        
        return result[0] if result else 0
    
    def update_user_ruby_balance(self, user_id: int, username: str, amount: int, reason: str):
        """유저 루비 잔액 업데이트"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT OR IGNORE INTO user_rubies (user_id, username, balance)
            VALUES (?, ?, 0)
        ''', (user_id, username))
        
        cursor.execute('''
            UPDATE user_rubies SET username = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE user_id = ?
        ''', (username, user_id))
        
        current_balance = self.get_user_ruby_balance(user_id)
        new_balance = max(0, current_balance + amount)
        
        cursor.execute('''
            UPDATE user_rubies 
            SET balance = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE user_id = ?
        ''', (new_balance, user_id))
        
        cursor.execute('''
            INSERT INTO ruby_transactions 
            (user_id, admin_id, transaction_type, amount, reason, balance_after)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (user_id, None, "vending_purchase", amount, reason, new_balance))
        
        conn.commit()
        conn.close()
        
        return new_balance
    
    def update_user_topy_balance(self, user_id: int, username: str, amount: int, reason: str):
        """유저 토피 잔액 업데이트"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT OR IGNORE INTO user_topy (user_id, username, balance)
            VALUES (?, ?, 0)
        ''', (user_id, username))
        
        current_balance = self.get_user_topy_balance(user_id)
        new_balance = max(0, current_balance + amount)
        
        cursor.execute('''
            UPDATE user_topy 
            SET balance = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE user_id = ?
        ''', (new_balance, user_id))
        
        conn.commit()
        conn.close()
        
        return new_balance
    
    def add_user_item(self, user_id: int, item_type: str, quantity: int = 1):
        """유저 아이템 추가"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO user_inventory (user_id, item_type, quantity)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id, item_type) 
            DO UPDATE SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP
        ''', (user_id, item_type, quantity, quantity))
        
        conn.commit()
        conn.close()
    
    def add_user_subscription(self, user_id: int, subscription_type: str, duration_days: int):
        """유저 구독 서비스 추가"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT expires_at FROM user_subscriptions 
            WHERE user_id = ? AND subscription_type = ?
        ''', (user_id, subscription_type))
        
        result = cursor.fetchone()
        
        if result:
            current_expires = datetime.fromisoformat(result[0])
            if current_expires > datetime.now():
                new_expires = current_expires + timedelta(days=duration_days)
            else:
                new_expires = datetime.now() + timedelta(days=duration_days)
            
            cursor.execute('''
                UPDATE user_subscriptions 
                SET expires_at = ? 
                WHERE user_id = ? AND subscription_type = ?
            ''', (new_expires, user_id, subscription_type))
        else:
            new_expires = datetime.now() + timedelta(days=duration_days)
            cursor.execute('''
                INSERT INTO user_subscriptions (user_id, subscription_type, expires_at)
                VALUES (?, ?, ?)
            ''', (user_id, subscription_type, new_expires))
        
        conn.commit()
        conn.close()
        
        return new_expires
    
    def get_user_item_quantity(self, user_id: int, item_type: str):
        """유저 아이템 수량 조회"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT quantity FROM user_inventory 
            WHERE user_id = ? AND item_type = ?
        ''', (user_id, item_type))
        
        result = cursor.fetchone()
        conn.close()
        
        return result[0] if result else 0
    
    def get_user_subscription(self, user_id: int, subscription_type: str):
        """유저 구독 정보 조회"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT expires_at FROM user_subscriptions 
            WHERE user_id = ? AND subscription_type = ?
        ''', (user_id, subscription_type))
        
        result = cursor.fetchone()
        conn.close()
        
        if result:
            expires_at = datetime.fromisoformat(result[0])
            if expires_at > datetime.now():
                return expires_at
        
        return None
    
    @app_commands.command(name="루비무인상점", description="루비 무인상점을 엽니다")
    @app_commands.checks.has_permissions(administrator=True)
    async def vending_machine(self, interaction: discord.Interaction):
        """루비 무인상점 메인 메뉴"""
        embed = discord.Embed(
            title="🪙 Ruby auto Vending",
            description="루비 상점입니다! 하단의 버튼메뉴를 상호작용 해보세요!",
            color=0xe74c3c,
            timestamp=datetime.now()
        )
        
        view = MainMenuView(self)
        await interaction.response.send_message(embed=embed, view=view)

class MainMenuView(discord.ui.View):
    def __init__(self, cog):
        super().__init__(timeout=None)
        self.cog = cog
    
    @discord.ui.button(label="제품소개", style=discord.ButtonStyle.primary, emoji="📋")
    async def product_info_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        """제품 소개"""
        embed = discord.Embed(
            title="🪙 루비 무인상점",
            description="원하시는 버튼을 클릭하여 결제해주세요.",
            color=0xe74c3c,
            timestamp=datetime.now()
        )
        
        embed.add_field(
            name="📋 제품 목록",
            value=(
                "🌙 **프리미엄 잠수방 1개월 이용권**\n"
                "└10루비 (or 5,000토피)\n\n"
                "⚠️ **경고차감권 1개**\n"
                "└40루비\n\n"
                "🎨 **색상변경권 1개**\n"
                "└20루비 (or 10,000토피)\n\n"
                "⚡ **활동 부스트권 일주일 1.5배**\n"
                "└10루비\n\n"
                "🎮 **게임센터 수수료 10% 감면권 3개**\n"
                "└05루비\n\n"
                "💰 **세금 3.3% 면제권 1개**\n"
                "└10루비\n\n"
                "🦁 **디토뱅크 실버금고 1개월 이용권**\n"
                "└10루비\n\n"
                "💎 **디토뱅크 골드금고 1개월 이용권**\n"
                "└15루비"
            ),
            inline=False
        )
        
        await interaction.response.send_message(embed=embed, ephemeral=True)
    
    @discord.ui.button(label="구매", style=discord.ButtonStyle.success, emoji="🛒")
    async def purchase_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        """구매 메뉴"""
        ruby_balance = self.cog.get_user_ruby_balance(interaction.user.id)
        topy_balance = self.cog.get_user_topy_balance(interaction.user.id)
        
        embed = discord.Embed(
            title="🛒 구매하기",
            description="드롭다운에서 구매하실 물품을 선택해주세요.",
            color=0x27ae60,
            timestamp=datetime.now()
        )
        
        embed.add_field(
            name="현재 보유 잔액",
            value=f"💎 루비: {ruby_balance:,}\n🪙 토피: {topy_balance:,}",
            inline=False
        )
        
        view = PurchaseView(self.cog)
        await interaction.response.send_message(embed=embed, view=view, ephemeral=True)
    
    @discord.ui.button(label="내정보", style=discord.ButtonStyle.secondary, emoji="👤")
    async def my_info_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        """내 정보 조회"""
        ruby_balance = self.cog.get_user_ruby_balance(interaction.user.id)
        topy_balance = self.cog.get_user_topy_balance(interaction.user.id)
        
        embed = discord.Embed(
            title="👤 내 정보",
            color=0x3498db,
            timestamp=datetime.now()
        )
        
        embed.add_field(
            name="💰 보유 잔액",
            value=f"💎 루비: {ruby_balance:,}\n🪙 토피: {topy_balance:,}",
            inline=False
        )
        
        # 보유 아이템 조회
        items = []
        warning_count = self.cog.get_user_item_quantity(interaction.user.id, 'warning_removal')
        if warning_count > 0:
            items.append(f"⚠️ 경고차감권: {warning_count}개")
        
        fee_count = self.cog.get_user_item_quantity(interaction.user.id, 'game_fee_discount')
        if fee_count > 0:
            items.append(f"🎮 게임수수료감면권: {fee_count}개")
        
        tax_count = self.cog.get_user_item_quantity(interaction.user.id, 'tax_exemption')
        if tax_count > 0:
            items.append(f"💰 세금면제권: {tax_count}개")
        
        if items:
            embed.add_field(name="📦 보유 아이템", value="\n".join(items), inline=False)
        else:
            embed.add_field(name="📦 보유 아이템", value="보유한 아이템이 없습니다.", inline=False)
        
        # 구독 서비스 조회
        subscriptions = []
        
        premium_exp = self.cog.get_user_subscription(interaction.user.id, 'premium_afk')
        if premium_exp:
            subscriptions.append(f"🌙 프리미엄 잠수방: {premium_exp.strftime('%Y-%m-%d %H:%M')}까지")
        
        boost_exp = self.cog.get_user_subscription(interaction.user.id, 'activity_boost')
        if boost_exp:
            subscriptions.append(f"⚡ 활동 부스트: {boost_exp.strftime('%Y-%m-%d %H:%M')}까지")
        
        silver_exp = self.cog.get_user_subscription(interaction.user.id, 'silver_vault')
        if silver_exp:
            subscriptions.append(f"🦁 실버금고: {silver_exp.strftime('%Y-%m-%d %H:%M')}까지")
        
        gold_exp = self.cog.get_user_subscription(interaction.user.id, 'gold_vault')
        if gold_exp:
            subscriptions.append(f"💎 골드금고: {gold_exp.strftime('%Y-%m-%d %H:%M')}까지")
        
        if subscriptions:
            embed.add_field(name="🎫 구독 서비스", value="\n".join(subscriptions), inline=False)
        else:
            embed.add_field(name="🎫 구독 서비스", value="활성화된 구독이 없습니다.", inline=False)
        
        embed.set_thumbnail(url=interaction.user.display_avatar.url)
        
        await interaction.response.send_message(embed=embed, ephemeral=True)

class PurchaseView(discord.ui.View):
    def __init__(self, cog):
        super().__init__(timeout=300)
        self.cog = cog
        self.add_item(ProductSelectMenu(cog))

class ProductSelectMenu(discord.ui.Select):
    def __init__(self, cog):
        self.cog = cog
        
        options = [
            discord.SelectOption(
                label="프리미엄 잠수방 1개월",
                description="10루비 (or 5,000토피)",
                emoji="🌙",
                value="premium_afk"
            ),
            discord.SelectOption(
                label="경고차감권 1개",
                description="40루비",
                emoji="⚠️",
                value="warning_removal"
            ),
            discord.SelectOption(
                label="색상변경권 1개",
                description="20루비 (or 10,000토피)",
                emoji="🎨",
                value="color_change"
            ),
            discord.SelectOption(
                label="활동 부스트권 일주일 1.5배",
                description="10루비",
                emoji="⚡",
                value="activity_boost"
            ),
            discord.SelectOption(
                label="게임센터 수수료 감면권 3개",
                description="05루비",
                emoji="🎮",
                value="game_fee_discount"
            ),
            discord.SelectOption(
                label="세금 면제권 1개",
                description="10루비",
                emoji="💰",
                value="tax_exemption"
            ),
            discord.SelectOption(
                label="실버금고 1개월",
                description="10루비",
                emoji="🦁",
                value="silver_vault"
            ),
            discord.SelectOption(
                label="골드금고 1개월",
                description="15루비",
                emoji="💎",
                value="gold_vault"
            ),
        ]
        
        super().__init__(
            placeholder="구매할 제품을 선택해주세요...",
            options=options,
            custom_id="product_select"
        )
    
    async def callback(self, interaction: discord.Interaction):
        product_id = self.values[0]
        
        # 상품 정보 매핑
        products = {
            "premium_afk": {
                "name": "프리미엄 잠수방 1개월 이용권",
                "ruby_price": 10,
                "topy_price": 5000,
                "type": "subscription",
                "duration": 30,
                "emoji": "🌙"
            },
            "warning_removal": {
                "name": "경고차감권 1개",
                "ruby_price": 40,
                "topy_price": None,
                "type": "item",
                "quantity": 1,
                "emoji": "⚠️"
            },
            "color_change": {
                "name": "색상변경권 1개",
                "ruby_price": 20,
                "topy_price": 10000,
                "type": "role",
                "emoji": "🎨"
            },
            "activity_boost": {
                "name": "활동 부스트권 일주일 1.5배",
                "ruby_price": 10,
                "topy_price": None,
                "type": "subscription",
                "duration": 7,
                "emoji": "⚡"
            },
            "game_fee_discount": {
                "name": "게임센터 수수료 10% 감면권 3개",
                "ruby_price": 5,
                "topy_price": None,
                "type": "item",
                "quantity": 3,
                "emoji": "🎮"
            },
            "tax_exemption": {
                "name": "세금 3.3% 면제권 1개",
                "ruby_price": 10,
                "topy_price": None,
                "type": "item",
                "quantity": 1,
                "emoji": "💰"
            },
            "silver_vault": {
                "name": "디토뱅크 실버금고 1개월 이용권",
                "ruby_price": 10,
                "topy_price": None,
                "type": "subscription",
                "duration": 30,
                "emoji": "🦁"
            },
            "gold_vault": {
                "name": "디토뱅크 골드금고 1개월 이용권",
                "ruby_price": 15,
                "topy_price": None,
                "type": "subscription",
                "duration": 30,
                "emoji": "💎"
            },
        }
        
        product = products[product_id]
        
        # 토피 옵션이 있는 경우 결제 수단 선택
        if product["topy_price"]:
            ruby_balance = self.cog.get_user_ruby_balance(interaction.user.id)
            topy_balance = self.cog.get_user_topy_balance(interaction.user.id)
            
            embed = discord.Embed(
                title=f"{product['emoji']} {product['name']}",
                description="결제 수단을 선택해주세요.",
                color=0x3498db,
                timestamp=datetime.now()
            )
            
            embed.add_field(
                name="가격",
                value=f"💎 루비: {product['ruby_price']:,}\n🪙 토피: {product['topy_price']:,}",
                inline=True
            )
            
            embed.add_field(
                name="현재 잔액",
                value=f"💎 루비: {ruby_balance:,}\n🪙 토피: {topy_balance:,}",
                inline=True
            )
            
            view = PaymentMethodView(self.cog, product_id, product)
            await interaction.response.send_message(embed=embed, view=view, ephemeral=True)
        else:
            # 루비로만 결제
            await self.process_purchase(interaction, product_id, product, "ruby")
    
    async def process_purchase(self, interaction: discord.Interaction, product_id: str, product: dict, currency: str):
        """구매 처리"""
        price = product["ruby_price"] if currency == "ruby" else product["topy_price"]
        currency_name = "루비" if currency == "ruby" else "토피"
        
        # 잔액 확인
        if currency == "ruby":
            balance = self.cog.get_user_ruby_balance(interaction.user.id)
        else:
            balance = self.cog.get_user_topy_balance(interaction.user.id)
        
        if balance < price:
            embed = discord.Embed(
                title="❌ 잔액 부족",
                description=f"{currency_name} 잔액이 부족합니다.",
                color=0xe74c3c,
                timestamp=datetime.now()
            )
            embed.add_field(name="필요 금액", value=f"{price:,} {currency_name}", inline=True)
            embed.add_field(name="현재 잔액", value=f"{balance:,} {currency_name}", inline=True)
            embed.add_field(name="부족 금액", value=f"{price - balance:,} {currency_name}", inline=True)
            
            # interaction이 이미 응답된 경우 처리
            if interaction.response.is_done():
                await interaction.followup.send(embed=embed, ephemeral=True)
            else:
                await interaction.response.send_message(embed=embed, ephemeral=True)
            return
        
        try:
            conn = self.cog.get_db_connection()
            cursor = conn.cursor()
            
            result_text = ""
            
            # 상품 타입별 처리
            if product["type"] == "subscription":
                # 구독 서비스
                expires_at = self.cog.add_user_subscription(
                    interaction.user.id,
                    product_id,
                    product["duration"]
                )
                result_text = f"만료일: {expires_at.strftime('%Y-%m-%d %H:%M')}"
                
                # 프리미엄 잠수방은 역할도 지급
                if product_id == "premium_afk":
                    if hasattr(config, 'PREMIUM_AFK_ROLE_ID'):
                        role = interaction.guild.get_role(config.PREMIUM_AFK_ROLE_ID)
                        if role and role not in interaction.user.roles:
                            await interaction.user.add_roles(role)
                
            elif product["type"] == "role":
                # 역할 지급 (색상변경권)
                if hasattr(config, 'COLOR_CHANGE_ROLE_ID'):
                    role = interaction.guild.get_role(config.COLOR_CHANGE_ROLE_ID)
                    if role:
                        if role in interaction.user.roles:
                            embed = discord.Embed(
                                title="❌ 이미 보유중",
                                description="이미 해당 역할을 보유하고 있습니다.",
                                color=0xe74c3c
                            )
                            if interaction.response.is_done():
                                await interaction.followup.send(embed=embed, ephemeral=True)
                            else:
                                await interaction.response.send_message(embed=embed, ephemeral=True)
                            conn.close()
                            return
                        await interaction.user.add_roles(role)
                        result_text = "색상변경 역할이 지급되었습니다."
                
            elif product["type"] == "item":
                # 아이템 지급
                self.cog.add_user_item(
                    interaction.user.id,
                    product_id,
                    product["quantity"]
                )
                result_text = f"{product['quantity']}개가 인벤토리에 추가되었습니다."
            
            # 잔액 차감
            if currency == "ruby":
                new_balance = self.cog.update_user_ruby_balance(
                    interaction.user.id,
                    interaction.user.display_name,
                    -price,
                    f"루비 무인상점: {product['name']}"
                )
            else:
                new_balance = self.cog.update_user_topy_balance(
                    interaction.user.id,
                    interaction.user.display_name,
                    -price,
                    f"루비 무인상점: {product['name']}"
                )
            
            # 구매 기록
            cursor.execute('''
                INSERT INTO vending_purchases (user_id, item_name, item_type, price, currency)
                VALUES (?, ?, ?, ?, ?)
            ''', (interaction.user.id, product["name"], product_id, price, currency))
            
            conn.commit()
            conn.close()
            
            # 성공 메시지
            embed = discord.Embed(
                title=f"✅ 구매 완료!",
                description=f"**{product['emoji']} {product['name']}**\n{result_text}",
                color=0x27ae60,
                timestamp=datetime.now()
            )
            
            embed.add_field(name="💳 결제 금액", value=f"{price:,} {currency_name}", inline=True)
            embed.add_field(name="💰 남은 잔액", value=f"{new_balance:,} {currency_name}", inline=True)
            
            embed.set_thumbnail(url=interaction.user.display_avatar.url)
            embed.set_footer(text="Ruby auto Vending")
            
            # interaction이 이미 응답된 경우 처리
            if interaction.response.is_done():
                await interaction.followup.send(embed=embed, ephemeral=True)
            else:
                await interaction.response.send_message(embed=embed, ephemeral=True)
            
        except Exception as e:
            embed = discord.Embed(
                title="❌ 구매 실패",
                description=f"구매 중 오류가 발생했습니다.\n{str(e)}",
                color=0xe74c3c
            )
            if interaction.response.is_done():
                await interaction.followup.send(embed=embed, ephemeral=True)
            else:
                await interaction.response.send_message(embed=embed, ephemeral=True)

class PaymentMethodView(discord.ui.View):
    def __init__(self, cog, product_id: str, product: dict):
        super().__init__(timeout=300)
        self.cog = cog
        self.product_id = product_id
        self.product = product
    
    @discord.ui.button(label="💎 루비로 구매", style=discord.ButtonStyle.success)
    async def pay_ruby_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        menu = ProductSelectMenu(self.cog)
        await menu.process_purchase(interaction, self.product_id, self.product, "ruby")
    
    @discord.ui.button(label="🪙 토피로 구매", style=discord.ButtonStyle.primary)
    async def pay_topy_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        menu = ProductSelectMenu(self.cog)
        await menu.process_purchase(interaction, self.product_id, self.product, "topy")

async def setup(bot):
    await bot.add_cog(RubyVendingMachine(bot))