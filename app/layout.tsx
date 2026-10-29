import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'SkyInventory — SkyConnection Asset & Inventory Management',
  description: 'Modern Asset Management with Native TSPL Thermal Printer (Xprinter XP-420B) support',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
        <Navbar />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
        <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
          SkyInventory &copy; {new Date().getFullYear()} SkyConnection. All rights reserved. · Compatible with Xprinter XP-420B Native TSPL.
        </footer>
      </body>
    </html>
  );
}
