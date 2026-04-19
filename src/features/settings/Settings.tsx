/**
 * Settings Page — Company, Sync Panel, Invoice Config
 */

import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, writeWithSync } from '../../db/dexie';
import { useSyncStore } from '../../store/syncStore';
import { generateId, now } from '../../lib/uuid';
import { INDIAN_STATES } from '../../lib/constants';
import { isValidGSTIN, stateCodeFromGSTIN } from '../../lib/gst';
import { resolveConflict, getUnresolvedConflicts } from '../../sync/conflictResolver';
import type { Company, Conflict } from '../../lib/types';
import { format } from 'date-fns';
import {
  Building2, RefreshCw, Cloud, CloudOff, AlertTriangle, Trash2,
  Save, ArrowDownToLine, ArrowUpFromLine, CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';

type SettingsTab = 'company' | 'sync' | 'invoice';

export function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('company');

  const tabs: Array<{ id: SettingsTab; label: string; icon: React.ComponentType<any> }> = [
    { id: 'company', label: 'Company', icon: Building2 },
    { id: 'sync', label: 'Sync', icon: Cloud },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Tabs */}
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

      {activeTab === 'company' && <CompanySettings />}
      {activeTab === 'sync' && <SyncPanel />}
    </div>
  );
}

// ─── Company Settings ─────────────────────────────────
function CompanySettings() {
  const existing = useLiveQuery(() => db.companies.filter((c) => !c.deletedAt).first());

  const [form, setForm] = useState<Partial<Company>>({});
  const [initialized, setInitialized] = useState(false);

  // Sync form with loaded data
  React.useEffect(() => {
    if (existing && !initialized) {
      setForm(existing);
      setInitialized(true);
    }
  }, [existing, initialized]);

  const handleSave = async () => {
    if (!form.name?.trim()) { toast.error('Company name is required'); return; }
    if (form.gstin && !isValidGSTIN(form.gstin)) { toast.error('Invalid GSTIN'); return; }

    const timestamp = now();
    const company: Company = {
      id: existing?.id || form.id || generateId(),
      name: form.name!.trim(),
      address: form.address || '',
      gstin: form.gstin || '',
      stateCode: form.stateCode || '',
      phone: form.phone || '',
      email: form.email || '',
      bankName: form.bankName || '',
      bankAccount: form.bankAccount || '',
      bankIfsc: form.bankIfsc || '',
      logoBase64: form.logoBase64 || '',
      invoicePrefix: form.invoicePrefix || 'INV',
      invoiceNextNumber: form.invoiceNextNumber || 1,
      createdAt: existing?.createdAt || timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    };

    await writeWithSync(db.companies, existing ? 'update' : 'create', company, 'company');
    toast.success('Company settings saved');
  };

  return (
    <div className="card max-w-2xl">
      <div className="p-5 border-b border-surface-100">
        <h3 className="text-lg font-bold text-surface-800">Company Profile</h3>
        <p className="text-sm text-surface-400">Your business details for invoices</p>
      </div>

      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-surface-500 mb-1">Company Name *</label>
            <input type="text" value={form.name || ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="input" placeholder="Maestro Engineering Works" />
          </div>

          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1">GSTIN</label>
            <input type="text" value={form.gstin || ''}
              onChange={(e) => {
                const v = e.target.value.toUpperCase();
                setForm((f) => ({ ...f, gstin: v, stateCode: v.length >= 2 ? stateCodeFromGSTIN(v) : f.stateCode }));
              }}
              className="input font-mono uppercase" maxLength={15} />
          </div>

          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1">State</label>
            <select value={form.stateCode || ''} onChange={(e) => setForm((f) => ({ ...f, stateCode: e.target.value }))}
              className="input">
              <option value="">Select...</option>
              {Object.entries(INDIAN_STATES).map(([code, name]) => (
                <option key={code} value={code}>{code} - {name}</option>
              ))}
            </select>
          </div>

          <div className="col-span-2">
            <label className="block text-xs font-medium text-surface-500 mb-1">Address</label>
            <textarea value={form.address || ''} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              className="input resize-none" rows={2} />
          </div>

          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1">Phone</label>
            <input type="tel" value={form.phone || ''} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1">Email</label>
            <input type="email" value={form.email || ''} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="input" />
          </div>
        </div>

        <hr className="border-surface-100" />
        <h4 className="text-sm font-semibold text-surface-600">Bank Details</h4>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1">Bank Name</label>
            <input type="text" value={form.bankName || ''} onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))}
              className="input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1">Account No.</label>
            <input type="text" value={form.bankAccount || ''} onChange={(e) => setForm((f) => ({ ...f, bankAccount: e.target.value }))}
              className="input font-mono" />
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1">IFSC Code</label>
            <input type="text" value={form.bankIfsc || ''} onChange={(e) => setForm((f) => ({ ...f, bankIfsc: e.target.value.toUpperCase() }))}
              className="input font-mono uppercase" />
          </div>
        </div>

        <hr className="border-surface-100" />
        <h4 className="text-sm font-semibold text-surface-600">Invoice Settings</h4>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1">Invoice Prefix</label>
            <input type="text" value={form.invoicePrefix || 'INV'} onChange={(e) => setForm((f) => ({ ...f, invoicePrefix: e.target.value.toUpperCase() }))}
              className="input font-mono uppercase" maxLength={5} />
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1">Next Invoice Number</label>
            <input type="number" value={form.invoiceNextNumber || 1} onChange={(e) => setForm((f) => ({ ...f, invoiceNextNumber: parseInt(e.target.value) || 1 }))}
              className="input font-mono" min={1} />
          </div>
        </div>
      </div>

      <div className="flex justify-end p-5 border-t border-surface-100">
        <button onClick={handleSave} className="btn-primary">
          <Save className="w-4 h-4" /> Save Settings
        </button>
      </div>
    </div>
  );
}

// ─── Sync Panel ─────────────────────────────────────
function SyncPanel() {
  const { status, lastSyncAt, pendingCount, failedCount, conflictCount, isOnline,
    forcePush, forcePull, clearFailed, retryFailed } = useSyncStore();
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [showConflicts, setShowConflicts] = useState(false);

  const loadConflicts = async () => {
    const unresolved = await getUnresolvedConflicts();
    setConflicts(unresolved);
    setShowConflicts(true);
  };

  const handleResolve = async (id: number, choice: 'local' | 'remote') => {
    await resolveConflict(id, choice);
    toast.success(`Conflict resolved (${choice} version kept)`);
    loadConflicts();
  };

  const statusConfig = {
    idle: { label: 'Connected', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    syncing: { label: 'Syncing...', color: 'text-amber-400', bg: 'bg-amber-500/10' },
    error: { label: 'Error', color: 'text-red-400', bg: 'bg-red-500/10' },
    offline: { label: 'Offline', color: 'text-surface-400', bg: 'bg-surface-100' },
    disabled: { label: 'Cloud Disabled', color: 'text-surface-400', bg: 'bg-surface-100' },
  };

  const cfg = statusConfig[status] || statusConfig.idle;

  return (
    <div className="max-w-2xl space-y-4">
      {/* Status card */}
      <div className="card p-5">
        <div className="flex items-center gap-4 mb-4">
          <div className={`w-12 h-12 rounded-xl ${cfg.bg} flex items-center justify-center`}>
            {isOnline ? <Cloud className={`w-6 h-6 ${cfg.color}`} /> : <CloudOff className="w-6 h-6 text-surface-400" />}
          </div>
          <div>
            <p className={`font-semibold ${cfg.color}`}>{cfg.label}</p>
            <p className="text-xs text-surface-400">
              Last sync: {lastSyncAt ? format(lastSyncAt, 'dd MMM yyyy, HH:mm:ss') : 'Never'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-surface-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold font-mono text-surface-700">{pendingCount}</p>
            <p className="text-xxs text-surface-400 uppercase">Pending</p>
          </div>
          <div className="bg-surface-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold font-mono text-red-400">{failedCount}</p>
            <p className="text-xxs text-surface-400 uppercase">Failed</p>
          </div>
          <div className="bg-surface-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold font-mono text-amber-400">{conflictCount}</p>
            <p className="text-xxs text-surface-400 uppercase">Conflicts</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="card p-5">
        <h4 className="text-sm font-semibold text-surface-600 mb-3">Actions</h4>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={forcePush} disabled={!isOnline || status === 'syncing'} className="btn-secondary justify-start">
            <ArrowUpFromLine className="w-4 h-4" /> Force Push
          </button>
          <button onClick={forcePull} disabled={!isOnline || status === 'syncing'} className="btn-secondary justify-start">
            <ArrowDownToLine className="w-4 h-4" /> Force Pull
          </button>
          <button onClick={() => retryFailed()} disabled={failedCount === 0} className="btn-secondary justify-start">
            <RefreshCw className="w-4 h-4" /> Retry Failed
          </button>
          <button onClick={() => clearFailed()} disabled={failedCount === 0} className="btn-danger justify-start">
            <Trash2 className="w-4 h-4" /> Clear Failed
          </button>
        </div>
      </div>

      {/* Conflicts */}
      {conflictCount > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-surface-600 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Unresolved Conflicts ({conflictCount})
            </h4>
            <button onClick={loadConflicts} className="btn-ghost btn-xs">
              <RefreshCw className="w-3.5 h-3.5" /> Load
            </button>
          </div>

          {showConflicts && conflicts.map((c) => (
            <div key={c.id} className="border border-surface-200 rounded-lg p-3 mb-2">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="badge bg-amber-500/15 text-amber-400">{c.entityType}</span>
                  <span className="text-xs text-surface-400 ml-2">{c.conflictType}</span>
                </div>
                <span className="text-xxs text-surface-400">{format(c.createdAt, 'dd MMM HH:mm')}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleResolve(c.id!, 'local')} className="btn-secondary btn-xs flex-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Keep Local
                </button>
                <button onClick={() => handleResolve(c.id!, 'remote')} className="btn-secondary btn-xs flex-1">
                  <ArrowDownToLine className="w-3.5 h-3.5" /> Keep Remote
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
