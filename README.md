# **simpleAVmanager**

simpleAVmanagerは、TypeScriptとBunを採用した、モダンで拡張性の高いAV機器・IoTデバイス管理フレームワークです 。

「理想状態（Desired）」と「現実状態（Actual）」を分離して管理するIoT Shadowパターンを採用しており、ネットワークの遅延や機器のハングアップに強い堅牢な制御を実現します 。また、Zodによる厳格なバリデーションと、フロントエンド向けの型定義自動生成機能により、安全かつ快適なEnd-to-Endの開発体験を提供します 。

## **✨ 主な機能**

* **IoT Device Shadow パターン:** ユーザーからの操作（理想）を即座に受け付けつつ、バックグラウンドのポーリングで実際の機器状態と非同期に同期（Fast Path / Slow Path） 。

* **マルチプロトコル対応:** TCP、UDP、HTTPでの機器制御をネイティブサポート。インターフェースが抽象化されており、プロトコルの追加も容易 。

* **堅牢なスケジューラー:** SQLiteをバックエンドとした、単発（Once）および定期（Cron）のスケジューリング機能。サーバー再起動時にもスケジュールを自動復元 。

* **型安全と自動生成:** Zodを用いてデバイスごとのコマンドスキーマを定義 。scripts/export-types.ts を実行することで、フロントエンド用のTypeScriptインターフェースとJSON Schemaを自動生成 。

* **許容状態とクールダウン:** 「Warming up」などの過渡期の状態の許容や、コマンド送信直後のポーリングスキップ（クールダウン）など、実際のAV機器の挙動に寄り添った設計 。

## **🛠 テクノロジースタック**

* **Runtime:** [Bun](https://bun.sh/) (高速な実行環境、ネイティブのTCP/UDPソケット、SQLite組み込み)  
* **Language:** TypeScript  
* **Validation:** Zod  
* **Database:** Bun SQLite (state.db)

* **Communication:** WebSocket (UIとサーバー間のリアルタイム同期)

## **📁 ディレクトリ構成**

Plaintext

simpleAVmanager/  
├── main.ts                     \# アプリケーションのエントリーポイント（サーバー起動、初期化）  
├── test-device.ts              \# コマンドラインから単一デバイスをテストするためのCLIツール  
├── frontend-protocol.ts        \# 自動生成されるフロントエンド用型定義ファイル   
├── protocol-schema.json        \# 自動生成されるJSON Schema  
├── lib/  
│   ├── cron.ts                 \# スケジューラー（Once/Cron）の登録・実行ロジック  
│   ├── db.ts                   \# SQLiteデータベースのテーブル定義とCRUD操作   
│   ├── factory.ts              \# 定義データからAVDeviceインスタンスを生成するファクトリー  
│   ├── inventory.ts            \# 管理対象のデバイス一覧（IPアドレス、IDの登録）   
│   ├── manager.ts              \# 状態同期のコアロジック（Device Shadow実装）  
│   ├── protocols.ts            \# 通信プロトコル（TCP/UDP/HTTP）のTask実装  
│   ├── types.ts                \# システム全体の共通型定義  
│   ├── ws-router.ts            \# WebSocketクライアントからのメッセージルーティングとZod検証  
│   └── devices/  
│       ├── BrightSignDevice.ts \# BrightSign用デバイス定義（UDP）  
│       ├── PjLinkDevice.ts     \# PJLink準拠プロジェクター用デバイス定義（TCP）  
│       └── \_templateDevice.ts  \# 新規デバイス追加時のテンプレート   
└── scripts/  
    └── export-types.ts         \# Zodスキーマからフロント用型定義・JSONを書き出すスクリプト

## **🚀 起動とテスト**

### **サーバーの起動**

Bunを使用してメインサーバーを起動します。デフォルトで http://localhost:3000 でリッスンします 。

Bash

bun run main.ts

### **フロントエンド用型の自動生成**

バックエンドのZodスキーマを更新した場合、以下のスクリプトを実行してフロントエンド用のファイルを再生成してください 。

Bash

bun run scripts/export-types.ts

### **デバイスの単体テスト**

UIを介さずに、CLIから直接デバイスのコマンドをテストできるユーティリティが用意されています 。

Bash

\# 書式  
bun run test-device.ts \--ip \<IP\_ADDRESS\> \--type \<DEVICE\_TYPE\> \[--key \<STATE\_KEY\>\] \[--val \<VALUE\_OR\_?\>\]

\# 例: プロジェクターの電源状態を問い合わせる  
bun run test-device.ts \--ip 192.168.1.100 \--type PjLinkDevice \--key power \--val ?

## **🧩 新しいデバイスの追加方法**

1. **デバイス定義ファイルの作成:**

   lib/devices/\_templateDevice.ts をコピーし、新しいデバイス用のファイルを作成します 。

2. **Zodスキーマの定義:** そのデバイスで操作・監視したい項目（電源、入力切替、音量など）を z.object() で定義します 。

3. **DeviceDefinitionの記述:** 通信プロトコル（TCP/UDP/HTTP）、ポート番号、コマンドの変換ロジック（translate / parse）を記述します 。

4. **インベントリへの登録:**

   lib/inventory.ts を開き、作成した定義と対象デバイスのIPアドレス・管理IDを登録します 。

5. **型の再生成:**

   bun run scripts/export-types.ts を実行し、クライアント用プロトコルを更新します 。  
