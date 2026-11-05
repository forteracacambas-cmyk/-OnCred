import React from 'react';
import { INSTITUTIONAL_DATA as company } from '../config/creditConfig';
import { Building2, ShieldCheck, Phone, Mail, Globe, MapPin } from 'lucide-react';

export function AboutSants() {
  return (
    <section id="sobre" className="py-20 bg-slate-900/40 border-b border-slate-800 text-slate-200">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">
            Identificação Institucional
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-2 tracking-tight">
            Sobre a OnCred SCD S.A.
          </h2>
          <p className="mt-3 text-sm text-slate-400">
            {company.regulatoryStatement}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card Institucional Principal */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 sm:p-7 shadow-lg flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">{company.legalName}</h3>
                  <p className="text-xs text-slate-400 font-mono">CNPJ: {company.cnpj}</p>
                </div>
              </div>
              <div className="space-y-3 text-xs text-slate-300 mt-4 pt-4 border-t border-slate-800">
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{company.address}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Sociedade de Crédito Direto autorizada e regulamentada pelo Banco Central do Brasil</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
              <span>Sede: {company.city}</span>
              <span className="text-emerald-400">Ativa</span>
            </div>
          </div>

          {/* Card Canais de Contato */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 sm:p-7 shadow-lg flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-white text-base mb-4">Canais de Atendimento Oficial</h3>
              <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                Nossa equipe presta suporte transparente e sem taxas prévias. Utilize nossos canais verificados:
              </p>

              <div className="space-y-3 text-xs">
                <a
                  href={`tel:${(company.phone || '+551130420181').replace(/\D/g, '')}`}
                  className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-slate-200 hover:text-white hover:border-emerald-500/50 transition-colors"
                >
                  <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <span className="text-[11px] text-slate-400 block">Central Telefônica:</span>
                    <strong className="font-mono text-sm">{company.phone}</strong>
                  </div>
                </a>

                <a
                  href={`mailto:${company.email}`}
                  className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-slate-200 hover:text-white hover:border-emerald-500/50 transition-colors"
                >
                  <Mail className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <span className="text-[11px] text-slate-400 block">E-mail Oficial:</span>
                    <strong className="font-mono">{company.email}</strong>
                  </div>
                </a>

                <a
                  href={company.siteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-slate-200 hover:text-white hover:border-emerald-500/50 transition-colors"
                >
                  <Globe className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <span className="text-[11px] text-slate-400 block">Domínio Oficial:</span>
                    <strong className="font-mono text-emerald-400">{company.domain}</strong>
                  </div>
                </a>
              </div>
            </div>

            <div className="mt-6 pt-3 text-[11px] text-slate-400 text-center">
              Atendimento de segunda a sexta, das 09h às 18h
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
