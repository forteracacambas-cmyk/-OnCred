import React from 'react';
import { ShieldCheck, MessageSquare, Building, CheckCircle2 } from 'lucide-react';

export function OperationModel() {
  return (
    <section className="py-16 bg-slate-950 border-b border-slate-800 text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-widest font-mono mb-2">
            <ShieldCheck className="w-4 h-4" />
            <span>Modelo Operacional Transparente</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white">
            Simulação consciente e atendimento direto
          </h2>

          <div className="mt-5 space-y-3.5 text-xs sm:text-sm text-slate-300 leading-relaxed">
            <p>
              Nossa plataforma possibilita que você configure o valor e o prazo ideais para sua necessidade e dê início à triagem cadastral sem custo algum.
            </p>
            <p>
              A análise e eventual formalização são realizadas diretamente pela instituição responsável pela operação. Você tem acesso integral a todas as condições (taxa de juros, CET, tarifas e prazos) antes de assumir qualquer compromisso financeiro.
            </p>
            <p className="text-slate-400 text-xs pt-2 border-t border-slate-800">
              A mensagem com os dados de sua simulação só é enviada quando você confirma o envio no aplicativo do WhatsApp.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
