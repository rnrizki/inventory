import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const assetId = Number(params.id);
    const body = await request.json();
    const { description, reminder_date } = body;

    if (!description || !reminder_date) {
      return NextResponse.json({ success: false, error: 'Description and date are required' }, { status: 400 });
    }

    const res = db.prepare(`
      INSERT INTO asset_reminders (asset_id, description, reminder_date)
      VALUES (?, ?, ?)
    `).run(assetId, description, reminder_date);

    const created = db.prepare('SELECT * FROM asset_reminders WHERE id = ?').get(res.lastInsertRowid);
    return NextResponse.json({ success: true, data: created });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
