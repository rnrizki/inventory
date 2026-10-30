'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import {
  Box,
  Layers,
  MapPin,
  Calendar,
  DollarSign,
  Printer,
  Edit,
  Download,
  FileText,
  Clock,
  History,
  FileSpreadsheet,
  TrendingDown,
  TrendingUp,
  Bell,
  MessageSquare,
  ShieldAlert,
  CheckCircle,
  AlertTriangle,
  User,
  ArrowLeft,
  Share2,
  Trash2,
  Plus,
  RefreshCw,
} from 'lucide-react';
import TsplPrintModal from '@/components/TsplPrintModal';
import AssetModal from '@/components/AssetModal';
import { ASSET_STATUSES, getStatusInfo } from '@/lib/status';

export default function AssetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const assetId = params?.id;

  const [asset, setAsset] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    'general' | 'events' | 'history' | 'files' | 'reminders' | 'notes' | 'audits'
  >('general');
  const [qrDataUrl, setQrDataUrl] = useState('');

  // Modals
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);

  // Form states
  const [allocateName, setAllocateName] = useState('');
  const [allocateNote, setAllocateNote] = useState('');
  const [maintenanceForm, setMaintenanceForm] = useState({ title: '', cost: '', start_date: '', end_date: '', description: '' });
  const [newNote, setNewNote] = useState('');
  const [reminderForm, setReminderForm] = useState({ description: '', reminder_date: '' });

  const fetchAsset = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/assets/${assetId}`);
      const json = await res.json();
      if (json.success) {
        setAsset(json.data);
        // Generate QR code data URL
        const qrUrl = `${window.location.origin}/assets/${json.data.id}`;
        const dataUrl = await QRCode.toDataURL(qrUrl, { width: 300, margin: 1 });
        setQrDataUrl(dataUrl);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (assetId) {
      fetchAsset();
    }
  }, [assetId]);

  const handleQuickStatus = async (action: string, payload?: any) => {
    try {
      const res = await fetch(`/api/assets/${assetId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });
      const json = await res.json();
      if (json.success) {
        fetchAsset();
      } else {
        alert(json.error || 'Failed to update status');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote) return;
    try {
      const res = await fetch(`/api/assets/${assetId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note_content: newNote }),
      });
      if (res.ok) {
        setNewNote('');
        setShowNoteModal(false);
        fetchAsset();
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/assets/${assetId}/reminders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reminderForm),
      });
      if (res.ok) {
        setReminderForm({ description: '', reminder_date: '' });
        setShowReminderModal(false);
        fetchAsset();
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleAddMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/assets/${assetId}/maintenance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(maintenanceForm),
      });
      if (res.ok) {
        setMaintenanceForm({ title: '', cost: '', start_date: '', end_date: '', description: '' });
        setShowMaintenanceModal(false);
        fetchAsset();
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-slate-500">Loading asset details...</p>
        </div>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center max-w-md">
          <Box className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-800">Asset Not Found</h2>
          <p className="text-sm text-slate-500 mt-1 mb-6">The requested asset ID does not exist in the database.</p>
          <button
            onClick={() => router.push('/assets')}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Assets
          </button>
        </div>
      </div>
    );
  }

  const statusInfo = getStatusInfo(asset.asset_status);
  const costFormatted = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(Number(asset.purchase_cost) || 0);

  // Quick Action Buttons definition matching Perfex Asset Central
  const quickActions = [
    { label: 'Allocate', icon: '👤', onClick: () => setShowAllocateModal(true), bg: 'hover:bg-amber-50 text-amber-700 border-amber-300' },
    { label: 'Revocate', icon: '↩️', onClick: () => handleQuickStatus('revocate'), bg: 'hover:bg-red-50 text-red-700 border-red-300' },
    { label: 'Lost', icon: '🔍', onClick: () => handleQuickStatus('lost'), bg: 'hover:bg-slate-100 text-slate-700 border-slate-300' },
    { label: 'Found', icon: '📍', onClick: () => handleQuickStatus('found'), bg: 'hover:bg-emerald-50 text-emerald-700 border-emerald-300' },
    { label: 'Broken', icon: '⚠️', onClick: () => handleQuickStatus('broken'), bg: 'hover:bg-rose-50 text-rose-700 border-rose-300' },
    { label: 'Dispose', icon: '🗑️', onClick: () => handleQuickStatus('dispose'), bg: 'hover:bg-orange-50 text-orange-700 border-orange-300' },
    { label: 'Donate', icon: '🎁', onClick: () => handleQuickStatus('donate'), bg: 'hover:bg-pink-50 text-pink-700 border-pink-300' },
    { label: 'Sell', icon: '💵', onClick: () => handleQuickStatus('sell'), bg: 'hover:bg-yellow-50 text-yellow-800 border-yellow-300' },
    { label: 'Repair', icon: '🔧', onClick: () => handleQuickStatus('repair'), bg: 'hover:bg-sky-50 text-sky-700 border-sky-300' },
    { label: 'Maintenance', icon: '⚙️', onClick: () => setShowMaintenanceModal(true), bg: 'hover:bg-indigo-50 text-indigo-700 border-indigo-300' },
  ];

  const tabs = [
    { id: 'general', label: 'General Information', count: null },
    { id: 'events', label: 'Events', count: asset.events?.length || 0 },
    { id: 'history', label: 'History', count: asset.history?.length || 0 },
    { id: 'files', label: 'Files', count: asset.files?.length || 0 },
    { id: 'reminders', label: 'Reminders', count: asset.reminders?.length || 0 },
    { id: 'notes', label: 'Notes', count: asset.notes?.length || 0 },
    { id: 'audits', label: 'Audits', count: asset.audits?.length || 0 },
  ];

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
      {/* Top Banner Navigation */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/assets')}
                className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">{asset.asset_name}</h1>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusInfo.bg} ${statusInfo.color} ${statusInfo.border}`}
                  >
                    <span>{statusInfo.icon}</span>
                    {statusInfo.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                  <span>Asset #{asset.id}</span>
                  <span>•</span>
                  <span>Category: {asset.category_name || 'Uncategorized'}</span>
                  <span>•</span>
                  <span>Location: {asset.location_name || 'Unassigned'}</span>
                  {asset.assigned_to && (
                    <>
                      <span>•</span>
                      <span className="font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        Assigned to: {asset.assigned_to}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Top Right Action Buttons */}
            <div className="flex items-center flex-wrap gap-2">
              <button
                onClick={() => setShowEditModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-xs transition"
              >
                <Edit className="w-3.5 h-3.5" /> Edit
              </button>

              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-xs transition"
              >
                <FileText className="w-3.5 h-3.5 text-rose-600" /> Print PDF
              </button>

              <button
                onClick={() => setShowPrintModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm transition"
              >
                <Printer className="w-3.5 h-3.5" /> ⚡ Print TSPL Label
              </button>

              {qrDataUrl && (
                <a
                  href={qrDataUrl}
                  download={`QR_Asset_${asset.id}_${asset.asset_name}.png`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 shadow-xs transition"
                >
                  <Download className="w-3.5 h-3.5" /> Download QR
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Quick Lifecycle Action Buttons Toolbar */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Asset Actions & Lifecycle Status</span>
            <span className="text-xs text-slate-400">Click any action to update status immediately</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {quickActions.map((act) => (
              <button
                key={act.label}
                onClick={act.onClick}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border bg-white transition shadow-xs ${act.bg}`}
              >
                <span>{act.icon}</span>
                {act.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Navigation matching Perfex CRM Asset Central */}
        <div className="border-b border-slate-200 mb-6 bg-white rounded-t-xl px-4 pt-2 shadow-xs">
          <div className="flex overflow-x-auto gap-2 no-scrollbar">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 py-3 px-4 border-b-2 text-xs font-bold transition whitespace-nowrap ${
                    isActive
                      ? 'border-blue-600 text-blue-700 bg-blue-50/50 rounded-t-lg'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                  }`}
                >
                  {tab.label}
                  {tab.count !== null && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                        isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Contents */}
        {activeTab === 'general' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Image & Asset Details */}
            <div className="space-y-6">
              {/* Asset Photo Preview Card */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
                <div className="w-full h-44 bg-slate-50 border border-slate-200 rounded-lg flex flex-col items-center justify-center text-slate-400 p-4">
                  {asset.asset_image ? (
                    <img src={asset.asset_image} alt={asset.asset_name} className="h-full w-full object-contain" />
                  ) : (
                    <>
                      <Box className="w-12 h-12 text-slate-300 mb-2 stroke-1" />
                      <span className="text-xs font-medium text-slate-400">No Asset Photo Uploaded</span>
                    </>
                  )}
                </div>
              </div>

              {/* Asset Details Table */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="bg-cyan-50/60 border-b border-cyan-100 px-5 py-3 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-800">Asset Details</h3>
                  <button onClick={() => setShowEditModal(true)} className="text-slate-400 hover:text-slate-700">
                    <Edit className="w-4 h-4" />
                  </button>
                </div>
                <div className="divide-y divide-slate-100 text-xs">
                  <div className="grid grid-cols-3 px-5 py-2.5 bg-slate-50/50">
                    <span className="font-semibold text-slate-600">Asset #</span>
                    <span className="col-span-2 text-slate-900 font-bold">{asset.id}</span>
                  </div>
                  <div className="grid grid-cols-3 px-5 py-2.5">
                    <span className="font-semibold text-slate-600">Asset Name</span>
                    <span className="col-span-2 text-slate-900 font-semibold">{asset.asset_name}</span>
                  </div>
                  <div className="grid grid-cols-3 px-5 py-2.5 bg-slate-50/50">
                    <span className="font-semibold text-slate-600">Status</span>
                    <span className="col-span-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border ${statusInfo.bg} ${statusInfo.color} ${statusInfo.border}`}>
                        {statusInfo.name}
                      </span>
                    </span>
                  </div>
                  <div className="grid grid-cols-3 px-5 py-2.5">
                    <span className="font-semibold text-slate-600">Model Number / Spec</span>
                    <span className="col-span-2 text-slate-800 font-mono">{asset.model_number || '-'}</span>
                  </div>
                  <div className="grid grid-cols-3 px-5 py-2.5 bg-slate-50/50">
                    <span className="font-semibold text-slate-600">Serial Number</span>
                    <span className="col-span-2 text-slate-800 font-mono">{asset.serial_number || '-'}</span>
                  </div>
                  <div className="grid grid-cols-3 px-5 py-2.5">
                    <span className="font-semibold text-slate-600">Asset Category</span>
                    <span className="col-span-2 text-slate-800 font-medium">{asset.category_name || '-'}</span>
                  </div>
                  <div className="grid grid-cols-3 px-5 py-2.5 bg-slate-50/50">
                    <span className="font-semibold text-slate-600">Purchase Cost</span>
                    <span className="col-span-2 text-emerald-700 font-bold font-mono">{costFormatted}</span>
                  </div>
                  <div className="grid grid-cols-3 px-5 py-2.5">
                    <span className="font-semibold text-slate-600">Purchase Date</span>
                    <span className="col-span-2 text-slate-800">{asset.purchase_date || '-'}</span>
                  </div>
                  <div className="grid grid-cols-3 px-5 py-2.5 bg-slate-50/50">
                    <span className="font-semibold text-slate-600">Asset Location</span>
                    <span className="col-span-2 text-slate-800">{asset.location_name || '-'}</span>
                  </div>
                  <div className="grid grid-cols-3 px-5 py-2.5">
                    <span className="font-semibold text-slate-600">Warranty Period</span>
                    <span className="col-span-2 text-slate-800">{asset.warranty_period_month || 0} Months</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: QR Code, Supplier */}
            <div className="space-y-6">
              {/* QR Code Preview Card */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-800 mb-1">Asset QR Identification</h4>
                  <p className="text-xs text-slate-500 mb-3">Scannable using smartphone camera or barcode terminal.</p>
                  <button
                    onClick={() => setShowPrintModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold border border-blue-200 hover:bg-blue-100"
                  >
                    <Printer className="w-3.5 h-3.5" /> Print Xprinter TSPL Label
                  </button>
                </div>
                {qrDataUrl && (
                  <div className="p-2 border border-slate-200 rounded-xl bg-white shadow-xs">
                    <img src={qrDataUrl} alt="Asset QR" className="w-28 h-28 object-contain" />
                  </div>
                )}
              </div>

              {/* Supplier Details Table */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="bg-cyan-50/60 border-b border-cyan-100 px-5 py-3">
                  <h3 className="text-sm font-bold text-slate-800">Supplier Details</h3>
                </div>
                <div className="divide-y divide-slate-100 text-xs">
                  <div className="grid grid-cols-3 px-5 py-2.5 bg-slate-50/50">
                    <span className="font-semibold text-slate-600">Supplier Name</span>
                    <span className="col-span-2 text-slate-900 font-bold">{asset.supplier_name || 'PT. Angan Kreasi Semesta'}</span>
                  </div>
                  <div className="grid grid-cols-3 px-5 py-2.5">
                    <span className="font-semibold text-slate-600">Supplier Phone</span>
                    <span className="col-span-2 text-slate-800 font-mono">{asset.supplier_phone || '-'}</span>
                  </div>
                  <div className="grid grid-cols-3 px-5 py-2.5 bg-slate-50/50">
                    <span className="font-semibold text-slate-600">Supplier Address</span>
                    <span className="col-span-2 text-slate-800 font-normal">
                      {asset.supplier_address || 'Jl. Gotong Royong I No.50 . Ragunan, Ps. Minggu, Kota Jakarta Selatan.'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Events */}
        {activeTab === 'events' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-800">Asset Events Timeline</h3>
              <button
                onClick={() => handleQuickStatus('maintenance')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700"
              >
                <Plus className="w-3.5 h-3.5" /> Log Event
              </button>
            </div>
            {asset.events?.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No events recorded for this asset.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {asset.events.map((evt: any) => (
                  <div key={evt.id} className="py-3 flex items-start gap-4 text-xs">
                    <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0 mt-0.5">
                      ✓
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{evt.event_type}</span>
                        <span className="text-slate-400 text-[11px]">{evt.created_at}</span>
                      </div>
                      <p className="text-slate-600 mt-0.5">{evt.notes || '-'}</p>
                      <span className="text-[10px] text-slate-400">By: {evt.event_by}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: History */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-800">Asset Change History & Audit Trail</h3>
            </div>
            <table className="w-full text-left text-xs divide-y divide-slate-100">
              <thead className="bg-slate-50 text-slate-500 font-semibold">
                <tr>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Action</th>
                  <th className="px-5 py-3">Note / Details</th>
                  <th className="px-5 py-3">Changed By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {asset.history?.map((h: any) => (
                  <tr key={h.id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-3 text-slate-500 font-mono text-[11px]">{h.created_at}</td>
                    <td className="px-5 py-3 font-semibold text-slate-800">{h.action || 'Updated'}</td>
                    <td className="px-5 py-3 text-slate-600">{h.note || '-'}</td>
                    <td className="px-5 py-3 text-slate-500">{h.changed_by || 'Admin'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 4: Files */}
        {activeTab === 'files' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs text-center">
            <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h4 className="text-sm font-bold text-slate-800">Attached Asset Files</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
              Upload invoices, purchase agreements, warranty documents, and spec sheets.
            </p>
            <input type="file" id="asset-file-upload" className="hidden" />
            <label
              htmlFor="asset-file-upload"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Upload File
            </label>
          </div>
        )}

        {/* Tab: Reminders */}
        {activeTab === 'reminders' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-800">Maintenance & Warranty Reminders</h3>
              <button
                onClick={() => setShowReminderModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700"
              >
                <Plus className="w-3.5 h-3.5" /> Add Reminder
              </button>
            </div>
            {asset.reminders?.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No reminders set for this asset.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {asset.reminders.map((rem: any) => (
                  <div key={rem.id} className="py-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <Bell className="w-4 h-4 text-amber-500" />
                      <div>
                        <p className="font-bold text-slate-800">{rem.description}</p>
                        <span className="text-[11px] text-slate-400">Due Date: {rem.reminder_date}</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      Pending
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 8: Notes */}
        {activeTab === 'notes' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-800">Staff Notes & Remarks</h3>
              <button
                onClick={() => setShowNoteModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700"
              >
                <Plus className="w-3.5 h-3.5" /> Add Note
              </button>
            </div>
            {asset.notes?.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No notes added yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {asset.notes.map((n: any) => (
                  <div key={n.id} className="py-3 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-800">{n.created_by || 'Admin'}</span>
                      <span className="text-[11px] text-slate-400">{n.created_at}</span>
                    </div>
                    <p className="text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">{n.note_content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 9: Audits */}
        {activeTab === 'audits' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
            <h3 className="text-sm font-bold text-slate-800 mb-2">Audit History</h3>
            <p className="text-xs text-slate-400 mb-4">Verification audits involving this asset.</p>
            {asset.audits?.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No audits found for this asset.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {asset.audits.map((a: any) => (
                  <div key={a.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-800">{a.audit_name}</span>
                      <p className="text-slate-500 text-[11px]">{a.notes || 'Routine audit verification'}</p>
                    </div>
                    <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] font-semibold border border-emerald-200">
                      Verified
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Allocate Modal */}
      {showAllocateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-base font-bold text-slate-900 mb-1">Allocate Asset to Staff</h3>
            <p className="text-xs text-slate-500 mb-4">Assign this equipment to an employee or team member.</p>
            <div className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Staff / Employee Name *</label>
                <input
                  type="text"
                  value={allocateName}
                  onChange={(e) => setAllocateName(e.target.value)}
                  placeholder="e.g. Budi Santoso / IT Staff"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Allocation Note</label>
                <textarea
                  value={allocateNote}
                  onChange={(e) => setAllocateNote(e.target.value)}
                  placeholder="Handed over with power adapter and case..."
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowAllocateModal(false)}
                  className="px-4 py-2 border rounded-lg font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    handleQuickStatus('allocate', { assigned_to: allocateName, note: allocateNote });
                    setShowAllocateModal(false);
                    setAllocateName('');
                    setAllocateNote('');
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700"
                >
                  Confirm Allocation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Maintenance Modal */}
      {showMaintenanceModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-base font-bold text-slate-900 mb-1">Schedule Maintenance</h3>
            <p className="text-xs text-slate-500 mb-4">Set repair or maintenance schedule for this asset.</p>
            <form onSubmit={handleAddMaintenance} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Maintenance Title *</label>
                <input
                  type="text"
                  required
                  value={maintenanceForm.title}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, title: e.target.value })}
                  placeholder="e.g. Battery replacement & cleaning"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Estimated Cost (IDR)</label>
                  <input
                    type="number"
                    value={maintenanceForm.cost}
                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, cost: e.target.value })}
                    placeholder="250000"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Start Date</label>
                  <input
                    type="date"
                    value={maintenanceForm.start_date}
                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, start_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMaintenanceModal(false)}
                  className="px-4 py-2 border rounded-lg font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700">
                  Save Maintenance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Note Modal */}
      {showNoteModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-base font-bold text-slate-900 mb-1">Add Staff Note</h3>
            <form onSubmit={handleAddNote} className="space-y-3 text-xs mt-3">
              <textarea
                required
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Write internal note or observation..."
                rows={3}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNoteModal(false)}
                  className="px-4 py-2 border rounded-lg font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold">
                  Add Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reminder Modal */}
      {showReminderModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-base font-bold text-slate-900 mb-1">Add Reminder</h3>
            <form onSubmit={handleAddReminder} className="space-y-3 text-xs mt-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Reminder Description</label>
                <input
                  type="text"
                  required
                  value={reminderForm.description}
                  onChange={(e) => setReminderForm({ ...reminderForm, description: e.target.value })}
                  placeholder="e.g. Warranty expiration date"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Due Date</label>
                <input
                  type="date"
                  required
                  value={reminderForm.reminder_date}
                  onChange={(e) => setReminderForm({ ...reminderForm, reminder_date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowReminderModal(false)}
                  className="px-4 py-2 border rounded-lg font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold">
                  Save Reminder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TSPL Thermal Printer Modal */}
      {showPrintModal && (
        <TsplPrintModal isOpen={showPrintModal} asset={asset} onClose={() => setShowPrintModal(false)} />
      )}

      {/* Edit Asset Modal */}
      {showEditModal && (
        <AssetModal
          isOpen={showEditModal}
          assetToEdit={asset}
          onClose={() => setShowEditModal(false)}
          onSaved={() => {
            setShowEditModal(false);
            fetchAsset();
          }}
        />
      )}
    </div>
  );
}
