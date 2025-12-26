import discord
from discord.ext import commands
import os
from dotenv import load_dotenv

load_dotenv()

TOKEN = os.getenv("DISCORD_TOKEN")
ADMIN_ROLE_IDS = [int(x) for x in os.getenv("ADMIN_ROLE_IDS", "").split(",") if x]

intents = discord.Intents.default()
intents.guilds = True
intents.members = True
intents.messages = True
intents.message_content = True

class SecureBot(commands.Bot):
    async def is_admin(self, ctx):
        m = ctx.author if hasattr(ctx, "author") else ctx.user
        if m.guild_permissions.administrator:
            return True
        return any(r.id in ADMIN_ROLE_IDS for r in m.roles)

bot = SecureBot(command_prefix="!", intents=intents)

@bot.event
async def on_ready():
    for f in os.listdir("./cogs"):
        if f.endswith(".py"):
            await bot.load_extension(f"cogs.{f[:-3]}")

bot.run(TOKEN)
