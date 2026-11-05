import React from 'react';
import { ArrowRight, ShieldCheck, CheckCircle2, Clock, Zap } from 'lucide-react';
import heroImage from '../assets/images/hero_fintech_credit_1793859864362.jpg';

interface HeroProps {
  onStartSimulation: () => void;
  onExploreModalities: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onStartSimulation, onExploreModalities }) => {
  return (
    <section className="relative overflow-hidden bg-slate-900 text-white pt-12 pb-16 lg:pt-16 lg:pb-24">
      {/* Background glow subtleties */}
      <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:24px_24px]" />
      <div className="absolute top-1/4 -right-48 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column: Proposition and Action */}
          <div className="lg:col-span-7 flex flex-col justify-center">
            {/* Quiet text kicker with typographic separator */}
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-4">
              <span>Crédito Digital e Transparente</span>
              <span aria-hidden="true">·</span>
              <span>Regulado pelo Banco Central</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight mb-6" style={{ textWrap: 'balance' }}>
              Crédito consciente com as <span className="text-emerald-400 underline decoration-emerald-500/40 underline-offset-8">melhores taxas</span> do Brasil.
            </h1>

            <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl mb-8">
              Simule gratuitamente em menos de 1 minuto, compare ofertas reais de grandes bancos parceiros e receba o valor direto na sua conta via Pix em até 24 horas.
            </p>

            {/* CTA block */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-10">
              <button
                onClick={onStartSimulation}
                className="inline-flex items-center justify-center gap-2.5 px-7 py-4 text-sm font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl shadow-lg shadow-emerald-900/30 transition-all active:scale-[0.98] whitespace-nowrap"
              >
                <span>Simular Meu Crédito Agora</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={onExploreModalities}
                className="inline-flex items-center justify-center px-6 py-4 text-sm font-semibold text-slate-200 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-xl border border-slate-700/60 transition-colors whitespace-nowrap"
              >
                Ver Todas as Linhas
              </button>
            </div>

            {/* Quick Guarantees (Clean, unboxed) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-slate-800/80 text-xs text-slate-300">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Sem taxa antecipada</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Pix rápido na conta</span>
              </div>
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Opções para negativados</span>
              </div>
            </div>
          </div>

          {/* Right Column: Hero Visual with Real Proof Card */}
          <div className="lg:col-span-5 relative">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-slate-800 bg-slate-800">
              <img
                src={heroImage}
                alt="Profissionais brasileiros conferindo proposta de crédito aprovada em tablet"
                className="w-full h-80 sm:h-96 lg:h-[420px] object-cover"
                loading="eager"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent" />

              {/* Floating Verified Trust Overlay Card */}
              <div className="absolute bottom-4 left-4 right-4 p-4 rounded-xl bg-slate-900/95 backdrop-blur-md border border-slate-700/60">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-xs font-semibold text-emerald-400">Atendimento 100% Digital</span>
                  </div>
                  <span className="text-xs font-mono text-slate-400 tabular-nums">Taxas a partir de 0,99% a.m.</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs text-slate-300">
                  <span>Valore Intermediações Financeiras</span>
                  <span className="text-slate-400">BACEN Res. 3.954</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Hero Proof Metrics Strip (Claim-to-Proof Adjacency) */}
        <div className="mt-14 pt-8 border-t border-slate-800/80 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono tabular-nums tracking-tight">
              +R$ 180M
            </div>
            <div className="text-xs sm:text-sm text-slate-400 mt-1">Crédito intermediado</div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono tabular-nums tracking-tight">
              38.500+
            </div>
            <div className="text-xs sm:text-sm text-slate-400 mt-1">Clientes satisfeitos</div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono tabular-nums tracking-tight">
              10 min
            </div>
            <div className="text-xs sm:text-sm text-slate-400 mt-1">Liberação via Pix no FGTS</div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono tabular-nums tracking-tight">
              4.9 / 5.0
            </div>
            <div className="text-xs sm:text-sm text-slate-400 mt-1">Avaliação dos usuários</div>
          </div>
        </div>
      </div>
    </section>
  );
};
