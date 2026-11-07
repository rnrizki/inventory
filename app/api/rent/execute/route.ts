import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requirePrivilegedUser, getSession } from '@/lib/auth';
import { processAndUploadImageToS3 } from '@/lib/optimizer';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const authError = requirePrivilegedUser();
  if (authError) return authError;

  const session = getSession();
  const actorName = session?.name ? `${session.name} (${session.email})` : session?.email || 'Admin';

  try {
    const body = await request.json();
    const {
      action,
      asset_ids,
      assigned_to,
      date,
      expected_return_date,
      notes,
      image,
      signature,
    } = body;

    const actionType = action === 'revocate' ? 'REVOCATE' : 'ALLOCATE';

    if (!Array.isArray(asset_ids) || asset_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Please select at least one asset' },
        { status: 400 }
      );
    }

    if (actionType === 'ALLOCATE' && (!assigned_to || !assigned_to.trim())) {
      return NextResponse.json(
        { success: false, error: 'Assigned To / Renter Name is required for Allocate' },
        { status: 400 }
      );
    }

    const todayStr = (date || new Date().toISOString().split('T')[0]).replace(/-/g, '');
    const randSuffix = crypto.randomBytes(2).toString('hex').toUpperCase();
    const prefix = actionType === 'ALLOCATE' ? 'SJ' : 'RET';
    const batchCode = `${prefix}-${todayStr}-${randSuffix}`;
    const transactionDate = date || new Date().toISOString().split('T')[0];

    // Upload proof photo to S3 via Rust image optimizer (max 400px wide, keeps ratio)
    let uploadedImageUrl = '';
    if (image && typeof image === 'string' && image.trim() !== '') {
      try {
        const uploadRes = await processAndUploadImageToS3(
          image.trim(),
          'history',
          `rent-${batchCode.toLowerCase()}`
        );
        uploadedImageUrl = uploadRes.url;
      } catch (err: any) {
        console.error('Failed to optimize and upload rent image proof to S3:', err);
      }
    }

    // Execute in transaction
    const result = await db.withTransaction(async (client) => {
      // 1. Fetch assets with their locations
      const placeholders = asset_ids.map((_, i) => `$${i + 1}`).join(',');
      const assetsRes = await client.query(
        `SELECT a.*, l.name as location_name
         FROM assets a
         LEFT JOIN locations l ON a.location_id = l.id
         WHERE a.id IN (${placeholders})`,
        asset_ids
      );
      const assets = assetsRes.rows;

      if (assets.length === 0) {
        throw new Error('None of the specified assets were found');
      }

      const targetStatus = actionType === 'ALLOCATE' ? 2 : 3;
      const targetPerson = actionType === 'ALLOCATE' ? assigned_to.trim() : null;
      const recipientLabel = actionType === 'ALLOCATE' ? assigned_to.trim() : '-';

      // 2. Update status and assignment for all assets in bulk
      const updatePlaceholders = asset_ids.map((_, i) => `$${i + 3}`).join(',');
      await client.query(
        `UPDATE assets
         SET asset_status = $1, assigned_to = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id IN (${updatePlaceholders})`,
        [targetStatus, targetPerson, ...asset_ids]
      );

      // 3. Insert events and history for each asset
      for (const asset of assets) {
        const eventTitle =
          actionType === 'ALLOCATE'
            ? `Allocated in Batch ${batchCode} to ${recipientLabel}`
            : `Revocated (Returned) in Batch ${batchCode}`;

        const noteText = notes
          ? `${notes} | Expected Return: ${expected_return_date || '-'}`
          : `Batch ${actionType}: ${batchCode}${expected_return_date ? ` | Return Due: ${expected_return_date}` : ''}`;

        // Sanitized details (never raw base64)
        const details = JSON.stringify({
          batch_code: batchCode,
          action: actionType,
          assigned_to: recipientLabel,
          date: transactionDate,
          expected_return_date: expected_return_date || null,
          image: uploadedImageUrl || null,
        });

        // Insert event
        await client.query(
          `INSERT INTO asset_events (
            asset_id, event_type, notes, event_by, signature, event_date, target_person, cost, status_details
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            asset.id,
            eventTitle,
            noteText,
            actorName,
            signature || '',
            transactionDate,
            actionType === 'ALLOCATE' ? recipientLabel : '',
            0,
            details,
          ]
        );

        // Insert history audit
        await client.query(
          `INSERT INTO asset_history (
            asset_id, action, note, changed_from, changed_to, changed_by, image_url, assigned_to, location
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            asset.id,
            actionType,
            noteText,
            String(asset.asset_status),
            String(targetStatus),
            actorName,
            uploadedImageUrl || '',
            recipientLabel,
            asset.location_name || '-',
          ]
        );
      }

      // 4. Record batch in asset_rent_batches
      const batchRes = await client.query(
        `INSERT INTO asset_rent_batches (
          batch_code, action_type, assigned_to, assigned_date, expected_return_date,
          notes, image_url, signature_url, actor_name, asset_ids
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          batchCode,
          actionType,
          recipientLabel,
          transactionDate,
          expected_return_date || '',
          notes || '',
          uploadedImageUrl || '',
          signature || '',
          actorName,
          JSON.stringify(asset_ids),
        ]
      );

      return {
        batch: batchRes.rows[0],
        updatedCount: assets.length,
      };
    });

    return NextResponse.json({
      success: true,
      batch_code: batchCode,
      batch_id: result.batch.id,
      count: result.updatedCount,
      image_url: uploadedImageUrl,
      action: actionType,
    });
  } catch (error: any) {
    console.error('Error executing bulk rent transaction:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
