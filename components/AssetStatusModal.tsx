'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Calendar, DollarSign, RefreshCw } from 'lucide-react';

export type LifecycleAction =
  | 'maintenance'
  | 'repair'
  | 'sell'
  | 'donate'
  | 'dispose'
  | 'found'
  | 'lost'
  | 'broken'
  | 'allocate'
  | 'revocate';

interface AssetStatusModalProps {
  isOpen: boolean;
  action: LifecycleAction | null;
  asset: any;
  onClose: () => void;
  onSaved: () => void;
}

export default function AssetStatusModal({
  isOpen,
  action,
  asset,
  onClose,
  onSaved,
}: AssetStatusModalProps) {
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [targetPerson, setTargetPerson] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [dateCompleted, setDateCompleted] = useState('');

  // Maintenance specific states
  const [maintenanceTitle, setMaintenanceTitle] = useState('');
  const [maintenanceDetails, setMaintenanceDetails] = useState('');
  const [maintenanceDueDate, setMaintenanceDueDate] = useState('');
  const [maintenanceBy, setMaintenanceBy] = useState('');
  const [maintenanceStatus, setMaintenanceStatus] = useState('');

  // Signature Canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const undoStackRef = useRef<ImageData[]>([]);
  const [hasDrawn, setHasDrawn] = useState(false);

  // Reset form when modal opens or action changes
  useEffect(() => {
    if (isOpen) {
      const today = new Date().toISOString().split('T')[0];
      setDate(today);
      setTargetPerson(action === 'allocate' ? asset?.assigned_to || '' : '');
      setAmount('');
      setNote('');
      setDateCompleted('');
      setMaintenanceTitle('');
      setMaintenanceDetails('');
      setMaintenanceDueDate('');
      setMaintenanceBy('');
      setMaintenanceStatus('');
      undoStackRef.current = [];
      setHasDrawn(false);

      // Clear signature canvas after mount
      setTimeout(() => {
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
        }
      }, 50);
    }
  }, [isOpen, action, asset]);

  if (!isOpen || !action) return null;

  // Initialize Canvas stroke styles
  const setupCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000000';
    return { canvas, ctx };
  };

  const getCanvasCoordinates = (e: React.PointerEvent<HTMLCanvasElement>) => {
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

    // Save snapshot to undo stack before starting new stroke
    const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    undoStackRef.current.push(snapshot);
    if (undoStackRef.current.length > 20) undoStackRef.current.shift();

    const { x, y } = getCanvasCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const res = setupCanvas();
    if (!res) return;
    const { ctx } = res;
    const { x, y } = getCanvasCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    const res = setupCanvas();
    if (res) res.ctx.closePath();
    setIsDrawing(false);
  };

  const handleClearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    undoStackRef.current = [];
    setHasDrawn(false);
  };

  const handleUndoSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const previous = undoStackRef.current.pop();
    if (previous) {
      ctx.putImageData(previous, 0, 0);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasDrawn(false);
    }
  };

  const getSignatureDataUrl = () => {
    if (!hasDrawn) return '';
    const canvas = canvasRef.current;
    if (!canvas) return '';
    return canvas.toDataURL('image/png');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    try {
      setSubmitting(true);
      const signatureDataUrl = getSignatureDataUrl();

      const payload: Record<string, any> = {
        action,
        date,
        target_person: targetPerson,
        amount: amount ? Number(amount) : 0,
        note,
        date_completed: dateCompleted,
        signature: signatureDataUrl,
      };

      if (action === 'maintenance') {
        payload.maintenance_title = maintenanceTitle;
        payload.maintenance_details = maintenanceDetails;
        payload.due_date = maintenanceDueDate;
        payload.target_person = maintenanceBy;
        payload.maintenance_status = maintenanceStatus || 'Nothing selected';
        payload.amount = amount ? Number(amount) : 0;
      }

      if (action === 'allocate') {
        payload.assigned_to = targetPerson;
      }

      const res = await fetch(`/api/assets/${asset.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        onSaved();
        onClose();
      } else {
        alert(json.error || 'Failed to update asset status');
      }
    } catch (err: any) {
      alert(err.message || 'Error updating status');
    } finally {
      setSubmitting(false);
    }
  };

  // Helper label text based on action
  const getDateLabel = () => {
    switch (action) {
      case 'maintenance':
        return '* Maintenance Due Date';
      case 'repair':
        return '* Schedule Date';
      case 'sell':
        return '* Sale Date';
      case 'donate':
        return '* Donate Date';
      case 'dispose':
        return '* Date Disposed';
      case 'found':
        return '* Date Found';
      case 'lost':
        return '* Date Lost';
      case 'broken':
        return '* Date Broken';
      case 'allocate':
        return '* Date Allocated';
      case 'revocate':
        return '* Date Revocated';
      default:
        return '* Date';
    }
  };

  const getTargetPersonLabel = () => {
    switch (action) {
      case 'repair':
        return 'Assigned To';
      case 'sell':
        return 'Sold To';
      case 'donate':
        return 'Donate To';
      case 'dispose':
        return 'Dispose To';
      case 'allocate':
        return '* Assigned To';
      default:
        return 'Person In Charge';
    }
  };

  const getAmountLabel = () => {
    switch (action) {
      case 'maintenance':
        return 'Maintenance Cost';
      case 'repair':
        return 'Repair Cost';
      case 'sell':
        return 'Sale Value';
      case 'donate':
        return 'Donate Value';
      default:
        return 'Value / Cost';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
            Asset Status Details
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-4 text-xs max-h-[72vh] overflow-y-auto">
            {/* 1. MAINTENANCE SPECIFIC FORM */}
            {action === 'maintenance' && (
              <>
                <div>
                  <label className="font-semibold text-slate-800 mb-1 block">
                    <span className="text-rose-500 font-bold mr-1">*</span>Maintenance Title
                  </label>
                  <input
                    type="text"
                    required
                    value={maintenanceTitle}
                    onChange={(e) => setMaintenanceTitle(e.target.value)}
                    placeholder="e.g. Regular Cooling Fan & Thermal Paste Servicing"
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-800 mb-1 block">Maintenance Details</label>
                  <textarea
                    rows={3}
                    value={maintenanceDetails}
                    onChange={(e) => setMaintenanceDetails(e.target.value)}
                    placeholder="Enter details of maintenance required or performed..."
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-800 mb-1 block">Maintenance Due Date</label>
                  <input
                    type="date"
                    value={maintenanceDueDate}
                    onChange={(e) => setMaintenanceDueDate(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-800 mb-1 block">Maintenance By</label>
                  <textarea
                    rows={2}
                    value={maintenanceBy}
                    onChange={(e) => setMaintenanceBy(e.target.value)}
                    placeholder="Name or department conducting maintenance..."
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-800 mb-1 block">Maintenance Status</label>
                  <select
                    value={maintenanceStatus}
                    onChange={(e) => setMaintenanceStatus(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition bg-white"
                  >
                    <option value="">Nothing selected</option>
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="On Hold">On Hold</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-800 mb-1 block">Date Completed</label>
                  <input
                    type="date"
                    value={dateCompleted}
                    onChange={(e) => setDateCompleted(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-800 mb-1 block">Maintenance Cost</label>
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0"
                      className="w-full px-3.5 py-2 pr-10 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    />
                    <div className="absolute right-0 top-0 bottom-0 px-3 bg-slate-50 border-l border-slate-300 flex items-center justify-center text-slate-500 font-bold rounded-r-lg">
                      $
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* 2. REPAIR SPECIFIC FORM */}
            {action === 'repair' && (
              <>
                <div>
                  <label className="font-semibold text-slate-800 mb-1 block">
                    <span className="text-rose-500 font-bold mr-1">*</span>Schedule Date
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-800 mb-1 block">Assigned To</label>
                  <input
                    type="text"
                    value={targetPerson}
                    onChange={(e) => setTargetPerson(e.target.value)}
                    placeholder="Technician or repair vendor name..."
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-800 mb-1 block">Date Completed</label>
                  <input
                    type="date"
                    value={dateCompleted}
                    onChange={(e) => setDateCompleted(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-800 mb-1 block">Repair Cost</label>
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0"
                      className="w-full px-3.5 py-2 pr-10 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    />
                    <div className="absolute right-0 top-0 bottom-0 px-3 bg-slate-50 border-l border-slate-300 flex items-center justify-center text-slate-500 font-bold rounded-r-lg">
                      $
                    </div>
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-slate-800 mb-1 block">Note</label>
                  <textarea
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Enter notes about repair issue or diagnostic..."
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                </div>
              </>
            )}

            {/* 3. SELL SPECIFIC FORM */}
            {action === 'sell' && (
              <>
                <div>
                  <label className="font-semibold text-slate-800 mb-1 block">
                    <span className="text-rose-500 font-bold mr-1">*</span>Sale Date
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-800 mb-1 block">Sold To</label>
                  <input
                    type="text"
                    value={targetPerson}
                    onChange={(e) => setTargetPerson(e.target.value)}
                    placeholder="Buyer or company name..."
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-800 mb-1 block">Sale Value</label>
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0"
                      className="w-full px-3.5 py-2 pr-10 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    />
                    <div className="absolute right-0 top-0 bottom-0 px-3 bg-slate-50 border-l border-slate-300 flex items-center justify-center text-slate-500 font-bold rounded-r-lg">
                      $
                    </div>
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-slate-800 mb-1 block">Note</label>
                  <textarea
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Enter sales terms, invoice reference, or condition notes..."
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                </div>
              </>
            )}

            {/* 4. DONATE SPECIFIC FORM */}
            {action === 'donate' && (
              <>
                <div>
                  <label className="font-semibold text-slate-800 mb-1 block">
                    <span className="text-rose-500 font-bold mr-1">*</span>Donate Date
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-800 mb-1 block">Donate To</label>
                  <input
                    type="text"
                    value={targetPerson}
                    onChange={(e) => setTargetPerson(e.target.value)}
                    placeholder="Recipient foundation or institution..."
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-800 mb-1 block">Donate Value</label>
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0"
                      className="w-full px-3.5 py-2 pr-10 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    />
                    <div className="absolute right-0 top-0 bottom-0 px-3 bg-slate-50 border-l border-slate-300 flex items-center justify-center text-slate-500 font-bold rounded-r-lg">
                      $
                    </div>
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-slate-800 mb-1 block">Note</label>
                  <textarea
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Enter donation reason or acknowledgement details..."
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                </div>
              </>
            )}

            {/* 5. DISPOSE SPECIFIC FORM */}
            {action === 'dispose' && (
              <>
                <div>
                  <label className="font-semibold text-slate-800 mb-1 block">
                    <span className="text-rose-500 font-bold mr-1">*</span>Date Disposed
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-800 mb-1 block">Dispose To</label>
                  <input
                    type="text"
                    value={targetPerson}
                    onChange={(e) => setTargetPerson(e.target.value)}
                    placeholder="Disposal vendor or waste management party..."
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-800 mb-1 block">Note</label>
                  <textarea
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Enter disposal reason, recycling method, or approval note..."
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                </div>
              </>
            )}

            {/* 6. FOUND SPECIFIC FORM */}
            {action === 'found' && (
              <>
                <div>
                  <label className="font-semibold text-slate-800 mb-1 block">
                    <span className="text-rose-500 font-bold mr-1">*</span>Date Found
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-800 mb-1 block">Note</label>
                  <textarea
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Where the asset was found, current condition..."
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                </div>
              </>
            )}

            {/* 7. LOST SPECIFIC FORM */}
            {action === 'lost' && (
              <>
                <div>
                  <label className="font-semibold text-slate-800 mb-1 block">
                    <span className="text-rose-500 font-bold mr-1">*</span>Date Lost
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-800 mb-1 block">Note</label>
                  <textarea
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Chronology of loss, police report reference, last seen location..."
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                </div>
              </>
            )}

            {/* 8. BROKEN SPECIFIC FORM */}
            {action === 'broken' && (
              <>
                <div>
                  <label className="font-semibold text-slate-800 mb-1 block">
                    <span className="text-rose-500 font-bold mr-1">*</span>Date Broken
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-800 mb-1 block">Note</label>
                  <textarea
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Description of damage or malfunction..."
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                </div>
              </>
            )}

            {/* 9. ALLOCATE SPECIFIC FORM */}
            {action === 'allocate' && (
              <>
                <div>
                  <label className="font-semibold text-slate-800 mb-1 block">
                    <span className="text-rose-500 font-bold mr-1">*</span>Date Allocated
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-800 mb-1 block">
                    <span className="text-rose-500 font-bold mr-1">*</span>Assigned To
                  </label>
                  <input
                    type="text"
                    required
                    value={targetPerson}
                    onChange={(e) => setTargetPerson(e.target.value)}
                    placeholder="Employee name or department..."
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-800 mb-1 block">Note</label>
                  <textarea
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Handover notes, accessories included..."
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                </div>
              </>
            )}

            {/* 10. REVOCATE SPECIFIC FORM */}
            {action === 'revocate' && (
              <>
                <div>
                  <label className="font-semibold text-slate-800 mb-1 block">
                    <span className="text-rose-500 font-bold mr-1">*</span>Date Revocated
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-800 mb-1 block">Note</label>
                  <textarea
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Return condition, reason for revocation..."
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                </div>
              </>
            )}

            {/* SIGNATURE PAD (Common to all actions matching screenshot) */}
            <div className="pt-2">
              <label className="font-semibold text-slate-800 mb-1.5 block">Signature</label>
              <div className="border border-slate-300 rounded-lg overflow-hidden bg-white relative">
                <canvas
                  ref={canvasRef}
                  width={540}
                  height={140}
                  style={{ touchAction: 'none' }}
                  onPointerDown={startDrawing}
                  onPointerMove={draw}
                  onPointerUp={stopDrawing}
                  onPointerLeave={stopDrawing}
                  className="w-full h-32 cursor-crosshair bg-white block"
                />
              </div>

              {/* Clear and Undo buttons matching screenshot */}
              <div className="flex items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={handleClearSignature}
                  className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition shadow-2xs"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={handleUndoSignature}
                  className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition shadow-2xs"
                >
                  Undo
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition shadow-2xs disabled:opacity-50"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition shadow-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving...
                </>
              ) : (
                'Save'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
