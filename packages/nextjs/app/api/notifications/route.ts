import { NextResponse } from "next/server";
import { NeynarAPIClient } from "@neynar/nodejs-sdk";

// Initialize Neynar client (server-side only)
const neynarClient = new NeynarAPIClient({
  apiKey: process.env.NEYNAR_API_KEY || "",
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { targetFids, notification } = body;

    if (!targetFids || !targetFids.length || !notification) {
      return NextResponse.json({ error: "Missing targetFids or notification" }, { status: 400 });
    }

    console.log(`Sending notification to FIDs: ${targetFids.join(", ")}`);
    console.log(`Notification content: ${JSON.stringify(notification)}`);

    const result = await neynarClient.publishFrameNotifications({
      targetFids,
      notification,
    });

    console.log("Neynar notification response:", JSON.stringify(result));

    return NextResponse.json({ success: true, result }, { status: 200 });
  } catch (error) {
    console.error("Error sending notification:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
