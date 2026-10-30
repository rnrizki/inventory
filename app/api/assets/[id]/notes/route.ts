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
    const { note_content, created_by } = body;

    if (!note_content) {
      return NextResponse.json({ success: false, error: 'Note content required' }, { status: 400 });
    }

    const created = await db.queryOne(`
      INSERT INTO asset_notes (asset_id, note_content, created_by)
      VALUES (?, ?, ?)
      RETURNING *;
    `, [assetId, note_content, created_by || 'Admin']);

    return NextResponse.json({ success: true, data: created });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
