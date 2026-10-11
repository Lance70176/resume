// 從同一份原始碼產出兩個對外履歷站：
//   rex   → https://resume-rex.master0987.com（Rex Lu，求職用；原始碼本身就是這版）
//   snake → https://resume-snake.master0987.com（Snake Lu，接案用；換名字、網址、email、PDF 檔名與開場配音，
//           工作流程四卡加圖示動畫、「實證」區塊改成附圖表與 8 月報告節錄連結的版本，報告在 variants/snake/report/）
//
// 用法：node tools/build-variant.mjs <rex|snake> <輸出目錄>
//   例：node tools/build-variant.mjs snake ~/projects/case/resume-snake-site
// 輸出目錄會先清掉 index.html／explainer／img／download／robots.txt／sitemap.xml 再重建。
// PDF 不在這裡產：內容改了就部署後用 headless Chrome 對線上網址 --print-to-pdf，
// 存回原始碼的 download/rex-lu-resume.pdf 或 variants/snake/download/snake-lu-resume.pdf。
//
// snake 的開場配音放在 variants/snake/explainer/（intro.mp3＋durations.json），
// 改了 intro 的 line 要另外用 tools/gen-explainer-audio.mjs 重錄（見該檔說明），並同步下面 snake 的 intro cues。

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const REX_URL = 'resume-rex.master0987.com'

const VARIANTS = {
  rex: { replace: [] },
  snake: {
    replace: [
      [REX_URL, 'resume-snake.master0987.com'],
      ['rex-lu-resume.pdf', 'snake-lu-resume.pdf'],
      ['Rex Lu', 'Snake Lu'],
      ['REX LU', 'SNAKE LU'],
      ['ABOUT REX', 'ABOUT SNAKE'],
      ['我是 Rex', '我是 Snake'],
      ['lance70176@gmail.com', 'snakeluph@gmail.com'],
      // 兩版刻意用不同大頭照（Snake 版在 variants/snake/img/avatar.jpg），版本參數各自獨立，避免拿到另一版照片的 CDN 快取
      ['img/avatar.jpg?v=3', 'img/avatar.jpg?v=s3'],
      ['--author=rex', '--author=snake'],
      ["'rex-explainer-muted'", "'snake-explainer-muted'"],
      // 舊網域轉址只屬於 rex 版
      [/<script>if\(location\.hostname==='resume\.master0987\.com'\)[^<]*<\/script>\n/, ''],
      // Snake 配音念名字的長度不同，開場畫面元素的出現秒數跟著換
      [/cues: \{ me: 0, years: [^}]*\}/, 'cues: { me: 0, years: 1.55, ecom: 2.92, pay: 3.96, overseas: 4.96, now: 6.43, pipeline: 7.32, line: 8.3 }'],
    ],
    overlay: 'variants/snake',
    // index.html 裡 <!-- variant:名稱 --> … <!-- /variant:名稱 --> 整段換成 variants/snake/partials/名稱.html
    partials: ['metrics', 'pipe', 'proof', 'datasrc', 'dspanel'],
  },
}

const [name, outArg] = process.argv.slice(2)
const v = VARIANTS[name]
if (!v || !outArg) {
  console.error('用法：node tools/build-variant.mjs <rex|snake> <輸出目錄>')
  process.exit(1)
}
const out = resolve(outArg)
const ITEMS = ['index.html', 'explainer', 'img', 'download', 'robots.txt', 'sitemap.xml']
const TEXT = ['index.html', 'robots.txt', 'sitemap.xml', 'explainer/script.js', 'explainer/explainer.js']

mkdirSync(out, { recursive: true })
for (const it of ITEMS) {
  rmSync(join(out, it), { recursive: true, force: true })
  cpSync(join(root, it), join(out, it), { recursive: true })
}
if (v.overlay) {
  // Rex 的 PDF（含舊版 rex_resume.pdf）不能出現在其他版本
  for (const f of ['rex-lu-resume.pdf', 'rex_resume.pdf']) rmSync(join(out, 'download', f), { force: true })
  cpSync(join(root, v.overlay), out, { recursive: true, filter: src => !src.includes('/partials') })
}
for (const part of v.partials || []) {
  const p = join(out, 'index.html')
  const re = new RegExp(`[ \\t]*<!-- variant:${part}[^>]*-->[\\s\\S]*?<!-- /variant:${part} -->\\n`)
  const s = readFileSync(p, 'utf8')
  if (!re.test(s)) throw new Error(`index.html 找不到 variant:${part} 標記`)
  writeFileSync(p, s.replace(re, () => readFileSync(join(root, v.overlay, 'partials', part + '.html'), 'utf8')))
}

for (const f of TEXT) {
  const p = join(out, f)
  let s = readFileSync(p, 'utf8')
  for (const [from, to] of v.replace) s = typeof from === 'string' ? s.split(from).join(to) : s.replace(from, to)
  writeFileSync(p, s)
}

if (name !== 'rex') {
  const left = TEXT.flatMap(f => (readFileSync(join(out, f), 'utf8').match(/Rex Lu|我是 Rex|resume-rex\.|lance70176@/g) || []).map(m => `${f}: ${m}`))
  if (left.length) {
    console.error('還有沒換掉的 Rex：\n' + left.join('\n'))
    process.exit(1)
  }
}
console.log(`${name} → ${out}${existsSync(join(out, 'download')) ? '' : '（缺 download/）'}`)
