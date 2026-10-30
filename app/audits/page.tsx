'use client';

import React, { useState, useEffect } from 'react';
import { ClipboardCheck, Plus, Calendar, CheckCircle2, Search, ArrowRight } from 'lucide-react';

export default function AuditsPage() {
  const [audits, setAudits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ email: string; role: string; canEdit: boolean } | null>(null);
  const [form, setForm] = useState({
    audit_name: '',
    audit_date: new Date().toISOString().split('T')[0],
    auditor: 'Admin',
    notes: '',
  });

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.authenticated && d.user) setCurrentUser(d.user);
      })
      .catch(() => {});
  }, []);

  const fetchAudits = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/audits');
      const json = await res.json();
      if (json.success) {
        setAudits(json.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAudits();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/audits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowModal(false);
        setForm({ audit_name: '', audit_date: new Date().toISOString().split('T')[0], auditor: 'Admin', notes: '' });
        fetchAudits();
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Physical Asset Audits</h1>
          <p className="text-sm text-slate-500 mt-1">Audit cycles, physical verification, and inventory count reports.</p>
        </div>
        {currentUser?.canEdit && (
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition"
          >
            <Plus className="w-4 h-4" /> Start New Audit
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs divide-y divide-slate-100">
          <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3.5">#</th>
              <th className="px-5 py-3.5">Audit Name</th>
              <th className="px-5 py-3.5">Auditor / By</th>
              <th className="px-5 py-3.5">Audit Date</th>
              <th className="px-5 py-3.5">Notes</th>
              <th className="px-5 py-3.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">Loading audit records...</td>
              </tr>
            ) : audits.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400">
                  <ClipboardCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  No audits scheduled or recorded yet.
                </td>
              </tr>
            ) : (
              audits.map((a, idx) => (
                <tr key={a.id} className="hover:bg-slate-50/50">
                  <td className="px-5 py-3.5 font-mono text-slate-400">{idx + 1}</td>
                  <td className="px-5 py-3.5 font-bold text-slate-900">{a.audit_name}</td>
                  <td className="px-5 py-3.5 text-slate-600">{a.audit_by}</td>
                  <td className="px-5 py-3.5 text-slate-600 font-mono">{a.audit_date}</td>
                  <td className="px-5 py-3.5 text-slate-500">{a.notes || '-'}</td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] font-bold border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3" /> Completed
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* New Audit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-base font-bold text-slate-900 mb-1">Create Inventory Audit</h3>
            <p className="text-xs text-slate-500 mb-4">Set up a physical inspection and audit verification.</p>
            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Audit Title *</label>
                <input
                  type="text"
                  required
                  value={form.audit_name}
                  onChange={(e) => setForm({ ...form, audit_name: e.target.value })}
                  placeholder="e.g. Q4 2026 Head Office IT Assets Audit"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Auditor Name</label>
                <input
                  type="text"
                  value={form.auditor}
                  onChange={(e) => setForm({ ...form, auditor: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Audit Date</label>
                <input
                  type="date"
                  value={form.audit_date}
                  onChange={(e) => setForm({ ...form, audit_date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Audit Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Verification scope, room numbers, etc..."
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border rounded-lg font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700">
                  Save Audit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
