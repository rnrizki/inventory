'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import {
  Box,
  Layers,
  MapPin,
  LayoutDashboard,
  Printer,
  QrCode,
  ClipboardCheck,
  TrendingDown,
  BarChart3,
  ScanLine,
  Upload,
} from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();

  const primaryLinks = [
    { href: '/assets', label: 'Assets', icon: Box },
    { href: '/scanner', label: 'QR Scanner', icon: ScanLine },
    { href: '/audits', label: 'Audits', icon: ClipboardCheck },
    { href: '/depreciation', label: 'Depreciation', icon: TrendingDown },
    { href: '/reports', label: 'Reports', icon: BarChart3 },
    { href: '/categories', label: 'Categories', icon: Layers },
    { href: '/locations', label: 'Locations', icon: MapPin },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex h-16 items-center justify-between">
        <div className="flex items-center gap-6">
          <a href="/assets" className="flex items-center gap-2.5 font-bold text-slate-900 text-lg tracking-tight hover:opacity-90 transition">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Box className="w-5 h-5" />
            </div>
            <div>
              <span className="bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent font-extrabold">SkyInventory</span>
              <span className="text-[11px] block text-slate-500 font-normal -mt-1">Asset Central Mandiri</span>
            </div>
          </a>

          <nav className="hidden lg:flex items-center gap-1">
            {primaryLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href || (link.href !== '/' && pathname?.startsWith(link.href));
              return (
                <a
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {link.label}
                </a>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            XP-420B TSPL Ready
          </div>
          <a
            href="/assets"
            className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition"
          >
            <Box className="w-3.5 h-3.5" />
            Assets List
          </a>
        </div>
      </div>
    </header>
  );
}
