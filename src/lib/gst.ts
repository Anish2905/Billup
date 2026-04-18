/**
 * GST Calculation Engine
 * All tax calculations happen at the line-item level — never on totals.
 * Discount is applied BEFORE tax.
 */

export interface GSTResult {
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  totalAmount: number;
}

export interface InvoiceTotals {
  subtotal: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalTax: number;
  totalBeforeRound: number;
  roundOff: number;
  grandTotal: number;
}

/** Round to 2 decimal places (financial rounding) */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Calculate GST for a single line item
 * @param qty       Quantity (must be > 0)
 * @param rate      Price per unit
 * @param discountPercent  Discount percentage (0–100)
 * @param gstRate   Total GST rate (e.g. 18 for 18%)
 * @param isInterState  true → IGST, false → CGST+SGST
 */
export function calculateLineGST(
  qty: number,
  rate: number,
  discountPercent: number,
  gstRate: number,
  isInterState: boolean
): GSTResult {
  const baseAmount = qty * rate;
  const discountAmount = baseAmount * (discountPercent / 100);
  const taxableAmount = round2(baseAmount - discountAmount);
  const totalTaxAmount = round2(taxableAmount * (gstRate / 100));

  if (isInterState) {
    return {
      taxableAmount,
      cgst: 0,
      sgst: 0,
      igst: totalTaxAmount,
      totalTax: totalTaxAmount,
      totalAmount: round2(taxableAmount + totalTaxAmount),
    };
  }

  const halfTax = round2(totalTaxAmount / 2);
  // Handle odd penny: ensure cgst + sgst === totalTax
  const cgst = halfTax;
  const sgst = round2(totalTaxAmount - halfTax);

  return {
    taxableAmount,
    cgst,
    sgst,
    igst: 0,
    totalTax: round2(cgst + sgst),
    totalAmount: round2(taxableAmount + cgst + sgst),
  };
}

/**
 * Calculate invoice totals from an array of line-item GST results
 */
export function calculateInvoiceTotals(lineItems: GSTResult[]): InvoiceTotals {
  const subtotal = round2(lineItems.reduce((sum, li) => sum + li.taxableAmount, 0));
  const totalCgst = round2(lineItems.reduce((sum, li) => sum + li.cgst, 0));
  const totalSgst = round2(lineItems.reduce((sum, li) => sum + li.sgst, 0));
  const totalIgst = round2(lineItems.reduce((sum, li) => sum + li.igst, 0));
  const totalTax = round2(totalCgst + totalSgst + totalIgst);
  const totalBeforeRound = round2(subtotal + totalTax);
  const grandTotal = Math.round(totalBeforeRound);
  const roundOff = round2(grandTotal - totalBeforeRound);

  // Clamp round-off to ±0.99
  const clampedRoundOff = Math.abs(roundOff) <= 0.99 ? roundOff : 0;
  const finalGrandTotal = clampedRoundOff !== 0
    ? round2(totalBeforeRound + clampedRoundOff)
    : totalBeforeRound;

  return {
    subtotal,
    totalCgst,
    totalSgst,
    totalIgst,
    totalTax,
    totalBeforeRound,
    roundOff: clampedRoundOff,
    grandTotal: finalGrandTotal,
  };
}

/**
 * Determine if a transaction is inter-state
 * Based on comparing company state code with party/place-of-supply state code
 */
export function isInterState(companyStateCode: string, placeOfSupplyCode: string): boolean {
  return companyStateCode !== placeOfSupplyCode;
}

/**
 * Extract state code from GSTIN (first 2 characters)
 */
export function stateCodeFromGSTIN(gstin: string): string {
  return gstin.slice(0, 2);
}

/**
 * Validate GSTIN format (basic 15-character pattern)
 */
export function isValidGSTIN(gstin: string): boolean {
  if (!gstin || gstin.length !== 15) return false;
  const pattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return pattern.test(gstin.toUpperCase());
}

/**
 * Generate HSN summary from line items (grouped by HSN code)
 */
export interface HSNSummaryRow {
  hsnCode: string;
  description: string;
  quantity: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
}

export function generateHSNSummary(
  items: Array<{
    hsnCode: string;
    description: string;
    quantity: number;
    gstResult: GSTResult;
  }>
): HSNSummaryRow[] {
  const map = new Map<string, HSNSummaryRow>();

  for (const item of items) {
    const key = item.hsnCode || 'N/A';
    const existing = map.get(key);

    if (existing) {
      existing.quantity = round2(existing.quantity + item.quantity);
      existing.taxableAmount = round2(existing.taxableAmount + item.gstResult.taxableAmount);
      existing.cgst = round2(existing.cgst + item.gstResult.cgst);
      existing.sgst = round2(existing.sgst + item.gstResult.sgst);
      existing.igst = round2(existing.igst + item.gstResult.igst);
      existing.totalTax = round2(existing.totalTax + item.gstResult.totalTax);
    } else {
      map.set(key, {
        hsnCode: key,
        description: item.description,
        quantity: item.quantity,
        taxableAmount: item.gstResult.taxableAmount,
        cgst: item.gstResult.cgst,
        sgst: item.gstResult.sgst,
        igst: item.gstResult.igst,
        totalTax: item.gstResult.totalTax,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.hsnCode.localeCompare(b.hsnCode));
}
