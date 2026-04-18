/**
 * Item Master — List + Form
 */

import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, writeWithSync } from '../../db/dexie';
import { generateId, now } from '../../lib/uuid';
import { formatCurrency } from '../../lib/indian-number';
import { GST_RATES, UNITS } from '../../lib/constants';
import type { Item } from '../../lib/types';
import { Plus, Search, Package, Edit2, Trash2, X, Save } from 'lucide-react';
import toast from 'react-hot-toast';

function emptyItem(): Partial<Item> {
  return {
    name: '', hsnCode: '', unit: 'NOS', gstRate: 18,
    defaultPrice: 0, description: '',
  };
}

export function ItemList() {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Item>>(emptyItem());

  const items = useLiveQuery(() =>
    db.items.filter((i) => !i.deletedAt).sortBy('name')
  ) || [];

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((i) =>
      i.name.toLowerCase().includes(q) || i.hsnCode.includes(q)
    );
  }, [items, search]);

  const openNew = () => { setForm(emptyItem()); setEditId(null); setShowForm(true); };
  const openEdit = (item: Item) => { setForm({ ...item }); setEditId(item.id); setShowForm(true); };

  const handleSave = async () => {
    if (!form.name?.trim()) { toast.error('Name is required'); return; }

    const timestamp = now();
    const item: Item = {
      id: editId || generateId(),
      name: form.name!.trim(),
      hsnCode: form.hsnCode || '',
      unit: form.unit || 'NOS',
      gstRate: form.gstRate ?? 18,
      defaultPrice: form.defaultPrice || 0,
      description: form.description || '',
      createdAt: editId ? (form as Item).createdAt || timestamp : timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    };

    await writeWithSync(db.items, editId ? 'update' : 'create', item, 'item');
    toast.success(editId ? 'Item updated' : 'Item added');
    setShowForm(false);
  };

  const handleDelete = async (item: Item) => {
    if (!confirm(`Delete "${item.name}"?`)) return;
    const deleted = { ...item, deletedAt: now(), updatedAt: now() };
    await writeWithSync(db.items, 'delete', deleted, 'item');
    toast.success('Item deleted');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items or HSN..." className="input pl-10" />
        </div>
        <button onClick={openNew} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Item
        </button>
      </div>

      {/* Table */}
      <div className="hidden md:block table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>HSN Code</th>
              <th>Unit</th>
              <th>GST Rate</th>
              <th className="text-right">Default Price</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-surface-400">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  No items found
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr key={item.id}>
                  <td className="font-medium text-surface-800">{item.name}</td>
                  <td className="font-mono text-xs text-surface-400">{item.hsnCode || '—'}</td>
                  <td className="text-surface-500">{item.unit}</td>
                  <td>
                    <span className="badge bg-blue-500/15 text-blue-400">{item.gstRate}%</span>
                  </td>
                  <td className="text-right font-mono">{formatCurrency(item.defaultPrice)}</td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(item)} className="btn-ghost btn-xs">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(item)} className="btn-ghost btn-xs text-red-400">
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
             <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
             No items found
          </div>
        ) : (
          filtered.map(item => (
            <div key={item.id} className="bg-surface-50 border border-surface-200 rounded-sm p-4 flex flex-col gap-2 relative">
               <div className="flex justify-between items-start">
                  <div>
                    <div className="font-display font-medium text-surface-900">{item.name}</div>
                    <div className="font-mono text-xs text-surface-400 mt-1">HSN: {item.hsnCode || '—'}</div>
                  </div>
                  <span className="badge bg-blue-500/15 text-blue-400">{item.gstRate}% GST</span>
               </div>
               
               <div className="flex justify-between items-end mt-2 pt-2 border-t border-surface-200">
                 <div className="flex gap-2">
                    <button onClick={() => openEdit(item)} className="btn-ghost btn-xs text-surface-400">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(item)} className="btn-ghost btn-xs text-red-500 hover:text-red-400">
                      <Trash2 className="w-4 h-4" />
                    </button>
                 </div>
                 <div className="text-right flex flex-col items-end">
                   <div className="text-surface-400 text-xs">Price / {item.unit}</div>
                   <div className="font-mono font-bold text-surface-800">{formatCurrency(item.defaultPrice)}</div>
                 </div>
               </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Form */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-surface-100">
              <h3 className="text-lg font-bold text-surface-800">
                {editId ? 'Edit Item' : 'Add Item'}
              </h3>
              <button onClick={() => setShowForm(false)} className="btn-ghost btn-xs">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-surface-500 mb-1">Name *</label>
                <input type="text" value={form.name || ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="input" placeholder="Item name" autoFocus />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1">HSN Code</label>
                  <input type="text" value={form.hsnCode || ''} onChange={(e) => setForm((f) => ({ ...f, hsnCode: e.target.value }))}
                    className="input font-mono" placeholder="e.g. 7318" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1">Unit</label>
                  <select value={form.unit || 'NOS'} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                    className="input">
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1">GST Rate</label>
                  <select value={form.gstRate ?? 18} onChange={(e) => setForm((f) => ({ ...f, gstRate: parseFloat(e.target.value) }))}
                    className="input">
                    {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1">Default Price (₹)</label>
                  <input type="number" value={form.defaultPrice || ''} onChange={(e) => setForm((f) => ({ ...f, defaultPrice: parseFloat(e.target.value) || 0 }))}
                    className="input font-mono" min="0" step="0.01" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-surface-500 mb-1">Description</label>
                <textarea value={form.description || ''} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="input resize-none" rows={2} />
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
