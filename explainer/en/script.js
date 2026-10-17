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
      cues: { me: 0, years: 2.1, ecom: 3.2, pay: 4.1, overseas: 5.2, now: 6.6, pipeline: 7.4, line: 8 },
    },
    {
      id: 'money',
      line: 'What I care about most: the money can never be wrong. Timeouts, duplicate credits, reconciliation — I build them in from day one.',
      caption: 'What I care about most: the money can never be wrong. Timeouts, duplicate credits, reconciliation — I build them in from day one.',
      anchors: { care: 'What', money: 'money', timeout: 'Timeouts', dup: 'duplicate', recon: 'reconciliation', day1: 'from', putin: 'one' },
      cues: { care: 0, money: 1.4, timeout: 3.2, dup: 3.9, recon: 4.8, day1: 6.3, putin: 6.8 },
    },
    {
      id: 'pipeline',
      line: 'I own the architecture and the breakdown. Multiple AI agents build in parallel, each in its own workspace. Then cross-model review and diff testing — and I gate the release.',
      caption: 'I own the architecture and the breakdown. Multiple AI agents build in parallel, each in its own workspace. Then cross-model review and diff testing — and I gate the release.',
      anchors: { architect: 'I', agents: 'Multiple', parallel: 'parallel', review: 'cross-model', diff: 'diff', gate: 'gate', launch: 'release' },
      cues: { architect: 0, agents: 2.2, parallel: 3.4, review: 5.6, diff: 6.6, gate: 7.6, launch: 8.1 },
    },
    {
      id: 'proof',
      line: "The result: in one month, I delivered sixty percent of the team's work. Load-test failures: from sixty-two point eight percent, down to zero point zero three.",
      caption: "The result: in one month, I delivered 60% of the team's work. Load-test failures: from 62.8%, down to 0.03%.",
      anchors: { result: 'The', month: 'one', sixty: 'sixty', stress: 'Load-test', from: 'from', down: 'down' },
      cues: { result: 0, month: 1.1, sixty: 2.4, stress: 4.0, from: 5.2, down: 7.0 },
    },
    {
      id: 'toolsmith',
      line: "I'm also a toolsmith. This year I built twelve macOS apps — a terminal, a screenshot tool, an input method — and I use them every day.",
      caption: "I'm also a toolsmith. This year I built 12 macOS apps — a terminal, a screenshot tool, an input method — and I use them every day.",
      anchors: { smith: "I'm", year: 'This', twelve: 'twelve', term: 'terminal', cam: 'screenshot', ime: 'input', daily: 'every' },
      cues: { smith: 0, year: 1.4, twelve: 2.1, term: 3.4, cam: 4.0, ime: 4.8, daily: 6.0 },
    },
    {
      id: 'cta',
      line: "If you need a system made solid, or want AI in your workflow, drop me an email — let's talk.",
      caption: "If you need a system made solid, or want AI in your workflow, drop me an email — let's talk.",
      anchors: { stable: 'If', ai: 'want', mail: 'drop', chat: "let's" },
      cues: { stable: 0, ai: 1.7, mail: 3.3, chat: 4.3 },
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
