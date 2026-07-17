"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { AlertSettings } from "@/lib/types";

const THRESHOLD_OPTIONS = [1, 2, 3, 5, 7, 10];
const DIRECTION_OPTIONS = [
  { value: "below_buy", label: "Below Last Buy" },
  { value: "below_sell", label: "Below Last Sell" },
  { value: "both", label: "Both" },
] as const;

export default function SettingsPage() {
  const [settings, setSettings] = useState<AlertSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Gmail state
  const [gmailConnected, setGmailConnected] = useState<boolean | null>(null);
  const [scraping, setScraping] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<{
    imported: number;
    skipped: number;
    already_existed: number;
    total_found: number;
    error?: string;
  } | null>(null);

  useEffect(() => {
    async function load() {
      const [{ data: s }, { data: g }] = await Promise.all([
        supabase.from("alert_settings").select("*").limit(1).single(),
        supabase.from("gmail_tokens").select("id").eq("id", "default").single(),
      ]);
      if (s) setSettings(s as AlertSettings);
      setGmailConnected(!!g);
    }
    load();

    // Check URL params for OAuth callback result
    const params = new URLSearchParams(window.location.search);
    if (params.get("gmail") === "connected") {
      setGmailConnected(true);
      window.history.replaceState({}, "", "/settings");
    } else if (params.get("gmail") === "error") {
      setScrapeResult({ imported: 0, skipped: 0, already_existed: 0, total_found: 0, error: "Gmail connection failed. Check Google credentials." });
      window.history.replaceState({}, "", "/settings");
    }
  }, []);

  const handleSaveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    setSaved(false);
    await supabase
      .from("alert_settings")
      .update({
        threshold_pct: settings.threshold_pct,
        direction: settings.direction,
        enabled: settings.enabled,
        updated_at: new Date().toISOString(),
      })
      .eq("id", settings.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleScrape = async () => {
    setScraping(true);
    setScrapeResult(null);
    try {
      const res = await fetch("/api/gmail/scrape", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setScrapeResult({ imported: 0, skipped: 0, already_existed: 0, total_found: 0, error: data.error || "Scrape failed" });
      } else {
        setScrapeResult(data);
      }
    } catch {
      setScrapeResult({ imported: 0, skipped: 0, already_existed: 0, total_found: 0, error: "Network error" });
    }
    setScraping(false);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold mb-6">Settings</h1>

      {/* Gmail Scrape */}
      <div className="rounded-lg p-5 mb-4" style={{ background: "#111" }}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs uppercase tracking-widest" style={{ color: "#666" }}>Gmail Trade Import</div>
          {gmailConnected !== null && (
            <span
              className="text-[10px] font-bold uppercase px-2 py-0.5 rounded"
              style={{
                color: gmailConnected ? "#00c805" : "#666",
                border: `1px solid ${gmailConnected ? "#00c805" : "#333"}`,
              }}
            >
              {gmailConnected ? "Connected" : "Not Connected"}
            </span>
          )}
        </div>
        <p className="text-sm mb-4" style={{ color: "#666" }}>
          Scrape Robinhood trade confirmations from{" "}
          <span className="font-mono text-xs" style={{ color: "#888" }}>noreply@robinhood.com</span>
        </p>

        <div className="flex items-center gap-3">
          {!gmailConnected ? (
            <a
              href="/api/gmail/auth"
              className="inline-block px-4 py-2 text-sm font-medium rounded-lg transition-colors"
              style={{ background: "#1a1a1a", color: "#58a6ff", border: "1px solid #58a6ff50" }}
            >
              Connect Gmail
            </a>
          ) : (
            <>
              <button
                onClick={handleScrape}
                disabled={scraping}
                className="px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                style={{ background: "#00c805", color: "#000" }}
              >
                {scraping ? "Scraping..." : "Scrape Trades"}
              </button>
              <a
                href="/api/gmail/auth"
                className="text-xs underline"
                style={{ color: "#666" }}
              >
                Reconnect
              </a>
            </>
          )}
        </div>

        {scrapeResult && (
          <div className="mt-4 p-3 rounded-lg" style={{ background: "#1a1a1a" }}>
            {scrapeResult.error ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ color: "#ff5000", border: "1px solid #ff5000" }}>Error</span>
                <span className="text-sm" style={{ color: "#ff5000" }}>{scrapeResult.error}</span>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ color: "#00c805", border: "1px solid #00c805" }}>Done</span>
                  <span className="text-sm" style={{ color: "#888" }}>
                    {scrapeResult.imported} new trades imported
                  </span>
                </div>
                <div className="text-xs" style={{ color: "#555" }}>
                  {scrapeResult.total_found} emails found · {scrapeResult.already_existed} already imported · {scrapeResult.skipped} skipped
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Alert Thresholds */}
      <div className="rounded-lg p-5 mb-4" style={{ background: "#111" }}>
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs uppercase tracking-widest" style={{ color: "#666" }}>Price Alert Threshold</div>
          {settings && (
            <button
              onClick={() => setSettings({ ...settings, enabled: !settings.enabled })}
              className="text-[11px] font-bold uppercase px-2.5 py-1 rounded transition-colors"
              style={{
                color: settings.enabled ? "#00c805" : "#ff5000",
                border: `1px solid ${settings.enabled ? "#00c805" : "#ff5000"}`,
              }}
            >
              {settings.enabled ? "Enabled" : "Disabled"}
            </button>
          )}
        </div>

        {settings ? (
          <div className="space-y-5">
            <div>
              <div className="text-sm mb-2" style={{ color: "#888" }}>
                Alert when price drops this % from last trade:
              </div>
              <div className="flex gap-2">
                {THRESHOLD_OPTIONS.map((pct) => (
                  <button
                    key={pct}
                    onClick={() => setSettings({ ...settings, threshold_pct: pct })}
                    className="px-3 py-2 text-sm font-medium rounded-lg transition-colors"
                    style={{
                      background: settings.threshold_pct === pct ? "#00c805" : "#1a1a1a",
                      color: settings.threshold_pct === pct ? "#000" : "#888",
                      border: `1px solid ${settings.threshold_pct === pct ? "#00c805" : "#333"}`,
                    }}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-sm mb-2" style={{ color: "#888" }}>
                Compare against:
              </div>
              <div className="flex gap-2">
                {DIRECTION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSettings({ ...settings, direction: opt.value })}
                    className="px-3 py-2 text-sm font-medium rounded-lg transition-colors"
                    style={{
                      background: settings.direction === opt.value ? "#00c805" : "#1a1a1a",
                      color: settings.direction === opt.value ? "#000" : "#888",
                      border: `1px solid ${settings.direction === opt.value ? "#00c805" : "#333"}`,
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleSaveSettings}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                style={{ background: "#00c805", color: "#000" }}
              >
                {saving ? "Saving..." : "Save Settings"}
              </button>
              {saved && (
                <span className="text-sm" style={{ color: "#00c805" }}>Saved!</span>
              )}
            </div>

            <div className="p-3 rounded-lg text-sm" style={{ background: "#1a1a1a", color: "#888" }}>
              Alert me when a stock drops <strong style={{ color: "#fff" }}>{settings.threshold_pct}%</strong> below
              {settings.direction === "below_buy" && " my last buy price"}
              {settings.direction === "below_sell" && " my last sell price"}
              {settings.direction === "both" && " my last buy or sell price"}
            </div>
          </div>
        ) : (
          <div className="text-sm" style={{ color: "#666" }}>Loading settings...</div>
        )}
      </div>

      {/* Notifications */}
      <div className="rounded-lg p-5" style={{ background: "#111" }}>
        <div className="text-xs uppercase tracking-widest mb-3" style={{ color: "#666" }}>Notifications</div>
        {[
          { label: "Email Alerts", detail: "timecraftexchange@gmail.com", active: true },
          { label: "SMS Alerts", detail: "Via Twilio", active: false },
          { label: "Push Notifications", detail: "Browser & mobile", active: false },
        ].map((n) => (
          <div key={n.label} className="flex items-center justify-between py-3" style={{ borderBottom: "1px solid #1a1a1a" }}>
            <div>
              <div className="text-sm font-medium">{n.label}</div>
              <div className="text-xs" style={{ color: "#666" }}>{n.detail}</div>
            </div>
            <span
              className="text-[10px] font-bold uppercase px-2 py-0.5 rounded"
              style={{
                color: n.active ? "#00c805" : "#666",
                border: `1px solid ${n.active ? "#00c805" : "#333"}`,
              }}
            >
              {n.active ? "Active" : "Soon"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
