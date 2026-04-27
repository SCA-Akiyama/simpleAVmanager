# ---

**AV State Orchestrator (Project: "Desired vs Actual")**

このプロジェクトは、**「理想（Desired）」と「現実（Actual）」の差分を埋める**という一貫した哲学に基づいた、Bun製のAV機器制御バックエンドシステムです。

## **1\. コア・コンセプト**

「電源をONにしたはずなのに、実機がなっていない」というAV現場の不安定さを解消するため、以下のループを回し続けます。

* **Desired (理想)**: ユーザーが「こうあってほしい」と願う状態（DBに保存）。  
* **Actual (現実)**: 30秒おきのポーリング（問い合わせ）で判明した実機の生の状態。  
* **Reconciliation (調停)**: 理想と現実が異なれば、一致するまで命令を送り続ける。

## **2\. システム・アーキテクチャ**

### **通信プロトコル (src/lib/protocols.ts)**

* **TcpTask**: PJLink等で使用。命令送信だけでなく、実機からのレスポンスを string で返す機能を持ち、問い合わせ（Query）と命令（Set）を同一クラスで処理する。  
* **UdpTask**: BrightSign等で使用。投げっぱなしの通信を担当。

### **デバイス定義 (src/lib/devices/)**

各機材は「翻訳機」として動作します。

* **translate(key, value)**: 値が ? なら問い合わせコマンド、それ以外なら設定コマンドを生成。  
* **statusKeys**: 監視・保存・再送が必要な「状態」のリスト。これに含まれないキー（例: trigger）は「イベント」として扱い、再送は行わない。  
* **parseResponse(key, raw)**: 実機からの生の返答を、UIで扱える値（on, off, warming, cooling 等）に変換。

### **マネージャー (src/lib/manager.ts)**

システムの脳。

* **Fast Path**: ユーザー操作を受け取ると、即座にDB保存と実機送信を行う。  
* **Slow Path**: 30秒おきに statusKeys に基づいて実機の状態を確認し、actualMap を更新。その後、理想とズレていれば再送。  
* **判定ロジック**: on \!== warming であれば、愚直に命令を送り続ける。機材固有の事情（暖機運転など）をマネージャーが「忖度」しない、シンプルで堅牢な設計。

## **3\. 技術スタック**

* **Runtime**: Bun (Bun.connect, Bun.udpSocket による高速な通信)  
* **Database**: SQLite (desired\_states テーブルによる状態の永続化)  
* **Communication**: WebSocket (UIとのリアルタイムな同期)  
* **Frontend**: サーバーサイドビルド（Bun.build）による軽量な配信

## ---

**4\. ファイル構成と役割**

| ファイル名 | 役割 |
| :---- | :---- |
| main.ts | HTTP/WebSocketサーバー。定期同期（setInterval）の起点。 |
| manager.ts | 状態管理の核心。SQLiteとメモリマップの同期、差分検知。 |
| db.ts | SQLiteへの読み書き（INSERT OR REPLACEによる冪等性の確保）。 |
| protocols.ts | TCP/UDP通信のプリミティブな実装。 |
| inventory.ts | 管理対象デバイスの台帳。 |
| PjLinkDevice.ts | PJLink規格（プロジェクター）のコマンド翻訳・応答解析。 |
| BrightSignDevice.ts | UDPによるメディアプレーヤー制御。 |

## ---

