'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ScanLine, Search, ArrowRight, Box, Camera, QrCode } from 'lucide-react';

export default function QrScannerPage() {
  const router = useRouter();
  const [assetIdInput, setAssetIdInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetIdInput.trim()) return;

    // If user pasted a full URL like https://inventory.skyconnection.id/assets/1
    let lookupVal = assetIdInput.trim();
    if (lookupVal.includes('/assets/')) {
      const parts = lookupVal.split('/assets/');
      lookupVal = parts[parts.length - 1].replace(/\D/g, '');
    }

    setSearching(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/assets/${lookupVal}`);
      const json = await res.json();
      if (json.success && json.data) {
        router.push(`/assets/${json.data.id}`);
      } else {
        setErrorMsg(`Asset #${lookupVal} not found. Please verify the ID or serial.`);
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="text-center mb-8">
        <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-blue-100 shadow-xs">
          <ScanLine className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Asset QR & Barcode Scanner</h1>
        <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
          Scan the thermal QR label generated for your equipment, or enter the Asset ID or Serial Number to view its full lifecycle details.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-8">
        {/* Scanner viewfinder simulation */}
        <div className="relative w-full h-64 bg-slate-900 rounded-xl overflow-hidden flex flex-col items-center justify-center text-white mb-6 border border-slate-800">
          <div className="absolute inset-8 border-2 border-dashed border-blue-400/60 rounded-xl flex items-center justify-center pointer-events-none">
            <div className="w-full h-0.5 bg-blue-500/80 absolute animate-pulse"></div>
          </div>
          <Camera className="w-10 h-10 text-slate-400 mb-2 stroke-1" />
          <p className="text-xs font-semibold text-slate-300">Point Barcode Scanner or Camera Here</p>
          <span className="text-[11px] text-slate-500 mt-1">Supports Xprinter 203 DPI TSPL labels & smartphones</span>
        </div>

        {/* Input Form */}
        <form onSubmit={handleLookup} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Scan Input / Asset ID / Scanned QR Text
            </label>
            <div className="relative">
              <input
                type="text"
                autoFocus
                value={assetIdInput}
                onChange={(e) => setAssetIdInput(e.target.value)}
                placeholder="Scan with handheld scanner or type Asset ID (e.g. 1)..."
                className="w-full pl-11 pr-28 py-3 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-mono focus:outline-hidden"
              />
              <QrCode className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
              <button
                type="submit"
                disabled={searching}
                className="absolute right-2 top-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                {searching ? 'Locating...' : 'Open Asset'}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            {errorMsg && <p className="text-xs text-rose-600 mt-2 font-medium">{errorMsg}</p>}
          </div>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Quick shortcut: Asset #1 (M1 Apple)</span>
          <button
            onClick={() => router.push('/assets/1')}
            className="text-blue-600 hover:text-blue-700 font-bold inline-flex items-center gap-1"
          >
            Open M1 Apple #1 <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
