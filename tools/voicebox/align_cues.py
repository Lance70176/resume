# 把 explainer/script.js 的 cues（依 Rex 版 Gemini 配音調的）換算成 Snake 版配音的秒數，
# 寫到 variants/snake/explainer/cues.json，build-variant.mjs 產 Snake 站時會整組蓋掉。
#
# 做法：兩份配音都用 whisper 取逐字時間，以拼音對齊回幕稿的每個字；
#   1. 每個 cue 在 Rex 配音裡最接近哪個字＝它的錨點字（例如 intro.years＝「十六年」）
#   2. 錨點字在 Snake 配音裡的時間，加上原 cue 與 whisper 量測的差（±0.3 秒內），就是新 cue
#   3. 原 cue 本來就落在子句起點（durations.json 的 <id>_pauses）的，改吸附到 Snake 最近的子句起點
#      （0.4 秒內）——silencedetect 量開口時間比 whisper 準
#
# 用法（先跑完 gen-explainer-audio.mjs --out variants/snake/explainer）：
#   uv run --with mlx-whisper --with pypinyin python tools/voicebox/align_cues.py
import difflib, json, os, subprocess
import mlx_whisper
from pypinyin import lazy_pinyin

ASR = "mlx-community/whisper-large-v3-turbo"
root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
rex_dir, snake_dir = os.path.join(root, "explainer"), os.path.join(root, "variants/snake/explainer")
scenes = json.loads(subprocess.check_output(["node", "-e", "console.log(JSON.stringify(require('./explainer/script.js').SCENES))"], cwd=root))
rex_dur = json.load(open(os.path.join(rex_dir, "durations.json")))
snake_dur = json.load(open(os.path.join(snake_dir, "durations.json")))
keep = lambda c: "一" <= c <= "鿿" or (c.isascii() and c.isalnum())

def char_times(line, mp3):
    """幕稿每個字在配音裡的秒數；whisper 對不上的字（多半是念成數字的部分）用前後字內插"""
    words = [w for seg in mlx_whisper.transcribe(mp3, path_or_hf_repo=ASR, language="zh", word_timestamps=True,
                                                   initial_prompt="以下是繁體中文。")["segments"] for w in seg["words"]]
    heard = []
    for w in words:
        cs = [c.lower() for c in w["word"] if keep(c)]
        heard += [(c, w["start"] + (w["end"] - w["start"]) * i / len(cs)) for i, c in enumerate(cs)]
    chars = [c.lower() for c in line if keep(c)]
    t = [None] * len(chars)
    sm = difflib.SequenceMatcher(None, [lazy_pinyin(c)[0] for c in chars], [lazy_pinyin(c)[0] for c, _ in heard], autojunk=False)
    for b in sm.get_matching_blocks():
        for k in range(b.size):
            t[b.a + k] = heard[b.b + k][1]
    known = [i for i, x in enumerate(t) if x is not None]
    for i in range(len(t)):
        if t[i] is None:
            lo = max((k for k in known if k < i), default=None)
            hi = min((k for k in known if k > i), default=None)
            t[i] = t[hi] if lo is None else t[lo] if hi is None else t[lo] + (t[hi] - t[lo]) * (i - lo) / (hi - lo)
    return chars, t

result = {}
for s in scenes:
    sid, snake_line = s["id"], s["line"].replace("我是 Rex", "我是 Snake")
    rc, rt = char_times(s["line"], os.path.join(rex_dir, "audio", f"{sid}.mp3"))
    sc, st = char_times(snake_line, os.path.join(snake_dir, "audio", f"{sid}.mp3"))
    pos = {}
    for b in difflib.SequenceMatcher(None, rc, sc, autojunk=False).get_matching_blocks():
        for k in range(b.size):
            pos[b.a + k] = b.b + k
    cues = {}
    for key, t in s["cues"].items():
        if not t:
            cues[key] = 0
            continue
        i = min(range(len(rt)), key=lambda k: abs(rt[k] - t))
        j = pos.get(i, min(pos.values(), key=lambda v: abs(v - i)))
        v = round(st[j] + max(-0.3, min(0.3, t - rt[i])), 2)
        if any(abs(t - p) <= 0.02 for p in rex_dur[f"{sid}_pauses"]):
            near = min(snake_dur[f"{sid}_pauses"], key=lambda p: abs(p - v))
            if near and abs(near - v) <= 0.4:
                v = near
        cues[key] = v
        print(f"{sid}.{key}: 錨點「{''.join(rc[i:i + 3])}」 rex {t} → snake {v}")
    vals = list(cues.values())
    assert all(a <= b for a, b in zip(vals, vals[1:])) and vals[-1] < snake_dur[sid], f"{sid} cues 不合理：{cues}"
    result[sid] = cues

with open(os.path.join(snake_dir, "cues.json"), "w") as f:
    json.dump(result, f, ensure_ascii=False, indent=2)
    f.write("\n")
print("寫入 variants/snake/explainer/cues.json")
