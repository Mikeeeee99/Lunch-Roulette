import { env } from "cloudflare:workers";
import { handleAmapConfigRequest } from "../../../lib/amap-server.js";

export function GET() {
  return handleAmapConfigRequest(env);
}
