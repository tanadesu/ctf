import {API_ORIGIN} from './runtime-config.js';
let credentials=JSON.parse(sessionStorage.getItem('mars-session')||'null');
export function saved(){return credentials;}
export function clear(){credentials=null;sessionStorage.removeItem('mars-session');}
export async function api(path,body={}){
 const response=await fetch(API_ORIGIN+'/api/'+path,{method:'POST',headers:{'Content-Type':'application/json',...(credentials?{Authorization:'Bearer '+credentials.token}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(['create','join'].includes(path)?90000:10000)});
 const data=await response.json();if(!response.ok){const e=Error(data.error||'通信エラー');e.status=response.status;throw e;}return data;
}
export async function connect(mode,name,code){const data=await api(mode,{name,code});credentials={token:data.token,code:data.state.code};sessionStorage.setItem('mars-session',JSON.stringify(credentials));return data.state;}
export async function act(action,epoch){const body={id:globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`,epoch,action};try{return await api('action',body);}catch(e){if(e.status)throw e;return api('action',body);}}
