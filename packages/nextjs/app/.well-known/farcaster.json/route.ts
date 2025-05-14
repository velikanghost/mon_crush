import { NextResponse } from "next/server";
import { APP_URL } from "../../../lib/constants";

export async function GET() {
  const farcasterConfig = {
    accountAssociation: {
      header:
        "eyJmaWQiOjUxODMzOCwidHlwZSI6ImN1c3RvZHkiLCJrZXkiOiIweDI0QjcyODlhZTRkN0FEZTY3QjdmMzgzNDFFYjc4Yzc3NjAyODIxOTUifQ",
      payload: "eyJkb21haW4iOiJtb24tY3J1c2gtbmV4dGpzLWZpdmUudmVyY2VsLmFwcCJ9",
      signature:
        "MHgxNDA4MjUxODMzMzQxYTY4ZWNmZmUzMTA2ZWQ3MGQ2ZDVlNmI2N2Y1YWMwYjcxNDU4NGY5YzU5MGNiY2Y4NjNjNDg2Zjg0Njk5NjJmY2MzYjVkNTQxYTM3NjEwZTlkM2MwYzg2ZGE5MzAzYjJjZGZjNWZhYjkyYTM5Yzk0YTRjNjFj",
    },
    frame: {
      version: "1",
      name: "Monad Match",
      iconUrl: `${APP_URL}/images/icon.png`,
      homeUrl: `${APP_URL}`,
      imageUrl: `${APP_URL}/images/feed.png`,
      screenshotUrls: [],
      tags: ["monad", "farcaster", "miniapp"],
      primaryCategory: "developer-tools",
      buttonTitle: "Launch App",
      splashImageUrl: `${APP_URL}/images/splash.png`,
      splashBackgroundColor: "#ffffff",
      webhookUrl: `https://api.neynar.com/f/app/d93d24f9-48cb-44df-b674-f19492313255/event`,
    },
  };

  return NextResponse.json(farcasterConfig);
}
