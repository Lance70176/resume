# 用筆電上的 Voicebox（本人聲音克隆）產生六幕旁白，whisper 聽寫後用拼音比對，
# 念錯（例如「補救」念成「保救」、「輸入法」念成「虛錄法」）就換 seed 重產，挑拼音最吻合的一條。
#
# 用法（筆電，Voicebox App 要開著；Mini 上可經 voicebox-tunnel 打同一個 localhost:17493）：
#   uv run --with mlx-whisper --with pypinyin python tools/voicebox/gen_takes.py <輸出資料夾> [--name Rex] [幕 id ...]
#   開場念的名字預設 Snake；--name Rex 產 Rex 版（原始碼 explainer/）
# 產出 <輸出資料夾>/<幕 id>.wav，再交給：
#   node tools/gen-explainer-audio.mjs --from <輸出資料夾> [--out variants/snake/explainer]
import difflib, json, os, shutil, subprocess, sys, time, urllib.request
import mlx_whisper
from pypinyin import lazy_pinyin

API = os.environ.get("VOICEBOX_URL", "http://127.0.0.1:17493")
PROFILE = os.environ.get("VOICEBOX_PROFILE", "7b9c7363-df0d-42e7-a8ac-e216345079d8")  # 「Rex 的聲音」
ASR = "mlx-community/whisper-large-v3-turbo"
SEEDS = (1, 2, 7, 42, 123, 2026)
NUM = set("零一二三四五六七八九十百點兩")  # 數字聽寫會變阿拉伯數字，比對時兩邊都略過

root = os.path.join(os.path.dirname(__file__), "../..")
scenes = json.loads(subprocess.check_output(["node", "-e", "console.log(JSON.stringify(require('./explainer/script.js').SCENES))"], cwd=root))
args = sys.argv[2:]
name = args[args.index("--name") + 1] if "--name" in args else "Snake"
out_dir, only = sys.argv[1], [a for i, a in enumerate(args) if a != "--name" and (i == 0 or args[i - 1] != "--name")]
os.makedirs(out_dir, exist_ok=True)

def pinyin(t):
    return lazy_pinyin("".join(c.lower() for c in t if ("一" <= c <= "鿿" or c.isascii() and c.isalpha()) and c not in NUM))

def call(path, body=None):
    req = urllib.request.Request(API + path, json.dumps(body).encode() if body else None, {"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req))

def generate(text, seed, wav):
    g = call("/generate", {"profile_id": PROFILE, "text": text, "language": "zh", "seed": seed})
    while (h := call(f"/history/{g['id']}"))["status"] == "generating":
        time.sleep(2)
    if h["status"] != "completed":
        raise RuntimeError(h)
    urllib.request.urlretrieve(f"{API}/audio/{g['id']}", wav)

for s in scenes:
    if only and s["id"] not in only:
        continue
    line = s["line"].replace("我是 Rex", f"我是 {name}")
    best = None
    for seed in SEEDS:
        wav = os.path.join(out_dir, f"{s['id']}.seed{seed}.wav")
        generate(line, seed, wav)
        heard = mlx_whisper.transcribe(wav, path_or_hf_repo=ASR, language="zh", initial_prompt="以下是繁體中文。")["text"]
        score = difflib.SequenceMatcher(None, pinyin(line), pinyin(heard), autojunk=False).ratio()
        print(f"{s['id']} seed={seed} 拼音吻合 {score:.2f}：{heard}", flush=True)
        if not best or score > best[0]:
            best = (score, wav)
        if score >= 0.99:
            break
    shutil.copy(best[1], os.path.join(out_dir, f"{s['id']}.wav"))
    print(f"{s['id']}: 採用 {os.path.basename(best[1])}（{best[0]:.2f}），請自己再聽一次")
