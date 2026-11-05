import React from 'react';
import { ShieldCheck, PhoneCall, Menu, X } from 'lucide-react';

interface HeaderProps {
  onOpenSimulator: () => void;
  onOpenSupport: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSimulator, onOpenSupport }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-8 h-20">
          {/* Zone 1: Brand title, one line text wordmark */}
          <a href="#" className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-700 flex items-center justify-center text-white shadow-sm font-black text-xl">
              V
            </div>
            <span>
              Valore<span className="text-emerald-700">Crédito</span>
            </span>
          </a>

          {/* Zone 2: 4–5 nav links, 1–2 word labels, single-line */}
          <nav className="hidden lg:flex items-center gap-8 text-sm font-semibold text-slate-600">
            <a href="#simulador" className="hover:text-emerald-700 transition-colors whitespace-nowrap shrink-0">
              Simulador
            </a>
            <a href="#modalidades" className="hover:text-emerald-700 transition-colors whitespace-nowrap shrink-0">
              Modalidades
            </a>
            <a href="#como-funciona" className="hover:text-emerald-700 transition-colors whitespace-nowrap shrink-0">
              Como Funciona
            </a>
            <a href="#comparativo" className="hover:text-emerald-700 transition-colors whitespace-nowrap shrink-0">
              Economia
            </a>
            <a href="#faq" className="hover:text-emerald-700 transition-colors whitespace-nowrap shrink-0">
              Dúvidas
            </a>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={onOpenSupport}
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0"
              title="Atendimento via WhatsApp ou Telefone"
            >
              <PhoneCall className="w-3.5 h-3.5 text-emerald-700" />
              <span>Atendimento</span>
            </button>
            <button
              onClick={onOpenSimulator}
              className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-sm transition-all whitespace-nowrap shrink-0 active:scale-95"
            >
              Simular Crédito
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900"
              aria-label="Abrir menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <div className="lg:hidden py-4 border-t border-slate-100 bg-white">
            <div className="flex flex-col gap-3 px-2">
              <a
                href="#simulador"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                Simulador de Crédito
              </a>
              <a
                href="#modalidades"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                Linhas de Empréstimo
              </a>
              <a
                href="#como-funciona"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                Passo a Passo
              </a>
              <a
                href="#comparativo"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                Comparativo de Juros
              </a>
              <a
                href="#faq"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                Perguntas Frequentes
              </a>
              <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenSupport();
                  }}
                  className="w-full py-2.5 text-center text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg"
                >
                  Falar com Especialista
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
