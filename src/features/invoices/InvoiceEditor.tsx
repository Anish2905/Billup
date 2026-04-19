/**
 * Invoice Editor — Core feature
 * Tally-inspired layout with GST computation, typeahead, keyboard shortcuts
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, writeWithSync } from '../../db/dexie';
import { generateId, now } from '../../lib/uuid';
import { calculateLineGST, calculateInvoiceTotals, isInterState as checkInterState } from '../../lib/gst';
import { formatCurrency, formatIndianNumber } from '../../lib/indian-number';
import { amountToWords } from '../../lib/amount-words';
import { getCurrentFinancialYear, INDIAN_STATES, GST_RATES } from '../../lib/constants';
import type { Voucher, VoucherItem, Party, Item, VoucherItemFormRow } from '../../lib/types';
import {
  Plus, Trash2, Save, CheckCircle2, X, Search, Download
} from 'lucide-react';
import toast from 'react-hot-toast';
import { exportToPDF } from '../../lib/pdf';
import { InvoicePrintView } from './InvoicePrintView';

// ─── Typeahead Hook ─────────────────────────────────
function useTypeahead<T>(
  searchFn: (query: string) => Promise<T[]>,
  delay = 200
) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<T[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      const data = await searchFn(query);
      setResults(data);
      setIsOpen(data.length > 0);
    }, delay);
    return () => clearTimeout(timeoutRef.current);
  }, [query, searchFn, delay]);

  return { query, setQuery, results, isOpen, setIsOpen };
}

// ─── Empty line item ────────────────────────────────
function createEmptyRow(): VoucherItemFormRow {
  return {
    id: generateId(),
    itemId: '',
    itemName: '',
    description: '',
    hsnCode: '',
    quantity: 0,
    unit: 'NOS',
    rate: 0,
    discountPercent: 0,
    gstRate: 18,
    taxableAmount: 0,
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount: 0,
    totalAmount: 0,
  };
}

export function InvoiceEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';

  // ─── Load data from IndexedDB ───
  const company = useLiveQuery(() =>
    db.companies.filter((c) => !c.deletedAt).first()
  );
  const allParties = useLiveQuery(() =>
    db.parties.filter((p) => !p.deletedAt).toArray()
  ) || [];
  const allItems = useLiveQuery(() =>
    db.items.filter((i) => !i.deletedAt).toArray()
  ) || [];

  // ─── State ───
  const [partyId, setPartyId] = useState('');
  const [partySearch, setPartySearch] = useState('');
  const [showPartyDropdown, setShowPartyDropdown] = useState(false);
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [placeOfSupply, setPlaceOfSupply] = useState('');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [status, setStatus] = useState<'draft' | 'confirmed' | 'cancelled'>('draft');
  const [items, setItems] = useState<VoucherItemFormRow[]>([createEmptyRow()]);
  const [voucherNumber, setVoucherNumber] = useState('');
  const [voucherId] = useState(id && id !== 'new' ? id : generateId());

  // ─── Active item search per row ───
  const [activeRow, setActiveRow] = useState<number | null>(null);
  const [itemSearch, setItemSearch] = useState('');
  const [showItemDropdown, setShowItemDropdown] = useState(false);

  // ─── Load existing voucher ───
  useEffect(() => {
    if (!isNew && id) {
      (async () => {
        const voucher = await db.vouchers.get(id);
        if (voucher) {
          setPartyId(voucher.partyId);
          setVoucherDate(new Date(voucher.voucherDate).toISOString().slice(0, 10));
          setDueDate(voucher.dueDate ? new Date(voucher.dueDate).toISOString().slice(0, 10) : '');
          setPlaceOfSupply(voucher.placeOfSupply);
          setNotes(voucher.notes);
          setTerms(voucher.terms);
          setStatus(voucher.status as any);
          setVoucherNumber(voucher.voucherNumber);

          // Load party name
          const party = allParties.find((p) => p.id === voucher.partyId);
          if (party) setPartySearch(party.name);

          // Load line items
          const vi = await db.voucherItems
            .where('voucherId').equals(id)
            .and((item) => !item.deletedAt)
            .sortBy('sortOrder');
          
          if (vi.length > 0) {
            const rows: VoucherItemFormRow[] = vi.map((v) => {
              const matchedItem = allItems.find((i) => i.id === v.itemId);
              return {
                id: v.id,
                itemId: v.itemId,
                itemName: matchedItem?.name || v.description,
                description: v.description,
                hsnCode: v.hsnCode,
                quantity: v.quantity,
                unit: v.unit,
                rate: v.rate,
                discountPercent: v.discountPercent,
                gstRate: v.gstRate,
                taxableAmount: v.taxableAmount,
                cgstAmount: v.cgstAmount,
                sgstAmount: v.sgstAmount,
                igstAmount: v.igstAmount,
                totalAmount: v.totalAmount,
              };
            });
            setItems(rows);
          }
        }
      })();
    }
  }, [isNew, id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Generate voucher number for new invoices ───
  useEffect(() => {
    if (isNew && company && !voucherNumber) {
      const prefix = company.invoicePrefix || 'INV';
      const fy = getCurrentFinancialYear();
      const num = String(company.invoiceNextNumber || 1).padStart(4, '0');
      setVoucherNumber(`${prefix}-${fy}-${num}`);
    }
  }, [isNew, company, voucherNumber]);

  // ─── Determine inter-state ───
  const interState = useMemo(() => {
    if (!company?.stateCode || !placeOfSupply) return false;
    return checkInterState(company.stateCode, placeOfSupply);
  }, [company?.stateCode, placeOfSupply]);

  // ─── Auto-set place of supply from party ───
  useEffect(() => {
    if (partyId && !placeOfSupply) {
      const party = allParties.find((p) => p.id === partyId);
      if (party?.stateCode) {
        setPlaceOfSupply(party.stateCode);
      }
    }
  }, [partyId, allParties, placeOfSupply]);

  // ─── Recalculate line items when inter-state changes ───
  const recalculatedItems = useMemo(() => {
    return items.map((item) => {
      if (item.quantity <= 0 || item.rate <= 0) {
        return { ...item, taxableAmount: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, totalAmount: 0 };
      }
      const gst = calculateLineGST(item.quantity, item.rate, item.discountPercent, item.gstRate, interState);
      return {
        ...item,
        taxableAmount: gst.taxableAmount,
        cgstAmount: gst.cgst,
        sgstAmount: gst.sgst,
        igstAmount: gst.igst,
        totalAmount: gst.totalAmount,
      };
    });
  }, [items, interState]);

  // ─── Invoice totals ───
  const totals = useMemo(() => {
    const gstResults = recalculatedItems
      .filter((item) => item.quantity > 0 && item.rate > 0)
      .map((item) => ({
        taxableAmount: item.taxableAmount,
        cgst: item.cgstAmount,
        sgst: item.sgstAmount,
        igst: item.igstAmount,
        totalTax: item.cgstAmount + item.sgstAmount + item.igstAmount,
        totalAmount: item.totalAmount,
      }));
    return calculateInvoiceTotals(gstResults);
  }, [recalculatedItems]);

  const amtWords = useMemo(() => amountToWords(totals.grandTotal), [totals.grandTotal]);

  // ─── Party search ───
  const filteredParties = useMemo(() => {
    if (!partySearch.trim()) return allParties.slice(0, 10);
    const q = partySearch.toLowerCase();
    return allParties.filter((p) =>
      p.name.toLowerCase().includes(q) || (p.gstin && p.gstin.includes(q))
    ).slice(0, 10);
  }, [partySearch, allParties]);

  // ─── Item search for active row ───
  const filteredItems = useMemo(() => {
    if (!itemSearch.trim()) return allItems.slice(0, 10);
    const q = itemSearch.toLowerCase();
    return allItems.filter((i) =>
      i.name.toLowerCase().includes(q) || i.hsnCode.includes(q)
    ).slice(0, 10);
  }, [itemSearch, allItems]);

  // ─── Row actions ───
  const updateRow = (index: number, field: keyof VoucherItemFormRow, value: any) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addRow = () => {
    setItems((prev) => [...prev, createEmptyRow()]);
  };

  const removeRow = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const selectItemForRow = (index: number, item: Item) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        itemId: item.id,
        itemName: item.name,
        description: item.name,
        hsnCode: item.hsnCode,
        unit: item.unit,
        rate: item.defaultPrice,
        gstRate: item.gstRate,
        quantity: next[index].quantity || 1,
      };
      return next;
    });
    setShowItemDropdown(false);
    setItemSearch('');
  };

  const selectParty = (party: Party) => {
    setPartyId(party.id);
    setPartySearch(party.name);
    if (party.stateCode) setPlaceOfSupply(party.stateCode);
    setShowPartyDropdown(false);
  };

  // ─── Save ───
  const saveVoucher = async (saveStatus: 'draft' | 'confirmed') => {
    // Validation
    if (!partyId) { toast.error('Please select a party'); return; }
    const validItems = recalculatedItems.filter((i) => i.quantity > 0 && i.rate > 0);
    if (validItems.length === 0) { toast.error('Add at least one line item'); return; }
    if (validItems.some((i) => i.quantity === 0)) { toast.error('Quantity cannot be zero'); return; }

    const timestamp = now();
    const voucherData: Voucher = {
      id: voucherId,
      voucherNumber,
      voucherType: 'invoice',
      partyId,
      companyId: company?.id || '',
      voucherDate: new Date(voucherDate).getTime(),
      dueDate: dueDate ? new Date(dueDate).getTime() : null,
      placeOfSupply,
      isInterState: interState ? 1 : 0,
      subtotal: totals.subtotal,
      totalCgst: totals.totalCgst,
      totalSgst: totals.totalSgst,
      totalIgst: totals.totalIgst,
      totalTax: totals.totalTax,
      discountAmount: 0,
      roundOff: totals.roundOff,
      grandTotal: totals.grandTotal,
      amountInWords: amtWords,
      notes,
      terms,
      status: saveStatus,
      createdAt: isNew ? timestamp : timestamp, // will be preserved on update via put
      updatedAt: timestamp,
      deletedAt: null,
    };

    await writeWithSync(db.vouchers, isNew ? 'create' : 'update', voucherData, 'voucher');

    // Save line items
    for (let i = 0; i < validItems.length; i++) {
      const row = validItems[i];
      const viData: VoucherItem = {
        id: row.id,
        voucherId: voucherId,
        itemId: row.itemId,
        description: row.description || row.itemName,
        hsnCode: row.hsnCode,
        quantity: row.quantity,
        unit: row.unit,
        rate: row.rate,
        discountPercent: row.discountPercent,
        taxableAmount: row.taxableAmount,
        gstRate: row.gstRate,
        cgstAmount: row.cgstAmount,
        sgstAmount: row.sgstAmount,
        igstAmount: row.igstAmount,
        totalAmount: row.totalAmount,
        sortOrder: i,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
      };
      await writeWithSync(db.voucherItems, isNew ? 'create' : 'update', viData, 'voucher_item');
    }

    // Increment invoice number if new
    if (isNew && company) {
      const updatedCompany = {
        ...company,
        invoiceNextNumber: (company.invoiceNextNumber || 1) + 1,
        updatedAt: timestamp,
      };
      await writeWithSync(db.companies, 'update', updatedCompany, 'company');
    }

    toast.success(saveStatus === 'confirmed' ? 'Invoice confirmed!' : 'Draft saved');
    navigate('/invoices');
  };

  // ─── Keyboard shortcuts ───
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        saveVoucher('confirmed');
      } else if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        saveVoucher('draft');
      } else if (e.ctrlKey && e.key === 'p') {
        e.preventDefault();
        window.print();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }); // intentionally no deps — uses latest closure

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-surface-800 font-mono">
            {voucherNumber || 'New Invoice'}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <span className={`badge ${
              status === 'confirmed' ? 'badge-confirmed' : 
              status === 'cancelled' ? 'badge-cancelled' : 'badge-draft'
            }`}>
              {status}
            </span>
            {interState && (
              <span className="badge bg-blue-500/15 text-blue-400">IGST</span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => navigate('/invoices')} className="btn-ghost btn-sm">
            <X className="w-4 h-4" /> Cancel
          </button>
          
          <button 
            onClick={() => exportToPDF('tally-print-view', voucherNumber || 'Invoice')} 
            className="btn-ghost btn-sm text-surface-400 hover:text-brand-400"
          >
            <Download className="w-4 h-4" /> Export PDF
          </button>

          <button onClick={() => saveVoucher('draft')} className="btn-secondary btn-sm">
            <Save className="w-4 h-4" /> Draft
            <kbd className="kbd ml-1">Ctrl+S</kbd>
          </button>
          <button onClick={() => saveVoucher('confirmed')} className="btn-primary btn-sm">
            <CheckCircle2 className="w-4 h-4" /> Confirm
            <kbd className="kbd ml-1">Ctrl+⇧+S</kbd>
          </button>
        </div>
      </div>

      {/* Invoice Meta */}
      <div className="card p-5 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Party */}
          <div className="md:col-span-2 relative">
            <label className="block text-xs font-medium text-surface-500 mb-1">Bill To</label>
            <div className="relative">
              <input
                type="text"
                value={partySearch}
                onChange={(e) => { setPartySearch(e.target.value); setShowPartyDropdown(true); }}
                onFocus={() => setShowPartyDropdown(true)}
                placeholder="Search party..."
                className="input"
              />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
            </div>
            {showPartyDropdown && filteredParties.length > 0 && (
              <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-surface-50 border border-surface-200 rounded-lg shadow-xl max-h-48 overflow-auto">
                {filteredParties.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => selectParty(p)}
                    className="w-full px-3 py-2 text-left hover:bg-surface-100 text-sm flex justify-between"
                  >
                    <span className="text-surface-800">{p.name}</span>
                    <span className="text-surface-400 text-xs font-mono">{p.gstin || 'B2C'}</span>
                  </button>
                ))}
              </div>
            )}
            {partyId && (
              <div className="text-xs text-surface-400 mt-1">
                GSTIN: {allParties.find((p) => p.id === partyId)?.gstin || 'Unregistered (B2C)'}
              </div>
            )}
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1">Date</label>
            <input
              type="date"
              value={voucherDate}
              onChange={(e) => setVoucherDate(e.target.value)}
              className="input"
            />
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="input"
            />
          </div>

          {/* Place of Supply */}
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-surface-500 mb-1">Place of Supply</label>
            <select
              value={placeOfSupply}
              onChange={(e) => setPlaceOfSupply(e.target.value)}
              className="input"
            >
              <option value="">Select state...</option>
              {Object.entries(INDIAN_STATES).map(([code, name]) => (
                <option key={code} value={code}>{code} - {name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Line Items Table */}
      <div className="card overflow-hidden mb-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-50 border-b border-surface-100">
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-surface-500 w-8">#</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-surface-500 min-w-[200px]">Item</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-surface-500 w-24">HSN</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-surface-500 w-20">Qty</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-surface-500 w-16">Unit</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-surface-500 w-28">Rate</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-surface-500 w-16">Disc%</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-surface-500 w-28">Taxable</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-surface-500 w-16">GST%</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-surface-500 w-28">Total</th>
                <th className="px-3 py-2.5 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {recalculatedItems.map((row, idx) => (
                <tr key={row.id} className="border-b border-surface-100/50 hover:bg-surface-50/30">
                  <td className="px-3 py-1.5 text-surface-400 text-xs">{idx + 1}</td>
                  
                  {/* Item name with typeahead */}
                  <td className="px-3 py-1.5 relative">
                    <input
                      type="text"
                      value={activeRow === idx ? itemSearch : row.itemName}
                      onChange={(e) => {
                        setActiveRow(idx);
                        setItemSearch(e.target.value);
                        updateRow(idx, 'itemName', e.target.value);
                        setShowItemDropdown(true);
                      }}
                      onFocus={() => {
                        setActiveRow(idx);
                        setItemSearch(row.itemName);
                        setShowItemDropdown(true);
                      }}
                      onBlur={() => setTimeout(() => setShowItemDropdown(false), 200)}
                      placeholder="Type to search..."
                      className="w-full bg-transparent border-0 p-0 text-sm text-surface-800 
                                 focus:outline-none focus:ring-0 placeholder:text-surface-300"
                    />
                    {showItemDropdown && activeRow === idx && filteredItems.length > 0 && (
                      <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-surface-50 border border-surface-200 rounded-lg shadow-xl max-h-40 overflow-auto">
                        {filteredItems.map((item) => (
                          <button
                            key={item.id}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => selectItemForRow(idx, item)}
                            className="w-full px-3 py-2 text-left hover:bg-surface-100 text-sm flex justify-between"
                          >
                            <span className="text-surface-800">{item.name}</span>
                            <span className="text-surface-400 text-xs font-mono">
                              {item.hsnCode} • {item.gstRate}%
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </td>

                  <td className="px-3 py-1.5">
                    <input
                      type="text"
                      value={row.hsnCode}
                      onChange={(e) => updateRow(idx, 'hsnCode', e.target.value)}
                      className="w-full bg-transparent border-0 p-0 text-sm text-surface-600 font-mono focus:outline-none focus:ring-0"
                    />
                  </td>

                  <td className="px-3 py-1.5">
                    <input
                      type="number"
                      value={row.quantity || ''}
                      onChange={(e) => updateRow(idx, 'quantity', parseFloat(e.target.value) || 0)}
                      min="0"
                      step="1"
                      className="w-full bg-transparent border-0 p-0 text-sm text-right font-mono text-surface-800 focus:outline-none focus:ring-0"
                    />
                  </td>

                  <td className="px-3 py-1.5 text-surface-400 text-xs">{row.unit}</td>

                  <td className="px-3 py-1.5">
                    <input
                      type="number"
                      value={row.rate || ''}
                      onChange={(e) => updateRow(idx, 'rate', parseFloat(e.target.value) || 0)}
                      min="0"
                      step="0.01"
                      className="w-full bg-transparent border-0 p-0 text-sm text-right font-mono text-surface-800 focus:outline-none focus:ring-0"
                    />
                  </td>

                  <td className="px-3 py-1.5">
                    <input
                      type="number"
                      value={row.discountPercent || ''}
                      onChange={(e) => updateRow(idx, 'discountPercent', parseFloat(e.target.value) || 0)}
                      min="0"
                      max="100"
                      step="0.5"
                      className="w-full bg-transparent border-0 p-0 text-sm text-right font-mono text-surface-600 focus:outline-none focus:ring-0"
                    />
                  </td>

                  <td className="px-3 py-1.5 text-right font-mono text-sm text-surface-600">
                    {formatIndianNumber(row.taxableAmount)}
                  </td>

                  <td className="px-3 py-1.5">
                    <select
                      value={row.gstRate}
                      onChange={(e) => updateRow(idx, 'gstRate', parseFloat(e.target.value))}
                      className="bg-transparent border-0 p-0 text-sm text-right font-mono text-surface-600 focus:outline-none focus:ring-0"
                    >
                      {GST_RATES.map((r) => (
                        <option key={r} value={r}>{r}%</option>
                      ))}
                    </select>
                  </td>

                  <td className="px-3 py-1.5 text-right font-mono text-sm font-medium text-surface-800">
                    {formatIndianNumber(row.totalAmount)}
                  </td>

                  <td className="px-3 py-1.5">
                    {items.length > 1 && (
                      <button
                        onClick={() => removeRow(idx)}
                        className="p-1 rounded hover:bg-red-500/10 text-surface-300 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add row button */}
        <button
          onClick={addRow}
          className="w-full px-4 py-2.5 text-sm text-surface-400 hover:text-brand-400 
                     hover:bg-brand-500/5 transition-colors flex items-center justify-center gap-1.5
                     border-t border-surface-100/50"
        >
          <Plus className="w-4 h-4" /> Add Line Item
        </button>
      </div>

      {/* Totals & Footer */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Notes */}
        <div className="card p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="input resize-none"
              placeholder="Internal notes..."
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1">Terms</label>
            <textarea
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              rows={2}
              className="input resize-none"
              placeholder="Payment terms..."
            />
          </div>
        </div>

        {/* Totals summary */}
        <div className="card p-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-surface-500">
              <span>Subtotal</span>
              <span className="font-mono">{formatCurrency(totals.subtotal)}</span>
            </div>

            {interState ? (
              <div className="flex justify-between text-surface-500">
                <span>IGST</span>
                <span className="font-mono">{formatCurrency(totals.totalIgst)}</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between text-surface-500">
                  <span>CGST</span>
                  <span className="font-mono">{formatCurrency(totals.totalCgst)}</span>
                </div>
                <div className="flex justify-between text-surface-500">
                  <span>SGST</span>
                  <span className="font-mono">{formatCurrency(totals.totalSgst)}</span>
                </div>
              </>
            )}

            {totals.roundOff !== 0 && (
              <div className="flex justify-between text-surface-400 text-xs">
                <span>Round Off</span>
                <span className="font-mono">
                  {totals.roundOff > 0 ? '+' : ''}{formatIndianNumber(totals.roundOff)}
                </span>
              </div>
            )}

            <div className="border-t border-surface-100 pt-2 mt-2">
              <div className="flex justify-between font-bold text-lg text-surface-900">
                <span>Total</span>
                <span className="font-mono">{formatCurrency(totals.grandTotal)}</span>
              </div>
            </div>
            
            <p className="text-xs text-surface-400 italic pt-1">
              {amtWords}
            </p>
          </div>
        </div>
      </div>

      <div className="absolute top-0 left-0 -z-50 opacity-0 pointer-events-none">
        <InvoicePrintView 
          company={company || null}
          party={allParties.find((p) => p.id === partyId) || null}
          voucherNumber={voucherNumber}
          voucherDate={voucherDate}
          placeOfSupply={placeOfSupply}
          interState={interState}
          items={recalculatedItems}
          totals={totals}
          amountInWords={amtWords}
          notes={notes}
          terms={terms}
        />
      </div>
    </div>
  );
}
