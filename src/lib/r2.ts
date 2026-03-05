import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME!;
const PUBLIC_URL = process.env.R2_PUBLIC_URL!;

export async function uploadToR2(key: string, body: Buffer, contentType: string): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
  return `${PUBLIC_URL}/${key}`;
}

export async function deleteFromR2(key: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    }),
  );
}

/**
 * R2 URLからキーを抽出する。base64 data URLの場合はnullを返す（後方互換）。
 */
export function getR2KeyFromUrl(url: string): string | null {
  if (!url.startsWith(PUBLIC_URL)) return null;
  return url.slice(PUBLIC_URL.length + 1); // +1 for the "/"
}
