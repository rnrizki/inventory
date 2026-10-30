import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requirePrivilegedUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const authError = requirePrivilegedUser();
  if (authError) return authError;

  try {
    const assetId = Number(params.id);
    const body = await request.json();
    const { title, description, cost, start_date, end_date } = body;

    if (!title) {
      return NextResponse.json({ success: false, error: 'Maintenance title is required' }, { status: 400 });
    }

    const created = await db.queryOne(`
      INSERT INTO asset_maintenance (asset_id, title, description, cost, start_date, end_date)
      VALUES (?, ?, ?, ?, ?, ?)
      RETURNING *;
    `, [assetId, title, description || '', Number(cost) || 0, start_date || '', end_date || '']);

    // Also update asset status to Maintenance (11)
    await db.execute(`UPDATE assets SET asset_status = 11, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [assetId]);

    // Record Event
    await db.execute(
      `INSERT INTO asset_events (asset_id, event_type, notes) VALUES (?, 'Maintenance Scheduled', ?)`,
      [assetId, `${title}: ${description || ''}`]
    );

    return NextResponse.json({ success: true, data: created });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
