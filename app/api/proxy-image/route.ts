import { NextResponse } from 'next/server';
import sharp from 'sharp';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('url');
    const format = searchParams.get('format') || 'jpeg';

    if (!imageUrl) {
      return NextResponse.json({ success: false, error: 'URL is required' }, { status: 400 });
    }

    // Fetch image from S3 or external URL
    const res = await fetch(imageUrl);
    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: `Failed to fetch image from source: ${res.statusText}` },
        { status: 502 }
      );
    }

    const arrayBuffer = await res.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    // Convert to clean standard JPEG using sharp
    const jpegBuffer = await sharp(inputBuffer)
      .jpeg({ quality: 90 })
      .toBuffer();

    if (format === 'base64') {
      const base64Str = `data:image/jpeg;base64,${jpegBuffer.toString('base64')}`;
      return NextResponse.json({ success: true, dataUrl: base64Str });
    }

    // Raw binary JPEG response
    return new NextResponse(jpegBuffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: any) {
    console.error('Image proxy error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
