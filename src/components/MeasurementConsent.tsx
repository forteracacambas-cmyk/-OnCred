import {useEffect,useState} from 'react';
import {setAnalyticsConsent,loadPixel} from '../utils/atendimento';
export function MeasurementConsent(){
 const [open,setOpen]=useState(()=>{try{return !['yes','no'].includes(localStorage.getItem('oncred_measurement')||'')}catch{return true}});
 useEffect(()=>{loadPixel();const show=()=>setOpen(true);window.addEventListener('oncred_open_consent',show);return ()=>window.removeEventListener('oncred_open_consent',show)},[]);
 if(!open)return null;
 function choose(value:boolean){setAnalyticsConsent(value);setOpen(false)}
 return <aside aria-label="Preferências de cookies" className="fixed bottom-3 left-3 right-3 z-50 mx-auto max-w-3xl rounded-2xl bg-white text-slate-900 border border-slate-300 p-5 shadow-2xl"><p className="font-bold">Sua escolha de privacidade</p><p className="text-sm text-slate-700 mt-2">Usamos um cookie técnico para encaminhar o atendimento. A medição de anúncios é opcional e só é ativada com sua autorização. Você pode alterar a escolha no rodapé.</p><div className="flex flex-wrap gap-3 mt-4"><button className="rounded-lg border border-slate-400 px-4 py-2 font-semibold" onClick={()=>choose(false)}>Somente necessários</button><button className="rounded-lg bg-blue-700 text-white px-4 py-2 font-semibold" onClick={()=>choose(true)}>Aceitar medição</button><a className="underline px-2 py-2 text-sm" href="/politica-de-privacidade.html">Ver política</a></div></aside>
}
