import React from 'react';
import { SlidersHorizontal, Send, FileCheck, ArrowRight } from 'lucide-react';

export const HowItWorks: React.FC = () => {
  const steps = [
    {
      number: '01',
      title: 'Simule perfil e valor',
      description:
        'Escolha entre Pessoa Física ou Jurídica e ajuste o montante e prazo ideais para o seu momento financeiro.',
      icon: SlidersHorizontal,
    },
    {
      number: '02',
      title: 'Conecte-se pelo WhatsApp',
      description:
        'Encaminhe sua simulação pelo canal oficial para atendimento humanizado e envio seguro dos dados cadastrais.',
      icon: Send,
    },
    {
      number: '03',
      title: 'Análise e formalização',
      description:
        'Nossa equipe avalia a melhor proposta com taxa clara e você decide se contrata após ver todas as condições.',
      icon: FileCheck,
    },
  ];

  return (
    <section id="como-funciona" className="py-20 bg-slate-900 border-b border-slate-800 text-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">

        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest font-mono">
            Transparência do Início ao Fim
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-2 tracking-tight" style={{ textWrap: 'balance' }}>
            Como funciona a sua solicitação na OnCred
          </h2>
          <p className="text-sm sm:text-base text-slate-300 mt-3 leading-relaxed">
            Sem filas, sem burocracia desnecessária e com total clareza em cada etapa.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.number}
                className="relative bg-slate-950/70 border border-slate-800 rounded-3xl p-6 sm:p-7 flex flex-col justify-between hover:border-slate-700 transition-colors shadow-lg"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-3xl font-black text-emerald-500/20 font-mono">
                      {step.number}
                    </span>
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-inner">
                      <Icon className="w-6 h-6" />
                    </div>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-white mb-2 leading-snug">
                    {step.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                    {step.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-900 text-[11px] text-emerald-400/80 font-medium font-mono">
                  Etapa 100% digital
                </div>
              </div>
            );
          })}
        </div>

        {/* Informative Note */}
        <div className="mt-12 p-4 rounded-2xl bg-slate-950/90 border border-slate-800 text-center max-w-2xl mx-auto text-xs text-slate-400 leading-relaxed">
          <strong className="text-slate-200">Importante:</strong> A simulação inicial é informativa. A contratação só ocorre após apresentação prévia e consentimento formal com a proposta definitiva.
        </div>

      </div>
    </section>
  );
};
