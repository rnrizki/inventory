'use client';

import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  assetToEdit?: any;
  categories: any[];
  locations: any[];
}

export default function AssetModal({
  isOpen,
  onClose,
  onSaved,
  assetToEdit,
  categories,
  locations,
}: Props) {
  if (!isOpen) return null;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [model, setModel] = useState('');
  const [serial, setSerial] = useState('');
  const [cost, setCost] = useState('');
  const [date, setDate] = useState('');
  const [supplier, setSupplier] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [status, setStatus] = useState('1');
  const [assignedTo, setAssignedTo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (assetToEdit) {
      setName(assetToEdit.asset_name || '');
      setDescription(assetToEdit.asset_description || '');
      setModel(assetToEdit.model_number || '');
      setSerial(assetToEdit.serial_number || '');
      setCost(assetToEdit.purchase_cost ? String(assetToEdit.purchase_cost) : '');
      setDate(assetToEdit.purchase_date ? String(assetToEdit.purchase_date).split(' ')[0] : '');
      setSupplier(assetToEdit.supplier_name || '');
      setCategoryId(assetToEdit.category_id ? String(assetToEdit.category_id) : '');
      setLocationId(assetToEdit.location_id ? String(assetToEdit.location_id) : '');
      setStatus(assetToEdit.asset_status ? String(assetToEdit.asset_status) : '1');
      setAssignedTo(assetToEdit.assigned_to || '');
    } else {
      setName('');
      setDescription('');
      setModel('');
      setSerial('');
      setCost('');
      setDate(new Date().toISOString().split('T')[0]);
      setSupplier('PT. Angan Kreasi Semesta');
      setCategoryId(categories[0]?.id ? String(categories[0].id) : '');
      setLocationId(locations[0]?.id ? String(locations[0].id) : '');
      setStatus('1');
      setAssignedTo('');
    }
  }, [assetToEdit, categories, locations]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Asset name is required');
      return;
    }

    setIsLoading(true);
    setError('');

    const payload = {
      asset_name: name,
      asset_description: description,
      model_number: model,
      serial_number: serial,
      purchase_cost: Number(cost) || 0,
      purchase_date: date,
      supplier_name: supplier,
      category_id: categoryId ? Number(categoryId) : null,
      location_id: locationId ? Number(locationId) : null,
      asset_status: Number(status),
      assigned_to: assignedTo,
    };

    try {
      const url = assetToEdit ? `/api/assets/${assetToEdit.id}` : '/api/assets';
      const method = assetToEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to save asset');
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <h3 className="text-base font-bold text-white">
            {assetToEdit ? 'Edit Asset' : 'Register New Asset'}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 bg-slate-50 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200 rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs font-semibold text-slate-700 mb-1 block">Asset Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. MacBook Pro M1 Max"
                className="w-full text-sm px-3.5 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white"
              />
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="text-xs font-semibold text-slate-700 mb-1 block">Serial Number</label>
              <input
                type="text"
                value={serial}
                onChange={(e) => setSerial(e.target.value)}
                placeholder="e.g. C02G1234MD6R"
                className="w-full text-sm px-3.5 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white"
              />
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="text-xs font-semibold text-slate-700 mb-1 block">Tahun / Purchase Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-sm px-3.5 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white"
              />
            </div>

            <div className="col-span-2">
              <label className="text-xs font-semibold text-slate-700 mb-1 block">
                Specification / Model Number (Max 7 Rows for Label)
              </label>
              <textarea
                rows={4}
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Line 1: Apple M1 Pro&#10;Line 2: 16 GB RAM&#10;Line 3: 512 GB SSD"
                className="w-full text-sm px-3.5 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white font-mono text-xs"
              />
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="text-xs font-semibold text-slate-700 mb-1 block">Category</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full text-sm px-3.5 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white"
              >
                <option value="">Select Category...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="text-xs font-semibold text-slate-700 mb-1 block">Location</label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="w-full text-sm px-3.5 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white"
              >
                <option value="">Select Location...</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="text-xs font-semibold text-slate-700 mb-1 block">Purchase Cost (Rp)</label>
              <input
                type="number"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="e.g. 15000000"
                className="w-full text-sm px-3.5 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white"
              />
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="text-xs font-semibold text-slate-700 mb-1 block">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full text-sm px-3.5 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white"
              >
                <option value="1">🟢 Available</option>
                <option value="2">🔵 Assigned / In Use</option>
                <option value="3">🟡 Maintenance</option>
                <option value="4">⚪ Retired</option>
              </select>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="text-xs font-semibold text-slate-700 mb-1 block">Supplier / Property</label>
              <input
                type="text"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="e.g. PT. Angan Kreasi Semesta"
                className="w-full text-sm px-3.5 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white"
              />
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="text-xs font-semibold text-slate-700 mb-1 block">Assigned To (Person/Dept)</label>
              <input
                type="text"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                placeholder="e.g. John Doe (IT)"
                className="w-full text-sm px-3.5 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isLoading ? 'Saving...' : 'Save Asset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
