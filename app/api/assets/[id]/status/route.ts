import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { ASSET_STATUSES } from '@/lib/status';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    const body = await request.json();
    const { action, assigned_to, note } = body;

    const currentAsset = await db.queryOne('SELECT * FROM assets WHERE id = ?', [id]);
    if (!currentAsset) {
      return NextResponse.json({ success: false, error: 'Asset not found' }, { status: 404 });
    }

    let newStatus = currentAsset.asset_status;
    let newAssignedTo = currentAsset.assigned_to;
    let eventName = action;

    switch (action?.toLowerCase()) {
      case 'allocate':
        newStatus = 2; // Allocated
        newAssignedTo = assigned_to || 'Staff Member';
        eventName = `Allocated to ${newAssignedTo}`;
        break;
      case 'revocate':
        newStatus = 3; // Revocated / Available
        newAssignedTo = null;
        eventName = 'Revocated (Returned)';
        break;
      case 'lost':
        newStatus = 4; // Lost
        eventName = 'Reported Lost';
        break;
      case 'found':
        newStatus = 1; // Available
        eventName = 'Marked as Found';
        break;
      case 'broken':
        newStatus = 6; // Broken
        eventName = 'Marked as Broken';
        break;
      case 'dispose':
        newStatus = 7; // Disposed
        eventName = 'Disposed';
        break;
      case 'donate':
        newStatus = 8; // Donated
        eventName = 'Donated';
        break;
      case 'sell':
        newStatus = 9; // Sold
        eventName = 'Sold';
        break;
      case 'repair':
        newStatus = 10; // Under Repair
        eventName = 'Sent for Repair';
        break;
      case 'maintenance':
        newStatus = 11; // Maintenance
        eventName = 'Under Scheduled Maintenance';
        break;
      default:
        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }

    // Update asset
    await db.execute(`
      UPDATE assets SET
        asset_status = ?,
        assigned_to = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [newStatus, newAssignedTo, id]);

    // Record Event
    await db.execute(`
      INSERT INTO asset_events (asset_id, event_type, notes)
      VALUES (?, ?, ?)
    `, [id, eventName, note || `Status updated via quick action: ${action}`]);

    // Record History
    await db.execute(`
      INSERT INTO asset_history (asset_id, action, note, changed_from, changed_to)
      VALUES (?, ?, ?, ?, ?)
    `, [
      id,
      action.toUpperCase(),
      note || `Status changed from ${ASSET_STATUSES[currentAsset.asset_status]?.name || currentAsset.asset_status} to ${ASSET_STATUSES[newStatus]?.name || newStatus}`,
      String(currentAsset.asset_status),
      String(newStatus)
    ]);

    const updated = await db.queryOne(`
      SELECT a.*, c.name as category_name, l.name as location_name
      FROM assets a
      LEFT JOIN categories c ON a.category_id = c.id
      LEFT JOIN locations l ON a.location_id = l.id
      WHERE a.id = ?
    `, [id]);

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
