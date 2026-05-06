# **simpleAVmanager**

simpleAVmanagerは、TypeScriptとBunを採用した、モダンで拡張性の高いAV機器・IoTデバイス管理フレームワークです。  
「理想状態（Desired）」と「現実状態（Actual）」を分離して管理するIoT Shadowパターンを採用しており、ネットワークの遅延や機器のハングアップに強い堅牢な制御を実現します。また、現場の運用に寄り添った「CSVベースのインベントリ管理」と「プラグインライクな機器追加機構」を備えています。

## **✨ 主な機能**

* **IoT Device Shadow パターン:** ユーザーからの操作（理想）を即座に受け付けつつ、バックグラウンドのポーリングで実際の機器状態と非同期に同期（Fast Path / Slow Path）。  
* **CSVベースの構成管理:** 現場の「IPアドレス管理表（Excel）」からエクスポートしたCSVファイルをそのまま設定ファイルとして読み込み可能。Zodによる厳密なバリデーションで設定ミスを未然に防ぎます。  
* **プラグインアーキテクチャ:** lib/devices/ ディレクトリに新しい機器のTypeScriptファイルを配置するだけで、システムが自動的に認識・読み込みを行います。面倒な登録作業（ボイラープレート）は不要です。  
* **マルチプロトコル対応:** TCP、UDP、HTTPでの機器制御をネイティブサポート。インターフェースが抽象化されており、プロトコルの追加も容易です。  
* **型安全と自動生成:** Zodを用いてデバイスごとのコマンドスキーマを定義。scripts/export-types.ts を実行することで、フロントエンド用のTypeScriptインターフェースとJSON Schemaを完全自動生成します。

## **🛠 テクノロジースタック**

* **Runtime:** [Bun](https://bun.sh/) (高速な実行環境、ネイティブのTCP/UDPソケット、ファイルI/O、SQLite組み込み)  
* **Language:** TypeScript  
* **Validation:** Zod  
* **Database:** Bun SQLite (state.db)  
* **Communication:** WebSocket (UIとサーバー間のリアルタイム同期)

## **📁 ディレクトリ構成**

Plaintext

simpleAVmanager/  
├── main.ts                     \# アプリケーションのエントリーポイント  
├── inventory.csv               \# 🌟 \[ユーザー設定\] デバイスのリストとIPアドレス設定  
├── test-device.ts              \# コマンドラインから単一デバイスをテストするためのCLIツール  
├── frontend-protocol.ts        \# 自動生成されるフロントエンド用型定義ファイル  
├── protocol-schema.json        \# 自動生成されるJSON Schema  
├── lib/  
│   ├── cron.ts                 \# スケジューラー（Once/Cron）の登録・実行ロジック  
│   ├── db.ts                   \# SQLiteデータベースのテーブル定義とCRUD操作  
│   ├── factory.ts              \# 定義データからAVDeviceインスタンスを生成するファクトリー  
│   ├── inventory.ts            \# CSVの読み込みとデバイス定義の動的インポート  
│   ├── manager.ts              \# 状態同期のコアロジック（Device Shadow実装）  
│   ├── protocols.ts            \# 通信プロトコル（TCP/UDP/HTTP）のTask実装  
│   ├── types.ts                \# システム全体の共通型定義  
│   ├── ws-router.ts            \# WebSocketクライアントからのメッセージルーティング  
│   └── devices/  
│       ├── BrightSignDevice.ts \# BrightSign用デバイス定義（UDP）  
│       ├── PjLinkDevice.ts     \# PJLink準拠プロジェクター用デバイス定義（TCP）  
│       └── \_templateDevice.ts  \# 新規デバイス追加時のテンプレート  
└── scripts/  
    └── export-types.ts         \# Zodスキーマからフロント用型定義・JSONを書き出すスクリプト

## **🚀 起動とセットアップ**

### **1\. インベントリの設定**

プロジェクトルートに inventory.csv を作成し、管理対象の機器を登録します。  
（※空行や \# で始まるコメント行は無視されるため、現場のExcel資料から柔軟にエクスポートできます）

コード スニペット

\# inventory.csv の例  
ID,IPアドレス,機器タイプ,ポート番号(任意)  
pj-01, 192.168.1.100, PjLinkDevice,   
bs-01, 192.168.1.110, BrightSignDevice, 5000

### **2\. サーバーの起動**

Bunを使用してメインサーバーを起動します。不正なCSV設定がある場合は起動時にエラーで知らせてくれます。

Bash

bun run main.ts

### **3\. フロントエンド用型の自動生成**

バックエンドの devices/ 内のZodスキーマを更新・追加した場合、以下のスクリプトを実行してフロントエンド用のプロトコルファイルを再生成してください。

Bash

bun run scripts/export-types.ts

## **🧩 新しいデバイスの追加方法**

新しい機器に対応するための手順は非常にシンプルです。既存のコアコード（manager.ts や inventory.ts）を編集する必要はありません。

1. **デバイススクリプトの作成:**  
   lib/devices/\_templateDevice.ts をコピーし、新しいデバイス用のファイル（例: SonyTvDevice.ts）を作成します。  
2. **スキーマと通信ロジックの定義:**  
   通信プロトコル（TCP/UDP/HTTP）、ポート番号、状態のZodスキーマ、およびコマンドの変換ロジック（translate / parse）を記述します。  
3. **CSVへ登録:**  
   inventory.csv に新しい機器のIPアドレスと、手順2で定義した type 名を追記してサーバーを再起動します。

## **🧪 CLI テストツール**

UIを介さずに、コマンドラインから直接単一デバイスのコマンドをテストできるユーティリティが用意されています。

Bash

\# 書式  
bun run test-device.ts \--ip \<IP\_ADDRESS\> \--type \<DEVICE\_TYPE\> \[--key \<STATE\_KEY\>\] \[--val \<VALUE\_OR\_?\>\]

\# 例: 192.168.1.100 にあるプロジェクターの電源状態を問い合わせる  
bun run test-device.ts \--ip 192.168.1.100 \--type PjLinkDevice \--key power \--val ?  
