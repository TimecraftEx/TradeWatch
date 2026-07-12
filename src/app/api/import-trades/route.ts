import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseRobinhoodEmail } from "@/lib/parse-robinhood-email";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    // Accept an array of raw email snippets for bulk import
    const body = await request.json().catch(() => null);

    if (!body?.emails || !Array.isArray(body.emails)) {
      return NextResponse.json(
        { error: "Expected { emails: [{ snippet, date, messageId }] }" },
        { status: 400 }
      );
    }

    let imported = 0;
    let skipped = 0;

    for (const email of body.emails) {
      const { snippet, date, messageId } = email;
      if (!snippet || !date) {
        skipped++;
        continue;
      }

      const parsed = parseRobinhoodEmail(snippet, date);
      if (!parsed) {
        skipped++;
        continue;
      }

      const { error } = await supabase.from("trades").upsert(
        {
          ticker: parsed.ticker,
          action: parsed.action,
          shares: parsed.shares,
          price_per_share: parsed.pricePerShare,
          total_amount: parsed.totalAmount,
          executed_at: parsed.executedAt.toISOString(),
          gmail_message_id: messageId || null,
        },
        { onConflict: "gmail_message_id" }
      );

      if (error) {
        console.error("Insert error:", error);
        skipped++;
      } else {
        imported++;
      }
    }

    return NextResponse.json({ imported, skipped });
  } catch (err) {
    console.error("Import error:", err);
    return NextResponse.json(
      { error: "Import failed" },
      { status: 500 }
    );
  }
}
