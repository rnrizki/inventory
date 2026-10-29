'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Plus,
  Search,
  Filter,
  Printer,
  Edit2,
  Trash2,
  ArrowUpDown,
  Eye,
  ExternalLink,
  Upload,
  CheckCircle,
  TrendingUp,
  Layers,
} from 'lucide-react';
import TsplPrintModal from '@/components/TsplPrintModal';
import AssetModal from '@/components/AssetModal';
import { getStatusInfo } from '@/lib/status';

export default function AssetsPage() {
  const [assets, setAssets] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Modals
  const [selectedAssetForPrint, setSelectedAssetForPrint] = useState<any>(null);
  const [assetToEdit, setAssetToEdit] = useState<any>(null);
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set('q', search);
      if (selectedCategory) params.set('category', selectedCategory);
      if (selectedStatus) params.set('status', selectedStatus);

      const [resAssets, resCats, resLocs, resStats] = await Promise.all([
        fetch(`/api/assets?${params.toString()}`).then((r) => r.json()),
        fetch('/api/categories').then((r) => r.json()),
        fetch('/api/locations').then((r) => r.json()),
        fetch('/api/stats').then((r) => r.json()),
      ]);

      if (resAssets.success) setAssets(resAssets.data);
      if (resCats.success) setCategories(resCats.data);
      if (resLocs.success) setLocations(resLocs.data);
      if (resStats.success) setStats(resStats.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAssets();
    }, 200);
    return () => clearTimeout(timer);
  }, [search, selectedCategory, selectedStatus]);

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete asset "${name}"?`)) return;
    try {
      const res = await fetch(`/api/assets/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchAssets();
      } else {
        alert('Failed to delete asset: ' + data.error);
      }
    } catch (err) {
      alert('Error deleting asset');
    }
  };

  const getStatusBadge = (status: number) => {
    const info = getStatusInfo(status);
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${info.bg} ${info.color} ${info.border}`}>
        <span>{info.icon}</span>
        {info.name}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Manage Assets</h1>
          <p className="text-xs text-slate-500 mt-1">Daftar inventaris aset, pencarian, dan cetak label Xprinter</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <a
            href="/assets/import"
            className="inline-flex items-center gap-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3.5 py-2.5 rounded-xl text-sm font-bold shadow-xs transition"
          >
            <Plus className="w-4 h-4 text-slate-600" /> Add Asset in Bulk
          </a>
          <button
            onClick={() => {
              setAssetToEdit(null);
              setIsAssetModalOpen(true);
            }}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm transition"
          >
            <Plus className="w-4 h-4" /> Add Asset
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
            <Box className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase">Total Assets</div>
            <div className="text-2xl font-black text-slate-900">{stats?.totalAssets ?? 0}</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase">Available</div>
            <div className="text-2xl font-black text-slate-900">{stats?.available ?? 0}</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase">Total Value</div>
            <div className="text-lg font-black text-slate-900 truncate max-w-[170px]" title={formatRupiah(stats?.totalValue)}>
              {formatRupiah(stats?.totalValue)}
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase">Categories</div>
            <div className="text-2xl font-black text-slate-900">{categories.length}</div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by asset name, serial, model, or supplier..."
            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-xs px-3 py-2 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="text-xs px-3 py-2 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          >
            <option value="">All Statuses</option>
            <option value="1">Available</option>
            <option value="2">In Use</option>
            <option value="3">Maintenance</option>
            <option value="4">Retired</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Asset Name</th>
                <th className="py-3 px-4">Serial Number</th>
                <th className="py-3 px-4">Specification / Model</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">Loading assets...</td>
                </tr>
              ) : assets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">No assets found matching filters.</td>
                </tr>
              ) : (
                assets.map((asset, idx) => (
                  <tr key={asset.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-400">{idx + 1}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <a href={`/assets/${asset.id}`} className="hover:text-blue-600 transition inline-flex items-center gap-1 group">
                        <span>{asset.asset_name}</span>
                        <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-blue-600" />
                      </a>
                      <div className="text-xs text-slate-400 font-normal">{asset.supplier_name}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-600">{asset.serial_number || '-'}</td>
                    <td className="py-3.5 px-4 text-xs text-slate-600 max-w-xs truncate" title={asset.model_number}>
                      {asset.model_number || '-'}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-medium text-slate-700">
                      {asset.category_name || '-'}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600">
                      {asset.location_name || '-'}
                    </td>
                    <td className="py-3.5 px-4">{getStatusBadge(asset.asset_status)}</td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <a
                          href={`/assets/${asset.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg shadow-xs transition"
                          title="View Full Details (9 Tabs & Actions)"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </a>
                        <button
                          onClick={() => setSelectedAssetForPrint(asset)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg shadow-xs transition"
                          title="Print TSPL Thermal Label (Xprinter XP-420B)"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Print</span>
                        </button>
                        <button
                          onClick={() => {
                            setAssetToEdit(asset);
                            setIsAssetModalOpen(true);
                          }}
                          className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Edit Asset"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(asset.id, asset.asset_name)}
                          className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Delete Asset"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* TSPL Print Modal */}
      <TsplPrintModal
        isOpen={Boolean(selectedAssetForPrint)}
        onClose={() => setSelectedAssetForPrint(null)}
        asset={selectedAssetForPrint}
      />

      {/* Add / Edit Modal */}
      <AssetModal
        isOpen={isAssetModalOpen}
        onClose={() => setIsAssetModalOpen(false)}
        onSaved={fetchAssets}
        assetToEdit={assetToEdit}
        categories={categories}
        locations={locations}
      />
    </div>
  );
}
