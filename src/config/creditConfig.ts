// Identificação fornecida pelo responsável e conferida na política oficial da ZM SCD.
export const DEFAULT_WHATSAPP_NUMBER = ""; // Destinos reais são cadastrados no painel D1.
export const DISPLAY_PHONE_NUMBER = "+55 (11) 3042-0181";
export const DEFAULT_CONTACT_EMAIL = "contato@oncreditsa.online";
export const INSTITUTIONAL_DATA = {
 legalName: "ZM SOCIEDADE DE CREDITO DIRETO SA", tradeName: "ZM SCD",
 cnpj: "49.947.715/0001-45", city: "GO",
 address: "Q Rua Formosa, Quadra 1, Número 12, Lote GO, CEP 72.927-839",
 phone: "+55 (11) 3042-0181",
 email: "contato@oncreditsa.online",
 domain: "oncreditsa.online",
 siteUrl: "https://oncreditsa.online/",
 regulatoryStatement: "Esta página é destinada à simulação informativa e ao encaminhamento para atendimento. Não realiza contratação nem liberação de crédito dentro do site.",
};
// Parâmetros solicitados pelo responsável, iguais aos do simulador SANTS.
// Referência informativa; não importar taxas ou CET de outros produtos como oferta aprovada.
export const SIMULATOR_CONFIG = {
  PF: {
    label: "Pessoa Física",
    minAmount: 1000,
    maxAmount: 50000,
    step: 500,
    defaultAmount: 10000,
    presetSteps: [5000, 10000, 20000, 35000, 50000],
  },
  PJ: {
    label: "Pessoa Jurídica",
    minAmount: 5000,
    maxAmount: 100000,
    step: 1000,
    defaultAmount: 20000,
    presetSteps: [10000, 20000, 50000, 75000, 100000],
  },
};

// ============================================================================
// CONDIÇÕES FINANCEIRAS CENTRALIZADAS (CREDIT_CONFIG)
// - Taxa mensal de referência: 1,35% a.m. (0.0135)
// - Taxa anual equivalente aproximada: 17,46% a.a. (0.1746)
// - Prazo geral da operação: de 6 a 120 meses
// - Limites de valores: PF (R$ 1.000 a R$ 50.000) e PJ (R$ 5.000 a R$ 100.000)
// ============================================================================
export const CREDIT_CONFIG = {
  monthlyInterestFrom: 0.0135,
  annualEquivalentFrom: 0.1746,

  minimumTermMonths: 6,
  maximumTermMonths: 120,

  // Aliases de retrocompatibilidade com componentes existentes
  minTermMonths: 6,
  maxTermMonths: 120,
  cet: null as number | null,
  fees: null as string | null,

  pf: {
    minAmount: 1000,
    maxAmount: 50000,
  },

  pj: {
    minAmount: 5000,
    maxAmount: 100000,
  },
};

// ============================================================================
// REGRAS INTERNAS DO SIMULADOR (PARCELA MÍNIMA POR FAIXA DE VALOR)
// Utilizadas internamente para limitar dinamicamente o prazo máximo e evitar
// a exibição de prestações excessivamente baixas.
// Não são apresentadas como critérios ou exigências de aprovação ao usuário.
// ============================================================================
export interface InstallmentRule {
  minAmount: number;
  maxAmount: number;
  minimumPayment: number;
}

export const INSTALLMENT_RULES: InstallmentRule[] = [
  {
    minAmount: 1000,
    maxAmount: 1499.99,
    minimumPayment: 150,
  },
  {
    minAmount: 1500,
    maxAmount: 3000,
    minimumPayment: 200,
  },
  {
    minAmount: 3000.01,
    maxAmount: 9000,
    minimumPayment: 250,
  },
  {
    minAmount: 9000.01,
    maxAmount: 15000,
    minimumPayment: 350,
  },
  {
    minAmount: 15000.01,
    maxAmount: 30000,
    minimumPayment: 500,
  },
  {
    minAmount: 30000.01,
    maxAmount: 50000,
    minimumPayment: 700,
  },
  {
    minAmount: 50000.01,
    maxAmount: 75000,
    minimumPayment: 1000,
  },
  {
    minAmount: 75000.01,
    maxAmount: 100000,
    minimumPayment: 1500,
  },
];

/**
 * Retorna a regra de prestação mínima interna correspondente à faixa do valor principal.
 */
export function getInstallmentRule(principal: number): InstallmentRule {
  const found = INSTALLMENT_RULES.find(
    (rule) => principal >= rule.minAmount - 0.001 && principal <= rule.maxAmount + 0.001
  );
  if (found) return found;
  if (principal < 1000) return INSTALLMENT_RULES[0];
  return INSTALLMENT_RULES[INSTALLMENT_RULES.length - 1];
}

/**
 * Cálculo da prestação fixa (Sistema Price / PMT)
 * PMT = PV × i / (1 - (1 + i)^(-n))
 */
export function calculateMonthlyPayment(
  principal: number,
  months: number,
  monthlyRate: number = CREDIT_CONFIG.monthlyInterestFrom
): number {
  if (months <= 0 || principal <= 0) return 0;
  if (monthlyRate === 0) return principal / months;
  return (
    (principal * monthlyRate) /
    (1 - Math.pow(1 + monthlyRate, -months))
  );
}

/**
 * Calcula dinamicamente o maior prazo permitido (entre 6 e 120 meses)
 * em que calculateMonthlyPayment(valor, meses, taxa) seja maior ou igual
 * à parcela mínima configurada na faixa daquele valor.
 */
export function getMaximumAllowedTerm(
  principal: number,
  monthlyRate: number = CREDIT_CONFIG.monthlyInterestFrom
): number {
  const rule = getInstallmentRule(principal);
  let maximum = CREDIT_CONFIG.minimumTermMonths;

  for (let months = CREDIT_CONFIG.minimumTermMonths; months <= CREDIT_CONFIG.maximumTermMonths; months++) {
    const payment = calculateMonthlyPayment(principal, months, monthlyRate);
    // Tolerância de 1 centavo para imprecisão de ponto flutuante
    if (payment >= rule.minimumPayment - 0.01) {
      maximum = months;
    } else {
      break;
    }
  }

  // Nunca permitir mais que o máximo absoluto configurado
  return Math.min(maximum, CREDIT_CONFIG.maximumTermMonths);
}


export const REPRESENTATIVE_EXAMPLE_DATA = {
 amount: 10000, termMonths: 24,
 get installmentAmount(){return calculateMonthlyPayment(this.amount,this.termMonths)},
 get totalAmount(){return this.installmentAmount*this.termMonths},
};
export function getActiveContactEmail(){ return DEFAULT_CONTACT_EMAIL; }
export function getActiveWhatsAppNumber(){ return DEFAULT_WHATSAPP_NUMBER; }
export function formatCurrencyBRL(value:number, includeDecimals=false){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:includeDecimals?2:0,maximumFractionDigits:includeDecimals?2:0}).format(value)}
export function formatCurrencyExactBRL(value:number){return formatCurrencyBRL(value,true)}
