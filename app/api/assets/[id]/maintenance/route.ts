import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const assetId = Number(params.id);
    const body = await request.json();
    const { title, description, cost, start_date, end_date } = body;

    if (!title) {
      return NextResponse.json({ success: false, error: 'Maintenance title is required' }, { status: 400 });
    }

    const res = db.prepare(`
      INSERT INTO asset_maintenance (asset_id, title, description, cost, start_date, end_date)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(assetId, title, description || '', Number(cost) || 0, start_date || '', end_date || '');

    // Also update asset status to Maintenance (11)
    db.prepare(`UPDATE assets SET asset_status = 11, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(assetId);

    // Record Event
    db.prepare(`
      INSERT INTO asset_events (asset_id, event_type, notes)
      VALUES (?, 'Maintenance Scheduled', ?)
    `).run(assetId, `${title}: ${description || ''}`);

    const created = db.prepare('SELECT * FROM asset_maintenance WHERE id = ?').get(res.lastInsertRowid);
    return NextResponse.json({ success: true, data: created });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
