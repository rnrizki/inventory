import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requirePrivilegedUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const audits = await db.query('SELECT * FROM asset_audits ORDER BY id DESC');
    return NextResponse.json({ success: true, data: audits });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authError = requirePrivilegedUser();
  if (authError) return authError;

  try {
    const body = await request.json();
    const { audit_name, audit_date, auditor, notes, assets_list } = body;

    if (!audit_name) {
      return NextResponse.json({ success: false, error: 'Audit name is required' }, { status: 400 });
    }

    const created = await db.queryOne(`
      INSERT INTO asset_audits (audit_name, audit_by, audit_date, assets_list, notes)
      VALUES (?, ?, ?, ?, ?)
      RETURNING *;
    `, [
      audit_name,
      auditor || 'Admin',
      audit_date || new Date().toISOString().split('T')[0],
      typeof assets_list === 'string' ? assets_list : JSON.stringify(assets_list || []),
      notes || '',
    ]);

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
