'use client';

import React, { useState, useEffect } from 'react';
import { BarChart3, PieChart, Layers, MapPin, Box, DollarSign, ShieldCheck } from 'lucide-react';
import { ASSET_STATUSES, getStatusInfo } from '@/lib/status';

export default function ReportsPage() {
  const [stats, setStats] = useState<any>(null);
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/stats').then((r) => r.json()),
      fetch('/api/assets').then((r) => r.json()),
    ])
      .then(([statsRes, assetsRes]) => {
        if (statsRes.success) setStats(statsRes.data);
        if (assetsRes.success) setAssets(assetsRes.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const totalCost = assets.reduce((sum, a) => sum + (Number(a.purchase_cost) || 0), 0);

  // Status breakdown
  const statusCounts = assets.reduce((acc: Record<number, number>, a) => {
    acc[a.asset_status] = (acc[a.asset_status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Asset & Inventory Reports</h1>
        <p className="text-sm text-slate-500 mt-1">Operational breakdown by category, status, and department location.</p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Total Assets</span>
          <div className="text-3xl font-extrabold text-slate-900">{assets.length}</div>
          <span className="text-xs text-slate-400 mt-1 block">Registered in SkyInventory</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Total Portfolio Value</span>
          <div className="text-2xl font-extrabold text-blue-700 font-mono">
            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(totalCost)}
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Cumulative asset procurement</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Available for Allocation</span>
          <div className="text-3xl font-extrabold text-emerald-600">
            {statusCounts[1] || 0}
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Ready to deploy</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Assigned / In Use</span>
          <div className="text-3xl font-extrabold text-amber-600">
            {statusCounts[2] || 0}
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Allocated to staff</span>
        </div>
      </div>

      {/* Distribution Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-blue-600" /> Distribution by Status
          </h3>
          <div className="space-y-3">
            {Object.keys(ASSET_STATUSES).map((statusKey) => {
              const sId = Number(statusKey);
              const info = getStatusInfo(sId);
              const count = statusCounts[sId] || 0;
              const pct = assets.length > 0 ? Math.round((count / assets.length) * 100) : 0;
              if (count === 0 && sId > 4) return null;
              return (
                <div key={sId} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="flex items-center gap-1.5 text-slate-700">
                      <span>{info.icon}</span> {info.name}
                    </span>
                    <span className="text-slate-500">{count} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-blue-600 h-full rounded-full transition-all" style={{ width: `${pct}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Category Distribution */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600" /> Distribution by Category
          </h3>
          {stats?.byCategory?.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No categories found.</p>
          ) : (
            <div className="space-y-3">
              {stats?.byCategory?.map((cat: any) => {
                const pct = assets.length > 0 ? Math.round((cat.count / assets.length) * 100) : 0;
                return (
                  <div key={cat.name} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-700">{cat.name}</span>
                      <span className="text-slate-500">{cat.count} assets ({pct}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-indigo-600 h-full rounded-full transition-all" style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
