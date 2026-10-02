// 「1 分鐘認識我」動畫的幕稿。
// line＝配音稿（數字用國字，讓 tools/gen-explainer-audio.mjs 的聽寫比對過），
// caption＝畫面字幕（阿拉伯數字版）。改了 line 要重跑 tools/gen-explainer-audio.mjs
// 重新產生 explainer/audio/<id>.mp3 與 explainer/durations.json。
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
    },
    {
      id: 'money',
      line: '我最在意的是：錢不能錯。逾時、重複入帳、對帳補救，我在設計的第一天就放進去。',
      caption: '我最在意的是：錢不能錯。逾時、重複入帳、對帳補救，我在設計的第一天就放進去。',
    },
    {
      id: 'pipeline',
      line: '我負責架構與拆解；多個 AI agent 在各自的工作區平行開發，經過跨模型審查與對拍，最後由我把關上線。',
      caption: '我負責架構與拆解；多個 AI agent 在各自的工作區平行開發，經過跨模型審查與對拍，最後由我把關上線。',
    },
    {
      id: 'proof',
      line: '結果是，一個月交付全隊百分之六十的工作量；壓測失敗率，從百分之六十二點八，降到百分之零點零三。',
      caption: '結果是，一個月交付全隊 60% 的工作量；壓測失敗率，從 62.8% 降到 0.03%。',
    },
    {
      id: 'toolsmith',
      line: '我也是工具匠。今年做了十二個 macOS App，終端機、截圖、輸入法，每天都在用。',
      caption: '我也是工具匠。今年做了 12 個 macOS App，終端機、截圖、輸入法，每天都在用。',
    },
    {
      id: 'cta',
      line: '如果你有系統要做穩，或想導入 AI 工作流，歡迎來信，我們聊聊。',
      caption: '如果你有系統要做穩，或想導入 AI 工作流，歡迎來信，我們聊聊。',
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
