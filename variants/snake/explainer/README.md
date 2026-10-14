# 「1 分鐘認識我」配音（兩版）

2026-10-14 起兩版旁白都是**本人聲音**：在筆電用 [Voicebox](https://github.com/jamiepine/voicebox) v0.5.0
（Qwen3-TTS 1.7B）克隆聲音「Rex 的聲音」產生，取代原本的 Gemini TTS（Charon）。
兩版只有開場念的名字不同：

- Rex 版（原始碼 `explainer/`）：六幕 mp3＋durations.json，cues 在 `explainer/script.js`
- Snake 版（本目錄）：只放 `audio/intro.mp3`（「我是 Snake」）＋durations.json＋`cues.json`（開場 cues），
  其餘五幕沿用 Rex 版。本檔與 cues.json 不會複製到網站
- 播放速度：`explainer/explainer.js` 的 `SPEED`（目前 1.2），畫面與旁白一起加快；cues／durations 都是原速秒數

## 改了幕稿（script.js 的 line）要重錄

```sh
# 0. 先備份舊配音當對齊基準
cp -R explainer /tmp/old-explainer
# 1. 筆電（Voicebox 開著）：產生並自動挑念對的版本，產出 <資料夾>/<幕>.wav
uv run --with mlx-whisper --with pypinyin python tools/voicebox/gen_takes.py ~/vb-rex --name Rex money
# 2. 去頭尾靜音、轉 mp3、量秒數與子句起點
node tools/gen-explainer-audio.mjs --from ~/vb-rex
# 3. 重算 Rex 版 cues（以舊配音的逐字時間為錨點換算，直接改寫 script.js）
uv run --with mlx-whisper --with pypinyin python tools/voicebox/align_cues.py --ref /tmp/old-explainer --target explainer --name Rex money
# 4. 改到開場時，Snake 開場也要重錄並對齊（以新的 Rex 版為基準）
uv run --with mlx-whisper --with pypinyin python tools/voicebox/gen_takes.py ~/vb-snake intro
node tools/gen-explainer-audio.mjs --from ~/vb-snake --out variants/snake/explainer intro
uv run --with mlx-whisper --with pypinyin python tools/voicebox/align_cues.py intro
# 5. 升版號（index.html／explainer.js 的 ?v=N，build-variant.mjs 的 Snake ?v=sN），再產兩站
node tools/build-variant.mjs rex ~/projects/case/resume-site
node tools/build-variant.mjs snake ~/projects/case/resume-snake-site
```

**注意：** Snake 的 durations.json 是整份覆蓋，其餘五幕的秒數要跟 Rex 版一致。步驟 4 用 `--out` 只跑 intro，
會讀進既有檔案、只更新 intro，但 Rex 版其他幕改過時要先把 explainer/durations.json 複製過來再跑。

聽寫比對只能抓到明顯念錯，產完仍要自己聽一次。使用的 seed：Rex 開場 1、Snake 開場 1、money 2、pipeline 1、proof 1、toolsmith 123、cta 1。
