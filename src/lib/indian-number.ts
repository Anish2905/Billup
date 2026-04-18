/**
 * Indian number formatting
 * Uses Intl.NumberFormat with en-IN locale for lakhs/crores grouping
 */

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const wholeNumberFormatter = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * Format amount as Indian currency: ₹1,23,456.78
 */
export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}

/**
 * Format number with Indian grouping: 1,23,456.78
 */
export function formatIndianNumber(amount: number): string {
  return numberFormatter.format(amount);
}

/**
 * Format number with Indian grouping, no decimals: 1,23,457
 */
export function formatWholeNumber(amount: number): string {
  return wholeNumberFormatter.format(amount);
}

/**
 * Format compact Indian number: 1.23L, 4.56Cr
 */
export function formatCompact(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';

  if (abs >= 10_000_000) {
    return `${sign}${(abs / 10_000_000).toFixed(2)}Cr`;
  }
  if (abs >= 100_000) {
    return `${sign}${(abs / 100_000).toFixed(2)}L`;
  }
  if (abs >= 1_000) {
    return `${sign}${(abs / 1_000).toFixed(1)}K`;
  }
  return formatCurrency(amount);
}
