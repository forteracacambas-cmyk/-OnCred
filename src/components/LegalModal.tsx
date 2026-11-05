import {useEffect,useRef} from 'react';
import {privacySections,termsSections} from '../config/legalContent';
export function LegalModal({isOpen,onClose,kind}:{isOpen:boolean;onClose:()=>void;kind:'privacy'|'terms'}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const dialog=ref.current;if(isOpen&&!dialog?.open)dialog?.showModal();else if(!isOpen&&dialog?.open)dialog.close()},[isOpen]);
 return <dialog ref={ref} onCancel={onClose} onClose={onClose} className="m-auto w-[min(94vw,48rem)] max-h-[90vh] rounded-2xl bg-white text-slate-800 p-0 shadow-2xl backdrop:bg-black/70"><header className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center gap-4"><h2 className="font-bold text-lg">{kind==='privacy'?'Política de Privacidade':'Termos de Uso'}</h2><button autoFocus aria-label="Fechar documento" onClick={onClose} className="px-3 py-2 rounded-lg border border-slate-600">Fechar</button></header><div className="p-6 space-y-5 text-sm leading-relaxed">{(kind==='privacy'?privacySections:termsSections).map(([title,text])=><section key={title}><h3 className="text-slate-900 font-bold mb-2">{title}</h3><p>{text}</p></section>)}<p className="text-xs text-slate-600">Atualização: 5 de novembro de 2026.</p></div></dialog>
}
