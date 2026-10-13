// Receives only the authenticated player's reward from the game server.
export function showReward(container,{eligible,request,isCurrent=()=>true}){
 const heading=document.createElement('h3');heading.textContent='あなたのユニコイン';
 const message=document.createElement('p');message.setAttribute('role','status');message.setAttribute('aria-live','polite');
 container.replaceChildren(heading,message);
 if(!eligible){message.textContent='途中終了はユニコインの対象外です。2人で15分間プレイを完了すると獲得できます。';return;}
 const content=document.createElement('div'),retry=document.createElement('button');retry.type='button';retry.textContent='QR取得を再試行';retry.hidden=true;container.append(content,retry);
 async function load(){
  retry.disabled=true;retry.hidden=true;message.textContent='獲得枚数を確認しています…';
  try{
   const reward=await request();if(!container.isConnected||!isCurrent())return;
   if(!Number.isSafeInteger(reward.coins)||reward.coins<0)throw Error('獲得枚数を確認できません。再試行してください。');
   message.textContent=`獲得ユニコイン：${reward.coins.toLocaleString('ja-JP')}枚`;content.replaceChildren();
   const info=document.createElement('p');
   if(reward.coins===0){info.textContent='今回はQRの発行はありません。';content.append(info);return;}
   if(typeof reward.qrImageDataUrl!=='string'||!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(reward.qrImageDataUrl)||!Number.isSafeInteger(reward.expiresAt))throw Error('QR画像を確認できません。再試行してください。');
   const image=document.createElement('img');image.className='reward-qr';image.alt='あなた専用のユニコイン獲得QRコード';
   image.onerror=()=>{if(!isCurrent())return;image.remove();message.textContent='QR画像を表示できませんでした。再試行してください。';retry.hidden=false;};image.src=reward.qrImageDataUrl;
   info.textContent=`有効期限：${new Date(reward.expiresAt*1000).toLocaleString('ja-JP')}（端末の現地時刻）`;
   const guide=document.createElement('p');guide.textContent='ZERO ARCADEアプリのウォレット →「スキャン」で読み取ってください。受け取りは1回のみです。再戦・ホームへ戻る前に読み取ってください。';
   content.append(image,info,guide);
  }catch(e){if(!container.isConnected||!isCurrent())return;message.textContent=e.message||'QRを取得できませんでした。再試行してください。';retry.hidden=false;}
  finally{retry.disabled=false;}
 }
 retry.onclick=load;void load();
}
