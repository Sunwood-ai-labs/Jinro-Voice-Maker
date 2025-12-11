# Jinro Voice Maker

![](https://github.com/user-attachments/assets/ed9d31d5-a5fb-4a35-abf7-7615a4c9c4fa)

<div align="center">
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
  <br />
  <img src="https://img.shields.io/badge/Google%20GenAI%20SDK-8E75B2?style=for-the-badge&logo=google&logoColor=white" alt="Google GenAI SDK" />
  <img src="https://img.shields.io/badge/Gemini_API-4285F4?style=for-the-badge&logo=google&logoColor=white" alt="Gemini API" />
</div>

<br />

**Jinro Voice Maker** は、人狼ゲーム（Jinro Game）の没入感を高めるために設計された音声生成Webアプリケーションです。Google Gemini APIの強力なマルチモーダル機能とテキスト読み上げ（TTS）機能を活用し、ゲームマスターや各役職のドラマチックなセリフを瞬時に生成・再生します。

## 🐺 概要

人狼ゲームの進行において、「雰囲気作り」は非常に重要です。このアプリを使えば、プロのナレーターや声優のようなボイスを生成し、ゲームの進行（昼の議論、夜の密談、朝の死体発見など）を盛り上げることができます。

## ✨ 主な機能

*   **役職別ボイス生成**: ゲームマスター、人狼、占い師、狂人など、各役職に最適化された声色とトーンでセリフを生成します。
*   **演技指導 (Dramatize)**: Gemini 2.5 Flash を使用し、入力した単純なテキストを、指定した役職になりきったドラマチックなセリフに書き換えます。
*   **会話モード / 議論モード**:
    *   **夜の会話**: 人狼同士の密談など、静かで不気味なシチュエーションの台本と音声を一括生成。
    *   **昼の議論**: 緊迫した疑い合いや弁明の応酬をシミュレート。
*   **多言語対応**: 日本語だけでなく、英語、中国語、韓国語など多言語での生成が可能。
*   **Bauhaus UI**: 視認性が高く、ユニークなバウハウススタイルのデザイン。

## 🛠️ 技術スタック

このプロジェクトは以下の技術で構築されています。

*   **Frontend**: React 19, TypeScript
*   **Styling**: Tailwind CSS (Bauhaus Design System)
*   **AI & Audio**:
    *   **Google GenAI SDK** (`@google/genai`)
    *   **Gemini 2.5 Flash** (Text Generation / Script Writing)
    *   **Gemini 2.5 Flash Preview TTS** (Speech Generation)
    *   **Web Audio API** (Audio Processing & Playback)

## 🚀 セットアップ

1.  **APIキーの取得**: [Google AI Studio](https://aistudio.google.com/) からGemini APIキーを取得してください。
2.  **環境変数**: `process.env.API_KEY` にAPIキーが設定されている環境で実行します（このデモ環境では自動注入されます）。

## 📖 使い方

1.  **役職を選択**: 左側のサイドバーから「ゲームマスター」や「人狼」などの役職、または「昼の議論」などのモードを選択します。
2.  **テキスト入力**:
    *   **シングルモード**: 喋らせたいセリフを入力します。「✨ 演技指導」ボタンを押すと、AIがセリフをブラッシュアップします。
    *   **議論モード**: シチュエーション（例：「占い師が二人出て混乱している」）を入力し、「脚本作成」をクリックします。
3.  **再生・ダウンロード**: 生成された音声をブラウザ上で再生、または `.wav` 形式でダウンロードして利用します。

## 📄 ライセンス

Apache License 2.0
