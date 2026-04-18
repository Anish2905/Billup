/**
 * Reports Hub — Sales Register, GSTR-1 Summary, Ledger, P&L
 * All data sourced from IndexedDB (offline-capable)
 */

import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/dexie';
import { formatCurrency, formatIndianNumber } from '../../lib/indian-number';
import { INDIAN_STATES } from '../../lib/constants';
import { useSyncStore } from '../../store/syncStore';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { BarChart3, AlertTriangle, Calendar, FileSpreadsheet, BookOpen, TrendingUp } from 'lucide-react';

type ReportTab = 'sales' | 'gstr1' | 'ledger' | 'pnl';

export function Reports() {
  const [activeTab, setActiveTab] = useState<ReportTab>('sales');
  const { isOnline, lastSyncAt } = useSyncStore();
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [partyFilter, setPartyFilter] = useState('');

  const vouchers = useLiveQuery(() =>
    db.vouchers.filter((v) => !v.deletedAt && v.status === 'confirmed').toArray()
  ) || [];

  const parties = useLiveQuery(() =>
    db.parties.filter((p) => !p.deletedAt).toArray()
  ) || [];

  const voucherItems = useLiveQuery(() =>
    db.voucherItems.filter((vi) => !vi.deletedAt).toArray()
  ) || [];

  const partyMap = useMemo(() => {
    const m = new Map<string, string>();
    parties.forEach((p) => m.set(p.id, p.name));
    return m;
  }, [parties]);

  const partyGstinMap = useMemo(() => {
    const m = new Map<string, string | null>();
    parties.forEach((p) => m.set(p.id, p.gstin));
    return m;
  }, [parties]);

  const filteredVouchers = useMemo(() => {
    const from = new Date(dateFrom).getTime();
    const to = new Date(dateTo).getTime() + 86400000; // end of day
    return vouchers.filter((v) => {
      if (v.voucherDate < from || v.voucherDate >= to) return false;
      if (partyFilter && v.partyId !== partyFilter) return false;
      return true;
    });
  }, [vouchers, dateFrom, dateTo, partyFilter]);

  const tabs: Array<{ id: ReportTab; label: string; icon: React.ComponentType<any> }> = [
    { id: 'sales', label: 'Sales Register', icon: FileSpreadsheet },
    { id: 'gstr1', label: 'GSTR-1', icon: BarChart3 },
    { id: 'ledger', label: 'Ledger', icon: BookOpen },
    { id: 'pnl', label: 'P&L', icon: TrendingUp },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Offline warning */}
      {!isOnline && (
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Data may be outdated — last synced {lastSyncAt
            ? format(lastSyncAt, 'dd MMM yyyy HH:mm')
            : 'never'
          }</span>
        </div>
      )}

      {/* Tab navigation */}
      <div className="flex gap-1 bg-surface-50 rounded-xl p-1 border border-surface-100">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${activeTab === id
                ? 'bg-surface-0 text-surface-800 shadow-sm'
                : 'text-surface-400 hover:text-surface-600'
              }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Date filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-surface-400" />
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="input-sm w-auto" />
          <span className="text-surface-400">to</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="input-sm w-auto" />
        </div>
        {activeTab === 'ledger' && (
          <select value={partyFilter} onChange={(e) => setPartyFilter(e.target.value)} className="input-sm w-auto">
            <option value="">All Parties</option>
            {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>

      {/* Report content */}
      {activeTab === 'sales' && (
        <SalesRegister vouchers={filteredVouchers} partyMap={partyMap} />
      )}
      {activeTab === 'gstr1' && (
        <GSTR1Summary vouchers={filteredVouchers} partyGstinMap={partyGstinMap} partyMap={partyMap} />
      )}
      {activeTab === 'ledger' && (
        <Ledger vouchers={filteredVouchers} partyMap={partyMap} />
      )}
      {activeTab === 'pnl' && (
        <ProfitLoss vouchers={filteredVouchers} />
      )}
    </div>
  );
}

// ─── Sales Register ─────────────────────────────────
function SalesRegister({ vouchers, partyMap }: {
  vouchers: any[];
  partyMap: Map<string, string>;
}) {
  const totals = useMemo(() => ({
    taxable: vouchers.reduce((s, v) => s + v.subtotal, 0),
    cgst: vouchers.reduce((s, v) => s + v.totalCgst, 0),
    sgst: vouchers.reduce((s, v) => s + v.totalSgst, 0),
    igst: vouchers.reduce((s, v) => s + v.totalIgst, 0),
    total: vouchers.reduce((s, v) => s + v.grandTotal, 0),
  }), [vouchers]);

  return (
    <div className="table-container">
      <table className="table">
        <thead>
          <tr>
            <th>Invoice #</th>
            <th>Date</th>
            <th>Party</th>
            <th className="text-right">Taxable</th>
            <th className="text-right">CGST</th>
            <th className="text-right">SGST</th>
            <th className="text-right">IGST</th>
            <th className="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {vouchers.map((v) => (
            <tr key={v.id}>
              <td className="font-mono text-sm">{v.voucherNumber}</td>
              <td className="text-surface-500">{format(v.voucherDate, 'dd/MM/yyyy')}</td>
              <td className="font-medium">{partyMap.get(v.partyId) || '—'}</td>
              <td className="text-right font-mono">{formatIndianNumber(v.subtotal)}</td>
              <td className="text-right font-mono">{formatIndianNumber(v.totalCgst)}</td>
              <td className="text-right font-mono">{formatIndianNumber(v.totalSgst)}</td>
              <td className="text-right font-mono">{formatIndianNumber(v.totalIgst)}</td>
              <td className="text-right font-mono font-semibold">{formatCurrency(v.grandTotal)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-surface-50 font-semibold">
            <td colSpan={3} className="px-4 py-3">Total ({vouchers.length} invoices)</td>
            <td className="text-right px-4 py-3 font-mono">{formatIndianNumber(totals.taxable)}</td>
            <td className="text-right px-4 py-3 font-mono">{formatIndianNumber(totals.cgst)}</td>
            <td className="text-right px-4 py-3 font-mono">{formatIndianNumber(totals.sgst)}</td>
            <td className="text-right px-4 py-3 font-mono">{formatIndianNumber(totals.igst)}</td>
            <td className="text-right px-4 py-3 font-mono">{formatCurrency(totals.total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── GSTR-1 Summary ─────────────────────────────────
function GSTR1Summary({ vouchers, partyGstinMap, partyMap }: {
  vouchers: any[];
  partyGstinMap: Map<string, string | null>;
  partyMap: Map<string, string>;
}) {
  const { b2b, b2c } = useMemo(() => {
    const b2b = vouchers.filter((v) => partyGstinMap.get(v.partyId));
    const b2c = vouchers.filter((v) => !partyGstinMap.get(v.partyId));
    return { b2b, b2c };
  }, [vouchers, partyGstinMap]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-4">
          <p className="text-xs text-surface-400 uppercase font-medium">B2B (Registered)</p>
          <p className="text-2xl font-bold font-mono text-surface-800 mt-1">{b2b.length}</p>
          <p className="text-sm font-mono text-surface-500 mt-1">
            {formatCurrency(b2b.reduce((s, v) => s + v.grandTotal, 0))}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-surface-400 uppercase font-medium">B2C (Unregistered)</p>
          <p className="text-2xl font-bold font-mono text-surface-800 mt-1">{b2c.length}</p>
          <p className="text-sm font-mono text-surface-500 mt-1">
            {formatCurrency(b2c.reduce((s, v) => s + v.grandTotal, 0))}
          </p>
        </div>
      </div>

      <h3 className="text-sm font-semibold text-surface-600">B2B Invoices</h3>
      <div className="table-container">
        <table className="table">
          <thead><tr>
            <th>GSTIN</th><th>Party</th><th>Invoices</th><th className="text-right">Taxable Value</th><th className="text-right">Tax</th>
          </tr></thead>
          <tbody>
            {b2b.map((v) => (
              <tr key={v.id}>
                <td className="font-mono text-xs">{partyGstinMap.get(v.partyId)}</td>
                <td>{partyMap.get(v.partyId)}</td>
                <td className="font-mono text-xs">{v.voucherNumber}</td>
                <td className="text-right font-mono">{formatIndianNumber(v.subtotal)}</td>
                <td className="text-right font-mono">{formatIndianNumber(v.totalTax)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Ledger ─────────────────────────────────────────
function Ledger({ vouchers, partyMap }: {
  vouchers: any[];
  partyMap: Map<string, string>;
}) {
  const ledger = useMemo(() => {
    let balance = 0;
    return vouchers
      .sort((a, b) => a.voucherDate - b.voucherDate)
      .map((v) => {
        balance += v.grandTotal;
        return { ...v, runningBalance: balance };
      });
  }, [vouchers]);

  return (
    <div className="table-container">
      <table className="table">
        <thead><tr>
          <th>Date</th><th>Invoice #</th><th>Party</th>
          <th className="text-right">Debit</th><th className="text-right">Balance</th>
        </tr></thead>
        <tbody>
          {ledger.map((v) => (
            <tr key={v.id}>
              <td className="text-surface-500">{format(v.voucherDate, 'dd/MM/yyyy')}</td>
              <td className="font-mono text-sm">{v.voucherNumber}</td>
              <td>{partyMap.get(v.partyId)}</td>
              <td className="text-right font-mono">{formatCurrency(v.grandTotal)}</td>
              <td className="text-right font-mono font-semibold">{formatCurrency(v.runningBalance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── P&L (Basic) ────────────────────────────────────
function ProfitLoss({ vouchers }: { vouchers: any[] }) {
  const stats = useMemo(() => {
    const revenue = vouchers.reduce((s, v) => s + v.subtotal, 0);
    const taxCollected = vouchers.reduce((s, v) => s + v.totalTax, 0);
    return { revenue, taxCollected, grossIncome: revenue };
  }, [vouchers]);

  return (
    <div className="max-w-md">
      <div className="card divide-y divide-surface-100">
        <div className="p-4 flex justify-between">
          <span className="text-surface-500">Revenue (Taxable)</span>
          <span className="font-mono font-semibold text-emerald-400">{formatCurrency(stats.revenue)}</span>
        </div>
        <div className="p-4 flex justify-between">
          <span className="text-surface-500">Tax Collected</span>
          <span className="font-mono text-surface-400">{formatCurrency(stats.taxCollected)}</span>
        </div>
        <div className="p-4 flex justify-between bg-surface-50 font-bold">
          <span className="text-surface-700">Gross Income</span>
          <span className="font-mono text-surface-800">{formatCurrency(stats.grossIncome)}</span>
        </div>
      </div>
      <p className="text-xs text-surface-400 mt-3 italic">
        * Basic P&L from confirmed invoices only. For detailed accounting, export to Tally.
      </p>
    </div>
  );
}
