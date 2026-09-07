# Firebaseへの公開（Spark）

公開先は `ctf1-99feb`。画面をFirebase Hosting、対戦APIをRender無料Web Serviceで動かす方針です。Blaze、Cloud Run、有料データベースは使用しません。

手順は [DEPLOYMENT_RENDER.md](DEPLOYMENT_RENDER.md) にまとめました。

1. Renderを公開して実際のURLを取得。
2. `npm run configure:backend -- https://実際のサービス名.onrender.com`
3. `npm run build:hosting`
4. Firebase CLIでログインし、`npx firebase-tools deploy --only hosting --project ctf1-99feb`。

Hosting単独で対戦サーバーは動きません。接続先未設定のままビルド・公開しないよう、ビルド時に設定を検査します。配信対象は `dist/` の9ファイルで、サーバーコードと秘密情報は含みません。

ローカルプレイとRenderのURLへの直接アクセスは、従来通り同じサーバーへ接続します。

現在はローカル設定を準備した段階です。外部公開、Firebase/Renderへのログイン、実際の公開URLからの対戦確認はまだ行っていません。
