import { withRequestLogging } from "@/src/lib/security/request";
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/src/lib/auth";
export const runtime = "nodejs";
const handle = async (request: Request) => {
  if (!process.env.DATABASE_URL)
    return Response.json(
      { message: "Authentication requires PostgreSQL. Follow README setup." },
      { status: 503 },
    );
  const handlers = toNextJsHandler(auth());
  return request.method === "GET"
    ? handlers.GET(request)
    : handlers.POST(request);
};
export const GET = withRequestLogging(handle, "auth");
export const POST = withRequestLogging(handle, "auth");
