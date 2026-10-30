'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Info,
  Check,
  X,
  FileText,
} from 'lucide-react';

export default function ImportAssetsPage() {
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [simulatedData, setSimulatedData] = useState<any>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const sampleHeaders = [
    '* Asset name',
    'Category name',
    'Location name',
    'Model number',
    'Serial number',
    'Purchase cost',
    'Purchase date',
    'Supplier name',
    'Supplier phone',
    'Supplier address',
    'Assigned to',
    'Warranty (months)',
    'Asset Image (Direct URL)',
  ];

  const sampleRows = [
    [
      'ThinkPad X1 Carbon',
      'Laptop PC',
      'Head Office',
      'Core i7 / 16GB / 512GB SSD',
      'TP-98234123',
      '15000000',
      '2026-01-15',
      'PT. Angan Kreasi Semesta',
      '08123456789',
      'Jl. Gotong Royong I No.50',
      'Ahmad Fauzi',
      '24',
      'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=600',
    ],
    [
      'Dell UltraSharp 27"',
      'Monitor',
      'Head Office',
      '4K IPS Display U2723QE',
      'DEL-4412998',
      '6500000',
      '2026-02-10',
      'PT. Angan Kreasi Semesta',
      '08123456789',
      'Jl. Gotong Royong I No.50',
      '',
      '36',
      'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=600',
    ],
    [
      'Xprinter XP-420B',
      'Thermal Printer',
      'Warehouse',
      '203 DPI TSPL USB Printer',
      'XP420B-883120',
      '950000',
      '2026-03-01',
      'PT. Angan Kreasi Semesta',
      '08123456789',
      'Jl. Gotong Royong I No.50',
      'Warehouse Team',
      '12',
      'https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?w=600',
    ],
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setErrorMsg('');
    setSimulatedData(null);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text);
    };
    reader.readAsText(selected, 'UTF-8');
  };

  const handleImport = async (simulate = false) => {
    if (!csvContent) {
      setErrorMsg('Please select a valid CSV file first.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/assets/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText: csvContent, simulate }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to process CSV');
      }

      if (simulate) {
        setSimulatedData(json);
      } else {
        setImportResult(json);
        setSimulatedData(null);
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header & Back Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/assets')}
            className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Import Assets in Bulk</h1>
            <p className="text-xs text-slate-500 mt-0.5">Upload asset records using CSV file format</p>
          </div>
        </div>

        <a
          href="/api/assets/sample-csv"
          download="sample_assets.csv"
          className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition"
        >
          <Download className="w-4 h-4 text-blue-600" />
          Download Sample CSV
        </a>
      </div>

      {/* Guidelines Box */}
      <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-5 mb-8 text-xs text-blue-900 leading-relaxed shadow-xs">
        <h4 className="font-bold flex items-center gap-2 text-sm text-blue-950 mb-2">
          <Info className="w-4 h-4 text-blue-600" /> Import Guidelines & Specifications
        </h4>
        <ol className="list-decimal pl-5 space-y-1.5 text-blue-900/90 font-medium">
          <li>
            Your CSV data should be formatted as shown below. The first row must contain column headers. Ensure the file is saved as <strong className="text-blue-950 font-bold">UTF-8</strong>.
          </li>
          <li>
            Date fields must strictly follow the <strong className="text-blue-950 font-bold">YYYY-MM-DD</strong> format (e.g. <code>2026-10-30</code>).
          </li>
          <li>
            Category and Location columns accept either category/location names (e.g. <code>Laptop PC</code>, <code>Head Office</code>) or existing numeric IDs. Missing categories/locations will be automatically created!
          </li>
          <li>
            Columns marked with <strong className="text-rose-600 font-bold">*</strong> (<code className="text-rose-600 font-bold">* Asset name</code>) are required.
          </li>
          <li>
            <strong className="text-blue-950 font-bold">Image URL / Picture:</strong> Include an <code>asset_image</code> or <code>image_url</code> column with a direct image link (e.g. <code>https://.../photo.jpg</code>) to automatically import asset photos in bulk!
          </li>
        </ol>
      </div>

      {/* Sample Table Preview Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs mb-8 overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">CSV Data Format Sample</span>
          <span className="text-[11px] text-slate-500">Preview of recommended columns</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs divide-y divide-slate-200">
            <thead className="bg-slate-100/75 text-slate-600 font-bold">
              <tr>
                {sampleHeaders.map((h, i) => (
                  <th key={i} className="py-2.5 px-3 whitespace-nowrap">
                    {h.startsWith('*') ? (
                      <span className="text-rose-600">{h}</span>
                    ) : (
                      h
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {sampleRows.map((r, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-50/50">
                  {r.map((cell, cIdx) => (
                    <td key={cIdx} className="py-2.5 px-3 whitespace-nowrap text-slate-700">
                      {cell || '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload & Action Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 mb-8">
        <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Upload className="w-4 h-4 text-blue-600" /> Choose CSV File to Upload
        </h3>

        <div className="max-w-xl">
          <div className="flex items-center gap-3">
            <input
              type="file"
              id="csv-file-input"
              accept=".csv"
              onChange={handleFileChange}
              className="text-xs file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 file:cursor-pointer text-slate-600 cursor-pointer"
            />
          </div>

          {file && (
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span className="font-bold text-slate-800">{file.name}</span>
              <span className="text-slate-400">({(file.size / 1024).toFixed(1)} KB)</span>
            </div>
          )}

          {errorMsg && (
            <div className="mt-3 p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {errorMsg}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={() => handleImport(false)}
              disabled={loading || !file}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading && !simulatedData ? 'Importing Assets...' : 'Import Assets'}
            </button>

            <button
              onClick={() => handleImport(true)}
              disabled={loading || !file}
              className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-5 py-2.5 rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading && simulatedData ? 'Simulating...' : 'Simulate Import (Preview)'}
            </button>
          </div>
        </div>
      </div>

      {/* Success Notification */}
      {importResult && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 mb-8 text-center max-w-xl mx-auto shadow-xs">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-extrabold text-emerald-950 mb-1">Import Completed Successfully!</h3>
          <p className="text-xs text-emerald-800 mb-5">
            {importResult.message || `Successfully registered ${importResult.importedCount} assets.`}
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => router.push('/assets')}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl text-xs font-bold transition shadow-xs"
            >
              View Assets List <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Simulation / Verification Table */}
      {simulatedData && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Simulation Validation Results</h3>
              <p className="text-xs text-slate-500 mt-0.5">Previewing parsed records before database insertion</p>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold">
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg">
                ✓ {simulatedData.validCount} Valid
              </span>
              {simulatedData.invalidCount > 0 && (
                <span className="bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-lg">
                  ✕ {simulatedData.invalidCount} Invalid
                </span>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs divide-y divide-slate-100">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Row</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Photo</th>
                  <th className="py-3 px-4">Asset Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Serial</th>
                  <th className="py-3 px-4">Purchase Cost</th>
                  <th className="py-3 px-4">Assigned To</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {simulatedData.rows?.map((row: any) => (
                  <tr key={row.rowNumber} className={row.isValid ? 'hover:bg-slate-50/50' : 'bg-rose-50/40'}>
                    <td className="py-3 px-4 font-mono text-slate-400">#{row.rowNumber}</td>
                    <td className="py-3 px-4">
                      {row.isValid ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-200">
                          <Check className="w-3 h-3" /> Valid
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 px-2 py-0.5 rounded text-[10px] font-bold border border-rose-200">
                          <X className="w-3 h-3" /> {row.errors?.join(', ')}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {row.data.asset_image ? (
                        <img
                          src={row.data.asset_image}
                          alt=""
                          className="w-9 h-9 object-cover rounded-lg border border-slate-200 bg-white"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800">{row.data.asset_name || '-'}</td>
                    <td className="py-3 px-4 text-slate-600">{row.data.category_name || '-'}</td>
                    <td className="py-3 px-4 text-slate-600">{row.data.location_name || '-'}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">{row.data.serial_number || '-'}</td>
                    <td className="py-3 px-4 font-mono text-slate-700">
                      {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(row.data.purchase_cost || 0)}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{row.data.assigned_to || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
            <button
              onClick={() => handleImport(false)}
              disabled={loading || simulatedData.validCount === 0}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-50"
            >
              Confirm & Import {simulatedData.validCount} Assets <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
