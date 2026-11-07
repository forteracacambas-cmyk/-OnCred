import React, { useEffect } from 'react';
import {
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  Clock,
  Sparkles,
  Zap,
} from 'lucide-react';
import { trackEvent } from '../utils/tracking';
import { initVisitor } from '../utils/atendimento';

interface SimulatorHeroProps {
  onOpenPrivacy: () => void;
  onOpenConfig?: () => void;
  fixedAgent?: string;
}

export const SimulatorHero: React.FC<SimulatorHeroProps> = ({ fixedAgent }) => {
  useEffect(() => {
    initVisitor().catch(() => {});
    trackEvent('page_view');
  }, []);

  const handleStartFunnel = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    trackEvent('simulation_started', {
      source: 'hero_cta',
      fixedAgent,
    });
    const next = new URL('/simulacao', window.location.origin);
    const current = new URL(window.location.href);
    if (fixedAgent && !/^[0-9a-f-]{36}$/i.test(fixedAgent)) {
      next.searchParams.set('atendente', fixedAgent);
    }
    for (const key of ['ttclid', 'tt_test_id', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_id', 'utm_content', 'utm_term']) {
      const val = current.searchParams.get(key);
      if (val) next.searchParams.set(key, val);
    }
    window.location.assign(next.pathname + next.search);
  };

  const simulationUrl = fixedAgent && !/^[0-9a-f-]{36}$/i.test(fixedAgent)
    ? `/simulacao?atendente=${encodeURIComponent(fixedAgent)}`
    : '/simulacao';

  return (
    <section id="simulador" className="relative pt-6 pb-12 sm:pt-14 sm:pb-20 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white overflow-hidden min-h-[500px] flex items-center">
      {/* Background glow subtleties */}
      <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />
      <div className="absolute top-1/4 -right-48 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-3xl mx-auto px-3.5 sm:px-6 w-full">
        <div className="text-center max-w-2xl mx-auto animate-in fade-in duration-300 py-4 sm:py-8">
          {/* Trust badge */}
          <div className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-center shadow-sm mb-4 sm:mb-6">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-[11px] sm:text-xs text-emerald-200 font-medium">
              ZM Sociedade de Crédito Direto • Regulada pelo Banco Central • 18+
            </span>
          </div>

          {/* Headline com tipografia balanceada */}
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-4 sm:mb-6 leading-tight" style={{ textWrap: 'balance' }}>
            Crédito inteligente para seus planos com <span className="text-emerald-400 underline decoration-emerald-500/30 underline-offset-8">aprovação ágil</span>
          </h1>

          <p className="text-xs sm:text-base text-slate-300 leading-relaxed max-w-xl mx-auto mb-6 sm:mb-8">
            Faça sua simulação 100% online em poucos passos na nossa plataforma exclusiva, descubra a parcela ideal para o seu bolso e seja atendido com rapidez e segurança.
          </p>

          {/* BOTÃO PRINCIPAL DE INICIAR SIMULAÇÃO ISOLADA */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8 sm:mb-10">
            <a
              href={simulationUrl}
              onClick={handleStartFunnel}
              className="w-full sm:w-auto px-8 py-4 rounded-xl sm:rounded-2xl font-extrabold text-sm sm:text-base bg-emerald-400 hover:bg-emerald-300 active:bg-emerald-500 text-slate-950 transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-xl shadow-emerald-950/60 hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap shrink-0 group"
            >
              <span>Iniciar Simulação Gratuita</span>
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 group-hover:translate-x-1 transition-transform" />
            </a>
          </div>

          {/* Benefícios rápidos em destaque */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4 pt-6 sm:pt-8 border-t border-slate-800/80 text-xs sm:text-sm text-slate-300">
            <div className="flex items-center justify-center gap-2 p-2.5 sm:p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Sem cobrança antecipada</span>
            </div>
            <div className="flex items-center justify-center gap-2 p-2.5 sm:p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Atendimento humanizado</span>
            </div>
            <div className="flex items-center justify-center gap-2 p-2.5 sm:p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Taxa ref. a partir de 1,35% a.m.</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
