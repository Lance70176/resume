// 「1 分鐘認識我」動畫的幕稿。
// line＝配音稿（數字用國字，讓 tools/gen-explainer-audio.mjs 的聽寫比對過），
// caption＝畫面字幕（阿拉伯數字版）。改了 line 要重跑 tools/gen-explainer-audio.mjs
// 重新產生 explainer/audio/<id>.mp3 與 explainer/durations.json。
// cues＝旁白念到各關鍵詞的秒數（從該幕配音開頭算），explainer.js 用它決定每個畫面元素何時出現，
// 「念到什麼就畫什麼」。量法：ffmpeg silencedetect（noise=-35dB:d=0.12）的靜音結束點＝子句起點，
// gen-explainer-audio.mjs 會把它寫進 durations.json 的 <id>_pauses；子句內的詞（例如「十六年」）
// 再用聽的估。重產配音後務必對照 <id>_pauses 更新這裡的 cues。
// 瀏覽器與 Node（配音腳本、預覽腳本）共用同一份：瀏覽器掛在 window.REX_EXPLAINER_SCRIPT。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory()
  else root.REX_EXPLAINER_SCRIPT = factory()
})(typeof self !== 'undefined' ? self : this, function () {
  var SCENES = [
    {
      id: 'intro',
      line: '我是 Rex，寫了十六年的系統。從電商、行動支付，到海外平台；現在，我用 AI agent 產線交付。',
      caption: '我是 Rex，寫了 16 年的系統。從電商、行動支付，到海外平台；現在，我用 AI agent 產線交付。',
      cues: { me: 0, years: 1.5, ecom: 2.94, pay: 3.86, overseas: 5.08, now: 6.54, pipeline: 7.3, line: 8.3 },
    },
    {
      id: 'money',
      line: '我最在意的是：錢不能錯。逾時、重複入帳、對帳補救，我在設計的第一天就放進去。',
      caption: '我最在意的是：錢不能錯。逾時、重複入帳、對帳補救，我在設計的第一天就放進去。',
      cues: { care: 0, money: 1.29, timeout: 3.04, dup: 3.84, recon: 5.09, day1: 6.26, putin: 7.07 },
    },
    {
      id: 'pipeline',
      line: '我負責架構與拆解；多個 AI agent 在各自的工作區平行開發，經過跨模型審查與對拍，最後由我把關上線。',
      caption: '我負責架構與拆解；多個 AI agent 在各自的工作區平行開發，經過跨模型審查與對拍，最後由我把關上線。',
      cues: { architect: 0, agents: 2.28, parallel: 4.6, review: 5.93, diff: 7.4, gate: 8.31, launch: 9.3 },
    },
    {
      id: 'proof',
      line: '結果是，一個月交付全隊百分之六十的工作量；壓測失敗率，從百分之六十二點八，降到百分之零點零三。',
      caption: '結果是，一個月交付全隊 60% 的工作量；壓測失敗率，從 62.8% 降到 0.03%。',
      cues: { result: 0, month: 1.2, sixty: 2.6, stress: 4.63, from: 5.69, down: 7.44 },
    },
    {
      id: 'toolsmith',
      line: '我也是工具匠。今年做了十二個 macOS App，終端機、截圖、輸入法，每天都在用。',
      caption: '我也是工具匠。今年做了 12 個 macOS App，終端機、截圖、輸入法，每天都在用。',
      cues: { smith: 0, year: 1.28, twelve: 1.9, term: 4.01, cam: 4.94, ime: 5.76, daily: 6.74 },
    },
    {
      id: 'cta',
      line: '如果你有系統要做穩，或想導入 AI 工作流，歡迎來信，我們聊聊。',
      caption: '如果你有系統要做穩，或想導入 AI 工作流，歡迎來信，我們聊聊。',
      cues: { stable: 0, ai: 1.88, mail: 3.7, chat: 4.68 },
      hold: 3, // 結尾多停 3 秒給信封與 email
    },
  ]

  /** 整幕長度＝配音秒數＋停留秒數（預設 1） */
  function sceneDuration(s, audioSec) {
    var a = audioSec && typeof audioSec[s.id] === 'number' ? audioSec[s.id] : 5
    return a + (s.hold || 1)
  }

  return { SCENES: SCENES, sceneDuration: sceneDuration }
})
