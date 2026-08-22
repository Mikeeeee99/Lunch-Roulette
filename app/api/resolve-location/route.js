import { env } from "cloudflare:workers";
import { handleResolveLocationRequest } from "../../../lib/amap-server.js";

export function POST(request) {
  return handleResolveLocationRequest(request, env);
}
