// 「1 分鐘認識我」：手繪 canvas 動畫＋配音的播放器（純 JS，無框架、無外部套件）。
// 檔案分三段：① 筆刷與背景 ② 六幕的繪圖函式 ③ 彈窗播放器。
// ①② 在 Node 也能跑（tools/render-preview.mjs 用 @napi-rs/canvas 出預覽圖），③ 只在瀏覽器執行。
// 所有抖動都用固定種子產生：同一個 t 畫出來永遠一樣，暫停、跳幕、減少動態模式都只是「用某個 t 重畫一次」。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./script.js'))
  else root.RexExplainer = factory(root.REX_EXPLAINER_SCRIPT)
})(typeof self !== 'undefined' ? self : this, function (SCRIPT) {
  'use strict'
  var SCENES = SCRIPT.SCENES
  var sceneDuration = SCRIPT.sceneDuration

  // ---------- ① 筆刷 ----------
  var W = 960
  var H = 540
  var FONT = 'Iansui, "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif'
  var BG = '#171a21'
  var CHALK = '#e6e8ee'
  var BLUE = '#8fa3ff'
  var ORANGE = '#fb923c'
  var MUTED = '#9aa1ae'

  var clamp01 = function (x) { return Math.max(0, Math.min(1, x)) }
  /** t 在 [start, start+dur] 之間的進度 0~1 */
  var prog = function (t, start, dur) { return clamp01((t - start) / dur) }
  var easeOut = function (x) { return 1 - Math.pow(1 - x, 3) }
  var easeInOut = function (x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2 }
  var easeOutBack = function (x) { var c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2) }

  function hash(s) {
    var h = 2166136261
    for (var i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
    return h >>> 0
  }
  function rng(seed) {
    var a = hash(seed)
    return function () {
      a = (a + 0x6d2b79f5) | 0
      var t = Math.imul(a ^ (a >>> 15), 1 | a)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  // 把折線切成約 10px 一段並加上垂直抖動，模擬手畫的不穩
  function roughen(points, seed, amp) {
    var r = rng(seed)
    var out = []
    var drift = 0
    for (var i = 0; i < points.length - 1; i++) {
      var x1 = points[i][0], y1 = points[i][1], x2 = points[i + 1][0], y2 = points[i + 1][1]
      var len = Math.hypot(x2 - x1, y2 - y1)
      var steps = Math.max(1, Math.round(len / 10))
      var nx = -(y2 - y1) / (len || 1)
      var ny = (x2 - x1) / (len || 1)
      for (var s = 0; s < steps; s++) {
        var k = s / steps
        drift = drift * 0.6 + (r() - 0.5) * amp
        out.push([x1 + (x2 - x1) * k + nx * drift, y1 + (y2 - y1) * k + ny * drift])
      }
    }
    var last = points[points.length - 1]
    out.push([last[0] + (r() - 0.5) * amp * 0.5, last[1] + (r() - 0.5) * amp * 0.5])
    return out
  }

  function polyline(ctx, pts, progress) {
    if (progress <= 0 || pts.length < 2) return
    var total = 0
    for (var i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
    var remain = total * progress
    ctx.beginPath()
    ctx.moveTo(pts[0][0], pts[0][1])
    for (var j = 1; j < pts.length && remain > 0; j++) {
      var ax = pts[j - 1][0], ay = pts[j - 1][1], bx = pts[j][0], by = pts[j][1]
      var seg = Math.hypot(bx - ax, by - ay)
      if (seg <= remain) ctx.lineTo(bx, by)
      else ctx.lineTo(ax + ((bx - ax) * remain) / seg, ay + ((by - ay) * remain) / seg)
      remain -= seg
    }
    ctx.stroke()
  }

  /** 粉筆線：畫兩遍略有偏移的線，第二遍淡一點，像粉筆在黑板上的粗糙邊 */
  function stroke(ctx, points, o) {
    var seed = o.seed, color = o.color || CHALK, width = o.width || 3
    var progress = o.progress == null ? 1 : o.progress
    var amp = o.amp == null ? 1.5 : o.amp
    var alpha = o.alpha == null ? 1 : o.alpha
    if (progress <= 0 || alpha <= 0) return
    ctx.save()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = color
    ctx.shadowColor = color
    ctx.shadowBlur = 5
    ctx.lineWidth = width
    ctx.globalAlpha = 0.95 * alpha
    polyline(ctx, roughen(points, seed, amp), progress)
    ctx.shadowBlur = 0
    ctx.lineWidth = Math.max(1, width * 0.55)
    ctx.globalAlpha = 0.4 * alpha
    polyline(ctx, roughen(points, seed + '#2', amp * 1.3), progress)
    ctx.restore()
  }

  function ellipse(cx, cy, rx, ry, start, sweep) {
    if (start == null) start = -Math.PI / 2
    if (sweep == null) sweep = Math.PI * 2.08
    var n = Math.max(24, Math.round((Math.max(rx, ry) * Math.abs(sweep)) / 8))
    var pts = []
    for (var i = 0; i <= n; i++) {
      var a = start + (sweep * i) / n
      pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry])
    }
    return pts
  }

  function roundRect(x, y, w, h, r) {
    var pts = []
    var corner = function (cx, cy, a0) {
      for (var i = 0; i <= 4; i++) {
        var a = a0 + (Math.PI / 2) * (i / 4)
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r])
      }
    }
    corner(x + r, y + r, Math.PI)
    corner(x + w - r, y + r, -Math.PI / 2)
    corner(x + w - r, y + h - r, 0)
    corner(x + r, y + h - r, Math.PI / 2)
    pts.push(pts[0])
    return pts
  }

  function curve(a, ctrl, b, n) {
    n = n || 24
    var pts = []
    for (var i = 0; i <= n; i++) {
      var k = i / n, u = 1 - k
      pts.push([u * u * a[0] + 2 * u * k * ctrl[0] + k * k * b[0], u * u * a[1] + 2 * u * k * ctrl[1] + k * k * b[1]])
    }
    return pts
  }

  function assign(base, extra) {
    var o = {}
    for (var k in base) o[k] = base[k]
    for (var j in extra) o[j] = extra[j]
    return o
  }

  /** 手繪箭頭：先畫身體，身體畫完才畫箭頭 */
  function arrow(ctx, a, ctrl, b, o) {
    var p = o.progress == null ? 1 : o.progress
    stroke(ctx, curve(a, ctrl, b), assign(o, { progress: clamp01(p / 0.8) }))
    var hp = clamp01((p - 0.8) / 0.2)
    if (hp <= 0) return
    var ang = Math.atan2(b[1] - ctrl[1], b[0] - ctrl[0])
    var L = o.head || 14
    ;[0.5, -0.5].forEach(function (d) {
      var tip = [b[0] - Math.cos(ang + d) * L, b[1] - Math.sin(ang + d) * L]
      stroke(ctx, [b, tip], assign(o, { seed: o.seed + d, progress: hp }))
    })
  }

  /** 手寫字：逐字出現，正在寫的那個字淡入；回傳整串寬度 */
  function text(ctx, str, x, y, o) {
    o = o || {}
    var size = o.size || 28, color = o.color || CHALK, align = o.align || 'center'
    var progress = o.progress == null ? 1 : o.progress
    var alpha = o.alpha == null ? 1 : o.alpha
    ctx.save()
    ctx.font = size + 'px ' + FONT
    ctx.textBaseline = 'middle'
    var full = ctx.measureText(str).width
    if (progress <= 0 || alpha <= 0) { ctx.restore(); return full }
    var chars = Array.from(str)
    ctx.fillStyle = color
    ctx.shadowColor = color
    ctx.shadowBlur = 4
    var cx = align === 'center' ? x - full / 2 : align === 'right' ? x - full : x
    var shown = progress * chars.length
    for (var i = 0; i < chars.length && i < shown; i++) {
      ctx.globalAlpha = alpha * clamp01(shown - i)
      ctx.fillText(chars[i], cx, y)
      cx += ctx.measureText(chars[i]).width
    }
    ctx.restore()
    return full
  }

  /** 四角星閃光 */
  function sparkle(ctx, x, y, r, color, progress, seed) {
    if (progress <= 0) return
    var k = r * easeOutBack(progress)
    stroke(ctx, [[x - k, y], [x + k, y]], { seed: seed + 'h', color: color, width: 2, amp: 0.5 })
    stroke(ctx, [[x, y - k], [x, y + k]], { seed: seed + 'v', color: color, width: 2, amp: 0.5 })
  }

  /** 打勾 */
  function check(ctx, x, y, s, color, progress, seed) {
    stroke(ctx, [[x - s, y], [x - s * 0.3, y + s * 0.7], [x + s, y - s * 0.8]], { seed: seed, color: color, width: 3.5, progress: progress })
  }

  /** 叉叉 */
  function cross(ctx, x, y, s, color, progress, seed) {
    stroke(ctx, [[x - s, y - s], [x + s, y + s]], { seed: seed + 'a', color: color, width: 3.5, progress: prog(progress, 0, 0.5) })
    stroke(ctx, [[x + s, y - s], [x - s, y + s]], { seed: seed + 'b', color: color, width: 3.5, progress: prog(progress, 0.5, 0.5) })
  }

  // 背景：主機板／藍圖——淡格線＋幾條走線與焊點，一顆訊號沿走線跑
  var TRACES = [
    [[0, 470], [120, 470], [160, 510], [330, 510]],
    [[960, 60], [840, 60], [800, 100], [640, 100], [610, 130]],
    [[30, 150], [30, 260], [70, 300], [70, 380]],
    [[940, 320], [940, 400], [900, 440], [900, 540]],
  ]
  function traceLen(tr) {
    var L = 0
    for (var i = 1; i < tr.length; i++) L += Math.hypot(tr[i][0] - tr[i - 1][0], tr[i][1] - tr[i - 1][1])
    return L
  }
  function pointAt(tr, dist) {
    for (var i = 1; i < tr.length; i++) {
      var seg = Math.hypot(tr[i][0] - tr[i - 1][0], tr[i][1] - tr[i - 1][1])
      if (dist <= seg) {
        var k = dist / seg
        return [tr[i - 1][0] + (tr[i][0] - tr[i - 1][0]) * k, tr[i - 1][1] + (tr[i][1] - tr[i - 1][1]) * k]
      }
      dist -= seg
    }
    return tr[tr.length - 1]
  }
  function background(ctx, time) {
    ctx.save()
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, W, H)
    ctx.lineWidth = 1
    for (var x = 0; x <= W; x += 24) {
      ctx.strokeStyle = x % 120 === 0 ? 'rgba(143,163,255,0.13)' : 'rgba(143,163,255,0.055)'
      ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); ctx.stroke()
    }
    for (var y = 0; y <= H; y += 24) {
      ctx.strokeStyle = y % 120 === 0 ? 'rgba(143,163,255,0.13)' : 'rgba(143,163,255,0.055)'
      ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke()
    }
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 2
    ctx.strokeStyle = 'rgba(143,163,255,0.22)'
    ctx.fillStyle = 'rgba(143,163,255,0.3)'
    TRACES.forEach(function (tr, i) {
      ctx.beginPath()
      ctx.moveTo(tr[0][0], tr[0][1])
      for (var j = 1; j < tr.length; j++) ctx.lineTo(tr[j][0], tr[j][1])
      ctx.stroke()
      var end = tr[tr.length - 1]
      ctx.beginPath(); ctx.arc(end[0], end[1], 4, 0, Math.PI * 2); ctx.fill()
      // 訊號脈衝：每條走線各自的週期
      var L = traceLen(tr)
      var period = 5 + i * 1.7
      var k = ((time + i * 1.3) % period) / period
      if (k < 0.55) {
        var p = pointAt(tr, (k / 0.55) * L)
        ctx.save()
        ctx.fillStyle = BLUE
        ctx.shadowColor = BLUE
        ctx.shadowBlur = 10
        ctx.globalAlpha = 0.55
        ctx.beginPath(); ctx.arc(p[0], p[1], 3, 0, Math.PI * 2); ctx.fill()
        ctx.restore()
      }
    })
    ctx.restore()
  }

  // ---------- ② 各幕 ----------
  // 每幕都是 (ctx, t 本幕已播秒數, d 本幕總長, n 旁白秒數) 的純函式；版面以 960×540 為座標。
  // 與旁白同步的元素用 script.js 各幕的 cues（念到關鍵詞的秒數）當起點：c('詞') 回傳
  // 「念到該詞的秒數 − 提前量（預設 0.15 秒）」，筆畫從那一刻開始畫，念到時正好在畫。
  function cueFn(id) {
    var cs = {}
    SCENES.forEach(function (s) { if (s.id === id) cs = s.cues || {} })
    return function (key, lead) {
      if (!(key in cs)) throw new Error('script.js 缺 cue：' + id + '.' + key)
      return cs[key] - (lead == null ? 0.15 : lead)
    }
  }
  var CUE = {}
  SCENES.forEach(function (s) { CUE[s.id] = cueFn(s.id) })

  /** 上方手寫標題＋底線 */
  function title(ctx, str, t, color) {
    var w = text(ctx, str, W / 2, 50, { size: 36, progress: prog(t, 0, 0.9) })
    stroke(ctx, [[W / 2 - w / 2 - 8, 78], [W / 2 + w / 2 + 8, 76]], {
      seed: 'title' + str, color: color || BLUE, width: 3, progress: easeOut(prog(t, 0.6, 0.6)),
    })
  }

  /** 手繪小人（站姿，y 是腳底） */
  function person(ctx, x, y, p, o) {
    o = o || {}
    var c = { color: o.color || CHALK, width: 3 }
    var arm = o.arm || 0
    stroke(ctx, ellipse(x, y - 76, 14, 15), assign(c, { seed: 'head' + x, progress: prog(p, 0, 0.3) }))
    stroke(ctx, [[x, y - 61], [x, y - 22]], assign(c, { seed: 'body' + x, progress: prog(p, 0.25, 0.2) }))
    stroke(ctx, [[x, y - 22], [x - 13, y + 4]], assign(c, { seed: 'legL' + x, progress: prog(p, 0.4, 0.15) }))
    stroke(ctx, [[x, y - 22], [x + 13, y + 4]], assign(c, { seed: 'legR' + x, progress: prog(p, 0.45, 0.15) }))
    stroke(ctx, [[x, y - 50], [x - 20, y - 30]], assign(c, { seed: 'armL' + x, progress: prog(p, 0.55, 0.15) }))
    // 右手：平舉（指東西）→ 舉高
    var hand = [x + 22 + arm * 4, y - 46 - arm * 30]
    stroke(ctx, [[x, y - 50], hand], assign(c, { seed: 'armR' + x, progress: prog(p, 0.6, 0.2) }))
  }

  /** 帳本：方框＋書脊＋幾行字 */
  function ledger(ctx, x, y, p, seed) {
    stroke(ctx, roundRect(x - 58, y - 72, 116, 144, 8), { seed: seed + 'r', color: BLUE, width: 3, progress: prog(p, 0, 0.6) })
    stroke(ctx, [[x - 42, y - 72], [x - 42, y + 72]], { seed: seed + 's', color: BLUE, width: 2, progress: prog(p, 0.5, 0.2), alpha: 0.8 })
    for (var i = 0; i < 4; i++) {
      stroke(ctx, [[x - 26, y - 40 + i * 26], [x + 38 - (i % 2) * 14, y - 40 + i * 26]], {
        seed: seed + 'l' + i, width: 2, progress: prog(p, 0.6 + i * 0.1, 0.1), alpha: 0.85,
      })
    }
  }

  /** 錢幣：圓圈＋ $ */
  function coin(ctx, x, y, color, p, seed) {
    stroke(ctx, ellipse(x, y, 15, 15), { seed: seed, color: color, width: 2.5, progress: prog(p, 0, 0.6) })
    text(ctx, '$', x, y + 1, { size: 22, color: color, progress: prog(p, 0.5, 0.5) })
  }

  /** 沙漏 */
  function hourglass(ctx, x, y, p, seed) {
    var o = { seed: seed, color: BLUE, width: 2.5 }
    stroke(ctx, [[x - 16, y - 24], [x + 16, y - 24], [x, y], [x + 16, y + 24], [x - 16, y + 24], [x, y], [x - 16, y - 24]], assign(o, { progress: p }))
    // 沙：上半截剩一點，下半堆起來
    ctx.save()
    ctx.globalAlpha = 0.6 * prog(p, 0.7, 0.3)
    ctx.fillStyle = ORANGE
    ctx.beginPath(); ctx.moveTo(x - 6, y - 9); ctx.lineTo(x + 6, y - 9); ctx.lineTo(x, y - 1); ctx.closePath(); ctx.fill()
    ctx.beginPath(); ctx.moveTo(x - 12, y + 22); ctx.lineTo(x + 12, y + 22); ctx.lineTo(x, y + 10); ctx.closePath(); ctx.fill()
    ctx.restore()
  }

  /** AI agent：圓角方塊＋兩隻眼＋天線 */
  function agent(ctx, x, y, p, seed, color) {
    color = color || CHALK
    stroke(ctx, roundRect(x - 18, y - 14, 36, 28, 7), { seed: seed + 'b', color: color, width: 2.5, progress: prog(p, 0, 0.6) })
    stroke(ctx, ellipse(x - 7, y, 3, 3), { seed: seed + 'e1', color: ORANGE, width: 2, progress: prog(p, 0.5, 0.3) })
    stroke(ctx, ellipse(x + 7, y, 3, 3), { seed: seed + 'e2', color: ORANGE, width: 2, progress: prog(p, 0.6, 0.3) })
    stroke(ctx, [[x, y - 14], [x, y - 24]], { seed: seed + 'a', color: color, width: 2, progress: prog(p, 0.7, 0.3) })
    stroke(ctx, ellipse(x, y - 27, 3, 3), { seed: seed + 'ad', color: color, width: 2, progress: prog(p, 0.85, 0.15) })
  }

  /** 火箭（原點在機身中心），flame 0~1 是噴焰強度 */
  function rocket(ctx, x, y, p, flame, time) {
    var o = { color: CHALK, width: 3 }
    stroke(ctx, [[x, y - 36], [x + 13, y - 14], [x + 13, y + 16], [x - 13, y + 16], [x - 13, y - 14], [x, y - 36]], assign(o, { seed: 'rk', progress: prog(p, 0, 0.6) }))
    stroke(ctx, [[x - 13, y + 2], [x - 24, y + 22], [x - 13, y + 16]], assign(o, { seed: 'rfl', width: 2.5, progress: prog(p, 0.55, 0.2) }))
    stroke(ctx, [[x + 13, y + 2], [x + 24, y + 22], [x + 13, y + 16]], assign(o, { seed: 'rfr', width: 2.5, progress: prog(p, 0.6, 0.2) }))
    stroke(ctx, ellipse(x, y - 8, 5, 5), { seed: 'rw', color: BLUE, width: 2, progress: prog(p, 0.8, 0.2) })
    if (flame > 0) {
      var f = 14 + 10 * flame + Math.sin(time * 40) * 4 * flame
      stroke(ctx, [[x - 8, y + 18], [x, y + 18 + f], [x + 8, y + 18]], { seed: 'flame' + Math.floor(time * 20), color: ORANGE, width: 3, amp: 2.5, alpha: flame })
    }
  }

  // --- intro：時間軸 2010 → 2026，最後長出產線 ---
  // 節點只畫旁白有念到的四站（電商／行動支付／海外平台／現在），各自在念到時出現
  var ERAS = [
    { x: 120, year: '2010', label: '電商', cue: 'ecom' },
    { x: 330, year: '2014', label: '行動支付', cue: 'pay' },
    { x: 540, year: '2016', label: '海外平台', cue: 'overseas' },
    { x: 860, year: '2026', label: '現在', cue: 'now' },
  ]
  function pipelineIcon(ctx, x, y, p, time) {
    // 輸送帶＋三個方塊（agent 的交付物）＋小旗
    stroke(ctx, roundRect(x - 48, y + 4, 96, 14, 7), { seed: 'belt', color: ORANGE, width: 2.5, progress: prog(p, 0, 0.4) })
    stroke(ctx, ellipse(x - 34, y + 11, 4, 4), { seed: 'w1', color: ORANGE, width: 2, progress: prog(p, 0.3, 0.2) })
    stroke(ctx, ellipse(x + 34, y + 11, 4, 4), { seed: 'w2', color: ORANGE, width: 2, progress: prog(p, 0.35, 0.2) })
    for (var i = 0; i < 3; i++) {
      var bx = x - 30 + i * 30 + Math.sin(time * 2 + i) * 1.5
      stroke(ctx, roundRect(bx - 10, y - 18, 20, 20, 3), { seed: 'box' + i, color: CHALK, width: 2, progress: prog(p, 0.4 + i * 0.15, 0.2) })
    }
    stroke(ctx, [[x + 40, y - 6], [x + 40, y - 46]], { seed: 'pole', color: CHALK, width: 2, progress: prog(p, 0.85, 0.1) })
    stroke(ctx, [[x + 40, y - 46], [x + 62, y - 38], [x + 40, y - 30]], { seed: 'flag', color: ORANGE, width: 2.5, progress: prog(p, 0.9, 0.1) })
  }
  function intro(ctx, t, d, n) {
    var c = CUE.intro
    title(ctx, '嗨，我是 Rex', t - c('me'))
    var Y = 300
    // 「寫了十六年的系統」：時間軸先畫到底，念到「十六年」時大括線＋「16 年」正好出現
    stroke(ctx, [[90, Y], [900, Y]], { seed: 'axis', color: CHALK, width: 3, progress: easeInOut(prog(t, 0.4, c('years') - 0.4)) })
    var yp = prog(t, c('years'), 0.7)
    stroke(ctx, [[120, 392], [120, 404], [860, 404], [860, 392]], { seed: 'span', color: ORANGE, width: 2.5, progress: easeOut(yp) })
    text(ctx, '16 年', 490, 432, { size: 30, color: ORANGE, progress: prog(t, c('years') + 0.15, 0.5) })
    // 經歷節點：念到「電商／行動支付／海外平台／現在」時各自出現
    ERAS.forEach(function (e, i) {
      var at = c(e.cue)
      var p = prog(t, at, 0.5)
      var last = i === ERAS.length - 1
      var col = last ? ORANGE : BLUE
      stroke(ctx, [[e.x, Y - 10], [e.x, Y + 10]], { seed: 'tick' + i, color: col, width: 3, progress: prog(p, 0, 0.4) })
      stroke(ctx, ellipse(e.x, Y, 7, 7), { seed: 'dot' + i, color: col, width: 2.5, progress: prog(p, 0.2, 0.5) })
      text(ctx, e.year, e.x, Y - 32, { size: 22, color: MUTED, progress: prog(p, 0.3, 0.5) })
      text(ctx, e.label, e.x, Y + 36, { size: last ? 26 : 24, color: last ? ORANGE : CHALK, progress: prog(t, at + 0.15, 0.6) })
    })
    // 「我用 AI agent 產線交付」：產線圖示從 2026 節點上方長出來，字先寫、「產線」念到時輸送帶畫完
    var pt = c('pipeline')
    text(ctx, 'AI agent 產線', 830, 148, { size: 24, color: ORANGE, progress: prog(t, pt, 0.9) })
    pipelineIcon(ctx, 860, 215, prog(t, pt + 0.1, c('line') + 0.5 - pt), t)
    sparkle(ctx, 775, 215, 9, ORANGE, prog(t, c('line') + 0.5, 0.5), 'is1')
    sparkle(ctx, 925, 265, 7, BLUE, prog(t, c('line') + 0.8, 0.5), 'is2')
  }

  // --- money：兩本帳之間的金流、逾時沙漏、重複入帳被擋、反查打勾 ---
  function money(ctx, t, d, n) {
    var c = CUE.money
    var AX = 200, BX = 760, Y = 300
    // 「我最在意的是」：先把兩本帳擺好當舞台；「錢不能錯」：標題＋金流箭頭＋第一枚錢幣安全抵達
    ledger(ctx, AX, Y, prog(t, c('care') + 0.35, 1.0), 'LA')
    ledger(ctx, BX, Y, prog(t, c('care') + 0.55, 1.0), 'LB')
    text(ctx, '帳本 A', AX, Y + 100, { size: 24, color: BLUE, progress: prog(t, c('care') + 1.0, 0.5) })
    text(ctx, '帳本 B', BX, Y + 100, { size: 24, color: BLUE, progress: prog(t, c('care') + 1.15, 0.5) })
    var mt = c('money')
    title(ctx, '錢不能錯', t - mt, ORANGE)
    arrow(ctx, [AX + 75, Y], [480, Y - 6], [BX - 75, Y], { seed: 'flow', color: CHALK, width: 3, progress: prog(t, mt + 0.1, 0.8) })
    var c1 = prog(t, mt + 0.6, 1.2)
    if (c1 > 0) coin(ctx, AX + 85 + (BX - AX - 200) * easeInOut(c1), Y - 2 - Math.sin(c1 * Math.PI) * 10, ORANGE, 1, 'c1')
    // 「逾時」：沙漏
    var ht = c('timeout')
    hourglass(ctx, 470, 205, prog(t, ht, 0.7), 'hg')
    text(ctx, '逾時', 520, 205, { size: 26, color: BLUE, align: 'left', progress: prog(t, ht + 0.2, 0.45) })
    // 「重複入帳」：第二枚錢幣走到一半被打叉擋下
    var dt = c('dup')
    var c2 = prog(t, dt, 0.7)
    if (c2 > 0) {
      var cx = AX + 85 + 160 * easeOut(c2)
      coin(ctx, cx, Y - 2, MUTED, 1, 'c2')
      cross(ctx, cx, Y - 2, 13, ORANGE, prog(t, dt + 0.55, 0.4), 'dup')
    }
    text(ctx, '重複入帳', 455, 345, { size: 24, color: BLUE, progress: prog(t, dt + 0.2, 0.6) })
    // 「對帳補救」：回頭反查的箭頭＋打勾
    var rt = c('recon')
    arrow(ctx, [BX - 70, Y + 60], [480, Y + 150], [AX + 70, Y + 60], { seed: 'recon', color: BLUE, width: 2.5, progress: prog(t, rt, 0.9) })
    text(ctx, '對帳・反查', 455, 455, { size: 24, color: BLUE, progress: prog(t, rt + 0.3, 0.6) })
    check(ctx, 560, 452, 11, ORANGE, prog(t, rt + 0.85, 0.35), 'rk')
    // 「我在設計的第一天」：右上角蓋下 Day 1 戳章；「就放進去」：戳章旁閃一下
    var st = c('day1')
    var sp = prog(t, st, 0.7)
    if (sp > 0) {
      ctx.save()
      ctx.translate(835, 150)
      ctx.rotate(-0.14)
      var k = 1.4 - 0.4 * easeOutBack(sp)
      ctx.scale(k, k)
      stroke(ctx, roundRect(-72, -36, 144, 72, 10), { seed: 'stamp', color: ORANGE, width: 3.5, amp: 2, alpha: sp })
      text(ctx, 'Day 1', 0, -10, { size: 32, color: ORANGE, alpha: sp })
      text(ctx, '設計第一天就放進去', 0, 18, { size: 14, color: ORANGE, alpha: sp })
      ctx.restore()
    }
    sparkle(ctx, 748, 112, 9, ORANGE, prog(t, c('putin'), 0.5), 'ms1')
    sparkle(ctx, 915, 195, 7, BLUE, prog(t, c('putin') + 0.2, 0.5), 'ms2')
  }

  // --- pipeline：架構師 → 四條平行軌道 → 審查閘門 → 把關 → 火箭上線 ---
  function pipeline(ctx, t, d, n) {
    var c = CUE.pipeline
    title(ctx, 'AI agent 產線', t)
    var TRACKS = [185, 255, 325, 395]
    var X0 = 175, X1 = 640, GX = 690
    // 「我負責架構與拆解」：我站在左邊，手指向右
    var at = c('architect')
    person(ctx, 95, 410, prog(t, at + 0.2, 0.9), { arm: 0 })
    text(ctx, '架構・拆解', 95, 448, { size: 22, color: ORANGE, progress: prog(t, at + 0.9, 0.7) })
    // 「多個 AI agent 在各自的工作區」：從手指分叉出四條軌道，agent 各自沿軌道走；「平行開發」念到時標上字
    var ag = c('agents')
    var split = prog(t, ag, 0.6)
    TRACKS.forEach(function (y, i) {
      stroke(ctx, curve([120, 362], [150, y], [X0, y]), { seed: 'split' + i, color: BLUE, width: 2, progress: prog(split, i * 0.1, 0.6), alpha: 0.8 })
    })
    var trackEnd = c('review')
    TRACKS.forEach(function (y, i) {
      var start = ag + 0.35 + i * 0.2
      var p = easeInOut(prog(t, start, trackEnd - start))
      stroke(ctx, [[X0, y], [X1, y]], { seed: 'track' + i, color: BLUE, width: 2.5, progress: p })
      if (p > 0) agent(ctx, X0 + 10 + (X1 - X0 - 40) * p, y - 2 + Math.sin(t * 6 + i) * 1.5, prog(t, start - 0.2, 0.5), 'ag' + i)
    })
    text(ctx, '4 個工作區平行開發', 405, 140, { size: 22, color: MUTED, progress: prog(t, c('parallel'), 0.8) })
    // 「經過跨模型審查」：審查閘門；「與對拍」：四條都打勾
    var gt = c('review')
    stroke(ctx, roundRect(GX - 20, 155, 40, 265, 10), { seed: 'gate', color: CHALK, width: 3, progress: prog(t, gt, 0.7) })
    text(ctx, '跨模型審查・對拍', GX, 135, { size: 22, color: CHALK, progress: prog(t, gt + 0.15, 0.9) })
    var ck = c('diff')
    TRACKS.forEach(function (y, i) {
      stroke(ctx, [[X1, y], [GX - 20, y]], { seed: 'in' + i, color: BLUE, width: 2.5, progress: prog(t, gt + 0.4 + i * 0.1, 0.3), alpha: 0.8 })
      check(ctx, GX, y - 2, 9, ORANGE, prog(t, ck + i * 0.15, 0.35), 'gk' + i)
    })
    // 「最後由我把關」：右邊的我；「上線」：火箭升空
    var ft = c('gate')
    stroke(ctx, [[GX + 20, 290], [740, 290], [740, 362], [772, 362]], { seed: 'out', color: BLUE, width: 2.5, progress: prog(t, ft - 0.35, 0.5) })
    person(ctx, 795, 410, prog(t, ft, 0.7), { arm: prog(t, c('launch'), 0.4) })
    text(ctx, '把關', 795, 448, { size: 22, color: ORANGE, progress: prog(t, ft + 0.3, 0.45) })
    var lt = c('launch')
    var rp = prog(t, lt, 0.6)
    var flame = prog(t, lt + 0.55, 0.35)
    var lift = easeInOut(prog(t, lt + 0.7, d - lt - 0.7))
    if (rp > 0) rocket(ctx, 890 + Math.sin(t * 30) * flame * 1.2, 330 - lift * 240, rp, flame, t)
    text(ctx, '上線', 890, 395, { size: 24, color: ORANGE, progress: prog(t, lt + 0.1, 0.45), alpha: 1 - lift * 0.5 })
  }

  // --- proof：60% 圓餅長出來、失敗率折線從天花板掉到地板 ---
  function proof(ctx, t, d, n) {
    var c = CUE.proof
    title(ctx, '數字會說話', t - c('result'))
    var PX = 245, PY = 295, R = 110
    // 「一個月交付全隊」：先畫整個餅（全隊）；「百分之六十」：橘色扇形長到 60%
    stroke(ctx, ellipse(PX, PY, R, R), { seed: 'pie', color: CHALK, width: 3, progress: easeOut(prog(t, c('month'), 0.9)) })
    var wp = easeInOut(prog(t, c('sixty'), 1.2))
    var sweep = Math.PI * 2 * 0.6 * wp
    if (wp > 0) {
      ctx.save()
      ctx.fillStyle = 'rgba(251,146,60,0.32)'
      ctx.beginPath()
      ctx.moveTo(PX, PY)
      ctx.arc(PX, PY, R - 4, -Math.PI / 2, -Math.PI / 2 + sweep)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
      stroke(ctx, [[PX, PY], [PX, PY - R]], { seed: 'r0', color: ORANGE, width: 3, progress: 1 })
      stroke(ctx, ellipse(PX, PY, R, R, -Math.PI / 2, sweep), { seed: 'arc', color: ORANGE, width: 4, progress: 1 })
      stroke(ctx, [[PX, PY], [PX + Math.cos(-Math.PI / 2 + sweep) * R, PY + Math.sin(-Math.PI / 2 + sweep) * R]], { seed: 'r1', color: ORANGE, width: 3, progress: 1 })
    }
    text(ctx, Math.round(60 * wp) + '%', PX + 52, PY + 26, { size: 44, color: ORANGE, alpha: prog(wp, 0.05, 0.2) })
    text(ctx, '一個月・全隊工作量', PX, PY + R + 38, { size: 22, color: CHALK, progress: prog(t, c('month') + 0.3, 0.9) })
    // 「壓測失敗率」：座標軸＋折線先在高處晃；「從 62.8%」：起點與標籤；「降到 0.03%」：折線一路跌到地板
    var OX = 560, OY = 435, TOP = 165, RIGHT = 905
    var ct = c('stress')
    stroke(ctx, [[OX, TOP], [OX, OY], [RIGHT, OY]], { seed: 'axes', color: CHALK, width: 2.5, progress: prog(t, ct, 0.7) })
    text(ctx, '壓測失敗率', (OX + RIGHT) / 2, OY + 36, { size: 22, color: CHALK, progress: prog(t, ct + 0.25, 0.6) })
    var pts = [[590, 198], [630, 210], [665, 190], [700, 215], [735, 240], [770, 330], [805, 400], [840, 416], [880, 418]]
    // 折線分兩段：前五點是高原（念「壓測失敗率…從 62.8%」時慢慢畫），後四點是下跌（念「降到」時一口氣畫完）
    var FLAT = 0.4 // 前五點佔整條折線長度的比例（168 / 421 px）
    var ft = c('from')
    var lp = FLAT * easeInOut(prog(t, ct + 0.6, c('down') - ct - 0.6)) + (1 - FLAT) * easeInOut(prog(t, c('down'), 0.9))
    stroke(ctx, ellipse(590, 198, 6, 6), { seed: 'p0', color: BLUE, width: 2.5, progress: prog(t, ft, 0.4) })
    text(ctx, '62.8%', 650, 170, { size: 28, color: BLUE, progress: prog(t, ft + 0.1, 0.7) })
    stroke(ctx, pts, { seed: 'line', color: BLUE, width: 3.5, progress: lp })
    var dt = c('down')
    var ep = prog(t, dt + 0.8, 0.4)
    stroke(ctx, ellipse(880, 418, 7, 7), { seed: 'p1', color: ORANGE, width: 3, progress: ep })
    text(ctx, '0.03%', 835, 385, { size: 30, color: ORANGE, progress: prog(t, dt + 0.6, 0.6) })
    sparkle(ctx, 905, 380, 9, ORANGE, prog(t, dt + 1.2, 0.5), 'ps')
  }

  // --- toolsmith：Dock 上 12 個圖示一個個跳出來 ---
  var APPS = [
    { nm: '終端機', glyph: 'term' }, { nm: '截圖', glyph: 'cam' }, { nm: '語音', glyph: 'mic' }, { nm: '輸入法', glyph: '注' },
    { nm: '手勢', glyph: '手' }, { nm: '電量', glyph: 'bat' }, { nm: '下載', glyph: 'dl' }, { nm: '靈動島', glyph: 'pill' },
    { nm: '收納', glyph: '藏' }, { nm: '筆記', glyph: '記' }, { nm: '側欄', glyph: '滑' }, { nm: '播放', glyph: 'play' },
  ]
  function appGlyph(ctx, g, x, y, p, seed) {
    var o = { seed: seed, color: CHALK, width: 2.2 }
    switch (g) {
      case 'term':
        text(ctx, '>_', x, y + 1, { size: 24, color: CHALK, progress: p }); break
      case 'cam':
        stroke(ctx, roundRect(x - 15, y - 9, 30, 20, 3), assign(o, { progress: p }))
        stroke(ctx, ellipse(x, y + 1, 6, 6), assign(o, { seed: seed + 'l', progress: prog(p, 0.4, 0.6) }))
        stroke(ctx, [[x - 6, y - 9], [x - 3, y - 14], [x + 3, y - 14], [x + 6, y - 9]], assign(o, { seed: seed + 't', progress: prog(p, 0.6, 0.4) })); break
      case 'mic':
        stroke(ctx, roundRect(x - 6, y - 15, 12, 20, 6), assign(o, { progress: p }))
        stroke(ctx, ellipse(x, y, 11, 11, Math.PI * 0.1, Math.PI * 0.8), assign(o, { seed: seed + 'c', progress: prog(p, 0.4, 0.4) }))
        stroke(ctx, [[x, y + 11], [x, y + 16]], assign(o, { seed: seed + 's', progress: prog(p, 0.8, 0.2) })); break
      case 'bat':
        stroke(ctx, roundRect(x - 15, y - 8, 26, 16, 3), assign(o, { progress: p }))
        stroke(ctx, [[x + 13, y - 3], [x + 13, y + 3]], assign(o, { seed: seed + 'n', width: 3, progress: prog(p, 0.6, 0.2) }))
        stroke(ctx, [[x - 11, y], [x + 2, y]], assign(o, { seed: seed + 'f', color: ORANGE, width: 6, progress: prog(p, 0.7, 0.3) })); break
      case 'dl':
        arrow(ctx, [x, y - 14], [x, y - 2], [x, y + 8], assign(o, { head: 9, progress: p }))
        stroke(ctx, [[x - 13, y + 14], [x + 13, y + 14]], assign(o, { seed: seed + 'b', progress: prog(p, 0.7, 0.3) })); break
      case 'pill':
        stroke(ctx, roundRect(x - 16, y - 7, 32, 14, 7), assign(o, { progress: p }))
        stroke(ctx, ellipse(x + 8, y, 3, 3), assign(o, { seed: seed + 'd', color: ORANGE, progress: prog(p, 0.6, 0.4) })); break
      case 'play':
        stroke(ctx, [[x - 9, y - 13], [x + 13, y], [x - 9, y + 13], [x - 9, y - 13]], assign(o, { color: ORANGE, progress: p })); break
      default:
        text(ctx, g, x, y + 1, { size: 26, color: CHALK, progress: p })
    }
  }
  function toolsmith(ctx, t, d, n) {
    var c = CUE.toolsmith
    title(ctx, '工具匠', t - c('smith'))
    // 「今年做了」：Dock 先畫；「十二個」：12 個圖示一個個跳出來，念到「終端機」前跳完
    var DY = 420
    stroke(ctx, roundRect(90, DY - 46, 780, 92, 18), { seed: 'dock', color: BLUE, width: 3, progress: easeOut(prog(t, c('year'), 0.6)) })
    var popStart = c('twelve'), popStep = (c('term') - 0.5 - popStart) / (APPS.length - 1)
    // 「終端機、截圖、輸入法」：念到時該圖示放大變橘＋拉線標名
    var callouts = { 0: c('term'), 1: c('cam'), 3: c('ime') }
    var count = 0
    APPS.forEach(function (a, i) {
      var x = 139 + i * 62
      var p = prog(t, popStart + i * popStep, 0.45)
      if (p <= 0) return
      count++
      var k = easeOutBack(p)
      // 被點名時像 Dock 放大
      var named = callouts[i] != null ? prog(t, callouts[i], 0.35) : 0
      var mag = 1 + 0.3 * Math.sin(Math.min(named, 1) * Math.PI) * (named > 0 && named < 1 ? 1 : 0) + (named >= 1 ? 0.12 : 0)
      ctx.save()
      ctx.translate(x, DY)
      ctx.scale(k * mag, k * mag)
      stroke(ctx, roundRect(-25, -25, 50, 50, 11), { seed: 'app' + i, color: named > 0 ? ORANGE : BLUE, width: 2.5, alpha: p })
      appGlyph(ctx, a.glyph, 0, 0, prog(p, 0.3, 0.7), 'g' + i)
      ctx.restore()
    })
    // 計數：12 個 macOS App
    var cnt = prog(t, c('year') + 0.2, 0.5)
    text(ctx, count + ' 個 macOS App', 480, 150, { size: 40, color: ORANGE, alpha: cnt })
    // 「每天都在用」
    text(ctx, '2026 · 每天都在用', 480, 200, { size: 22, color: MUTED, progress: prog(t, c('daily'), 0.8) })
    // 點名：終端機、截圖、輸入法
    var callY = { 0: 300, 1: 262, 3: 300 }
    Object.keys(callouts).forEach(function (key) {
      var i = +key
      var x = 139 + i * 62
      var cp = prog(t, callouts[i], 0.5)
      stroke(ctx, [[x, DY - 34], [x, callY[i] + 20]], { seed: 'lead' + i, color: ORANGE, width: 2, progress: prog(cp, 0, 0.5), alpha: 0.8 })
      text(ctx, APPS[i].nm, x, callY[i], { size: 26, color: ORANGE, progress: prog(cp, 0.4, 0.6) })
    })
  }

  // --- cta：兩個提問泡泡 → 信封 → email ---
  function cta(ctx, t, d, n) {
    var c = CUE.cta
    // 「如果你有系統要做穩」：左泡泡；「或想導入 AI 工作流」：右泡泡
    var b1 = prog(t, c('stable') + 0.2, 0.8)
    stroke(ctx, roundRect(100, 150, 300, 86, 16), { seed: 'bub1', color: BLUE, width: 3, progress: easeOut(b1) })
    stroke(ctx, [[220, 236], [236, 262], [250, 236]], { seed: 'tail1', color: BLUE, width: 3, progress: prog(b1, 0.8, 0.2) })
    text(ctx, '系統要做穩', 250, 193, { size: 30, progress: prog(t, c('stable') + 0.45, 0.8) })
    var b2 = prog(t, c('ai'), 0.8)
    stroke(ctx, roundRect(560, 150, 300, 86, 16), { seed: 'bub2', color: BLUE, width: 3, progress: easeOut(b2) })
    stroke(ctx, [[710, 236], [724, 262], [740, 236]], { seed: 'tail2', color: BLUE, width: 3, progress: prog(b2, 0.8, 0.2) })
    text(ctx, '導入 AI 工作流', 710, 193, { size: 30, progress: prog(t, c('ai') + 0.25, 0.8) })
    // 「歡迎來信」：信封＋ email；「我們聊聊」：標題「來聊聊吧」最後才寫上去
    var et = c('mail')
    var ep = prog(t, et, 0.9)
    var EX = 480, EY = 350
    stroke(ctx, roundRect(EX - 110, EY - 68, 220, 136, 8), { seed: 'env', color: CHALK, width: 3, progress: easeOut(prog(ep, 0, 0.6)) })
    stroke(ctx, [[EX - 110, EY - 68], [EX, EY + 8], [EX + 110, EY - 68]], { seed: 'flap', color: CHALK, width: 3, progress: prog(ep, 0.5, 0.5) })
    stroke(ctx, [[EX - 110, EY + 68], [EX - 30, EY - 10]], { seed: 'fl', color: CHALK, width: 2, progress: prog(ep, 0.8, 0.2), alpha: 0.6 })
    stroke(ctx, [[EX + 110, EY + 68], [EX + 30, EY - 10]], { seed: 'fr', color: CHALK, width: 2, progress: prog(ep, 0.8, 0.2), alpha: 0.6 })
    stroke(ctx, ellipse(EX, EY + 22, 10, 10), { seed: 'seal', color: ORANGE, width: 2.5, progress: prog(t, et + 0.9, 0.4) })
    text(ctx, 'lance70176@gmail.com', EX, 470, { size: 32, color: ORANGE, progress: prog(t, et + 0.3, 1.0) })
    title(ctx, '來聊聊吧', t - c('chat'))
    // 結尾停留：紙飛機從信封飛出去
    var fp = prog(t, n + 0.4, 2.2)
    if (fp > 0) {
      var k = easeInOut(fp)
      var px = EX + 120 + 300 * k
      var py = EY - 40 - 180 * k + Math.sin(k * Math.PI) * -30
      var a = -0.5 + k * 0.3
      ctx.save()
      ctx.translate(px, py)
      ctx.rotate(a)
      stroke(ctx, [[-18, 8], [22, 0], [-18, -10], [-10, 0], [-18, 8]], { seed: 'plane', color: ORANGE, width: 2.5, alpha: 1 - prog(fp, 0.85, 0.15) })
      stroke(ctx, [[-10, 0], [22, 0]], { seed: 'planem', color: ORANGE, width: 2, alpha: 1 - prog(fp, 0.85, 0.15) })
      ctx.restore()
      stroke(ctx, curve([EX + 115, EY - 45], [EX + 190, EY - 120], [px - 20, py + 6]), { seed: 'trail' + Math.floor(fp * 8), color: BLUE, width: 1.5, alpha: 0.5 * (1 - fp) })
    }
    sparkle(ctx, 330, 300, 10, BLUE, prog(t, n + 0.2, 0.5), 'cs1')
    sparkle(ctx, 640, 440, 8, ORANGE, prog(t, n + 0.6, 0.5), 'cs2')
    text(ctx, 'resume.master0987.com', 480, 515, { size: 18, color: MUTED, progress: prog(t, n + 0.3, 1) })
  }

  var RENDER = { intro: intro, money: money, pipeline: pipeline, proof: proof, toolsmith: toolsmith, cta: cta }

  /** 畫一整格：背景＋該幕。time 給背景脈衝用（減少動態時傳 0） */
  function drawFrame(ctx, sceneIndex, t, durations, time) {
    var s = SCENES[sceneIndex]
    var d = sceneDuration(s, durations)
    var n = d - (s.hold || 1)
    background(ctx, time == null ? t : time)
    RENDER[s.id](ctx, t, d, n)
  }

  var api = {
    W: W, H: H, FONT: FONT, SCENES: SCENES, RENDER: RENDER, sceneDuration: sceneDuration,
    background: background, drawFrame: drawFrame,
  }
  if (typeof document === 'undefined') return api

  // ---------- ③ 播放器（只在瀏覽器） ----------
  var BASE = (function () {
    var s = document.currentScript && document.currentScript.src
    return s ? s.slice(0, s.lastIndexOf('/') + 1) : 'explainer/'
  })()
  var MUTE_KEY = 'rex-explainer-muted'
  var fontReady = null
  function loadFont() {
    if (!fontReady) {
      fontReady = (window.FontFace ? new FontFace('Iansui', 'url(' + BASE + 'iansui-explainer.woff2?v=2)').load().then(function (f) { document.fonts.add(f) }) : Promise.resolve())
        .catch(function () {}) // 字型載不到就用後備字型，不擋播放
    }
    return fontReady
  }
  var durReady = null
  function loadDurations() {
    if (!durReady) durReady = fetch(BASE + 'durations.json?v=2').then(function (r) { return r.json() }).catch(function () { return {} })
    return durReady
  }

  var ICON = {
    play: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l12-7.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>',
    replay: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>',
    prev: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M6 5h2v14H6zM19 5v14L9 12z"/></svg>',
    next: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M16 5h2v14h-2zM5 5v14l10-7z"/></svg>',
    close: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    sound: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/></svg>',
    muted: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9l5 6M21 9l-5 6"/></svg>',
  }

  var CSS = '' +
    '.rx-ov{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;background:rgba(6,8,12,.82);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);padding:24px}' +
    '.rx-dlg{position:relative;width:100%;max-width:900px;max-height:100%;overflow:auto;background:#0f1115;color:#e6e8ee;border:1px solid #2a2f39;border-radius:14px;box-shadow:0 30px 60px -30px rgba(0,0,0,.8);font-family:"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif;display:flex;flex-direction:column}' +
    '.rx-hd{display:flex;align-items:center;justify-content:space-between;padding:10px 10px 6px 16px;font-family:"JetBrains Mono",ui-monospace,Menlo,monospace;font-size:12px;letter-spacing:.1em;color:#9aa1ae}' +
    '.rx-cv{position:relative;background:#171a21}' +
    '.rx-cv canvas{display:block;width:100%;height:auto;aspect-ratio:16/9}' +
    '.rx-ld{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#9aa1ae;font-size:14px}' +
    '.rx-cap{min-height:4.6em;padding:12px 20px 4px;display:flex;align-items:center;justify-content:center;text-align:center;font-size:17px;line-height:1.7;color:#e6e8ee}' +
    '.rx-seg{display:flex;gap:5px;padding:4px 18px 0}' +
    '.rx-seg button{flex:1;height:14px;padding:0;border:0;background:transparent;cursor:pointer;display:flex;align-items:center}' +
    '.rx-seg button span{display:block;width:100%;height:5px;border-radius:999px;background:#2a2f39;overflow:hidden}' +
    '.rx-seg button i{display:block;height:100%;background:#8fa3ff;width:0}' +
    '.rx-seg button.on i{background:#fb923c}' +
    '.rx-seg button:focus-visible{outline:2px solid #fb923c;outline-offset:2px;border-radius:6px}' +
    '.rx-ct{display:flex;align-items:center;justify-content:space-between;padding:6px 10px 10px}' +
    '.rx-ct .mid{display:flex;align-items:center;gap:6px}' +
    '.rx-b{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;border:0;background:transparent;color:#d7dbe4;cursor:pointer}' +
    '.rx-b:hover{background:rgba(255,255,255,.08)}.rx-b:disabled{opacity:.3;cursor:default}' +
    '.rx-b:focus-visible{outline:2px solid #fb923c;outline-offset:2px}' +
    '.rx-b.main{width:48px;height:48px;background:#8fa3ff;color:#0f1115}.rx-b.main:hover{background:#a9b8ff}' +
    '.rx-end{display:flex;flex-wrap:wrap;gap:10px;justify-content:center}' +
    '.rx-end a,.rx-end button{display:inline-flex;align-items:center;gap:6px;padding:9px 18px;border-radius:8px;font-weight:700;font-size:14.5px;text-decoration:none;border:1.5px solid #8fa3ff;cursor:pointer;font-family:inherit;background:transparent;color:#8fa3ff}' +
    '.rx-end a.solid{background:#8fa3ff;color:#0f1115}' +
    '@media (max-width:720px){.rx-ov{padding:0}.rx-dlg{max-width:none;height:100%;border-radius:0;border:0;justify-content:center}.rx-cap{font-size:15.5px;min-height:5.2em}}' +
    '@media (prefers-reduced-motion:reduce){.rx-ov{backdrop-filter:none;-webkit-backdrop-filter:none}}' +
    'body.rx-lock{overflow:hidden}'

  var styleEl = null
  function ensureStyle() {
    if (styleEl) return
    styleEl = document.createElement('style')
    styleEl.textContent = CSS
    document.head.appendChild(styleEl)
  }

  function el(tag, cls, html) {
    var e = document.createElement(tag)
    if (cls) e.className = cls
    if (html != null) e.innerHTML = html
    return e
  }

  /**
   * 開啟播放器。
   * opts.audio：按鈕點擊時已建立並解鎖（靜音 play 過）的 Audio，iOS 才允許之後自動播放旁白
   * opts.unlocked：解鎖流程的 Promise
   * opts.returnFocus：關閉後焦點要回去的元素
   */
  function open(opts) {
    opts = opts || {}
    ensureStyle()
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    var audio = opts.audio || new Audio()
    audio.preload = 'auto'
    var muted = false
    try { muted = localStorage.getItem(MUTE_KEY) === '1' } catch (e) {}
    var durations = {}
    var LAST = SCENES.length - 1
    var durOf = function (i) { return sceneDuration(SCENES[i], durations) }

    // DOM
    var ov = el('div', 'rx-ov')
    ov.setAttribute('role', 'dialog')
    ov.setAttribute('aria-modal', 'true')
    ov.setAttribute('aria-label', '1 分鐘認識我：動畫介紹')
    var dlg = el('div', 'rx-dlg')
    var hd = el('div', 'rx-hd')
    hd.appendChild(el('span', null, '1 MIN · ABOUT REX'))
    var closeBtn = el('button', 'rx-b', ICON.close)
    closeBtn.type = 'button'
    closeBtn.setAttribute('aria-label', '關閉')
    hd.appendChild(closeBtn)
    var cvWrap = el('div', 'rx-cv')
    var cv = document.createElement('canvas')
    cv.setAttribute('aria-hidden', 'true')
    var loading = el('div', 'rx-ld', '載入中…')
    cvWrap.appendChild(cv)
    cvWrap.appendChild(loading)
    var cap = el('div', 'rx-cap')
    cap.setAttribute('aria-live', 'polite')
    var seg = el('div', 'rx-seg')
    seg.setAttribute('aria-label', '幕')
    var segBtns = SCENES.map(function (s, i) {
      var b = el('button', null, '<span><i></i></span>')
      b.type = 'button'
      b.setAttribute('aria-label', '第 ' + (i + 1) + ' 幕')
      b.addEventListener('click', function () { goto(i) })
      seg.appendChild(b)
      return b
    })
    var ct = el('div', 'rx-ct')
    var spacer = el('span')
    spacer.style.width = '40px'
    var mid = el('div', 'mid')
    var prevBtn = el('button', 'rx-b', ICON.prev); prevBtn.type = 'button'; prevBtn.setAttribute('aria-label', '上一幕')
    var playBtn = el('button', 'rx-b main', ICON.play); playBtn.type = 'button'; playBtn.setAttribute('aria-label', '播放')
    var nextBtn = el('button', 'rx-b', ICON.next); nextBtn.type = 'button'; nextBtn.setAttribute('aria-label', '下一幕')
    mid.appendChild(prevBtn); mid.appendChild(playBtn); mid.appendChild(nextBtn)
    var muteBtn = el('button', 'rx-b', muted ? ICON.muted : ICON.sound); muteBtn.type = 'button'
    muteBtn.setAttribute('aria-label', muted ? '開啟聲音' : '關閉聲音')
    ct.appendChild(spacer); ct.appendChild(mid); ct.appendChild(muteBtn)
    dlg.appendChild(hd); dlg.appendChild(cvWrap); dlg.appendChild(cap); dlg.appendChild(seg); dlg.appendChild(ct)
    ov.appendChild(dlg)
    document.body.appendChild(ov)
    document.body.classList.add('rx-lock')

    // 狀態：RAF 迴圈直接讀這個物件
    var st = { scene: 0, elapsed: 0, playing: false, clock: 0, ended: false, ready: false }
    var raf = 0
    var ctx = cv.getContext('2d')
    var dpr = Math.min(window.devicePixelRatio || 1, 2)
    cv.width = W * dpr
    cv.height = H * dpr

    function setCaption(i) { cap.textContent = SCENES[i].caption || SCENES[i].line }
    function syncButtons() {
      playBtn.innerHTML = st.playing ? ICON.pause : st.ended ? ICON.replay : ICON.play
      playBtn.setAttribute('aria-label', st.playing ? '暫停' : st.ended ? '再看一次' : '播放')
      prevBtn.disabled = st.scene === 0
      nextBtn.disabled = st.scene === LAST
      segBtns.forEach(function (b, i) { b.classList.toggle('on', i === st.scene) })
    }
    function paint() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      drawFrame(ctx, st.scene, st.elapsed, durations, reduced ? 0 : st.clock)
      var d = durOf(st.scene)
      segBtns.forEach(function (b, i) {
        b.firstChild.firstChild.style.width = (i < st.scene ? 100 : i === st.scene ? Math.min(1, st.elapsed / d) * 100 : 0) + '%'
      })
    }
    function src(i) { return BASE + 'audio/' + SCENES[i].id + '.mp3' }

    function goto(i, autoplay) {
      st.scene = i
      var play = autoplay == null ? st.playing : autoplay
      // 減少動態模式下手動切幕：直接顯示完成畫面
      st.elapsed = reduced && !play ? durOf(i) : 0
      st.playing = play
      st.ended = false
      setCaption(i)
      syncButtons()
      audio.src = src(i)
      if (play) audio.play().catch(function () {})
      if (!st.playing) paint()
    }

    var last = 0
    function frame(now) {
      if (!st.ready) return
      var dt = Math.min(0.1, (now - last) / 1000) // 分頁切走回來不要一次跳太多
      last = now
      var d = durOf(st.scene)
      if (st.playing) {
        st.elapsed += dt
        st.clock += dt
        if (st.elapsed >= d) {
          if (st.scene < LAST) goto(st.scene + 1, true)
          else {
            st.elapsed = d
            st.playing = false
            st.ended = true
            syncButtons()
          }
        }
      } else if (!reduced) {
        st.clock += dt // 暫停時背景脈衝照跑
      }
      paint()
      raf = requestAnimationFrame(frame)
    }

    function togglePlay() {
      if (st.ended) { goto(0, true); return }
      if (st.playing) {
        st.playing = false
        audio.pause()
      } else {
        // 減少動態模式下停在完成畫面，按播放就從頭播這一幕
        if (st.elapsed >= durOf(st.scene)) st.elapsed = 0
        st.playing = true
        if (st.elapsed < (audio.duration || Infinity)) {
          try { audio.currentTime = st.elapsed } catch (e) {}
          audio.play().catch(function () {})
        }
      }
      syncButtons()
    }

    function close() {
      cancelAnimationFrame(raf)
      st.ready = false
      audio.pause()
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('visibilitychange', onHide)
      document.body.classList.remove('rx-lock')
      if (ov.parentNode) ov.parentNode.removeChild(ov)
      if (opts.returnFocus && opts.returnFocus.focus) opts.returnFocus.focus()
    }
    function onKey(e) {
      if (e.key === 'Escape') close()
      else if (e.key === ' ' && !/^(BUTTON|A)$/.test(document.activeElement && document.activeElement.tagName)) { e.preventDefault(); togglePlay() }
      else if (e.key === 'ArrowLeft') goto(Math.max(0, st.scene - 1))
      else if (e.key === 'ArrowRight') { if (st.scene < LAST) goto(st.scene + 1) }
      else if (e.key === 'Tab') {
        // 焦點留在彈窗內
        var f = dlg.querySelectorAll('button:not(:disabled),a[href]')
        if (!f.length) return
        var first = f[0], lastEl = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus() }
        else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus() }
      }
    }
    // 切到別的分頁時瀏覽器會停掉動畫，旁白也要跟著暫停，回來才不會對不上
    function onHide() { if (document.hidden && st.playing) togglePlay() }

    ov.addEventListener('click', function (e) { if (e.target === ov) close() })
    closeBtn.addEventListener('click', close)
    prevBtn.addEventListener('click', function () { goto(Math.max(0, st.scene - 1)) })
    nextBtn.addEventListener('click', function () { if (st.scene < LAST) goto(st.scene + 1) })
    playBtn.addEventListener('click', togglePlay)
    muteBtn.addEventListener('click', function () {
      muted = !muted
      audio.muted = muted
      muteBtn.innerHTML = muted ? ICON.muted : ICON.sound
      muteBtn.setAttribute('aria-label', muted ? '開啟聲音' : '關閉聲音')
      try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0') } catch (e) {}
    })
    document.addEventListener('keydown', onKey)
    document.addEventListener('visibilitychange', onHide)
    setCaption(0)
    syncButtons()
    closeBtn.focus()

    // 開場：等字型、秒數表與音訊解鎖後才開始，避免第一幕字型跳動
    Promise.all([loadFont(), loadDurations(), opts.unlocked || Promise.resolve()]).then(function (r) {
      durations = r[1] || {}
      audio.muted = muted // 解鎖流程結束後才套用靜音偏好（解鎖會把 muted 改回 false）
      loading.remove()
      st.ready = true
      last = performance.now()
      goto(0, !reduced)
      raf = requestAnimationFrame(frame)
    })
    return { close: close }
  }

  api.open = open
  return api
})
