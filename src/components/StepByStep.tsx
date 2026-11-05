import React from 'react';
import { Smartphone, CheckCircle, FileText, Send, Zap } from 'lucide-react';

interface StepByStepProps {
  onStartSimulation: () => void;
}

export const StepByStep: React.FC<StepByStepProps> = ({ onStartSimulation }) => {
  const steps = [
    {
      number: '01',
      title: 'Simulação Online & Rápida',
      description: 'Escolha a modalidade desejada, ajuste o valor e prazo no nosso simulador em menos de 1 minuto.',
      icon: Smartphone,
    },
    {
      number: '02',
      title: 'Análise Inteligente sem Compromisso',
      description: 'Nosso motor de crédito consulta as melhores taxas em múltiplos bancos parceiros sem prejudicar seu score.',
      icon: FileText,
    },
    {
      number: '03',
      title: 'Assinatura Digital pelo Celular',
      description: 'Envie foto do documento e confirme seus dados por biometria facial segura, sem sair do sofá.',
      icon: CheckCircle,
    },
    {
      number: '04',
      title: 'Dinheiro na Conta via Pix',
      description: 'Após a aprovação formal, o valor é transferido diretamente para a chave Pix de sua titularidade.',
      icon: Zap,
    },
  ];

  return (
    <section id="como-funciona" className="py-20 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-14">
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-800 mb-2">
            Processo 100% Digital
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight" style={{ textWrap: 'balance' }}>
            Como contratar seu empréstimo em 4 etapas simples
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600">
            Esqueça filas de agências, gerentes insistentes e papelada física. Tudo acontece na palma da sua mão.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.number}
                className="relative p-6 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between hover:border-slate-300 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-2xl font-black font-mono text-emerald-700">
                      {step.number}
                    </span>
                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 shadow-sm">
                      <Icon className="w-5 h-5 text-emerald-700" />
                    </div>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-2">{step.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{step.description}</p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-200/60 text-[11px] font-medium text-emerald-800">
                  Etapa digital automatizada
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-12 p-6 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="text-center sm:text-left">
            <h4 className="text-base font-bold text-emerald-950">Pronto para dar o primeiro passo?</h4>
            <p className="text-xs text-emerald-800 mt-0.5">
              Faça sua simulação agora e descubra quanto você pode ter na conta hoje mesmo.
            </p>
          </div>
          <button
            onClick={onStartSimulation}
            className="px-6 py-3 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 active:scale-95 rounded-xl shadow-sm transition-all whitespace-nowrap shrink-0"
          >
            Iniciar Simulação Gratuita
          </button>
        </div>
      </div>
    </section>
  );
};
