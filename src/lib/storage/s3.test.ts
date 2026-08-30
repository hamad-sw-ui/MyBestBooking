import { afterEach, describe, expect, it, vi } from "vitest";
import { S3Uploader } from "./s3";

describe("S3Uploader private keys", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("supprime une clé uploads générée et bloque traversal", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const uploader = new S3Uploader("s3.example.test", "auto", "bucket", "access", "secret");
    await expect(uploader.remove("uploads/abcdefgh-file.png")).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/bucket/uploads/abcdefgh-file.png"), expect.objectContaining({ method: "DELETE" }));
    await expect(uploader.remove("../secret")).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("ne demande pas ACL public-read lors d'un upload privé", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const uploader = new S3Uploader("s3.example.test", "auto", "bucket", "access", "secret");
    const stored = await uploader.put(Buffer.from([1]), "image/png", "abcdefgh-user");
    expect(stored.url).toBeNull();
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers).not.toHaveProperty("x-amz-acl");
  });
});
