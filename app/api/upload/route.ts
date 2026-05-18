import { handleUpload } from "@vercel/blob/client";
import { NextResponse } from "next/server";

const getPassphrase = () => {
  return process.env.ADMIN_PASSPHRASE || "cozykitchen";
};

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json();

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        console.log(`[Vercel Blob Upload] Starting token generation for: ${pathname}`);
        
        let payload: any = {};
        try {
          if (clientPayload) {
            payload = JSON.parse(clientPayload);
          }
        } catch (e) {
          console.error("[Vercel Blob Upload] Failed to parse clientPayload:", clientPayload);
          throw new Error("Invalid authorization token payload structure.");
        }

        const correct = getPassphrase();
        const clientPass = payload.passphrase || "";
        
        console.log(`[Vercel Blob Upload] Checking authentication.`);
        console.log(`[Vercel Blob Upload] Client provided passphrase length: ${clientPass.length}`);
        
        if (clientPass !== correct) {
          console.error("[Vercel Blob Upload] Authorization failed: Passphrase mismatch.");
          throw new Error("Unauthorized access. Admin passphrase incorrect.");
        }

        console.log("[Vercel Blob Upload] Authorization successful. Generating client token...");

        return {
          allowedContentTypes: ["image/*"], // Accepts any image type to prevent mime mismatches
          tokenPayload: JSON.stringify({ role: "admin" }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log("[Vercel Blob Upload] Direct Upload Completed Successfully:", blob.url);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error: any) {
    console.error("[Vercel Blob Upload] Server endpoint error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
