import discord
from discord.ext import commands
from discord import app_commands
from discord.ui import View, Select, Button
from datetime import datetime
import sqlite3

intents = discord.Intents.all()
bot = commands.Bot(command_prefix='!', intents=intents)


CHANNEL_WELCOME = 1428099089786212504
CHANNEL_RULES = 1428098765604257803
CHANNEL_GUIDE = 1428098826769530980
CHANNEL_INTRO = 1433194534682234941
CHANNEL_NOTICE = 1433195017010282506
CHANNEL_MANAGEMENT = 1428099866046894221
CHANNEL_HELP = 1432760322019692574
CHANNEL_ROLE_REQUEST = 1428099608214769724
CHANNEL_FAQ = 1428119346751733760
CHANNEL_CURRENCY = 1429399421539582033

ROLE_ADMIN_CALL = 1428447451521744987
ROLE_MANAGE_COUNCIL = 1437022276070543511
ROLE_KNIGHT = 1428113658097172520
ROLE_CABINET = 1428113713361064129
ROLE_EMBASSY = 1428113713638146058
ROLE_MINOR = 1428264130300739655
ROLE_ADULT = 1428264102194581504

conn = sqlite3.connect("performance.db")
cursor = conn.cursor()

cursor.execute("""CREATE TABLE IF NOT EXISTS entrance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    이름 TEXT,
    연령 TEXT,
    성별 TEXT,
    경로 TEXT,
    담당 TEXT,
    시간 TIMESTAMP
)""")
cursor.execute("""CREATE TABLE IF NOT EXISTS performance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    부서 TEXT,
    업무 TEXT,
    시간 TIMESTAMP,
    값 INTEGER
)""")
cursor.execute("""CREATE TABLE IF NOT EXISTS patrol (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    업무 TEXT,
    시작 TIMESTAMP,
    완료 TIMESTAMP,
    분 INTEGER
)""")
cursor.execute("""CREATE TABLE IF NOT EXISTS newjob (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    업무 TEXT,
    시작 TIMESTAMP,
    완료 TIMESTAMP,
    분 INTEGER
)""")
cursor.execute("""CREATE TABLE IF NOT EXISTS embassy_invite (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    초대자_id INTEGER,
    시간 TIMESTAMP
)""")
conn.commit()

patrol_start_times = {}
newjob_start_times = {}

def has_role(user: discord.Member, role_id: int):
    return any(role.id == role_id for role in user.roles)

def save_entrance(user_id, 이름, 연령, 성별, 경로, 담당):
    now = datetime.now()
    cursor.execute(
        "INSERT INTO entrance (user_id, 이름, 연령, 성별, 경로, 담당, 시간) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (user_id, 이름, 연령, 성별, 경로, 담당, now)
    )
    conn.commit()

def save_performance(user_id, 부서, 업무, 값=1):
    now = datetime.now()
    cursor.execute(
        "INSERT INTO performance (user_id, 부서, 업무, 시간, 값) VALUES (?, ?, ?, ?, ?)",
        (user_id, 부서, 업무, now, 값)
    )
    conn.commit()

def save_patrol(user_id, 업무, start_time, elapsed):
    now = datetime.now()
    cursor.execute(
        "INSERT INTO patrol (user_id, 업무, 시작, 완료, 분) VALUES (?, ?, ?, ?, ?)",
        (user_id, 업무, start_time, now, elapsed)
    )
    conn.commit()

def save_newjob(user_id, 업무, start_time, elapsed):
    now = datetime.now()
    cursor.execute(
        "INSERT INTO newjob (user_id, 업무, 시작, 완료, 분) VALUES (?, ?, ?, ?, ?)",
        (user_id, 업무, start_time, now, elapsed)
    )
    conn.commit()

def save_embassy_invite(user_id, 초대자_id):
    now = datetime.now()
    cursor.execute(
        "INSERT INTO embassy_invite (user_id, 초대자_id, 시간) VALUES (?, ?, ?)",
        (user_id, 초대자_id, now)
    )
    conn.commit()

@bot.tree.command(name="입장", description="유저 입장 기록")
@app_commands.describe(
    유저="입장하는 유저",
    이름="닉네임",
    연령="연령(년생)",
    성별="성별",
    경로="경로",
    담당="담당자"
)
async def entrance_cmd(interaction: discord.Interaction, 유저: discord.Member, 이름: str, 연령: str, 성별: str, 경로: str, 담당: discord.Member):
    guild = interaction.guild
    member_obj = guild.get_member(유저.id)

    if int(연령) > 2008:
        role = guild.get_role(ROLE_MINOR)
    else:
        role = guild.get_role(ROLE_ADULT)
    await member_obj.add_roles(role)

    save_entrance(유저.id, 이름, 연령, 성별, 경로, 담당.name)

    embed_main = discord.Embed(
        description=(
            f"**- {유저.mention} ꒰ 토피아 제국 ꒱ 에 오신 걸 환영합니다**\n"
            f"- <#{CHANNEL_RULES}> 규칙 확인\n"
            f"- <#{CHANNEL_GUIDE}> 서버 가이드\n"
            f"- <#{CHANNEL_INTRO}> 자기소개 후 관리자 태그"
        ),
        color=0x00ff00
    )
    await guild.get_channel(CHANNEL_WELCOME).send(embed=embed_main)

    embed_dm = discord.Embed(
        title="토피아 제국 안내",
        description=(
            f"• 도움 요청: <#{CHANNEL_HELP}>\n"
            f"• 역할 신청: <#{CHANNEL_ROLE_REQUEST}>\n"
            f"• FAQ: <#{CHANNEL_FAQ}>\n"
            f"• 서버 화폐: <#{CHANNEL_CURRENCY}>"
        ),
        color=0x00ff00
    )
    await 유저.send(embed=embed_dm)

    await interaction.response.send_message(f"✅ {유저.name} 입장 완료", ephemeral=True)

@bot.tree.command(name="관리국_완료업무", description="관리국 업무 완료")
@app_commands.describe(
    업무="개인평가 보고서 / 회의 보고서 / 상벌점 확인 보고서"
)
async def manage_council_task(interaction: discord.Interaction, 업무: str):
    if not has_role(interaction.user, ROLE_MANAGE_COUNCIL):
        await interaction.response.send_message("❌ 권한이 없습니다.", ephemeral=True)
        return
    save_performance(interaction.user.id, "관리국", 업무)
    await interaction.response.send_message(f"✅ {업무} 완료 기록됨", ephemeral=True)

@bot.tree.command(name="기사단_순찰시작", description="기사단 순찰 시작")
@app_commands.describe(업무="통화방 순찰 / 프로필 순찰")
async def knight_patrol_start(interaction: discord.Interaction, 업무: str):
    if not has_role(interaction.user, ROLE_KNIGHT):
        await interaction.response.send_message("❌ 권한이 없습니다.", ephemeral=True)
        return
    patrol_start_times[interaction.user.id] = datetime.now()
    await interaction.response.send_message(f"⏱ '{업무}' 순찰 시작", ephemeral=True)

@bot.tree.command(name="기사단_순찰완료", description="기사단 순찰 완료")
@app_commands.describe(업무="통화방 순찰 / 프로필 순찰")
async def knight_patrol_end(interaction: discord.Interaction, 업무: str):
    if not has_role(interaction.user, ROLE_KNIGHT):
        await interaction.response.send_message("❌ 권한이 없습니다.", ephemeral=True)
        return
    start_time = patrol_start_times.pop(interaction.user.id, None)
    if not start_time:
        await interaction.response.send_message("❌ 순찰을 먼저 시작해주세요.", ephemeral=True)
        return
    elapsed = int((datetime.now() - start_time).total_seconds() // 60)
    save_patrol(interaction.user.id, 업무, start_time, elapsed)
    await interaction.response.send_message(f"✅ '{업무}' 순찰 완료 ({elapsed}분)", ephemeral=True)

@bot.tree.command(name="내각부_뉴적방시작", description="뉴적방 시작")
async def cabinet_newjob_start(interaction: discord.Interaction):
    if not has_role(interaction.user, ROLE_CABINET):
        await interaction.response.send_message("❌ 권한이 없습니다.", ephemeral=True)
        return
    newjob_start_times[interaction.user.id] = datetime.now()
    await interaction.response.send_message("⏱ 뉴적방 시작", ephemeral=True)

@bot.tree.command(name="내각부_뉴적방완료", description="뉴적방 완료")
async def cabinet_newjob_end(interaction: discord.Interaction):
    if not has_role(interaction.user, ROLE_CABINET):
        await interaction.response.send_message("❌ 권한이 없습니다.", ephemeral=True)
        return
    start_time = newjob_start_times.pop(interaction.user.id, None)
    if not start_time:
        await interaction.response.send_message("❌ 뉴적방을 먼저 시작해주세요.", ephemeral=True)
        return
    elapsed = int((datetime.now() - start_time).total_seconds() // 60)
    save_newjob(interaction.user.id, "뉴적방", start_time, elapsed)
    await interaction.response.send_message(f"✅ 뉴적방 완료 ({elapsed}분)", ephemeral=True)

@bot.tree.command(name="사절단_초대확인", description="초대 확인")
@app_commands.describe(유저="초대한 유저")
async def embassy_invite_check(interaction: discord.Interaction, 유저: discord.Member):
    if not has_role(interaction.user, ROLE_EMBASSY):
        await interaction.response.send_message("❌ 권한이 없습니다.", ephemeral=True)
        return
    save_embassy_invite(유저.id, interaction.user.id)
    await interaction.response.send_message(f"✅ {유저.display_name} 초대 기록됨", ephemeral=True)

@bot.tree.command(name="실적확인", description="부서별 실적 확인")
@app_commands.describe(
    부서="부서 선택",
    업무="업무 선택 (선택 안 하면 전체)",
    유저="특정 유저 확인 (선택 안 하면 전체)"
)
async def check_performance(interaction: discord.Interaction, 부서: str, 업무: str = None, 유저: discord.Member = None):
    if not has_role(interaction.user, ROLE_ADMIN_CALL):
        await interaction.response.send_message("❌ 권한이 없습니다.", ephemeral=True)
        return

    query = "SELECT user_id, 업무, SUM(값) FROM performance WHERE 부서=?"
    params = [부서]

    if 업무:
        query += " AND 업무=?"
        params.append(업무)
    if 유저:
        query += " AND user_id=?"
        params.append(유저.id)
    query += " GROUP BY user_id, 업무"

    cursor.execute(query, params)
    results = cursor.fetchall()

    if not results:
        await interaction.response.send_message("❌ 실적이 없습니다.", ephemeral=True)
        return

    embed = discord.Embed(title=f"{부서} 실적 확인", color=0x00ff00)
    for uid, task, total in results:
        member = interaction.guild.get_member(uid)
        embed.add_field(name=member.display_name if member else str(uid), value=f"{task}: {total}회", inline=False)
    await interaction.response.send_message(embed=embed, ephemeral=True)
-
@bot.event
async def on_ready():
    try:
        synced = await bot.tree.sync()
        print(f"Logged in as {bot.user}")
        print(f"Synced {len(synced)} commands.")
    except Exception as e:
        print(f"Error syncing commands: {e}")

bot.run("토큰")

