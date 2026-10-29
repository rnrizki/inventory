'use client';

import React, { useState, useEffect } from 'react';
import { Box, Layers, MapPin, Printer, Plus, TrendingUp, CheckCircle, Clock, Wrench } from 'lucide-react';
import TsplPrintModal from '@/components/TsplPrintModal';
import AssetModal from '@/components/AssetModal';

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [assets, setAssets] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [selectedAssetForPrint, setSelectedAssetForPrint] = useState<any>(null);
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resStats, resAssets, resCats, resLocs] = await Promise.all([
        fetch('/api/stats').then((r) => r.json()),
        fetch('/api/assets').then((r) => r.json()),
        fetch('/api/categories').then((r) => r.json()),
        fetch('/api/locations').then((r) => r.json()),
      ]);

      if (resStats.success) setStats(resStats.data);
      if (resAssets.success) setAssets(resAssets.data);
      if (resCats.success) setCategories(resCats.data);
      if (resLocs.success) setLocations(resLocs.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val || 0);
  };

  const getStatusBadge = (status: number) => {
    switch (status) {
      case 1:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">Available</span>;
      case 2:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">In Use</span>;
      case 3:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">Maintenance</span>;
      case 4:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">Retired</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">Available</span>;
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 rounded-3xl text-white shadow-xl shadow-blue-500/10">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">SkyInventory Dashboard</h1>
          <p className="text-sm text-blue-200 mt-1">
            Enterprise Asset Management with Xprinter XP-420B Native Thermal Printing
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <a
            href="/assets/import"
            className="inline-flex items-center gap-2 bg-white text-blue-700 hover:bg-blue-50 px-4 py-2.5 rounded-xl text-sm font-bold shadow-md transition"
          >
            <Plus className="w-4 h-4" /> Add Asset in Bulk
          </a>
          <button
            onClick={() => setIsAssetModalOpen(true)}
            className="inline-flex items-center gap-2 bg-white text-blue-700 hover:bg-blue-50 px-4 py-2.5 rounded-xl text-sm font-bold shadow-md transition"
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

      {/* Assets Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200/80 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Registered Assets</h2>
            <p className="text-xs text-slate-500 mt-0.5">Semua perangkat aset dan tombol cetak label thermal Xprinter</p>
          </div>
          <a href="/assets" className="text-xs font-bold text-blue-600 hover:text-blue-700">
            View All &rarr;
          </a>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Asset Name</th>
                <th className="py-3 px-4">Serial Number</th>
                <th className="py-3 px-4">Model / Specification</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Label Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">Loading assets...</td>
                </tr>
              ) : assets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">No assets registered yet.</td>
                </tr>
              ) : (
                assets.slice(0, 10).map((asset, idx) => (
                  <tr key={asset.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-400">{idx + 1}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <a href={`/assets/${asset.id}`} className="hover:text-blue-600 transition">
                        {asset.asset_name}
                      </a>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-600">{asset.serial_number || '-'}</td>
                    <td className="py-3.5 px-4 text-xs text-slate-600 max-w-xs truncate" title={asset.model_number}>
                      {asset.model_number || '-'}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-medium text-slate-700">
                      {asset.category_name || '-'}
                    </td>
                    <td className="py-3.5 px-4">{getStatusBadge(asset.asset_status)}</td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <a
                          href={`/assets/${asset.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg shadow-xs transition"
                        >
                          View Details
                        </a>
                        <button
                          onClick={() => setSelectedAssetForPrint(asset)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg shadow-xs transition"
                          title="Print Native TSPL Thermal Label for Xprinter XP-420B"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Print Label</span>
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

      {/* Add Asset Modal */}
      <AssetModal
        isOpen={isAssetModalOpen}
        onClose={() => setIsAssetModalOpen(false)}
        onSaved={fetchData}
        categories={categories}
        locations={locations}
      />
    </div>
  );
}
