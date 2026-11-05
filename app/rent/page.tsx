'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeftRight,
  ScanLine,
  Camera,
  CameraOff,
  Search,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  RotateCcw,
  Printer,
  FileText,
  User,
  Calendar,
  Volume2,
  VolumeX,
  X,
  RefreshCw,
  Box,
  Layers,
  ArrowRight,
  Check,
  Building,
  Phone,
  ShieldCheck,
  ShieldAlert,
  Undo2,
} from 'lucide-react';
import { fileToOptimizedDataUrl, rotateImageDataUrl } from '@/lib/image-upload';
import { ASSET_STATUSES, getStatusInfo } from '@/lib/status';

interface StagedAsset {
  id: number;
  asset_name: string;
  serial_number: string;
  category_name?: string;
  location_name?: string;
  asset_status: number;
  assigned_to?: string;
  asset_image?: string;
}

export default function RentPage() {
  const router = useRouter();

  // Mode: 'allocate' (Peminjaman / Check-Out) or 'revocate' (Pengembalian / Check-In)
  const [mode, setMode] = useState<'allocate' | 'revocate'>('allocate');

  // Staged Assets Queue
  const [stagedAssets, setStagedAssets] = useState<StagedAsset[]>([]);

  // Search & Input States
  const [barcodeInput, setBarcodeInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StagedAsset[]>([]);
  const [searching, setSearching] = useState(false);

  // Scanner States
  const [isScanning, setIsScanning] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [scanToast, setScanToast] = useState<{ text: string; type: 'success' | 'warn' | 'error' } | null>(null);

  const scannerRef = useRef<any>(null);
  const lastScannedTimeRef = useRef<{ [code: string]: number }>({});

  // Handover Details Form
  const [assignedTo, setAssignedTo] = useState('');
  const [transactionDate, setTransactionDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [notes, setNotes] = useState('');

  // Camera Proof
  const [capturedImage, setCapturedImage] = useState<string>('');
  const [rotatingImage, setRotatingImage] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  // Digital Signature Pad
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const undoStackRef = useRef<ImageData[]>([]);

  // Execution & Modals
  const [submitting, setSubmitting] = useState(false);
  const [executedBatch, setExecutedBatch] = useState<{
    batch_code: string;
    action: string;
    count: number;
    image_url?: string;
    assets: StagedAsset[];
    assigned_to: string;
    date: string;
    expected_return_date: string;
    notes: string;
    signature?: string;
  } | null>(null);
  const [showSuratJalanModal, setShowSuratJalanModal] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ email: string; name: string; role: string; canEdit: boolean } | null>(null);

  // Fetch Current User & Verify Privileges in background
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.authenticated && d.user) {
          setCurrentUser(d.user);
          if (!d.user.canEdit) {
            router.replace('/assets');
          }
        }
      })
      .catch(() => {});
  }, [router]);

  // Web Audio Synthesizer Beep
  const playBeep = (freq = 880, duration = 0.12) => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      // Audio autoplay policy fallback
    }
  };

  const showToast = (text: string, type: 'success' | 'warn' | 'error' = 'success') => {
    setScanToast({ text, type });
    setTimeout(() => setScanToast(null), 3000);
  };

  // Add Asset to Staging List
  const addAssetToStaging = (asset: StagedAsset) => {
    // Check if already in staging
    if (stagedAssets.some((item) => item.id === asset.id)) {
      showToast(`Asset #${asset.id} (${asset.asset_name}) sudah ada di antrean!`, 'warn');
      playBeep(440, 0.2);
      return;
    }

    setStagedAssets((prev) => [asset, ...prev]);
    showToast(`Ditambahkan: ${asset.asset_name} (#${asset.id})`, 'success');
    playBeep(880, 0.12);
  };

  // Remove Asset from Staging
  const removeAssetFromStaging = (assetId: number) => {
    setStagedAssets((prev) => prev.filter((a) => a.id !== assetId));
  };

  // Search Asset by Barcode, QR, ID, or Serial
  const lookupAssetByCode = async (rawCode: string): Promise<StagedAsset | null> => {
    const val = rawCode.trim();
    if (!val) return null;

    // 1. Direct Numeric ID match
    if (/^\d+$/.test(val)) {
      try {
        const res = await fetch(`/api/assets/${val}`);
        const json = await res.json();
        if (json.success && json.data) {
          return json.data;
        }
      } catch (e) {}
    }

    // 2. Asset URL check e.g. https://.../assets/9
    const urlMatch = val.match(/\/assets\/(\d+)/i);
    if (urlMatch && urlMatch[1]) {
      try {
        const res = await fetch(`/api/assets/${urlMatch[1]}`);
        const json = await res.json();
        if (json.success && json.data) {
          return json.data;
        }
      } catch (e) {}
    }

    // 3. Search query by serial number, name, or model
    const snMatch = val.match(/(?:S\/N|Serial|SN)[\s:]+([^\r\n,;]+)/i);
    const searchTerm = snMatch && snMatch[1] ? snMatch[1].trim() : val;

    try {
      const res = await fetch(`/api/assets?q=${encodeURIComponent(searchTerm)}`);
      const json = await res.json();
      if (json.success && json.data && json.data.length > 0) {
        return json.data[0];
      }
    } catch (e) {}

    return null;
  };

  // Handle Manual or Handheld Gun Input
  const handleDirectBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const code = barcodeInput.trim();
    setBarcodeInput('');

    const asset = await lookupAssetByCode(code);
    if (asset) {
      addAssetToStaging(asset);
    } else {
      showToast(`Aset tidak ditemukan untuk kode: "${code}"`, 'error');
      playBeep(300, 0.25);
    }
  };

  // Live Search Autocomplete
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        const res = await fetch(`/api/assets?q=${encodeURIComponent(searchQuery.trim())}`);
        const json = await res.json();
        if (json.success && json.data) {
          // Filter out items already staged
          const filtered = json.data.filter(
            (item: StagedAsset) => !stagedAssets.some((s) => s.id === item.id)
          );
          setSearchResults(filtered.slice(0, 8));
        }
      } catch (e) {
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, stagedAssets]);

  // Start / Stop Camera Scanner (HTML5-QRCode)
  const startCamera = async (cameraId?: string) => {
    setIsCameraLoading(true);
    try {
      const { Html5Qrcode } = await import('html5-qrcode');

      // Ensure container element is in DOM
      const container = document.getElementById('rent-qr-reader');
      if (!container) {
        console.warn('rent-qr-reader container not found in DOM yet');
        setIsCameraLoading(false);
        return;
      }

      // Stop and clear any previous scanner instance
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            await scannerRef.current.stop();
          }
          await scannerRef.current.clear();
        } catch (e) {}
        scannerRef.current = null;
      }

      const html5QrCode = new Html5Qrcode('rent-qr-reader');
      scannerRef.current = html5QrCode;

      // Check available cameras
      let availableCameras: Array<{ id: string; label: string }> = [];
      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          availableCameras = devices.map((d) => ({
            id: d.id,
            label: d.label || `Camera ${d.id.slice(0, 4)}`,
          }));
          setCameras(availableCameras);
        }
      } catch (e) {
        // Querying devices can fail if permission is not yet granted
      }

      // Determine camera configuration
      let targetCameraConfig: any = null;
      const chosenId = cameraId || selectedCameraId;
      if (chosenId) {
        targetCameraConfig = { deviceId: { exact: chosenId } };
      } else if (availableCameras.length > 0) {
        const backCam = availableCameras.find(
          (d) =>
            d.label.toLowerCase().includes('back') ||
            d.label.toLowerCase().includes('rear') ||
            d.label.toLowerCase().includes('environment')
        );
        const chosen = backCam || availableCameras[0];
        setSelectedCameraId(chosen.id);
        targetCameraConfig = { deviceId: { exact: chosen.id } };
      } else {
        targetCameraConfig = { facingMode: 'environment' };
      }

      const qrConfig = {
        fps: 15,
        qrbox: (w: number, h: number) => {
          const edge = Math.min(w, h) * 0.75;
          return {
            width: Math.max(200, Math.floor(edge)),
            height: Math.max(200, Math.floor(edge)),
          };
        },
        aspectRatio: 1.0,
      };

      const onScanSuccess = async (decodedText: string) => {
        const now = Date.now();
        const lastTime = lastScannedTimeRef.current[decodedText] || 0;
        // 2.5 second debounce per barcode so continuous scanner doesn't spam
        if (now - lastTime < 2500) return;
        lastScannedTimeRef.current[decodedText] = now;

        const asset = await lookupAssetByCode(decodedText);
        if (asset) {
          addAssetToStaging(asset);
        } else {
          showToast(`Aset tidak terdaftar: ${decodedText}`, 'warn');
          playBeep(350, 0.2);
        }
      };

      try {
        await html5QrCode.start(targetCameraConfig, qrConfig, onScanSuccess, () => {});
      } catch (startErr: any) {
        console.warn('Initial camera start failed, trying fallback to front/user camera...', startErr);
        try {
          await html5QrCode.start({ facingMode: 'user' }, qrConfig, onScanSuccess, () => {});
        } catch (fallbackErr: any) {
          // Final fallback to generic video stream
          await html5QrCode.start(true as any, qrConfig, onScanSuccess, () => {});
        }
      }

      setIsScanning(true);
      setIsCameraLoading(false);
    } catch (err: any) {
      console.error('Camera scan error:', err);
      setIsScanning(false);
      setIsCameraOpen(false);
      setIsCameraLoading(false);

      let msg = 'Gagal mengakses kamera. ';
      if (err?.name === 'NotAllowedError' || err?.message?.includes('Permission denied')) {
        msg += 'Izin kamera diblokir browser. Mohon izinkan akses kamera pada ikon gembok bilah URL browser Anda.';
      } else if (err?.name === 'NotFoundError' || err?.message?.includes('No camera')) {
        msg += 'Tidak ada perangkat kamera yang terdeteksi di perangkat ini.';
      } else if (err?.name === 'NotReadableError' || err?.message?.includes('Could not start video source')) {
        msg += 'Kamera sedang digunakan oleh aplikasi atau tab browser lain.';
      } else {
        msg += err?.message || 'Periksa izin kamera browser.';
      }
      showToast(msg, 'error');
    }
  };

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (e) {
        console.warn('Error stopping scanner:', e);
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
    setIsCameraLoading(false);
  };

  useEffect(() => {
    if (isCameraOpen) {
      startCamera(selectedCameraId);
    } else {
      stopCamera();
    }
  }, [isCameraOpen]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Handover Photo Proof Handler
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      // Pre-optimize image to max 800px width with automatic EXIF orientation
      const optimizedUrl = await fileToOptimizedDataUrl(file, 800, 0.85);
      setCapturedImage(optimizedUrl);
    } catch (err: any) {
      console.error('Failed to optimize photo proof:', err);
    }
  };

  const handleRotateImage = async (degrees: number) => {
    if (!capturedImage || rotatingImage) return;
    try {
      setRotatingImage(true);
      const rotated = await rotateImageDataUrl(capturedImage, degrees);
      setCapturedImage(rotated);
    } catch (err) {
      console.error('Failed to rotate photo preview:', err);
    } finally {
      setRotatingImage(false);
    }
  };

  // Canvas Signature Pad
  const setupCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
    return { canvas, ctx };
  };

  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const res = setupCanvas();
    if (!res) return;
    const { canvas, ctx } = res;

    // Snapshot for undo
    const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    undoStackRef.current.push(snapshot);

    setIsDrawing(true);
    setHasDrawn(true);
    const { x, y } = getCanvasCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const res = setupCanvas();
    if (!res) return;
    const { ctx } = res;
    const { x, y } = getCanvasCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const res = setupCanvas();
    if (!res) return;
    const { canvas, ctx } = res;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    undoStackRef.current = [];
    setHasDrawn(false);
  };

  const undoCanvas = () => {
    const res = setupCanvas();
    if (!res || undoStackRef.current.length === 0) return;
    const { canvas, ctx } = res;
    const prev = undoStackRef.current.pop();
    if (prev) {
      ctx.putImageData(prev, 0, 0);
      if (undoStackRef.current.length === 0) {
        setHasDrawn(false);
      }
    }
  };

  const getSignatureDataUrl = (): string => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return '';
    return canvas.toDataURL('image/png');
  };

  // Submit Bulk Allocation or Revocation
  const handleExecuteBulk = async () => {
    if (stagedAssets.length === 0) {
      alert('Pilih atau scan minimal 1 aset terlebih dahulu.');
      return;
    }

    if (mode === 'allocate' && !assignedTo.trim()) {
      alert('Nama penerima / peminjam (Assigned To) wajib diisi untuk transaksi Allocate.');
      return;
    }

    const actionText = mode === 'allocate' ? 'Peminjaman (Allocate)' : 'Pengembalian (Revocate)';
    if (
      !confirm(
        `Konfirmasi eksekusi ${actionText} untuk ${stagedAssets.length} aset terpilih?`
      )
    ) {
      return;
    }

    try {
      setSubmitting(true);
      const signatureDataUrl = getSignatureDataUrl();

      const payload = {
        action: mode,
        asset_ids: stagedAssets.map((a) => a.id),
        assigned_to: assignedTo.trim(),
        date: transactionDate,
        expected_return_date: expectedReturnDate,
        notes: notes.trim(),
        image: capturedImage || undefined,
        signature: signatureDataUrl || undefined,
      };

      const res = await fetch('/api/rent/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        // Save executed batch state for immediate Surat Jalan preview & printing
        const batchInfo = {
          batch_code: json.batch_code,
          action: mode,
          count: stagedAssets.length,
          image_url: json.image_url || capturedImage,
          assets: [...stagedAssets],
          assigned_to: assignedTo.trim(),
          date: transactionDate,
          expected_return_date: expectedReturnDate,
          notes: notes.trim(),
          signature: signatureDataUrl,
        };

        setExecutedBatch(batchInfo);
        setShowSuratJalanModal(true);

        // Reset form
        setStagedAssets([]);
        setAssignedTo('');
        setExpectedReturnDate('');
        setNotes('');
        setCapturedImage('');
        clearCanvas();
        playBeep(1046, 0.2); // High confirmation beep
      } else {
        alert(json.error || 'Gagal mengeksekusi transaksi masal');
      }
    } catch (err: any) {
      alert(err.message || 'Error executing bulk rent transaction');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 xl:-mx-10 2xl:-mx-12 -mt-6 pb-20">
      {/* Toast Notification */}
      {scanToast && (
        <div className="fixed top-20 right-6 z-50 animate-bounce">
          <div
            className={`px-4 py-2.5 rounded-xl shadow-lg border text-xs font-bold flex items-center gap-2 ${
              scanToast.type === 'success'
                ? 'bg-emerald-600 text-white border-emerald-500'
                : scanToast.type === 'warn'
                ? 'bg-amber-500 text-white border-amber-400'
                : 'bg-rose-600 text-white border-rose-500'
            }`}
          >
            {scanToast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertTriangle className="w-4 h-4" />
            )}
            <span>{scanToast.text}</span>
          </div>
        </div>
      )}

      {/* Top Banner Navigation Header */}
      <div className="bg-white border-b border-slate-200 print:hidden">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                <ArrowLeftRight className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                  Rent & Equipment Dispatch
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Scan barcode masal untuk peminjaman (Allocate) atau pengembalian (Revocate) sekaligus cetak Surat Jalan.
                </p>
              </div>
            </div>

            {/* Mode Selector Tabs */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setMode('allocate')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition shadow-xs ${
                  mode === 'allocate'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Bulk Allocate (Pinjam)</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('revocate')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition shadow-xs ${
                  mode === 'revocate'
                    ? 'bg-white text-red-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Bulk Revocate (Kembali)</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 pt-6 print:hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: Multi-Product Scanner & Staging List (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* 1. Barcode & QR Scanner Box */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ScanLine className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-800">Pemindai Barcode / QR Cepat</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
                    title={soundEnabled ? 'Matikan Suara Beep' : 'Aktifkan Suara Beep'}
                  >
                    {soundEnabled ? (
                      <Volume2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <VolumeX className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (isCameraOpen) {
                        setIsCameraOpen(false);
                      } else {
                        setIsCameraOpen(true);
                      }
                    }}
                    disabled={isCameraLoading}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-xs cursor-pointer ${
                      isCameraOpen
                        ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                        : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-70'
                    }`}
                  >
                    {isCameraLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Mengakses Kamera...
                      </>
                    ) : isCameraOpen ? (
                      <>
                        <CameraOff className="w-3.5 h-3.5" /> Stop Kamera
                      </>
                    ) : (
                      <>
                        <Camera className="w-3.5 h-3.5" /> Aktifkan Kamera
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Viewfinder Canvas Container */}
              {isCameraOpen && (
                <div className="mb-4 rounded-xl overflow-hidden border border-slate-300 bg-slate-950 relative min-h-[220px] flex items-center justify-center">
                  <div id="rent-qr-reader" className="w-full max-h-[340px] aspect-video"></div>

                  {isCameraLoading && (
                    <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center text-white gap-2.5 z-20">
                      <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
                      <p className="text-xs font-semibold">Menginisialisasi Kamera Pemindai...</p>
                      <span className="text-[11px] text-slate-400">Pastikan izin kamera diizinkan di browser</span>
                    </div>
                  )}

                  {isScanning && !isCameraLoading && (
                    <>
                      <div className="absolute top-2 left-2 z-10 bg-black/60 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 backdrop-blur-xs">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                        Continuous Scan Aktif
                      </div>
                      {cameras.length > 1 && (
                        <div className="absolute bottom-2 right-2 z-10">
                          <select
                            value={selectedCameraId}
                            onChange={(e) => {
                              setSelectedCameraId(e.target.value);
                              stopCamera().then(() => startCamera(e.target.value));
                            }}
                            className="text-xs bg-black/75 text-white border border-white/20 rounded-lg px-2.5 py-1 backdrop-blur-xs"
                          >
                            {cameras.map((c) => (
                              <option key={c.id} value={c.id} className="text-black">
                                {c.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Direct Barcode Input / USB Gun Scanner Listener */}
              <form onSubmit={handleDirectBarcodeSubmit} className="flex gap-2">
                <div className="relative flex-1">
                  <ScanLine className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    placeholder="Scan barcode gun / ketik Asset ID atau Serial Number..."
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-hidden bg-slate-50 focus:bg-white transition"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!barcodeInput.trim()}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah
                </button>
              </form>

              {/* Autocomplete Name Search */}
              <div className="relative mt-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Atau cari nama aset secara manual..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg outline-hidden text-slate-700 bg-white"
                  />
                  {searching && (
                    <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
                  )}
                </div>

                {searchResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 max-h-56 overflow-y-auto divide-y divide-slate-100">
                    {searchResults.map((asset) => (
                      <div
                        key={asset.id}
                        onClick={() => {
                          addAssetToStaging(asset);
                          setSearchQuery('');
                          setSearchResults([]);
                        }}
                        className="p-2.5 hover:bg-blue-50 cursor-pointer flex items-center justify-between text-xs transition"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                            {asset.asset_image ? (
                              <img src={asset.asset_image} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Box className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800">{asset.asset_name}</p>
                            <p className="text-[11px] text-slate-500">
                              SN: {asset.serial_number || '-'} • ID #{asset.id} • {asset.location_name || '-'}
                            </p>
                          </div>
                        </div>
                        <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                          + Pilih
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 2. Staged Queue Table */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-800">Daftar Barang Terpilih (Antrean)</h3>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                    {stagedAssets.length} Barang
                  </span>
                </div>
                {stagedAssets.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Kosongkan semua daftar barang yang sudah di-scan?')) {
                        setStagedAssets([]);
                      }
                    }}
                    className="text-xs text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Kosongkan
                  </button>
                )}
              </div>

              {stagedAssets.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <Box className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                  <p className="text-xs font-semibold">Belum ada barang yang di-scan atau dipilih.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Gunakan kamera di atas atau ketik nomor seri barcode untuk memasukkan barang.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs divide-y divide-slate-100">
                    <thead className="bg-slate-50 text-slate-500 font-semibold">
                      <tr>
                        <th className="px-4 py-3 whitespace-nowrap">Asset</th>
                        <th className="px-4 py-3 whitespace-nowrap">Kategori / Lokasi</th>
                        <th className="px-4 py-3 whitespace-nowrap">Serial Number</th>
                        <th className="px-4 py-3 whitespace-nowrap">Status Saat Ini</th>
                        <th className="px-4 py-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {stagedAssets.map((asset, index) => {
                        const statusInfo = getStatusInfo(asset.asset_status);
                        return (
                          <tr key={asset.id} className="hover:bg-slate-50/60 transition">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <span className="font-mono text-slate-400 text-[11px] w-4">{index + 1}.</span>
                                <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                                  {asset.asset_image ? (
                                    <img src={asset.asset_image} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <Box className="w-4 h-4 text-slate-400" />
                                  )}
                                </div>
                                <div>
                                  <span className="font-bold text-slate-900 block">{asset.asset_name}</span>
                                  <span className="text-[11px] font-mono text-slate-400">#{asset.id}</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="font-medium text-slate-700 block">{asset.category_name || '-'}</span>
                              <span className="text-[11px] text-slate-400">{asset.location_name || '-'}</span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap font-mono text-slate-600">
                              {asset.serial_number || '-'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${statusInfo.bg} ${statusInfo.color} ${statusInfo.border}`}
                              >
                                <span>{statusInfo.icon}</span>
                                <span>{statusInfo.name}</span>
                              </span>
                              {asset.assigned_to && (
                                <span className="block text-[10px] text-amber-700 mt-0.5">
                                  Peminjam: {asset.assigned_to}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => removeAssetFromStaging(asset.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                                title="Hapus dari antrean"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Transaction Details, Proof Photo & Signature (5 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-sm font-bold text-slate-800">
                    {mode === 'allocate' ? 'Detail Peminjaman (Rent Out)' : 'Detail Pengembalian (Return)'}
                  </h3>
                </div>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    mode === 'allocate' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                  }`}
                >
                  {mode}
                </span>
              </div>

              {/* Form Fields */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {mode === 'allocate' ? 'Nama Peminjam / Departemen *' : 'Diterima Dari (Staf / Pengembali)'}
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={assignedTo}
                      onChange={(e) => setAssignedTo(e.target.value)}
                      placeholder={mode === 'allocate' ? 'e.g. Creative Dept / Budi Santoso' : 'e.g. Budi Santoso'}
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-hidden bg-slate-50 focus:bg-white"
                      required={mode === 'allocate'}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal Transaksi</label>
                    <input
                      type="date"
                      value={transactionDate}
                      onChange={(e) => setTransactionDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Estimasi Kembali</label>
                    <input
                      type="date"
                      value={expectedReturnDate}
                      onChange={(e) => setExpectedReturnDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Catatan Serah Terima / Kondisi</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Catatan kondisi kelengkapan (kabel power, adaptor, dus, dsb)..."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-hidden"
                  />
                </div>
              </div>

              {/* Photo Proof with Camera Capture & Rotation Tools */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-blue-600" />
                    <span>Foto Bukti Serah Terima</span>
                  </label>
                  {capturedImage && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Foto Terlampir
                    </span>
                  )}
                </div>

                {capturedImage ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                    <div className="relative flex items-center justify-center bg-slate-950 rounded-lg p-2 overflow-hidden min-h-[160px] max-h-[220px]">
                      <img
                        src={capturedImage}
                        alt="Handover Preview"
                        className="max-h-[200px] max-w-full object-contain rounded shadow-sm"
                      />
                      {rotatingImage && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center text-white text-xs font-semibold gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
                          <span>Memutar gambar...</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={rotatingImage}
                          onClick={() => handleRotateImage(-90)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold shadow-2xs transition disabled:opacity-50"
                          title="Putar Kiri (-90°)"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
                          <span>Putar Kiri</span>
                        </button>
                        <button
                          type="button"
                          disabled={rotatingImage}
                          onClick={() => handleRotateImage(90)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold shadow-2xs transition disabled:opacity-50"
                          title="Putar Kanan (+90°)"
                        >
                          <RotateCw className="w-3.5 h-3.5 text-blue-600" />
                          <span>Putar Kanan</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={rotatingImage}
                          onClick={() => cameraInputRef.current?.click()}
                          className="text-blue-600 hover:text-blue-700 font-bold text-xs"
                        >
                          Ambil Ulang
                        </button>
                        <span className="text-slate-300">•</span>
                        <button
                          type="button"
                          disabled={rotatingImage}
                          onClick={() => setCapturedImage('')}
                          className="text-rose-600 hover:text-rose-700 font-bold text-xs"
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="w-full py-3 border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl text-slate-600 hover:text-blue-600 text-xs font-bold flex items-center justify-center gap-2 transition bg-slate-50 hover:bg-blue-50/50"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Buka Kamera / Upload Foto Bukti</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Digital Signature Pad */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">Tanda Tangan Penerima / Peminjam</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={undoCanvas}
                      className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-0.5"
                    >
                      <Undo2 className="w-3 h-3" /> Undo
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={clearCanvas}
                      className="text-[11px] font-semibold text-rose-600 hover:text-rose-700"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="border border-slate-300 rounded-xl overflow-hidden bg-white shadow-2xs">
                  <canvas
                    ref={canvasRef}
                    width={400}
                    height={120}
                    onPointerDown={startDrawing}
                    onPointerMove={draw}
                    onPointerUp={stopDrawing}
                    onPointerLeave={stopDrawing}
                    className="w-full h-24 touch-none cursor-crosshair bg-slate-50/50"
                  />
                </div>
                <p className="text-[10px] text-slate-400">Tanda tangan langsung pada kotak di atas menggunakan mouse atau sentuhan jari.</p>
              </div>

              {/* Execution Actions */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <button
                  type="button"
                  disabled={submitting || stagedAssets.length === 0}
                  onClick={handleExecuteBulk}
                  className={`w-full py-3 rounded-xl text-xs font-extrabold text-white flex items-center justify-center gap-2 transition shadow-md ${
                    mode === 'allocate'
                      ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/25'
                      : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/25'
                  } disabled:opacity-50`}
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Memproses Transaksi...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>
                        Eksekusi Bulk {mode === 'allocate' ? 'Allocate' : 'Revocate'} ({stagedAssets.length} Barang)
                      </span>
                    </>
                  )}
                </button>

                {executedBatch && (
                  <button
                    type="button"
                    onClick={() => setShowSuratJalanModal(true)}
                    className="w-full py-2.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center gap-2 transition"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Cetak Surat Jalan ({executedBatch.batch_code})</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL / SURAT JALAN PRINT PREVIEW (A4 Print-Ready) */}
      {showSuratJalanModal && executedBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in print:p-0 print:bg-white print:static">
          <div className="relative max-w-3xl w-full bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden print:border-none print:shadow-none print:w-full print:max-w-none">
            {/* Modal Header (Hidden during Print) */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-bold">Pratinjau Surat Jalan & Bukti Serah Terima</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" /> Cetak / Download PDF
                </button>
                <button
                  type="button"
                  onClick={() => setShowSuratJalanModal(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Official A4 Document Layout */}
            <div className="p-8 sm:p-10 text-slate-800 font-sans print:p-8" id="printable-surat-jalan">
              {/* Header Letterhead */}
              <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-800 flex items-center justify-center text-white font-black text-xl shadow-sm">
                    SK
                  </div>
                  <div>
                    <h2 className="text-lg font-black tracking-tight text-slate-900 uppercase">
                      SkyConnection Mandiri
                    </h2>
                    <p className="text-[11px] text-slate-500">Asset Central & Enterprise Equipment Management</p>
                    <p className="text-[11px] text-slate-400">Jl. Gotong Royong I No.50, Ragunan, Jakarta Selatan</p>
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider ${
                      executedBatch.action === 'allocate'
                        ? 'bg-blue-100 text-blue-800 border border-blue-200'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}
                  >
                    {executedBatch.action === 'allocate' ? 'Surat Jalan (Allocate)' : 'Tanda Terima (Revocate)'}
                  </span>
                  <p className="text-xs font-bold text-slate-900 mt-1.5 font-mono">{executedBatch.batch_code}</p>
                  <p className="text-[11px] text-slate-500">Tanggal: {executedBatch.date}</p>
                </div>
              </div>

              {/* Recipient & Transaction Metadata */}
              <div className="grid grid-cols-2 gap-6 my-5 text-xs">
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Diberikan Kepada / Peminjam</p>
                  <p className="font-bold text-slate-900 text-sm">{executedBatch.assigned_to || '-'}</p>
                  <p className="text-slate-600">Departemen / Penerima Resmi</p>
                  {executedBatch.expected_return_date && (
                    <p className="text-amber-800 font-semibold pt-1">
                      Estimasi Kembali: {executedBatch.expected_return_date}
                    </p>
                  )}
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Keterangan / Keperluan</p>
                  <p className="text-slate-700">{executedBatch.notes || 'Peminjaman operasional aset SkyConnection.'}</p>
                  <p className="text-slate-500 text-[11px] pt-1">
                    Diproses Oleh: <span className="font-semibold">{currentUser?.name || 'IT Support'}</span>
                  </p>
                </div>
              </div>

              {/* Itemized Assets Table */}
              <div className="my-5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Daftar Peralatan & Aset Diserahkan ({executedBatch.assets.length} Item)
                </h4>
                <table className="w-full border-collapse border border-slate-300 text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                      <th className="border border-slate-300 px-3 py-2 text-center w-8">No</th>
                      <th className="border border-slate-300 px-3 py-2 text-left">Nama Aset / Perangkat</th>
                      <th className="border border-slate-300 px-3 py-2 text-left">Kategori</th>
                      <th className="border border-slate-300 px-3 py-2 text-left">Serial Number</th>
                      <th className="border border-slate-300 px-3 py-2 text-center w-24">Kondisi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {executedBatch.assets.map((asset, idx) => (
                      <tr key={asset.id} className="border-b border-slate-200">
                        <td className="border border-slate-300 px-3 py-2 text-center font-mono">{idx + 1}</td>
                        <td className="border border-slate-300 px-3 py-2">
                          <span className="font-bold text-slate-900 block">{asset.asset_name}</span>
                          <span className="text-[10px] font-mono text-slate-400">ID #{asset.id}</span>
                        </td>
                        <td className="border border-slate-300 px-3 py-2">{asset.category_name || '-'}</td>
                        <td className="border border-slate-300 px-3 py-2 font-mono text-[11px]">
                          {asset.serial_number || '-'}
                        </td>
                        <td className="border border-slate-300 px-3 py-2 text-center font-semibold text-emerald-700">
                          Baik (Normal)
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Handover Photo Proof Thumbnail */}
              {executedBatch.image_url && (
                <div className="my-4 p-3 border border-slate-200 rounded-xl bg-slate-50 flex items-center gap-4">
                  <img
                    src={executedBatch.image_url}
                    alt="Proof"
                    className="w-24 h-24 object-cover rounded-lg border border-slate-300 bg-white shadow-xs"
                  />
                  <div className="text-xs">
                    <p className="font-bold text-slate-800">Lampiran Bukti Fisik Serah Terima</p>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Foto dokumentasi kondisi fisik peralatan saat diserahkan/diterima.
                    </p>
                    <p className="font-mono text-[10px] text-slate-400 mt-1 truncate max-w-md">
                      {executedBatch.image_url}
                    </p>
                  </div>
                </div>
              )}

              {/* Dual Signatures Block */}
              <div className="grid grid-cols-2 gap-12 mt-8 pt-4">
                <div className="text-center space-y-2">
                  <p className="text-xs font-bold text-slate-700">Diserahkan Oleh,</p>
                  <div className="h-20 flex items-center justify-center">
                    <div className="px-4 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-[11px] font-bold text-slate-500">
                      IT Support Mandiri
                    </div>
                  </div>
                  <div className="border-t border-slate-400 w-44 mx-auto pt-1">
                    <p className="text-xs font-bold text-slate-900">{currentUser?.name || 'Petugas IT Support'}</p>
                    <p className="text-[10px] text-slate-400">SkyConnection</p>
                  </div>
                </div>

                <div className="text-center space-y-2">
                  <p className="text-xs font-bold text-slate-700">Diterima Oleh,</p>
                  <div className="h-20 flex items-center justify-center">
                    {executedBatch.signature ? (
                      <img
                        src={executedBatch.signature}
                        alt="Signature"
                        className="max-h-16 max-w-[140px] object-contain"
                      />
                    ) : (
                      <div className="text-[11px] text-slate-400 italic">(Tanda Tangan)</div>
                    )}
                  </div>
                  <div className="border-t border-slate-400 w-44 mx-auto pt-1">
                    <p className="text-xs font-bold text-slate-900">{executedBatch.assigned_to || 'Penerima'}</p>
                    <p className="text-[10px] text-slate-400">Peminjam / Penerima Barang</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer (Hidden during Print) */}
            <div className="px-6 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs print:hidden">
              <span className="text-slate-500 font-mono text-[11px]">Format Standar A4 - Siap Cetak</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-1.5 transition"
                >
                  <Printer className="w-3.5 h-3.5" /> Cetak Sekarang
                </button>
                <button
                  type="button"
                  onClick={() => setShowSuratJalanModal(false)}
                  className="px-3.5 py-2 border border-slate-300 bg-white hover:bg-slate-50 rounded-xl font-semibold transition"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
