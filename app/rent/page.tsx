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
  ArrowLeft,
  Check,
  Building,
  Phone,
  ShieldCheck,
  ShieldAlert,
  Undo2,
  Download,
  Share2,
  Copy,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  UserPlus,
  Clock,
  Tag,
  Eye,
  Pencil,
} from 'lucide-react';
import { fileToOptimizedDataUrl, rotateImageDataUrl } from '@/lib/image-upload';
import { ASSET_STATUSES, getStatusInfo } from '@/lib/status';
import HandoverPhotoCapture from '@/components/HandoverPhotoCapture';

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

interface RentBatch {
  id: number;
  batch_code: string;
  action_type: 'ALLOCATE' | 'REVOCATE';
  assigned_to: string;
  assigned_date: string;
  expected_return_date?: string;
  notes?: string;
  image_url?: string;
  signature_url?: string;
  actor_name?: string;
  asset_ids: string;
  created_at: string;
  assets?: StagedAsset[];
  categories?: string[];
}

export default function RentPage() {
  const router = useRouter();

  // Navigation View: 'list' (first page / main history table) or 'dispatch' (bulk scanner & execution)
  const [viewMode, setViewMode] = useState<'list' | 'dispatch'>('list');

  // Mode inside dispatch: 'allocate' (Peminjaman / Relokasi) or 'revocate' (Pengembalian)
  const [mode, setMode] = useState<'allocate' | 'revocate'>('allocate');

  // Batches history list (First page)
  const [batches, setBatches] = useState<RentBatch[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(true);
  const [batchSearchTerm, setBatchSearchTerm] = useState('');
  const [batchFilterStatus, setBatchFilterStatus] = useState<'ALL' | 'ALLOCATE' | 'REVOCATE'>('ALL');
  const [expandedBatchId, setExpandedBatchId] = useState<number | null>(null);

  // Edit Batch States
  const [editingBatch, setEditingBatch] = useState<RentBatch | null>(null);
  const [editAssignedTo, setEditAssignedTo] = useState('');
  const [editReturnDate, setEditReturnDate] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // PDF Download State
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Staged Assets Queue for Dispatch
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
    actor_name?: string;
  } | null>(null);
  const [showSuratJalanModal, setShowSuratJalanModal] = useState(false);
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
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

  // Fetch Rent Batches History
  const fetchBatches = async () => {
    try {
      setBatchesLoading(true);
      const res = await fetch('/api/rent/batches?limit=100');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setBatches(json.data);
      }
    } catch (e) {
      console.error('Failed to fetch rent batches:', e);
    } finally {
      setBatchesLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

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
    } catch (e) {}
  };

  const showToast = (text: string, type: 'success' | 'warn' | 'error' = 'success') => {
    setScanToast({ text, type });
    setTimeout(() => setScanToast(null), 3000);
  };

  // Add Asset to Staging List
  const addAssetToStaging = (asset: StagedAsset) => {
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

    if (/^\d+$/.test(val)) {
      try {
        const res = await fetch(`/api/assets/${val}`);
        const json = await res.json();
        if (json.success && json.data) {
          return json.data;
        }
      } catch (e) {}
    }

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

      const container = document.getElementById('rent-qr-reader');
      if (!container) {
        setIsCameraLoading(false);
        return;
      }

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
      } catch (e) {}

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
        try {
          await html5QrCode.start({ facingMode: 'user' }, qrConfig, onScanSuccess, () => {});
        } catch (fallbackErr: any) {
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
        msg += 'Izin kamera diblokir browser. Mohon izinkan akses kamera pada ikon gembok URL browser.';
      } else if (err?.name === 'NotFoundError' || err?.message?.includes('No camera')) {
        msg += 'Tidak ada perangkat kamera yang terdeteksi di perangkat ini.';
      } else if (err?.name === 'NotReadableError' || err?.message?.includes('Could not start video source')) {
        msg += 'Kamera sedang digunakan oleh aplikasi lain.';
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
      } catch (e) {}
      scannerRef.current = null;
    }
    setIsScanning(false);
    setIsCameraLoading(false);
  };

  useEffect(() => {
    if (isCameraOpen && viewMode === 'dispatch') {
      startCamera(selectedCameraId);
    } else {
      stopCamera();
    }
  }, [isCameraOpen, viewMode]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

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
      alert('Nama penerima / peminjam (Assigned To) wajib diisi untuk transaksi Relokasi.');
      return;
    }

    const actionText = mode === 'allocate' ? 'Relokasi Barang (Allocate)' : 'Pengembalian Relokasi (Revocate)';
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
          actor_name: currentUser?.name || 'IT Support',
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
        playBeep(1046, 0.2);

        // Refresh batches list
        fetchBatches();
      } else {
        alert(json.error || 'Gagal mengeksekusi transaksi masal');
      }
    } catch (err: any) {
      alert(err.message || 'Error executing bulk rent transaction');
    } finally {
      setSubmitting(false);
    }
  };

  // Open existing batch into Document preview modal (View)
  const openBatchSuratJalan = (b: RentBatch) => {
    setExecutedBatch({
      batch_code: b.batch_code,
      action: (b.action_type || 'allocate').toLowerCase(),
      count: (b.assets || []).length,
      image_url: b.image_url,
      assets: b.assets || [],
      assigned_to: b.assigned_to,
      date: b.assigned_date,
      expected_return_date: b.expected_return_date || '',
      notes: b.notes || '',
      signature: b.signature_url,
      actor_name: b.actor_name || 'IT Support',
    });
    setShowSuratJalanModal(true);
  };

  // Open Edit Modal for a Batch
  const openEditBatch = (b: RentBatch) => {
    setEditingBatch(b);
    setEditAssignedTo(b.assigned_to || '');
    setEditReturnDate(b.expected_return_date || '');
    setEditNotes(b.notes || '');
  };

  // Save Edit Batch
  const handleSaveEdit = async () => {
    if (!editingBatch) return;
    try {
      setSavingEdit(true);
      const res = await fetch('/api/rent/batches', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingBatch.id,
          assigned_to: editAssignedTo.trim(),
          expected_return_date: editReturnDate,
          notes: editNotes.trim(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('Data relokasi berhasil diperbarui!', 'success');
        setEditingBatch(null);
        fetchBatches();
      } else {
        alert(json.error || 'Gagal menyimpan perubahan');
      }
    } catch (e: any) {
      alert(e.message || 'Error updating batch');
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete Batch & Revert Assets if Allocate
  const handleDeleteBatch = async (b: RentBatch) => {
    const isAllocate = b.action_type === 'ALLOCATE';
    const confirmMsg = isAllocate
      ? `Apakah Anda yakin ingin menghapus data relokasi "${b.batch_code}"?\n\nStatus ${b.assets?.length || 0} barang akan otomatis dikembalikan menjadi Available.`
      : `Apakah Anda yakin ingin menghapus riwayat batch "${b.batch_code}"?`;

    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/rent/batches?id=${b.id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        showToast(`Batch ${b.batch_code} berhasil dihapus!`, 'success');
        fetchBatches();
      } else {
        alert(json.error || 'Gagal menghapus batch');
      }
    } catch (e: any) {
      alert(e.message || 'Error deleting batch');
    }
  };

  // Generate share summary text
  const getShareText = (batch: any) => {
    const isAllocate = batch.action === 'allocate' || batch.action_type === 'ALLOCATE';
    const actionLabel = isAllocate ? 'Daftar Relokasi Barang' : 'Daftar Pengembalian Relokasi';
    const dateStr = batch.date || batch.assigned_date || '-';
    const recipient = batch.assigned_to || '-';
    const items = batch.assets || [];

    const itemsList = items
      .map((a: any, idx: number) => `${idx + 1}. ${a.asset_name} [${a.category_name || '-'}] (SN: ${a.serial_number || '-'})`)
      .join('\n');

    return (
      `*DAFTAR RELOKASI BARANG - SKYINVENTORY*\n` +
      `No. Dokumen: *${batch.batch_code}*\n` +
      `Status: *${actionLabel}*\n` +
      `Penerima / Lokasi Relokasi: *${recipient}*\n` +
      `Tanggal: ${dateStr}\n` +
      (batch.expected_return_date ? `Estimasi Kembali: ${batch.expected_return_date}\n` : '') +
      (batch.notes ? `Keterangan: ${batch.notes}\n` : '') +
      `Total Barang: ${items.length} Item\n\n` +
      `*Daftar Peralatan & Kategori:*\n` +
      `${itemsList}\n\n` +
      (batch.image_url ? `Foto Bukti Fisik:\n${batch.image_url}\n\n` : '') +
      `Diproses oleh: ${batch.actor_name || currentUser?.name || 'IT Support'}\n` +
      `_SkyInventory - Asset Central Management_`
    );
  };

  // Native share sheet (WhatsApp, Telegram, Files, etc.)
  const handleShare = async (batch: any) => {
    const text = getShareText(batch);
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `Daftar Relokasi ${batch.batch_code} - SkyInventory`,
          text,
        });
        return;
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          openWhatsApp(text);
        }
        return;
      }
    }
    openWhatsApp(text);
  };

  const openWhatsApp = (text: string) => {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleCopySummary = (batch: any) => {
    const text = getShareText(batch);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        showToast('Ringkasan Daftar Relokasi disalin ke clipboard!', 'success');
      });
    }
  };

  // DIRECT A4 PDF DOWNLOAD (Tanpa lewat print browser)
  const handleDownloadDirectPDF = async (batch: any) => {
    const el = document.getElementById('printable-surat-jalan');
    if (!el) return;

    try {
      setDownloadingPdf(true);
      showToast('Sedang membuat file PDF A4 langsung...', 'success');

      const { default: jsPDF } = await import('jspdf');
      const { default: html2canvas } = await import('html2canvas');

      const canvas = await html2canvas(el, {
        scale: 2, // 2x sharp resolution
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth(); // 210mm
      const pdfHeight = pdf.internal.pageSize.getHeight(); // 297mm
      const margin = 10; // 10mm margins
      const contentWidth = pdfWidth - margin * 2;
      const contentHeight = (canvas.height * contentWidth) / canvas.width;

      if (contentHeight <= pdfHeight - margin * 2) {
        // Fits within single A4 page
        pdf.addImage(imgData, 'JPEG', margin, margin, contentWidth, contentHeight);
      } else {
        // Multi-page A4
        let heightLeft = contentHeight;
        let position = margin;

        pdf.addImage(imgData, 'JPEG', margin, position, contentWidth, contentHeight);
        heightLeft -= (pdfHeight - margin * 2);

        while (heightLeft > 0) {
          position = heightLeft - contentHeight + margin;
          pdf.addPage();
          pdf.addImage(imgData, 'JPEG', margin, position, contentWidth, contentHeight);
          heightLeft -= (pdfHeight - margin * 2);
        }
      }

      const fileName = `Daftar_Relokasi_${batch.batch_code || 'Document'}.pdf`;
      pdf.save(fileName);
      showToast('File PDF A4 berhasil diunduh langsung!', 'success');
    } catch (err: any) {
      console.error('Error generating direct PDF:', err);
      showToast('Gagal membuat PDF langsung: ' + (err.message || 'error'), 'error');
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Filtered Batches for Table
  const filteredBatches = batches.filter((b) => {
    if (batchFilterStatus !== 'ALL') {
      if (b.action_type !== batchFilterStatus) return false;
    }
    if (!batchSearchTerm.trim()) return true;

    const term = batchSearchTerm.toLowerCase();
    const matchCode = (b.batch_code || '').toLowerCase().includes(term);
    const matchPerson = (b.assigned_to || '').toLowerCase().includes(term);
    const matchNotes = (b.notes || '').toLowerCase().includes(term);
    const matchActor = (b.actor_name || '').toLowerCase().includes(term);
    const matchCategory = (b.categories || []).some((c) => c.toLowerCase().includes(term));
    const matchAsset = (b.assets || []).some(
      (a) =>
        (a.asset_name || '').toLowerCase().includes(term) ||
        (a.serial_number || '').toLowerCase().includes(term) ||
        (a.category_name || '').toLowerCase().includes(term)
    );

    return matchCode || matchPerson || matchNotes || matchActor || matchCategory || matchAsset;
  });

  const allocateCount = batches.filter((b) => b.action_type === 'ALLOCATE').length;
  const revocateCount = batches.filter((b) => b.action_type === 'REVOCATE').length;
  const totalAssetsTransacted = batches.reduce((acc, b) => acc + (b.assets?.length || 0), 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-16">
      {/* Toast Notification */}
      {scanToast && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce">
          <div
            className={`px-4 py-2.5 rounded-xl shadow-xl text-xs font-bold text-white flex items-center gap-2 ${
              scanToast.type === 'success'
                ? 'bg-emerald-600'
                : scanToast.type === 'warn'
                ? 'bg-amber-600'
                : 'bg-rose-600'
            }`}
          >
            {scanToast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : scanToast.type === 'warn' ? (
              <AlertTriangle className="w-4 h-4" />
            ) : (
              <AlertTriangle className="w-4 h-4" />
            )}
            <span>{scanToast.text}</span>
          </div>
        </div>
      )}

      {/* Top Banner Navigation Header */}
      <div className="bg-white border-b border-slate-200 print:hidden sticky top-0 z-30 shadow-xs">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                <ArrowLeftRight className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Rent & Equipment Dispatch</span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    SkyInventory Central
                  </span>
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  {viewMode === 'list'
                    ? 'Laman Utama: Riwayat alokasi peminjaman (Allocate) dan pengembalian (Revocate) masal.'
                    : mode === 'allocate'
                    ? 'Bulk Scan & Alokasi Relokasi Peralatan kepada Penerima Resmi.'
                    : 'Bulk Scan & Pengembalian Relokasi Peralatan Kembali ke Gudang / Central.'}
                </p>
              </div>
            </div>

            {/* Top Call to Action Buttons on First Page */}
            {viewMode === 'list' ? (
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={fetchBatches}
                  className="p-2 text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                  title="Segarkan data riwayat"
                >
                  <RefreshCw className={`w-4 h-4 ${batchesLoading ? 'animate-spin text-blue-600' : ''}`} />
                </button>

                {/* + Add New Allocated Button */}
                <button
                  type="button"
                  onClick={() => {
                    setMode('allocate');
                    setViewMode('dispatch');
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-500/20 active:scale-98 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>+ Add New Allocated</span>
                </button>

                {/* + Add New Revocated Button */}
                <button
                  type="button"
                  onClick={() => {
                    setMode('revocate');
                    setViewMode('dispatch');
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-emerald-500/20 active:scale-98 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>+ Add New Revocated</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Kembali ke Riwayat Rent</span>
                </button>

                {/* Mode Selector Tabs inside dispatch */}
                <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setMode('allocate')}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      mode === 'allocate'
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>Allocate (Pinjam)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('revocate')}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      mode === 'revocate'
                        ? 'bg-white text-emerald-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Revocate (Kembali)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* VIEW 1: LEMBAR PERTAMA - RIWAYAT & DAFTAR RENT (ALLOCATED / REVOCATED) */}
      {viewMode === 'list' && (
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 pt-6 space-y-6">
          {/* KPI Summary Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Transaksi</p>
                <p className="text-xl font-black text-slate-900">{batches.length}</p>
                <p className="text-[10px] text-slate-500">Daftar Relokasi tersimpan</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <User className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Allocated</p>
                <p className="text-xl font-black text-indigo-700">{allocateCount}</p>
                <p className="text-[10px] text-slate-500">Peminjaman / Relokasi</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <RefreshCw className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Revocated</p>
                <p className="text-xl font-black text-emerald-700">{revocateCount}</p>
                <p className="text-[10px] text-slate-500">Pengembalian barang</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Box className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Aset Terkait</p>
                <p className="text-xl font-black text-slate-900">{totalAssetsTransacted}</p>
                <p className="text-[10px] text-slate-500">Unit terdistribusi</p>
              </div>
            </div>
          </div>

          {/* Table Container Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Toolbar: Search and Filter Pills */}
            <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/60">
              {/* Search Box */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={batchSearchTerm}
                  onChange={(e) => setBatchSearchTerm(e.target.value)}
                  placeholder="Cari No Dokumen, Nama Barang, Kategori, Penerima..."
                  className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
                {batchSearchTerm && (
                  <button
                    type="button"
                    onClick={() => setBatchSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setBatchFilterStatus('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    batchFilterStatus === 'ALL'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Semua ({batches.length})
                </button>
                <button
                  type="button"
                  onClick={() => setBatchFilterStatus('ALLOCATE')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    batchFilterStatus === 'ALLOCATE'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Allocated ({allocateCount})
                </button>
                <button
                  type="button"
                  onClick={() => setBatchFilterStatus('REVOCATE')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    batchFilterStatus === 'REVOCATE'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Revocated ({revocateCount})
                </button>
              </div>
            </div>

            {/* List Table with Horizontal Scroll for Mobile */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-3.5 text-center w-12">#</th>
                    <th className="py-3 px-3.5">Waktu & Tanggal</th>
                    <th className="py-3 px-3.5">Status / Aksi</th>
                    <th className="py-3 px-3.5">No. Dokumen</th>
                    <th className="py-3 px-3.5">Penerima / Lokasi</th>
                    <th className="py-3 px-3.5">Kategori Aset</th>
                    <th className="py-3 px-3.5">Rincian Barang</th>
                    <th className="py-3 px-3.5">Bukti & TTD</th>
                    <th className="py-3 px-3.5">Petugas</th>
                    <th className="py-3 px-3.5 text-center w-36">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {batchesLoading ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                          <p className="font-semibold text-xs">Memuat riwayat transaksi rent...</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredBatches.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-3 max-w-sm mx-auto">
                          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                            <Box className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-700 text-sm">Belum Ada Riwayat Transaksi</p>
                            <p className="text-slate-400 text-xs mt-1">
                              Belum ada catatan peminjaman atau pengembalian yang cocok dengan filter.
                            </p>
                          </div>
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setMode('allocate');
                                setViewMode('dispatch');
                              }}
                              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                            >
                              + Add New Allocated
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setMode('revocate');
                                setViewMode('dispatch');
                              }}
                              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                            >
                              + Add New Revocated
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredBatches.map((b, idx) => {
                      const isExpanded = expandedBatchId === b.id;
                      const isAllocate = b.action_type === 'ALLOCATE';
                      const itemsCount = b.assets?.length || 0;

                      return (
                        <React.Fragment key={b.id}>
                          <tr className="hover:bg-slate-50/80 transition group">
                            {/* Number */}
                            <td className="py-3 px-3.5 text-center font-mono text-slate-400 text-[11px]">
                              {idx + 1}
                            </td>

                            {/* Date & Time */}
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              <span className="font-bold text-slate-900 block">{b.assigned_date}</span>
                              <span className="text-[10px] text-slate-400 block font-mono">
                                {new Date(b.created_at).toLocaleTimeString('id-ID', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })} WIB
                              </span>
                            </td>

                            {/* Action Status Badge */}
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider ${
                                  isAllocate
                                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                }`}
                              >
                                {isAllocate ? <User className="w-3 h-3" /> : <RefreshCw className="w-3 h-3" />}
                                <span>{isAllocate ? 'ALLOCATE' : 'REVOCATE'}</span>
                              </span>
                            </td>

                            {/* Batch Code */}
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                                {b.batch_code}
                              </span>
                            </td>

                            {/* Assigned To */}
                            <td className="py-3 px-3.5">
                              <span className="font-bold text-slate-900 block">{b.assigned_to || '-'}</span>
                              {b.expected_return_date && (
                                <span className="text-[10px] text-amber-700 block">
                                  Kembali: {b.expected_return_date}
                                </span>
                              )}
                            </td>

                            {/* Categories Badge Column */}
                            <td className="py-3 px-3.5">
                              <div className="flex flex-wrap gap-1 max-w-xs">
                                {b.categories && b.categories.length > 0 ? (
                                  b.categories.map((cat, ci) => (
                                    <span
                                      key={ci}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 font-bold text-[10px]"
                                    >
                                      <Tag className="w-2.5 h-2.5" />
                                      <span>{cat}</span>
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-slate-400 text-[11px]">-</span>
                                )}
                              </div>
                            </td>

                            {/* Items Summary & Accordion Toggle */}
                            <td className="py-3 px-3.5">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-full text-[11px]">
                                  {itemsCount} Item
                                </span>
                                {itemsCount > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setExpandedBatchId(isExpanded ? null : b.id)}
                                    className="text-blue-600 hover:text-blue-800 text-[11px] font-semibold flex items-center gap-0.5 hover:underline cursor-pointer"
                                  >
                                    <span>{isExpanded ? 'Tutup' : 'Rincian'}</span>
                                    {isExpanded ? (
                                      <ChevronUp className="w-3.5 h-3.5" />
                                    ) : (
                                      <ChevronDown className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400 truncate max-w-xs mt-0.5">
                                {(b.assets || []).map((a) => a.asset_name).join(', ')}
                              </p>
                            </td>

                            {/* Proof Photo & Signature Thumbnails */}
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                {b.image_url ? (
                                  <button
                                    type="button"
                                    onClick={() => setZoomImageUrl(b.image_url || null)}
                                    className="w-8 h-8 rounded-lg overflow-hidden border border-slate-300 hover:border-blue-500 transition shadow-xs group/img relative cursor-pointer"
                                    title="Klik untuk zoom foto serah terima"
                                  >
                                    <img
                                      src={b.image_url}
                                      alt="Proof"
                                      className="w-full h-full object-cover group-hover/img:scale-110 transition"
                                    />
                                  </button>
                                ) : (
                                  <span className="text-slate-300 text-[10px] italic">No foto</span>
                                )}

                                {b.signature_url ? (
                                  <div
                                    className="w-10 h-7 rounded border border-slate-200 bg-white p-0.5 flex items-center justify-center"
                                    title="Tanda tangan tersimpan"
                                  >
                                    <img
                                      src={b.signature_url}
                                      alt="TTD"
                                      className="max-h-full max-w-full object-contain"
                                    />
                                  </div>
                                ) : (
                                  <span className="text-slate-300 text-[10px] italic">No TTD</span>
                                )}
                              </div>
                            </td>

                            {/* Processed By (Actor) */}
                            <td className="py-3 px-3.5 whitespace-nowrap text-slate-600 text-[11px]">
                              {b.actor_name?.split('@')[0] || 'IT Support'}
                            </td>

                            {/* ACTIONS COLUMN: View, Edit, Delete (Matching Asset Table Style) */}
                            <td className="py-3 px-3.5 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-2">
                                {/* 1. View Button (Opens Document Preview Modal with Download, Share, Print) */}
                                <button
                                  type="button"
                                  onClick={() => openBatchSuratJalan(b)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer active:scale-98"
                                  title="Lihat Pratinjau Dokumen Relokasi"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>View</span>
                                </button>

                                {/* 2. Edit Button (Opens Edit Batch Modal) */}
                                <button
                                  type="button"
                                  onClick={() => openEditBatch(b)}
                                  className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-lg transition shadow-2xs cursor-pointer active:scale-98"
                                  title="Edit Data Batch Relokasi"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>

                                {/* 3. Delete Button */}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteBatch(b)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 rounded-lg transition shadow-2xs cursor-pointer active:scale-98"
                                  title="Hapus Data Batch Relokasi"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expandable Asset Details Drawer */}
                          {isExpanded && (
                            <tr className="bg-slate-50/90 border-b border-slate-200">
                              <td colSpan={10} className="p-4 sm:p-5">
                                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
                                  <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                                      <Box className="w-4 h-4 text-blue-600" />
                                      <span>Daftar Rincian {itemsCount} Barang pada {b.batch_code}</span>
                                    </h4>
                                    <span className="text-[11px] text-slate-500">
                                      Keperluan: <span className="font-semibold">{b.notes || '-'}</span>
                                    </span>
                                  </div>

                                  <div className="overflow-x-auto">
                                    <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
                                      <thead>
                                        <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                                          <th className="py-2 px-3 text-center w-10">No</th>
                                          <th className="py-2 px-3">Nama Aset / Perangkat</th>
                                          <th className="py-2 px-3">Kategori</th>
                                          <th className="py-2 px-3">Serial Number</th>
                                          <th className="py-2 px-3">Lokasi Asal</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {(b.assets || []).map((asset, ai) => (
                                          <tr key={asset.id} className="hover:bg-slate-50">
                                            <td className="py-2 px-3 text-center font-mono text-slate-400">
                                              {ai + 1}
                                            </td>
                                            <td className="py-2 px-3">
                                              <span className="font-bold text-slate-900 block">{asset.asset_name}</span>
                                              <span className="text-[10px] text-slate-400 font-mono">ID #{asset.id}</span>
                                            </td>
                                            <td className="py-2 px-3">
                                              <span className="inline-block px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-bold text-[10px] border border-purple-200">
                                                {asset.category_name || '-'}
                                              </span>
                                            </td>
                                            <td className="py-2 px-3 font-mono text-slate-600 text-[11px]">
                                              {asset.serial_number || '-'}
                                            </td>
                                            <td className="py-2 px-3 text-slate-500">
                                              {asset.location_name || '-'}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: BULK SCANNER & TRANSACTION EXECUTION FORM */}
      {viewMode === 'dispatch' && (
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
                          <span>Scanning Aktif</span>
                        </div>

                        {cameras.length > 1 && (
                          <div className="absolute top-2 right-2 z-10">
                            <select
                              value={selectedCameraId}
                              onChange={(e) => {
                                setSelectedCameraId(e.target.value);
                                startCamera(e.target.value);
                              }}
                              className="bg-black/70 text-white text-xs rounded-lg px-2 py-1 border border-white/20 focus:outline-none backdrop-blur-xs"
                            >
                              {cameras.map((c) => (
                                <option key={c.id} value={c.id} className="bg-slate-900 text-white">
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

                {/* Handheld Gun / Direct Barcode Text Input */}
                <form onSubmit={handleDirectBarcodeSubmit} className="flex items-center gap-2 mb-3">
                  <div className="relative flex-1">
                    <ScanLine className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value)}
                      placeholder="Scan barcode gun / ketik Asset ID atau Serial Number..."
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono transition"
                      autoFocus
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tambah
                  </button>
                </form>

                {/* Manual Text Search Autocomplete */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Atau cari nama aset secara manual..."
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  />
                  {searching && (
                    <RefreshCw className="w-3 h-3 text-blue-500 absolute right-3 top-1/2 -translate-y-1/2 animate-spin" />
                  )}

                  {searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl border border-slate-200 shadow-xl max-h-56 overflow-y-auto z-20 divide-y divide-slate-100">
                      {searchResults.map((asset) => (
                        <div
                          key={asset.id}
                          onClick={() => {
                            addAssetToStaging(asset);
                            setSearchQuery('');
                            setSearchResults([]);
                          }}
                          className="p-2.5 hover:bg-blue-50/60 cursor-pointer flex items-center justify-between text-xs transition"
                        >
                          <div>
                            <p className="font-bold text-slate-800">{asset.asset_name}</p>
                            <p className="text-[11px] text-slate-400 font-mono">
                              SN: {asset.serial_number || '-'} • Kategori: {asset.category_name || '-'}
                            </p>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">
                            + Pilih
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Staged Assets Queue List */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-600" />
                    <h3 className="text-sm font-bold text-slate-800">
                      Antrean Aset untuk Diproses ({stagedAssets.length} Item)
                    </h3>
                  </div>
                  {stagedAssets.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setStagedAssets([])}
                      className="text-xs text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" /> Bersihkan Semua
                    </button>
                  )}
                </div>

                {stagedAssets.length === 0 ? (
                  <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-400">
                    <Box className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="text-xs font-semibold">Belum ada barang di dalam antrean.</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Gunakan pemindai barcode / kamera di atas untuk menambahkan banyak item sekaligus.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto pr-1">
                    {stagedAssets.map((asset, index) => {
                      const statusInfo = getStatusInfo(asset.asset_status);
                      return (
                        <div
                          key={asset.id}
                          className="py-2.5 flex items-center justify-between gap-3 text-xs group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                              {index + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 truncate">{asset.asset_name}</p>
                              <p className="text-[11px] text-slate-400 font-mono truncate">
                                SN: {asset.serial_number || '-'} • Kat: {asset.category_name || '-'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${statusInfo.bg} ${statusInfo.color} border ${statusInfo.border}`}
                            >
                              {statusInfo.name}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeAssetFromStaging(asset.id)}
                              className="p-1 text-slate-300 hover:text-rose-600 rounded hover:bg-rose-50 transition cursor-pointer"
                              title="Hapus dari antrean"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: Handover Details, Photo Proof, Digital Signature & Action (5 Cols) */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-600" />
                    <h3 className="text-sm font-bold text-slate-800">Detail Relokasi / Serah Terima</h3>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wide ${
                      mode === 'allocate'
                        ? 'bg-blue-100 text-blue-800 border border-blue-200'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}
                  >
                    {mode.toUpperCase()}
                  </span>
                </div>

                {/* Recipient / Assigned To */}
                {mode === 'allocate' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Penerima / Lokasi Relokasi <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={assignedTo}
                      onChange={(e) => setAssignedTo(e.target.value)}
                      placeholder="Nama pegawai, divisi, atau lokasi relokasi..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                      required
                    />
                  </div>
                )}

                {/* Transaction Date & Return Date */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal Transaksi</label>
                    <input
                      type="date"
                      value={transactionDate}
                      onChange={(e) => setTransactionDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Estimasi Kembali</label>
                    <input
                      type="date"
                      value={expectedReturnDate}
                      onChange={(e) => setExpectedReturnDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Keterangan / Keperluan</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Contoh: Relokasi kebutuhan instalasi perangkat jaringan di site Ragunan..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 transition resize-none"
                  ></textarea>
                </div>

                {/* Handover Photo Capture Component */}
                <HandoverPhotoCapture
                  value={capturedImage}
                  onChange={(val) => setCapturedImage(val)}
                  label="Foto Bukti Fisik Relokasi"
                />

                {/* Digital Signature Pad */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700">Tanda Tangan Penerima Relokasi</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={undoCanvas}
                        className="text-[11px] text-slate-500 hover:text-slate-800 font-semibold flex items-center gap-0.5 cursor-pointer"
                      >
                        <Undo2 className="w-3 h-3" /> Undo
                      </button>
                      <button
                        type="button"
                        onClick={clearCanvas}
                        className="text-[11px] text-rose-500 hover:text-rose-700 font-semibold cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="border border-slate-300 rounded-xl overflow-hidden bg-slate-50 touch-none">
                    <canvas
                      ref={canvasRef}
                      width={420}
                      height={120}
                      onPointerDown={startDrawing}
                      onPointerMove={draw}
                      onPointerUp={stopDrawing}
                      onPointerLeave={stopDrawing}
                      className="w-full h-24 bg-white cursor-crosshair block"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Gunakan mouse atau goreskan jari di layar sentuh untuk tanda tangan.
                  </p>
                </div>

                {/* Action Submit Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleExecuteBulk}
                    disabled={submitting || stagedAssets.length === 0}
                    className={`w-full py-3 rounded-xl text-xs font-extrabold uppercase tracking-wider text-white shadow-md transition flex items-center justify-center gap-2 cursor-pointer ${
                      submitting || stagedAssets.length === 0
                        ? 'bg-slate-300 cursor-not-allowed text-slate-500'
                        : mode === 'allocate'
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/20 active:scale-99'
                        : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-500/20 active:scale-99'
                    }`}
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" /> Memproses Transaksi...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" /> Eksekusi Bulk {mode.toUpperCase()} ({stagedAssets.length} Barang)
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODAL: PRATINJAU DOKUMEN RELOKASI (Daftar Relokasi Barang - A4 Swipeable) */}
      {showSuratJalanModal && executedBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in print:p-0 print:bg-white print:static overflow-hidden">
          <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden print:border-none print:shadow-none print:w-full print:max-w-none print:max-h-none">
            {/* Modal Header (Hidden during Print) */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-slate-900 text-white print:hidden shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="text-xs sm:text-sm font-bold truncate">
                  Pratinjau Daftar Relokasi Barang & Bukti Fisik
                </span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                {/* 1. DIRECT A4 PDF DOWNLOAD (Tanpa lewat print browser) */}
                <button
                  type="button"
                  onClick={() => handleDownloadDirectPDF(executedBatch)}
                  disabled={downloadingPdf}
                  className="px-2.5 sm:px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer disabled:opacity-70"
                  title="Langsung Download PDF A4"
                >
                  {downloadingPdf ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  <span>{downloadingPdf ? 'Membuat PDF...' : 'Download PDF (A4)'}</span>
                </button>

                {/* 2. Share Button */}
                <button
                  type="button"
                  onClick={() => handleShare(executedBatch)}
                  className="px-2.5 sm:px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition shadow-xs cursor-pointer"
                  title="Bagikan Dokumen Relokasi"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Bagikan</span>
                </button>

                {/* 3. Print Button */}
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-2.5 sm:px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition shadow-xs cursor-pointer"
                  title="Cetak via Printer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Print</span>
                </button>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setShowSuratJalanModal(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Mobile Swipe Helper Banner */}
            <div className="sm:hidden px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-center justify-between text-[11px] text-blue-700 font-medium print:hidden shrink-0">
              <span>👉 Geser / Swipe layar ke samping untuk melihat dokumen penuh</span>
              <span className="font-mono text-[10px] bg-blue-100 px-1.5 py-0.5 rounded font-bold">A4 Format</span>
            </div>

            {/* Horizontal & Vertical Touch-Scrollable Body for Full Swipeability on Mobile */}
            <div className="flex-1 overflow-x-auto overflow-y-auto p-2 sm:p-6 bg-slate-100/70 touch-pan-x touch-pan-y overscroll-contain">
              {/* Official A4 Document Layout */}
              <div
                className="min-w-[620px] sm:min-w-0 max-w-3xl mx-auto bg-white p-5 sm:p-10 rounded-xl shadow-xs border border-slate-200 text-slate-800 font-sans print:border-none print:shadow-none print:p-0 print:min-w-0 print:max-w-none"
                id="printable-surat-jalan"
              >
                {/* Header Letterhead (Brand: SkyInventory) */}
                <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-800 flex items-center justify-center text-white font-black text-xl shadow-sm shrink-0">
                      SI
                    </div>
                    <div>
                      <h2 className="text-lg font-black tracking-tight text-slate-900 uppercase">
                        SkyInventory
                      </h2>
                      <p className="text-[11px] text-slate-500">Asset Central & Enterprise Equipment Management</p>
                      <p className="text-[11px] text-slate-400">Jl. Gotong Royong I No.50, Ragunan, Jakarta Selatan</p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider ${
                        executedBatch.action === 'allocate'
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      {executedBatch.action === 'allocate' ? 'Daftar Relokasi Barang' : 'Daftar Pengembalian Relokasi'}
                    </span>
                    <p className="text-xs font-bold text-slate-900 mt-1.5 font-mono">{executedBatch.batch_code}</p>
                    <p className="text-[11px] text-slate-500">Tanggal: {executedBatch.date}</p>
                  </div>
                </div>

                {/* Recipient & Transaction Metadata */}
                <div className="grid grid-cols-2 gap-4 my-5 text-xs">
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Penerima / Lokasi Relokasi
                    </p>
                    <p className="font-bold text-slate-900 text-sm">{executedBatch.assigned_to || '-'}</p>
                    <p className="text-slate-600">Departemen / Penerima Resmi</p>
                    {executedBatch.expected_return_date && (
                      <p className="text-amber-800 font-semibold pt-1">
                        Estimasi Kembali: {executedBatch.expected_return_date}
                      </p>
                    )}
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Keterangan / Keperluan
                    </p>
                    <p className="text-slate-700">
                      {executedBatch.notes || 'Relokasi operasional aset SkyInventory.'}
                    </p>
                    <p className="text-slate-500 text-[11px] pt-1">
                      Diproses Oleh: <span className="font-semibold">{executedBatch.actor_name || currentUser?.name || 'IT Support'}</span>
                    </p>
                  </div>
                </div>

                {/* Itemized Assets Table */}
                <div className="my-5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Daftar Peralatan & Aset Relokasi ({executedBatch.assets.length} Item)
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
                          <td className="border border-slate-300 px-3 py-2">
                            <span className="font-semibold text-slate-700">{asset.category_name || '-'}</span>
                          </td>
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
                      className="w-20 h-20 object-cover rounded-lg border border-slate-300 bg-white shadow-2xs shrink-0 cursor-pointer"
                      onClick={() => setZoomImageUrl(executedBatch.image_url || null)}
                      title="Klik untuk zoom"
                    />
                    <div className="text-xs">
                      <p className="font-bold text-slate-800">Lampiran Bukti Fisik Relokasi</p>
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
                <div className="grid grid-cols-2 gap-8 mt-8 pt-4">
                  <div className="text-center space-y-2">
                    <p className="text-xs font-bold text-slate-700">Diserahkan Oleh,</p>
                    <div className="h-16 flex items-center justify-center">
                      <div className="px-4 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-[11px] font-bold text-slate-600">
                        SkyInventory IT Support
                      </div>
                    </div>
                    <div className="border-t border-slate-400 w-44 mx-auto pt-1">
                      <p className="text-xs font-bold text-slate-900">{executedBatch.actor_name || currentUser?.name || 'Petugas IT Support'}</p>
                      <p className="text-[10px] text-slate-400">SkyInventory</p>
                    </div>
                  </div>

                  <div className="text-center space-y-2">
                    <p className="text-xs font-bold text-slate-700">Diterima Oleh,</p>
                    <div className="h-16 flex items-center justify-center">
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
                      <p className="text-[10px] text-slate-400">Penerima Relokasi Barang</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer with Actions (Hidden during Print) */}
            <div className="px-4 sm:px-6 py-3 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs print:hidden shrink-0">
              <span className="text-slate-500 font-mono text-[11px]">Format Standar A4 - Siap Download & Bagikan</span>
              <div className="flex flex-wrap items-center gap-2">
                {/* Share to WhatsApp */}
                <button
                  type="button"
                  onClick={() => openWhatsApp(getShareText(executedBatch))}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" /> WhatsApp
                </button>

                {/* Copy Summary */}
                <button
                  type="button"
                  onClick={() => handleCopySummary(executedBatch)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" /> Salin Ringkasan
                </button>

                {/* Direct A4 PDF Download Button */}
                <button
                  type="button"
                  onClick={() => handleDownloadDirectPDF(executedBatch)}
                  disabled={downloadingPdf}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-1.5 transition shadow-sm cursor-pointer disabled:opacity-75"
                >
                  {downloadingPdf ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  <span>{downloadingPdf ? 'Membuat PDF...' : 'Download PDF (A4)'}</span>
                </button>

                {/* Print Button */}
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-xl font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> Print
                </button>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setShowSuratJalanModal(false)}
                  className="px-3 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 rounded-xl font-semibold transition cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT BATCH MODAL */}
      {editingBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold">Edit Data Relokasi</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingBatch(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Nomor Dokumen</span>
                <span className="font-mono font-bold text-slate-800 text-sm bg-slate-100 px-2.5 py-1 rounded border border-slate-200 inline-block">
                  {editingBatch.batch_code}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Penerima / Lokasi Relokasi <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={editAssignedTo}
                  onChange={(e) => setEditAssignedTo(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 transition font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Estimasi Tanggal Kembali
                </label>
                <input
                  type="date"
                  value={editReturnDate}
                  onChange={(e) => setEditReturnDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Keterangan / Keperluan
                </label>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 transition resize-none"
                  placeholder="Catatan keperluan relokasi barang..."
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingBatch(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-600 hover:bg-slate-50 rounded-xl font-bold transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={savingEdit || !editAssignedTo.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {savingEdit ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Menyimpan...
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" /> Simpan Perubahan
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Zoom Modal */}
      {zoomImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setZoomImageUrl(null)}
        >
          <div className="relative max-w-2xl max-h-[85vh] bg-slate-900 rounded-2xl overflow-hidden p-2">
            <button
              type="button"
              onClick={() => setZoomImageUrl(null)}
              className="absolute top-4 right-4 p-1.5 bg-black/60 text-white hover:bg-black rounded-full transition z-10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={zoomImageUrl}
              alt="Zoom Proof"
              className="w-full h-auto max-h-[80vh] object-contain rounded-xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
