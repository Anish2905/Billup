/**
 * Invoice List
 * Dense table with sticky headers, status badges, filters
 */

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/dexie';
import { formatCurrency } from '../../lib/indian-number';
import { format } from 'date-fns';
import { Plus, Search, FileText, Printer, Eye } from 'lucide-react';
import type { Voucher, Party } from '../../lib/types';

export function InvoiceList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const vouchers = useLiveQuery(() =>
    db.vouchers
      .filter((v) => !v.deletedAt)
      .reverse()
      .sortBy('voucherDate')
  ) || [];

  const parties = useLiveQuery(() =>
    db.parties.filter((p) => !p.deletedAt).toArray()
  ) || [];

  const partyMap = useMemo(() => {
    const map = new Map<string, Party>();
    parties.forEach((p) => map.set(p.id, p));
    return map;
  }, [parties]);

  const filtered = useMemo(() => {
    return vouchers.filter((v) => {
      if (statusFilter !== 'all' && v.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const party = partyMap.get(v.partyId);
        return (
          v.voucherNumber.toLowerCase().includes(q) ||
          party?.name.toLowerCase().includes(q) ||
          false
        );
      }
      return true;
    });
  }, [vouchers, search, statusFilter, partyMap]);

  // Summary stats
  const stats = useMemo(() => {
    const confirmed = vouchers.filter((v) => v.status === 'confirmed');
    return {
      total: vouchers.length,
      totalAmount: confirmed.reduce((sum, v) => sum + v.grandTotal, 0),
      draft: vouchers.filter((v) => v.status === 'draft').length,
      confirmed: confirmed.length,
    };
  }, [vouchers]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Invoices', value: stats.total, color: 'text-surface-700' },
          { label: 'Revenue', value: formatCurrency(stats.totalAmount), color: 'text-emerald-400' },
          { label: 'Confirmed', value: stats.confirmed, color: 'text-emerald-400' },
          { label: 'Drafts', value: stats.draft, color: 'text-amber-400' },
        ].map((stat) => (
          <div key={stat.label} className="card p-4">
            <p className="text-xxs text-surface-400 uppercase tracking-wide font-medium">{stat.label}</p>
            <p className={`text-lg font-bold font-mono mt-1 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoices..."
            className="input pl-10"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input w-auto"
        >
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <button onClick={() => navigate('/invoices/new')} className="btn-primary">
          <Plus className="w-4 h-4" /> New Invoice
        </button>
      </div>

      {/* Table */}
      <div className="hidden md:block table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Date</th>
              <th>Party</th>
              <th>GSTIN</th>
              <th className="text-right">Amount</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-surface-400">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  {vouchers.length === 0
                    ? 'No invoices yet. Create your first one!'
                    : 'No invoices match your filters'}
                </td>
              </tr>
            ) : (
              filtered.map((v) => {
                const party = partyMap.get(v.partyId);
                return (
                  <tr key={v.id} className="cursor-pointer" onClick={() => navigate(`/invoices/${v.id}`)}>
                    <td className="font-mono font-medium text-surface-800">{v.voucherNumber}</td>
                    <td className="text-surface-500">{format(new Date(v.voucherDate), 'dd MMM yyyy')}</td>
                    <td className="font-medium text-surface-700">{party?.name || '—'}</td>
                    <td className="font-mono text-surface-400 text-xs">{party?.gstin || 'B2C'}</td>
                    <td className="text-right font-mono font-semibold text-surface-800">
                      {formatCurrency(v.grandTotal)}
                    </td>
                    <td>
                      <span className={`badge ${
                        v.status === 'confirmed' ? 'badge-confirmed' :
                        v.status === 'cancelled' ? 'badge-cancelled' : 'badge-draft'
                      }`}>
                        {v.status}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => navigate(`/invoices/${v.id}`)}
                          className="btn-ghost btn-xs"
                          title="View / Edit"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden flex flex-col gap-3">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-surface-400 border border-surface-100 rounded-sm">
             <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
             {vouchers.length === 0
               ? 'No invoices yet. Create your first one!'
               : 'No invoices match your filters'}
          </div>
        ) : (
          filtered.map((v) => {
            const party = partyMap.get(v.partyId);
            return (
              <div 
                key={v.id} 
                onClick={() => navigate(`/invoices/${v.id}`)} 
                className="bg-surface-50 border border-surface-200 rounded-sm p-4 flex flex-col gap-3 active:bg-surface-100"
              >
                 <div className="flex justify-between items-center border-b border-surface-200 pb-2">
                   <span className="font-mono font-medium text-surface-900">{v.voucherNumber}</span>
                   <span className={`badge ${
                        v.status === 'confirmed' ? 'badge-confirmed' :
                        v.status === 'cancelled' ? 'badge-cancelled' : 'badge-draft'
                      }`}>
                     {v.status}
                   </span>
                 </div>
                 <div className="flex justify-between items-end">
                   <div>
                     <div className="font-display font-medium text-surface-800">{party?.name || 'Cash'}</div>
                     <div className="text-surface-500 text-xs mt-0.5">{format(new Date(v.voucherDate), 'dd MMM yyyy')}</div>
                   </div>
                   <div className="text-right font-mono font-bold text-base text-brand-500">
                     {formatCurrency(v.grandTotal)}
                   </div>
                 </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
