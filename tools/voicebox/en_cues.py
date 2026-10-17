# 英文版「1 分鐘認識我」的 cues：用 whisper 逐字時間戳量出旁白念到各 anchor 詞的秒數，改寫幕稿的 cues。
#
#   uv run --with mlx-whisper python tools/voicebox/en_cues.py [幕 id ...]
#     → 讀 explainer/en/audio/<幕>.mp3，改寫 explainer/en/script.js
#   uv run --with mlx-whisper python tools/voicebox/en_cues.py --audio variants/snake/explainer/en --json variants/snake/explainer/en/cues.json intro
#     → Snake 版英文開場：量 Snake 的 intro.mp3，寫成 build-variant 用的 cues.json（不動幕稿）
#
# anchors 依序往後找（同一個詞出現兩次也不會對錯），找不到就停下來報錯。
# 數字詞 whisper 常聽寫成阿拉伯數字（sixteen → 16），兩種都認。
import json, os, re, subprocess, sys
import mlx_whisper

ASR = "mlx-community/whisper-large-v3-turbo"
root = os.path.join(os.path.dirname(__file__), "../..")
SCRIPT = os.path.join(root, "explainer/en/script.js")
DIGITS = {"one": "1", "twelve": "12", "sixteen": "16", "sixty": "60"}

args = sys.argv[1:]
opt = lambda f: args[args.index(f) + 1] if f in args else None
audio_dir = os.path.join(root, opt("--audio") or "explainer/en", "audio")
json_out = opt("--json")
only = [a for i, a in enumerate(args) if not a.startswith("--") and (i == 0 or args[i - 1] not in ("--audio", "--json"))]

norm = lambda w: re.sub(r"[^a-z0-9]", "", w.lower())
scenes = json.loads(subprocess.check_output(["node", "-e", "console.log(JSON.stringify(require('./explainer/en/script.js').SCENES))"], cwd=root))
src = open(SCRIPT).read()
result = {}

for s in scenes:
    if only and s["id"] not in only:
        continue
    mp3 = os.path.join(audio_dir, s["id"] + ".mp3")
    r = mlx_whisper.transcribe(mp3, path_or_hf_repo=ASR, language="en", word_timestamps=True)
    words = [(norm(w["word"]), w["start"]) for seg in r["segments"] for w in seg["words"]]
    words = [w for w in words if w[0]]
    cues, pos = {}, 0
    for key, anchor in s["anchors"].items():
        targets = {norm(anchor), DIGITS.get(norm(anchor), norm(anchor))}
        for i in range(pos, len(words)):
            # 連字號的詞（e-commerce、load-test）whisper 可能拆成兩個字：把後面幾個字接起來比
            joined = "".join(w for w, _ in words[i:i + 3])
            if words[i][0] in targets or any(joined.startswith(t) and len(t) > 3 for t in targets):
                cues[key] = 0 if not cues else round(words[i][1], 2)
                pos = i + 1
                break
        else:
            sys.exit(f"{s['id']}: 找不到 anchor「{anchor}」（{key}），聽到的是：{r['text']}")
    print(f"{s['id']}: {cues}")
    result[s["id"]] = cues
    if not json_out:
        body = ", ".join(f"{k}: {v:g}" for k, v in cues.items())
        pat = re.compile(r"(id: '" + s["id"] + r"',[\s\S]*?cues: )\{[^}]*\}")
        if not pat.search(src):
            sys.exit(f"幕稿找不到 {s['id']} 的 cues")
        src = pat.sub(lambda m: m.group(1) + "{ " + body + " }", src, count=1)

if json_out:
    path = os.path.join(root, json_out)
    old = json.load(open(path)) if os.path.exists(path) else {}
    old.update(result)
    open(path, "w").write(json.dumps(old, indent=2, ensure_ascii=False) + "\n")
    print("寫入", path)
else:
    open(SCRIPT, "w").write(src)
    print("已改寫 explainer/en/script.js 的 cues")
