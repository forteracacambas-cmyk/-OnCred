import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  Building2,
  AlertCircle,
  ShieldCheck,
  Calculator,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Sparkles,
  Lock,
  X,
  ChevronRight,
} from 'lucide-react';
import {
  SIMULATOR_CONFIG,
  CREDIT_CONFIG,
  formatCurrencyBRL,
  formatCurrencyExactBRL,
  calculateMonthlyPayment,
  getMaximumAllowedTerm,
} from '../config/creditConfig';
import { trackEvent } from '../utils/tracking';
import { goToWhatsApp, initVisitor } from '../utils/atendimento';

interface SimulatorHeroProps {
  onOpenPrivacy: () => void;
  onOpenConfig?: () => void;
}

export const SimulatorHero: React.FC<SimulatorHeroProps> = ({ onOpenPrivacy, onOpenConfig }) => {
  // Controle de modo: Página principal com informações vs. Funil separado passo a passo
  const [isFunnelActive, setIsFunnelActive] = useState<boolean>(false);

  // Etapas do Funil: 1 = Perfil, 2 = Valor, 3 = Prazo, 4 = Resumo
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  const [profile, setProfile] = useState<'PF' | 'PJ'>('PF');
  const [amount, setAmount] = useState<number>(SIMULATOR_CONFIG.PF.defaultAmount); // R$ 10.000

  // Prazo inicial baseado no valor padrão
  const initialMaxTerm = getMaximumAllowedTerm(SIMULATOR_CONFIG.PF.defaultAmount);
  const [term, setTerm] = useState<number>(Math.min(36, initialMaxTerm));

  // Checkbox de consentimento pré-marcado por padrão conforme solicitado
  const [agreedPrivacy, setAgreedPrivacy] = useState<boolean>(true);
  const [routing, setRouting] = useState(false);
  const routingRef = useRef(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    initVisitor().catch(() => {});
  }, []);

  const currentConfig = SIMULATOR_CONFIG[profile];

  // Prazo máximo permitido para o valor atual
  const maxAllowedTerm = getMaximumAllowedTerm(amount);

  // Parcela mensal estimada pela fórmula PMT
  const estimatedPayment = calculateMonthlyPayment(amount, term, CREDIT_CONFIG.monthlyInterestFrom);

  // Eventos de rastreamento
  useEffect(() => {
    trackEvent('page_view');
  }, []);

  // Iniciar Funil
  const handleStartFunnel = () => {
    setIsFunnelActive(true);
    setStep(1);
    trackEvent('simulation_started', {
      profile,
      amount,
      term,
    });
    // Rola suavemente para o topo do simulador
    const el = document.getElementById('simulador');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  // Sair do Funil e voltar para a landing
  const handleCloseFunnel = () => {
    setIsFunnelActive(false);
    setStep(1);
  };

  // Quando alterna PF/PJ no Passo 1
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

    trackEvent('profile_selected', {
      profile: newProfile,
      amount: newAmount,
    });

    // Avança direto para a etapa de valor sem fricção
    setStep(2);
  };

  // Quando o usuário ajusta o valor no Passo 2
  const handleAmountChange = (newVal: number) => {
    setValidationError(null);
    setAmount(newVal);

    const newMaxTerm = getMaximumAllowedTerm(newVal);
    if (term > newMaxTerm) {
      setTerm(newMaxTerm);
    }

    trackEvent('amount_changed', {
      profile,
      amount: newVal,
    });
  };

  // Quando o usuário altera o número de parcelas no Passo 3
  const handleTermChange = (newTerm: number) => {
    setValidationError(null);
    const validTerm = Math.max(CREDIT_CONFIG.minimumTermMonths, Math.min(newTerm, maxAllowedTerm));
    setTerm(validTerm);

    trackEvent('term_changed', {
      profile,
      amount,
      term: validTerm,
    });
  };

  // Envio final para o atendente do WhatsApp via Cloudflare D1
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

    const message = `Olá! Vim pelo site da OnCred e gostaria de iniciar uma solicitação para análise de crédito.\n\nPerfil: ${profileText}\nValor de interesse: ${formattedAmount}\nPrazo selecionado: ${term} meses\nParcela mensal estimada: ${formattedPayment}\n\nEstou ciente de que esta é uma estimativa inicial e que a solicitação está sujeita à análise cadastral e de crédito.`;

    routingRef.current = true;
    setRouting(true);
    try {
      await goToWhatsApp(message);
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Não foi possível encaminhar. Tente novamente.');
    } finally {
      routingRef.current = false;
      setRouting(false);
    }
  };

  return (
    <section id="simulador" className="relative pt-10 pb-20 sm:pt-16 sm:pb-24 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white overflow-hidden min-h-[620px] flex items-center">
      {/* Background glow subtleties */}
      <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />
      <div className="absolute top-1/4 -right-48 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 w-full">

        {/* ================================================================= */}
        {/* ESTADO 1: PÁGINA PRINCIPAL / HERO COM INFORMAÇÕES & BOTÃO INICIAR */}
        {/* ================================================================= */}
        {!isFunnelActive ? (
          <div className="text-center max-w-3xl mx-auto animate-in fade-in duration-300">
            {/* Trust badge */}
            <div className="inline-flex items-center justify-center gap-2 px-4 py-1.5 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-center shadow-sm mb-6">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-xs text-emerald-200 font-medium">
                OnCred Sociedade de Crédito Direto • Regulada pelo Banco Central • 18+
              </span>
            </div>

            {/* Headline com tipografia balanceada */}
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight" style={{ textWrap: 'balance' }}>
              Crédito inteligente para seus planos com <span className="text-emerald-400 underline decoration-emerald-500/30 underline-offset-8">aprovação ágil</span>
            </h1>

            <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl mx-auto mb-10">
              Faça sua simulação personalizada em poucos passos, descubra sua parcela estimada e inicie seu atendimento seguro pelo WhatsApp sem pagar nenhuma taxa antecipada.
            </p>

            {/* BOTÃO PRINCIPAL DE INICIAR SIMULAÇÃO */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <button
                type="button"
                onClick={handleStartFunnel}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl font-extrabold text-base sm:text-lg bg-emerald-400 hover:bg-emerald-300 active:bg-emerald-500 text-slate-950 transition-all flex items-center justify-center gap-3 cursor-pointer shadow-xl shadow-emerald-950/60 hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap shrink-0"
              >
                <span>Iniciar Simulação Gratuita</span>
                <ArrowRight className="w-5 h-5 shrink-0" />
              </button>
            </div>

            {/* Benefícios rápidos em destaque */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-8 border-t border-slate-800/80 text-xs sm:text-sm text-slate-300">
              <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Sem cobrança antecipada</span>
              </div>
              <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Atendimento humanizado</span>
              </div>
              <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Taxa ref. a partir de 1,35% a.m.</span>
              </div>
            </div>
          </div>
        ) : (
          /* ================================================================= */
          /* ESTADO 2: FUNIL SEPARADO INTERATIVO PASSO A PASSO (ESPAÇOSO)      */
          /* ================================================================= */
          <div className="max-w-2xl mx-auto animate-in zoom-in-95 duration-300">
            {/* Card Principal do Funil - Espaçoso, arejado, sem aperto */}
            <div className="bg-slate-900/95 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-md">

              {/* Barra de Progresso e Navegação Superior */}
              <div className="flex items-center justify-between pb-6 mb-8 border-b border-slate-800">
                <div>
                  <div className="text-xs font-bold text-emerald-400 uppercase tracking-widest font-mono">
                    Etapa {step} de 4
                  </div>
                  <div className="text-sm font-semibold text-white mt-0.5">
                    {step === 1 && 'Escolha do Perfil'}
                    {step === 2 && 'Valor Pretendido'}
                    {step === 3 && 'Número de Parcelas'}
                    {step === 4 && 'Resumo & Solicitação'}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCloseFunnel}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Voltar à página inicial"
                >
                  <X className="w-4 h-4" />
                  <span>Fechar</span>
                </button>
              </div>

              {/* Indicador visual de progresso */}
              <div className="w-full h-1.5 bg-slate-800 rounded-full mb-8 overflow-hidden">
                <div
                  className="h-full bg-emerald-400 transition-all duration-300 rounded-full"
                  style={{ width: `${(step / 4) * 100}%` }}
                />
              </div>

              {/* ------------------------------------------------------------- */}
              {/* ETAPA 1: PERFIL (PF OU PJ)                                    */}
              {/* ------------------------------------------------------------- */}
              {step === 1 && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
                      Para quem é o crédito solicitado?
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-400">
                      Selecione uma opção para desbloquear as condições específicas:
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Opção Pessoa Física */}
                    <button
                      type="button"
                      onClick={() => handleProfileSelect('PF')}
                      className={`p-6 rounded-2xl border-2 text-left transition-all duration-200 cursor-pointer flex flex-col justify-between group ${
                        profile === 'PF'
                          ? 'bg-emerald-950/40 border-emerald-500 shadow-md ring-1 ring-emerald-500/40'
                          : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                      }`}
                    >
                      <div>
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4 group-hover:scale-105 transition-transform">
                          <User className="w-6 h-6" />
                        </div>
                        <h3 className="text-base font-bold text-white mb-1">Pessoa Física</h3>
                        <p className="text-xs text-slate-400 leading-relaxed mb-4">
                          Para assalariados, servidores públicos, aposentados e autônomos.
                        </p>
                      </div>

                      <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-emerald-400 font-semibold">
                        <span>R$ 1.000 a R$ 50.000</span>
                        <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </button>

                    {/* Opção Pessoa Jurídica */}
                    <button
                      type="button"
                      onClick={() => handleProfileSelect('PJ')}
                      className={`p-6 rounded-2xl border-2 text-left transition-all duration-200 cursor-pointer flex flex-col justify-between group ${
                        profile === 'PJ'
                          ? 'bg-emerald-950/40 border-emerald-500 shadow-md ring-1 ring-emerald-500/40'
                          : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                      }`}
                    >
                      <div>
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4 group-hover:scale-105 transition-transform">
                          <Building2 className="w-6 h-6" />
                        </div>
                        <h3 className="text-base font-bold text-white mb-1">Pessoa Jurídica (PJ)</h3>
                        <p className="text-xs text-slate-400 leading-relaxed mb-4">
                          Capital de giro e investimentos para MEI, micro e médias empresas.
                        </p>
                      </div>

                      <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-emerald-400 font-semibold">
                        <span>R$ 5.000 a R$ 100.000</span>
                        <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* ETAPA 2: VALOR DE INTERESSE                                   */}
              {/* ------------------------------------------------------------- */}
              {step === 2 && (
                <div className="space-y-8">
                  <div className="text-center">
                    <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">
                      De quanto você precisa?
                    </h2>
                    <p className="text-xs text-slate-400">
                      Perfil selecionado: <strong className="text-emerald-400">{profile === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'}</strong>
                    </p>
                  </div>

                  {/* Valor Principal em destaque amplo */}
                  <div className="text-center py-4">
                    <div className="text-4xl sm:text-5xl font-black text-white font-mono tracking-tight">
                      {formatCurrencyBRL(amount)}
                    </div>
                  </div>

                  {/* Slider de valor */}
                  <div className="px-2">
                    <input
                      id="amount-slider"
                      type="range"
                      min={currentConfig.minAmount}
                      max={currentConfig.maxAmount}
                      step={currentConfig.step}
                      value={amount}
                      onChange={(e) => handleAmountChange(Number(e.target.value))}
                      className="w-full accent-emerald-500 cursor-pointer h-3 bg-slate-800 rounded-lg touch-pan-x"
                    />
                    <div className="flex items-center justify-between text-xs text-slate-500 font-mono mt-2">
                      <span>Mínimo: {formatCurrencyBRL(currentConfig.minAmount)}</span>
                      <span>Máximo: {formatCurrencyBRL(currentConfig.maxAmount)}</span>
                    </div>
                  </div>

                  {/* Atalhos Rápidos de Valores em linha limpa */}
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    {currentConfig.presetSteps.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleAmountChange(preset)}
                        className={`text-xs px-3.5 py-2 rounded-xl font-mono font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                          amount === preset
                            ? 'bg-emerald-400 text-slate-950 font-bold shadow-md shadow-emerald-950/40'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {formatCurrencyBRL(preset, false)}
                      </button>
                    ))}
                  </div>

                  {/* Controles de Navegação */}
                  <div className="flex items-center justify-between pt-6 border-t border-slate-800 gap-3">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="px-5 py-3 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap shrink-0"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Voltar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="px-6 sm:px-8 py-3.5 rounded-xl font-bold text-sm bg-emerald-400 hover:bg-emerald-300 active:bg-emerald-500 text-slate-950 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-950/40 whitespace-nowrap shrink-0"
                    >
                      <span>Avançar para Prazo</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* ETAPA 3: NÚMERO DE PARCELAS                                   */}
              {/* ------------------------------------------------------------- */}
              {step === 3 && (
                <div className="space-y-8">
                  <div className="text-center">
                    <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">
                      Em quantas vezes prefere pagar?
                    </h2>
                    <p className="text-xs text-slate-400">
                      Valor selecionado: <strong className="text-white font-mono">{formatCurrencyBRL(amount)}</strong>
                    </p>
                  </div>

                  {/* Prazo e Estimativa em destaque */}
                  <div className="text-center py-2 space-y-3">
                    <div className="text-4xl sm:text-5xl font-black text-white font-mono tracking-tight">
                      {term} parcelas
                    </div>
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 text-sm font-mono font-bold">
                      <span>Estimativa: aprox. {formatCurrencyExactBRL(estimatedPayment)} /mês</span>
                    </div>
                  </div>

                  {/* Slider de parcelas */}
                  <div className="px-2">
                    <input
                      id="term-slider"
                      type="range"
                      min={CREDIT_CONFIG.minimumTermMonths}
                      max={maxAllowedTerm}
                      step={1}
                      value={term}
                      onChange={(e) => handleTermChange(Number(e.target.value))}
                      className="w-full accent-emerald-500 cursor-pointer h-3 bg-slate-800 rounded-lg touch-pan-x"
                    />
                    <div className="flex items-center justify-between text-xs text-slate-500 font-mono mt-2">
                      <span>Mínimo: {CREDIT_CONFIG.minimumTermMonths} meses</span>
                      <span className="text-emerald-400">Máx. p/ este valor: {maxAllowedTerm} meses</span>
                    </div>
                  </div>

                  {/* Preset Chips de Prazos */}
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    {[6, 12, 18, 24, 36, 48, 60, 72, 84, 120]
                      .filter((p) => p <= maxAllowedTerm)
                      .map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => handleTermChange(p)}
                          className={`text-xs px-3.5 py-2 rounded-xl font-mono font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                            term === p
                              ? 'bg-emerald-400 text-slate-950 font-bold shadow-md shadow-emerald-950/40'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {p}x
                        </button>
                      ))}
                  </div>

                  {/* Controles de Navegação */}
                  <div className="flex items-center justify-between pt-6 border-t border-slate-800 gap-3">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="px-5 py-3 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap shrink-0"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Voltar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStep(4)}
                      className="px-6 sm:px-8 py-3.5 rounded-xl font-bold text-sm bg-emerald-400 hover:bg-emerald-300 active:bg-emerald-500 text-slate-950 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-950/40 whitespace-nowrap shrink-0"
                    >
                      <span>Ver Resumo da Simulação</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* ETAPA 4: RESUMO & SOLICITAÇÃO DE ANÁLISE NO WHATSAPP          */}
              {/* ------------------------------------------------------------- */}
              {step === 4 && (
                <div className="space-y-6">
                  <div className="text-center">
                    <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">
                      Resumo da sua simulação
                    </h2>
                    <p className="text-xs text-slate-400">
                      Confira os detalhes antes de iniciar o atendimento pelo WhatsApp:
                    </p>
                  </div>

                  {/* Card de Resumo Arejado e Limpo */}
                  <div className="p-6 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-slate-400 block mb-1">Perfil Solicitante:</span>
                        <strong className="text-white text-sm font-semibold">
                          {profile === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-1">Valor de Interesse:</span>
                        <strong className="text-emerald-400 text-sm font-mono font-bold">
                          {formatCurrencyBRL(amount)}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-1">Número de Parcelas:</span>
                        <strong className="text-white text-sm font-mono font-semibold">
                          {term} meses fixos
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-1">Taxa de Referência:</span>
                        <strong className="text-slate-300 text-sm font-mono">
                          1,35% ao mês
                        </strong>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="text-xs text-emerald-300 block">
                          Parcela mensal estimada:
                        </span>
                        <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono tracking-tight">
                          {formatCurrencyExactBRL(estimatedPayment)}
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono text-right">
                        <div>Sem taxa antecipada</div>
                        <div className="text-emerald-400">Atendimento humanizado</div>
                      </div>
                    </div>
                  </div>

                  {/* Consentimento de Privacidade (Marcado por padrão) */}
                  <div className="pt-2">
                    <label className="flex items-start gap-3 cursor-pointer select-none group text-left">
                      <input
                        type="checkbox"
                        checked={agreedPrivacy}
                        onChange={(e) => setAgreedPrivacy(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-800 text-emerald-600 focus:ring-2 focus:ring-emerald-500 cursor-pointer shrink-0 accent-emerald-500"
                        id="privacy-consent"
                      />
                      <span className="text-xs text-slate-300 leading-snug">
                        Li e concordo com a{' '}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onOpenPrivacy();
                          }}
                          className="text-emerald-400 underline underline-offset-2 hover:text-emerald-300 font-semibold inline"
                        >
                          Política de Privacidade
                        </button>{' '}
                        e autorizo o encaminhamento desta simulação para atendimento. Sujeito à análise de crédito.
                      </span>
                    </label>
                  </div>

                  {/* Feedback de Validação */}
                  {validationError && (
                    <div className="p-3 bg-red-950/80 border border-red-500/70 rounded-xl text-xs text-red-200 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <span>{validationError}</span>
                    </div>
                  )}

                  {/* BOTÃO PRINCIPAL COM TEXTO EXATO EM LINHA ÚNICA */}
                  <button
                    type="button"
                    disabled={!agreedPrivacy || routing}
                    onClick={handleWhatsAppClick}
                    className={`w-full py-4 px-6 rounded-2xl font-extrabold text-sm sm:text-base flex items-center justify-center gap-3 transition-all duration-200 cursor-pointer shadow-xl active:scale-[0.99] whitespace-nowrap shrink-0 ${
                      agreedPrivacy
                        ? 'bg-emerald-400 hover:bg-emerald-300 active:bg-emerald-500 text-slate-950 shadow-emerald-950/50'
                        : 'bg-slate-800 text-slate-400 cursor-not-allowed opacity-60 shadow-none'
                    }`}
                  >
                    {/* Logo do WhatsApp */}
                    <svg
                      className="w-5 h-5 shrink-0 fill-current"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path d="M12.031 2C6.516 2 2.025 6.491 2.025 12.006c0 1.93.551 3.734 1.508 5.263L2.002 22l4.898-1.503a9.96 9.96 0 0 0 5.131 1.517c5.515 0 10.006-4.491 10.006-10.008C22.037 6.491 17.546 2 12.031 2zm0 18.232c-1.637 0-3.153-.473-4.437-1.285l-.318-.201-2.923.898.908-2.854-.207-.328A8.19 8.19 0 0 1 3.82 12.006C3.82 7.481 7.498 3.803 12.031 3.803c4.533 0 8.211 3.678 8.211 8.203 0 4.525-3.678 8.226-8.211 8.226zm4.502-6.149c-.247-.124-1.463-.722-1.69-.805-.227-.082-.392-.124-.557.124-.165.247-.64 1.052-.784 1.217-.144.165-.289.186-.536.062-.247-.124-1.043-.385-1.986-1.226-.734-.655-1.23-1.464-1.374-1.711-.144-.247-.015-.38.109-.504.111-.111.247-.289.371-.433.124-.144.165-.247.247-.412.082-.165.041-.309-.021-.433-.062-.124-.557-1.34-.763-1.835-.2-.482-.404-.417-.557-.425l-.474-.008c-.165 0-.433.062-.66.309-.227.247-.866.845-.866 2.062 0 1.216.887 2.392 1.01 2.557.124.165 1.745 2.665 4.227 3.738.591.255 1.052.408 1.412.522.593.188 1.134.161 1.56.098.476-.071 1.463-.598 1.669-1.175.206-.577.206-1.072.144-1.175-.062-.103-.227-.165-.474-.289z" />
                    </svg>
                    <span>{routing ? 'Conectando ao Atendente…' : 'Solicitar análise de crédito - sem compromisso'}</span>
                  </button>

                  {/* Voltar */}
                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Voltar para Prazo</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCloseFunnel}
                      className="text-xs text-slate-500 hover:text-slate-300 underline"
                    >
                      Voltar à página inicial
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Explicações e Condições Regulatórias TikTok Ads */}
            <div className="mt-8 pt-4 border-t border-slate-800/80 space-y-2 text-[11px] text-slate-400 leading-relaxed text-center">
              <p>
                <strong className="text-slate-300">Explicações e Condições Regulatórias:</strong> Estimativa informativa calculada com a taxa de referência mínima informada de 1,35% ao mês (~17,46% a.a.). A taxa efetiva, CET, tributos (IOF) e valor exato da parcela serão detalhados na proposta individual pela instituição financeira responsável.
              </p>
              <p className="text-emerald-400 font-medium">
                Operação sujeita à análise cadastral e de crédito • Destinado exclusivamente a maiores de 18 anos.
              </p>
            </div>
          </div>
        )}

      </div>
    </section>
  );
};
