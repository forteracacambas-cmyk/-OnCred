import React, { useState, useMemo } from 'react';
import { CreditModality, CreditType, SimulationResult } from '../types/credit';
import { CREDIT_MODALITIES } from '../data/modalities';
import { formatBRL, formatPercent, calculatePMT, estimateIOF } from '../utils/formatters';
import { ArrowRight, Sparkles, CheckCircle2, AlertCircle, Info, Calculator, TrendingDown } from 'lucide-react';

interface CreditSimulatorProps {
  onStartProposal: (modality: CreditModality, result: SimulationResult) => void;
}

export const CreditSimulator: React.FC<CreditSimulatorProps> = ({ onStartProposal }) => {
  const [selectedType, setSelectedType] = useState<CreditType>('fgts');

  const currentModality = useMemo(() => {
    return CREDIT_MODALITIES.find((m) => m.id === selectedType) || CREDIT_MODALITIES[0];
  }, [selectedType]);

  const [amount, setAmount] = useState<number>(currentModality.defaultAmount);
  const [months, setMonths] = useState<number>(currentModality.defaultMonths);

  // Sync amount and months when switching modality to stay within bounds
  const handleSelectModality = (type: CreditType) => {
    setSelectedType(type);
    const mod = CREDIT_MODALITIES.find((m) => m.id === type) || CREDIT_MODALITIES[0];
    setAmount(mod.defaultAmount);
    setMonths(mod.defaultMonths);
  };

  // Simulation calculation
  const simulation = useMemo((): SimulationResult => {
    const pmt = calculatePMT(amount, currentModality.monthlyInterestRate, months);
    const totalPayment = pmt * months;
    const totalInterest = Math.max(0, totalPayment - amount);
    const estimatedIof = estimateIOF(amount, months);

    // Brazilian Credit Card comparison: average ~14.2% a.m.
    const ccPmt = calculatePMT(amount, 14.2, Math.min(months, 12));
    const creditCardTotal = ccPmt * Math.min(months, 12);
    const estimatedSavings = Math.max(0, creditCardTotal - totalPayment);

    return {
      amount,
      months,
      monthlyRate: currentModality.monthlyInterestRate,
      monthlyPayment: pmt,
      totalPayment,
      totalInterest,
      annualCet: currentModality.annualCet,
      estimatedIof,
      creditCardComparisonTotal: creditCardTotal,
      estimatedSavings,
    };
  }, [amount, months, currentModality]);

  // Amount presets based on modality
  const amountPresets = useMemo(() => {
    if (currentModality.id === 'fgts') return [1000, 2500, 5000, 10000, 15000];
    if (currentModality.id === 'consignado') return [5000, 15000, 30000, 60000, 100000];
    if (currentModality.id === 'garantia_veiculo') return [15000, 30000, 50000, 100000, 150000];
    if (currentModality.id === 'pj') return [10000, 25000, 50000, 80000, 120000];
    return [2000, 5000, 10000, 15000, 25000];
  }, [currentModality]);

  // Months presets based on modality
  const monthsPresets = useMemo(() => {
    if (currentModality.id === 'fgts') return [1, 3, 5, 7, 10];
    if (currentModality.id === 'consignado') return [24, 36, 48, 72, 84];
    if (currentModality.id === 'garantia_veiculo') return [12, 24, 36, 48, 60];
    return [6, 12, 18, 24, 36];
  }, [currentModality]);

  return (
    <section id="simulador" className="py-16 sm:py-20 bg-slate-100/70 border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-800 mb-2">
            <Calculator className="w-4 h-4 text-emerald-700" />
            <span>Simulador Interativo em Tempo Real</span>
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight" style={{ textWrap: 'balance' }}>
            Descubra sua parcela ideal sem compromisso
          </h2>
          <p className="mt-2 text-sm sm:text-base text-slate-600">
            Ajuste o valor e o prazo abaixo. Não há cobrança de taxas antecipadas e a simulação não altera seu score.
          </p>
        </div>

        {/* Modality Selector Tabs */}
        <div className="flex items-center justify-start sm:justify-center overflow-x-auto pb-3 mb-8 gap-2 scrollbar-none">
          {CREDIT_MODALITIES.map((mod) => {
            const isSelected = mod.id === selectedType;
            return (
              <button
                key={mod.id}
                onClick={() => handleSelectModality(mod.id)}
                className={`px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all whitespace-nowrap shrink-0 border ${
                  isSelected
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {mod.title}
              </button>
            );
          })}
        </div>

        {/* Main Simulator Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
            {/* Left Column: Sliders & Custom Controls */}
            <div className="lg:col-span-7 p-6 sm:p-8 lg:p-10 flex flex-col justify-between">
              <div>
                {/* Modality Header Description */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{currentModality.title}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{currentModality.tagline}</p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200/60">
                    {currentModality.badge}
                  </span>
                </div>

                {/* Slider 1: Desired Amount */}
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-3">
                    <label htmlFor="amount-slider" className="text-sm font-semibold text-slate-700">
                      Quanto você precisa?
                    </label>
                    <span className="text-xl sm:text-2xl font-extrabold text-slate-950 font-mono tabular-nums">
                      {formatBRL(amount, false)}
                    </span>
                  </div>

                  <input
                    id="amount-slider"
                    type="range"
                    min={currentModality.minAmount}
                    max={currentModality.maxAmount}
                    step={currentModality.stepAmount}
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                  />

                  <div className="flex items-center justify-between text-xs text-slate-400 mt-2 font-mono tabular-nums">
                    <span>Mín: {formatBRL(currentModality.minAmount, false)}</span>
                    <span>Máx: {formatBRL(currentModality.maxAmount, false)}</span>
                  </div>

                  {/* Amount Preset Chips */}
                  <div className="flex items-center gap-1.5 mt-3 overflow-x-auto pb-1">
                    <span className="text-xs text-slate-500 font-medium mr-1 shrink-0">Atalhos:</span>
                    {amountPresets.map((preset) => (
                      <button
                        key={preset}
                        onClick={() => setAmount(preset)}
                        className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors shrink-0 ${
                          amount === preset
                            ? 'bg-emerald-100 text-emerald-900 font-semibold'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        {formatBRL(preset, false)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Slider 2: Number of installments */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <label htmlFor="months-slider" className="text-sm font-semibold text-slate-700">
                      {currentModality.id === 'fgts' ? 'Quantos anos antecipar?' : 'Em quantas parcelas?'}
                    </label>
                    <span className="text-xl sm:text-2xl font-extrabold text-slate-950 font-mono tabular-nums">
                      {months} {currentModality.id === 'fgts' ? (months === 1 ? 'ano' : 'anos') : 'vezes'}
                    </span>
                  </div>

                  <input
                    id="months-slider"
                    type="range"
                    min={currentModality.minMonths}
                    max={currentModality.maxMonths}
                    step={1}
                    value={months}
                    onChange={(e) => setMonths(Number(e.target.value))}
                    className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                  />

                  <div className="flex items-center justify-between text-xs text-slate-400 mt-2 font-mono tabular-nums">
                    <span>
                      {currentModality.minMonths} {currentModality.id === 'fgts' ? 'ano' : 'meses'}
                    </span>
                    <span>
                      {currentModality.maxMonths} {currentModality.id === 'fgts' ? 'anos' : 'meses'}
                    </span>
                  </div>

                  {/* Months Preset Chips */}
                  <div className="flex items-center gap-1.5 mt-3 overflow-x-auto pb-1">
                    <span className="text-xs text-slate-500 font-medium mr-1 shrink-0">Prazos:</span>
                    {monthsPresets.map((preset) => (
                      <button
                        key={preset}
                        onClick={() => setMonths(preset)}
                        className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors shrink-0 ${
                          months === preset
                            ? 'bg-emerald-100 text-emerald-900 font-semibold'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        {preset} {currentModality.id === 'fgts' ? 'anos' : 'x'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Modality Perks list */}
              <div className="pt-6 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
                {currentModality.features.map((feature, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Output & Proposal Call To Action */}
            <div className="lg:col-span-5 p-6 sm:p-8 lg:p-10 bg-slate-900 text-white flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs text-slate-400 pb-3 border-b border-slate-800">
                  <span>Estimativa da Simulação</span>
                  <span className="font-mono text-emerald-400">Pix em {currentModality.pixReleaseTime}</span>
                </div>

                {/* Primary installment display */}
                <div className="my-6">
                  <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
                    {currentModality.id === 'fgts' ? 'Desconto anual no FGTS estimado' : 'Parcela mensal estimada'}
                  </div>
                  <div className="text-3xl sm:text-4xl font-black text-white font-mono tabular-nums tracking-tight">
                    {formatBRL(simulation.monthlyPayment)}
                    <span className="text-sm font-normal text-slate-400">
                      {currentModality.id === 'fgts' ? ' /ano' : ' /mês'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Em {months}x de {formatBRL(simulation.monthlyPayment)}
                  </p>
                </div>

                {/* Financial breakdown details */}
                <div className="space-y-3 py-4 border-t border-slate-800 text-xs">
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Taxa de juros mensal</span>
                    <span className="font-mono font-bold text-white tabular-nums">
                      a partir de {formatPercent(currentModality.monthlyInterestRate)} a.m.
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Custo Efetivo Total (CET anual)</span>
                    <span className="font-mono font-medium text-slate-200 tabular-nums">
                      {formatPercent(currentModality.annualCet)} a.a.
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Total a pagar estimado</span>
                    <span className="font-mono font-medium text-slate-200 tabular-nums">
                      {formatBRL(simulation.totalPayment)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span>IOF estimado incluso</span>
                    <span className="font-mono text-slate-400 tabular-nums">
                      {formatBRL(simulation.estimatedIof)}
                    </span>
                  </div>
                </div>

                {/* Savings Callout Box */}
                {simulation.estimatedSavings > 0 && (
                  <div className="mt-4 p-3 rounded-xl bg-emerald-950/60 border border-emerald-700/40 text-xs text-emerald-200">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-400 mb-1">
                      <TrendingDown className="w-3.5 h-3.5" />
                      <span>Economia inteligente</span>
                    </div>
                    Economize até{' '}
                    <strong className="text-white font-mono font-bold">
                      {formatBRL(simulation.estimatedSavings, false)}
                    </strong>{' '}
                    em comparação com juros de cartão de crédito rotativo ou cheque especial.
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="mt-8 pt-4 border-t border-slate-800">
                <button
                  onClick={() => onStartProposal(currentModality, simulation)}
                  className="w-full py-4 px-6 text-sm font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 active:scale-[0.98] rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <span>Solicitar Proposta Gratuita</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 mt-2.5">
                  <Info className="w-3 h-3 text-slate-500" />
                  <span>Não pedimos dinheiro adiantado e a análise é rápida.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
