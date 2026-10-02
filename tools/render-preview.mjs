// 用 Node 跑同一份繪圖程式（explainer/explainer.js）出預覽圖，不用開瀏覽器。
//
//   node tools/render-preview.mjs <輸出資料夾> [--frames 15] [--cues]
//
// 預設：每幕抽 3 個時間點（25%、60%、100%）輸出 PNG；加 --frames N 另外以 N fps 輸出整段連續幀
// 到 <輸出資料夾>/frames/，可再用 ffmpeg 合成 mp4（見 tools/make-preview-video.sh）。
// 加 --cues 另外在每幕每個 cue（script.js 裡念到關鍵詞的秒數）+0.3 秒各出一張 PNG 到
// <輸出資料夾>/cues/，用來逐張檢查「念到這個詞時畫面正好出現對應元素」。
// 需要 @napi-rs/canvas：預設從 ~/projects/claude/temp/resume-2026/explainer-preview 的 node_modules 載入，
// 可用 CANVAS_DIR 改路徑。手寫字型用 explainer/iansui-explainer.woff2（沒有就退回原始 TTF：IANSUI_TTF）。

import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const canvasDir = process.env.CANVAS_DIR || join(homedir(), 'projects/claude/temp/resume-2026/explainer-preview')
const { createCanvas, GlobalFonts } = createRequire(join(canvasDir, 'package.json'))('@napi-rs/canvas')
const require = createRequire(import.meta.url)
const EX = require(join(root, 'explainer/explainer.js'))

const args = process.argv.slice(2)
const outDir = args.find(a => !a.startsWith('--')) || join(canvasDir, 'out')
const fpsIdx = args.indexOf('--frames')
const fps = fpsIdx >= 0 ? Number(args[fpsIdx + 1]) : 0
const wantCues = args.includes('--cues')
mkdirSync(outDir, { recursive: true })

const woff2 = join(root, 'explainer/iansui-explainer.woff2')
const ttf = process.env.IANSUI_TTF || join(homedir(), 'projects/claude/temp/resume-2026/font/Iansui-Regular.ttf')
const fontFile = existsSync(woff2) ? woff2 : ttf
if (!GlobalFonts.registerFromPath(fontFile, 'Iansui')) console.warn('字型載入失敗：' + fontFile)
else console.log('字型：' + fontFile)

const durFile = join(root, 'explainer/durations.json')
const durations = existsSync(durFile) ? JSON.parse(readFileSync(durFile, 'utf8')) : {}
const { W, H, SCENES, sceneDuration, drawFrame } = EX

const cv = createCanvas(W, H)
const ctx = cv.getContext('2d')
const render = (i, t, clock) => {
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  drawFrame(ctx, i, t, durations, clock)
  return cv.toBuffer('image/png')
}

// 抽樣：每幕三個時間點
for (let i = 0; i < SCENES.length; i++) {
  const d = sceneDuration(SCENES[i], durations)
  for (const k of [0.25, 0.6, 1]) {
    const t = d * k
    const file = join(outDir, `${String(i + 1).padStart(2, '0')}-${SCENES[i].id}-${Math.round(k * 100)}.png`)
    writeFileSync(file, render(i, t, t))
  }
  console.log(`${SCENES[i].id}: ${d.toFixed(2)}s`)
}

// 關鍵詞時間點：每個 cue 念到後 0.3 秒（元素已開始畫、尚未畫完）各一張
if (wantCues) {
  const cdir = join(outDir, 'cues')
  mkdirSync(cdir, { recursive: true })
  let n = 0
  SCENES.forEach((s, i) => {
    for (const [key, sec] of Object.entries(s.cues || {})) {
      const t = sec + 0.3
      writeFileSync(join(cdir, `${String(i + 1).padStart(2, '0')}-${s.id}-${key}-${t.toFixed(2)}s.png`), render(i, t, t))
      n++
    }
  })
  console.log(`cue 圖：${n} 張 → ${cdir}`)
}

// 連續幀（給 ffmpeg 合成影片）
if (fps > 0) {
  const fdir = join(outDir, 'frames')
  mkdirSync(fdir, { recursive: true })
  let n = 0
  let clock = 0
  for (let i = 0; i < SCENES.length; i++) {
    const d = sceneDuration(SCENES[i], durations)
    const frames = Math.round(d * fps)
    for (let f = 0; f < frames; f++) {
      const t = f / fps
      writeFileSync(join(fdir, `f${String(n++).padStart(5, '0')}.png`), render(i, t, clock + t))
    }
    clock += d
  }
  console.log(`連續幀：${n} 張 @ ${fps}fps（${(n / fps).toFixed(1)}s）→ ${fdir}`)
}
