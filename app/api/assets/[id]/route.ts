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

    const events = db.prepare('SELECT * FROM asset_events WHERE asset_id = ? ORDER BY id DESC').all(id);
    const history = db.prepare('SELECT * FROM asset_history WHERE asset_id = ? ORDER BY id DESC').all(id);
    const files = db.prepare('SELECT * FROM asset_files WHERE asset_id = ? ORDER BY id DESC').all(id);
    const reminders = db.prepare('SELECT * FROM asset_reminders WHERE asset_id = ? ORDER BY id DESC').all(id);
    const notes = db.prepare('SELECT * FROM asset_notes WHERE asset_id = ? ORDER BY id DESC').all(id);
    const maintenance = db.prepare('SELECT * FROM asset_maintenance WHERE asset_id = ? ORDER BY id DESC').all(id);
    const audits = db.prepare(`
      SELECT * FROM asset_audits 
      WHERE assets_list LIKE ? OR assets_list IS NULL OR assets_list = ''
      ORDER BY id DESC
    `).all(`%"${id}"%`);

    return NextResponse.json({
      success: true,
      data: {
        ...(asset as any),
        events,
        history,
        files,
        reminders,
        notes,
        maintenance,
        audits,
      },
    });
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
      warranty_period_month,
      depreciation_months,
      depreciation_percentage,
      residual_value,
      depreciation_method,
      appreciation_rate,
      appreciation_periods,
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
        warranty_period_month = ?,
        depreciation_months = ?,
        depreciation_percentage = ?,
        residual_value = ?,
        depreciation_method = ?,
        appreciation_rate = ?,
        appreciation_periods = ?,
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
      Number(warranty_period_month) || 0,
      Number(depreciation_months) || 0,
      depreciation_percentage || '',
      residual_value || '',
      depreciation_method || 'reducing_balance',
      appreciation_rate || '',
      appreciation_periods || '',
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
    db.prepare('DELETE FROM asset_events WHERE asset_id = ?').run(id);
    db.prepare('DELETE FROM asset_files WHERE asset_id = ?').run(id);
    db.prepare('DELETE FROM asset_reminders WHERE asset_id = ?').run(id);
    db.prepare('DELETE FROM asset_notes WHERE asset_id = ?').run(id);
    db.prepare('DELETE FROM asset_maintenance WHERE asset_id = ?').run(id);
    db.prepare('DELETE FROM assets WHERE id = ?').run(id);
    return NextResponse.json({ success: true, message: 'Asset deleted' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
