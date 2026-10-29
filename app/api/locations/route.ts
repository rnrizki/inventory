import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const locations = db.prepare(`
      SELECT l.*, COUNT(a.id) as asset_count 
      FROM locations l 
      LEFT JOIN assets a ON l.id = a.location_id 
      GROUP BY l.id 
      ORDER BY l.name ASC
    `).all();
    return NextResponse.json({ success: true, data: locations });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description } = body;
    if (!name) {
      return NextResponse.json({ success: false, error: 'Location name is required' }, { status: 400 });
    }
    const result = db.prepare('INSERT INTO locations (name, description) VALUES (?, ?)').run(name, description || '');
    const loc = db.prepare('SELECT * FROM locations WHERE id = ?').get(result.lastInsertRowid);
    return NextResponse.json({ success: true, data: loc }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
