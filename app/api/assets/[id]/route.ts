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

    const [events, rawHistory, files, reminders, notes, maintenance, audits] = await Promise.all([
      db.query(
        `SELECT id, asset_id, event_type, notes, event_by, signature, event_date, target_person, cost, created_at
         FROM asset_events
         WHERE asset_id = ?
         ORDER BY id DESC`,
        [id]
      ),
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

    const cleanEvents = (events || []).map((e: any) => ({
      ...e,
      notes: e.notes ? e.notes.replace(/s3api2\.skyconnection\.id/g, 's3web2.skyconnection.id') : '',
    }));

    const history = (rawHistory || []).map((h: any) => {
      let assigned = h.assigned_to;
      if (!assigned || assigned === '-') {
        if (h.action === 'ALLOCATE' || h.action === 'Allocated') {
          const allocateEvent = cleanEvents.find(
            (e: any) =>
              (e.event_type && String(e.event_type).startsWith('Allocated to ')) ||
              e.target_person
          );
          assigned =
            allocateEvent?.target_person ||
            (allocateEvent?.event_type ? String(allocateEvent.event_type).replace('Allocated to ', '') : '') ||
            asset.assigned_to ||
            '-';
        }
      }
      return {
        ...h,
        image_url: h.image_url ? h.image_url.replace(/s3api2\.skyconnection\.id/g, 's3web2.skyconnection.id') : null,
        assigned_to: assigned && assigned !== '-' ? assigned : (h.action === 'ALLOCATE' ? (asset.assigned_to || '-') : '-'),
        location: h.location && h.location !== '-' ? h.location : (asset.location_name || '-'),
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        ...asset,
        asset_image: asset.asset_image ? asset.asset_image.replace(/s3api2\.skyconnection\.id/g, 's3web2.skyconnection.id') : '',
        events: cleanEvents,
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
      asset_image,
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
        asset_image = CASE WHEN ?::text IS NOT NULL THEN ?::text ELSE asset_image END,
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
      asset_image !== undefined ? asset_image : null,
      asset_image !== undefined ? asset_image : null,
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
