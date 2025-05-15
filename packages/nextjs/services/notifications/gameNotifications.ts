// Remove the import of neynarClient
// import neynarClient from "./neynarClient";

// Add a function to send notifications via our API route
async function sendNotification(
  targetFids: number[],
  notification: {
    title: string;
    body: string;
    target_url: string;
  },
) {
  try {
    console.log(`Sending notification to FIDs: ${targetFids.join(", ")}`);
    console.log(`Notification content:`, notification);

    const response = await fetch("/api/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        targetFids,
        notification,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Error sending notification:", errorData);
      return { success: false, error: errorData };
    }

    const responseData = await response.json();
    console.log("Notification send response:", responseData);
    return responseData;
  } catch (error) {
    console.error("Failed to send notification:", error);
    return { success: false, error };
  }
}

export async function notifyGameInvitation(targetFid: number, senderUsername: string, wagerAmount: string) {
  console.log(`Sending game invitation to FID ${targetFid} from ${senderUsername}`);
  return await sendNotification([targetFid], {
    title: "New Game Challenge!",
    body: `${senderUsername} has challenged you to a game with ${wagerAmount} MON at stake!`,
    target_url: `${process.env.NEXT_PUBLIC_URL}`,
  });
}

export async function notifyGameStarted(targetFid: number, opponentUsername: string) {
  return await sendNotification([targetFid], {
    title: "Game Started!",
    body: `Your match against ${opponentUsername} has begun. Time to crush it!`,
    target_url: `${process.env.NEXT_PUBLIC_URL}`,
  });
}

export async function notifyGameEnding(targetFid: number, timeRemaining: number) {
  return await sendNotification([targetFid], {
    title: "Game Ending Soon!",
    body: `Your match will end in ${timeRemaining} minutes. Hurry and make your best moves!`,
    target_url: `${process.env.NEXT_PUBLIC_URL}`,
  });
}

export async function notifyGameResult(targetFid: number, didWin: boolean, score: number, prize?: string) {
  const resultText = didWin ? "You won!" : "You lost.";
  const scoreText = `Your score: ${score}`;
  const prizeText = prize ? `Prize: ${prize} MON` : "";

  return await sendNotification([targetFid], {
    title: "Game Over!",
    body: `Match finished: ${resultText} ${scoreText} ${prizeText}`.trim(),
    target_url: `${process.env.NEXT_PUBLIC_URL}`,
  });
}
