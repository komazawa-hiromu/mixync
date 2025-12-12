# Xserver VPS Deployment Guide

BioMixerをXserver VPS (Ubuntu 22.04/24.04 推奨) にデプロイするための手順書です。
※ レンタルサーバープラン（スタンダード等）ではなく、**VPSプラン**が必要です。

> **⚠️ 注意**: セクション1〜5のコマンドはすべて、**SSHで接続したサーバー上**で実行してください。
> 「補足」セクションのみ、お手元の**ローカルPC**での操作になります。

## 0. サーバーへの接続 (ローカルPC上で実行)

Windowsの「PowerShell」または「コマンドプロンプト」を開き、以下のコマンドを入力してサーバーにログインします。
※ `<your_server_ip>` はXserver VPSの管理画面で確認できるIPアドレスに置き換えてください。

```bash
ssh root@<your_server_ip>
```
(初回接続時は `Are you sure...` と聞かれるので `yes` と入力し、その後サーバーのrootパスワードを入力します)

ログインに成功し、画面の表示が `root@...` となったら、そこが「サーバー上」です。以降の手順はそこで実行します。

## 1. サーバーの準備 (SSHで接続したサーバー上で実行)

### システムの更新と必須ツールのインストール
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl wget build-essential python3-venv python3-pip nginx
```
    
### Node.js (v18) のインストール
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

### PM2 (プロセス管理ツール) のインストール
```bash
sudo npm install -g pm2
```

## 2. アプリケーションのセットアップ (SSHで接続したサーバー上で実行)

**※ 再インストールの場合は、最初に以下を実行して古いファイルを削除してください:**
```bash
pm2 delete all
cd ~
sudo rm -rf new-sunrise-manage
```

### リポジトリのクローン
```bash
# ホームディレクトリに移動
cd ~
git clone https://github.com/komasan-hiro/new-sunrise-manage.git
cd new-sunrise-manage

# 正しいブランチに切り替え
git checkout Graduation_Project
```

### A. Node.js バックエンドのセットアップ
```bash
cd backend-node
npm install

# 環境変数の設定
cp .env.example .env
nano .env
```
`.env` の内容を編集します（特に `FITBIT_CLIENT_ID`, `FITBIT_CLIENT_SECRET`, `JWT_SECRET`）。`PC_IP_ADDRESS` はサーバーのグローバルIPまたはドメインに設定してください。

### B. Python バックエンドのセットアップ
```bash
cd ../backend-python
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
deactivate
```

## 3. アプリケーションの起動 (SSHで接続したサーバー上で実行)

Node.jsとPythonの両方をPM2で管理して、バックグラウンドで永続化します。

```bash
cd ~/new-sunrise-manage

# 1. Node.js バックエンドの起動
pm2 start backend-node/bin/www --name "biomixer-node"

# 2. Python バックエンドの起動
# uvicornを直接PM2で実行
pm2 start "backend-python/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000" --name "biomixer-python"

# ステータス確認
pm2 status

# サーバー再起動時も自動起動するように設定
pm2 save
pm2 startup
# (表示されたコマンドを実行してください)
```

## 4. Nginx (Webサーバー) の設定 (SSHで接続したサーバー上で実行)

外部からのアクセス (Port 80) を Node.js (Port 3001) に転送します。

### 設定ファイルの作成
```bash
sudo nano /etc/nginx/sites-available/biomixer
```

以下の内容を貼り付けます（`your_server_ip` は実際のIPアドレスまたはドメインに置き換えてください）。

```nginx
server {
    listen 80;
    server_name your_server_ip;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 設定の有効化
```bash
sudo ln -s /etc/nginx/sites-available/biomixer /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

## 5. ファイアウォールの設定 (SSHで接続したサーバー上で実行)

Xserver VPSには**「パケットフィルタ設定」**（コントロールパネル側）と**「OS内部のファイアウォール」**（UFW等）の2つがあります。

### A. Xserver VPS コントロールパネルでの設定
ブラウザでXserver VPSの管理画面にログインし、「パケットフィルタ設定」で **TCP 80 (Web)** と **TCP 22 (SSH)** を「許可」に設定してください。
※ Node.js(3001)やPython(8000)に直接アクセスさせたい場合はそれらも許可する必要がありますが、Nginx経由(80)であれば不要です。

### B. OS内部の設定 (UFW)
```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

これで `http://<サーバーIP>` にアクセスすれば、BioMixerのAPIが利用可能になります。

---

## 補足: フロントエンド (Androidアプリ) の設定 (ローカルPC上で実行)

サーバーのデプロイが完了したら、ローカル環境の `backend-node/.env` の `PC_IP_ADDRESS` を **サーバーのIPアドレス** に変更して、Androidアプリをビルドし直してください。
(FitbitのRedirect URLも `http://<サーバーIP>/auth/fitbit/callback` に更新する必要があります)
