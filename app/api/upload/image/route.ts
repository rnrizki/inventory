import { NextResponse } from 'next/server';
import { requirePrivilegedUser } from '@/lib/auth';
import { processAndUploadImageToS3 } from '@/lib/optimizer';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const authError = requirePrivilegedUser();
  if (authError) return authError;

  try {
    const contentType = request.headers.get('content-type') || '';
    let imageSource: Buffer | string = '';
    let folder: 'assets' | 'history' = 'assets';

    if (contentType.includes('application/json')) {
      const body = await request.json();
      imageSource = (body.image || body.asset_image || body.imageUrl || '').trim();
      if (body.folder === 'history') folder = 'history';
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const urlField = formData.get('imageUrl') as string | null;
      const folderField = formData.get('folder') as string | null;
      if (folderField === 'history') folder = 'history';

      if (urlField) {
        imageSource = urlField.trim();
      } else if (file) {
        const buffer = await file.arrayBuffer();
        imageSource = Buffer.from(buffer);
      }
    }

    if (!imageSource || (typeof imageSource === 'string' && !imageSource.trim())) {
      return NextResponse.json(
        { success: false, error: 'Please provide an image file or direct image URL' },
        { status: 400 }
      );
    }

    // Convert & optimize to max 400px wide (preserving ratio) via Rust Axum engine and save to S3
    const result = await processAndUploadImageToS3(imageSource, folder, 'upload');

    return NextResponse.json({
      success: true,
      url: result.url,
      key: result.key,
      engine: result.engine,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
