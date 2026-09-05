import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@const/backend/_generated/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Const-SSO-Token",
};

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function GET(req: NextRequest) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "";
  const authHeader = req.headers.get("authorization")?.trim();
  const bearerValue = authHeader?.startsWith("Bearer ") ? authHeader.substring(7).trim() : null;

  const defaultModels = [
    {
      id: "gemini-3.6-flash",
      object: "model",
      created: 1700000000,
      owned_by: "const",
    },
    {
      id: "combo/auto",
      object: "model",
      created: 1700000000,
      owned_by: "const",
    },
    {
      id: "combo/fast",
      object: "model",
      created: 1700000000,
      owned_by: "const",
    },
    {
      id: "combo/coding",
      object: "model",
      created: 1700000000,
      owned_by: "const",
    },
  ];

  const modelsList = [...defaultModels];

  // If user provided a key or token, also fetch their connected BYOK models
  if (convexUrl && bearerValue) {
    try {
      const client = new ConvexHttpClient(convexUrl);
      const isJwt = bearerValue.startsWith("eyJ") && bearerValue.includes(".");
      if (isJwt) {
        client.setAuth(bearerValue);
      }
      const userProviders = await client.query(api.router.providers.listUserProviders, {});
      if (userProviders) {
        for (const prov of userProviders) {
          if (prov.status !== "active") continue;
          for (const m of prov.importedModels) {
            if (m.enabled) {
              modelsList.push({
                id: m.modelId,
                object: "model",
                created: 1700000000,
                owned_by: prov.name,
              });
            }
          }
        }
      }
    } catch {
      // Fall back to default models if query fails
    }
  }

  return NextResponse.json(
    {
      object: "list",
      data: modelsList,
    },
    {
      headers: CORS_HEADERS,
    }
  );
}
