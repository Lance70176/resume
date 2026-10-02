// 產生「1 分鐘認識我」動畫的配音（Gemini TTS）與秒數表。
//
// 用法（需要 ffmpeg／ffprobe）：
//   GEMINI_API_KEY=xxx node tools/gen-explainer-audio.mjs            # 全部重產
//   GEMINI_API_KEY=xxx node tools/gen-explainer-audio.mjs money cta  # 只重產某幾幕
//   node tools/gen-explainer-audio.mjs --missing                     # 只補還沒產生的幕
//   node tools/gen-explainer-audio.mjs --from ~/錄音資料夾             # 改用真人錄音（檔名＝幕 id）
//   node tools/gen-explainer-audio.mjs --measure                     # 不產音，只重量既有 mp3 的秒數與子句起點
//
// 金鑰：環境變數 GEMINI_API_KEY，沒設就讀 GEMINI_KEY_FILE 指到的 .env（預設是 astrofish
// dice-writer 的 .env，取 GEMINI_API_KEYS 第一把）。金鑰不印出、不寫進 repo。
// 模型：TTS_MODEL（預設 gemini-3.8-flash-tts；額度用完可退 gemini-3.8-flash-lite-tts）、
// 聲線：TTS_VOICE（預設 Charon，男聲）。免費額度每分鐘 3 次、每日約 10 次。
//
// 輸出：explainer/audio/<scene>.mp3、explainer/durations.json
//   durations.json 的 <id>＝配音秒數；<id>_pauses＝子句起點秒數陣列（第一個固定是 0），
//   由 ffmpeg silencedetect（noise=-35dB:d=0.12）的每段靜音「結束點」算出，也就是旁白每個
//   停頓之後開口的時刻。畫面與旁白同步靠 explainer/script.js 各幕的 cues（念到關鍵詞的秒數）：
//   重產配音後子句起點會變，請把 <id>_pauses 依序對到該幕 line 的逗號／頓號／分號子句，
//   更新 cues 裡對應的秒數；子句中間的詞（例如 intro 的「十六年」約在子句起點後 0.5 秒）
//   這裡量不到，要自己聽著估。這個檔只負責量，不會自動改 cues。

import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const { SCENES } = createRequire(import.meta.url)(join(root, 'explainer/script.js'))
const outDir = join(root, 'explainer/audio')
const durFile = join(root, 'explainer/durations.json')
const MODEL = process.env.TTS_MODEL || 'gemini-3.8-flash-tts'
const VOICE = process.env.TTS_VOICE || 'Charon'
const args = process.argv.slice(2)
const fromDir = args.includes('--from') ? args[args.indexOf('--from') + 1] : null
const skipExisting = args.includes('--missing')
const measureOnly = args.includes('--measure')
const only = args.filter(a => !a.startsWith('--') && a !== fromDir)

const readKey = () => {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY
  const file = process.env.GEMINI_KEY_FILE || join(homedir(), 'projects/astrofish/astrofish-member-api/tools/dice-writer/.env')
  if (!existsSync(file)) return ''
  const m = readFileSync(file, 'utf8').match(/^GEMINI_API_KEYS?=([^\n\r]+)/m)
  return m ? m[1].trim().replace(/^["']|["']$/g, '').split(',')[0].trim() : ''
}
const key = fromDir || measureOnly ? '' : readKey()
if (!key && !fromDir && !measureOnly) throw new Error('缺 GEMINI_API_KEY（或 GEMINI_KEY_FILE 指到的 .env 沒有 GEMINI_API_KEYS）')

mkdirSync(outDir, { recursive: true })
const durations = existsSync(durFile) ? JSON.parse(readFileSync(durFile, 'utf8')) : {}

const API = 'https://generativelanguage.googleapis.com/v1beta/models'
// 去頭尾靜音後補 10ms 淡入、40ms 淡出，換段時不會有「喀」聲
const CLEAN = [
  'silenceremove=start_periods=1:start_threshold=-45dB',
  'areverse', 'silenceremove=start_periods=1:start_threshold=-45dB', 'afade=t=in:d=0.04', 'areverse',
  'afade=t=in:d=0.01',
].join(',')
const sleep = ms => new Promise(r => setTimeout(r, ms))
// 免費額度每分鐘只有 3 次：每次請求前先等，撞到 429（額度）或 503（忙碌）再多等一分鐘重試
const call = async (model, body) => {
  for (let i = 0; ; i++) {
    await sleep(i ? 65000 : 21000)
    const res = await fetch(`${API}/${model}:generateContent?key=${key}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const json = await res.json()
    if (![429, 503].includes(json.error?.code) || i >= 5) return json
    console.log(`${model} ${json.error.code}，等一分鐘重試…`)
  }
}
const norm = t => t.replace(/[^\p{Script=Han}\d]/gu, '')

// 子句起點：靜音（-35dB 以下持續 0.12 秒以上）結束的時刻＝停頓後再開口。第一個子句固定從 0 起。
const clauseStarts = mp3 => {
  // silencedetect 的結果印在 stderr
  const log = spawnSync('ffmpeg', ['-v', 'info', '-i', mp3, '-af', 'silencedetect=noise=-35dB:d=0.12', '-f', 'null', '-'], { encoding: 'utf8' }).stderr
  const ends = [...log.matchAll(/silence_end: ([\d.]+)/g)].map(m => Math.round(parseFloat(m[1]) * 100) / 100)
  return [0, ...ends]
}

// TTS 偶爾會自己加語助詞或漏字：產生後用聽寫比對，不一致就重來
const transcribe = async mp3 => {
  const json = await call('gemini-flash-latest', {
    contents: [{ parts: [
      { inline_data: { mime_type: 'audio/mp3', data: readFileSync(mp3).toString('base64') } },
      { text: '逐字聽寫這段音檔，用繁體中文輸出，數字一律寫成國字，只輸出內容。' },
    ] }],
  })
  const heard = json.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('').trim()
  if (!heard) throw new Error(`聽寫失敗：${JSON.stringify(json).slice(0, 300)}`)
  return heard
}

// TTS 回傳格式不固定：3.8 系列是 audio/wav（含檔頭與尾端 IPTC 標記），舊模型是 audio/L16 純 PCM。
// 一律交給 ffmpeg 依格式解碼，把 WAV 當 PCM 讀會在每段頭尾出雜音。
const synth = async (line, mp3) => {
  const json = await call(MODEL, {
    contents: [{ parts: [{ text: line }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
    },
  })
  const part = json.candidates?.[0]?.content?.parts?.find(p => p.inlineData)
  if (!part) throw new Error(`產生失敗：${JSON.stringify(json).slice(0, 400)}`)
  const mime = part.inlineData.mimeType ?? ''
  const isWav = /wav/i.test(mime)
  const raw = mp3.replace(/\.mp3$/, isWav ? '.wav' : '.pcm')
  writeFileSync(raw, Buffer.from(part.inlineData.data, 'base64'))
  const rate = mime.match(/rate=(\d+)/)?.[1] ?? '24000'
  const input = isWav ? ['-i', raw] : ['-f', 's16le', '-ar', rate, '-ac', '1', '-i', raw]
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...input, '-af', CLEAN, '-codec:a', 'libmp3lame', '-b:a', '64k', mp3])
  unlinkSync(raw)
}

for (const s of SCENES) {
  if (only.length && !only.includes(s.id)) continue
  const mp3 = join(outDir, `${s.id}.mp3`)
  if (fromDir) {
    const src = ['wav', 'mp3', 'm4a', 'aiff'].map(ext => join(fromDir, `${s.id}.${ext}`)).find(existsSync)
    if (!src) { console.log(`${s.id}: 沒有錄音，沿用原本配音`); continue }
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-ac', '1', '-af', CLEAN, '-codec:a', 'libmp3lame', '-b:a', '64k', mp3])
  } else if (measureOnly) {
    if (!existsSync(mp3)) { console.log(`${s.id}: 沒有 mp3，略過`); continue }
  } else if (!(skipExisting && existsSync(mp3))) {
    for (let attempt = 1; ; attempt++) {
      await synth(s.line, mp3)
      const heard = await transcribe(mp3)
      // 聽寫常回簡體字，只比字數：多唸指示、多加語助詞、漏字都會讓字數對不上
      if (Array.from(norm(heard)).length === Array.from(norm(s.line)).length) break
      console.log(`${s.id} 第 ${attempt} 次不一致：${heard}`)
      if (attempt >= 4) throw new Error(`${s.id} 重試 4 次仍唸不對`)
    }
    console.log(`${s.id}: 以 ${MODEL}／${VOICE} 產生`)
  }
  const sec = parseFloat(execFileSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3,
  ]).toString())
  durations[s.id] = Math.round(sec * 100) / 100
  durations[`${s.id}_pauses`] = clauseStarts(mp3)
  console.log(`${s.id}: ${durations[s.id]}s，子句起點 ${durations[`${s.id}_pauses`].join(' / ')}`)
  const cues = s.cues ? Object.values(s.cues) : []
  if (cues.length && Math.max(...cues) > sec) console.log(`  注意：${s.id} 的 cues 超過配音長度，請依子句起點更新 script.js 的 cues`)
  // 每幕完成就寫一次，中途失敗重跑 --missing 時不會遺失已完成的秒數
  writeFileSync(durFile, JSON.stringify(durations, null, 2) + '\n')
}
