import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Log submission — replace with Resend/email integration via env var
    console.log("[contact submission]", JSON.stringify(body, null, 2));

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid submission" }, { status: 400 });
  }
}
