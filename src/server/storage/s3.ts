import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadBucketCommand, CreateBucketCommand, PutBucketCorsCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// S3-compatible object storage (RustFS in docker-compose.yml; MinIO works too — see
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

/**
 * Creates the bucket on first use if it doesn't exist yet, so a fresh
 * deployment needs no separate init container (MinIO's mc image, used
 * for that before, is no longer published). Runs once per process; a
 * failure is retried on the next call.
 */
/** The app's own origin(s); presigned URLs are only useful to its pages. */
function corsOrigins(): string[] {
  const origins = [process.env.NEXT_PUBLIC_SITE_URL, process.env.NEXTAUTH_URL, process.env.AUTH_URL]
    .filter((v): v is string => !!v)
    .map((u) => {
      try {
        return new URL(u).origin;
      } catch {
        return null;
      }
    })
    .filter((v): v is string => !!v);
  return origins.length ? [...new Set(origins)] : ["*"];
}

let bucketReady: Promise<void> | null = null;
function ensureBucket(): Promise<void> {
  if (!bucketReady) {
    const client = getClient();
    const Bucket = getBucket();
    bucketReady = client
      .send(new HeadBucketCommand({ Bucket }))
      .then(() => undefined)
      .catch(async (e: { $metadata?: { httpStatusCode?: number }; name?: string }) => {
        const status = e?.$metadata?.httpStatusCode;
        if (status !== 404 && e?.name !== "NotFound" && e?.name !== "NoSuchBucket") throw e;
        await client.send(new CreateBucketCommand({ Bucket })).catch((err: { name?: string }) => {
          // Another request may have created it meanwhile.
          if (err?.name !== "BucketAlreadyOwnedByYou" && err?.name !== "BucketAlreadyExists") throw err;
        });
      })
      // Browsers PUT/GET presigned URLs cross-origin (app domain → storage
      // domain), which needs CORS on the bucket. MinIO allowed it by
      // default; RustFS/S3 don't. Re-applied every start so it's always set.
      .then(() =>
        client
          .send(
          new PutBucketCorsCommand({
            Bucket,
            CORSConfiguration: {
              CORSRules: [
                {
                  AllowedOrigins: corsOrigins(),
                  AllowedMethods: ["GET", "PUT", "HEAD"],
                  AllowedHeaders: ["*"],
                  ExposeHeaders: ["ETag"],
                  MaxAgeSeconds: 3600,
                },
              ],
            },
          }),
          )
          // MinIO (used in local dev) doesn't implement bucket CORS and
          // allows all origins anyway — never block uploads over it.
          .catch((e: { name?: string; message?: string }) =>
            console.warn("[s3] bucket CORS ayarlanamadı:", e?.name ?? e?.message),
          ),
      )
      .then(() => undefined)
      .catch((e) => {
        bucketReady = null;
        throw e;
      });
  }
  return bucketReady;
}

const UPLOAD_URL_TTL_SECONDS = 5 * 60;
const VIEW_URL_TTL_SECONDS = 10 * 60;

export async function createUploadUrl(objectKey: string, contentType: string): Promise<string> {
  await ensureBucket();
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
