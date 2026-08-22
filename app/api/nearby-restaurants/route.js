import { env } from "cloudflare:workers";
import { handleNearbyRestaurantsRequest } from "../../../lib/amap-server.js";

export function POST(request) {
  return handleNearbyRestaurantsRequest(request, env);
}
