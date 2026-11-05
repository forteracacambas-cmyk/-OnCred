import React from 'react';
import { Smartphone, CheckCircle2, Globe, UserCheck, ShieldCheck } from 'lucide-react';

export const Benefits: React.FC = () => {
  const benefits = [
    {
      title: 'Atendimento digital',
      description: 'Inicie e acompanhe sua solicitação pelo celular ou computador, de onde estiver.',
      icon: Smartphone,
    },
    {
      title: 'Processo simples',
      description: 'Envio rápido das informações básicas pelo WhatsApp para início da triagem cadastral.',
      icon: CheckCircle2,
    },
    {
      title: 'Solicitação online',
      description: 'Sem necessidade de deslocamento físico até uma agência bancária tradicional.',
      icon: Globe,
    },
    {
      title: 'Análise individual',
      description: 'As condições dependem da análise da instituição responsável pela operação.',
      icon: UserCheck,
    },
    {
      title: 'Segurança e transparência',
      description: 'Informações claras sobre simulação, encaminhamento e uso de dados.',
      icon: ShieldCheck,
    },
  ];

  return (
    <section className="py-16 bg-slate-50 border-b border-slate-200">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">

        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">
            Vantagens do Modelo Digital
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-2 tracking-tight">
            Por que solicitar com a OnCred?
          </h2>
          <p className="text-sm sm:text-base text-slate-600 mt-2">
            Estrutura voltada à eficiência, respeito aos seus dados e clareza em todas as etapas.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <div
                key={index}
                className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-4">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-2">
                    {benefit.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {benefit.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
