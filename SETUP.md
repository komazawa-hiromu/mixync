# BioMixer セットアップガイド

このガイドでは、BioMixerを自分のFitbitデバイスで使用するための完全なセットアップ手順を説明します。

## 目次
1. [前提条件](#前提条件)
2. [Fitbitアプリの登録](#fitbitアプリの登録)
3. [バックエンド (Node.js) のセットアップ](#バックエンド-nodejs-のセットアップ)
4. [バックエンド (Python) のセットアップ](#バックエンド-python-のセットアップ)
5. [フロントエンド (React) のセットアップ](#フロントエンド-react-のセットアップ)
6. [Android実機での実行](#android実機での実行)

---

## 前提条件

以下のソフトウェアがインストールされている必要があります：

- **Node.js** (v18以上推奨) - [ダウンロード](https://nodejs.org/)
- **Python** (v3.9以上推奨) - [ダウンロード](https://www.python.org/)
- **Git** - [ダウンロード](https://git-scm.com/)
- **Fitbitアカウント** - [登録](https://www.fitbit.com/)
- **Fitbitデバイス** (心拍数計測機能付き)

---

## Fitbitアプリの登録

BioMixerがFitbitのデータにアクセスするには、Fitbit Developer Portalでアプリケーションを登録する必要があります。

### 手順

1. **Fitbit Developer Portalにアクセス**
   - [https://dev.fitbit.com/apps](https://dev.fitbit.com/apps) にアクセスします。
   - Fitbitアカウントでログインします。

2. **新しいアプリを登録**
   - **「Register a new app」**をクリックします。
   - 以下の情報を入力します：

     | 項目 | 入力内容 |
     |------|----------|
     | **Application Name** | `BioMixer` (任意の名前) |
     | **Description** | `AI-powered smart alarm using heart rate data` |
     | **Application Website** | `http://localhost:3001` |
     | **Organization** | 個人名または組織名 |
     | **Organization Website** | `http://localhost:3001` |
     | **Terms of Service URL** | `http://localhost:3001` (任意) |
     | **Privacy Policy URL** | `http://localhost:3001` (任意) |
     | **OAuth 2.0 Application Type** | **`Personal`** を選択 |
     | **Redirect URL** | `http://localhost:3001/auth/fitbit/callback` |
     | **Default Access Type** | **`Read-Only`** を選択 |

3. **アプリを作成**
   - 利用規約に同意し、**「Register」**をクリックします。

4. **Client IDとClient Secretを取得**
   - 登録が完了すると、**OAuth 2.0 Client ID** と **Client Secret** が表示されます。
   - これらの値を**安全な場所にコピー**してください（後で `.env` ファイルに設定します）。

---

## バックエンド (Node.js) のセットアップ

### 1. リポジトリをクローン

```bash
git clone https://github.com/komasan-hiro/new-sunrise-manage.git
cd new-sunrise-manage
git checkout capacitor
```

### 2. 依存関係をインストール

```bash
cd backend-node
npm install
```

### 3. 環境変数を設定

```bash
# .env.example をコピーして .env を作成
cp .env.example .env
```

`.env` ファイルを開き、以下の項目を設定してください：

```env
# Fitbit OAuth Credentials (先ほど取得した値を入力)
FITBIT_CLIENT_ID=your_fitbit_client_id_here
FITBIT_CLIENT_SECRET=your_fitbit_client_secret_here

# JWT Secret Key (任意のランダムな文字列)
JWT_SECRET=your-secret-key-change-this-in-production

# Server Configuration
PORT=3001

# PC IP Address (Android実機テスト用、後で設定)
PC_IP_ADDRESS=localhost
```

### 4. サーバーを起動

```bash
npm start
```

サーバーは `http://localhost:3001` で起動します。

---

## バックエンド (Python) のセットアップ

### 1. ディレクトリに移動

```bash
cd ../backend-python
```

### 2. 仮想環境を作成・有効化

```bash
# 仮想環境を作成
python -m venv venv

# 仮想環境を有効化
# Windowsの場合
venv\Scripts\activate

# Mac/Linuxの場合
source venv/bin/activate
```

### 3. 依存関係をインストール

```bash
pip install -r requirements.txt
```

### 4. サーバーを起動

```bash
uvicorn main:app --reload --port 8000
```

サーバーは `http://localhost:8000` で起動します。

---

## フロントエンド (React) のセットアップ

### 1. ディレクトリに移動

```bash
cd ../frontend
```

### 2. 依存関係をインストール

```bash
npm install
```

### 3. 開発サーバーを起動

```bash
npm run dev
```

ブラウザで `http://localhost:5173` (または表示されるURL) にアクセスしてください。

---

## Android実機での実行

Android実機で動作させる場合は、以下の手順に従ってください。

### 前提条件
- **Android Studio** がインストールされていること
- PCとAndroid端末が**同じWi-Fiネットワーク**に接続されていること

### 手順

#### 1. PCのIPアドレスを確認

```bash
# Windowsの場合
ipconfig

# Mac/Linuxの場合
ifconfig
```

**IPv4アドレス**（例: `192.168.1.100`）をメモしてください。

#### 2. backend-node/.env を更新

`backend-node/.env` ファイルを開き、`PC_IP_ADDRESS` を設定します：

```env
PC_IP_ADDRESS=192.168.1.100
```

**重要**: Fitbit OAuth Redirect URLも更新する必要があります。
- Fitbit Developer Portalに戻り、アプリの設定を編集します。
- **Redirect URL** に以下を追加します：
  ```
  http://192.168.1.100:3001/auth/fitbit/callback
  ```

#### 3. フロントエンドをビルド

```bash
cd frontend

# Windows (PowerShell)
$env:VITE_PC_IP="192.168.1.100"; npm run build

# Mac/Linux
VITE_PC_IP=192.168.1.100 npm run build
```

#### 4. Android Studioでプロジェクトを開く

1. Android Studioを起動します。
2. **「Open an Existing Project」**を選択します。
3. `frontend/android` フォルダを選択します。

#### 5. 実機にインストール

1. Android端末をUSBで接続します（またはWi-Fi経由でデバッグを有効化）。
2. Android Studioで**「Run」→「Run 'app'」**を選択します。
3. 接続されたデバイスを選択してインストールします。

---

## 使い方

### 1. ユーザー登録とFitbit連携

1. アプリを起動し、**「新規登録」**をクリックします。
2. ユーザー名とパスワードを入力して登録します。
3. **「Fitbitと連携」**ボタンをクリックします。
4. Fitbitのログイン画面が表示されるので、ログインして認証を許可します。

### 2. アラームの設定

1. ホーム画面で**「アラーム設定」**をクリックします。
2. アラーム音を設定します：
   - MP3, WAV形式のファイルをアップロード可能です。
3. 起床時刻を設定します。
4. **「保存」**をクリックします。
   - ※ミキシングパターンは初期段階では自動的に進行（Phase A〜E）し、35日目以降にAI推薦が適用されます。

### 3. 起床後の評価

1. アラームが鳴った後、**「評価を入力」**画面が表示されます。
2. 起床時の気分を1〜5で評価します。
3. **「送信」**をクリックすると、Comfort Scoreが自動計算されます。

### 4. データの確認

- **「分析」**タブで、過去の起床データやComfort Scoreの推移を確認できます。
- グラフで心拍数の変化やミキシング別の比較が可能です。

---

## トラブルシューティング

### Fitbit認証エラー

- **Redirect URLが正しいか確認**してください（`http://localhost:3001/auth/fitbit/callback` または `http://<PC_IP>:3001/auth/fitbit/callback`）。
- Fitbit Developer Portalでアプリの設定を確認してください。

### Android実機で接続できない

- PCとAndroid端末が**同じWi-Fiネットワーク**に接続されているか確認してください。
- `PC_IP_ADDRESS` が正しく設定されているか確認してください。
- ファイアウォールがポート3001と8000をブロックしていないか確認してください。

### データが取得できない

- Fitbitデバイスが正しく同期されているか確認してください。
- Fitbit APIには**15分のタイムラグ**があるため、最新データの取得には時間がかかる場合があります。

---

## ライセンス

このプロジェクトはMITライセンスの下で公開されています。

---

## サポート

問題が発生した場合は、GitHubのIssuesで報告してください：
[https://github.com/komasan-hiro/new-sunrise-manage/issues](https://github.com/komasan-hiro/new-sunrise-manage/issues)
