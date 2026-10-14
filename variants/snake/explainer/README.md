# Snake 版「1 分鐘認識我」配音

2026-10-14 起，Snake 版六幕旁白全部改用**本人聲音**：在筆電用 [Voicebox](https://github.com/jamiepine/voicebox) v0.5.0
（Qwen3-TTS 1.7B）克隆聲音「Rex 的聲音」產生。Rex 版仍是 Gemini TTS（Charon）的配音，沒有更動。

- `audio/<幕>.mp3`、`durations.json`：由 `tools/gen-explainer-audio.mjs --from … --out variants/snake/explainer` 產出
- `cues.json`：各幕畫面元素出現秒數，`tools/build-variant.mjs` 產 Snake 站時蓋掉 `explainer/script.js` 的 cues
  （本檔與 cues.json 不會複製到網站）

## 改了幕稿（script.js 的 line）要重錄

```sh
# 1. 筆電（Voicebox 開著）：產生並自動挑念對的版本，產出 <資料夾>/<幕>.wav
uv run --with mlx-whisper --with pypinyin python tools/voicebox/gen_takes.py ~/vb-snake money
# 2. 去頭尾靜音、轉 mp3、量秒數與子句起點
node tools/gen-explainer-audio.mjs --from ~/vb-snake --out variants/snake/explainer
# 3. 重算 cues（以 Rex 配音的逐字時間為錨點換算）
uv run --with mlx-whisper --with pypinyin python tools/voicebox/align_cues.py
# 4. 產站
# 先把 tools/build-variant.mjs 裡 Snake 配音的 ?v=sN 加一，否則 CDN／瀏覽器會混用新舊配音
node tools/build-variant.mjs snake ~/projects/case/resume-snake-site
```

聽寫比對只能抓到明顯念錯，產完仍要自己聽一次。第一次使用的 seed：intro 1、money 2、pipeline 1、proof 1、toolsmith 123、cta 1。
