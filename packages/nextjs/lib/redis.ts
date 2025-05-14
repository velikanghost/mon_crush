import { Redis } from "@upstash/redis";
import { env } from "process";

if (!env.MON_REDIS_URL || !env.MON_KV_REST_API_TOKEN) {
  console.warn(
    "REDIS_URL or REDIS_TOKEN environment variable is not defined, please add to enable background notifications and webhooks.",
  );
}

export const redis =
  env.MON_REDIS_URL && env.MON_KV_REST_API_TOKEN
    ? new Redis({
        url: env.MON_REDIS_URL,
        token: env.MON_KV_REST_API_TOKEN,
      })
    : null;
