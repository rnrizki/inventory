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
