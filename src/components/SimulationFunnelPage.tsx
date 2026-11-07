import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  User,
  Building2,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Lock,
  MessageCircle,
  HelpCircle,
  Info,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import {
  CREDIT_CONFIG,
  SIMULATOR_CONFIG,
  calculateMonthlyPayment,
  getMaximumAllowedTerm,
  formatCurrencyBRL,
  formatCurrencyExactBRL,
  INSTITUTIONAL_DATA,
} from '../config/creditConfig';
import { goToWhatsApp, initVisitor } from '../utils/atendimento';
import { PrivacyPolicyModal } from './PrivacyPolicyModal';
import { TermsOfUseModal } from './TermsOfUseModal';
import { MeasurementConsent } from './MeasurementConsent';

interface SimulationFunnelPageProps {
  fixedAgent?: string;
}

export default function SimulationFunnelPage({ fixedAgent }: SimulationFunnelPageProps) {
  // Inicializa o passo a partir da URL (?passo=X ou ?etapa=X) se houver
  const getInitialStep = (): 1 | 2 | 3 | 4 => {
    try {
      const params = new URLSearchParams(window.location.search);
      const p = parseInt(params.get('passo') || params.get('etapa') || '1', 10);
      if (p >= 1 && p <= 4) return p as 1 | 2 | 3 | 4;
    } catch {}
    return 1;
  };

  const [step, setStep] = useState<1 | 2 | 3 | 4>(getInitialStep);
  const [profile, setProfile] = useState<'PF' | 'PJ'>('PF');
  const [amount, setAmount] = useState<number>(SIMULATOR_CONFIG.PF.defaultAmount); // R$ 10.000

  const initialMaxTerm = getMaximumAllowedTerm(SIMULATOR_CONFIG.PF.defaultAmount);
  const [term, setTerm] = useState<number>(Math.min(36, initialMaxTerm));

  // Checkbox de aceite da política pré-marcado por padrão conforme solicitado
  const [agreedPrivacy, setAgreedPrivacy] = useState<boolean>(true);
  const [routing, setRouting] = useState(false);
  const routingRef = useRef(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);

  useEffect(() => {
    initVisitor().catch(() => {});
    document.title = "Simulação de Crédito Online | ZM SCD";
  }, []);

  // Sincroniza o número da etapa com a URL para permitir navegação natural (botão voltar do celular)
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('etapa', String(step));
      window.history.replaceState(null, '', url.pathname + url.search);
    } catch {}
  }, [step]);

  // Suporte ao botão voltar do navegador
  useEffect(() => {
    const handlePopState = () => {
      const nextStep = getInitialStep();
      setStep(nextStep);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const currentConfig = SIMULATOR_CONFIG[profile];
  const maxAllowedTerm = getMaximumAllowedTerm(amount);

  // Garante que o prazo selecionado respeite o limite do valor
  useEffect(() => {
    if (term > maxAllowedTerm) {
      setTerm(maxAllowedTerm);
    }
  }, [amount, maxAllowedTerm, term]);

  // Cálculo da parcela estimada via PMT
  const estimatedPayment = calculateMonthlyPayment(amount, term, CREDIT_CONFIG.monthlyInterestFrom);

  const goToStep = (targetStep: 1 | 2 | 3 | 4) => {
    setValidationError(null);
    setStep(targetStep);
  };

  const handleProfileSelect = (newProfile: 'PF' | 'PJ') => {
    setValidationError(null);
    setProfile(newProfile);
    const targetConfig = SIMULATOR_CONFIG[newProfile];
    let newAmount = amount;
    if (newAmount < targetConfig.minAmount) {
      newAmount = targetConfig.minAmount;
    } else if (newAmount > targetConfig.maxAmount) {
      newAmount = targetConfig.maxAmount;
    } else {
      newAmount = Math.round(newAmount / targetConfig.step) * targetConfig.step;
    }
    setAmount(newAmount);
    const newMaxTerm = getMaximumAllowedTerm(newAmount);
    if (term > newMaxTerm) {
      setTerm(newMaxTerm);
    }
    // Avança automaticamente para o passo 2
    goToStep(2);
  };

  const handleAmountChange = (newAmount: number) => {
    setValidationError(null);
    const clamped = Math.max(currentConfig.minAmount, Math.min(newAmount, currentConfig.maxAmount));
    setAmount(clamped);
  };

  const handleTermChange = (newTerm: number) => {
    setValidationError(null);
    const clamped = Math.max(CREDIT_CONFIG.minimumTermMonths, Math.min(newTerm, maxAllowedTerm));
    setTerm(clamped);
  };

  // Envio final para o WhatsApp via Cloudflare D1
  const handleWhatsAppClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (routingRef.current) return;
    setValidationError(null);

    if (!agreedPrivacy) {
      setValidationError('Marque o aceite da Política de Privacidade para prosseguir com o atendimento.');
      return;
    }

    if (!estimatedPayment || estimatedPayment <= 0 || isNaN(estimatedPayment)) {
      setValidationError('Não foi possível calcular a estimativa. Reajuste o valor ou o prazo.');
      return;
    }

    const profileText = profile === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica';
    const formattedAmount = formatCurrencyBRL(amount);
    const formattedPayment = formatCurrencyExactBRL(estimatedPayment);

    const message = `Olá! Vim pelo site da ZM SCD e gostaria de iniciar uma solicitação para análise de crédito.\n\nPerfil: ${profileText}\nValor de interesse: ${formattedAmount}\nPrazo selecionado: ${term} meses\nParcela mensal estimada: ${formattedPayment}\n\nEstou ciente de que esta é uma estimativa inicial e que a solicitação está sujeita à análise cadastral e de crédito.`;

    routingRef.current = true;
    setRouting(true);
    try {
      await goToWhatsApp(message, fixedAgent);
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Não foi possível encaminhar. Tente novamente.');
    } finally {
      routingRef.current = false;
      setRouting(false);
    }
  };

  const returnHomeUrl = fixedAgent && !/^[0-9a-f-]{36}$/i.test(fixedAgent) ? `/${fixedAgent}` : '/';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Top Header Simplificado e Focado no Funil */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 py-3.5 flex items-center justify-between">
        <a
          href={returnHomeUrl}
          className="flex items-center gap-2.5 text-white hover:opacity-90 transition-opacity"
          title="Voltar ao início"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-sm border border-emerald-400/30">
            <ShieldCheck className="w-4 h-4 text-emerald-100" />
          </div>
          <div className="flex flex-col">
            <span className="font-black text-sm tracking-tight text-white leading-tight">
              ZM <span className="text-emerald-400">SCD</span>
            </span>
            <span className="text-[9px] text-slate-400 font-mono tracking-wider uppercase leading-none">
              Simulador Oficial
            </span>
          </div>
        </a>

        <div className="flex items-center gap-3">
          <div className="hidden xs:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/50 border border-emerald-500/20 text-emerald-300 text-[11px] font-medium">
            <Lock className="w-3 h-3 text-emerald-400" />
            <span>Ambiente Seguro 256-bit</span>
          </div>
          <a
            href={returnHomeUrl}
            className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            Sair
          </a>
        </div>
      </header>

      {/* Conteúdo Principal do Funil Isolado */}
      <main className="flex-1 flex flex-col justify-center items-center px-3.5 sm:px-6 py-4 sm:py-8 w-full max-w-xl mx-auto">
        {/* Barra de Progresso Superior */}
        <div className="w-full mb-4 sm:mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-bold font-mono">
                Etapa {step} de 4
              </span>
              <span className="text-xs sm:text-sm font-semibold text-white">
                {step === 1 && 'Escolha do Perfil'}
                {step === 2 && 'Valor do Crédito'}
                {step === 3 && 'Quantidade de Parcelas'}
                {step === 4 && 'Resumo & Solicitação'}
              </span>
            </div>
            <span className="text-xs font-mono text-slate-400 font-medium">
              {step === 1 && '25%'}
              {step === 2 && '50%'}
              {step === 3 && '75%'}
              {step === 4 && '100%'}
            </span>
          </div>

          <div className="w-full h-2 bg-slate-900 border border-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300 ease-out rounded-full shadow-sm shadow-emerald-500/50"
              style={{ width: `${(step / 4) * 100}%` }}
            />
          </div>
        </div>

        {/* Card Interativo Principal */}
        <div className="w-full bg-slate-900/90 border border-slate-800/90 rounded-2xl sm:rounded-3xl p-4 sm:p-7 shadow-2xl backdrop-blur-md relative overflow-hidden">
          {/* Sombra de destaque sutil no card */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

          {/* =============================================================== */}
          {/* PASSO 1: ESCOLHA DO PERFIL (PF / PJ)                             */}
          {/* =============================================================== */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="text-center mb-4">
                <h1 className="text-lg sm:text-2xl font-extrabold text-white mb-1 tracking-tight">
                  Para quem você deseja solicitar crédito?
                </h1>
                <p className="text-xs sm:text-sm text-slate-400">
                  Selecione uma das opções abaixo para personalizar sua proposta:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {/* Opção Pessoa Física */}
                <button
                  type="button"
                  onClick={() => handleProfileSelect('PF')}
                  className={`p-4 sm:p-5 rounded-2xl border-2 text-left transition-all duration-150 cursor-pointer flex flex-col justify-between group active:scale-[0.98] ${
                    profile === 'PF'
                      ? 'bg-emerald-950/40 border-emerald-500 shadow-lg shadow-emerald-950/40 ring-1 ring-emerald-500/40'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                        <User className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                        Até R$ 50 mil
                      </span>
                    </div>
                    <h2 className="text-base font-bold text-white leading-tight">Pessoa Física</h2>
                    <p className="text-xs text-slate-400 leading-relaxed mt-1">
                      Assalariados, servidores públicos, aposentados, autônomos e profissionais liberais.
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs font-semibold text-emerald-400">
                    <span>Selecionar e avançar</span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>

                {/* Opção Pessoa Jurídica */}
                <button
                  type="button"
                  onClick={() => handleProfileSelect('PJ')}
                  className={`p-4 sm:p-5 rounded-2xl border-2 text-left transition-all duration-150 cursor-pointer flex flex-col justify-between group active:scale-[0.98] ${
                    profile === 'PJ'
                      ? 'bg-emerald-950/40 border-emerald-500 shadow-lg shadow-emerald-950/40 ring-1 ring-emerald-500/40'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 group-hover:scale-105 transition-transform">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/20">
                        Até R$ 100 mil
                      </span>
                    </div>
                    <h2 className="text-base font-bold text-white leading-tight">Pessoa Jurídica</h2>
                    <p className="text-xs text-slate-400 leading-relaxed mt-1">
                      Para MEI, micro, pequenas e médias empresas que precisam de capital de giro.
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs font-semibold text-teal-400">
                    <span>Selecionar e avançar</span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              </div>

              {/* Botão de continuação explícito para maior clareza */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => goToStep(2)}
                  className="w-full py-3.5 rounded-xl font-bold text-sm bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer"
                >
                  <span>Continuar com {profile === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* PASSO 2: VALOR PRETENDIDO                                       */}
          {/* =============================================================== */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="text-center mb-3">
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                  {profile === 'PF' ? 'Crédito Pessoa Física' : 'Crédito Pessoa Jurídica'}
                </span>
                <h1 className="text-lg sm:text-2xl font-extrabold text-white mt-0.5 tracking-tight">
                  De quanto você precisa?
                </h1>
                <p className="text-xs text-slate-400">
                  Toque nos valores sugeridos ou ajuste o controle deslizante:
                </p>
              </div>

              {/* Display do Valor em destaque */}
              <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-4 text-center">
                <span className="text-xs text-slate-400 font-medium">Valor Selecionado</span>
                <div className="text-2xl sm:text-4xl font-black text-emerald-400 tracking-tight mt-1">
                  {formatCurrencyBRL(amount)}
                </div>
                <div className="flex justify-between items-center text-[10px] sm:text-xs text-slate-400 mt-2 font-mono">
                  <span>Mín: {formatCurrencyBRL(currentConfig.minAmount)}</span>
                  <span>Máx: {formatCurrencyBRL(currentConfig.maxAmount)}</span>
                </div>
              </div>

              {/* Slider de Valor */}
              <div className="px-1 py-2">
                <input
                  type="range"
                  min={currentConfig.minAmount}
                  max={currentConfig.maxAmount}
                  step={currentConfig.step}
                  value={amount}
                  onChange={(e) => handleAmountChange(Number(e.target.value))}
                  aria-label="Valor de interesse para crédito"
                  className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400 focus:outline-none"
                />
              </div>

              {/* Chips de valores sugeridos */}
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                  Atalhos de valores rápidos:
                </span>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 sm:gap-2">
                  {currentConfig.presetSteps.map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleAmountChange(val)}
                      className={`py-2 px-1 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                        amount === val
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md font-extrabold'
                          : 'bg-slate-950/60 text-slate-300 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50'
                      }`}
                    >
                      {formatCurrencyBRL(val)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ações de navegação do Passo 2 */}
              <div className="flex items-center gap-2.5 pt-3 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => goToStep(1)}
                  className="px-4 py-3 rounded-xl border border-slate-700 bg-slate-800/50 hover:bg-slate-800 text-slate-300 font-semibold text-xs sm:text-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar</span>
                </button>
                <button
                  type="button"
                  onClick={() => goToStep(3)}
                  className="flex-1 py-3 sm:py-3.5 rounded-xl font-bold text-xs sm:text-sm bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer"
                >
                  <span>Avançar para as parcelas</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* PASSO 3: QUANTIDADE DE PARCELAS                                 */}
          {/* =============================================================== */}
          {step === 3 && (
            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="text-center mb-3">
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                  Valor: {formatCurrencyBRL(amount)}
                </span>
                <h1 className="text-lg sm:text-2xl font-extrabold text-white mt-0.5 tracking-tight">
                  Em quantas vezes prefere pagar?
                </h1>
                <p className="text-xs text-slate-400">
                  Escolha o prazo ideal para o seu orçamento:
                </p>
              </div>

              {/* Card de Prazo & Estimativa de Parcela */}
              <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-4 text-center">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/80">
                  <div className="text-left">
                    <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">Prazo Escolhido</span>
                    <span className="text-xl sm:text-2xl font-black text-white">{term} meses</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">Taxa de Referência</span>
                    <span className="text-xs sm:text-sm font-bold text-emerald-400">a partir de 1,35% a.m.</span>
                  </div>
                </div>

                <span className="text-xs text-slate-300 font-medium">Estimativa da Parcela Mensal</span>
                <div className="text-2xl sm:text-4xl font-black text-emerald-400 tracking-tight mt-0.5">
                  {formatCurrencyExactBRL(estimatedPayment)}
                  <span className="text-xs sm:text-sm text-slate-400 font-normal ml-1">/mês</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5">
                  Cálculo simulado via tabela Price. Sujeito à análise cadastral e de crédito.
                </p>
              </div>

              {/* Slider de Prazo */}
              <div className="px-1 py-1">
                <input
                  type="range"
                  min={CREDIT_CONFIG.minimumTermMonths}
                  max={maxAllowedTerm}
                  step={6}
                  value={term}
                  onChange={(e) => handleTermChange(Number(e.target.value))}
                  aria-label="Prazo em meses para pagamento"
                  className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400 focus:outline-none"
                />
                <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1 font-mono">
                  <span>Mín: {CREDIT_CONFIG.minimumTermMonths} meses</span>
                  <span>Máx: {maxAllowedTerm} meses</span>
                </div>
              </div>

              {/* Chips de Prazos Rápidos */}
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                  Atalhos de prazos:
                </span>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 sm:gap-2">
                  {[12, 24, 36, 48, 60, 72].filter((t) => t <= maxAllowedTerm).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleTermChange(t)}
                      className={`py-2 px-1 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                        term === t
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md font-extrabold'
                          : 'bg-slate-950/60 text-slate-300 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50'
                      }`}
                    >
                      {t}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Ações de navegação do Passo 3 */}
              <div className="flex items-center gap-2.5 pt-3 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => goToStep(2)}
                  className="px-4 py-3 rounded-xl border border-slate-700 bg-slate-800/50 hover:bg-slate-800 text-slate-300 font-semibold text-xs sm:text-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar</span>
                </button>
                <button
                  type="button"
                  onClick={() => goToStep(4)}
                  className="flex-1 py-3 sm:py-3.5 rounded-xl font-bold text-xs sm:text-sm bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer"
                >
                  <span>Ver resumo da simulação</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* PASSO 4: RESUMO & SOLICITAÇÃO VIA WHATSAPP                      */}
          {/* =============================================================== */}
          {step === 4 && (
            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="text-center mb-3">
                <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold mb-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Proposta Inicial Pronta</span>
                </div>
                <h1 className="text-lg sm:text-2xl font-extrabold text-white tracking-tight">
                  Resumo da sua simulação
                </h1>
                <p className="text-xs text-slate-400">
                  Verifique os dados calculados antes de iniciar seu atendimento:
                </p>
              </div>

              {/* Tabela de Resumo Claro */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 divide-y divide-slate-800/80 text-xs sm:text-sm">
                <div className="flex items-center justify-between pb-2.5">
                  <span className="text-slate-400">Perfil Selecionado:</span>
                  <span className="font-bold text-white">{profile === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'}</span>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-slate-400">Valor Pretendido:</span>
                  <span className="font-bold text-emerald-400 text-base">{formatCurrencyBRL(amount)}</span>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-slate-400">Prazo Escolhido:</span>
                  <span className="font-bold text-white">{term} meses</span>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-slate-400">Taxa de Referência:</span>
                  <span className="font-bold text-emerald-400">a partir de 1,35% a.m.</span>
                </div>
                <div className="flex items-center justify-between pt-2.5">
                  <span className="text-slate-300 font-semibold">Parcela Mensal Estimada:</span>
                  <span className="font-black text-emerald-400 text-lg sm:text-xl">
                    {formatCurrencyExactBRL(estimatedPayment)}
                  </span>
                </div>
              </div>

              {/* Mensagem de Transparência e Segurança */}
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 leading-relaxed flex items-start gap-2">
                <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  Esta é uma simulação preliminar informativa. A aprovação e as condições finais dependem da análise cadastral. <strong className="text-slate-200">A ZM SCD não solicita pagamentos ou taxas antecipadas.</strong>
                </span>
              </div>

              {/* Checkbox de Aceite da Política de Privacidade (pré-marcado como padrão conforme regras) */}
              <div className="pt-1">
                <label
                  htmlFor="privacy-consent-funnel"
                  className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    id="privacy-consent-funnel"
                    checked={agreedPrivacy}
                    onChange={(e) => {
                      setAgreedPrivacy(e.target.checked);
                      if (e.target.checked) setValidationError(null);
                    }}
                    className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-400 cursor-pointer accent-emerald-500 shrink-0"
                  />
                  <span className="leading-snug">
                    Declaro que li e concordo com a{' '}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsPrivacyOpen(true);
                      }}
                      className="text-emerald-400 underline hover:text-emerald-300"
                    >
                      Política de Privacidade
                    </button>{' '}
                    e os{' '}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsTermsOpen(true);
                      }}
                      className="text-emerald-400 underline hover:text-emerald-300"
                    >
                      Termos de Uso
                    </button>
                    .
                  </span>
                </label>
              </div>

              {/* Mensagens de Validação / Erro */}
              {validationError && (
                <div role="alert" className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs text-center font-medium">
                  {validationError}
                </div>
              )}

              {/* BOTÃO FINAL DE CONVERSÃO / SOLICITAÇÃO VIA WHATSAPP */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={handleWhatsAppClick}
                  disabled={routing}
                  className={`w-full py-4 rounded-xl font-extrabold text-sm sm:text-base transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-xl shadow-emerald-950/70 ${
                    routing
                      ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                      : 'bg-emerald-400 hover:bg-emerald-300 active:bg-emerald-500 text-slate-950 hover:scale-[1.01] active:scale-[0.99]'
                  }`}
                >
                  {routing ? (
                    <>
                      <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      <span>Conectando ao atendente…</span>
                    </>
                  ) : (
                    <>
                      <MessageCircle className="w-5 h-5 fill-current" />
                      <span>Solicitar análise de crédito - sem compromisso</span>
                    </>
                  )}
                </button>
                <p className="text-center text-[10px] text-slate-400">
                  Você será direcionado ao atendimento oficial no WhatsApp da ZM SCD.
                </p>
              </div>

              {/* Botão de Voltar para ajustar valores */}
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => goToStep(3)}
                  className="text-xs text-slate-400 hover:text-white underline"
                >
                  Alterar prazo ou valor da simulação
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer Minimalista Institucional na Página Isolada */}
      <footer className="border-t border-slate-900 bg-slate-950/80 px-4 py-4 text-center text-[11px] text-slate-400 space-y-1">
        <p>
          <strong className="text-slate-300">{INSTITUTIONAL_DATA.legalName}</strong> • CNPJ: {INSTITUTIONAL_DATA.cnpj}
        </p>
        <p className="text-[10px]">
          Instituição financeira autorizada e regulada pelo Banco Central do Brasil.
        </p>
        <div className="flex items-center justify-center gap-4 text-[10px] pt-1">
          <button
            type="button"
            onClick={() => setIsPrivacyOpen(true)}
            className="hover:text-emerald-400 underline cursor-pointer"
          >
            Política de Privacidade
          </button>
          <span>•</span>
          <button
            type="button"
            onClick={() => setIsTermsOpen(true)}
            className="hover:text-emerald-400 underline cursor-pointer"
          >
            Termos de Uso
          </button>
        </div>
      </footer>

      {/* Modais Legais */}
      <PrivacyPolicyModal isOpen={isPrivacyOpen} onClose={() => setIsPrivacyOpen(false)} />
      <TermsOfUseModal isOpen={isTermsOpen} onClose={() => setIsTermsOpen(false)} />
      <MeasurementConsent />
    </div>
  );
}
