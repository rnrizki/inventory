import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requirePrivilegedUser } from '@/lib/auth';
import { processAndUploadImageToS3 } from '@/lib/optimizer';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const authError = requirePrivilegedUser();
  if (authError) return authError;

  try {
    const assetId = Number(params.id);
    const body = await request.json();
    const { historyId, image } = body;

    if (!historyId || !image) {
      return NextResponse.json(
        { success: false, error: 'historyId and image are required' },
        { status: 400 }
      );
    }

    // Verify history belongs to this asset
    const historyItem = await db.queryOne(
      'SELECT * FROM asset_history WHERE id = ? AND asset_id = ?',
      [historyId, assetId]
    );

    if (!historyItem) {
      return NextResponse.json(
        { success: false, error: 'History record not found for this asset' },
        { status: 404 }
      );
    }

    // Optimize and upload rotated image to S3 (max 400px wide WebP)
    const uploadRes = await processAndUploadImageToS3(
      image.trim(),
      'history',
      `allocate-${assetId}-rot`
    );
    const newImageUrl = uploadRes.url;

    // Update history record
    await db.execute('UPDATE asset_history SET image_url = ? WHERE id = ?', [
      newImageUrl,
      historyId,
    ]);

    return NextResponse.json({ success: true, url: newImageUrl });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
