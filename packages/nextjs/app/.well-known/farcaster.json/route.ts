import { NextResponse } from "next/server";
import { APP_URL } from "../../../lib/constants";

export async function GET() {
  const farcasterConfig = {
    accountAssociation: {
      header:
        "eyJmaWQiOjUxODMzOCwidHlwZSI6ImN1c3RvZHkiLCJrZXkiOiIweDI0QjcyODlhZTRkN0FEZTY3QjdmMzgzNDFFYjc4Yzc3NjAyODIxOTUifQ",
      payload: "eyJkb21haW4iOiJtb24tY3J1c2gtbmV4dGpzLnZlcmNlbC5hcHAifQ",
      signature:
        "MHhiZTU3YTdhY2U5YjI2ODkyYmE0MjBkMzU4NzgzMDQ0Njc5MzIwNTNjMTU2MDkzNTcxNTVhNTA3YTlkOTg5YjIwMTJhY2U1NDFjYTg0Njg0Y2EyODYwZDNhMjUxMTcyOTFkNDc4NDJmYzU5YjVkYmFiNTkwOWJhNWQ3MmZiYWIzNjFj",
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
      webhookUrl: `${APP_URL}/api/webhook`,
    },
  };

  return NextResponse.json(farcasterConfig);
}
