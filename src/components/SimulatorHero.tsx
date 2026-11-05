import React, { useState, useEffect, useRef } from 'react';
import { User, Building2, AlertCircle, ShieldCheck, Calculator, ArrowRight, CheckCircle2, Clock, Sparkles } from 'lucide-react';
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
  const [profile, setProfile] = useState<'PF' | 'PJ'>('PF');
  const [amount, setAmount] = useState<number>(SIMULATOR_CONFIG.PF.defaultAmount); // R$ 10.000

  // Prazo inicial baseado no valor padrão (para 10.000 o máximo calculado é 36)
  const initialMaxTerm = getMaximumAllowedTerm(SIMULATOR_CONFIG.PF.defaultAmount);
  const [term, setTerm] = useState<number>(Math.min(36, initialMaxTerm));

  // Checkbox de consentimento marcado como padrão (sempre ativo como solicitado pelo usuário)
  const [agreedPrivacy, setAgreedPrivacy] = useState<boolean>(true);
  const [routing, setRouting] = useState(false);
  const routingRef = useRef(false);
  useEffect(() => { initVisitor().catch(() => {}); }, []);
  const [validationError, setValidationError] = useState<string | null>(null);

  const currentConfig = SIMULATOR_CONFIG[profile];

  // Cálculo dinâmico do prazo máximo permitido para o valor atual
  const maxAllowedTerm = getMaximumAllowedTerm(amount);

  // Cálculo da parcela mensal estimada pela fórmula PMT
  const estimatedPayment = calculateMonthlyPayment(amount, term, CREDIT_CONFIG.monthlyInterestFrom);

  // Disparar eventos quando o simulador carrega
  useEffect(() => {
    trackEvent('page_view');
    trackEvent('application_started', {
      profile,
      amount,
      term,
    });
    trackEvent('simulation_started', {
      profile,
      amount,
      term,
    });
  }, []);

  // Notificar cálculo de estimativa sempre que os parâmetros alterarem
  useEffect(() => {
    if (estimatedPayment > 0) {
      trackEvent('payment_estimate_calculated', {
        profile,
        amount,
        term,
        estimated_payment: estimatedPayment,
      });
    }
  }, [profile, amount, term, estimatedPayment]);

  // Quando alterna PF/PJ, ajusta o valor para os limites do perfil selecionado
  const handleProfileChange = (newProfile: 'PF' | 'PJ') => {
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

    // Recalcula o prazo máximo para o novo valor
    const newMaxTerm = getMaximumAllowedTerm(newAmount);
    if (term > newMaxTerm) {
      setTerm(newMaxTerm);
    }

    trackEvent('profile_selected', {
      profile: newProfile,
      amount: newAmount,
    });
  };

  // Quando o usuário ajusta o valor de interesse
  const handleAmountChange = (newVal: number) => {
    setValidationError(null);
    setAmount(newVal);

    // Recalcula dinamicamente o prazo máximo
    const newMaxTerm = getMaximumAllowedTerm(newVal);
    if (term > newMaxTerm) {
      setTerm(newMaxTerm);
    }

    trackEvent('amount_changed', {
      profile,
      amount: newVal,
    });
    trackEvent('loan_amount_changed', {
      profile,
      amount: newVal,
    });
  };

  // Quando o usuário altera o número de parcelas
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

  // Toggle do consentimento de privacidade
  const handlePrivacyToggle = (checked: boolean) => {
    setAgreedPrivacy(checked);
    if (checked) {
      setValidationError(null);
      trackEvent('privacy_accepted', {
        profile,
        amount,
        term,
      });
    }
  };

  // Validação estrita e abertura do canal de WhatsApp com dados oficiais
  const handleWhatsAppClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (routingRef.current) return;
    setValidationError(null);

    // 1. Validação de consentimento
    if (!agreedPrivacy) {
      setValidationError('Marque o aceite da Política de Privacidade para prosseguir com o atendimento.');
      return;
    }

    // 2. Validação de perfil
    if (profile !== 'PF' && profile !== 'PJ') {
      setValidationError('Selecione se você é Pessoa Física ou Pessoa Jurídica.');
      return;
    }

    // 3. Validação de intervalo de valor do perfil
    const config = SIMULATOR_CONFIG[profile];
    if (amount < config.minAmount || amount > config.maxAmount) {
      setValidationError(
        `O valor de interesse deve estar entre ${formatCurrencyBRL(config.minAmount)} e ${formatCurrencyBRL(config.maxAmount)}.`
      );
      return;
    }

    // 4. Validação do prazo em relação ao limite dinâmico
    const currentMax = getMaximumAllowedTerm(amount);
    if (term < CREDIT_CONFIG.minimumTermMonths || term > currentMax) {
      setValidationError(
        `O prazo deve ser de ${CREDIT_CONFIG.minimumTermMonths} a ${currentMax} parcelas para o valor selecionado.`
      );
      return;
    }

    // 5. Validação de cálculo numérico
    if (!estimatedPayment || estimatedPayment <= 0 || isNaN(estimatedPayment)) {
      setValidationError('Não foi possível calcular a estimativa. Por favor, reajuste o valor ou o prazo.');
      return;
    }

    const profileText = profile === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica';
    const formattedAmount = formatCurrencyBRL(amount);
    const formattedPayment = formatCurrencyExactBRL(estimatedPayment);

    const message = `Olá! Vim pelo site da OnCred e gostaria de iniciar uma solicitação para análise de crédito.\n\nPerfil: ${profileText}\nValor de interesse: ${formattedAmount}\nPrazo selecionado: ${term} meses\nParcela mensal estimada: ${formattedPayment}\n\nEstou ciente de que esta é uma estimativa inicial e que a solicitação está sujeita à análise.`;

    routingRef.current = true; setRouting(true);
    try { await goToWhatsApp(message); }
    catch (err) { setValidationError(err instanceof Error ? err.message : 'Não foi possível encaminhar. Tente novamente.'); }
    finally { routingRef.current = false; setRouting(false); }
  };

  return (
    <section id="simulador" className="relative pt-6 pb-16 sm:pt-10 sm:pb-20 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white overflow-hidden">
      {/* Background glow subtleties */}
      <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />
      <div className="absolute top-1/4 -right-48 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6">

        {/* Top Trust Kicker Pill-Free */}
        <div className="flex justify-center mb-3">
          <div className="inline-flex items-center justify-center gap-2 px-3.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-center shadow-sm">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-xs text-emerald-200 font-medium">
              Simulação transparente & atendimento humanizado • 18+
            </span>
          </div>
        </div>

        {/* Hero Title & Subtitle */}
        <div className="text-center max-w-2xl mx-auto mb-8 px-2">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-3 leading-tight" style={{ textWrap: 'balance' }}>
            Crédito sob medida com <span className="text-emerald-400 underline decoration-emerald-500/30 underline-offset-8">análise ágil</span>
          </h1>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-lg mx-auto">
            Simule o valor desejado, consulte a parcela estimada e dê início à sua análise sem taxas antecipadas.
          </p>
        </div>

        {/* Main Interactive Simulator Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-8 shadow-2xl backdrop-blur-md space-y-6">

          {/* PASSO 1: Seleção de Perfil */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className="text-xs sm:text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <span>1. Selecione o seu perfil</span>
              </label>
              <span className="text-xs text-emerald-400 font-mono font-medium">
                {profile === 'PF' ? 'PF: R$ 1.000 a R$ 50.000' : 'PJ: R$ 5.000 a R$ 100.000'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleProfileChange('PF')}
                className={`flex items-center justify-center gap-2.5 py-3 sm:py-3.5 px-4 rounded-xl border text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  profile === 'PF'
                    ? 'bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-950/40'
                    : 'bg-slate-800/60 text-slate-300 border-slate-700/80 hover:bg-slate-800 hover:text-white'
                }`}
                aria-pressed={profile === 'PF'}
              >
                <User className="w-4 h-4 shrink-0" />
                <span>Pessoa Física</span>
              </button>

              <button
                type="button"
                onClick={() => handleProfileChange('PJ')}
                className={`flex items-center justify-center gap-2.5 py-3 sm:py-3.5 px-4 rounded-xl border text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  profile === 'PJ'
                    ? 'bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-950/40'
                    : 'bg-slate-800/60 text-slate-300 border-slate-700/80 hover:bg-slate-800 hover:text-white'
                }`}
                aria-pressed={profile === 'PJ'}
              >
                <Building2 className="w-4 h-4 shrink-0" />
                <span>Pessoa Jurídica (PJ)</span>
              </button>
            </div>
          </div>

          {/* PASSO 2: Valor de interesse */}
          <div className="bg-slate-950/70 rounded-2xl p-4 sm:p-5 border border-slate-800/80">
            <div className="flex items-center justify-between gap-2 mb-2">
              <label htmlFor="amount-slider" className="text-xs sm:text-sm font-bold text-slate-200 uppercase tracking-wider">
                2. Quanto você precisa?
              </label>
              <span className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight shrink-0">
                {formatCurrencyBRL(amount)}
              </span>
            </div>

            {/* Slider de valor */}
            <div className="py-2">
              <input
                id="amount-slider"
                type="range"
                min={currentConfig.minAmount}
                max={currentConfig.maxAmount}
                step={currentConfig.step}
                value={amount}
                onChange={(e) => handleAmountChange(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer h-2.5 bg-slate-800 rounded-lg touch-pan-x"
                aria-valuemin={currentConfig.minAmount}
                aria-valuemax={currentConfig.maxAmount}
                aria-valuenow={amount}
                aria-label={`Valor de interesse: ${formatCurrencyBRL(amount)}`}
              />
            </div>

            {/* Atalhos Rápidos de Valores */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 mt-1 scrollbar-none">
              <span className="text-[11px] text-slate-400 font-medium mr-1 shrink-0">Atalhos:</span>
              {currentConfig.presetSteps.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleAmountChange(preset)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg font-mono font-medium transition-colors shrink-0 ${
                    amount === preset
                      ? 'bg-emerald-500 text-slate-950 font-bold'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {formatCurrencyBRL(preset, false)}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono mt-2 pt-2 border-t border-slate-900">
              <span>Mínimo: {formatCurrencyBRL(currentConfig.minAmount)}</span>
              <span>Máximo: {formatCurrencyBRL(currentConfig.maxAmount)}</span>
            </div>
          </div>

          {/* PASSO 3: Em quantas parcelas? */}
          <div className="bg-slate-950/70 rounded-2xl p-4 sm:p-5 border border-slate-800/80">
            <div className="flex items-center justify-between gap-2 mb-2">
              <label htmlFor="term-slider" className="text-xs sm:text-sm font-bold text-slate-200 uppercase tracking-wider">
                3. Prazo de pagamento
              </label>
              <span className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight shrink-0">
                {term}x <span className="text-xs sm:text-sm font-normal text-slate-400">({term} meses)</span>
              </span>
            </div>

            {/* Slider de parcelas */}
            <div className="py-2">
              <input
                id="term-slider"
                type="range"
                min={CREDIT_CONFIG.minimumTermMonths}
                max={maxAllowedTerm}
                step={1}
                value={term}
                onChange={(e) => handleTermChange(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer h-2.5 bg-slate-800 rounded-lg touch-pan-x"
                aria-valuemin={CREDIT_CONFIG.minimumTermMonths}
                aria-valuemax={maxAllowedTerm}
                aria-valuenow={term}
                aria-label={`Prazo: ${term} parcelas`}
              />
            </div>

            {/* Atalhos Rápidos de Prazo */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 mt-1 scrollbar-none">
              <span className="text-[11px] text-slate-400 font-medium mr-1 shrink-0">Prazos:</span>
              {[6, 12, 24, 36, 48, 60]
                .filter((p) => p <= maxAllowedTerm)
                .map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handleTermChange(p)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg font-mono font-medium transition-colors shrink-0 ${
                      term === p
                        ? 'bg-emerald-500 text-slate-950 font-bold'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {p}x
                  </button>
                ))}
            </div>

            <div className="flex justify-between items-center text-[11px] text-slate-400 font-mono mt-2 pt-2 border-t border-slate-900">
              <span>Mínimo: {CREDIT_CONFIG.minimumTermMonths}x</span>
              <span className="text-emerald-400">Máximo: {maxAllowedTerm}x para este valor</span>
            </div>
          </div>

          {/* PASSO 4: Resultado da Estimativa */}
          <div className="p-4 sm:p-5 bg-gradient-to-br from-emerald-950/60 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-2xl shadow-md space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                <Calculator className="w-4 h-4 shrink-0" />
                <span>Estimativa Calculada</span>
              </div>
              <span className="text-xs text-slate-400 font-mono shrink-0">
                Taxa de referência: 1,35% a.m.
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pt-2 border-t border-slate-800">
              <div>
                <span className="text-xs text-slate-300 block mb-1">
                  Parcela mensal estimada:
                </span>
                <div className="text-3xl sm:text-4xl font-black text-emerald-400 font-mono tracking-tight leading-none">
                  {formatCurrencyExactBRL(estimatedPayment)}
                </div>
              </div>
              <div className="text-left sm:text-right text-xs text-slate-300 font-mono bg-slate-950/60 px-3 py-2 rounded-xl border border-slate-800">
                <div>Valor: <strong className="text-white">{formatCurrencyBRL(amount)}</strong></div>
                <div>Prazo: <strong className="text-emerald-400">{term} parcelas fixas</strong></div>
              </div>
            </div>
          </div>

          {/* PASSO 5: Consentimento de Privacidade (Marcado como padrão conforme solicitado) */}
          <div className="pt-2">
            <label className="flex items-start gap-3 cursor-pointer select-none group text-left">
              <input
                type="checkbox"
                checked={agreedPrivacy}
                onChange={(e) => handlePrivacyToggle(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-800 text-emerald-600 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-slate-900 cursor-pointer shrink-0 accent-emerald-500"
                id="privacy-consent"
              />
              <span className="text-xs text-slate-300 group-hover:text-white leading-snug">
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
                e autorizo o encaminhamento das informações desta simulação para atendimento. A solicitação está sujeita à análise cadastral e de crédito.
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

          {/* BOTÃO PRINCIPAL: Continuar pelo WhatsApp */}
          <button
            type="button"
            disabled={!agreedPrivacy || routing}
            onClick={handleWhatsAppClick}
            className={`w-full py-4 px-6 rounded-2xl font-extrabold text-base sm:text-lg flex items-center justify-center gap-3 transition-all duration-200 cursor-pointer shadow-xl active:scale-[0.99] ${
              agreedPrivacy
                ? 'bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 shadow-emerald-950/50'
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
            <span>{routing ? 'Conectando ao WhatsApp…' : 'Solicitar Análise de Crédito'}</span>
            <ArrowRight className="w-5 h-5 shrink-0" />
          </button>

          {/* Quick guarantees below button */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 text-center text-xs text-slate-400">
            <div className="flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Sem taxa antecipada</span>
            </div>
            <div className="flex items-center justify-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Atendimento ágil</span>
            </div>
            <div className="flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Segurança 100% digital</span>
            </div>
          </div>

          {/* EXPLICAÇÕES E CONDIÇÕES REGULATÓRIAS */}
          <div className="pt-4 border-t border-slate-800/80 space-y-2 text-[11px] text-slate-400 leading-relaxed text-center sm:text-left">
            <p>
              <strong className="text-slate-300">Explicações e Condições:</strong> Esta é uma estimativa calculada com a taxa de referência informativa de 1,35% ao mês (equivalente a partir de aprox. 17,46% ao ano). A taxa efetiva, CET, custos, valor da parcela e demais condições podem variar conforme modalidade, perfil cadastral e análise de crédito. O número máximo de parcelas varia conforme o valor de interesse.
            </p>
            <p className="text-slate-500 text-[10px]">
              A estimativa acima utiliza apenas a taxa mensal de referência e pode não incluir CET, tributos, seguros ou outros custos eventualmente aplicáveis. Estimativa informativa; não representa aprovação, proposta vinculante ou garantia de concessão de crédito.
            </p>
            <p className="text-emerald-400/90 font-medium text-center text-[11px]">
              Operação sujeita à análise cadastral e de crédito • Destinado exclusivamente a maiores de 18 anos.
            </p>
          </div>
        </div>

      </div>
    </section>
  );
};
