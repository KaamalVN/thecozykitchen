import { get } from "@vercel/blob";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return new Response("Missing image URL", { status: 400 });
  }

  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      return new Response("Blob storage token not configured on server", { status: 500 });
    }

    // Resolve private blob access securely from serverless backend and get direct readable stream
    const blob = await get(url, {
      access: "private",
      token,
    });

    if (!blob || !blob.stream) {
      return new Response("Failed to retrieve image stream from storage bucket", { status: 404 });
    }

    return new Response(blob.stream, {
      headers: {
        "Content-Type": blob.headers.get("Content-Type") || "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error: any) {
    console.error("[Image Proxy Exception]:", error.message);
    return new Response(`Image Proxy failed: ${error.message}`, { status: 500 });
  }
}
