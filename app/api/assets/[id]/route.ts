import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    const asset = db.prepare(`
      SELECT a.*, c.name as category_name, l.name as location_name
      FROM assets a
      LEFT JOIN categories c ON a.category_id = c.id
      LEFT JOIN locations l ON a.location_id = l.id
      WHERE a.id = ?
    `).get(id);

    if (!asset) {
      return NextResponse.json({ success: false, error: 'Asset not found' }, { status: 404 });
    }

    const history = db.prepare('SELECT * FROM asset_history WHERE asset_id = ? ORDER BY id DESC').all(id);

    return NextResponse.json({ success: true, data: { ...(asset as any), history } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
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

    const stmt = db.prepare(`
      UPDATE assets SET
        asset_name = ?,
        asset_description = ?,
        serial_number = ?,
        model_number = ?,
        purchase_cost = ?,
        purchase_date = ?,
        supplier_name = ?,
        supplier_phone = ?,
        supplier_address = ?,
        category_id = ?,
        location_id = ?,
        asset_status = ?,
        assigned_to = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(
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
      id
    );

    db.prepare(`INSERT INTO asset_history (asset_id, action, note) VALUES (?, 'Updated', 'Asset details modified')`).run(id);

    const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(id);
    return NextResponse.json({ success: true, data: asset });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    db.prepare('DELETE FROM asset_history WHERE asset_id = ?').run(id);
    db.prepare('DELETE FROM assets WHERE id = ?').run(id);
    return NextResponse.json({ success: true, message: 'Asset deleted' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
