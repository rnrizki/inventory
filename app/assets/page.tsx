'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  User,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import TsplPrintModal from '@/components/TsplPrintModal';
import AssetModal from '@/components/AssetModal';
import { getStatusInfo } from '@/lib/status';

export default function AssetsPage() {
  const router = useRouter();
  const [assets, setAssets] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // If redirected or scanned with legacy query parameter ?id=1, route to /assets/:id
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const idParam = params.get('id');
      if (idParam && /^\d+$/.test(idParam)) {
        router.replace(`/assets/${idParam}`);
      }
    }
  }, [router]);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Pagination (15 items per page)
  const PAGE_SIZE = 15;
  const [currentPage, setCurrentPage] = useState(1);

  // Reset to page 1 when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedCategory, selectedStatus]);

  const totalPages = Math.max(1, Math.ceil(assets.length / PAGE_SIZE));
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const paginatedAssets = assets.slice(startIndex, startIndex + PAGE_SIZE);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const getPaginationItems = (): (number | string)[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const items: (number | string)[] = [];

    if (currentPage <= 4) {
      const endPage = Math.min(currentPage + 3, totalPages - 1);
      for (let i = 1; i <= endPage; i++) {
        items.push(i);
      }
      if (endPage < totalPages - 1) {
        items.push('...');
      }
      items.push(totalPages);
    } else if (currentPage >= totalPages - 3) {
      items.push(1);
      const startPage = Math.max(2, currentPage - 3);
      if (startPage > 2) {
        items.push('...');
      }
      for (let i = startPage; i <= totalPages; i++) {
        items.push(i);
      }
    } else {
      items.push(1);
      items.push('...');
      for (let i = currentPage - 1; i <= currentPage + 1; i++) {
        items.push(i);
      }
      items.push('...');
      items.push(totalPages);
    }

    return items;
  };

  // Modals
  const [selectedAssetForPrint, setSelectedAssetForPrint] = useState<any>(null);
  const [assetToEdit, setAssetToEdit] = useState<any>(null);
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ email: string; role: string; canEdit: boolean } | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.authenticated && d.user) setCurrentUser(d.user);
      })
      .catch(() => {});
  }, []);

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
        {currentUser?.canEdit && (
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
        )}
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
            <div className="text-lg 2xl:text-xl font-black text-slate-900 truncate" title={formatRupiah(stats?.totalValue)}>
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
                <th className="py-3 px-4 w-12">#</th>
                <th className="py-3 px-4 min-w-[200px]">Asset Name</th>
                <th className="py-3 px-4 min-w-[140px] whitespace-nowrap">Serial Number</th>
                <th className="py-3 px-4 min-w-[200px]">Specification / Model</th>
                <th className="py-3 px-4 min-w-[120px] whitespace-nowrap">Category</th>
                <th className="py-3 px-4 min-w-[110px] whitespace-nowrap">Location</th>
                <th className="py-3 px-4 min-w-[110px] whitespace-nowrap">Status</th>
                <th className="py-3 px-4 min-w-[130px] whitespace-nowrap">Assigned to</th>
                <th className="py-3 px-4 text-right whitespace-nowrap min-w-[190px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">Loading assets...</td>
                </tr>
              ) : assets.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">No assets found matching filters.</td>
                </tr>
              ) : (
                paginatedAssets.map((asset, idx) => (
                  <tr key={asset.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-400">{startIndex + idx + 1}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-3">
                        {asset.asset_image ? (
                          <img
                            src={asset.asset_image}
                            alt=""
                            className="w-9 h-9 object-cover rounded-lg border border-slate-200 shrink-0 bg-white"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : null}
                        <div>
                          <a href={`/assets/${asset.id}`} className="hover:text-blue-600 transition inline-flex items-center gap-1 group">
                            <span>{asset.asset_name}</span>
                            <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-blue-600" />
                          </a>
                          <div className="text-xs text-slate-400 font-normal">{asset.supplier_name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">{asset.serial_number || '-'}</td>
                    <td className="py-3.5 px-4 text-xs text-slate-600 max-w-sm 2xl:max-w-md truncate" title={asset.model_number}>
                      {asset.model_number || '-'}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-medium text-slate-700 whitespace-nowrap">
                      {asset.category_name || '-'}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                      {asset.location_name || '-'}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">{getStatusBadge(asset.asset_status)}</td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {asset.assigned_to && asset.assigned_to.trim() !== '' ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                          <User className="w-3.5 h-3.5 text-slate-500" />
                          <span className="truncate max-w-[160px] 2xl:max-w-xs" title={asset.assigned_to}>
                            {asset.assigned_to}
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Available
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
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
                        {currentUser?.canEdit && (
                          <>
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
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer with Summary Info and Pagination matching majalahpdf.my.id */}
        <div className="p-4 sm:p-5 border-t border-slate-200/80 bg-slate-50/40 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-500 font-medium">
            {assets.length === 0 ? (
              <span>0 assets</span>
            ) : (
              <span>
                Showing <span className="font-bold text-slate-800">{startIndex + 1}</span> to{' '}
                <span className="font-bold text-slate-800">{Math.min(startIndex + PAGE_SIZE, assets.length)}</span> of{' '}
                <span className="font-bold text-slate-800">{assets.length}</span> assets
              </span>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-center">
              {/* Previous Button */}
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="inline-flex items-center gap-1 px-4 py-2 rounded-full border border-slate-200 bg-white text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed select-none"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>

              {/* Page Number Pills */}
              {getPaginationItems().map((item, idx) => {
                if (item === '...') {
                  return (
                    <span key={`ellipsis-${idx}`} className="px-1 text-xs sm:text-sm font-bold text-slate-400 select-none">
                      ...
                    </span>
                  );
                }

                const pageNum = Number(item);
                const isActive = pageNum === currentPage;
                const formattedNum = pageNum < 10 ? `0${pageNum}` : `${pageNum}`;

                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    className={`min-w-[38px] h-9 px-2.5 rounded-full text-xs sm:text-sm font-bold transition flex items-center justify-center select-none ${
                      isActive
                        ? 'bg-[#0f172a] text-white shadow-xs border border-[#0f172a]'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    {formattedNum}
                  </button>
                );
              })}

              {/* Next Button */}
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="inline-flex items-center gap-1 px-4 py-2 rounded-full border border-slate-200 bg-white text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed select-none"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
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
