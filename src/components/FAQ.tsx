import React, { useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';

export const FAQ: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [searchQuery, setSearchQuery] = useState('');

  const faqs = [
    {
      q: 'Quem está com nome sujo ou negativado no SPC/Serasa pode conseguir empréstimo?',
      a: 'Sim! Para modalidades como a Antecipação do Saque-Aniversário do FGTS e o Empréstimo Consignado (INSS e Servidores Públicos), não há consulta restritiva aos birôs como SPC e Serasa. A garantia da operação é o próprio saldo do FGTS ou a margem consignável, o que permite aprovação mesmo para negativados.',
    },
    {
      q: 'É cobrado algum tipo de valor ou taxa antecipada para liberar o crédito?',
      a: 'NÃO, absolutamente nunca! A cobrança antecipada para liberação de empréstimo é CRIME. A ValoreCrédito é um correspondente bancário regulamentado e não exige nenhum tipo de depósito, taxa de cadastro, seguro-fiança ou pagamento prévio. Toda remuneração é paga diretamente pelo banco parceiro contratado.',
    },
    {
      q: 'Como funciona a antecipação do Saque-Aniversário do FGTS?',
      a: 'Você autoriza os bancos parceiros a consultarem seu saldo no aplicativo do FGTS da Caixa. Em seguida, nosso sistema calcula quanto você pode antecipar de até 10 parcelas anuais. O pagamento é feito anualmente direto pela Caixa ao banco financiador, ou seja, você não precisa pagar nenhum boleto mensal nem compromete seu salário.',
    },
    {
      q: 'Em quanto tempo o dinheiro cai na minha conta bancária?',
      a: 'Na antecipação do Saque-Aniversário FGTS, a liberação ocorre via Pix em média em 10 a 30 minutos após a aprovação da formalização digital. No crédito consignado ou pessoal, o prazo varia entre 2 horas e até 24 horas úteis.',
    },
    {
      q: 'Quais documentos são exigidos para a contratação?',
      a: 'O processo é 100% digital. Você só precisa de um documento oficial com foto (RG ou CNH atualizada), comprovante de residência recente e uma selfie para biometria facial antifraude feita pela câmera do próprio celular.',
    },
    {
      q: 'O que é o CET (Custo Efetivo Total)?',
      a: 'O Custo Efetivo Total (CET) é a taxa percentual que reflete o custo real de uma operação de crédito, incluindo a taxa de juros, tributos federais obrigatórios (IOF), tarifas de cadastro e eventuais seguros. Apresentamos o CET de forma 100% clara e transparente antes da assinatura do contrato.',
    },
  ];

  const filteredFaqs = faqs.filter(
    (item) =>
      item.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.a.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <section id="faq" className="py-20 bg-white border-b border-slate-200">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-800 mb-2">
            Tire Suas Dúvidas
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight" style={{ textWrap: 'balance' }}>
            Perguntas Frequentes sobre Crédito
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Respostas claras e diretas para você contratar com total segurança.
          </p>

          {/* Search filter input */}
          <div className="relative max-w-md mx-auto mt-6">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Pesquise por FGTS, negativado, taxa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-900"
            />
          </div>
        </div>

        {/* Accordions */}
        <div className="space-y-3">
          {filteredFaqs.length > 0 ? (
            filteredFaqs.map((item, index) => {
              const isOpen = openIndex === index;
              return (
                <div
                  key={index}
                  className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50 transition-colors"
                >
                  <button
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                    className="w-full px-5 py-4 text-left font-bold text-sm sm:text-base text-slate-900 flex items-center justify-between gap-4 hover:bg-slate-100/70"
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      className={`w-5 h-5 text-slate-500 shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-emerald-700' : ''
                      }`}
                    />
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-200/60 pt-3 bg-white">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-xs text-slate-500">
              Nenhuma pergunta encontrada para sua busca. Tente palavras como "Pix", "FGTS" ou "Taxas".
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
