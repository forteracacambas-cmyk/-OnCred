import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { INSTITUTIONAL_DATA } from '../config/creditConfig';

interface HeaderProps {
  onScrollToSimulator: () => void;
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onScrollToSimulator }) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark */}
        <a
          href="#topo"
          className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 hover:text-blue-400 transition-colors"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-800 flex items-center justify-center text-white shadow-sm border border-blue-400/30">
            <ShieldCheck className="w-5 h-5 text-blue-200" />
          </div>
          <span className="font-extrabold tracking-tight text-white">On<span className="text-blue-400 font-semibold">Cred</span></span>
        </a>

        {/* Zone 2: Navigation Links (single-line, clean) */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300">
          <a
            href="#simulador"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Simulador
          </a>
          <a
            href="#como-funciona"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Como Funciona
          </a>
          <a
            href="#condicoes"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Condições
          </a>
          <a
            href="#sobre"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Sobre a OnCred
          </a>
          <a
            href="#duvidas"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Dúvidas
          </a>
        </nav>

        {/* Zone 3: Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onScrollToSimulator}
            className="px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-lg transition-all shadow-sm hover:shadow-blue-500/20 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Iniciar Solicitação
          </button>
        </div>
      </div>
    </header>
  );
};
