import {mkdir,rm,copyFile,writeFile,readFile,cp} from 'node:fs/promises';
const root=new URL('../',import.meta.url),out=new URL('dist/',root);
// Publish only browser assets; never upload server code, tests, or operator secrets.
const files=['index.html','styles.css','game.js','renderer.js','network.js','reward-ui.js','config.js','admin.html'];
let apiOrigin;
try{({apiOrigin}=JSON.parse(await readFile(new URL('hosting-backend.json',root),'utf8')));}catch{throw Error('先に npm run configure:backend -- https://サービス名.onrender.com を実行してください。');}
if(new URL(apiOrigin).origin!==apiOrigin||!apiOrigin.startsWith('https://'))throw Error('接続先URLが不正です');
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
for(const name of files)await copyFile(new URL(name,root),new URL(name,out));
await mkdir(new URL('assets/',out),{recursive:true});
await copyFile(new URL('assets/planet-horizon.png',root),new URL('assets/planet-horizon.png',out));
await cp(new URL('assets/buildings/',root),new URL('assets/buildings/',out),{recursive:true});
await writeFile(new URL('runtime-config.js',out),`export const API_ORIGIN = ${JSON.stringify(apiOrigin)};\n`);
await writeFile(new URL('404.html',out),'<!doctype html><html lang="ja"><meta charset="utf-8"><title>ページがありません</title><h1>ページがありません</h1><a href="/">ゲームの入口へ</a></html>');
console.log(`Firebase Hosting用ファイルを dist/ に生成しました（${files.length+3}ファイル）。`);
