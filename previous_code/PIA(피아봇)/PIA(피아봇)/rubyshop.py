# rubyshop.py
import discord
from discord.ext import commands
from discord import app_commands
import sqlite3
from datetime import datetime
import config

class RubyShopSystem(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        
    @commands.Cog.listener()
    async def on_ready(self):
        """봇이 준비되면 데이터베이스 초기화"""
        self.init_database()
        print("RubyShopSystem: 루비 상점 시스템이 준비되었습니다.")
    
    def get_db_connection(self):
        """데이터베이스 연결 반환"""
        return sqlite3.connect(config.DATABASE_FILE)
    
    def init_database(self):
        """데이터베이스 테이블 초기화"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        # 루비 상점 아이템 테이블
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS ruby_shop_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                role_id INTEGER NOT NULL,
                price INTEGER NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # 루비 상점 구매 기록 테이블
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS ruby_shop_purchases (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                item_name TEXT NOT NULL,
                role_id INTEGER NOT NULL,
                price INTEGER NOT NULL,
                purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        conn.commit()
        conn.close()
    
    def is_shop_admin(self, user):
        """루비 상점 관리자 권한 확인"""
        return any(role.id in config.SHOP_ADMIN_ROLES for role in user.roles)
    
    def get_user_ruby_balance(self, user_id: int):
        """유저 루비 잔액 조회 (ruby.py에서 가져옴)"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT balance FROM user_rubies WHERE user_id = ?', (user_id,))
        result = cursor.fetchone()
        conn.close()
        
        return result[0] if result else 0
    
    def update_user_ruby_balance(self, user_id: int, username: str, amount: int, reason: str = None, transaction_type: str = "ruby_shop"):
        """유저 루비 잔액 업데이트 (ruby.py 함수 호출)"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        # 유저 초기화
        cursor.execute('''
            INSERT OR IGNORE INTO user_rubies (user_id, username, balance)
            VALUES (?, ?, 0)
        ''', (user_id, username))
        
        # 유저명 업데이트
        cursor.execute('''
            UPDATE user_rubies SET username = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE user_id = ?
        ''', (username, user_id))
        
        # 현재 잔액 조회
        current_balance = self.get_user_ruby_balance(user_id)
        new_balance = current_balance + amount
        
        # 잔액이 음수가 되지 않도록 체크
        if new_balance < 0:
            new_balance = 0
            amount = -current_balance
        
        # 잔액 업데이트
        cursor.execute('''
            UPDATE user_rubies 
            SET balance = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE user_id = ?
        ''', (new_balance, user_id))
        
        # 거래 기록
        cursor.execute('''
            INSERT INTO ruby_transactions 
            (user_id, admin_id, transaction_type, amount, reason, balance_after)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (user_id, None, transaction_type, amount, reason, new_balance))
        
        conn.commit()
        conn.close()
        
        return new_balance
    
    async def send_ruby_shop_notification(self, action: str, item_name: str, role: discord.Role = None, price: int = None, description: str = None):
        """루비 상점 알림 전송"""
        if not hasattr(config, 'RUBY_SHOP_NOTIFICATION_CHANNEL_ID') or not config.RUBY_SHOP_NOTIFICATION_CHANNEL_ID:
            return
        
        channel = self.bot.get_channel(config.RUBY_SHOP_NOTIFICATION_CHANNEL_ID)
        if not channel:
            return
        
        # 상품 업데이트 역할 멘션
        mention_text = ""
        if hasattr(config, 'RUBY_SHOP_UPDATE_ROLE_ID') and config.RUBY_SHOP_UPDATE_ROLE_ID:
            mention_text = f"<@&{config.RUBY_SHOP_UPDATE_ROLE_ID}>"
        
        color_map = {
            "추가": 0x00ff00,
            "변경": 0xffaa00,
            "삭제": 0xff0000
        }
        
        embed = discord.Embed(
            title=f"💎 루비 상점 상품 {action}",
            color=color_map.get(action, 0x0099ff),
            timestamp=datetime.now()
        )
        
        embed.add_field(name="상품명", value=item_name, inline=True)
        if role:
            embed.add_field(name="지급 역할", value=role.mention, inline=True)
        if price is not None:
            embed.add_field(name="가격", value=f"{price:,} 루비", inline=True)
        if description:
            embed.add_field(name="설명", value=description, inline=False)
        
        try:
            if mention_text:
                await channel.send(content=mention_text, embed=embed)
            else:
                await channel.send(embed=embed)
        except Exception as e:
            pass
    
    # 루비 상점 관리 명령어
    @app_commands.command(name="루비상점관리", description="루비상점 아이템을 관리합니다")
    @app_commands.describe(
        액션="수행할 작업 (물품추가/물품삭제/물품변경)",
        물품명="아이템 이름",
        지급할역할="구매시 지급할 역할",
        가격="아이템 가격 (루비)",
        설명="아이템 설명"
    )
    @app_commands.choices(액션=[
        app_commands.Choice(name="물품추가", value="add"),
        app_commands.Choice(name="물품삭제", value="delete"),
        app_commands.Choice(name="물품변경", value="edit")
    ])
    async def ruby_shop_manage(self, interaction: discord.Interaction, 액션: str, 물품명: str, 지급할역할: discord.Role = None, 가격: int = None, 설명: str = None):
        # 권한 확인
        if not self.is_shop_admin(interaction.user):
            await interaction.response.send_message("❌ 루비 상점 관리자만 사용할 수 있는 명령어입니다.", ephemeral=True)
            return
        
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        if 액션 == "add":
            # 물품 추가
            if not 지급할역할 or 가격 is None or 가격 <= 0:
                await interaction.response.send_message("❌ 물품 추가 시 역할, 가격(양수)이 필요합니다.", ephemeral=True)
                return
            
            try:
                cursor.execute('''
                    INSERT INTO ruby_shop_items (name, role_id, price, description)
                    VALUES (?, ?, ?, ?)
                ''', (물품명, 지급할역할.id, 가격, 설명))
                
                conn.commit()
                
                embed = discord.Embed(
                    title="✅ 루비 상품 추가 완료",
                    color=0x00ff00,
                    timestamp=datetime.now()
                )
                embed.add_field(name="상품명", value=물품명, inline=True)
                embed.add_field(name="지급 역할", value=지급할역할.mention, inline=True)
                embed.add_field(name="가격", value=f"{가격:,} 루비", inline=True)
                if 설명:
                    embed.add_field(name="설명", value=설명, inline=False)
                embed.set_footer(text=f"관리자: {interaction.user.display_name}")
                
                await interaction.response.send_message(embed=embed)
                await self.send_ruby_shop_notification("추가", 물품명, 지급할역할, 가격, 설명)
                
            except sqlite3.IntegrityError:
                await interaction.response.send_message("❌ 이미 존재하는 상품명입니다.", ephemeral=True)
        
        elif 액션 == "delete":
            # 물품 삭제
            cursor.execute('SELECT * FROM ruby_shop_items WHERE name = ?', (물품명,))
            item = cursor.fetchone()
            
            if not item:
                await interaction.response.send_message("❌ 존재하지 않는 상품입니다.", ephemeral=True)
                conn.close()
                return
            
            cursor.execute('DELETE FROM ruby_shop_items WHERE name = ?', (물품명,))
            conn.commit()
            
            embed = discord.Embed(
                title="🗑️ 루비 상품 삭제 완료",
                color=0xff0000,
                timestamp=datetime.now()
            )
            embed.add_field(name="삭제된 상품", value=물품명, inline=False)
            embed.set_footer(text=f"관리자: {interaction.user.display_name}")
            
            await interaction.response.send_message(embed=embed)
            await self.send_ruby_shop_notification("삭제", 물품명)
        
        elif 액션 == "edit":
            # 물품 변경
            cursor.execute('SELECT * FROM ruby_shop_items WHERE name = ?', (물품명,))
            item = cursor.fetchone()
            
            if not item:
                await interaction.response.send_message("❌ 존재하지 않는 상품입니다.", ephemeral=True)
                conn.close()
                return
            
            # 변경할 필드들 확인
            updates = []
            params = []
            
            if 지급할역할:
                updates.append("role_id = ?")
                params.append(지급할역할.id)
            
            if 가격 is not None:
                if 가격 <= 0:
                    await interaction.response.send_message("❌ 가격은 양수여야 합니다.", ephemeral=True)
                    conn.close()
                    return
                updates.append("price = ?")
                params.append(가격)
            
            if 설명 is not None:
                updates.append("description = ?")
                params.append(설명)
            
            if not updates:
                await interaction.response.send_message("❌ 변경할 내용이 없습니다.", ephemeral=True)
                conn.close()
                return
            
            updates.append("updated_at = CURRENT_TIMESTAMP")
            params.append(물품명)
            
            query = f"UPDATE ruby_shop_items SET {', '.join(updates)} WHERE name = ?"
            cursor.execute(query, params)
            conn.commit()
            
            embed = discord.Embed(
                title="✏️ 루비 상품 변경 완료",
                color=0xffaa00,
                timestamp=datetime.now()
            )
            embed.add_field(name="상품명", value=물품명, inline=True)
            if 지급할역할:
                embed.add_field(name="새 역할", value=지급할역할.mention, inline=True)
            if 가격 is not None:
                embed.add_field(name="새 가격", value=f"{가격:,} 루비", inline=True)
            if 설명 is not None:
                embed.add_field(name="새 설명", value=설명, inline=False)
            embed.set_footer(text=f"관리자: {interaction.user.display_name}")
            
            await interaction.response.send_message(embed=embed)
            await self.send_ruby_shop_notification("변경", 물품명, 지급할역할, 가격, 설명)
        
        conn.close()
    
    # 루비 상점 명령어
    @app_commands.command(name="루비상점", description="루비상점에서 아이템을 구매하거나 목록을 확인합니다")
    @app_commands.describe(
        액션="수행할 작업 (구매/목록)",
        물품명="구매할 아이템 이름 (구매 시 필요)"
    )
    @app_commands.choices(액션=[
        app_commands.Choice(name="구매", value="buy"),
        app_commands.Choice(name="목록", value="list")
    ])
    async def ruby_shop(self, interaction: discord.Interaction, 액션: str, 물품명: str = None):
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        if 액션 == "list":
            # 루비 상점 목록 조회
            cursor.execute('SELECT name, role_id, price, description FROM ruby_shop_items ORDER BY price')
            items = cursor.fetchall()
            
            if not items:
                embed = discord.Embed(
                    title="💎 루비 상점",
                    description="현재 판매 중인 상품이 없습니다.",
                    color=0xe74c3c
                )
            else:
                embed = discord.Embed(
                    title="💎 루비 상점 목록",
                    color=0xe74c3c,
                    timestamp=datetime.now()
                )
                
                for name, role_id, price, description in items:
                    role = interaction.guild.get_role(role_id)
                    role_name = role.name if role else "알 수 없는 역할"
                    
                    field_value = f"**가격:** {price:,} 루비\n**역할:** {role_name}"
                    if description:
                        field_value += f"\n**설명:** {description}"
                    
                    embed.add_field(name=name, value=field_value, inline=False)
                
                # 현재 루비 잔액 표시
                balance = self.get_user_ruby_balance(interaction.user.id)
                embed.set_footer(text=f"현재 루비 잔액: {balance:,} 루비")
            
            await interaction.response.send_message(embed=embed, ephemeral=True)
        
        elif 액션 == "buy":
            # 상품 구매
            if not 물품명:
                await interaction.response.send_message("❌ 구매할 상품명을 입력해주세요.", ephemeral=True)
                conn.close()
                return
            
            # 상품 조회
            cursor.execute('SELECT name, role_id, price, description FROM ruby_shop_items WHERE name = ?', (물품명,))
            item = cursor.fetchone()
            
            if not item:
                await interaction.response.send_message("❌ 존재하지 않는 상품입니다.", ephemeral=True)
                conn.close()
                return
            
            name, role_id, price, description = item
            role = interaction.guild.get_role(role_id)
            
            if not role:
                await interaction.response.send_message("❌ 해당 상품의 역할을 찾을 수 없습니다.", ephemeral=True)
                conn.close()
                return
            
            # 이미 역할을 가지고 있는지 확인
            if role in interaction.user.roles:
                await interaction.response.send_message("❌ 이미 해당 역할을 보유하고 있습니다.", ephemeral=True)
                conn.close()
                return
            
            # 루비 잔액 확인
            balance = self.get_user_ruby_balance(interaction.user.id)
            if balance < price:
                embed = discord.Embed(
                    title="❌ 루비 잔액 부족",
                    color=0xe74c3c,
                    timestamp=datetime.now()
                )
                embed.add_field(name="상품 가격", value=f"{price:,} 루비", inline=True)
                embed.add_field(name="현재 잔액", value=f"{balance:,} 루비", inline=True)
                embed.add_field(name="부족 금액", value=f"{price - balance:,} 루비", inline=True)
                
                await interaction.response.send_message(embed=embed, ephemeral=True)
                conn.close()
                return
            
            # 구매 처리
            try:
                # 역할 지급
                await interaction.user.add_roles(role)
                
                # 루비 차감
                new_balance = self.update_user_ruby_balance(
                    interaction.user.id,
                    interaction.user.display_name,
                    -price,
                    f"루비 상점 구매: {name}",
                    "ruby_shop_purchase"
                )
                
                # 구매 기록
                cursor.execute('''
                    INSERT INTO ruby_shop_purchases (user_id, item_name, role_id, price)
                    VALUES (?, ?, ?, ?)
                ''', (interaction.user.id, name, role_id, price))
                
                conn.commit()
                
                embed = discord.Embed(
                    title="✅ 루비 상점 구매 완료!",
                    color=0x27ae60,
                    timestamp=datetime.now()
                )
                embed.add_field(name="구매 상품", value=name, inline=True)
                embed.add_field(name="지급된 역할", value=role.mention, inline=True)
                embed.add_field(name="결제 금액", value=f"{price:,} 루비", inline=True)
                embed.add_field(name="남은 잔액", value=f"{new_balance:,} 루비", inline=True)
                if description:
                    embed.add_field(name="상품 설명", value=description, inline=False)
                embed.set_thumbnail(url=interaction.user.display_avatar.url)
                embed.set_footer(text="💎 Ruby Shop System")
                
                await interaction.response.send_message(embed=embed)
                
            except discord.Forbidden:
                await interaction.response.send_message("❌ 역할을 지급할 권한이 없습니다. 관리자에게 문의하세요.", ephemeral=True)
            except Exception as e:
                await interaction.response.send_message("❌ 구매 중 오류가 발생했습니다.", ephemeral=True)
        
        conn.close()

async def setup(bot):
    await bot.add_cog(RubyShopSystem(bot))