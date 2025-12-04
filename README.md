# BioMixer - AI起床最適化システム

このプロジェクトは、Fitbitの心拍数データを活用し、AIが最適なタイミングと音楽で起こしてくれるスマートアラームシステムです。

## セットアップ手順

### 1. 前提条件
- Node.js (v18以上推奨)
- Python (v3.9以上推奨)
- Fitbitアカウントと登録済みのアプリケーション (Client ID, Client Secret)

### 2. バックエンド (Node.js) のセットアップ

1. `backend-node` ディレクトリに移動します。
   ```bash
   cd backend-node
   ```
2. 依存関係をインストールします。
   ```bash
   npm install
   ```
3. `.env` ファイルを作成し、必要な環境変数を設定します。
   ```bash
   cp .env.template .env
   ```
   `.env` ファイルを開き、以下の項目を設定してください:
   - `FITBIT_CLIENT_ID`: Fitbit Developer Portalで取得したClient ID
   - `FITBIT_CLIENT_SECRET`: Fitbit Developer Portalで取得したClient Secret
   - `SESSION_SECRET`: 任意のランダムな文字列

4. サーバーを起動します。
   ```bash
   npm start
   ```
   サーバーは `http://localhost:3001` で起動します。

### 3. バックエンド (Python) のセットアップ

1. `backend-python` ディレクトリに移動します。
   ```bash
   cd backend-python
   ```
2. 仮想環境を作成し、有効化します。
   ```bash
   python -m venv venv
   # Windowsの場合
   venv\Scripts\activate
   # Mac/Linuxの場合
   source venv/bin/activate
   ```
3. 依存関係をインストールします。
   ```bash
   pip install -r requirements.txt
   ```
4. サーバーを起動します。
   ```bash
   uvicorn main:app --reload --port 8000
   ```
   サーバーは `http://localhost:8000` で起動します。

### 4. フロントエンド (React) のセットアップ

1. `frontend` ディレクトリに移動します。
   ```bash
   cd frontend
   ```
2. 依存関係をインストールします。
   ```bash
   npm install
   ```
3. 開発サーバーを起動します。
   ```bash
   npm run dev
   ```
   ブラウザで `http://localhost:5173` (または表示されるURL) にアクセスしてください。

## Android実機での実行

Android実機で動作させる場合は、PCとAndroid端末が同じWi-Fiネットワークに接続されている必要があります。

1. PCのIPアドレスを確認します (例: `192.168.1.100`)。
2. フロントエンドのビルド時に環境変数を指定します。
   ```bash
   # Windows (PowerShell)
   $env:VITE_PC_IP="192.168.1.100"; npm run build
   
   # Mac/Linux
   VITE_PC_IP=192.168.1.100 npm run build
   ```
3. Android Studioで `frontend/android` プロジェクトを開き、実機にインストールします。

## 注意事項

- Fitbitの認証トークンはローカルのSQLiteデータベース (`biomixer.db`) に保存されます。
- このリポジトリには `biomixer.db` や `.env` は含まれていません。各自でセットアップが必要です。
