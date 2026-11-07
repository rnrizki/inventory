import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requirePrivilegedUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authError = requirePrivilegedUser();
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get('limit')) || 30, 100);

    const batches = await db.query(
      `SELECT * FROM asset_rent_batches ORDER BY id DESC LIMIT ?`,
      [limit]
    );

    if (!batches || batches.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // Collect all asset IDs
    const allAssetIds = new Set<number>();
    const parsedBatches = batches.map((b: any) => {
      let ids: number[] = [];
      try {
        if (typeof b.asset_ids === 'string') {
          ids = JSON.parse(b.asset_ids);
        } else if (Array.isArray(b.asset_ids)) {
          ids = b.asset_ids;
        }
      } catch (e) {
        ids = String(b.asset_ids || '')
          .replace(/[\[\]]/g, '')
          .split(',')
          .map((n) => Number(n.trim()))
          .filter((n) => !isNaN(n) && n > 0);
      }
      ids.forEach((id) => allAssetIds.add(id));
      return { ...b, parsed_ids: ids };
    });

    // Fetch asset details in one bulk query
    const assetsMap = new Map<number, any>();
    if (allAssetIds.size > 0) {
      const idsArray = Array.from(allAssetIds);
      const placeholders = idsArray.map(() => '?').join(',');
      const assets = await db.query(
        `SELECT a.id, a.asset_name, a.serial_number, a.asset_status, a.assigned_to,
                c.name as category_name, l.name as location_name
         FROM assets a
         LEFT JOIN categories c ON a.category_id = c.id
         LEFT JOIN locations l ON a.location_id = l.id
         WHERE a.id IN (${placeholders})`,
        idsArray
      );

      (assets || []).forEach((asset: any) => {
        assetsMap.set(asset.id, asset);
      });
    }

    // Enrich batches with asset objects and unique categories
    const enrichedBatches = parsedBatches.map((b: any) => {
      const batchAssets = (b.parsed_ids || [])
        .map((id: number) => assetsMap.get(id))
        .filter(Boolean);

      const categorySet = new Set<string>();
      batchAssets.forEach((a: any) => {
        if (a.category_name) {
          categorySet.add(a.category_name);
        }
      });

      return {
        ...b,
        assets: batchAssets,
        categories: Array.from(categorySet),
      };
    });

    return NextResponse.json({ success: true, data: enrichedBatches });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Update batch details (assigned_to, expected_return_date, notes)
export async function PATCH(request: Request) {
  const authError = requirePrivilegedUser();
  if (authError) return authError;

  try {
    const body = await request.json();
    const id = Number(body.id);
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID batch diperlukan' }, { status: 400 });
    }

    const assigned_to = (body.assigned_to || '').trim();
    const expected_return_date = (body.expected_return_date || '').trim();
    const notes = (body.notes || '').trim();

    // Fetch existing batch
    const batch = await db.queryOne(`SELECT * FROM asset_rent_batches WHERE id = ?`, [id]);
    if (!batch) {
      return NextResponse.json({ success: false, error: 'Batch tidak ditemukan' }, { status: 404 });
    }

    await db.execute(
      `UPDATE asset_rent_batches
       SET assigned_to = ?, expected_return_date = ?, notes = ?
       WHERE id = ?`,
      [assigned_to, expected_return_date, notes, id]
    );

    // If batch was ALLOCATE and assigned_to was updated, update assets.assigned_to as well
    if (batch.action_type === 'ALLOCATE' && assigned_to) {
      let ids: number[] = [];
      try {
        ids = typeof batch.asset_ids === 'string' ? JSON.parse(batch.asset_ids) : batch.asset_ids;
      } catch (e) {
        ids = String(batch.asset_ids || '')
          .replace(/[\[\]]/g, '')
          .split(',')
          .map((n) => Number(n.trim()))
          .filter((n) => !isNaN(n) && n > 0);
      }

      if (Array.isArray(ids) && ids.length > 0) {
        const placeholders = ids.map(() => '?').join(',');
        await db.execute(
          `UPDATE assets SET assigned_to = ? WHERE id IN (${placeholders})`,
          [assigned_to, ...ids]
        );
      }
    }

    return NextResponse.json({ success: true, message: 'Batch berhasil diperbarui' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Delete batch & revert asset statuses if needed
export async function DELETE(request: Request) {
  const authError = requirePrivilegedUser();
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const idParam = searchParams.get('id');
    let id = Number(idParam);

    if (!id) {
      try {
        const body = await request.json();
        id = Number(body.id);
      } catch (e) {}
    }

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID batch diperlukan' }, { status: 400 });
    }

    const batch = await db.queryOne(`SELECT * FROM asset_rent_batches WHERE id = ?`, [id]);
    if (!batch) {
      return NextResponse.json({ success: false, error: 'Batch tidak ditemukan' }, { status: 404 });
    }

    let ids: number[] = [];
    try {
      ids = typeof batch.asset_ids === 'string' ? JSON.parse(batch.asset_ids) : batch.asset_ids;
    } catch (e) {
      ids = String(batch.asset_ids || '')
        .replace(/[\[\]]/g, '')
        .split(',')
        .map((n) => Number(n.trim()))
        .filter((n) => !isNaN(n) && n > 0);
    }

    // Revert asset status if ALLOCATE
    if (batch.action_type === 'ALLOCATE' && Array.isArray(ids) && ids.length > 0) {
      const placeholders = ids.map(() => '?').join(',');
      await db.execute(
        `UPDATE assets
         SET asset_status = 1, assigned_to = '', updated_at = CURRENT_TIMESTAMP
         WHERE id IN (${placeholders})`,
        ids
      );
    }

    // Delete batch
    await db.execute(`DELETE FROM asset_rent_batches WHERE id = ?`, [id]);

    return NextResponse.json({ success: true, message: 'Batch berhasil dihapus' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
