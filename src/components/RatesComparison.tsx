import React, { useState } from 'react';
import { formatBRL, calculatePMT } from '../utils/formatters';
import { TrendingDown, ShieldAlert, CheckCircle2, ArrowRight } from 'lucide-react';

interface RatesComparisonProps {
  onOpenSimulator: () => void;
}

export const RatesComparison: React.FC<RatesComparisonProps> = ({ onOpenSimulator }) => {
  const [debtAmount, setDebtAmount] = useState<number>(6000);

  // Credit card cost over 12 months at 14.2% a.m.
  const ccMonthly = calculatePMT(debtAmount, 14.2, 12);
  const ccTotal = ccMonthly * 12;

  // ValoreCrédito Consignado/FGTS cost over 12 months at 1.39% a.m.
  const valoreMonthly = calculatePMT(debtAmount, 1.39, 12);
  const valoreTotal = valoreMonthly * 12;

  const totalSaved = Math.max(0, ccTotal - valoreTotal);

  return (
    <section id="comparativo" className="py-20 bg-slate-50 border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center mb-14">
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-800 mb-2">
            Transparência Financeira
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight" style={{ textWrap: 'balance' }}>
            Por que trocar dívidas caras por crédito consciente?
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600">
            O rotativo do cartão e o cheque especial corroem o orçamento das famílias brasileiras. Veja a diferença real nas taxas praticadas no mercado:
          </p>
        </div>

        {/* Market Benchmark Table */}
        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-12">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-4 px-6">Tipo de Crédito</th>
                  <th className="py-4 px-6">Taxa Média Mensal</th>
                  <th className="py-4 px-6">Taxa Média Anual</th>
                  <th className="py-4 px-6 text-right">Impacto no Bolso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                <tr className="bg-red-50/40">
                  <td className="py-4 px-6 font-semibold text-slate-900">
                    Rotativo do Cartão de Crédito
                  </td>
                  <td className="py-4 px-6 font-mono font-bold text-red-600">~14,2% ao mês</td>
                  <td className="py-4 px-6 font-mono text-red-600">~420% ao ano</td>
                  <td className="py-4 px-6 text-right font-medium text-red-700">Crítico / Juros compostos</td>
                </tr>
                <tr className="bg-amber-50/30">
                  <td className="py-4 px-6 font-semibold text-slate-900">
                    Cheque Especial Bancário
                  </td>
                  <td className="py-4 px-6 font-mono font-bold text-amber-700">~7,9% ao mês</td>
                  <td className="py-4 px-6 font-mono text-amber-700">~150% ao ano</td>
                  <td className="py-4 px-6 text-right font-medium text-amber-700">Altíssimo risco</td>
                </tr>
                <tr>
                  <td className="py-4 px-6 font-semibold text-slate-900">
                    Empréstimo Pessoal Tradicional (Bancões)
                  </td>
                  <td className="py-4 px-6 font-mono font-bold text-slate-700">~4,8% ao mês</td>
                  <td className="py-4 px-6 font-mono text-slate-600">~75% ao ano</td>
                  <td className="py-4 px-6 text-right font-medium text-slate-500">Moderado</td>
                </tr>
                <tr className="bg-emerald-50/60 font-semibold border-t-2 border-emerald-500">
                  <td className="py-4 px-6 text-emerald-950 font-bold flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-600" />
                    ValoreCrédito (FGTS & Consignado)
                  </td>
                  <td className="py-4 px-6 font-mono font-black text-emerald-700 text-base">
                    a partir de 1,29% a.m.
                  </td>
                  <td className="py-4 px-6 font-mono font-bold text-emerald-700">
                    a partir de 17,6% a.a.
                  </td>
                  <td className="py-4 px-6 text-right font-bold text-emerald-800">
                    Economia Máxima Garantida
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Interactive Debt Replacement Calculator */}
        <div className="max-w-4xl mx-auto bg-slate-900 text-white rounded-2xl p-6 sm:p-8 lg:p-10 border border-slate-800 shadow-xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7">
              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-emerald-400 font-semibold mb-2">
                <TrendingDown className="w-4 h-4" />
                <span>Simulador de Troca de Dívida Cara</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-white mb-3">
                Quanto você deve hoje no cartão ou cheque especial?
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-6">
                Troque várias contas atrasadas por um único empréstimo com juros até 10 vezes menores e recupere a paz.
              </p>

              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400">Saldo devedor total:</span>
                  <span className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
                    {formatBRL(debtAmount, false)}
                  </span>
                </div>
                <input
                  type="range"
                  min={1000}
                  max={30000}
                  step={500}
                  value={debtAmount}
                  onChange={(e) => setDebtAmount(Number(e.target.value))}
                  className="w-full h-2.5 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="flex gap-2">
                {[3000, 6000, 10000, 15000].map((v) => (
                  <button
                    key={v}
                    onClick={() => setDebtAmount(v)}
                    className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                      debtAmount === v ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {formatBRL(v, false)}
                  </button>
                ))}
              </div>
            </div>

            {/* Savings Result Card */}
            <div className="lg:col-span-5 bg-slate-800/90 rounded-xl p-6 border border-slate-700">
              <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">
                Sua Economia Estimada em 12 Meses
              </div>
              <div className="text-3xl font-black text-emerald-400 font-mono tabular-nums tracking-tight mb-4">
                {formatBRL(totalSaved, false)}
              </div>

              <div className="space-y-2 text-xs border-t border-slate-700 pt-3 text-slate-300">
                <div className="flex justify-between">
                  <span>Custo no Rotativo (12x):</span>
                  <span className="font-mono text-red-400">{formatBRL(ccTotal, false)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Custo na ValoreCrédito (12x):</span>
                  <span className="font-mono text-emerald-400">{formatBRL(valoreTotal, false)}</span>
                </div>
              </div>

              <button
                onClick={onOpenSimulator}
                className="w-full mt-6 py-3 px-4 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-all flex items-center justify-center gap-2"
              >
                <span>Quitar Dívidas Agora</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
