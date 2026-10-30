import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requirePrivilegedUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const categories = await db.query(`
      SELECT c.*, COUNT(a.id)::int as asset_count 
      FROM categories c 
      LEFT JOIN assets a ON c.id = a.category_id 
      GROUP BY c.id, c.name, c.description, c.created_at
      ORDER BY c.name ASC
    `);
    return NextResponse.json({ success: true, data: categories });
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
      return NextResponse.json({ success: false, error: 'Category name is required' }, { status: 400 });
    }
    const cat = await db.queryOne(`
      INSERT INTO categories (name, description)
      VALUES (?, ?)
      RETURNING *;
    `, [name, description || '']);

    return NextResponse.json({ success: true, data: cat }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
