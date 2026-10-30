'use client';

import React, { useState, useEffect } from 'react';
import { MapPin, Plus, Save } from 'lucide-react';

export default function LocationsPage() {
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ email: string; role: string; canEdit: boolean } | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.authenticated && d.user) setCurrentUser(d.user);
      })
      .catch(() => {});
  }, []);

  const fetchLocations = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/locations').then((r) => r.json());
      if (res.success) setLocations(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: desc }),
      });
      const data = await res.json();
      if (data.success) {
        setName('');
        setDesc('');
        fetchLocations();
      } else {
        alert(data.error || 'Failed to add location');
      }
    } catch (err) {
      alert('Error adding location');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Locations & Branch Offices</h1>
        <p className="text-xs text-slate-500 mt-1">Master data lokasi penempatan aset dan departemen</p>
      </div>

      <div className={`grid grid-cols-1 ${currentUser?.canEdit ? 'md:grid-cols-3' : ''} gap-6`}>
        {/* Form Add */}
        {currentUser?.canEdit && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-600" /> Add Location
            </h2>
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">Location Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Kantor Pusat, Lantai 2"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">Address / Details</label>
                <textarea
                  rows={2}
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="Jl. Gotong Royong I No. 50..."
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                {isSubmitting ? 'Saving...' : 'Save Location'}
              </button>
            </form>
          </div>
        )}

        {/* List */}
        <div className={`${currentUser?.canEdit ? 'md:col-span-2' : ''} bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden`}>
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">All Locations</h2>
            <span className="text-xs text-slate-400 font-semibold">{locations.length} total</span>
          </div>
          <div className="divide-y divide-slate-100">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading locations...</div>
            ) : locations.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">No locations found.</div>
            ) : (
              locations.map((loc) => (
                <div key={loc.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900">{loc.name}</div>
                      <div className="text-xs text-slate-500">{loc.description || 'No address details'}</div>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full">
                    {loc.asset_count || 0} Assets
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
