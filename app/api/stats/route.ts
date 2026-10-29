import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const totalAssets = (db.prepare('SELECT COUNT(*) as count FROM assets').get() as any).count;
    const totalValue = (db.prepare('SELECT SUM(purchase_cost) as total FROM assets').get() as any).total || 0;
    const available = (db.prepare('SELECT COUNT(*) as count FROM assets WHERE asset_status = 1').get() as any).count;
    const assigned = (db.prepare('SELECT COUNT(*) as count FROM assets WHERE asset_status = 2').get() as any).count;
    const maintenance = (db.prepare('SELECT COUNT(*) as count FROM assets WHERE asset_status = 3').get() as any).count;

    const byCategory = db.prepare(`
      SELECT c.name, COUNT(a.id) as count 
      FROM categories c 
      LEFT JOIN assets a ON c.id = a.category_id 
      GROUP BY c.id
    `).all();

    return NextResponse.json({
      success: true,
      data: {
        totalAssets,
        totalValue,
        available,
        assigned,
        maintenance,
        byCategory,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
