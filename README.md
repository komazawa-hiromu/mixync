# Mixync (BioMixer)
**AI-Powered Adaptive Awakening Support System**
**生体データに基づく適応的起床支援システム**

![React](https://img.shields.io/badge/Frontend-React%20%2F%20Capacitor-61DAFB?style=flat-square&logo=react)
![Node.js](https://img.shields.io/badge/Backend-Node.js%20(Express)-339933?style=flat-square&logo=node.js)
![Python](https://img.shields.io/badge/AI%20Engine-Python%20(FastAPI)-3776AB?style=flat-square&logo=python)
![Fitbit](https://img.shields.io/badge/Integration-Fitbit%20API-00B0B9?style=flat-square&logo=fitbit)
![Infrastructure](https://img.shields.io/badge/Infra-VPS%20%2F%20Nginx-000000?style=flat-square&logo=linux)

---

## 📖 概要 (Overview)

**「もう、不快な目覚めは繰り返さない。」**

Mixyncは、睡眠慣性（Sleep Inertia） の解消を目指して開発されたスマートアラームアプリケーションです。 従来の「固定音を鳴らすだけ」のアラームとは異なり、Fitbitから取得したリアルタイムの心拍数・睡眠深度を解析し、その日の自律神経の状態に合わせて、AIが最適なミキシング処理（トレモロ、リバーブ等）を動的に生成・合成します。これにより、脳を自然に覚醒状態へと導く「最高の目覚め体験」を提供します。

---

## 🚀 主な機能 (Key Features)

### 1. 適応的サウンド生成 (Adaptive Sound Synthesis)
*   **動的オーディオエンジン:** バックエンドのPythonエンジンが、DSP（デジタル信号処理）を用いて原音をリアルタイムに加工します。
*   **5つの覚醒パターン:**
    *   **Tremolo (トレモロ):** 音量を周期的に揺らし、注意を喚起する。
    *   **Auto-Pan (オートパン):** ステレオ空間を左右に移動させ、空間認知を刺激する。
    *   **Shimmer Reverb (シマーリバーブ):** 高周波倍音を付加し、クリアな覚醒感を促す。
    *   **Delay (ディレイ):** リズミカルな反響音を付加し、予測不可能な刺激を与える。
    *   **Chorus (コーラス):** 音に厚みと広がりを持たせ、心地よい覚醒を促す。

### 2. AIによる個別最適化 (Personalized AI Recommendation)
*   **DTW (動的時間伸縮法):** ユーザーの「現在の心拍波形」と、過去の「目覚めが良かった日の波形」を比較・照合します。
*   **継続的な学習:** 毎朝、ユーザーが「気分の良さ」を評価（0-100点）し、AIはそのフィードバックをもとにして、**そのユーザーに最も効果的な音**を学習し続けます。

### 3. IoTフルスタック統合 (Full-Stack IoT Integration)
*   **完全自動同期:** アラーム時刻の15分前にサーバーが自動起動し、Fitbitクラウドからデータを取得、起床前に音声を生成・待機させます。
*   **信頼性設計 (Reliability Design):** 万が一API通信が失敗した場合でも、システムは自動的にデフォルトのミキシングパターン（Tremolo）を選択し、**アラームが鳴らないという事態を防ぐフェイルセーフ機構**を実装しています。

---

## 🛠 技術構成 (Tech Stack)

モバイルアプリ・バックエンド・AI解析・インフラ構築までを一貫して設計・開発しました。

| カテゴリ | 使用技術 | 役割 |
| :--- | :--- | :--- |
| **Frontend** | React, Vite, Capacitor | AndroidアプリUI構築, APK生成 |
| **Backend** | Node.js (Express) | API全体統括, ジョブスケジューリング, DB管理 |
| **AI / Data** | Python (FastAPI), NumPy, SciPy | 信号処理, DTW解析, 音響合成 (Pedalboard) |
| **Database** | SQLite (Better-SQLite3) | ユーザー・計測データ・フィードバックの管理 |
| **Infrastructure** | Xserver VPS, Nginx, PM2 | リバースプロキシ, 常時SSL化, プロセス管理 |

---

## 🏗 System Architecture (Architectural Flow)

ユーザーの睡眠データとフィードバックが循環し、システムが最適化され続けるデータフローを設計しています。

```mermaid
graph TD
    %% Node Definitions
    UserSleep(("User<br>(Asleep)"))
    Wearable["Wearable Device<br>(Fitbit)"]
    
    MixingList[("Mixing Process List<br>(Currently Active)")]
    
    subgraph Database [User Sleep Database]
        direction TB
        DB_Meta[("User Rating<br>Wake-up Time")]
        DB_Bio[("Heart Rate Slope<br>Heart Rate StdDev<br>Sleep Log")]
    end
    
    Optimize["Optimal Mixing Process<br>for User"]
    AlarmSound["Optimal Alarm Sound<br>for User"]
    
    UserWake(("User<br>(Awake)"))
    Evaluation["Alarm Sound Evaluation"]
    
    %% Connections
    UserSleep --> Wearable
    Wearable --> Database
    
    MixingList --> Optimize
    Database --> Optimize
    
    Optimize --> AlarmSound
    AlarmSound --> UserWake
    
    UserWake --> Evaluation
    Evaluation --> Database
```

---

## 🧪 アルゴリズムの工夫

**なぜ DTW (Dynamic Time Warping) なのか？**
単純な「平均心拍数」の比較では、睡眠中の微妙な変化（ピークのタイミングや変動の形）を捉えきれません。
本システムでは、時系列データの形状類似度を測る **DTW（動的時間伸縮法）** を採用することで、波形の「時間的なズレ」を許容しつつ、最適な過去の成功パターンを見つけ出します。これにより、ユーザーごとの睡眠特性に深くパーソナライズされた提案が可能になりました。

---

## 👨‍💻 開発者 (Developer)

**駒澤 大夢 (Hiromu Komazawa)**
*   **担当領域:** フルスタック開発, アルゴリズム設計, インフラ構築
*   **専門/関心:** Human-Computer Interaction (HCI), IoT, Wellness Tech

---

&copy; 2024-2025 Mixync Project.
