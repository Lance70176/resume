#!/usr/bin/env bash
# 把動畫連續幀＋配音合成一支 mp4 預覽（給自己或別人看，不用開瀏覽器），速度與網站相同。
#   tools/make-preview-video.sh <輸出資料夾> [fps=15]
#   英文版：EXPLAINER_SCRIPT=explainer/en/script.js tools/make-preview-video.sh <輸出資料夾>
# 會先跑 tools/render-preview.mjs 出每幕抽樣 PNG 與連續幀，再用 ffmpeg 把各幕 mp3 依
# durations.json＋hold 排到正確時間點，合成 <輸出資料夾>/explainer-preview.mp4。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:?輸出資料夾}"
FPS="${2:-15}"
mkdir -p "$OUT"
node "$ROOT/tools/render-preview.mjs" "$OUT" --frames "$FPS"

# 依幕稿順序：每幕 = 配音 + 停留（hold，預設 1 秒）的靜音。
# 每幕先補靜音到整幕長度（apad whole_dur，取樣點精準）轉成 wav 再串接。
# 舊做法用 concat 的 duration 去截 5 秒靜音 mp3 並不會真的截掉，音軌被撐長約 20 秒，
# 播放時跳音、斷斷續續，越後面的幕越對不上畫面。
LIST="$OUT/audio.txt"
node - "$ROOT" "$OUT" <<'JS'
  const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process")
  const root = process.argv[2], out = process.argv[3]
  const dir = path.dirname(process.env.EXPLAINER_SCRIPT || "explainer/script.js")
  const { SCENES, sceneDuration } = require(path.join(root, dir, "script.js"))
  const dur = JSON.parse(fs.readFileSync(path.join(root, dir, "durations.json"), "utf8"))
  const lines = []
  SCENES.forEach((s, i) => {
    const wav = path.join(out, `scene${i}.wav`)
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", path.join(root, dir, "audio", s.id + ".mp3"),
      "-ac", "1", "-ar", "24000", "-af", "apad=whole_dur=" + sceneDuration(s, dur).toFixed(3), wav])
    lines.push("file '" + wav + "'")
  })
  fs.writeFileSync(path.join(out, "audio.txt"), lines.join("\n") + "\n")
JS
ffmpeg -v error -y -f concat -safe 0 -i "$LIST" -codec:a aac -b:a 96k "$OUT/track.m4a"
# 網站播放器有全片加速（explainer.js 的 SPEED），預覽影片跟著加速；atempo 保持音高
SPEED="$(node -e "console.log(require('$ROOT/explainer/explainer.js').SPEED || 1)")"
ffmpeg -v error -y -framerate "$FPS" -i "$OUT/frames/f%05d.png" -i "$OUT/track.m4a" \
  -filter_complex "[0:v]setpts=PTS/$SPEED[v];[1:a]atempo=$SPEED[a]" -map "[v]" -map "[a]" \
  -c:v libx264 -pix_fmt yuv420p -crf 23 -r "$FPS" -c:a aac -b:a 96k -shortest "$OUT/explainer-preview.mp4"
rm -rf "$OUT/frames" "$OUT"/scene*.wav "$OUT/track.m4a" "$LIST"
echo "預覽影片：$OUT/explainer-preview.mp4"
