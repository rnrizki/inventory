import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requirePrivilegedUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    const asset = await db.queryOne(`
      SELECT a.*, c.name as category_name, l.name as location_name
      FROM assets a
      LEFT JOIN categories c ON a.category_id = c.id
      LEFT JOIN locations l ON a.location_id = l.id
      WHERE a.id = ?
    `, [id]);

    if (!asset) {
      return NextResponse.json({ success: false, error: 'Asset not found' }, { status: 404 });
    }

    const [events, history, files, reminders, notes, maintenance, audits] = await Promise.all([
      db.query('SELECT * FROM asset_events WHERE asset_id = ? ORDER BY id DESC', [id]),
      db.query('SELECT * FROM asset_history WHERE asset_id = ? ORDER BY id DESC', [id]),
      db.query('SELECT * FROM asset_files WHERE asset_id = ? ORDER BY id DESC', [id]),
      db.query('SELECT * FROM asset_reminders WHERE asset_id = ? ORDER BY id DESC', [id]),
      db.query('SELECT * FROM asset_notes WHERE asset_id = ? ORDER BY id DESC', [id]),
      db.query('SELECT * FROM asset_maintenance WHERE asset_id = ? ORDER BY id DESC', [id]),
      db.query(
        `SELECT * FROM asset_audits WHERE assets_list LIKE ? OR assets_list IS NULL OR assets_list = '' ORDER BY id DESC`,
        [`%"${id}"%`]
      ),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        ...asset,
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
  const authError = requirePrivilegedUser();
  if (authError) return authError;

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

    const updateSql = `
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
      RETURNING *;
    `;

    const asset = await db.queryOne(updateSql, [
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
      id,
    ]);

    await db.execute(
      `INSERT INTO asset_history (asset_id, action, note) VALUES (?, 'Updated', 'Asset details modified')`,
      [id]
    );

    return NextResponse.json({ success: true, data: asset });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const authError = requirePrivilegedUser();
  if (authError) return authError;

  try {
    const id = Number(params.id);
    await db.execute('DELETE FROM asset_history WHERE asset_id = ?', [id]);
    await db.execute('DELETE FROM asset_events WHERE asset_id = ?', [id]);
    await db.execute('DELETE FROM asset_files WHERE asset_id = ?', [id]);
    await db.execute('DELETE FROM asset_reminders WHERE asset_id = ?', [id]);
    await db.execute('DELETE FROM asset_notes WHERE asset_id = ?', [id]);
    await db.execute('DELETE FROM asset_maintenance WHERE asset_id = ?', [id]);
    await db.execute('DELETE FROM assets WHERE id = ?', [id]);
    return NextResponse.json({ success: true, message: 'Asset deleted' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
