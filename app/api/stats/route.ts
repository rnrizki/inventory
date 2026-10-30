import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [totalAssetsRow, totalValueRow, availableRow, assignedRow, maintenanceRow, byCategory] =
      await Promise.all([
        db.queryOne<{ count: string }>('SELECT COUNT(*) as count FROM assets'),
        db.queryOne<{ total: string }>('SELECT COALESCE(SUM(purchase_cost), 0) as total FROM assets'),
        db.queryOne<{ count: string }>('SELECT COUNT(*) as count FROM assets WHERE asset_status = 1'),
        db.queryOne<{ count: string }>('SELECT COUNT(*) as count FROM assets WHERE asset_status = 2'),
        db.queryOne<{ count: string }>('SELECT COUNT(*) as count FROM assets WHERE asset_status = 11'),
        db.query(`
          SELECT c.name, COUNT(a.id)::int as count 
          FROM categories c 
          LEFT JOIN assets a ON c.id = a.category_id 
          GROUP BY c.id, c.name
        `),
      ]);

    return NextResponse.json({
      success: true,
      data: {
        totalAssets: Number(totalAssetsRow?.count || 0),
        totalValue: Number(totalValueRow?.total || 0),
        available: Number(availableRow?.count || 0),
        assigned: Number(assignedRow?.count || 0),
        maintenance: Number(maintenanceRow?.count || 0),
        byCategory,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
