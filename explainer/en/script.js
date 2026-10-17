// 「1 分鐘認識我」英文版幕稿（/en/ 頁面用）。動畫引擎與中文版共用 explainer/explainer.js，
// 畫面上的字與播放器介面字串放在 TEXT（沒列到的就沿用中文）。
// line＝配音稿、caption＝字幕；cues＝念到各關鍵詞的秒數，由 tools/voicebox/en_cues.py 依 anchors
// （每個 cue 對應旁白裡的哪個英文詞，同一個詞出現多次時寫成「詞#第幾次」）用 whisper 逐字時間戳算出並改寫這裡，
// 不要手改。配音在 explainer/en/audio/，重錄後要升 VER（Snake 版由 build-variant 改成 s 開頭）。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory()
  else root.RESUME_EXPLAINER_SCRIPT = factory()
})(typeof self !== 'undefined' ? self : this, function () {
  var SCENES = [
    {
      id: 'intro',
      line: "Hi, I'm Rex. I've been building systems for sixteen years — from e-commerce and mobile payments to overseas platforms. Now, I ship with an AI agent pipeline.",
      caption: "Hi, I'm Rex. I've been building systems for 16 years — from e-commerce and mobile payments to overseas platforms. Now, I ship with an AI agent pipeline.",
      anchors: { me: 'Hi', years: 'sixteen', ecom: 'e-commerce', pay: 'mobile', overseas: 'overseas', now: 'Now', pipeline: 'AI', line: 'pipeline' },
      cues: { me: 0, years: 3.42, ecom: 4.92, pay: 5.68, overseas: 6.58, now: 7.98, pipeline: 9.2, line: 9.84 },
    },
    {
      id: 'money',
      line: 'What I care about most: the money can never be wrong. Timeouts, duplicate credits, reconciliation — I build them in from day one.',
      caption: 'What I care about most: the money can never be wrong. Timeouts, duplicate credits, reconciliation — I build them in from day one.',
      anchors: { care: 'What', money: 'money', timeout: 'Timeouts', dup: 'duplicate', recon: 'reconciliation', day1: 'from', putin: 'one' },
      cues: { care: 0, money: 2.38, timeout: 4.28, dup: 5.18, recon: 6.82, day1: 9.28, putin: 9.8 },
    },
    {
      id: 'pipeline',
      line: 'I own the architecture and the breakdown. Multiple AI agents build in parallel, each in its own workspace. Then cross-model review and diff testing — and I sign off on the release.',
      caption: 'I own the architecture and the breakdown. Multiple AI agents build in parallel, each in its own workspace. Then cross-model review and diff testing — and I sign off on the release.',
      anchors: { architect: 'I', agents: 'Multiple', parallel: 'parallel', review: 'cross-model', diff: 'diff', gate: 'sign', launch: 'release' },
      cues: { architect: 0, agents: 3.14, parallel: 5.24, review: 8.22, diff: 9.6, gate: 11.2, launch: 12.18 },
    },
    {
      id: 'proof',
      line: "The result: in one month, I delivered sixty percent of the team's work. Load-test failures: from sixty-two point eight percent, down to zero point zero three.",
      caption: "The result: in one month, I delivered 60% of the team's work. Load-test failures: from 62.8%, down to 0.03%.",
      anchors: { result: 'The', month: 'one', sixty: 'sixty', stress: 'Load-test', from: 'from', down: 'down' },
      cues: { result: 0, month: 1.58, sixty: 2.8, stress: 5.28, from: 6.8, down: 8.98 },
    },
    {
      id: 'toolsmith',
      line: "I'm also a toolsmith. This year I built twelve macOS apps — a terminal, a screenshot tool, an input method — and I use them every day.",
      caption: "I'm also a toolsmith. This year I built 12 macOS apps — a terminal, a screenshot tool, an input method — and I use them every day.",
      anchors: { smith: "I'm", year: 'This', twelve: 'twelve', term: 'terminal', cam: 'screenshot', ime: 'input', daily: 'every' },
      cues: { smith: 0, year: 2.04, twelve: 3.5, term: 5.98, cam: 6.74, ime: 8.06, daily: 10.24 },
    },
    {
      id: 'cta',
      line: "If you need a system made solid, or want AI in your workflow, drop me an email — let's talk.",
      caption: "If you need a system made solid, or want AI in your workflow, drop me an email — let's talk.",
      anchors: { stable: 'If', ai: 'want', mail: 'drop', chat: "let's" },
      cues: { stable: 0, ai: 2.4, mail: 4.38, chat: 5.86 },
      hold: 3,
    },
  ]

  var TEXT = {
    hi: "Hi, I'm Rex", years: '16 years', pipeline: 'AI agent pipeline',
    ecom: 'E-commerce', pay: 'Mobile pay', overseas: 'Overseas', now: 'Now',
    ledgerA: 'Ledger A', ledgerB: 'Ledger B', money: "Money can't be wrong",
    timeout: 'Timeout', dup: 'Duplicate', recon: 'Reconcile', day1: 'from the start',
    architect: 'Architect', parallel: '4 agents in parallel', review: 'Cross-review · diff', gate: 'Gate', launch: 'Ship',
    result: 'Numbers talk', month: "1 month · team's output", stress: 'Load-test failure rate',
    smith: 'Toolsmith', apps: ' macOS apps', daily: '2026 · used every day',
    app0: 'Terminal', app1: 'Screenshot', app3: 'Input method',
    // Dock 圖示裡原本是中文字當圖案，英文版換成英文字
    glyph3: 'Aa', glyph4: 'Hi', glyph8: '···', glyph9: 'MD', glyph10: '|<',
    stable: 'Make it solid', ai: 'Bring in AI', chat: "Let's talk",
    url: 'resume-rex.master0987.com/en',
    'ui.dialog': 'Meet me in 1 minute: animated intro', 'ui.close': 'Close', 'ui.loading': 'Loading…',
    'ui.scenes': 'Scenes', 'ui.scene': 'Scene #', 'ui.prev': 'Previous scene', 'ui.next': 'Next scene',
    'ui.play': 'Play', 'ui.pause': 'Pause', 'ui.replay': 'Watch again', 'ui.mute': 'Mute', 'ui.unmute': 'Unmute',
  }

  /** 整幕長度＝配音秒數＋停留秒數（預設 1） */
  function sceneDuration(s, audioSec) {
    var a = audioSec && typeof audioSec[s.id] === 'number' ? audioSec[s.id] : 5
    return a + (s.hold || 1)
  }

  return { SCENES: SCENES, TEXT: TEXT, DIR: 'en/', VER: 'en1', sceneDuration: sceneDuration }
})
