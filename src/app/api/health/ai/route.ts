import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

// Smoke test: confirms the app's Claude API credentials and model access.
export async function GET() {
  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 64,
      messages: [
        {
          role: "user",
          content: "Reply with exactly: Andiamo AI online",
        },
      ],
    });
    const text = response.content.find((b) => b.type === "text")?.text ?? "";
    return NextResponse.json({
      ok: true,
      model: response.model,
      reply: text,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
