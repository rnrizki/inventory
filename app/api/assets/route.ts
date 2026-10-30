import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requirePrivilegedUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('q') || '';
    const categoryId = searchParams.get('category');
    const status = searchParams.get('status');

    let queryStr = `
      SELECT a.*, c.name as category_name, l.name as location_name
      FROM assets a
      LEFT JOIN categories c ON a.category_id = c.id
      LEFT JOIN locations l ON a.location_id = l.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search) {
      queryStr += ` AND (a.asset_name ILIKE ? OR a.serial_number ILIKE ? OR a.model_number ILIKE ? OR a.supplier_name ILIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    if (categoryId) {
      queryStr += ` AND a.category_id = ?`;
      params.push(Number(categoryId));
    }

    if (status) {
      queryStr += ` AND a.asset_status = ?`;
      params.push(Number(status));
    }

    queryStr += ` ORDER BY a.id DESC`;

    const assets = await db.query(queryStr, params);
    return NextResponse.json({ success: true, data: assets });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authError = requirePrivilegedUser();
  if (authError) return authError;

  try {
    const body = await request.json();
    const {
      asset_name,
      asset_description,
      serial_number,
      model_number,
      purchase_cost,
      purchase_date,
      supplier_name,
      supplier_phone,
      supplier_address,
      category_id,
      location_id,
      asset_status,
      assigned_to,
    } = body;

    if (!asset_name) {
      return NextResponse.json({ success: false, error: 'Asset name is required' }, { status: 400 });
    }

    const insertSql = `
      INSERT INTO assets (
        asset_name, asset_description, serial_number, model_number,
        purchase_cost, purchase_date, supplier_name, supplier_phone,
        supplier_address, category_id, location_id, asset_status, assigned_to
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *;
    `;

    const asset = await db.queryOne(insertSql, [
      asset_name,
      asset_description || '',
      serial_number || '',
      model_number || '',
      Number(purchase_cost) || 0,
      purchase_date || '',
      supplier_name || '',
      supplier_phone || '',
      supplier_address || '',
      category_id ? Number(category_id) : null,
      location_id ? Number(location_id) : null,
      asset_status ? Number(asset_status) : 1,
      assigned_to || '',
    ]);

    if (asset?.id) {
      await db.execute(
        `INSERT INTO asset_history (asset_id, action, note) VALUES (?, 'Created', 'Asset registered')`,
        [asset.id]
      );
    }

    return NextResponse.json({ success: true, data: asset }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
