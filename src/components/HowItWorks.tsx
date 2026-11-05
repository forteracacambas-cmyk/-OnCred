import React from 'react';
import { SlidersHorizontal, Send, FileCheck } from 'lucide-react';

export const HowItWorks: React.FC = () => {
  const steps = [
    {
      number: '01',
      title: 'Escolha seu perfil e o valor de interesse',
      description:
        'Indique se a solicitação é para Pessoa Física ou Pessoa Jurídica e selecione a quantia pretendida no simulador inicial.',
      icon: SlidersHorizontal,
    },
    {
      number: '02',
      title: 'Envie sua solicitação para análise',
      description:
        'Continue pelo canal oficial no WhatsApp para iniciar o atendimento e fornecer os dados necessários para a avaliação.',
      icon: Send,
    },
    {
      number: '03',
      title: 'Avaliação das condições disponíveis',
      description:
        'Caso existam condições disponíveis para o seu perfil, elas serão apresentadas para avaliação antes de qualquer contratação.',
      icon: FileCheck,
    },
  ];

  return (
    <section id="como-funciona" className="py-16 bg-white border-b border-slate-200">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">

        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">
            Etapas do Processo
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-2 tracking-tight">
            Como funciona a solicitação
          </h2>
          <p className="text-sm sm:text-base text-slate-600 mt-2">
            Entenda de forma transparente o fluxo desde a manifestação de interesse até a resposta da análise.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.number}
                className="relative bg-slate-50 border border-slate-200 rounded-2xl p-6 sm:p-7 flex flex-col justify-between hover:border-slate-300 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-3xl font-extrabold text-blue-900/20 font-mono">
                      {step.number}
                    </span>
                    <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                      <Icon className="w-6 h-6" />
                    </div>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-2.5 leading-snug">
                    {step.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {step.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-200/70 text-[11px] text-slate-400 font-medium">
                  Sujeito à análise de crédito
                </div>
              </div>
            );
          })}
        </div>

        {/* Informative Note */}
        <div className="mt-10 p-4 rounded-xl bg-slate-100/80 border border-slate-200 text-center max-w-2xl mx-auto">
          <p className="text-xs text-slate-600 leading-relaxed">
            <strong className="text-slate-800">Transparência:</strong> O envio das informações não representa aprovação nem garantia de liberação de valores. A contratação só ocorre após apresentação prévia e consentimento formal com as condições aprovadas.
          </p>
        </div>

      </div>
    </section>
  );
};
