#!/usr/bin/env bash
# 把芫荽（Iansui，OFL）做成動畫畫面用的字型子集：只收 explainer/explainer.js 字串裡出現的字。
# 改了畫面文字（explainer.js 裡 text() 的字串）就重跑一次。
#   tools/build-font.sh [Iansui-Regular.ttf 路徑]
# 字型原檔：github.com/ButTaiwan/iansui（releases 的 iansui.zip）；
# pyftsubset 沒有的話：pip install fonttools brotli（或 uv tool install fonttools --with brotli）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TTF="${1:-$HOME/projects/claude/temp/resume-2026/font/Iansui-Regular.ttf}"
OUT="$ROOT/explainer/iansui-explainer.woff2"
[ -f "$TTF" ] || { echo "找不到字型原檔：$TTF" >&2; exit 1; }
PYFT="$(command -v pyftsubset || ls "$HOME/.local/bin/pyftsubset" 2>/dev/null || true)"
[ -n "$PYFT" ] || { echo "缺 pyftsubset：pip install fonttools brotli" >&2; exit 1; }

# 從 explainer.js 與 script.js 抽出所有字串字面值的字元（先去掉註解），外加 ASCII 可見字元
CHARS="$(node -e '
  const fs = require("fs")
  let src = fs.readFileSync(process.argv[1], "utf8")
  src = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
  const set = new Set()
  for (const m of src.matchAll(/(["\x27])((?:\\.|(?!\1)[^\\\n])*)\1/g)) for (const ch of m[2]) set.add(ch)
  for (let c = 0x20; c < 0x7f; c++) set.add(String.fromCharCode(c))
  for (const ch of "％・·—…×→←↑↓✓") set.add(ch)
  process.stdout.write([...set].filter(ch => ch !== "\\").sort().join(""))
' "$ROOT/explainer/explainer.js")"
TMP="$(mktemp)"
printf '%s' "$CHARS" > "$TMP"
"$PYFT" "$TTF" --text-file="$TMP" --flavor=woff2 --layout-features='*' --no-hinting --output-file="$OUT"
rm -f "$TMP"
echo "字元數：$(printf '%s' "$CHARS" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log([...s].length))')"
echo "輸出：$OUT ($(du -h "$OUT" | cut -f1))"
