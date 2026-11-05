/**
 * Format numbers into Brazilian Real currency string
 */
export function formatBRL(value: number, showCents: boolean = true): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  }).format(value);
}

/**
 * Format percentage with Brazilian standard comma
 */
export function formatPercent(value: number, decimals: number = 2): string {
  return `${value.toFixed(decimals).replace('.', ',')}%`;
}

/**
 * Calculate PMT (Prestação / Parcela mensal) using standard amortization formula
 */
export function calculatePMT(principal: number, monthlyRatePercent: number, months: number): number {
  if (months <= 0) return 0;
  if (monthlyRatePercent <= 0) return principal / months;

  const r = monthlyRatePercent / 100;
  const numerator = principal * (r * Math.pow(1 + r, months));
  const denominator = Math.pow(1 + r, months) - 1;
  return numerator / denominator;
}

/**
 * Apply CPF mask: 000.000.000-00
 */
export function maskCPF(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

/**
 * Strict Brazilian CPF verification algorithm (checking both verification digits)
 */
export function validateCPF(cpf: string): boolean {
  const cleanCPF = cpf.replace(/\D/g, '');
  if (cleanCPF.length !== 11) return false;

  // Block identical sequences (00000000000, 11111111111, etc.)
  if (/^(\d)\1{10}$/.test(cleanCPF)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCPF.charAt(i), 10) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(cleanCPF.charAt(9), 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCPF.charAt(i), 10) * (11 - i);
  }
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(cleanCPF.charAt(10), 10)) return false;

  return true;
}

/**
 * Apply Phone mask: (00) 00000-0000
 */
export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return digits
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
}

/**
 * Calculate IOF (Imposto sobre Operações Financeiras) estimate
 */
export function estimateIOF(principal: number, months: number): number {
  // Brazilian IOF: 0.38% flat + 0.0082% per day (capped at 365 days / ~3.0%)
  const flat = principal * 0.0038;
  const days = Math.min(months * 30, 365);
  const daily = principal * (0.000082 * days);
  return flat + daily;
}
