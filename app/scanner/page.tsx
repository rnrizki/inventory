'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ScanLine,
  Camera,
  CameraOff,
  QrCode,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Upload,
  Volume2,
  VolumeX,
  ExternalLink,
} from 'lucide-react';

export default function QrScannerPage() {
  const router = useRouter();
  const [assetIdInput, setAssetIdInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Camera scanner state
  const [isScanning, setIsScanning] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [beepSound, setBeepSound] = useState(true);

  const scannerRef = useRef<any>(null);
  const isStartingRef = useRef(false);

  // Play beep sound on scan
  const playBeep = () => {
    if (!beepSound) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // 880Hz A5 beep
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);

      if (navigator.vibrate) {
        navigator.vibrate(100);
      }
    } catch (e) {
      // Audio not permitted yet
    }
  };

  const handleScanSuccess = async (decodedText: string) => {
    playBeep();
    setSuccessMsg(`QR Decoded: ${decodedText}`);
    stopCamera();

    let val = decodedText.trim();

    // 1. If scanned content contains an asset URL (e.g. /assets/1, /assets?id=1, or ?id=1)
    const urlMatch = val.match(/(?:\/assets\/|\/assets\?id=|[\?&]id=)(\d+)/i);
    if (urlMatch && urlMatch[1]) {
      router.push(`/assets/${urlMatch[1]}`);
      return;
    }

    // 2. If it's a numeric ID (e.g. "1")
    if (/^\d+$/.test(val)) {
      setSearching(true);
      try {
        const res = await fetch(`/api/assets/${val}`);
        const json = await res.json();
        if (json.success && json.data) {
          router.push(`/assets/${json.data.id}`);
          return;
        }
      } catch (err) {
        // Fallback to query
      }
    }

    // 3. If scanned content contains S/N or Serial label (e.g. from "Full Asset Info" QR)
    const snMatch = val.match(/(?:S\/N|Serial|SN)[\s:]+([^\r\n,;]+)/i);
    const queryTerm = snMatch && snMatch[1] ? snMatch[1].trim() : val;

    // 4. Search by Serial Number or Model or Name
    setSearching(true);
    try {
      const res = await fetch(`/api/assets?q=${encodeURIComponent(queryTerm)}`);
      const json = await res.json();
      if (json.success && json.data && json.data.length > 0) {
        router.push(`/assets/${json.data[0].id}`);
        return;
      }
    } catch (err: any) {
      setErrorMsg(`Lookup failed: ${err.message}`);
    } finally {
      setSearching(false);
    }

    setErrorMsg(`No asset matched: "${val}". Please check the serial or Asset ID.`);
  };

  const startCamera = async (cameraId?: string) => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const { Html5Qrcode } = await import('html5-qrcode');

      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode('qr-reader-container');
      }

      // Check available cameras
      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          setCameras(devices.map((d) => ({ id: d.id, label: d.label || `Camera ${d.id.slice(0, 4)}` })));
          if (!selectedCameraId) {
            // Prefer rear / environment camera
            const backCam = devices.find((d) => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear') || d.label.toLowerCase().includes('environment'));
            setSelectedCameraId(backCam ? backCam.id : devices[0].id);
          }
        }
      } catch (e) {
        // Camera permissions query might fail before prompt
      }

      const cameraConfig = cameraId
        ? { deviceId: { exact: cameraId } }
        : { facingMode: 'environment' };

      const qrConfig = {
        fps: 15,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const edgeSize = Math.min(viewfinderWidth, viewfinderHeight) * 0.75;
          return {
            width: Math.max(200, Math.floor(edgeSize)),
            height: Math.max(200, Math.floor(edgeSize)),
          };
        },
        aspectRatio: 1.0,
      };

      await scannerRef.current.start(
        cameraConfig,
        qrConfig,
        (decodedText: string) => {
          handleScanSuccess(decodedText);
        },
        (errorMessage: string) => {
          // Parsing in-progress, silent
        }
      );

      setIsScanning(true);
      setCameraPermission('granted');
    } catch (err: any) {
      console.error('Camera start error:', err);
      setIsScanning(false);
      setCameraPermission('denied');
      setErrorMsg(
        err?.message ||
          'Could not access camera. Please allow camera permissions in your browser or try selecting a different camera.'
      );
    } finally {
      isStartingRef.current = false;
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
        console.warn('Error stopping camera:', e);
      }
    }
    setIsScanning(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            scannerRef.current.stop().catch(() => {});
          }
        } catch (e) {}
      }
    };
  }, []);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetIdInput.trim()) return;
    await handleScanSuccess(assetIdInput);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg('');
    setSuccessMsg('Scanning image...');

    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      let scanner = scannerRef.current;
      if (!scanner) {
        scanner = new Html5Qrcode('qr-reader-container');
        scannerRef.current = scanner;
      }

      const decodedText = await scanner.scanFile(file, true);
      handleScanSuccess(decodedText);
    } catch (err: any) {
      setErrorMsg('No QR code or barcode found in this image. Please try a clearer photo.');
      setSuccessMsg('');
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-blue-500/20">
          <ScanLine className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Asset QR & Barcode Scanner</h1>
        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
          Scan Xprinter thermal labels directly using your smartphone camera, or enter an Asset ID/Serial Number.
        </p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
        {/* Scanner Viewport */}
        <div className="relative w-full aspect-square max-w-sm mx-auto bg-slate-950 rounded-2xl overflow-hidden shadow-inner border border-slate-800 flex flex-col items-center justify-center">
          {/* html5-qrcode container */}
          <div id="qr-reader-container" className="w-full h-full overflow-hidden"></div>

          {!isScanning && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white bg-slate-950/90 backdrop-blur-xs">
              <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mb-3">
                <Camera className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="font-bold text-sm text-slate-200">Camera is Offline</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-[220px]">
                Click below to start your smartphone or webcam to scan QR codes.
              </p>
              <button
                type="button"
                onClick={() => startCamera(selectedCameraId)}
                className="mt-4 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md transition cursor-pointer"
              >
                <Camera className="w-4 h-4" /> Start Camera Scan
              </button>
            </div>
          )}

          {isScanning && (
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
              <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                Camera Live
              </span>
              <button
                type="button"
                onClick={stopCamera}
                className="pointer-events-auto bg-slate-900/80 hover:bg-slate-900 text-white text-xs font-bold px-3 py-1 rounded-lg backdrop-blur border border-slate-700 transition"
              >
                Stop
              </button>
            </div>
          )}
        </div>

        {/* Camera Controls & Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2">
            {isScanning ? (
              <button
                type="button"
                onClick={stopCamera}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition"
              >
                <CameraOff className="w-4 h-4" /> Turn Off Camera
              </button>
            ) : (
              <button
                type="button"
                onClick={() => startCamera(selectedCameraId)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition"
              >
                <Camera className="w-4 h-4" /> Open Camera
              </button>
            )}

            <button
              type="button"
              onClick={() => setBeepSound(!beepSound)}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 transition"
              title={beepSound ? 'Mute Beep Sound' : 'Enable Beep Sound'}
            >
              {beepSound ? <Volume2 className="w-4 h-4 text-blue-600" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {cameras.length > 1 && (
              <select
                value={selectedCameraId}
                onChange={(e) => {
                  setSelectedCameraId(e.target.value);
                  if (isScanning) {
                    stopCamera().then(() => startCamera(e.target.value));
                  }
                }}
                className="text-xs px-2.5 py-2 border border-slate-300 rounded-xl bg-white text-slate-700 focus:ring-2 focus:ring-blue-500 font-medium"
              >
                {cameras.map((cam) => (
                  <option key={cam.id} value={cam.id}>
                    {cam.label}
                  </option>
                ))}
              </select>
            )}

            <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 cursor-pointer transition">
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              <span>Upload Photo</span>
              <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        </div>

        {/* Notifications */}
        {errorMsg && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Manual Input Fallback */}
        <div className="pt-4 border-t border-slate-100">
          <form onSubmit={handleLookup} className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Or Manual Lookup (Asset ID or Serial)
            </label>
            <div className="relative">
              <input
                type="text"
                value={assetIdInput}
                onChange={(e) => setAssetIdInput(e.target.value)}
                placeholder="Type Asset ID or Serial (e.g. 1 or 453453453453453)..."
                className="w-full pl-10 pr-24 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-mono focus:outline-hidden"
              />
              <QrCode className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <button
                type="submit"
                disabled={searching || !assetIdInput.trim()}
                className="absolute right-1.5 top-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 disabled:opacity-50"
              >
                {searching ? 'Locating...' : 'Open Asset'}
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </form>
        </div>

        {/* Shortcut Info */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 gap-2">
          <span>Tip: Point your phone camera directly at the Xprinter thermal QR code label.</span>
          <button
            type="button"
            onClick={() => router.push('/assets/1')}
            className="text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center gap-1"
          >
            Sample: Open Asset #1 <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
