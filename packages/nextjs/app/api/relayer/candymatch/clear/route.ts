import { NextResponse } from "next/server";
import { clearTxHashes } from "../route";

export async function POST() {
  try {
    // Clear the transaction hashes using the exported function
    clearTxHashes();

    return NextResponse.json({
      success: true,
      message: "Transaction hashes cleared",
    });
  } catch (error) {
    console.error("Error clearing transaction hashes:", error);
    return NextResponse.json(
      {
        error: "Failed to clear transaction hashes",
      },
      {
        status: 500,
      },
    );
  }
}
