"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { PriceAlert } from "@/lib/types";

const ALERT_LABELS: Record<string, string> = {
  "5_day_low": "5D LOW",
  "7_day_low": "7D LOW",
  pct_drop: "5% DROP",
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("price_alerts")
        .select("*")
        .order("triggered_at", { ascending: false })
        .limit(100);
      setAlerts((data as PriceAlert[]) || []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-96" style={{ color: "#666" }}>Loading...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold mb-2">Price Alerts</h1>
      <p className="text-sm mb-6" style={{ color: "#666" }}>
        Alerts trigger when a held or sold stock hits its 5-7 day low or drops 5%.
      </p>

      <div style={{ borderTop: "1px solid #1a1a1a" }}>
        {alerts.length === 0 ? (
          <p className="py-12 text-center text-sm" style={{ color: "#666" }}>
            No alerts triggered yet. Once price monitoring is active, alerts appear here.
          </p>
        ) : (
          alerts.map((a) => (
            <div key={a.id} className="flex items-center justify-between py-3" style={{ borderBottom: "1px solid #111" }}>
              <div className="flex items-center gap-3">
                <span
                  className="text-[9px] font-bold uppercase px-2 py-0.5 rounded"
                  style={{ color: "#f59e0b", border: "1px solid #f59e0b" }}
                >
                  {ALERT_LABELS[a.alert_type] || a.alert_type}
                </span>
                <div>
                  <div className="font-semibold text-sm">{a.ticker}</div>
                  <div className="text-xs" style={{ color: "#666" }}>
                    {new Date(a.triggered_at).toLocaleDateString("en-US", {
                      month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium" style={{ color: "#ff5000" }}>
                  ${Number(a.current_price).toFixed(2)}
                </div>
                <div className="text-xs" style={{ color: "#666" }}>
                  Trade: ${Number(a.trade_price).toFixed(2)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
