import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { parseRobinhoodEmail } from "@/lib/parse-robinhood-email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function extractTextBody(payload: Record<string, unknown>): string {
  // Direct body
  const body = payload.body as Record<string, unknown> | undefined;
  if (body?.data) {
    const mimeType = payload.mimeType as string;
    if (mimeType === "text/plain") {
      return Buffer.from(body.data as string, "base64").toString();
    }
  }

  // Multipart — recurse into parts
  const parts = payload.parts as Record<string, unknown>[] | undefined;
  if (parts) {
    // Prefer text/plain
    for (const part of parts) {
      if (part.mimeType === "text/plain") {
        const partBody = part.body as Record<string, unknown> | undefined;
        if (partBody?.data) {
          return Buffer.from(partBody.data as string, "base64").toString();
        }
      }
    }
    // Recurse into nested multipart
    for (const part of parts) {
      const nested = extractTextBody(part);
      if (nested) return nested;
    }
  }

  return "";
}

export async function POST() {
  // 1. Get refresh token
  const { data: tokenData } = await supabase
    .from("gmail_tokens")
    .select("refresh_token")
    .eq("id", "default")
    .single();

  if (!tokenData?.refresh_token) {
    return NextResponse.json(
      { error: "Gmail not connected. Click 'Connect Gmail' first." },
      { status: 401 }
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ refresh_token: tokenData.refresh_token });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  // 2. Get existing gmail_message_ids to skip
  const { data: existing } = await supabase
    .from("trades")
    .select("gmail_message_id")
    .not("gmail_message_id", "is", null);
  const existingIds = new Set(
    (existing || []).map((e: Record<string, unknown>) => e.gmail_message_id)
  );

  // 3. Search for Robinhood trade emails
  let allMessages: { id: string }[] = [];
  let pageToken: string | undefined;

  do {
    const res = await gmail.users.messages.list({
      userId: "me",
      q: 'from:noreply@robinhood.com subject:"Your order has been executed"',
      maxResults: 100,
      pageToken,
    });
    const msgs = (res.data.messages || []).filter(
      (m): m is { id: string } => !!m.id
    );
    allMessages = allMessages.concat(msgs);
    pageToken = res.data.nextPageToken || undefined;
  } while (pageToken);

  // 4. Filter out already-imported messages
  const newMessages = allMessages.filter((m) => !existingIds.has(m.id));

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  // 5. Process in batches of 10
  for (let i = 0; i < newMessages.length; i += 10) {
    const batch = newMessages.slice(i, i + 10);

    const results = await Promise.all(
      batch.map(async (msg) => {
        try {
          const full = await gmail.users.messages.get({
            userId: "me",
            id: msg.id,
            format: "full",
          });

          const headers = full.data.payload?.headers || [];
          const dateHeader =
            headers.find(
              (h: { name?: string | null }) =>
                h.name?.toLowerCase() === "date"
            )?.value || "";

          // Extract plain text body
          const body = extractTextBody(
            full.data.payload as unknown as Record<string, unknown>
          );
          const snippet = full.data.snippet || "";

          // Normalize: collapse whitespace for regex matching across lines
          const text = (body || snippet).replace(/\s+/g, " ").trim();

          if (!text) return { status: "skip" as const, id: msg.id };

          const parsed = parseRobinhoodEmail(text, dateHeader);
          if (!parsed) return { status: "skip" as const, id: msg.id };

          const { error } = await supabase.from("trades").upsert(
            {
              ticker: parsed.ticker,
              action: parsed.action,
              shares: parsed.shares,
              price_per_share: parsed.pricePerShare,
              total_amount: parsed.totalAmount,
              executed_at: parsed.executedAt.toISOString(),
              gmail_message_id: msg.id,
            },
            { onConflict: "gmail_message_id" }
          );

          if (error) return { status: "error" as const, id: msg.id, error: error.message };
          return { status: "imported" as const, id: msg.id };
        } catch (err) {
          return { status: "error" as const, id: msg.id, error: String(err) };
        }
      })
    );

    for (const r of results) {
      if (r.status === "imported") imported++;
      else if (r.status === "error") {
        skipped++;
        errors.push(`${r.id}: ${r.error}`);
      } else skipped++;
    }
  }

  return NextResponse.json({
    imported,
    skipped,
    already_existed: allMessages.length - newMessages.length,
    total_found: allMessages.length,
    errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
  });
}
