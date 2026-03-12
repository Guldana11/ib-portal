import * as Minio from 'minio';

const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000', 10),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || '',
  secretKey: process.env.MINIO_SECRET_KEY || '',
});

const BUCKET = process.env.MINIO_BUCKET || 'documents';

export async function ensureBucket(): Promise<void> {
  const exists = await minioClient.bucketExists(BUCKET);
  if (!exists) {
    await minioClient.makeBucket(BUCKET);
  }
}

export async function uploadFile(fileKey: string, buffer: Buffer, size: number, mimeType: string): Promise<void> {
  await minioClient.putObject(BUCKET, fileKey, buffer, size, { 'Content-Type': mimeType });
}

export async function getPresignedUrl(fileKey: string): Promise<string> {
  return minioClient.presignedGetObject(BUCKET, fileKey, 900); // 15 min TTL
}

export async function deleteFile(fileKey: string): Promise<void> {
  await minioClient.removeObject(BUCKET, fileKey);
}

export { minioClient, BUCKET };
