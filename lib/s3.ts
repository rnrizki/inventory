import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';

// S3 API Endpoint used by AWS SDK for API operations
export const S3_ENDPOINT = process.env.S3_ENDPOINT || 'https://s3api2.skyconnection.id';
// S3 Public Web / CDN Prefix used for public browser viewing and serving images
export const S3_PUBLIC_URL_PREFIX = process.env.S3_PUBLIC_URL_PREFIX || 'https://s3web2.skyconnection.id';
export const S3_BUCKET = process.env.S3_BUCKET || 'inventory';
export const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || 'ZS3JuinventoryYcQA';
export const S3_SECRET_KEY = process.env.S3_SECRET_KEY || 'e3A0DnGcB8YvchpW17H9vGcjHEW88TNtWTCxH0Ta';
export const S3_REGION = process.env.S3_REGION || 'us-east-1';

const s3Client = new S3Client({
  endpoint: S3_ENDPOINT,
  region: S3_REGION,
  credentials: {
    accessKeyId: S3_ACCESS_KEY,
    secretAccessKey: S3_SECRET_KEY,
  },
  forcePathStyle: true,
});

/**
 * Uploads an image buffer directly to the S3 bucket and returns the public HTTP URL.
 * URL format: https://s3api2.skyconnection.id/inventory/{key}
 */
export async function uploadBufferToS3(
  buffer: Buffer,
  folder: 'assets' | 'history' = 'assets',
  filenamePrefix = 'photo',
  contentType = 'image/webp'
): Promise<{ url: string; key: string }> {
  const ext = contentType.includes('webp')
    ? 'webp'
    : contentType.includes('png')
    ? 'png'
    : contentType.includes('gif')
    ? 'gif'
    : 'jpg';

  const randomSuffix = crypto.randomBytes(6).toString('hex');
  const key = `${folder}/${filenamePrefix}-${Date.now()}-${randomSuffix}.${ext}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );

  const cleanPrefix = S3_PUBLIC_URL_PREFIX.replace(/\/+$/, '');
  const publicUrl = `${cleanPrefix}/${S3_BUCKET}/${key}`;

  return { url: publicUrl, key };
}

export default s3Client;
