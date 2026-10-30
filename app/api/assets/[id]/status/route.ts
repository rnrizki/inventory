import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { ASSET_STATUSES } from '@/lib/status';
import { requirePrivilegedUser, getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const authError = requirePrivilegedUser();
  if (authError) return authError;

  const session = getSession();
  const changedBy = session?.name ? `${session.name} (${session.email})` : session?.email || 'Admin';

  try {
    const id = Number(params.id);
    const body = await request.json();
    const {
      action,
      date,
      assigned_to,
      target_person,
      amount,
      note,
      signature,
      maintenance_title,
      maintenance_details,
      maintenance_status,
      due_date,
      date_completed,
    } = body;

    const currentAsset = await db.queryOne('SELECT * FROM assets WHERE id = ?', [id]);
    if (!currentAsset) {
      return NextResponse.json({ success: false, error: 'Asset not found' }, { status: 404 });
    }

    let newStatus = currentAsset.asset_status;
    let newAssignedTo = currentAsset.assigned_to;
    let eventName = action;
    const recipient = target_person || assigned_to || '';
    const actionDate = date || new Date().toISOString().split('T')[0];
    const costVal = amount !== undefined && amount !== '' ? Number(amount) : 0;

    switch (action?.toLowerCase()) {
      case 'allocate':
        newStatus = 2; // Allocated
        newAssignedTo = recipient || 'Staff Member';
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
        newAssignedTo = null;
        eventName = recipient ? `Disposed to ${recipient}` : 'Disposed';
        break;
      case 'donate':
        newStatus = 8; // Donated
        newAssignedTo = null;
        eventName = recipient ? `Donated to ${recipient}` : 'Donated';
        break;
      case 'sell':
        newStatus = 9; // Sold
        newAssignedTo = null;
        eventName = recipient ? `Sold to ${recipient}` : 'Sold';
        break;
      case 'repair':
        newStatus = 10; // Under Repair
        eventName = recipient ? `Sent for Repair (Assigned to ${recipient})` : 'Sent for Repair';
        break;
      case 'maintenance':
        newStatus = 11; // Maintenance
        eventName = maintenance_title ? `Maintenance: ${maintenance_title}` : 'Scheduled Maintenance';
        break;
      default:
        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }

    // Update asset status and assignment
    await db.execute(
      `
      UPDATE assets SET
        asset_status = ?,
        assigned_to = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
      [newStatus, newAssignedTo, id]
    );

    // Build event note description
    const noteParts: string[] = [];
    if (note) noteParts.push(note);
    if (recipient && !['allocate', 'revocate'].includes(action?.toLowerCase())) {
      noteParts.push(`Target: ${recipient}`);
    }
    if (costVal > 0) {
      noteParts.push(`Cost/Value: Rp ${costVal.toLocaleString('id-ID')}`);
    }
    if (date_completed) {
      noteParts.push(`Completed: ${date_completed}`);
    }
    const finalEventNotes = noteParts.join(' | ') || `Status updated via action: ${action}`;

    // Record Event (with signature and details)
    await db.execute(
      `
      INSERT INTO asset_events (
        asset_id, event_type, notes, event_by, signature, event_date, target_person, cost, status_details
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        id,
        eventName,
        finalEventNotes,
        changedBy,
        signature || '',
        actionDate,
        recipient,
        costVal,
        JSON.stringify(body),
      ]
    );

    // If Maintenance action, also record in asset_maintenance
    if (action?.toLowerCase() === 'maintenance') {
      await db.execute(
        `
        INSERT INTO asset_maintenance (
          asset_id, title, description, cost, start_date, due_date, maintenance_by, maintenance_status, date_completed, signature
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          id,
          maintenance_title || 'Scheduled Maintenance',
          maintenance_details || note || '',
          costVal,
          actionDate,
          due_date || '',
          recipient,
          maintenance_status || 'Nothing selected',
          date_completed || '',
          signature || '',
        ]
      );
    }

    // Record History Audit Log
    await db.execute(
      `
      INSERT INTO asset_history (asset_id, action, note, changed_from, changed_to, changed_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
      [
        id,
        action.toUpperCase(),
        finalEventNotes,
        String(currentAsset.asset_status),
        String(newStatus),
        changedBy,
      ]
    );

    const updated = await db.queryOne(
      `
      SELECT a.*, c.name as category_name, l.name as location_name
      FROM assets a
      LEFT JOIN categories c ON a.category_id = c.id
      LEFT JOIN locations l ON a.location_id = l.id
      WHERE a.id = ?
    `,
      [id]
    );

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
