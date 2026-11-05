import React from 'react';
import { CreditType } from '../types/credit';
import { ArrowRight, CheckCircle2, ShieldCheck, Zap, Building2, UserCheck, Briefcase } from 'lucide-react';
import imgWorker from '../assets/images/credit_fgts_worker_1793859865891.jpg';
import imgSenior from '../assets/images/credit_consignado_senior_1793859865152.jpg';
import imgBusiness from '../assets/images/credit_business_growth_1793859865752.jpg';

interface CreditLinesGridProps {
  onSelectModality: (type: CreditType) => void;
}

export const CreditLinesGrid: React.FC<CreditLinesGridProps> = ({ onSelectModality }) => {
  return (
    <section id="modalidades" className="py-20 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mb-12">
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-800 mb-2">
            Nossas Linhas de Crédito
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight" style={{ textWrap: 'balance' }}>
            Soluções desenhadas para a sua realidade financeira
          </h2>
          <p className="mt-2 text-sm sm:text-base text-slate-600">
            Trabalhamos com as principais modalidades do sistema financeiro nacional com taxas reguladas e condições especiais.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Card 1: FGTS (Col-span 7) */}
          <div className="lg:col-span-7 bg-slate-900 text-white rounded-2xl overflow-hidden border border-slate-800 flex flex-col md:flex-row group">
            <div className="md:w-1/2 relative overflow-hidden h-64 md:h-auto min-h-[260px]">
              <img
                src={imgWorker}
                alt="Trabalhadora brasileira conferindo depósito Pix de antecipação FGTS no celular"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-slate-950/80 md:from-transparent md:to-slate-950/90 to-slate-950" />
            </div>
            <div className="md:w-1/2 p-6 sm:p-8 flex flex-col justify-between">
              <div>
                <div className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-semibold mb-1">
                  10 Minutos via Pix
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Antecipação Saque-Aniversário FGTS</h3>
                <p className="text-xs text-slate-300 leading-relaxed mb-4">
                  Transforme seu saldo inativo ou ativo do FGTS em dinheiro na mão hoje mesmo, sem pagar boleto mensal e sem consulta ao SPC/Serasa.
                </p>

                <div className="space-y-1.5 text-xs text-slate-300 mb-6">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Juros a partir de 1,39% ao mês</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Antecipe até 10 parcelas anuais</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Não desconta nada do salário mensal</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => onSelectModality('fgts')}
                className="inline-flex items-center justify-between w-full py-3 px-4 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl transition-all"
              >
                <span>Simular Antecipação FGTS</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Card 2: Consignado (Col-span 5) */}
          <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden flex flex-col justify-between group">
            <div className="relative h-48 overflow-hidden">
              <img
                src={imgSenior}
                alt="Aposentados relaxando com tranquilidade financeira"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 to-transparent" />
              <div className="absolute bottom-3 left-4 text-white text-xs font-bold">
                Aposentados, Pensionistas & Servidores
              </div>
            </div>

            <div className="p-6 sm:p-7 flex flex-col justify-between flex-grow">
              <div>
                <div className="text-xs font-semibold text-emerald-800 mb-1">Menores Taxas do Mercado</div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Crédito Consignado</h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  Desconto direto no contracheque ou benefício INSS com prazos confortáveis de até 84 meses e juros fixos protegidos por lei.
                </p>

                <div className="text-xs space-y-1 text-slate-600 mb-6">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Taxa a partir de 1,29% a.m.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Disponível mesmo para negativados</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => onSelectModality('consignado')}
                className="inline-flex items-center justify-between w-full py-2.5 px-4 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-all"
              >
                <span>Simular Consignado</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Card 3: Capital de Giro PJ (Col-span 5) */}
          <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden flex flex-col justify-between group">
            <div className="relative h-48 overflow-hidden">
              <img
                src={imgBusiness}
                alt="Empreendedora com padaria artesanal e crescimento nas vendas"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 to-transparent" />
              <div className="absolute bottom-3 left-4 text-white text-xs font-bold">
                Para MEI, Micro e Pequenas Empresas
              </div>
            </div>

            <div className="p-6 sm:p-7 flex flex-col justify-between flex-grow">
              <div>
                <div className="text-xs font-semibold text-emerald-800 mb-1">Impulso para Negócios</div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Capital de Giro & PJ</h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  Financiamento de estoque, reformas ou alívio de fluxo de caixa para empresas com CNPJ ativo a partir de 6 meses.
                </p>

                <div className="text-xs space-y-1 text-slate-600 mb-6">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Valores até R$ 150.000</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Carência de até 90 dias</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => onSelectModality('pj')}
                className="inline-flex items-center justify-between w-full py-2.5 px-4 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-all"
              >
                <span>Simular Crédito PJ</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Card 4: Garantia de Veículo & Empréstimo Pessoal (Col-span 7) */}
          <div className="lg:col-span-7 bg-slate-900 text-white rounded-2xl p-6 sm:p-8 border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-emerald-400 font-semibold mb-2">
                <span>Alto Limite de Crédito</span>
                <span aria-hidden="true">·</span>
                <span>Taxas a partir de 0,99% a.m.</span>
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">
                Refinanciamento & Empréstimo com Garantia
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl mb-6">
                Use seu carro, moto ou imóvel como garantia para obter as menores taxas de juros do país e prazos de até 60 a 240 meses. O melhor: você continua utilizando seu bem normalmente todos os dias!
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
                <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60">
                  <div className="text-xs text-slate-400">Até 90% da FIPE</div>
                  <div className="text-sm font-bold text-white mt-0.5">Veículo Quitado</div>
                </div>
                <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60">
                  <div className="text-xs text-slate-400">Até 240 parcelas</div>
                  <div className="text-sm font-bold text-white mt-0.5">Garantia Imóvel</div>
                </div>
                <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60">
                  <div className="text-xs text-slate-400">Sem fiador</div>
                  <div className="text-sm font-bold text-white mt-0.5">100% Descomplicado</div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => onSelectModality('garantia_veiculo')}
                className="flex-1 py-3 px-4 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <span>Simular com Garantia</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => onSelectModality('pessoal')}
                className="flex-1 py-3 px-4 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all flex items-center justify-center gap-2 border border-slate-700"
              >
                <span>Empréstimo Pessoal sem garantia</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
