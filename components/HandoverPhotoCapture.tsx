'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  CameraOff,
  Upload,
  RotateCcw,
  RotateCw,
  Trash2,
  RefreshCw,
  CheckCircle2,
  Video,
  X,
} from 'lucide-react';
import { fileToOptimizedDataUrl, rotateImageDataUrl } from '@/lib/image-upload';

interface HandoverPhotoCaptureProps {
  value: string;
  onChange: (dataUrl: string) => void;
  label?: string;
  sublabel?: string;
  maxDimension?: number;
}

export default function HandoverPhotoCapture({
  value,
  onChange,
  label = 'Foto Bukti Serah Terima',
  sublabel = 'Ambil foto langsung melalui kamera atau upload file lokal',
  maxDimension = 800,
}: HandoverPhotoCaptureProps) {
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [rotating, setRotating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load available camera devices
  const refreshCameraDevices = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      return;
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === 'videoinput');
      if (videoInputs.length > 0) {
        const mapped = videoInputs.map((d, index) => ({
          id: d.deviceId,
          label: d.label || `Camera ${index + 1} (${d.deviceId.slice(0, 4)}...)`,
        }));
        setCameras(mapped);
        if (!selectedCameraId) {
          // Default to rear/back or first device
          const backCam = mapped.find(
            (c) =>
              c.label.toLowerCase().includes('back') ||
              c.label.toLowerCase().includes('rear') ||
              c.label.toLowerCase().includes('environment')
          );
          setSelectedCameraId(backCam ? backCam.id : mapped[0].id);
        }
      }
    } catch (err) {
      console.warn('Failed to enumerate video devices:', err);
    }
  };

  useEffect(() => {
    refreshCameraDevices();
    return () => {
      stopCamera();
    };
  }, []);

  // Stop current active media stream
  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsWebcamActive(false);
    setIsStartingCamera(false);
  };

  // Start camera stream
  const startCamera = async (targetDeviceId?: string) => {
    setErrorMsg(null);
    setIsStartingCamera(true);

    // Stop existing stream first if active
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    const chosenId = targetDeviceId || selectedCameraId;

    try {
      let stream: MediaStream | null = null;

      // 1. Try with exact deviceId if provided
      if (chosenId) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              deviceId: { exact: chosenId },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          });
        } catch (devErr) {
          console.warn('Exact deviceId constraint failed, attempting fallback...', devErr);
        }
      }

      // 2. Fallback to environment/rear camera
      if (!stream) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'environment',
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          });
        } catch (envErr) {
          console.warn('FacingMode environment failed, attempting user-facing camera...', envErr);
        }
      }

      // 3. Fallback to user/front camera (e.g. MacBook / laptop webcam)
      if (!stream) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'user',
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          });
        } catch (userErr) {
          console.warn('FacingMode user failed, trying generic video constraint...', userErr);
        }
      }

      // 4. Final fallback: basic video
      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      mediaStreamRef.current = stream;
      setIsWebcamActive(true);
      setIsStartingCamera(false);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }

      // Refresh camera labels now that permission has been granted
      refreshCameraDevices();
    } catch (err: any) {
      console.error('Camera access error:', err);
      setIsWebcamActive(false);
      setIsStartingCamera(false);

      let msg = 'Gagal mengakses kamera.';
      if (err?.name === 'NotAllowedError' || err?.message?.includes('Permission denied')) {
        msg = 'Izin kamera diblokir browser. Izinkan akses kamera di ikon gembok bilah URL.';
      } else if (err?.name === 'NotFoundError' || err?.message?.includes('No camera')) {
        msg = 'Tidak ada perangkat kamera yang terdeteksi di perangkat Anda.';
      } else if (err?.name === 'NotReadableError' || err?.message?.includes('Could not start video source')) {
        msg = 'Kamera sedang digunakan oleh aplikasi atau tab browser lain.';
      } else {
        msg = err?.message || 'Periksa izin kamera browser.';
      }
      setErrorMsg(msg);
    }
  };

  // Capture frame from active live video stream
  const takeSnapshot = () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      const naturalWidth = video.videoWidth || 1280;
      const naturalHeight = video.videoHeight || 720;

      let targetWidth = naturalWidth;
      let targetHeight = naturalHeight;

      if (targetWidth > maxDimension || targetHeight > maxDimension) {
        if (targetWidth > targetHeight) {
          targetHeight = Math.round((targetHeight * maxDimension) / targetWidth);
          targetWidth = maxDimension;
        } else {
          targetWidth = Math.round((targetWidth * maxDimension) / targetHeight);
          targetHeight = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        onChange(dataUrl);
      }
    } catch (err) {
      console.error('Failed to take snapshot:', err);
    } finally {
      stopCamera();
    }
  };

  // Handle local file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setErrorMsg(null);
      stopCamera();
      const optimizedUrl = await fileToOptimizedDataUrl(file, maxDimension, 0.88);
      onChange(optimizedUrl);
    } catch (err: any) {
      console.error('Failed to optimize uploaded file:', err);
      setErrorMsg(err.message || 'Gagal memproses file foto');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle rotation
  const handleRotate = async (degrees: number) => {
    if (!value || rotating) return;
    try {
      setRotating(true);
      const rotated = await rotateImageDataUrl(value, degrees);
      onChange(rotated);
    } catch (err: any) {
      console.error('Failed to rotate image:', err);
    } finally {
      setRotating(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Header Label */}
      <div className="flex items-center justify-between">
        <div>
          <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5 text-blue-600" />
            <span>{label}</span>
          </label>
          {sublabel && <p className="text-[11px] text-slate-500 mt-0.5">{sublabel}</p>}
        </div>
        {value && !isWebcamActive && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Foto Terlampir
          </span>
        )}
      </div>

      {/* Main Viewport Container */}
      <div className="relative w-full aspect-video max-h-[280px] bg-slate-950 rounded-2xl overflow-hidden shadow-inner border border-slate-800 flex flex-col items-center justify-center">
        {/* State 1: Active Live Webcam */}
        {isWebcamActive && (
          <div className="w-full h-full relative flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-contain bg-black"
            />

            {/* Top Bar inside live view */}
            <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none z-10">
              <span className="bg-emerald-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs backdrop-blur-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                Camera Live
              </span>
              <button
                type="button"
                onClick={stopCamera}
                className="pointer-events-auto bg-black/60 hover:bg-black/80 text-white text-[11px] font-semibold px-2.5 py-1 rounded-lg backdrop-blur-xs border border-white/20 transition flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3 h-3" /> Tutup
              </button>
            </div>

            {/* Floating Snap Photo Button */}
            <div className="absolute bottom-3 inset-x-0 flex justify-center z-10 pointer-events-none">
              <button
                type="button"
                onClick={takeSnapshot}
                className="pointer-events-auto inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-lg shadow-blue-500/30 transition transform hover:scale-105 active:scale-95 cursor-pointer border border-white/20"
              >
                <Camera className="w-4 h-4" />
                <span>Ambil Foto</span>
              </button>
            </div>
          </div>
        )}

        {/* State 2: Captured/Uploaded Photo Preview */}
        {!isWebcamActive && value && (
          <div className="w-full h-full relative flex items-center justify-center p-2 bg-slate-950">
            <img
              src={value}
              alt="Handover Proof Preview"
              className="w-full h-full object-contain rounded-lg shadow-sm"
            />
            {rotating && (
              <div className="absolute inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center text-white text-xs font-semibold gap-2 z-10">
                <RefreshCw className="w-5 h-5 animate-spin text-blue-400" />
                <span>Memutar gambar...</span>
              </div>
            )}
          </div>
        )}

        {/* State 3: Standby / Offline (No photo and no active webcam) */}
        {!isWebcamActive && !value && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white bg-slate-950">
            <div className="w-14 h-14 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mb-2.5 shadow-inner">
              <Camera className="w-7 h-7 text-slate-400" />
            </div>
            <h4 className="font-bold text-xs text-slate-200">Camera is Offline</h4>
            <p className="text-[11px] text-slate-400 mt-0.5 max-w-[260px]">
              Nyalakan kamera atau upload foto bukti serah terima dari file komputer / ponsel Anda.
            </p>
            <button
              type="button"
              onClick={() => startCamera(selectedCameraId)}
              disabled={isStartingCamera}
              className="mt-3.5 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition cursor-pointer disabled:opacity-60"
            >
              {isStartingCamera ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Menghubungkan Kamera...
                </>
              ) : (
                <>
                  <Camera className="w-3.5 h-3.5" /> Buka Kamera Langsung
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Camera Controls & Switcher Toolbar (matching QR Scan layout) */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
        <div className="flex items-center gap-2">
          {isWebcamActive ? (
            <button
              type="button"
              onClick={stopCamera}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition cursor-pointer"
            >
              <CameraOff className="w-3.5 h-3.5" /> Turn Off Camera
            </button>
          ) : (
            <button
              type="button"
              onClick={() => startCamera(selectedCameraId)}
              disabled={isStartingCamera}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition cursor-pointer disabled:opacity-60"
            >
              {isStartingCamera ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Camera className="w-3.5 h-3.5" />
              )}
              <span>Open Camera</span>
            </button>
          )}

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Camera Selector Dropdown */}
          {cameras.length > 0 && (
            <select
              value={selectedCameraId}
              onChange={(e) => {
                const newId = e.target.value;
                setSelectedCameraId(newId);
                if (isWebcamActive) {
                  startCamera(newId);
                }
              }}
              className="text-xs px-2.5 py-1.5 border border-slate-300 rounded-xl bg-white text-slate-700 focus:ring-2 focus:ring-blue-500 font-medium max-w-[200px] truncate"
            >
              {cameras.map((cam) => (
                <option key={cam.id} value={cam.id}>
                  {cam.label}
                </option>
              ))}
            </select>
          )}

          {/* Upload Photo Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 cursor-pointer transition shadow-2xs"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span>Upload Photo</span>
          </button>
        </div>
      </div>

      {/* Rotation & Action Tools when Photo is Present */}
      {value && !isWebcamActive && (
        <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={rotating}
              onClick={() => handleRotate(-90)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold shadow-2xs transition disabled:opacity-50 cursor-pointer"
              title="Putar Kiri (-90°)"
            >
              <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
              <span>Putar Kiri</span>
            </button>
            <button
              type="button"
              disabled={rotating}
              onClick={() => handleRotate(90)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold shadow-2xs transition disabled:opacity-50 cursor-pointer"
              title="Putar Kanan (+90°)"
            >
              <RotateCw className="w-3.5 h-3.5 text-blue-600" />
              <span>Putar Kanan</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => startCamera(selectedCameraId)}
              className="text-blue-600 hover:text-blue-800 font-bold text-xs cursor-pointer"
            >
              Ambil Ulang
            </button>
            <span className="text-slate-300">•</span>
            <button
              type="button"
              onClick={() => onChange('')}
              className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-800 font-bold text-xs cursor-pointer"
            >
              <Trash2 className="w-3 h-3" /> Hapus
            </button>
          </div>
        </div>
      )}

      {/* Error Message */}
      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex items-center justify-between">
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-rose-500 hover:text-rose-700 p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
