# ZERO ARCADE：3ゲーム別の実装指示書

各ゲームの開発者またはそのリポジトリで作業するAIに渡してください。**2026-10-12時点の `main` を確認**しました。連携先のadmin APIは実装済みですが、3ゲーム本体にはまだ報酬連携処理がありません。APIキーを設定するだけで使えるのは、以下のゲーム側改修を終えた後です。共通仕様は[API仕様](ZERO_ARCADE_API.md)と[APIキー設定ガイド](ZERO_ARCADE_ゲーム開発者向け_APIキー設定ガイド.md)を参照してください。

| ゲーム | 確認した実装 | 送信する値 | 付与するユニコイン |
| --- | --- | --- | --- |
| [ctf](https://github.com/tanadesu/ctf) | `simulation.js` のサーバー側 `players[].score` | 本人・相手のスコア | 勝ち10,000、負け0。引き分けは未定 |
| [hanbai](https://github.com/tanadesu/hanbai) | `engine.js` の `summary().profit` | 利益の非負整数値 | 百の位を四捨五入した千単位の枚数 |
| [locket](https://github.com/tanadesu/locket) | `dist/game.js` の `engine.charge.power` | 表示と同じ整数スコア | 百の位を四捨五入した千単位の枚数 |

adminの「ユニコイン」→「ZERO ARCADE連携」で各ゲームを**別登録**し、ctfは「勝敗で付与」、他2つは「千単位に四捨五入」を選びます。勝ち10,000・負け0・引き分け空欄、上限10,000枚が現在の設定案です。引き分けが確定するまで、ctfの同点ではAPIが `422` を返し、QRを発行しません。2ゲームの実際の得点幅が想定と違えば、管理画面の上限を見直してください。

共通リクエストは `POST https://<adminホスト>/api/arcade/rewards`、`Authorization: Bearer <ゲーム専用キー>`、JSON本文は `{playId,points}` です。ctfのみ `opponentPoints` も必須です。キーからゲームを特定するため `gameId` は不要です。応答の `coins` と `qrImageDataUrl` を結果画面へ表示し、0枚ならQRを出しません。QRの中身はURLではなく `ZERO1COIN:<64桁>` です。

キーはゲーム側サーバーの秘密環境変数 `ZERO_ARCADE_API_KEY`、送信先は `ZERO_ARCADE_API_URL` に置きます。ブラウザ用JS、HTML、静的設定JSON、GitHub、ログへキーを出さないでください。再試行時は同じ `playId` とスコアを使います。

## 1. ctf / ORBIS FRONTIER

### 確認したコード

- [`simulation.js`](https://github.com/tanadesu/ctf/blob/main/simulation.js)：`player().score` がサーバーで増え、`advance()` が `C.duration` 到達時に試合を終了します。一方 `command()` の `end` は時間前にも終了できます。
- [`server.js`](https://github.com/tanadesu/ctf/blob/main/server.js)：既存のNode HTTPサーバーでセッショントークンからルームとプレイヤーを取得します。
- [`game.js`](https://github.com/tanadesu/ctf/blob/main/game.js)：`results()` が結果モーダルを描画します。[`network.js`](https://github.com/tanadesu/ctf/blob/main/network.js) の `api(path)` で同じゲームサーバーへ認証付きPOSTができます。

### 実装指示

1. `server.js` の既存セッション認証の後に、本人専用 `POST /api/reward` を追加します。クライアントから得点や勝敗を受け取らず、ルームの本人 `score` と相手 `score` を読みます。2人とも揃い、`r.phase === 'ended'` **かつ** `r.elapsed >= C.duration` の場合だけ発行します。途中の `end` 操作で報酬を出さないためです。
2. サーバーでルーム生成時にUUIDを割り当て、再戦世代 `r.epoch` と本人IDを組み合わせて `playId` を安定させます（例：`<roomUUID>:<epoch>:<playerID>`）。2人には別々のIDとQRを発行します。6桁ルームコードだけをIDに使わないでください。
3. サーバーから `{playId,points:本人.score,opponentPoints:相手.score}` をadminへ送ります。同じ結果への同時呼び出しは1件にまとめ、通信失敗時は同じID・スコアで再試行します。APIの `outcome` と `coins` をそのまま本人に返します。引き分けの `422` は「付与数確認中」と表示します。
4. `game.js` の `results()` に本人の枚数・QR画像・有効期限・再試行を追加します。`api('reward')` を呼び、相手のQRやAPIキーを共通 `snapshot()` に含めないでください。モーダル再表示でも同じQRを使います。
5. [`render.yaml`](https://github.com/tanadesu/ctf/blob/main/render.yaml) で配信する場合、Renderのサーバー側EnvironmentにAPI URLとキーを設定します。会場のLANだけでオフライン運用する場合はadminへ到達できないため、自動QR発行には接続が必要です。

## 2. hanbai / READ THE CROWD

### 確認したコード

- [`app.js`](https://github.com/tanadesu/hanbai/blob/main/app.js)：`tick()` が終了を検知し、`finish()` で `game.summary()` と結果ダイアログを使います。最近の変更は音声・画面周辺ですが、この結果取得経路は残っています。
- [`engine.js`](https://github.com/tanadesu/hanbai/blob/main/engine.js)：`summary().profit` が利益です。負の利益もあり得ます。
- [`index.html`](https://github.com/tanadesu/hanbai/blob/main/index.html)：`<dialog id="results">` が結果画面です。現状は静的配信で、秘密キーを置くサーバー処理はありません。

### 実装指示

1. 静的ファイルを配信し、同じオリジンで `POST /api/session/start` と `POST /api/reward` を処理するNodeサーバーを追加します。`ZERO_ARCADE_API_KEY` とURLはそのプロセスの秘密環境変数に置きます。既存のPython `http.server` やHTML直開きでは報酬連携を使えない旨をREADMEに記載します。
2. `app.js` の `start()` でサーバー発行セッションIDを取得します。`finish()` で `const points = Math.max(0, Math.floor(game.summary().profit))` を計算し、IDとともに自サーバーへ送ります。**ユニコイン数へ変換せず、利益の整数値を送ります。** admin側が `Math.round(points / 1000) * 1000` を付与枚数とします。例：2,499→2,000、2,500→3,000。
3. サーバー側でセッション重複・最低プレイ時間・整数範囲を確認し、IDから安定した `playId` を作ってadminへ送ります。同時送信と再試行では同じ結果を返します。`index.html` の結果ダイアログに `coins`・QR・期限・再試行を追加し、`style.css` で収まるよう調整します。
4. 利益はブラウザ内で計算されます。中継サーバーのセッション確認だけでは偽の利益を完全には防げません。公開Webで報酬を有効にするなら、販売操作をサーバーで再計算する仕組みか、スタッフ確認が必要です。管理された会場端末で使う場合も、この前提を運営に共有してください。

## 3. locket / POWER CHARGE

### 確認したコード

- [`dist/game.js`](https://github.com/tanadesu/locket/blob/main/dist/game.js)：結果状態で `prepareResult()` を呼び、`Math.floor(engine.charge.power)` を表示します。現行エンジンのPOWER上限は9,999で、丸めた報酬は最大10,000枚です。
- [`dist/index.html`](https://github.com/tanadesu/locket/blob/main/dist/index.html)：`<section id="result">` が結果画面です。
- [`vercel.json`](https://github.com/tanadesu/locket/blob/main/vercel.json)：`dist` を静的配信します。現行のVercel配信では [`scripts/serve.mjs`](https://github.com/tanadesu/locket/blob/main/scripts/serve.mjs) は実行されません。

### 実装指示

1. Vercel運用なら、同じオリジンのサーバーレスAPIとして `POST /api/session/start` と `POST /api/reward` を追加し、Vercelの秘密環境変数にキーとURLを保存します。静的 `dist` のビルド成果物や `VITE_` 等の公開環境変数には入れません。ローカルNode運用なら `scripts/serve.mjs` に同等のPOST処理を実装します。**どちらの配信方式を本番で使うかを決め、その方式でAPIルートが実際に配信されるようにします。**
2. `dist/game.js` のプレイ開始時にサーバー発行セッションIDを取得し、`prepareResult()` 到達時に `Math.floor(engine.charge.power)` を自サーバーへ送ります。サーバーはセッション重複・最低プレイ時間・0〜9,999の整数範囲を確認し、安定した `playId` でadminへ送ります。カメラ映像や骨格情報は送信しません。
3. `dist/index.html` の結果画面に獲得枚数・QR・期限・再試行を追加し、`dist/style.css` で読み取りやすく表示します。0枚ならQRは出しません。
4. POWERはブラウザ内で計算されるため、中継だけでは偽スコアを完全には防げません。公開Webで報酬を有効にするなら、サーバー側で検証する仕組みかスタッフ確認が必要です。

## 完了条件

1. 3ゲームそれぞれに別のキーを設定し、キーがブラウザ通信・公開ファイル・ログ・Git履歴に現れない。
2. 正規の終了時にだけ、1プレイ1件の報酬結果を受け取る。ctfは2人の結果を個別に発行し、負けはQRなし、引き分けは運営の設定待ちとする。
3. 上記の計算結果を表示し、QRをアプリ内スキャナーで読み取れる。同じQRの再利用は拒否され、残高と履歴は1回だけ増える。
4. 通信再試行・結果画面の再表示では同じ `playId` を使い、API障害でもゲーム本体の結果表示を失わない。
5. 既存のゲームプレイ・ランキング・ctfの対戦・locketのカメラ処理を維持する。

ゲーム側の改修、秘密キーの設定、adminと利用者向けアプリのデプロイ、実機での受け取り確認はまだ完了していません。引き分けの付与数は先方回答後に管理画面へ設定してください。
