import React from 'react';
import { CREDIT_CONFIG, REPRESENTATIVE_EXAMPLE_DATA as example, formatCurrencyExactBRL as money } from '../config/creditConfig';
import { Info, Calculator, Percent, Calendar } from 'lucide-react';

export function FinancialConditions() {
  const annual = (Math.pow(1 + CREDIT_CONFIG.monthlyInterestFrom, 12) - 1) * 100;

  return (
    <section id="condicoes" className="py-20 bg-slate-900 border-b border-slate-800 text-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest font-mono">
            Parâmetros & Custos
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-2 tracking-tight">
            Condições Financeiras da Simulação
          </h2>
          <p className="mt-3 text-sm text-slate-300 max-w-xl mx-auto">
            A taxa de 1,35% ao mês é a taxa de referência utilizada nesta calculadora. Não representa oferta vinculante pré-aprovada.
          </p>
        </div>

        {/* Metric Cards */}
        <div className="grid sm:grid-cols-3 gap-5 mb-8">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span>Referência Mensal</span>
              <Percent className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-white font-mono">1,35% a.m.</div>
            <div className="text-[11px] text-slate-500 mt-2">Taxa mínima de referência</div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span>Equivalência Anual</span>
              <Calculator className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-white font-mono">
              {annual.toFixed(2).replace('.', ',')}% a.a.
            </div>
            <div className="text-[11px] text-slate-500 mt-2">Taxa nominal anual estimada</div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span>Prazos Disponíveis</span>
              <Calendar className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-white font-mono">6 a 120 meses</div>
            <div className="text-[11px] text-slate-500 mt-2">Limitado pelo valor solicitado</div>
          </div>
        </div>

        {/* Representative Example Card */}
        <div className="rounded-3xl bg-slate-950 border border-slate-800 p-6 sm:p-8">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider font-mono mb-3">
            <Info className="w-4 h-4" />
            <span>Exemplo Matemático Representativo da Calculadora</span>
          </div>

          <p className="text-sm text-slate-200 leading-relaxed">
            Para <strong className="text-white font-mono">{money(example.amount)}</strong> contratados em <strong className="text-white font-mono">{example.termMonths} meses</strong>, aplicando a taxa de referência de 1,35% a.m.: parcela estimada de <strong className="text-emerald-400 font-mono">{money(example.installmentAmount)}</strong>, total final calculado de <strong className="text-white font-mono">{money(example.totalAmount)}</strong> e montante de juros de <strong className="text-slate-300 font-mono">{money(example.totalAmount - example.amount)}</strong>.
          </p>

          <p className="mt-4 text-xs text-slate-400 leading-relaxed pt-4 border-t border-slate-900">
            O exemplo considera exclusivamente juros de referência pela Tabela Price, sem presumir tarifas adicionais, tributos federais (IOF), seguros ou outros encargos acessórios. O Custo Efetivo Total (CET), impostos, eventuais tarifas, prazos finais e forma de quitação serão detalhados na proposta cadastral individual antes de qualquer contratação.
          </p>
        </div>

        <p className="mt-6 text-xs text-slate-400 text-center max-w-2xl mx-auto leading-relaxed">
          A concessão de crédito está sujeita à aprovação cadastral e análise de crédito. Esta página não promete aprovação automática nem depósitos imediatos.
        </p>
      </div>
    </section>
  );
}
