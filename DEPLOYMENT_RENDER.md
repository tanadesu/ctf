# Render無料プランで公開する

このプロジェクトはRender単独でも画面と対戦APIの両方を配信できます。まずRenderで対戦を確認し、その後にFirebase Hostingを画面の公開先として接続します。外部へのデプロイはまだ実行していません。

## 1. GitHubリポジトリを作成

1. https://github.com/new を開いてログインします。
2. Repository nameを `orbis-mars` にします。公開範囲は **Private** で構いません。
3. Create repositoryを選びます。
4. リポジトリの「uploading an existing file」（または Add file → Upload files）を開きます。
5. 用意した `render-upload.zip` をPCで展開し、**中のファイルとフォルダ**をアップロードします。ZIP自体をアップロードするのではありません。
6. `package.json` と `server.js` がリポジトリ直下にあることを確認してCommit changesを選びます。

このアップロード用ZIPにはソース、設定、テスト、手順書を含めています。生成済みdist、スクリーンショット、旧版、環境変数ファイルは含めません。

## 2. RenderでBlueprintを作成（設定を自動入力）

1. https://dashboard.render.com/ を開き、GitHubアカウントでログインします。
2. New → Blueprintを選び、作成した `orbis-mars` リポジトリを接続します。必要ならGitHub側でこのリポジトリへのアクセスを許可します。
3. `render.yaml` が読み込まれます。サービス名は `orbis-mars-api`、プランが **Free** であることを確認して作成します。有料のデータベースやディスクは追加しません。
4. ビルド・デプロイが完了しLiveになるのを待ちます。
5. 表示された `https://実際のサービス名.onrender.com` を開きます。このURLだけでもゲームを試せます。

Blueprintで以下を設定済みです。

| 項目 | 値 |
| --- | --- |
| Runtime | Node |
| Plan | Free |
| Build Command | `npm test` |
| Start Command | `npm start` |
| Health Check Path | `/health` |
| NODE_ENV | `production` |
| ADMIN_KEY | ランダム生成。コードには保存しません |
| ALLOWED_ORIGINS | `https://ctf1-99feb.web.app,https://ctf1-99feb.firebaseapp.com` |

Node.jsは `package.json` で24系を指定しています。ポートはRenderの `PORT` を使用し、`0.0.0.0` で待ち受けます。

## 3. Renderだけで動作確認

- `/health` が `{"ok":true}` を返すことを確認。
- 2つの独立ブラウザで同じRender URLを開き、ルーム作成→参加→準備完了→売買。
- `/admin` ではRenderのEnvironment欄にある `ADMIN_KEY` を使用します。キーを公開したり、チャットに貼ったりする必要はありません。

無料サービスの休止後は起動に時間がかかります。作成・参加は最大90秒待つ設定にしました。タイムアウトした場合は起動完了を待って再操作してください。

## 4. Firebase Hostingへ接続

Renderの実際のURLが決まってから、このワークスペースで実行します。

```sh
npm run configure:backend -- https://実際のサービス名.onrender.com
npm run build:hosting
```

これで `hosting-backend.json` に公開APIのURLを保存し、FirebaseのCSPでそのURLだけを許可します。`dist/runtime-config.js` に接続先を反映します。運営キーは含めません。ローカルとRender直接アクセスは引き続き同一サーバーのAPIを使用します。

Firebase CLIがなければ、次のように実行できます（CLIのダウンロードが発生します）。

```sh
npx firebase-tools login
npx firebase-tools deploy --only hosting --project ctf1-99feb
```

`.firebaserc` にも `ctf1-99feb` を設定済みです。別のHostingサイトをこのプロジェクトで運用している場合は、既存サイトを上書きしないよう公開対象を先に確認してください。

公開後、`https://ctf1-99feb.web.app` から2人対戦を確認します。独自ドメインを使うときは、Renderの `ALLOWED_ORIGINS` にそのHTTPS originを追加してください。

## 無料版の制限

Renderの無料Web Serviceは15分間アクセスがないと休止し、月750時間の無料インスタンス時間をワークスペースで共有します。試合中の通常の定期通信はアクセスとして扱われますが、無料サービスの継続稼働を保証するものではありません。

現時点の試合データはメモリ内です。サーバーの再起動・休止後の再起動・再デプロイで試合とセッションが失われます。試合中にコードをデプロイしないでください。保存・復元は未実装で、展示本番までに対応が必要です。まずは試作品として公開する設定です。

## 公式資料

- https://render.com/docs/blueprint-spec
- https://render.com/docs/deploy-node-express-app
- https://render.com/docs/free
