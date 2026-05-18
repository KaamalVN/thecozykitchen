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
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // Authenticate with the passphrase passed securely from the client state
        let payload: any = {};
        try {
          if (clientPayload) {
            payload = JSON.parse(clientPayload);
          }
        } catch (e) {
          throw new Error("Invalid authorization token payload structure.");
        }

        const correct = getPassphrase();
        if (payload.passphrase !== correct) {
          throw new Error("Unauthorized access. Admin passphrase incorrect.");
        }

        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
          tokenPayload: JSON.stringify({ role: "admin" }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log("Cozy Kitchen Direct Upload Completed:", blob.url);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
