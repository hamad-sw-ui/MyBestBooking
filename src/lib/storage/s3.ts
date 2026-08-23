import { createHash, createHmac, randomUUID } from "node:crypto";
import type { StoredFile, Uploader } from "./types";

/**
 * S3Uploader (T-014) : compatible S3 / R2 / DigitalOcean Spaces / MinIO.
 * Aucune SDK — signature v4 manuelle via crypto natif.
 * Activé quand toutes ces env vars sont définies :
 *   S3_ENDPOINT  (ex: s3.eu-west-3.amazonaws.com)
 *   S3_REGION    (défaut: auto)
 *   S3_BUCKET
 *   S3_ACCESS_KEY
 *   S3_SECRET_KEY
 *   S3_PUBLIC_BASE_URL (optionnel, sinon https://ENDPOINT/BUCKET)
 */

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function hex(b: Buffer | string): string {
  const buf = typeof b === "string" ? Buffer.from(b) : b;
  return buf.toString("hex");
}
function sha256(b: Buffer | string): Buffer {
  return createHash("sha256").update(b).digest();
}
function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

export class S3Uploader implements Uploader {
  constructor(
    private endpoint: string,
    private region: string,
    private bucket: string,
    private accessKey: string,
    private secretKey: string,
    private publicBase?: string,
  ) {}

  async put(file: Buffer, mimeType: string, ownerId: string): Promise<StoredFile> {
    const ext = MIME_EXT[mimeType] ?? "bin";
    const prefix = ownerId.slice(0, 8);
    const key = `uploads/${prefix}-${randomUUID()}.${ext}`;

    const host = this.endpoint;
    const url = `https://${host}/${this.bucket}/${key}`;
    const now = new Date();
    const amzDate =
      now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = hex(sha256(file));

    const headers: Record<string, string> = {
      host: `${host}`,
      "content-type": mimeType,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    };

    const signedHeaders = Object.keys(headers).sort().join(";");
    const canonicalHeaders =
      Object.entries(headers)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}:${v}\n`)
        .join("");
    const canonicalRequest =
      `PUT\n/${this.bucket}/${key}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

    const scope = `${dateStamp}/${this.region}/s3/aws4_request`;
    const stringToSign =
      `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${hex(sha256(canonicalRequest))}`;

    const kDate = hmac(`AWS4${this.secretKey}`, dateStamp);
    const kRegion = hmac(kDate, this.region);
    const kService = hmac(kRegion, "s3");
    const kSigning = hmac(kService, "aws4_request");
    const signature = hex(hmac(kSigning, stringToSign));

    const authHeader =
      `AWS4-HMAC-SHA256 Credential=${this.accessKey}/${scope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const res = await fetch(url, {
      method: "PUT",
      headers: { ...headers, Authorization: authHeader },
      // Buffer → Uint8Array pour compatibilité BodyInit stricte.
      body: new Uint8Array(file),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`S3 PUT failed: HTTP ${res.status} ${body.slice(0, 200)}`);
    }
    const publicUrl = this.publicBase
      ? `${this.publicBase.replace(/\/$/, "")}/${key}`
      : url;
    // publicBase est conservé pour les usages explicitement publics ; les
    // messages s'appuient sur key + handler participant, pas cette URL.
    return { url: this.publicBase ? publicUrl : null, key, size: file.byteLength, mimeType };
  }

  async remove(key: string): Promise<boolean> {
    // T-104 : les clés générées sont sous uploads/, préfixe explicitement
    // autorisé au lieu de rejeter le slash et rendre la suppression impossible.
    if (!/^uploads\/[A-Za-z0-9._-]+$/.test(key)) return false;
    const url = `https://${this.endpoint}/${this.bucket}/${key}`;
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const emptyHash = hex(sha256(""));
    const headers: Record<string, string> = {
      host: this.endpoint,
      "x-amz-content-sha256": emptyHash,
      "x-amz-date": amzDate,
    };
    const signedHeaders = Object.keys(headers).sort().join(";");
    const canonicalHeaders = Object.entries(headers)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}\n`)
      .join("");
    const canonicalRequest =
      `DELETE\n/${this.bucket}/${key}\n\n${canonicalHeaders}\n${signedHeaders}\n${emptyHash}`;
    const scope = `${dateStamp}/${this.region}/s3/aws4_request`;
    const stringToSign =
      `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${hex(sha256(canonicalRequest))}`;
    const kDate = hmac(`AWS4${this.secretKey}`, dateStamp);
    const kRegion = hmac(kDate, this.region);
    const kService = hmac(kRegion, "s3");
    const kSigning = hmac(kService, "aws4_request");
    const signature = hex(hmac(kSigning, stringToSign));
    const authHeader =
      `AWS4-HMAC-SHA256 Credential=${this.accessKey}/${scope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`;
    try {
      const res = await fetch(url, {
        method: "DELETE",
        headers: { ...headers, Authorization: authHeader },
      });
      // S3 renvoie 204 pour suppression, 404 si absent (ok pour nous).
      return res.status === 204 || res.status === 404;
    } catch {
      return false;
    }
  }

  async get(key: string): Promise<{ body: Buffer; mimeType: string | null } | null> {
    if (!/^uploads\/[A-Za-z0-9._-]+$/.test(key)) return null;
    const url = `https://${this.endpoint}/${this.bucket}/${key}`;
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const emptyHash = hex(sha256(""));
    const headers: Record<string, string> = {
      host: this.endpoint,
      "x-amz-content-sha256": emptyHash,
      "x-amz-date": amzDate,
    };
    const signedHeaders = Object.keys(headers).sort().join(";");
    const canonicalHeaders = Object.entries(headers)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}\n`)
      .join("");
    const canonicalRequest = `GET\n/${this.bucket}/${key}\n\n${canonicalHeaders}\n${signedHeaders}\n${emptyHash}`;
    const scope = `${dateStamp}/${this.region}/s3/aws4_request`;
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${hex(sha256(canonicalRequest))}`;
    const kDate = hmac(`AWS4${this.secretKey}`, dateStamp);
    const kRegion = hmac(kDate, this.region);
    const kService = hmac(kRegion, "s3");
    const kSigning = hmac(kService, "aws4_request");
    const signature = hex(hmac(kSigning, stringToSign));
    const authHeader = `AWS4-HMAC-SHA256 Credential=${this.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    try {
      const res = await fetch(url, { method: "GET", headers: { ...headers, Authorization: authHeader } });
      if (!res.ok) return null;
      return { body: Buffer.from(await res.arrayBuffer()), mimeType: res.headers.get("content-type") };
    } catch {
      return null;
    }
  }
}
