export const MESSAGE_EXPIRATION_TIME = 1000 * 60 * 60 * 24 * 30; // 30 day
export const APP_URL = process.env.NEXT_PUBLIC_URL!;
if (!APP_URL) {
  throw new Error("NEXT_PUBLIC_URL is not set");
}
