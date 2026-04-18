/**
 * Amount to words converter (Indian English)
 * Converts numeric amount to: "Rupees Twelve Lakh Thirty-Four Thousand ... Paise Eighty-Nine Only"
 */

const ones = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];

const tens = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety',
];

function twoDigitWords(n: number): string {
  if (n < 20) return ones[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return tens[t] + (o ? '-' + ones[o] : '');
}

function threeDigitWords(n: number): string {
  if (n === 0) return '';
  if (n < 100) return twoDigitWords(n);
  const h = Math.floor(n / 100);
  const rem = n % 100;
  return ones[h] + ' Hundred' + (rem ? ' and ' + twoDigitWords(rem) : '');
}

/**
 * Convert an integer to Indian-style words
 * Uses: Crore, Lakh, Thousand grouping
 */
function integerToWords(n: number): string {
  if (n === 0) return 'Zero';
  if (n < 0) return 'Minus ' + integerToWords(-n);

  let result = '';
  
  // Crores (groups of 2 digits above lakhs)
  const crores = Math.floor(n / 10_000_000);
  if (crores > 0) {
    result += threeDigitWords(crores) + ' Crore ';
    n %= 10_000_000;
  }

  // Lakhs (2 digits)
  const lakhs = Math.floor(n / 100_000);
  if (lakhs > 0) {
    result += twoDigitWords(lakhs) + ' Lakh ';
    n %= 100_000;
  }

  // Thousands (2 digits in Indian system)
  const thousands = Math.floor(n / 1_000);
  if (thousands > 0) {
    result += twoDigitWords(thousands) + ' Thousand ';
    n %= 1_000;
  }

  // Hundreds and below
  if (n > 0) {
    result += threeDigitWords(n);
  }

  return result.trim();
}

/**
 * Convert amount to Indian English words for invoice
 * Example: 1234567.89 → "Rupees Twelve Lakh Thirty-Four Thousand Five Hundred and Sixty-Seven Paise Eighty-Nine Only"
 */
export function amountToWords(amount: number): string {
  if (amount === 0) return 'Rupees Zero Only';
  
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  
  const rupees = Math.floor(absAmount);
  const paise = Math.round((absAmount - rupees) * 100);

  let result = isNegative ? 'Minus ' : '';
  
  if (rupees > 0) {
    result += 'Rupees ' + integerToWords(rupees);
  } else {
    result += 'Rupees Zero';
  }

  if (paise > 0) {
    result += ' and Paise ' + integerToWords(paise);
  }

  result += ' Only';

  return result;
}
