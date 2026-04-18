/**
 * Party Master — List + Form
 */

import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, writeWithSync } from '../../db/dexie';
import { generateId, now } from '../../lib/uuid';
import { isValidGSTIN, stateCodeFromGSTIN } from '../../lib/gst';
import { formatCurrency } from '../../lib/indian-number';
import { INDIAN_STATES, PARTY_TYPES } from '../../lib/constants';
import type { Party } from '../../lib/types';
import { Plus, Search, Users, Edit2, Trash2, X, Save } from 'lucide-react';
import toast from 'react-hot-toast';

function emptyParty(): Partial<Party> {
  return {
    name: '', gstin: null, address: '', stateCode: '',
    phone: '', email: '', balance: 0, partyType: 'customer',
  };
}

export function PartyList() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Party>>(emptyParty());
  const [gstinError, setGstinError] = useState('');

  const parties = useLiveQuery(() =>
    db.parties.filter((p) => !p.deletedAt).sortBy('name')
  ) || [];

  const filtered = useMemo(() => {
    return parties.filter((p) => {
      if (typeFilter !== 'all' && p.partyType !== typeFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return p.name.toLowerCase().includes(q) ||
          (p.gstin && p.gstin.includes(q)) ||
          p.phone.includes(q);
      }
      return true;
    });
  }, [parties, search, typeFilter]);

  const openNew = () => {
    setForm(emptyParty());
    setEditId(null);
    setGstinError('');
    setShowForm(true);
  };

  const openEdit = (p: Party) => {
    setForm({ ...p });
    setEditId(p.id);
    setGstinError('');
    setShowForm(true);
  };

  const handleGSTINChange = (value: string) => {
    const upper = value.toUpperCase();
    setForm((f) => ({ ...f, gstin: upper || null }));
    if (upper && upper.length === 15) {
      if (isValidGSTIN(upper)) {
        setGstinError('');
        setForm((f) => ({ ...f, gstin: upper, stateCode: stateCodeFromGSTIN(upper) }));
      } else {
        setGstinError('Invalid GSTIN format');
      }
    } else {
      setGstinError('');
    }
  };

  const handleSave = async () => {
    if (!form.name?.trim()) { toast.error('Name is required'); return; }
    if (form.gstin && !isValidGSTIN(form.gstin)) { toast.error('Invalid GSTIN'); return; }

    const timestamp = now();
    const party: Party = {
      id: editId || generateId(),
      name: form.name!.trim(),
      gstin: form.gstin || null,
      address: form.address || '',
      stateCode: form.stateCode || '',
      phone: form.phone || '',
      email: form.email || '',
      balance: form.balance || 0,
      partyType: (form.partyType as any) || 'customer',
      createdAt: editId ? (form as Party).createdAt || timestamp : timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    };

    await writeWithSync(db.parties, editId ? 'update' : 'create', party, 'party');
    toast.success(editId ? 'Party updated' : 'Party added');
    setShowForm(false);
  };

  const handleDelete = async (p: Party) => {
    if (!confirm(`Delete "${p.name}"?`)) return;
    const deleted = { ...p, deletedAt: now(), updatedAt: now() };
    await writeWithSync(db.parties, 'delete', deleted, 'party');
    toast.success('Party deleted');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search parties..." className="input pl-10"
          />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input w-auto">
          <option value="all">All Types</option>
          <option value="customer">Customers</option>
          <option value="supplier">Suppliers</option>
        </select>
        <button onClick={openNew} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Party
        </button>
      </div>

      {/* Table */}
      <div className="hidden md:block table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>GSTIN</th>
              <th>State</th>
              <th>Phone</th>
              <th>Type</th>
              <th className="text-right">Balance</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-surface-400">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  No parties found
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium text-surface-800">{p.name}</td>
                  <td className="font-mono text-xs text-surface-400">{p.gstin || '—'}</td>
                  <td className="text-surface-500 text-xs">
                    {p.stateCode ? `${p.stateCode} - ${INDIAN_STATES[p.stateCode] || ''}` : '—'}
                  </td>
                  <td className="text-surface-500">{p.phone || '—'}</td>
                  <td>
                    <span className={`badge ${p.partyType === 'customer' ? 'bg-blue-500/15 text-blue-400' : 'bg-purple-500/15 text-purple-400'}`}>
                      {p.partyType}
                    </span>
                  </td>
                  <td className="text-right font-mono text-sm">{formatCurrency(p.balance)}</td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(p)} className="btn-ghost btn-xs">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(p)} className="btn-ghost btn-xs text-red-400 hover:text-red-300">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden flex flex-col gap-3">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-surface-400 border border-surface-100 rounded-sm">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
            No parties found
          </div>
        ) : (
          filtered.map(p => (
            <div key={p.id} className="bg-surface-50 border border-surface-200 rounded-sm p-4 flex flex-col gap-2 relative">
               <div className="flex justify-between items-start">
                  <div>
                    <div className="font-display font-medium text-surface-900">{p.name}</div>
                    <div className="font-mono text-xs text-surface-400 mt-1">{p.gstin || 'B2C'} • {p.phone || 'No phone'}</div>
                  </div>
                  <span className={`badge ${p.partyType === 'customer' ? 'bg-blue-500/15 text-blue-400' : 'bg-purple-500/15 text-purple-400'}`}>
                      {p.partyType}
                  </span>
               </div>
               
               <div className="flex justify-between items-end mt-2 pt-2 border-t border-surface-200">
                 <div className="flex gap-2">
                    <button onClick={() => openEdit(p)} className="btn-ghost btn-xs text-surface-400">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(p)} className="btn-ghost btn-xs text-red-500 hover:text-red-400">
                      <Trash2 className="w-4 h-4" />
                    </button>
                 </div>
                 <div className="text-right">
                   <div className="text-surface-400 text-xs">Balance</div>
                   <div className="font-mono font-bold text-surface-800">{formatCurrency(p.balance)}</div>
                 </div>
               </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Form */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-surface-100">
              <h3 className="text-lg font-bold text-surface-800">
                {editId ? 'Edit Party' : 'Add Party'}
              </h3>
              <button onClick={() => setShowForm(false)} className="btn-ghost btn-xs">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-surface-500 mb-1">Name *</label>
                  <input type="text" value={form.name || ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="input" placeholder="Party name" autoFocus />
                </div>
                
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-surface-500 mb-1">GSTIN</label>
                  <input type="text" value={form.gstin || ''} onChange={(e) => handleGSTINChange(e.target.value)}
                    className={`input font-mono uppercase ${gstinError ? 'border-red-500' : ''}`} placeholder="22AAAAA0000A1Z5"
                    maxLength={15} />
                  {gstinError && <p className="text-red-400 text-xs mt-1">{gstinError}</p>}
                  {!form.gstin && <p className="text-surface-400 text-xs mt-1">Leave blank for B2C (unregistered)</p>}
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-surface-500 mb-1">Address</label>
                  <textarea value={form.address || ''} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                    className="input resize-none" rows={2} />
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

                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1">Type</label>
                  <select value={form.partyType || 'customer'} onChange={(e) => setForm((f) => ({ ...f, partyType: e.target.value as any }))}
                    className="input">
                    <option value="customer">Customer</option>
                    <option value="supplier">Supplier</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1">Phone</label>
                  <input type="tel" value={form.phone || ''} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className="input" placeholder="+91..." />
                </div>

                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1">Email</label>
                  <input type="email" value={form.email || ''} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="input" placeholder="email@example.com" />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 p-5 border-t border-surface-100">
              <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} className="btn-primary">
                <Save className="w-4 h-4" /> {editId ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
