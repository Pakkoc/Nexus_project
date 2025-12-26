import discord
from discord.ext import commands
from discord import ui
import mysql.connector
from datetime import timedelta

db = mysql.connector.connect(
    host="localhost",
    user="botuser",
    password="botpassword",
    database="securitybot",
    autocommit=True
)
cur = db.cursor(dictionary=True)

cur.execute("""
CREATE TABLE IF NOT EXISTS guild_settings (
    guild_id BIGINT PRIMARY KEY,
    alert_channel BIGINT,
    warn_limit INT DEFAULT 3
)
""")

cur.execute("""
CREATE TABLE IF NOT EXISTS warnings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guild_id BIGINT,
    user_id BIGINT,
    moderator BIGINT,
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
""")

cur.execute("""
CREATE TABLE IF NOT EXISTS warn_count (
    guild_id BIGINT,
    user_id BIGINT,
    count INT DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
)
""")

cur.execute("""
CREATE TABLE IF NOT EXISTS action_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guild_id BIGINT,
    target_id BIGINT,
    action VARCHAR(30),
    moderator BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
""")

class WarnManageView(ui.View):
    def __init__(self, bot, records):
        super().__init__(timeout=180)
        self.bot = bot
        self.records = records
        self.page = 0

    async def render(self, interaction):
        r = self.records[self.page]
        e = discord.Embed(
            title=f"⚠️ 경고 관리 ({self.page+1}/{len(self.records)})",
            color=discord.Color.orange()
        )
        e.add_field(name="사유", value=r["reason"], inline=False)
        e.add_field(name="관리자", value=f"<@{r['moderator']}>", inline=True)
        e.add_field(name="일시", value=str(r["created_at"]), inline=True)
        await interaction.response.edit_message(embed=e, view=self)

    @ui.button(label="◀", style=discord.ButtonStyle.secondary)
    async def prev(self, interaction: discord.Interaction, _):
        if self.page > 0:
            self.page -= 1
            await self.render(interaction)

    @ui.button(label="▶", style=discord.ButtonStyle.secondary)
    async def next(self, interaction: discord.Interaction, _):
        if self.page < len(self.records) - 1:
            self.page += 1
            await self.render(interaction)

    @ui.button(label="경고 삭제", style=discord.ButtonStyle.danger, emoji="🗑️")
    async def delete(self, interaction: discord.Interaction, _):
        if not await self.bot.is_admin(interaction):
            return
        r = self.records[self.page]
        cur.execute("DELETE FROM warnings WHERE id=%s", (r["id"],))
        cur.execute(
            "UPDATE warn_count SET count=GREATEST(count-1,0) WHERE guild_id=%s AND user_id=%s",
            (r["guild_id"], r["user_id"])
        )
        cur.execute(
            "INSERT INTO action_logs (guild_id,target_id,action,moderator) VALUES (%s,%s,'WARN_DELETE',%s)",
            (r["guild_id"], r["user_id"], interaction.user.id)
        )
        self.records.pop(self.page)
        if not self.records:
            await interaction.response.edit_message(content="모든 경고가 삭제됨", embed=None, view=None)
            return
        self.page = max(0, self.page - 1)
        await self.render(interaction)

class ActionView(ui.View):
    def __init__(self, bot, target):
        super().__init__(timeout=None)
        self.bot = bot
        self.target = target

    async def add_warn(self, guild, moderator, reason):
        cur.execute(
            "INSERT INTO warnings (guild_id,user_id,moderator,reason) VALUES (%s,%s,%s,%s)",
            (guild.id, self.target.id, moderator.id, reason)
        )
        cur.execute(
            "INSERT INTO warn_count VALUES (%s,%s,1) ON DUPLICATE KEY UPDATE count=count+1",
            (guild.id, self.target.id)
        )
        cur.execute(
            "SELECT count FROM warn_count WHERE guild_id=%s AND user_id=%s",
            (guild.id, self.target.id)
        )
        count = cur.fetchone()["count"]
        cur.execute(
            "SELECT warn_limit FROM guild_settings WHERE guild_id=%s",
            (guild.id,)
        )
        limit = cur.fetchone()["warn_limit"]
        if count >= limit:
            await self.target.timeout(discord.utils.utcnow() + timedelta(minutes=30))
            cur.execute(
                "INSERT INTO action_logs (guild_id,target_id,action,moderator) VALUES (%s,%s,'AUTO_TIMEOUT',%s)",
                (guild.id, self.target.id, moderator.id)
            )

    @ui.button(label="경고 지급", style=discord.ButtonStyle.primary, emoji="⚠️")
    async def warn(self, interaction: discord.Interaction, _):
        if not await self.bot.is_admin(interaction):
            return
        await self.add_warn(interaction.guild, interaction.user, "보안 감지")
        e = interaction.message.embeds[0]
        e.add_field(name="처리", value="경고 지급", inline=False)
        await interaction.response.edit_message(embed=e, view=None)

class Security(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    async def alert(self, guild, embed, target=None):
        cur.execute("SELECT alert_channel FROM guild_settings WHERE guild_id=%s", (guild.id,))
        r = cur.fetchone()
        if not r:
            return
        ch = guild.get_channel(r["alert_channel"])
        if ch:
            await ch.send(embed=embed, view=ActionView(self.bot, target) if target else None)

    @commands.command()
    async def warn(self, ctx, member: discord.Member, *, reason):
        if not await ctx.bot.is_admin(ctx):
            return
        cur.execute(
            "INSERT INTO warnings (guild_id,user_id,moderator,reason) VALUES (%s,%s,%s,%s)",
            (ctx.guild.id, member.id, ctx.author.id, reason)
        )
        cur.execute(
            "INSERT INTO warn_count VALUES (%s,%s,1) ON DUPLICATE KEY UPDATE count=count+1",
            (ctx.guild.id, member.id)
        )
        await ctx.reply("경고 지급 완료")

    @commands.command()
    async def warns(self, ctx, member: discord.Member):
        cur.execute(
            "SELECT * FROM warnings WHERE guild_id=%s AND user_id=%s ORDER BY created_at DESC",
            (ctx.guild.id, member.id)
        )
        rows = cur.fetchall()
        if not rows:
            await ctx.reply("경고 내역 없음")
            return
        view = WarnManageView(ctx.bot, rows)
        r = rows[0]
        e = discord.Embed(title="⚠️ 경고 관리", color=discord.Color.orange())
        e.add_field(name="사유", value=r["reason"], inline=False)
        await ctx.reply(embed=e, view=view)

    @commands.command()
    async def set_warn_limit(self, ctx, count: int):
        if not await ctx.bot.is_admin(ctx):
            return
        cur.execute(
            "INSERT INTO guild_settings (guild_id,warn_limit) VALUES (%s,%s) ON DUPLICATE KEY UPDATE warn_limit=%s",
            (ctx.guild.id, count, count)
        )
        await ctx.reply("설정 완료")

async def setup(bot):
    await bot.add_cog(Security(bot))
