import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const assetId = Number(params.id);
    const body = await request.json();
    const { note_content, created_by } = body;

    if (!note_content) {
      return NextResponse.json({ success: false, error: 'Note content required' }, { status: 400 });
    }

    const res = db.prepare(`
      INSERT INTO asset_notes (asset_id, note_content, created_by)
      VALUES (?, ?, ?)
    `).run(assetId, note_content, created_by || 'Admin');

    const created = db.prepare('SELECT * FROM asset_notes WHERE id = ?').get(res.lastInsertRowid);
    return NextResponse.json({ success: true, data: created });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
