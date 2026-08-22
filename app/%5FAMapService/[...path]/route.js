import { env } from "cloudflare:workers";
import { handleAmapSecurityProxy } from "../../../lib/amap-server.js";

export function GET(request) {
  return handleAmapSecurityProxy(request, env);
}
