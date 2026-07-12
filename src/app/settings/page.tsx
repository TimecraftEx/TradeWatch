"use client";

import { useState } from "react";

export default function SettingsPage() {
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);

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

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold mb-6">Settings</h1>

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
      <div className="rounded-lg p-5 mb-4" style={{ background: "#111" }}>
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

      {/* Alert Thresholds */}
      <div className="rounded-lg p-5" style={{ background: "#111" }}>
        <div className="text-xs uppercase tracking-widest mb-3" style={{ color: "#666" }}>Alert Thresholds</div>
        {["5-Day Rolling Low", "7-Day Rolling Low", "5% Drop from Trade Price"].map((t) => (
          <div key={t} className="flex items-center justify-between py-3" style={{ borderBottom: "1px solid #1a1a1a" }}>
            <span className="text-sm">{t}</span>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded" style={{ color: "#00c805", border: "1px solid #00c805" }}>
              On
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
