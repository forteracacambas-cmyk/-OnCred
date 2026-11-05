import React from 'react';
import { ShieldCheck } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-950 text-slate-400 text-xs border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 mb-12">
          {/* Col 1: Brand & Bio */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 text-xl font-extrabold text-white mb-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-700 flex items-center justify-center text-white text-base font-black">
                V
              </div>
              <span>
                Valore<span className="text-emerald-500">Crédito</span>
              </span>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed max-w-sm mb-4">
              Plataforma digital de intermediação de crédito e soluções financeiras. Conectamos você às menores taxas do mercado com segurança, transparência e sem burocracia.
            </p>
            <div className="flex items-center gap-2 text-slate-300 text-[11px]">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Correspondente Bancário Autorizado nos termos da Res. BACEN nº 3.954.</span>
            </div>
          </div>

          {/* Col 2: Modalidades */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Linhas de Crédito</h4>
            <ul className="space-y-2">
              <li>
                <a href="#simulador" className="hover:text-emerald-400 transition-colors">
                  Antecipação Saque FGTS
                </a>
              </li>
              <li>
                <a href="#simulador" className="hover:text-emerald-400 transition-colors">
                  Empréstimo Consignado INSS
                </a>
              </li>
              <li>
                <a href="#simulador" className="hover:text-emerald-400 transition-colors">
                  Consignado Servidor Público
                </a>
              </li>
              <li>
                <a href="#simulador" className="hover:text-emerald-400 transition-colors">
                  Empréstimo com Garantia de Veículo
                </a>
              </li>
              <li>
                <a href="#simulador" className="hover:text-emerald-400 transition-colors">
                  Capital de Giro para Empresas PJ
                </a>
              </li>
            </ul>
          </div>

          {/* Col 3: Institucional */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Institucional</h4>
            <ul className="space-y-2">
              <li>
                <a href="#como-funciona" className="hover:text-emerald-400 transition-colors">
                  Como Funciona
                </a>
              </li>
              <li>
                <a href="#comparativo" className="hover:text-emerald-400 transition-colors">
                  Comparativo de Taxas
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-emerald-400 transition-colors">
                  Perguntas Frequentes
                </a>
              </li>
              <li>
                <a href="#seguranca" className="hover:text-emerald-400 transition-colors">
                  Segurança & Prevenção a Fraudes
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-emerald-400 transition-colors">
                  Termos de Uso e Privacidade (LGPD)
                </a>
              </li>
            </ul>
          </div>

          {/* Col 4: Contato & Canais */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Atendimento</h4>
            <div className="space-y-2 text-slate-300">
              <div>
                <span className="block text-[11px] text-slate-500">Central Gratuita:</span>
                <span className="font-bold text-white">0800 720 4050</span>
              </div>
              <div>
                <span className="block text-[11px] text-slate-500">WhatsApp Oficial:</span>
                <span className="font-bold text-white">(11) 98765-4321</span>
              </div>
              <div>
                <span className="block text-[11px] text-slate-500">E-mail:</span>
                <span>contato@valorecredito.com.br</span>
              </div>
              <div>
                <span className="block text-[11px] text-slate-500">Ouvidoria:</span>
                <span>ouvidoria@valorecredito.com.br</span>
              </div>
            </div>
          </div>
        </div>

        {/* Legal Regulatory Disclosure (Exigido pelo Banco Central do Brasil) */}
        <div className="pt-8 border-t border-slate-900 text-[11px] text-slate-500 leading-relaxed space-y-3">
          <p>
            <strong>Informações Regulatórias e Custo Efetivo Total (CET):</strong> A ValoreCrédito Soluções Financeiras Ltda (CNPJ 38.412.910/0001-44), com sede na Av. Paulista, 1842 - Bela Vista, São Paulo - SP, atua como correspondente bancário nos termos do artigo 2º da Resolução CMN nº 3.954, de 24 de fevereiro de 2011, prestando serviços de intermediação a instituições financeiras devidamente autorizadas pelo Banco Central do Brasil, tais como Banco Pan S.A., Banco Inter S.A., Facta Financeira S.A., BV Financeira S.A. e Banco Santander Brasil S.A.
          </p>
          <p>
            <strong>Exemplo Representativo:</strong> Empréstimo no valor de R$ 10.000,00 em 36 parcelas de R$ 361,50. Custo Efetivo Total (CET) de 1,39% ao mês (17,6% ao ano). Valor total a pagar: R$ 13.014,00. IOF e tarifas inclusas na simulação. As taxas e prazos podem variar de acordo com a política de crédito da instituição financeira parceira e o perfil cadastral do solicitante.
          </p>
          <p>
            <strong>Aviso de Segurança:</strong> Não exigimos pagamentos prévios, depósitos antecipados ou qualquer cobrança de taxas para aprovação ou liberação de crédito. Se você receber qualquer solicitação dessa natureza, encerre o contato imediatamente.
          </p>
        </div>

        {/* Copyright */}
        <div className="mt-8 pt-6 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-4">
          <div>
            © 2026 ValoreCrédito Soluções Financeiras Ltda. Todos os direitos reservados.
          </div>
          <div className="flex items-center gap-4">
            <span>Segurança SSL 256 bits</span>
            <span>·</span>
            <span>LGPD Compliance</span>
            <span>·</span>
            <span>Banco Central do Brasil</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
