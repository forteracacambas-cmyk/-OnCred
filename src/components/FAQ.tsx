import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';

const items = [
  [
    'A simulação garante aprovação automática?',
    'Não. A simulação realizada no site é uma estimativa matemática ilustrativa com base na taxa de referência. As condições efetivas, prazos e eventual aprovação dependem de análise cadastral e de crédito realizada pela instituição financeira responsável.',
  ],
  [
    'Cobram algum valor ou taxa antecipada para liberar empréstimo?',
    'NUNCA, sob hipótese alguma! A cobrança antecipada para liberação de empréstimo é crime (Art. 171 do Código Penal). A OnCred SCD e as instituições parceiras nunca solicitam adiantamentos, seguros-fiança ou depósitos para aprovação de crédito.',
  ],
  [
    'Quem recebe minha solicitação após clicar em Solicitar Análise?',
    'Ao clicar no botão, os dados da sua simulação são preparados para abertura no WhatsApp oficial e encaminhados a um atendente disponível da nossa equipe para dar início à triagem cadastral.',
  ],
  [
    'Por que as parcelas e os prazos mudam conforme o valor?',
    'A calculadora utiliza regras de sustentabilidade financeira que limitam o prazo máximo em função do montante solicitado, assegurando que o valor mensal da parcela seja condizente com a modalidade.',
  ],
  [
    'A taxa de 1,35% ao mês é uma oferta definitiva?',
    'Não. A taxa de 1,35% a.m. é uma taxa de referência informativa adotada para a simulação inicial. A taxa efetiva, CET, tributos (IOF) e tarifas serão discriminados detalhadamente na proposta individual.',
  ],
  [
    'Preciso informar CPF, senha bancária ou dados de cartão neste site?',
    'Não. O formulário do simulador utiliza exclusivamente o perfil (PF/PJ), o valor e o prazo pretendido. Nunca solicitamos senhas, dados de cartão ou códigos de segurança pelo site.',
  ],
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="duvidas" className="py-20 bg-slate-900 border-b border-slate-800 text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest font-mono">
            Tire Suas Dúvidas
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-2 tracking-tight">
            Perguntas Frequentes
          </h2>
          <p className="mt-3 text-sm text-slate-300">
            Respostas diretas sobre como funciona o processo de simulação e atendimento.
          </p>
        </div>

        <div className="space-y-3">
          {items.map(([q, a], i) => {
            const isOpen = open === i;
            return (
              <div
                key={q}
                className="bg-slate-950/80 border border-slate-800 rounded-2xl overflow-hidden transition-colors"
              >
                <button
                  className="w-full text-left p-5 sm:p-6 font-bold text-sm sm:text-base text-white flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-800/40"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : i)}
                >
                  <span>{q}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-emerald-400 shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 sm:px-6 sm:pb-6 text-xs sm:text-sm text-slate-300 leading-relaxed border-t border-slate-900 pt-3">
                    {a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
