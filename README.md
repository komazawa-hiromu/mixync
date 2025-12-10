# BioMixer - AI起床最適化システム

Fitbitの心拍数データを活用し、AIが最適なタイミングと音楽で起こしてくれるスマートアラームシステムです。

## 特徴

- **心拍数ベースの起床分析**: Fitbitデバイスから取得した心拍数データを分析し、起床時の生理的反応を評価
- **高度なオーディオミキシング**: Tremolo, Auto-Pan, Reverb, Delay, Chorus などのエフェクトを駆使
- **パターン進行の自動化**: 使用日数に応じてミキシングパターンが段階的に変化 (7日ごとのフェーズ移行)
- **AI推薦アルゴリズム**: 35日以降、DTW (Dynamic Time Warping) を用いて最適なアラームパターンを提案
- **柔軟なフォーマット対応**: MP3, WAV ファイルの直接アップロードと自動処理に対応
- **Comfort Score**: 客観的指標（心拍数の上昇傾斜、安定性、強度）と主観的評価を組み合わせた総合スコア
- **Android対応**: Capacitorを使用したネイティブAndroidアプリ

## セットアップ

詳細なセットアップ手順は **[SETUP.md](SETUP.md)** をご覧ください。

### クイックスタート

```bash
# リポジトリをクローン
git clone https://github.com/komasan-hiro/new-sunrise-manage.git
cd new-sunrise-manage
git checkout capacitor

# セットアップガイドを参照
# SETUP.md の手順に従ってください
```

## 必要なもの

- Node.js (v18以上)
- Python (v3.9以上)
- Fitbitアカウントと登録済みデバイス
- Fitbit Developer Portalでのアプリ登録 (詳細は [SETUP.md](SETUP.md) を参照)

## アーキテクチャ

- **バックエンド (Node.js)**: Express.js、Fitbit OAuth、SQLite
- **バックエンド (Python)**: FastAPI、DTW類似度計算
- **フロントエンド**: React、Vite、Material-UI
- **モバイル**: Capacitor (Android)

## ライセンス

MIT License

## サポート

問題が発生した場合は、[Issues](https://github.com/komasan-hiro/new-sunrise-manage/issues) で報告してください。
