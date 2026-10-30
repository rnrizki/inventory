'use client';

import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import { X, Printer, Bolt, CheckCircle2, AlertCircle, RefreshCw, Smartphone } from 'lucide-react';
import { buildTsplCommand, DEFAULT_ADDRESS, LabelData } from '@/lib/tspl';
import { WebUsbPrinter } from '@/lib/webusb';

const usbPrinter = new WebUsbPrinter();

interface Props {
  isOpen: boolean;
  onClose: () => void;
  asset: any;
}

export default function TsplPrintModal({ isOpen, onClose, asset }: Props) {
  if (!isOpen || !asset) return null;

  // Form State
  const [name, setName] = useState(asset.asset_name || '');
  const [model, setModel] = useState(asset.model_number || '');
  const [serial, setSerial] = useState(asset.serial_number || '');
  const [date, setDate] = useState(asset.purchase_date ? String(asset.purchase_date).split(' ')[0] : '');
  const [supplier, setSupplier] = useState(asset.supplier_name || 'PT. Angan Kreasi Semesta');
  const [address, setAddress] = useState(DEFAULT_ADDRESS);

  // Print Params
  const [widthMm, setWidthMm] = useState(60);
  const [heightMm, setHeightMm] = useState(50);
  const [copies, setCopies] = useState(1);
  const [density, setDensity] = useState(10);
  const [qrType, setQrType] = useState<'url' | 'full' | 'custom'>('url');
  const [customQr, setCustomQr] = useState('');

  // Status & Feedback
  const [printerConnected, setPrinterConnected] = useState(usbPrinter.connected);
  const [deviceInfo, setDeviceInfo] = useState(usbPrinter.deviceInfo);
  const [statusMsg, setStatusMsg] = useState<{ type: 'info' | 'success' | 'warning' | 'error'; text: string } | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [barcodeDataUrl, setBarcodeDataUrl] = useState('');

  // Auto connect on mount
  useEffect(() => {
    if (!usbPrinter.connected) {
      usbPrinter.autoConnect().then(() => {
        setPrinterConnected(usbPrinter.connected);
        setDeviceInfo(usbPrinter.deviceInfo);
      });
    } else {
      setPrinterConnected(true);
      setDeviceInfo(usbPrinter.deviceInfo);
    }
  }, []);

  // Compute QR Data
  const getQrText = () => {
    if (qrType === 'url') {
      if (typeof window !== 'undefined') {
        return `${window.location.origin}/assets/${asset.id}`;
      }
      return `https://inventory.skyconnection.id/assets/${asset.id}`;
    }
    if (qrType === 'full') {
      return `Asset: ${name}\nS/N: ${serial}\nModel: ${model}\nSupplier: ${supplier}`;
    }
    return customQr || `Asset: ${name}`;
  };

  // Generate QR Code image
  useEffect(() => {
    const text = getQrText();
    QRCode.toDataURL(text, { width: 140, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error(err));
  }, [qrType, customQr, name, serial, model, supplier, asset.id]);

  // Generate 1D Barcode image for Serial Number
  useEffect(() => {
    const s = (serial || '').trim();
    if (!s || s === '-') {
      setBarcodeDataUrl('');
      return;
    }
    try {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, s, {
        format: 'CODE128',
        width: 1.2,
        height: 24,
        displayValue: false,
        margin: 0,
      });
      setBarcodeDataUrl(canvas.toDataURL('image/png'));
    } catch (err) {
      console.warn('Barcode render error:', err);
      setBarcodeDataUrl('');
    }
  }, [serial]);

  // Connect WebUSB
  const handleConnectUsb = async () => {
    setStatusMsg(null);
    try {
      await usbPrinter.connect();
      setPrinterConnected(true);
      setDeviceInfo(usbPrinter.deviceInfo);
      setStatusMsg({ type: 'success', text: `Connected to ${usbPrinter.deviceInfo}` });
    } catch (err: any) {
      console.error(err);
      const msg = err.message || String(err);
      if (msg.includes('claim') || msg.includes('Unable') || msg.includes('denied')) {
        setStatusMsg({
          type: 'warning',
          text: 'USB Port dikunci oleh driver macOS CUPS. Gunakan tombol "Browser Print" di samping untuk langsung mencetak.',
        });
      } else {
        setStatusMsg({ type: 'error', text: msg });
      }
    }
  };

  // Print Native TSPL via WebUSB
  const handlePrintTspl = async () => {
    setStatusMsg(null);

    if (!usbPrinter.connected) {
      try {
        await usbPrinter.connect();
        setPrinterConnected(true);
        setDeviceInfo(usbPrinter.deviceInfo);
      } catch (err: any) {
        setStatusMsg({
          type: 'warning',
          text: 'Printer belum terhubung. Gunakan tombol "Browser Print" jika mencetak lewat Mac / driver OS.',
        });
        return;
      }
    }

    const labelData: LabelData = {
      name,
      model,
      serial,
      purchaseDate: date,
      supplier,
      address,
      qrData: getQrText(),
    };

    try {
      setIsPrinting(true);
      const tsplJob = buildTsplCommand(labelData, {
        widthMm,
        heightMm,
        copies,
        density,
      });

      await usbPrinter.write(tsplJob.bytes);
      setStatusMsg({
        type: 'success',
        text: `⚡ Berhasil mencetak ${copies} label ke Xprinter XP-420B via Native TSPL!`,
      });
    } catch (err: any) {
      console.error(err);
      setStatusMsg({ type: 'error', text: 'Gagal mencetak: ' + (err.message || String(err)) });
    } finally {
      setIsPrinting(false);
    }
  };

  // Browser Print Fallback
  const handleBrowserPrint = () => {
    const printWindow = window.open('', '_blank', 'width=650,height=650');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Thermal Label - ${name}</title>
        <style>
          @page {
            size: ${widthMm}mm ${heightMm}mm;
            margin: 0;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            background: #fff;
            width: ${widthMm}mm;
            height: ${heightMm}mm;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #000;
          }
          .label-box {
            width: ${widthMm}mm;
            height: ${heightMm}mm;
            padding: 3mm 3mm 1.25mm 3mm;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .top-row {
            display: flex;
            align-items: flex-start;
            gap: 2mm;
            width: 100%;
          }
          .qr-col {
            width: 42%;
            display: flex;
            align-items: center;
            justify-content: flex-start;
          }
          .qr-img {
            width: 22.5mm;
            height: 22.5mm;
            max-width: 100%;
            object-fit: contain;
          }
          .spec-col {
            width: 56%;
            padding-left: 0.5mm;
          }
          .spec-title {
            font-size: 8pt;
            font-weight: 700;
            line-height: 1.15;
          }
          .spec-val {
            font-size: 6.8pt;
            font-weight: 500;
            margin-top: 3.2mm;
            line-height: 1.25;
            white-space: pre-wrap;
            word-break: break-word;
            max-height: 22mm;
            overflow: hidden;
          }
          .mid-section {
            font-size: 7.2pt;
            line-height: 1.45;
            margin: auto 0;
          }
          .mid-item {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            margin-bottom: 0.5mm;
          }
          .barcode-wrap {
            margin-top: 0.8mm;
            line-height: 0;
          }
          .barcode-img {
            height: 3mm;
            max-width: 48mm;
            object-fit: contain;
          }
          .bot-section {
            margin-top: auto;
          }
          .prop-title {
            font-size: 6.2pt;
            font-weight: 800;
            line-height: 1.15;
          }
          .prop-val {
            font-size: 7.2pt;
            font-weight: 500;
            line-height: 1.15;
            word-break: break-word;
          }
          .prop-address {
            font-size: 5.2pt;
            font-weight: 600;
            color: #111;
            margin-top: 0.5mm;
            line-height: 1.2;
            word-break: break-word;
          }
        </style>
      </head>
      <body>
        <div class="label-box">
          <div class="top-row">
            <div class="qr-col">
              <img src="${qrDataUrl}" class="qr-img" />
            </div>
            <div class="spec-col">
              <div class="spec-title">Specification :</div>
              <div class="spec-val">${model}</div>
            </div>
          </div>
          <div class="mid-section">
            <div class="mid-item"><b>Asset Name :</b> ${name}</div>
            <div class="mid-item"><b>Tahun Pembelian:</b> ${date}</div>
            <div class="mid-item"><b>Serial Number:</b> ${serial}</div>
            ${barcodeDataUrl ? `<div class="barcode-wrap"><img src="${barcodeDataUrl}" class="barcode-img" /></div>` : ''}
          </div>
          <div class="bot-section">
            <div class="prop-title">Property</div>
            <div class="prop-val">${supplier}</div>
            <div class="prop-address">${address}</div>
          </div>
        </div>
        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() { window.close(); };
          };
        <\/script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-xl font-bold">
              ⚡
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">
                Native TSPL Thermal Printer — Xprinter XP-420B
              </h3>
              <p className="text-xs text-slate-400">
                50/50 Split Layout · Large QR · Multi-line Spec (Max 7 Rows) · 203 DPI TSPL
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 bg-slate-50 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Status Bar */}
          <div className="flex items-center justify-between p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="text-xl">🖨️</span>
              <div>
                <div className={`text-sm font-bold ${printerConnected ? 'text-emerald-600' : 'text-blue-600'}`}>
                  {printerConnected ? `Connected: ${deviceInfo}` : 'Printer Not Connected'}
                </div>
                <div className="text-xs text-slate-500">
                  {printerConnected
                    ? 'Direct Native TSPL (203 DPI) ready via WebUSB'
                    : 'Klik Connect Printer (atau gunakan Browser Print untuk Mac CUPS)'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!printerConnected ? (
                <button
                  onClick={handleConnectUsb}
                  className="px-3.5 py-1.5 text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 rounded-lg shadow-sm transition flex items-center gap-1.5"
                >
                  <Bolt className="w-3.5 h-3.5" /> Connect Printer
                </button>
              ) : (
                <button
                  onClick={() => {
                    usbPrinter.disconnect();
                    setPrinterConnected(false);
                  }}
                  className="px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition"
                >
                  Disconnect
                </button>
              )}
            </div>
          </div>

          {/* Alert */}
          {statusMsg && (
            <div
              className={`p-3.5 rounded-xl text-xs font-medium flex items-start gap-2.5 ${
                statusMsg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : statusMsg.type === 'warning'
                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                  : statusMsg.type === 'error'
                  ? 'bg-rose-50 text-rose-800 border border-rose-200'
                  : 'bg-blue-50 text-blue-800 border border-blue-200'
              }`}
            >
              {statusMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">{statusMsg.text}</div>
            </div>
          )}

          {/* Main Grid: Preview on Left, Form on Right */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Live Preview Column */}
            <div className="md:col-span-5 flex flex-col items-center">
              <div className="w-full flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Label Preview</span>
                <span className="text-xs font-semibold bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
                  {widthMm} × {heightMm} mm
                </span>
              </div>

              {/* Exact Card Preview */}
              <div className="w-full p-4 bg-slate-200 rounded-xl flex items-center justify-center">
                <div
                  style={{
                    width: '100%',
                    maxWidth: '320px',
                    aspectRatio: `${widthMm} / ${heightMm}`,
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    padding: '16px 16px 10px 16px',
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
                    color: '#000000',
                    minHeight: '260px',
                  }}
                  className="shadow-md"
                >
                  {/* Top row: Enlarged QR + adjacent Specification (matching TSPL cellWidth 5) */}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', width: '100%' }}>
                    {/* Left half: QR Code */}
                    <div style={{ width: '42%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
                      {qrDataUrl ? (
                        <img src={qrDataUrl} alt="QR" style={{ width: '125px', height: '125px', objectFit: 'contain' }} />
                      ) : (
                        <div style={{ width: '125px', height: '125px', background: '#f1f5f9' }} />
                      )}
                    </div>
                    {/* Right half: Specification directly adjacent to QR */}
                    <div style={{ width: '56%', flex: 1, minWidth: 0, paddingLeft: '2px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#000', lineHeight: 1.2 }}>
                        Specification :
                      </div>
                      <div
                        style={{
                          fontSize: '11px',
                          fontWeight: 500,
                          color: '#111',
                          marginTop: '12px',
                          lineHeight: 1.35,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          maxHeight: '105px',
                          overflow: 'hidden',
                        }}
                      >
                        {model || '-'}
                      </div>
                    </div>
                  </div>

                  {/* Middle lines: Asset Name, Purchase Date, Serial Number + Small Barcode */}
                  <div style={{ margin: '6px 0', fontSize: '11px', lineHeight: 1.45, color: '#111' }}>
                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <b>Asset Name :</b> {name || '-'}
                    </div>
                    <div style={{ marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <b>Tahun Pembelian:</b> {date || '-'}
                    </div>
                    <div style={{ marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <b>Serial Number:</b> {serial || '-'}
                    </div>
                    {barcodeDataUrl && (
                      <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center' }}>
                        <img
                          src={barcodeDataUrl}
                          alt="Serial Barcode"
                          style={{ height: '18px', maxWidth: '170px', objectFit: 'contain' }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Bottom section: Anchored at the very bottom */}
                  <div style={{ marginTop: 'auto', paddingTop: '4px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 800, color: '#000', lineHeight: 1.15 }}>
                      Property
                    </div>
                    <div style={{ fontSize: '11.5px', fontWeight: 500, color: '#111', marginTop: '1px', wordBreak: 'break-word', lineHeight: 1.2 }}>
                      {supplier || '-'}
                    </div>
                    <div style={{ fontSize: '8px', fontWeight: 600, color: '#111', marginTop: '2px', wordBreak: 'break-word', lineHeight: 1.25 }}>
                      {address}
                    </div>
                  </div>
                </div>
              </div>

              {/* Preset buttons */}
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => {
                    setWidthMm(60);
                    setHeightMm(50);
                  }}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg border transition ${
                    widthMm === 60 && heightMm === 50
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  60 × 50 mm (Landscape)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWidthMm(50);
                    setHeightMm(60);
                  }}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg border transition ${
                    widthMm === 50 && heightMm === 60
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  50 × 60 mm (Portrait)
                </button>
              </div>
            </div>

            {/* Form Editor Column */}
            <div className="md:col-span-7 bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3.5">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Label Information
              </span>

              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">Asset Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">
                    Specification (Max 7 Rows)
                  </label>
                  <textarea
                    rows={4}
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="e.g.&#10;HDD 512 GB / Ram&#10;16GB"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 mb-1 block">Tahun Pembelian</label>
                    <input
                      type="text"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 mb-1 block">Serial Number</label>
                    <input
                      type="text"
                      value={serial}
                      onChange={(e) => setSerial(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">Property / Supplier</label>
                <input
                  type="text"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">Company Address / Alamat</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              {/* QR Code Encoding */}
              <div className="pt-2 border-t border-dashed border-slate-200">
                <label className="text-xs font-semibold text-slate-700 mb-1.5 block">QR Code Content</label>
                <div className="flex gap-4 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="qrType"
                      checked={qrType === 'url'}
                      onChange={() => setQrType('url')}
                    />
                    <span>Asset Web URL</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="qrType"
                      checked={qrType === 'full'}
                      onChange={() => setQrType('full')}
                    />
                    <span>Full Asset Info</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="qrType"
                      checked={qrType === 'custom'}
                      onChange={() => setQrType('custom')}
                    />
                    <span>Custom Text</span>
                  </label>
                </div>
                {qrType === 'custom' && (
                  <input
                    type="text"
                    value={customQr}
                    onChange={(e) => setCustomQr(e.target.value)}
                    placeholder="Enter custom QR content..."
                    className="w-full mt-2 text-xs px-3 py-1.5 border border-slate-300 rounded-lg"
                  />
                )}
              </div>

              {/* Hardware Parameters */}
              <div className="pt-2 border-t border-dashed border-slate-200 grid grid-cols-4 gap-2">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Width (mm)</label>
                  <input
                    type="number"
                    value={widthMm}
                    onChange={(e) => setWidthMm(Number(e.target.value))}
                    className="w-full text-xs px-2 py-1 border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Height (mm)</label>
                  <input
                    type="number"
                    value={heightMm}
                    onChange={(e) => setHeightMm(Number(e.target.value))}
                    className="w-full text-xs px-2 py-1 border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Copies</label>
                  <input
                    type="number"
                    min={1}
                    value={copies}
                    onChange={(e) => setCopies(Math.max(1, Number(e.target.value)))}
                    className="w-full text-xs px-2 py-1 border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Darkness</label>
                  <select
                    value={density}
                    onChange={(e) => setDensity(Number(e.target.value))}
                    className="w-full text-xs px-2 py-1 border border-slate-300 rounded bg-white"
                  >
                    <option value={8}>8 (Normal)</option>
                    <option value={10}>10 (Rich Black)</option>
                    <option value={12}>12 (Deep)</option>
                    <option value={14}>14 (Maximum)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-100 border-t border-slate-200">
          <div className="text-xs text-slate-500">
            Compatible with <b>Xprinter XP-420B</b>, XP-365B & TSPL printers
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition"
            >
              Close
            </button>
            <button
              onClick={handleBrowserPrint}
              className="px-4 py-2 text-xs font-semibold text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-xs transition flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" /> Browser Print
            </button>
            <button
              onClick={handlePrintTspl}
              disabled={isPrinting}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md shadow-blue-500/20 transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <Bolt className="w-3.5 h-3.5" />
              {isPrinting ? 'Printing...' : '⚡ Print Native TSPL (Xprinter)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
