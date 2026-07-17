import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(`${origin}/settings?gmail=error`);
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${origin}/api/gmail/callback`
  );

  try {
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      return NextResponse.redirect(`${origin}/settings?gmail=error`);
    }

    await supabase.from("gmail_tokens").upsert({
      id: "default",
      refresh_token: tokens.refresh_token,
      updated_at: new Date().toISOString(),
    });

    return NextResponse.redirect(`${origin}/settings?gmail=connected`);
  } catch {
    return NextResponse.redirect(`${origin}/settings?gmail=error`);
  }
}
