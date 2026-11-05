import React, { useState, useEffect } from 'react';
import { CreditModality, SimulationResult, PartnerOffer } from '../types/credit';
import { formatBRL, formatPercent, maskCPF, validateCPF, maskPhone } from '../utils/formatters';
import { X, Check, ArrowRight, ArrowLeft, ShieldCheck, CheckCircle2, Clock, Sparkles, AlertCircle, Copy, Send } from 'lucide-react';

interface ProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  modality: CreditModality;
  simulation: SimulationResult;
}

export const ProposalModal: React.FC<ProposalModalProps> = ({
  isOpen,
  onClose,
  modality,
  simulation,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [employmentType, setEmploymentType] = useState('clt');
  const [monthlyIncome, setMonthlyIncome] = useState('4500');
  const [hasNegativeCredit, setHasNegativeCredit] = useState(false);
  const [pixKeyType, setPixKeyType] = useState<'cpf' | 'phone' | 'email' | 'random'>('cpf');
  const [pixKey, setPixKey] = useState('');

  // Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<PartnerOffer | null>(null);
  const [protocolNumber, setProtocolNumber] = useState('');
  const [copiedProtocol, setCopiedProtocol] = useState(false);

  // Auto-fill CPF into PIX key if CPF is selected
  useEffect(() => {
    if (pixKeyType === 'cpf') setPixKey(cpf);
    else if (pixKeyType === 'phone') setPixKey(phone);
    else if (pixKeyType === 'email') setPixKey(email);
  }, [pixKeyType, cpf, phone, email]);

  // Reset or initialize on open
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setIsAnalyzing(false);
      setSelectedOffer(null);
      setProtocolNumber(`VAL-${Math.floor(100000 + Math.random() * 900000)}`);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isCpfValid = validateCPF(cpf);
  const isStep1Valid = fullName.trim().length >= 5 && isCpfValid && phone.replace(/\D/g, '').length >= 10 && email.includes('@');

  // Partner proposals generated dynamically for Step 3
  const partnerOffers: PartnerOffer[] = [
    {
      id: 'offer-pan',
      bankName: 'Banco Pan',
      logoColor: '#0083CA',
      monthlyRate: modality.monthlyInterestRate,
      monthlyPayment: simulation.monthlyPayment,
      months: simulation.months,
      totalAmount: simulation.totalPayment,
      approvalProbability: 'Garantida',
      recommended: true,
    },
    {
      id: 'offer-santander',
      bankName: 'Santander Financiamentos',
      logoColor: '#EC0000',
      monthlyRate: modality.monthlyInterestRate + 0.15,
      monthlyPayment: simulation.monthlyPayment * 1.03,
      months: simulation.months,
      totalAmount: simulation.totalPayment * 1.03,
      approvalProbability: 'Alta',
    },
    {
      id: 'offer-facta',
      bankName: 'Facta Financeira',
      logoColor: '#0A4A38',
      monthlyRate: modality.monthlyInterestRate + 0.22,
      monthlyPayment: simulation.monthlyPayment * 1.05,
      months: simulation.months,
      totalAmount: simulation.totalPayment * 1.05,
      approvalProbability: 'Alta',
    },
  ];

  const handleGoToAnalysis = () => {
    setStep(3);
    setIsAnalyzing(true);
    setTimeout(() => {
      setIsAnalyzing(false);
      setSelectedOffer(partnerOffers[0]);
    }, 1800);
  };

  const handleFinishProposal = () => {
    setStep(4);
  };

  const handleCopyProtocol = () => {
    navigator.clipboard.writeText(protocolNumber);
    setCopiedProtocol(true);
    setTimeout(() => setCopiedProtocol(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800">
          <div>
            <div className="text-xs uppercase tracking-wider text-emerald-400 font-semibold">
              Proposta de Crédito · {modality.title}
            </div>
            <div className="text-sm sm:text-base font-bold text-white">
              {step === 1 && '1. Seus Dados Pessoais'}
              {step === 2 && '2. Perfil de Renda & Chave Pix'}
              {step === 3 && '3. Ofertas Pré-Aprovadas'}
              {step === 4 && '4. Proposta Pronta para Liberação'}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Fechar formulário"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progress Bar */}
        <div className="h-1 bg-slate-100 flex">
          <div
            className="h-full bg-emerald-600 transition-all duration-300"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 max-h-[78vh] overflow-y-auto">
          {/* STEP 1: Personal Data */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200/60 flex items-center gap-2 text-xs text-emerald-900">
                <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>
                  Ambiente seguro e criptografado. Seus dados são protegidos pela LGPD e usados exclusivamente para análise.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nome Completo *</label>
                <input
                  type="text"
                  placeholder="Ex: Carlos Eduardo da Silva"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">CPF *</label>
                  <input
                    type="text"
                    placeholder="000.000.000-00"
                    maxLength={14}
                    value={cpf}
                    onChange={(e) => setCpf(maskCPF(e.target.value))}
                    className={`w-full px-3.5 py-2.5 text-sm bg-slate-50 border rounded-lg focus:outline-none focus:bg-white text-slate-900 font-mono ${
                      cpf.length >= 14
                        ? isCpfValid
                          ? 'border-emerald-500 bg-emerald-50/30'
                          : 'border-red-400 bg-red-50/30'
                        : 'border-slate-300 focus:border-emerald-600'
                    }`}
                  />
                  {cpf.length >= 14 && !isCpfValid && (
                    <span className="text-[11px] text-red-600 mt-1 block">CPF inválido. Verifique os dígitos.</span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">WhatsApp com DDD *</label>
                  <input
                    type="tel"
                    placeholder="(11) 98765-4321"
                    maxLength={15}
                    value={phone}
                    onChange={(e) => setPhone(maskPhone(e.target.value))}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-900 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">E-mail Principal *</label>
                  <input
                    type="email"
                    placeholder="seu.email@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Data de Nascimento</label>
                  <input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-900"
                  />
                </div>
              </div>

              {/* Simulation Recap */}
              <div className="p-3 bg-slate-100 rounded-xl text-xs flex items-center justify-between text-slate-700">
                <span>Simulação selecionada:</span>
                <span className="font-bold text-slate-900 font-mono">
                  {formatBRL(simulation.amount, false)} em {simulation.months}x de {formatBRL(simulation.monthlyPayment)}
                </span>
              </div>
            </div>
          )}

          {/* STEP 2: Financial Profile */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Sua Ocupação Principal *</label>
                <select
                  value={employmentType}
                  onChange={(e) => setEmploymentType(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-900"
                >
                  <option value="clt">Trabalhador CLT com carteira assinada</option>
                  <option value="consignado_inss">Aposentado ou Pensionista do INSS</option>
                  <option value="servidor">Servidor Público Municipal, Estadual ou Federal</option>
                  <option value="autonomo_mei">Profissional Autônomo / Microempreendedor (MEI)</option>
                  <option value="empresario">Empresário / Sócio de Empresa (PJ)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Renda Mensal Líquida (Aproximada) *</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-sm text-slate-500 font-medium">R$</span>
                  <input
                    type="number"
                    value={monthlyIncome}
                    onChange={(e) => setMonthlyIncome(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-900 font-mono"
                  />
                </div>
              </div>

              {/* Negative Credit Tolerance Question */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800">
                    Possui restrição no SPC, Serasa ou está negativado?
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setHasNegativeCredit(false)}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                        !hasNegativeCredit ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      Não
                    </button>
                    <button
                      type="button"
                      onClick={() => setHasNegativeCredit(true)}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                        hasNegativeCredit ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      Sim
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  {modality.acceptsNegativado
                    ? 'Excelente notícia: Para esta modalidade, restrições não impedem a aprovação.'
                    : 'Ser transparente ajuda nosso motor a encontrar a financeira com maior propensão de aprovação.'}
                </p>
              </div>

              {/* PIX Key Configuration */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Chave Pix para recebimento do valor aprovado *
                </label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {(['cpf', 'phone', 'email', 'random'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setPixKeyType(type)}
                      className={`py-1.5 text-xs font-medium rounded-lg border text-center transition-colors ${
                        pixKeyType === type
                          ? 'bg-emerald-50 border-emerald-600 text-emerald-900 font-semibold'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {type === 'cpf' && 'CPF'}
                      {type === 'phone' && 'Celular'}
                      {type === 'email' && 'E-mail'}
                      {type === 'random' && 'Aleatória'}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Informe sua chave Pix titular"
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-900 font-mono"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  A conta receptora deve ter o mesmo CPF do titular do empréstimo.
                </span>
              </div>
            </div>
          )}

          {/* STEP 3: Real-Time Partner Offers */}
          {step === 3 && (
            <div>
              {isAnalyzing ? (
                <div className="py-12 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-700 rounded-full animate-spin mb-4" />
                  <h4 className="text-base font-bold text-slate-900">Analisando elegibilidade em 6 instituições parceiras...</h4>
                  <p className="text-xs text-slate-500 max-w-sm mt-1">
                    Buscando menores taxas para {fullName || 'você'} sem registrar consultas desnecessárias.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <div>
                      <span className="text-xs text-slate-500">Score de Aprovação Estimado</span>
                      <div className="text-lg font-black text-emerald-700 font-mono">
                        780 / 1000 · Perfil Qualificado
                      </div>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full">
                      3 Propostas Encontradas
                    </span>
                  </div>

                  <p className="text-xs text-slate-600">
                    Selecione a instituição bancária de sua preferência para emitir o termo de contratação:
                  </p>

                  <div className="space-y-3">
                    {partnerOffers.map((offer) => {
                      const isSelected = selectedOffer?.id === offer.id;
                      return (
                        <div
                          key={offer.id}
                          onClick={() => setSelectedOffer(offer)}
                          className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                            isSelected
                              ? 'border-emerald-600 bg-emerald-50/40 shadow-sm'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3.5 h-3.5 rounded-full"
                                style={{ backgroundColor: offer.logoColor }}
                              />
                              <span className="text-sm font-bold text-slate-900">{offer.bankName}</span>
                              {offer.recommended && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-700 text-white">
                                  Menor Taxa
                                </span>
                              )}
                            </div>
                            <span className="text-xs font-semibold text-emerald-700">
                              Probabilidade {offer.approvalProbability}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-slate-100">
                            <div>
                              <span className="text-slate-400 block text-[11px]">Parcela</span>
                              <strong className="text-slate-900 font-mono">
                                {formatBRL(offer.monthlyPayment)}
                              </strong>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[11px]">Taxa Mensal</span>
                              <strong className="text-slate-900 font-mono">
                                {formatPercent(offer.monthlyRate)} a.m.
                              </strong>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[11px]">Total com Juros</span>
                              <strong className="text-slate-900 font-mono">
                                {formatBRL(offer.totalAmount)}
                              </strong>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Completed Formalization */}
          {step === 4 && (
            <div className="text-center py-4 space-y-5">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <Check className="w-8 h-8 stroke-[3]" />
              </div>

              <div>
                <h4 className="text-xl font-extrabold text-slate-900">Proposta Pré-Aprovada com Sucesso!</h4>
                <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">
                  Sua solicitação foi enviada para formalização digital junto ao {selectedOffer?.bankName || 'Banco Parceiro'}.
                </p>
              </div>

              {/* Formalization Protocol Badge */}
              <div className="p-3 bg-slate-100 rounded-xl inline-flex items-center gap-3 text-xs text-slate-700">
                <span>Protocolo da Operação:</span>
                <span className="font-mono font-bold text-slate-900">{protocolNumber}</span>
                <button
                  onClick={handleCopyProtocol}
                  className="p-1 hover:bg-slate-200 rounded text-slate-600"
                  title="Copiar protocolo"
                >
                  {copiedProtocol ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              {/* Summary Details */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Titular da Proposta:</span>
                  <span className="font-semibold text-slate-900">{fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">CPF:</span>
                  <span className="font-mono text-slate-900">{cpf}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Valor Líquido a Receber:</span>
                  <span className="font-mono font-bold text-emerald-700 text-sm">{formatBRL(simulation.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Condição Escolhida:</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {simulation.months}x de {formatBRL(selectedOffer?.monthlyPayment || simulation.monthlyPayment)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Chave Pix de Destino:</span>
                  <span className="font-mono text-slate-900">{pixKey || cpf}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200 text-emerald-800 font-semibold">
                  <span>Previsão de Depósito:</span>
                  <span>Pix em até {modality.pixReleaseTime}</span>
                </div>
              </div>

              {/* Security confirmation */}
              <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-left text-[11px] text-amber-900 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>LEMBRETE DE SEGURANÇA:</strong> Nenhum correspondente da ValoreCrédito solicitará transferências, depósitos antecipados ou senhas. Nosso serviço é 100% gratuito para o solicitante.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          {step > 1 && step < 4 ? (
            <button
              onClick={() => setStep((prev) => (prev - 1) as any)}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar</span>
            </button>
          ) : (
            <div />
          )}

          {step === 1 && (
            <button
              onClick={() => setStep(2)}
              disabled={!isStep1Valid}
              className={`px-6 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
                isStep1Valid
                  ? 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <span>Avançar para Perfil</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          {step === 2 && (
            <button
              onClick={handleGoToAnalysis}
              className="px-6 py-2.5 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg shadow-sm transition-all flex items-center gap-2"
            >
              <span>Consultar Ofertas Reais</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          {step === 3 && (
            <button
              onClick={handleFinishProposal}
              disabled={isAnalyzing || !selectedOffer}
              className="px-6 py-2.5 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <span>Confirmar Escolha e Formalizar</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          {step === 4 && (
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-8 py-2.5 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-all"
            >
              Concluir e Voltar ao Início
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
