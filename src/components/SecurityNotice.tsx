import React from 'react';
import { ShieldAlert, Lock, CheckCircle2, FileCheck } from 'lucide-react';

export const SecurityNotice: React.FC = () => {
  return (
    <section className="py-12 bg-amber-500/10 border-b border-amber-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-6 sm:p-8 bg-white rounded-2xl border-2 border-amber-400 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-800 mb-1">
                <span>Alerta Importante de Segurança & Combate a Golpes</span>
              </div>
              <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 mb-2">
                NUNCA cobramos nenhum valor ou taxa antecipada para liberar empréstimos!
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Cobrança de taxa de cartório, seguro de liberação, avalista ou adiantamento para liberação de crédito é <strong>crime de estelionato</strong> (Art. 171 do Código Penal). A ValoreCrédito é remunerada diretamente pelas instituições financeiras parceiras credenciadas pelo Banco Central do Brasil.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-100 text-xs text-slate-700">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Criptografia bancária SSL 256 bits</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Correspondente Bancário BACEN 3.954</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Privacidade e sigilo protegidos pela LGPD</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
