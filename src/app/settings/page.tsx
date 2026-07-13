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
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [settings, setSettings] = useState<AlertSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      const { data } = await supabase
        .from("alert_settings")
        .select("*")
        .limit(1)
        .single();
      if (data) setSettings(data as AlertSettings);
    }
    loadSettings();
  }, []);

  const handleImport = async () => {
    setImporting(true);
    setImportResult(null);
    try {
      const res = await fetch("/api/import-trades", { method: "POST" });
      const data = await res.json();
      setImportResult(data);
    } catch {
      setImportResult({ imported: 0, skipped: 0 });
    }
    setImporting(false);
  };

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

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold mb-6">Settings</h1>

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
            {/* Threshold percentage */}
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

            {/* Direction */}
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

            {/* Save */}
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

            {/* Summary */}
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

      {/* Gmail Import */}
      <div className="rounded-lg p-5 mb-4" style={{ background: "#111" }}>
        <div className="text-xs uppercase tracking-widest mb-3" style={{ color: "#666" }}>Gmail Trade Import</div>
        <p className="text-sm mb-4" style={{ color: "#666" }}>
          Import trade confirmations from{" "}
          <span className="font-mono text-xs" style={{ color: "#888" }}>noreply@robinhood.com</span>
        </p>
        <button
          onClick={handleImport}
          disabled={importing}
          className="px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          style={{ background: "#00c805", color: "#000" }}
        >
          {importing ? "Importing..." : "Import from Gmail"}
        </button>
        {importResult && (
          <div className="flex items-center gap-3 mt-4 p-3 rounded-lg" style={{ background: "#1a1a1a" }}>
            <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ color: "#00c805", border: "1px solid #00c805" }}>Done</span>
            <span className="text-sm" style={{ color: "#888" }}>
              {importResult.imported} imported, {importResult.skipped} skipped
            </span>
          </div>
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
