import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requirePrivilegedUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const authError = requirePrivilegedUser();
  if (authError) return authError;

  try {
    const id = Number(params.id);
    const contentType = request.headers.get('content-type') || '';
    let imageUrl = '';

    if (contentType.includes('application/json')) {
      const body = await request.json();
      imageUrl = (body.asset_image || body.imageUrl || body.image || '').trim();
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const urlField = formData.get('imageUrl') as string | null;

      if (urlField) {
        imageUrl = urlField.trim();
      } else if (file) {
        const allowedTypes = [
          'image/jpeg',
          'image/jpg',
          'image/png',
          'image/webp',
          'image/gif',
          'image/svg+xml',
          'image/avif',
          'image/bmp',
        ];
        if (!allowedTypes.includes(file.type.toLowerCase())) {
          return NextResponse.json(
            {
              success: false,
              error: `Unsupported image format: ${file.type}. Allowed: PNG, JPG, JPEG, WEBP, GIF, SVG, AVIF, BMP.`,
            },
            { status: 400 }
          );
        }

        const buffer = await file.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const mime = file.type || 'image/jpeg';
        imageUrl = `data:${mime};base64,${base64}`;
      }
    }

    if (!imageUrl) {
      return NextResponse.json(
        { success: false, error: 'Please provide an image file or direct image URL' },
        { status: 400 }
      );
    }

    const updated = await db.queryOne(
      `
      UPDATE assets
      SET asset_image = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      RETURNING *;
    `,
      [imageUrl, id]
    );

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Asset not found' }, { status: 404 });
    }

    await db.execute(
      `INSERT INTO asset_events (asset_id, event_type, notes) VALUES (?, 'Photo Updated', 'Asset photo updated')`,
      [id]
    );
    await db.execute(
      `INSERT INTO asset_history (asset_id, action, note) VALUES (?, 'Updated', 'Asset photo changed')`,
      [id]
    );

    return NextResponse.json({
      success: true,
      message: 'Asset photo updated successfully',
      data: updated,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const authError = requirePrivilegedUser();
  if (authError) return authError;

  try {
    const id = Number(params.id);
    const updated = await db.queryOne(
      `
      UPDATE assets
      SET asset_image = '', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      RETURNING *;
    `,
      [id]
    );

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Asset not found' }, { status: 404 });
    }

    await db.execute(
      `INSERT INTO asset_events (asset_id, event_type, notes) VALUES (?, 'Photo Removed', 'Asset photo removed')`,
      [id]
    );
    await db.execute(
      `INSERT INTO asset_history (asset_id, action, note) VALUES (?, 'Updated', 'Asset photo deleted')`,
      [id]
    );

    return NextResponse.json({
      success: true,
      message: 'Asset photo removed successfully',
      data: updated,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
