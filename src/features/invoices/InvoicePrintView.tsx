import React, { useMemo } from 'react';
import type { Company, Party, VoucherItemFormRow } from '../../lib/types';
import { formatCurrency, formatIndianNumber } from '../../lib/indian-number';
import { amountToWords } from '../../lib/amount-words';

export interface InvoicePrintViewProps {
  printId?: string;
  company: Company | null;
  party: Party | null;
  voucherNumber: string;
  voucherDate: string;
  placeOfSupply: string;
  interState: boolean;
  items: VoucherItemFormRow[];
  totals: {
    subtotal: number;
    totalCgst: number;
    totalSgst: number;
    totalIgst: number;
    totalTax: number;
    roundOff: number;
    grandTotal: number;
  };
  amountInWords: string;
  notes: string;
  terms: string;
}

export function InvoicePrintView({
  printId = 'tally-print-view',
  company,
  party,
  voucherNumber,
  voucherDate,
  placeOfSupply,
  interState,
  items,
  totals,
  amountInWords,
  terms,
}: InvoicePrintViewProps) {

  // Filter valid items
  const validItems = useMemo(() => items.filter(i => i.quantity > 0 && i.rate > 0), [items]);

  // HSN Tax Breakdown aggregation
  const hsnSummary = useMemo(() => {
    const map = new Map<string, { taxable: number, cgstAmount: number, sgstAmount: number, igstAmount: number, cgstRate: number, sgstRate: number, igstRate: number, totalTax: number }>();
    validItems.forEach(i => {
      const hsn = i.hsnCode || 'VARIOUS';
      if (!map.has(hsn)) {
        map.set(hsn, { taxable: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, cgstRate: interState ? 0 : i.gstRate / 2, sgstRate: interState ? 0 : i.gstRate / 2, igstRate: interState ? i.gstRate : 0, totalTax: 0 });
      }
      const existing = map.get(hsn)!;
      existing.taxable += i.taxableAmount;
      existing.cgstAmount += i.cgstAmount;
      existing.sgstAmount += i.sgstAmount;
      existing.igstAmount += i.igstAmount;
      existing.totalTax += (i.cgstAmount + i.sgstAmount + i.igstAmount);
    });
    return Array.from(map.entries()).map(([hsn, data]) => ({ hsn, ...data }));
  }, [validItems, interState]);

  const dateObj = new Date(voucherDate);
  let displayDate = "-";
  if (!isNaN(dateObj.getTime())) {
    displayDate = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  // Tally ERP exact borders and font sizes require strong inline/tailwind setup
  // We use fixed 210mm width for A4. We ensure it's rendered outside normal document flow via parent.
  return (
    <div id={printId} style={{ fontFamily: 'Arial, Helvetica, sans-serif' }} className="bg-white text-black leading-snug w-[210mm] min-h-[297mm]">
      <div className="p-[10mm]">
        {/* Title */}
        <div className="text-center font-bold text-[16px] mb-1">
          TAX INVOICE
        </div>

        {/* Outer Layout Box */}
        <div className="border border-black flex flex-col text-[11px]">
          
          {/* Top Half */}
          <div className="flex border-b border-black min-h-[160px]">
            {/* Left side: Company & Buyer */}
            <div className="w-[50%] border-r border-black flex flex-col">
              {/* Company Box */}
              <div className="p-1 px-1.5 border-b border-black flex-1">
                <div className="font-bold text-[14px]">{company?.name || 'Company Name'}</div>
                <div className="text-[11px] leading-tight mt-0.5 whitespace-pre-line">{company?.address || 'Company Address'}</div>
                <div className="text-[11px] leading-tight mt-1">
                  {company?.phone && <span>Ph: {company.phone} </span>}
                  {company?.email && <span>Email: {company.email}</span>}
                </div>
                <div className="mt-1 text-[11px]">
                  {company?.gstin && <div><strong>GSTIN/UIN: </strong>{company.gstin}</div>}
                  {company?.stateCode && <div><strong>State Name: </strong>{company.stateCode}</div>}
                </div>
              </div>
              {/* Buyer Box */}
              <div className="p-1 px-1.5 flex-1">
                <div className="text-[10px] text-gray-800">Buyer (Bill to)</div>
                <div className="font-bold text-[14px]">{party?.name || 'Cash'}</div>
                {party?.address && <div className="text-[11px] leading-tight mt-0.5 whitespace-pre-line">{party.address}</div>}
                <div className="mt-1 text-[11px]">
                  {party?.gstin && <div><strong>GSTIN/UIN: </strong>{party.gstin}</div>}
                  {party?.stateCode && <div><strong>State Name: </strong>{party.stateCode}</div>}
                  {placeOfSupply && <div><strong>Place of Supply: </strong>{placeOfSupply}</div>}
                </div>
              </div>
            </div>

            {/* Right side: Invoice Meta 7-row Tally Standard */}
            <div className="w-[50%] flex flex-col">
              <div className="flex border-b border-black flex-1">
                <div className="w-[50%] p-1 px-1.5 border-r border-black">
                  <div className="text-[9px] text-gray-800">Invoice No.</div>
                  <div className="font-bold text-[12px]">{voucherNumber || 'Draft'}</div>
                </div>
                <div className="w-[50%] p-1 px-1.5">
                  <div className="text-[9px] text-gray-800">Dated</div>
                  <div className="font-bold text-[12px]">{displayDate}</div>
                </div>
              </div>
              <div className="flex border-b border-black flex-1">
                <div className="w-[50%] p-1 px-1.5 border-r border-black">
                  <div className="text-[9px] text-gray-800">Delivery Note</div>
                  <div className="text-[11px] font-semibold">-</div>
                </div>
                <div className="w-[50%] p-1 px-1.5">
                  <div className="text-[9px] text-gray-800">Mode/Terms of Payment</div>
                  <div className="text-[11px] font-semibold">-</div>
                </div>
              </div>
              <div className="flex border-b border-black flex-1">
                <div className="w-[50%] p-1 px-1.5 border-r border-black">
                  <div className="text-[9px] text-gray-800">Reference No. & Date.</div>
                  <div className="text-[11px] font-semibold">-</div>
                </div>
                <div className="w-[50%] p-1 px-1.5">
                  <div className="text-[9px] text-gray-800">Other Reference(s)</div>
                  <div className="text-[11px] font-semibold">-</div>
                </div>
              </div>
              <div className="flex border-b border-black flex-1">
                <div className="w-[50%] p-1 px-1.5 border-r border-black">
                  <div className="text-[9px] text-gray-800">Buyer's Order No.</div>
                  <div className="text-[11px] font-semibold">-</div>
                </div>
                <div className="w-[50%] p-1 px-1.5">
                  <div className="text-[9px] text-gray-800">Dated</div>
                  <div className="text-[11px] font-semibold">-</div>
                </div>
              </div>
              <div className="flex border-b border-black flex-1">
                <div className="w-[50%] p-1 px-1.5 border-r border-black">
                  <div className="text-[9px] text-gray-800">Dispatch Document No.</div>
                  <div className="text-[11px] font-semibold">-</div>
                </div>
                <div className="w-[50%] p-1 px-1.5">
                  <div className="text-[9px] text-gray-800">Delivery Note Date</div>
                  <div className="text-[11px] font-semibold">-</div>
                </div>
              </div>
              <div className="flex border-b border-black flex-1">
                <div className="w-[50%] p-1 px-1.5 border-r border-black">
                  <div className="text-[9px] text-gray-800">Dispatched through</div>
                  <div className="text-[11px] font-semibold">-</div>
                </div>
                <div className="w-[50%] p-1 px-1.5">
                  <div className="text-[9px] text-gray-800">Destination</div>
                  <div className="text-[11px] font-semibold">-</div>
                </div>
              </div>
              <div className="p-1 px-1.5 flex-[1.5]">
                <div className="text-[9px] text-gray-800">Terms of Delivery</div>
                <div className="text-[10px] uppercase leading-tight mt-0.5">{terms || '-'}</div>
              </div>
            </div>
          </div>

          {/* Middle Section: Items Table */}
          <div className="flex flex-col min-h-[350px] border-b border-black relative">
            {/* Table Header */}
            <div className="flex border-b border-black font-bold text-center items-stretch text-[11px] leading-tight">
              <div className="w-[5%] p-1 border-r border-black flex items-center justify-center">Sl<br/>No.</div>
              <div className="w-[40%] p-1 border-r border-black flex items-center justify-center">Description of Goods</div>
              <div className="w-[12%] p-1 border-r border-black flex items-center justify-center">HSN/SAC</div>
              <div className="w-[11%] p-1 border-r border-black flex items-center justify-center">Quantity</div>
              <div className="w-[9%] p-1 border-r border-black flex items-center justify-center">Rate</div>
              <div className="w-[6%] p-1 border-r border-black flex items-center justify-center">per</div>
              <div className="w-[17%] p-1 flex items-center justify-center">Amount</div>
            </div>
            
            {/* Table Body */}
            {validItems.map((item, index) => (
              <div key={item.id} className="flex text-[11px]">
                <div className="w-[5%] p-1 border-r border-transparent text-center">{index + 1}</div>
                <div className="w-[40%] p-1 border-r border-transparent font-bold">
                  {item.itemName}
                  {item.description && item.description !== item.itemName && (
                     <div className="font-normal italic text-[10px] text-gray-700">{item.description}</div>
                  )}
                </div>
                <div className="w-[12%] p-1 border-r border-transparent text-center">{item.hsnCode}</div>
                <div className="w-[11%] p-1 border-r border-transparent text-right">
                  <span className="font-bold">{item.quantity}</span> {item.unit}
                </div>
                <div className="w-[9%] p-1 border-r border-transparent text-right">{item.rate.toFixed(2)}</div>
                <div className="w-[6%] p-1 border-r border-transparent text-center">{item.unit}</div>
                <div className="w-[17%] p-1 text-right font-bold pr-1.5">{formatIndianNumber(item.taxableAmount)}</div>
              </div>
            ))}

            {/* SPACER */}
            <div className="flex text-[11px] py-[4px]">
               <div className="w-[5%] p-1 border-r border-transparent"></div>
               <div className="w-[40%] p-1 border-r border-transparent"></div>
               <div className="w-[12%] border-r border-transparent"></div>
               <div className="w-[11%] border-r border-transparent"></div>
               <div className="w-[9%] border-r border-transparent"></div>
               <div className="w-[6%] border-r border-transparent"></div>
               <div className="w-[17%] p-1"></div>
            </div>

            {/* Taxes inside the Item Grid */}
            {interState ? (
              <div className="flex text-[11px]">
                <div className="w-[5%] p-1 border-r border-transparent"></div>
                <div className="w-[40%] p-1 border-r border-transparent font-bold flex justify-end">OUTPUT IGST</div>
                <div className="w-[12%] border-r border-transparent"></div>
                <div className="w-[11%] border-r border-transparent text-right"></div>
                <div className="w-[9%] border-r border-transparent"></div>
                <div className="w-[6%] border-r border-transparent"></div>
                <div className="w-[17%] p-1 text-right font-bold pr-1.5">{formatIndianNumber(totals.totalIgst)}</div>
              </div>
            ) : (
               <>
                 <div className="flex text-[11px]">
                  <div className="w-[5%] p-1 border-r border-transparent"></div>
                  <div className="w-[40%] p-1 border-r border-transparent font-bold flex justify-end">OUTPUT CGST</div>
                  <div className="w-[12%] border-r border-transparent"></div>
                  <div className="w-[11%] border-r border-transparent text-right"></div>
                  <div className="w-[9%] border-r border-transparent"></div>
                  <div className="w-[6%] border-r border-transparent"></div>
                  <div className="w-[17%] p-1 text-right font-bold pr-1.5">{formatIndianNumber(totals.totalCgst)}</div>
                </div>
                <div className="flex text-[11px]">
                  <div className="w-[5%] p-1 border-r border-transparent"></div>
                  <div className="w-[40%] p-1 border-r border-transparent font-bold flex justify-end">OUTPUT SGST</div>
                  <div className="w-[12%] border-r border-transparent"></div>
                  <div className="w-[11%] border-r border-transparent text-right"></div>
                  <div className="w-[9%] border-r border-transparent"></div>
                  <div className="w-[6%] border-r border-transparent"></div>
                  <div className="w-[17%] p-1 text-right font-bold pr-1.5">{formatIndianNumber(totals.totalSgst)}</div>
                </div>
               </>
            )}

            {totals.roundOff !== 0 && (
              <div className="flex text-[11px]">
                <div className="w-[5%] border-r border-transparent"></div>
                <div className="w-[40%] p-1 border-r border-transparent font-bold flex justify-end">Round Off</div>
                <div className="w-[12%] border-r border-transparent"></div>
                <div className="w-[11%] border-r border-transparent"></div>
                <div className="w-[9%] border-r border-transparent"></div>
                <div className="w-[6%] border-r border-transparent"></div>
                <div className="w-[17%] p-1 text-right font-bold pr-1.5">
                  {totals.roundOff > 0 ? '+' : ''}{totals.roundOff.toFixed(2)}
                </div>
              </div>
            )}

            <div className="flex-1"></div>

            {/* Vertical grid lines overlay for the body */}
            <div className="absolute top-[31px] bottom-[22px] left-0 right-0 pointer-events-none flex">
              <div className="w-[5%] border-r border-black h-full"></div>
              <div className="w-[40%] border-r border-black h-full"></div>
              <div className="w-[12%] border-r border-black h-full"></div>
              <div className="w-[11%] border-r border-black h-full"></div>
              <div className="w-[9%] border-r border-black h-full"></div>
              <div className="w-[6%] border-r border-black h-full"></div>
              <div className="w-[17%] h-full"></div>
            </div>

            {/* Subtotal Row inside main grid */}
            <div className="flex border-t border-black font-bold items-center">
               <div className="w-[5%] border-r border-black h-[22px]"></div>
               <div className="w-[40%] p-1 border-r border-black text-right italic pt-[4px]">Total</div>
               <div className="w-[12%] border-r border-black h-[22px]"></div>
               <div className="w-[11%] p-1 border-r border-black text-right whitespace-nowrap pt-[4px]" style={{ fontSize: '10px' }}>
                 {validItems.reduce((acc, item) => acc + item.quantity, 0)} Nos
               </div>
               <div className="w-[9%] border-r border-black h-[22px]"></div>
               <div className="w-[6%] border-r border-black h-[22px]"></div>
               <div className="w-[17%] p-1 text-right pr-1.5 pt-[4px] text-[12px]">{formatCurrency(totals.grandTotal)}</div>
            </div>
          </div>

          {/* Amount In Words with E&O.E block */}
          <div className="flex border-b border-black">
             <div className="w-[80%] p-1.5 flex flex-col justify-end">
               <div className="text-[10px] text-gray-800">Amount Chargeable (in words)</div>
               <div className="font-bold text-[12px] mt-1 space-x-1">
                 <span>INR</span><span>{amountInWords} Only</span>
               </div>
             </div>
             <div className="w-[20%] p-1.5 text-right flex flex-col justify-end">
                <div className="italic font-bold text-[11px]">E. & O.E</div>
             </div>
          </div>

          {/* HSN Summary Table */}
          <div className="flex flex-col border-b border-black">
            {/* Header Row */}
            <div className="flex border-b border-black font-bold text-center bg-transparent text-[10px] items-stretch min-h-[30px]">
               <div className="w-[20%] p-1 border-r border-black flex items-center justify-center">HSN/SAC</div>
               <div className="w-[20%] p-1 border-r border-black flex items-center justify-center">Taxable Value</div>
               {!interState && <><div className="w-[20%] border-r border-black flex flex-col">
                 <div className="border-b border-black p-0.5">Central Tax</div>
                 <div className="flex flex-1"><div className="w-1/2 border-r border-black p-0.5 flex items-center justify-center">Rate</div><div className="w-1/2 p-0.5 flex items-center justify-center">Amount</div></div>
               </div>
               <div className="w-[20%] border-r border-black flex flex-col">
                 <div className="border-b border-black p-0.5">State Tax</div>
                 <div className="flex flex-1"><div className="w-1/2 border-r border-black p-0.5 flex items-center justify-center">Rate</div><div className="w-1/2 p-0.5 flex items-center justify-center">Amount</div></div>
               </div></>}
               {interState && <div className="w-[40%] border-r border-black flex flex-col">
                 <div className="border-b border-black p-0.5">Integrated Tax</div>
                 <div className="flex flex-1"><div className="w-1/2 border-r border-black p-0.5 flex items-center justify-center">Rate</div><div className="w-1/2 p-0.5 flex items-center justify-center">Amount</div></div>
               </div>}
               <div className="w-[20%] p-1 flex items-center justify-center">Total Tax Amount</div>
            </div>
            
            {/* Body Rows */}
            {hsnSummary.map(row => (
              <div key={row.hsn} className="flex text-right text-[11px]">
                <div className="w-[20%] p-1 border-r border-black text-center">{row.hsn}</div>
                <div className="w-[20%] p-1 border-r border-black">{formatIndianNumber(row.taxable)}</div>
                {!interState && <>
                  <div className="w-[10%] p-1 border-r border-black">{row.cgstRate}%</div>
                  <div className="w-[10%] p-1 border-r border-black">{formatIndianNumber(row.cgstAmount)}</div>
                  <div className="w-[10%] p-1 border-r border-black">{row.sgstRate}%</div>
                  <div className="w-[10%] p-1 border-r border-black">{formatIndianNumber(row.sgstAmount)}</div>
                </>}
                {interState && <>
                  <div className="w-[20%] p-1 border-r border-black">{row.igstRate}%</div>
                  <div className="w-[20%] p-1 border-r border-black">{formatIndianNumber(row.igstAmount)}</div>
                </>}
                <div className="w-[20%] p-1">{formatIndianNumber(row.totalTax)}</div>
              </div>
            ))}

            {/* Total Row */}
            <div className="flex border-t border-black font-bold text-right text-[11px]">
               <div className="w-[20%] p-1 border-r border-black">Total</div>
               <div className="w-[20%] p-1 border-r border-black">{formatIndianNumber(hsnSummary.reduce((a, b) => a + b.taxable, 0))}</div>
               {!interState && <>
                  <div className="w-[10%] border-r border-black bg-gray-100/50"></div>
                  <div className="w-[10%] p-1 border-r border-black">{formatIndianNumber(totals.totalCgst)}</div>
                  <div className="w-[10%] border-r border-black bg-gray-100/50"></div>
                  <div className="w-[10%] p-1 border-r border-black">{formatIndianNumber(totals.totalSgst)}</div>
               </>}
               {interState && <>
                  <div className="w-[20%] border-r border-black bg-gray-100/50"></div>
                  <div className="w-[20%] p-1 border-r border-black">{formatIndianNumber(totals.totalIgst)}</div>
               </>}
               <div className="w-[20%] p-1">{formatIndianNumber(totals.totalTax)}</div>
            </div>
          </div>

          {/* Tax Amount In Words */}
          <div className="p-1 px-1.5 border-b border-black">
            <div className="text-[10px] text-gray-800">Tax Amount (in words) : &nbsp; <strong>INR {amountToWords(totals.totalTax)} Only</strong></div>
          </div>

          {/* Footer Bottom Block */}
          <div className="flex min-h-[140px]">
             {/* Left - Bank Details & Declaration */}
             <div className="w-1/2 border-r border-black flex flex-col pt-1 relative">
                {company?.bankAccount && <div className="border-b border-black px-1.5 pb-1">
                  <div className="font-bold italic text-[11px] mb-0.5">Company's Bank Details</div>
                  <div className="flex text-[11px]"><div className="w-[120px]">Bank Name</div><div>: <strong>{company.bankName}</strong></div></div>
                  <div className="flex text-[11px]"><div className="w-[120px]">A/c No.</div><div>: <strong>{company.bankAccount}</strong></div></div>
                  <div className="flex text-[11px]"><div className="w-[120px]">Branch & IFS Code</div><div>: <strong>{company.bankIfsc}</strong></div></div>
                </div>}

                <div className="px-1.5 pt-1">
                  <div className="font-bold underline text-[11px] mb-0.5">Declaration</div>
                  <div className="text-[11px] leading-tight pr-4">
                    We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
                  </div>
                </div>
                 
                {company?.gstin && <div className="absolute bottom-1 left-1.5 text-[11px]">
                   Company's PAN : <strong>{company.gstin.substring(2, 12)}</strong>
                </div>}
             </div>

             {/* Right - Signature */}
             <div className="w-1/2 flex flex-col">
                <div className="text-right p-1.5 flex-col flex h-full">
                  <div className="font-bold text-[12px]">for {company?.name || 'Company Name'}</div>
                  <div className="mt-auto text-[11px] font-semibold pr-2 pb-1">Authorised Signatory</div>
                </div>
             </div>
          </div>

        </div>
        <div className="text-center w-full text-[9px] mt-1 text-gray-500 font-mono">
          SUBJECT TO LOCAL JURISDICTION
        </div>
      </div>
    </div>
  );
}
