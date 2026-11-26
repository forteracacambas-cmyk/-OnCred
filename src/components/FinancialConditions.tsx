import React from 'react';
import { CREDIT_CONFIG, REPRESENTATIVE_EXAMPLE_DATA as example, formatCurrencyExactBRL as money } from '../config/creditConfig';
import { Info, Calculator, Percent, Calendar } from 'lucide-react';

export function FinancialConditions() {
  const monthlyRatePct = (CREDIT_CONFIG.monthlyInterestFrom * 100)
    .toFixed(2)
    .replace('.', ',');
  const annual = (Math.pow(1 + CREDIT_CONFIG.monthlyInterestFrom, 12) - 1) * 100;
  const annualEffectivePct = annual.toFixed(2).replace('.', ',');

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
            A taxa ilustrativa da simulação de {monthlyRatePct}% ao mês é usada apenas para cálculo de referência nesta página. Não representa taxa mínima garantida nem oferta pré-aprovada.
          </p>
        </div>

        {/* Metric Cards */}
        <div className="grid sm:grid-cols-3 gap-5 mb-8">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span>Taxa da Simulação</span>
              <Percent className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-white font-mono">{monthlyRatePct}% a.m.</div>
            <div className="text-[11px] text-slate-500 mt-2">Taxa ilustrativa da simulação (não é taxa mínima)</div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span>Taxa Anual Efetiva Equivalente</span>
              <Calculator className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-white font-mono">
              {annualEffectivePct}% a.a.
            </div>
            <div className="text-[11px] text-slate-500 mt-2">Equivalente efetiva anual (não é taxa nominal nem CET)</div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span>Prazos da Simulação</span>
              <Calendar className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-white font-mono">
              {CREDIT_CONFIG.minimumTermMonths} a {CREDIT_CONFIG.maximumTermMonths} meses
            </div>
            <div className="text-[11px] text-slate-500 mt-2">Prazos da simulação conforme o valor; sujeitos à análise, sem promessa de disponibilidade</div>
          </div>
        </div>

        {/* Representative Example Card */}
        <div className="rounded-3xl bg-slate-950 border border-slate-800 p-6 sm:p-8">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider font-mono mb-3">
            <Info className="w-4 h-4" />
            <span>Exemplo Matemático Ilustrativo da Simulação (Tabela Price)</span>
          </div>

          <p className="text-sm text-slate-200 leading-relaxed">
            Para <strong className="text-white font-mono">{money(example.amount)}</strong> simulados em <strong className="text-white font-mono">{example.termMonths} meses</strong> (prazo da simulação), considerando a taxa ilustrativa da simulação de {monthlyRatePct}% a.m. (equivalente efetiva anual de {annualEffectivePct}% a.a., não nominal nem CET): parcela estimada de <strong className="text-emerald-400 font-mono">{money(example.installmentAmount)}</strong>, total final calculado de <strong className="text-white font-mono">{money(example.totalAmount)}</strong> e juros estimados de <strong className="text-slate-300 font-mono">{money(example.totalAmount - example.amount)}</strong>.
          </p>

          <p className="mt-4 text-xs text-slate-400 leading-relaxed pt-4 border-t border-slate-900">
            Este exemplo considera exclusivamente os juros ilustrativos acima pela Tabela Price e <strong>não inclui</strong> Imposto sobre Operações Financeiras (IOF), tarifas cadastrais ou operacionais, seguros ou demais encargos acessórios, não representando o Custo Efetivo Total (CET). A proposta individual informará o CET completo, a taxa efetiva aplicável, tributos, eventuais tarifas e prazos definitivos antes de qualquer contratação.
          </p>
        </div>

        <p className="mt-6 text-xs text-slate-400 text-center max-w-2xl mx-auto leading-relaxed">
          Para maiores de 18 anos. A concessão de crédito está sujeita à análise cadastral e aprovação. Esta página não promete aprovação automática, liberação imediata, taxa mínima ou disponibilidade garantida de prazo.
        </p>
      </div>
    </section>
  );
}
