import sharp from 'sharp';
import { uploadBufferToS3 } from './s3';

const RUST_OPTIMIZER_URL = process.env.RUST_OPTIMIZER_URL || 'http://127.0.0.1:3001';

/**
 * Optimizes an image to max 400px wide, preserving original aspect ratio.
 * First tries the native Rust + Axum optimizer service (SIMD accelerated).
 * Falls back to sharp if the Rust service is starting or unreachable.
 */
export async function optimizeImageWithRust(inputBuffer: Buffer): Promise<{
  buffer: Buffer;
  contentType: string;
  engine: string;
}> {
  // 1. Try Rust Axum image optimizer
  try {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(inputBuffer)], { type: 'image/jpeg' });
    formData.append('file', blob, 'input-image.bin');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`${RUST_OPTIMIZER_URL}/optimize`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const arrayBuf = await res.arrayBuffer();
      const outputBuffer = Buffer.from(arrayBuf);
      if (outputBuffer.length > 0) {
        return {
          buffer: outputBuffer,
          contentType: 'image/webp',
          engine: 'Rust-Axum-Image-Engine',
        };
      }
    }
  } catch (err: any) {
    // Rust service not reachable (e.g. running outside Docker during local dev)
    console.warn(`[ImageOptimizer] Rust Axum service unavailable at ${RUST_OPTIMIZER_URL}, using fallback: ${err.message}`);
  }

  // 2. High-performance fallback: max 400px wide, keep original ratio
  try {
    const meta = await sharp(inputBuffer).metadata();
    const targetWidth = meta.width && meta.width > 400 ? 400 : undefined;

    let pipeline = sharp(inputBuffer);
    if (targetWidth) {
      pipeline = pipeline.resize({
        width: targetWidth,
        withoutEnlargement: true,
        fit: 'inside', // keeps original ratio
      });
    }

    const outputBuffer = await pipeline.webp({ quality: 85 }).toBuffer();
    return {
      buffer: outputBuffer,
      contentType: 'image/webp',
      engine: 'Sharp-WebP-Engine',
    };
  } catch (sharpErr: any) {
    console.error('[ImageOptimizer] Sharp optimization error, returning raw buffer:', sharpErr);
    return {
      buffer: inputBuffer,
      contentType: 'image/jpeg',
      engine: 'Raw-Buffer',
    };
  }
}

/**
 * Fetches an image from URL or buffer on the server side (avoiding browser CORS),
 * rotates it by specified degrees (e.g. 90, 180, 270), optimizes to max 400px wide, and uploads to S3.
 */
export async function rotateAndUploadImageToS3(
  sourceUrl: string,
  degrees: number,
  folder: 'assets' | 'history' = 'history',
  filenamePrefix = 'photo-rot'
): Promise<{ url: string; key: string }> {
  // Ensure we fetch from public web host or handle legacy URL
  const fetchUrl = sourceUrl.replace(/s3api2\.skyconnection\.id/g, 's3web2.skyconnection.id');
  const resp = await fetch(fetchUrl);
  if (!resp.ok) {
    throw new Error(`Failed to fetch image from ${fetchUrl}: ${resp.status} ${resp.statusText}`);
  }
  const arrayBuf = await resp.arrayBuffer();
  const inputBuffer = Buffer.from(arrayBuf);

  const normalizedDegrees = ((degrees % 360) + 360) % 360;

  let pipeline = sharp(inputBuffer);
  if (normalizedDegrees !== 0) {
    pipeline = pipeline.rotate(normalizedDegrees);
  }

  const meta = await pipeline.metadata();
  if (meta.width && meta.width > 400) {
    pipeline = pipeline.resize({ width: 400, fit: 'inside', withoutEnlargement: true });
  }

  const rotatedBuffer = await pipeline.webp({ quality: 88 }).toBuffer();
  const s3Result = await uploadBufferToS3(rotatedBuffer, folder, filenamePrefix, 'image/webp');

  return {
    url: s3Result.url,
    key: s3Result.key,
  };
}

/**
 * Converts a base64 Data URL or raw Buffer to an optimized WebP buffer (max 400px wide)
 * and uploads it directly to the S3 bucket: https://s3api2.skyconnection.id/inventory/...
 */
export async function processAndUploadImageToS3(
  source: string | Buffer,
  folder: 'assets' | 'history' = 'assets',
  filenamePrefix = 'photo'
): Promise<{ url: string; key: string; engine: string }> {
  let buffer: Buffer;

  if (typeof source === 'string') {
    if (source.startsWith('data:')) {
      const matches = source.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches[2]) {
        buffer = Buffer.from(matches[2], 'base64');
      } else {
        const base64Data = source.split(',')[1] || source;
        buffer = Buffer.from(base64Data, 'base64');
      }
    } else if (source.startsWith('http://') || source.startsWith('https://')) {
      // If already a valid public S3 web URL on our bucket, return it directly
      if (source.includes('s3web2.skyconnection.id/inventory')) {
        return { url: source, key: '', engine: 'Existing-S3' };
      }
      // If legacy s3api2 URL, upgrade to public web URL on s3web2
      if (source.includes('s3api2.skyconnection.id/inventory')) {
        return {
          url: source.replace('s3api2.skyconnection.id', 's3web2.skyconnection.id'),
          key: '',
          engine: 'Existing-S3',
        };
      }
      // Fetch remote URL and optimize
      const resp = await fetch(source);
      const arrayBuf = await resp.arrayBuffer();
      buffer = Buffer.from(arrayBuf);
    } else {
      buffer = Buffer.from(source, 'base64');
    }
  } else {
    buffer = source;
  }

  // Optimize with Rust Axum to max 400px wide (preserving ratio)
  const { buffer: optimizedBuffer, contentType, engine } = await optimizeImageWithRust(buffer);

  // Upload optimized image to S3 bucket
  const s3Result = await uploadBufferToS3(optimizedBuffer, folder, filenamePrefix, contentType);

  return {
    url: s3Result.url,
    key: s3Result.key,
    engine,
  };
}
