import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const audits = db.prepare('SELECT * FROM asset_audits ORDER BY id DESC').all();
    return NextResponse.json({ success: true, data: audits });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { audit_name, audit_date, auditor, notes, assets_list } = body;

    if (!audit_name) {
      return NextResponse.json({ success: false, error: 'Audit name is required' }, { status: 400 });
    }

    const res = db.prepare(`
      INSERT INTO asset_audits (audit_name, audit_by, audit_date, assets_list, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      audit_name,
      auditor || 'Admin',
      audit_date || new Date().toISOString().split('T')[0],
      typeof assets_list === 'string' ? assets_list : JSON.stringify(assets_list || []),
      notes || ''
    );

    const created = db.prepare('SELECT * FROM asset_audits WHERE id = ?').get(res.lastInsertRowid);
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
