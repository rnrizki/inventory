'use client';

import React, { useState, useEffect } from 'react';
import { TrendingDown, TrendingUp, DollarSign, Calculator, ArrowRight } from 'lucide-react';

export default function DepreciationOverviewPage() {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/assets')
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setAssets(json.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const totalCost = assets.reduce((sum, a) => sum + (Number(a.purchase_cost) || 0), 0);
  const totalDepreciatedEstimate = assets.reduce((sum, a) => sum + (Number(a.purchase_cost) || 0) * 0.2, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Depreciation & Asset Valuation</h1>
        <p className="text-sm text-slate-500 mt-1">Book value calculations, straight-line and reducing-balance depreciation tables.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Historical Cost</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono">
            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(totalCost)}
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Sum of original purchase costs</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Est. Annual Depreciation</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-rose-600 font-mono">
            -{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(totalDepreciatedEstimate)}
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Calculated at standard 20% annual rate</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Net Book Value</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Calculator className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-emerald-700 font-mono">
            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(totalCost - totalDepreciatedEstimate)}
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Current carrying asset balance</span>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">Asset Depreciation Schedules</h3>
        </div>
        <table className="w-full text-left text-xs divide-y divide-slate-100">
          <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3.5">Asset</th>
              <th className="px-5 py-3.5">Purchase Date</th>
              <th className="px-5 py-3.5">Method</th>
              <th className="px-5 py-3.5">Initial Cost</th>
              <th className="px-5 py-3.5">Est. Depreciation</th>
              <th className="px-5 py-3.5">Net Book Value</th>
              <th className="px-5 py-3.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400">Loading asset depreciation...</td>
              </tr>
            ) : assets.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400">No assets in database.</td>
              </tr>
            ) : (
              assets.map((asset) => {
                const cost = Number(asset.purchase_cost) || 0;
                const dep = cost * 0.2;
                const net = cost - dep;
                return (
                  <tr key={asset.id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-3.5 font-sans font-bold text-slate-900">{asset.asset_name}</td>
                    <td className="px-5 py-3.5 text-slate-600">{asset.purchase_date || '-'}</td>
                    <td className="px-5 py-3.5 font-sans">
                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[11px] font-semibold border border-blue-200">
                        {asset.depreciation_method || 'Reducing Balance'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-bold text-slate-800">
                      {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(cost)}
                    </td>
                    <td className="px-5 py-3.5 text-rose-600">
                      -{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(dep)}
                    </td>
                    <td className="px-5 py-3.5 font-bold text-emerald-700">
                      {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(net)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-sans">
                      <a
                        href={`/assets/${asset.id}`}
                        className="text-blue-600 hover:text-blue-700 font-bold inline-flex items-center gap-1 text-xs"
                      >
                        Details <ArrowRight className="w-3 h-3" />
                      </a>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
