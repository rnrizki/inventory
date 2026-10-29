import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const categories = db.prepare(`
      SELECT c.*, COUNT(a.id) as asset_count 
      FROM categories c 
      LEFT JOIN assets a ON c.id = a.category_id 
      GROUP BY c.id 
      ORDER BY c.name ASC
    `).all();
    return NextResponse.json({ success: true, data: categories });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description } = body;
    if (!name) {
      return NextResponse.json({ success: false, error: 'Category name is required' }, { status: 400 });
    }
    const result = db.prepare('INSERT INTO categories (name, description) VALUES (?, ?)').run(name, description || '');
    const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
    return NextResponse.json({ success: true, data: cat }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
