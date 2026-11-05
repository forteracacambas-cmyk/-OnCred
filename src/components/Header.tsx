import React from 'react';
import { ShieldCheck, Phone } from 'lucide-react';
import { INSTITUTIONAL_DATA, DISPLAY_PHONE_NUMBER } from '../config/creditConfig';

interface HeaderProps {
  onScrollToSimulator: () => void;
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onScrollToSimulator }) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur-md border-b border-slate-800/80 text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between gap-6">
        {/* Zone 1: Brand Wordmark */}
        <a
          href="#topo"
          className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 group"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-sm shadow-emerald-900/30 border border-emerald-400/30">
            <ShieldCheck className="w-5 h-5 text-emerald-100" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold tracking-tight text-white text-lg leading-tight">
              On<span className="text-emerald-400">Cred</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono tracking-wider uppercase leading-none">
              SCD S.A.
            </span>
          </div>
        </a>

        {/* Zone 2: Navigation Links (single-line, clean) */}
        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-300">
          <a
            href="#simulador"
            className="hover:text-emerald-400 transition-colors whitespace-nowrap shrink-0"
          >
            Simulador
          </a>
          <a
            href="#como-funciona"
            className="hover:text-emerald-400 transition-colors whitespace-nowrap shrink-0"
          >
            Como Funciona
          </a>
          <a
            href="#condicoes"
            className="hover:text-emerald-400 transition-colors whitespace-nowrap shrink-0"
          >
            Condições & Taxas
          </a>
          <a
            href="#sobre"
            className="hover:text-emerald-400 transition-colors whitespace-nowrap shrink-0"
          >
            Sobre a OnCred
          </a>
          <a
            href="#duvidas"
            className="hover:text-emerald-400 transition-colors whitespace-nowrap shrink-0"
          >
            Dúvidas
          </a>
        </nav>

        {/* Zone 3: Direct Phone */}
        <div className="flex items-center gap-3 shrink-0">
          <a
            href={`tel:${DISPLAY_PHONE_NUMBER.replace(/\D/g, '')}`}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-mono font-semibold text-slate-200 bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-xl hover:text-emerald-400 transition-all shadow-sm"
            title="Ligar para a central"
          >
            <Phone className="w-3.5 h-3.5 text-emerald-400" />
            <span>{DISPLAY_PHONE_NUMBER}</span>
          </a>
        </div>
      </div>
    </header>
  );
};
