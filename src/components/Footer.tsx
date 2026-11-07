import React from 'react';
import { INSTITUTIONAL_DATA as company, DISPLAY_PHONE_NUMBER, DEFAULT_CONTACT_EMAIL } from '../config/creditConfig';
import { ShieldCheck, Phone, Mail, Globe, Lock } from 'lucide-react';

interface Props {
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
  onOpenConfig?: () => void;
}

export function Footer({ onOpenPrivacy, onOpenTerms }: Props) {
  return (
    <footer className="bg-slate-950 text-slate-400 text-xs border-t border-slate-800">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          {/* Col 1: Brand & Bio */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-extrabold text-base">
                Z
              </div>
              <span className="text-xl font-extrabold tracking-tight text-white">
                ZM <span className="text-emerald-400">SCD</span> <span className="text-xs text-slate-400 font-mono font-medium">S.A.</span>
              </span>
            </div>
            <p className="text-slate-300 text-xs leading-relaxed max-w-md">
              {company.legalName} • CNPJ: {company.cnpj}
            </p>
            <p className="text-slate-400 text-xs leading-relaxed max-w-md">
              {company.address}
            </p>
            <div className="flex items-center gap-2 text-emerald-400 text-xs pt-2">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Instituição autorizada pelo Banco Central do Brasil</span>
            </div>
          </div>

          {/* Col 2: Informações e Legal */}
          <div>
            <h3 className="font-bold text-white text-xs uppercase tracking-wider mb-3.5">
              Documentos Legais
            </h3>
            <ul className="space-y-2.5">
              <li>
                <button
                  onClick={onOpenPrivacy}
                  className="hover:text-emerald-400 transition-colors text-left"
                >
                  Política de Privacidade
                </button>
              </li>
              <li>
                <button
                  onClick={onOpenTerms}
                  className="hover:text-emerald-400 transition-colors text-left"
                >
                  Termos de Uso
                </button>
              </li>
              <li>
                <a
                  href="/politica-de-privacidade.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-emerald-400 transition-colors block"
                >
                  Privacidade (Página Externa)
                </a>
              </li>
              <li>
                <a
                  href="/termos-de-uso.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-emerald-400 transition-colors block"
                >
                  Termos (Página Externa)
                </a>
              </li>
            </ul>
          </div>

          {/* Col 3: Contato Oficial */}
          <div>
            <h3 className="font-bold text-white text-xs uppercase tracking-wider mb-3.5">
              Contato Oficial
            </h3>
            <div className="space-y-2.5">
              <a
                href={`tel:${DISPLAY_PHONE_NUMBER.replace(/\D/g, '')}`}
                className="flex items-center gap-2 hover:text-emerald-400 transition-colors"
              >
                <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="font-mono">{DISPLAY_PHONE_NUMBER}</span>
              </a>
              <a
                href={`mailto:${DEFAULT_CONTACT_EMAIL}`}
                className="flex items-center gap-2 hover:text-emerald-400 transition-colors"
              >
                <Mail className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="font-mono">{DEFAULT_CONTACT_EMAIL}</span>
              </a>
              <a
                href={company.siteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:text-emerald-400 transition-colors"
              >
                <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="font-mono text-emerald-400">{company.domain}</span>
              </a>
            </div>
            <p className="text-[11px] text-slate-400 mt-4 leading-relaxed">
              Atendimento exclusivo para simulação e triagem inicial via canal digital.
            </p>
          </div>
        </div>

        {/* Regulatory Disclaimers */}
        <div className="border-t border-slate-900 pt-8 space-y-3 text-[11px] leading-relaxed text-slate-400">
          <p>
            Esta página realiza simulação informativa e encaminhamento de interesse. A aprovação, disponibilidade e contratação dependem de análise e apresentação prévia das condições pela instituição responsável. Serviço destinado exclusivamente a maiores de 18 anos.
          </p>
          <div className="p-3 bg-amber-950/20 border border-amber-500/20 rounded-xl text-amber-200/90 flex items-start gap-2">
            <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              <strong>Alerta Antifraude:</strong> Não solicitamos depósitos, pagamentos antecipados, taxas de avalista ou contratação de seguros para aprovação ou liberação de crédito. Cobrança prévia é crime. Não forneça senhas bancárias nem códigos durante o atendimento.
            </span>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-slate-900/60 text-slate-400 text-[11px] gap-2">
            <span>© {new Date().getFullYear()} {company.legalName}. Todos os direitos reservados.</span>
            <span>Domínio oficial: {company.domain}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
