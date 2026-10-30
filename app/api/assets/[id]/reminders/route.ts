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

    const created = await db.queryOne(`
      INSERT INTO asset_reminders (asset_id, description, reminder_date)
      VALUES (?, ?, ?)
      RETURNING *;
    `, [assetId, description, reminder_date]);

    return NextResponse.json({ success: true, data: created });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
