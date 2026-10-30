import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requirePrivilegedUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const locations = await db.query(`
      SELECT l.*, COUNT(a.id)::int as asset_count 
      FROM locations l 
      LEFT JOIN assets a ON l.id = a.location_id 
      GROUP BY l.id, l.name, l.description, l.created_at
      ORDER BY l.name ASC
    `);
    return NextResponse.json({ success: true, data: locations });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authError = requirePrivilegedUser();
  if (authError) return authError;

  try {
    const body = await request.json();
    const { name, description } = body;
    if (!name) {
      return NextResponse.json({ success: false, error: 'Location name is required' }, { status: 400 });
    }
    const loc = await db.queryOne(`
      INSERT INTO locations (name, description)
      VALUES (?, ?)
      RETURNING *;
    `, [name, description || '']);

    return NextResponse.json({ success: true, data: loc }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
