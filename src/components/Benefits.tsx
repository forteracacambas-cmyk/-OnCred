import React from 'react';
import { Smartphone, CheckCircle2, Globe, UserCheck, ShieldCheck, Zap } from 'lucide-react';

export const Benefits: React.FC = () => {
  const benefits = [
    {
      title: 'Atendimento 100% digital',
      description: 'Inicie e acompanhe sua solicitação pelo celular ou computador, de onde você estiver com total praticidade.',
      icon: Smartphone,
    },
    {
      title: 'Sem taxas antecipadas',
      description: 'Nunca cobramos nenhum valor prévio para análise ou liberação. Cobrança antecipada é crime.',
      icon: ShieldCheck,
    },
    {
      title: 'Triagem direta no WhatsApp',
      description: 'Encaminhamento dos parâmetros calculados para um atendente cadastrado neste canal mediante sua confirmação.',
      icon: Zap,
    },
    {
      title: 'Análise individualizada',
      description: 'As condições finais (taxa, CET, tributos e prazos) são definidas pela instituição responsável conforme análise cadastral.',
      icon: UserCheck,
    },
    {
      title: 'Sem filas de agências',
      description: 'Inicie a simulação e o contato inicial de forma digital antes da etapa de análise documental.',
      icon: Globe,
    },
    {
      title: 'Privacidade e cuidado com dados',
      description: 'Não solicitamos senhas bancárias, dados de cartão ou pagamentos prévios nesta página. Consulte a Política de Privacidade.',
      icon: CheckCircle2,
    },
  ];

  return (
    <section className="py-20 bg-slate-950 border-b border-slate-800 text-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">

        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest font-mono">
            Estrutura Digital
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-2 tracking-tight">
            Como funciona a simulação na ZM SCD
          </h2>
          <p className="text-sm sm:text-base text-slate-300 mt-2">
            Simulação gratuita e ilustrativa para maiores de 18 anos, com transparência antes de contratar.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <div
                key={index}
                className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-sm hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-5 shadow-inner">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-2">
                    {benefit.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
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
