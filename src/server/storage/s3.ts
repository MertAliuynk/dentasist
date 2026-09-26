import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// S3-compatible object storage (MinIO in this deployment — see
// docker-compose.yml's `storage` service). Patient X-ray files live here,
// never in the app's own filesystem/DB: the bucket is private, every read
// and write goes through a short-lived presigned URL generated below, so
// only someone who already has an authorized tRPC session can ever get a
// URL that works, and each URL stops working shortly after.

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} ortam değişkeni tanımlı değil (S3/MinIO depolama için gerekli).`);
  return value;
}

const clients = new Map<string, S3Client>();

/**
 * `public: true` → a client for *presigning*: the signature covers the host,
 * and the browser is the one calling that URL, so it must be the publicly
 * reachable address (S3_PUBLIC_ENDPOINT, e.g. https://s3.example.com) — the
 * internal docker hostname (http://storage:9000) is unreachable from a
 * browser. Server-side calls (delete) keep using the internal S3_ENDPOINT.
 */
function getClient(opts: { public?: boolean } = {}): S3Client {
  const endpoint = (opts.public && process.env.S3_PUBLIC_ENDPOINT) || requiredEnv("S3_ENDPOINT");
  const existing = clients.get(endpoint);
  if (existing) return existing;
  const client = new S3Client({
    endpoint,
    region: process.env.S3_REGION || "us-east-1",
    credentials: {
      accessKeyId: requiredEnv("S3_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnv("S3_SECRET_ACCESS_KEY"),
    },
    // MinIO is virtual-host-style-incompatible by default — path style
    // ("endpoint/bucket/key") is the standard way to point the AWS SDK at it.
    forcePathStyle: true,
  });
  clients.set(endpoint, client);
  return client;
}

function getBucket(): string {
  return requiredEnv("S3_BUCKET");
}

const UPLOAD_URL_TTL_SECONDS = 5 * 60;
const VIEW_URL_TTL_SECONDS = 10 * 60;

export async function createUploadUrl(objectKey: string, contentType: string): Promise<string> {
  const client = getClient({ public: true });
  const command = new PutObjectCommand({ Bucket: getBucket(), Key: objectKey, ContentType: contentType });
  return getSignedUrl(client, command, { expiresIn: UPLOAD_URL_TTL_SECONDS });
}

export async function createViewUrl(objectKey: string, downloadFileName?: string): Promise<string> {
  const client = getClient({ public: true });
  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: objectKey,
    ...(downloadFileName ? { ResponseContentDisposition: `inline; filename="${downloadFileName}"` } : {}),
  });
  return getSignedUrl(client, command, { expiresIn: VIEW_URL_TTL_SECONDS });
}

export async function deleteObject(objectKey: string): Promise<void> {
  const client = getClient();
  await client.send(new DeleteObjectCommand({ Bucket: getBucket(), Key: objectKey }));
}
