export type CreditType = 'fgts' | 'consignado' | 'pessoal' | 'garantia_veiculo' | 'pj';

export interface CreditModality {
  id: CreditType;
  title: string;
  tagline: string;
  minAmount: number;
  maxAmount: number;
  stepAmount: number;
  defaultAmount: number;
  minMonths: number;
  maxMonths: number;
  defaultMonths: number;
  monthlyInterestRate: number; // e.g. 1.29 for 1.29%
  annualCet: number; // Custo Efetivo Total anual %
  badge: string;
  features: string[];
  audience: string;
  acceptsNegativado: boolean;
  pixReleaseTime: string;
}

export interface SimulationResult {
  amount: number;
  months: number;
  monthlyRate: number;
  monthlyPayment: number;
  totalPayment: number;
  totalInterest: number;
  annualCet: number;
  estimatedIof: number;
  creditCardComparisonTotal: number;
  estimatedSavings: number;
}

export interface ProposalApplicant {
  fullName: string;
  cpf: string;
  phone: string;
  email: string;
  birthDate: string;
  monthlyIncome: number;
  employmentType: 'clt' | 'consignado_inss' | 'servidor' | 'autonomo_mei' | 'empresario';
  isNegativado: boolean;
  pixKey: string;
}

export interface PartnerOffer {
  id: string;
  bankName: string;
  logoColor: string;
  monthlyRate: number;
  monthlyPayment: number;
  months: number;
  totalAmount: number;
  approvalProbability: 'Alta' | 'Média' | 'Garantida';
  recommended?: boolean;
}
