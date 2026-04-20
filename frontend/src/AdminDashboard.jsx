import { useState, useEffect, useCallback } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
const TOKEN_KEY = "admin_token";

// ── helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) => Number(n ?? 0).toLocaleString();
const fmtMoney = (n) => `₱${Number(n ?? 0).toFixed(2)}`;
const fmtDate = (s) => s ? new Date(s).toLocaleDateString("en-PH", { year:"numeric", month:"short", day:"numeric" }) : "—";
const METHOD_COLOR = { GCash:"#007dfe", Maya:"#00b341", PayPal:"#003087" };

async function apiFetch(path, token, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { "x-admin-token": token, "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

// ── components ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent, pulse }) {
  return (
    <div style={{
      background: "#0f0f14",
      border: `1px solid ${accent}33`,
      borderRadius: 14,
      padding: "1.4rem 1.6rem",
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, ${accent}, ${accent}66)`,
      }} />
      {pulse && (
        <span style={{
          position: "absolute", top: 14, right: 14,
          width: 8, height: 8, borderRadius: "50%",
          background: "#22c55e",
          boxShadow: "0 0 0 3px #22c55e33",
          animation: "pulse 1.5s ease-in-out infinite",
          display: "inline-block",
        }} />
      )}
      <p style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: accent, marginBottom: "0.4rem" }}>{label}</p>
      <p style={{ fontSize: "2rem", fontWeight: 800, color: "#f0eeff", lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: "0.72rem", color: "#5a5870", marginTop: "0.3rem" }}>{sub}</p>}
    </div>
  );
}

function MonthBar({ month, value, max, label }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
      <span style={{ width: 56, fontSize: "0.7rem", color: "#5a5870", flexShrink: 0 }}>{month}</span>
      <div style={{ flex: 1, height: 8, background: "#1a1925", borderRadius: 4, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`,
          background: "linear-gradient(90deg, #6e56ff, #c084fc)",
          borderRadius: 4, transition: "width 0.6s ease",
        }} />
      </div>
      <span style={{ width: 36, fontSize: "0.7rem", color: "#a590ff", textAlign: "right" }}>{fmt(value)}</span>
      <span style={{ width: 64, fontSize: "0.68rem", color: "#3a3850" }}>{label}</span>
    </div>
  );
}

// ── login screen ──────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [token, setToken] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const tryLogin = async () => {
    setLoading(true); setErr("");
    try {
      await apiFetch("/admin/stats/today", token);
      localStorage.setItem(TOKEN_KEY, token);
      onLogin(token);
    } catch {
      setErr("Wrong token. Check ADMIN_TOKEN env var.");
    } finally { setLoading(false); }
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#07070d",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,600;9..40,700;9..40,800&display=swap');`}</style>
      <div style={{
        background: "#0f0f14", border: "1px solid rgba(110,86,255,0.2)",
        borderRadius: 20, padding: "2.5rem 2rem", width: "100%", maxWidth: 380, textAlign: "center",
      }}>
        <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🛡</div>
        <h1 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#f0eeff", marginBottom: "0.25rem" }}>Admin Access</h1>
        <p style={{ fontSize: "0.8rem", color: "#5a5870", marginBottom: "1.5rem" }}>Image-to-Document Dashboard</p>
        <input
          type="password"
          placeholder="Enter admin token"
          value={token}
          onChange={e => setToken(e.target.value)}
          onKeyDown={e => e.key === "Enter" && tryLogin()}
          style={{
            width: "100%", padding: "0.75rem 1rem", borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)",
            color: "#e8e6f0", fontSize: "0.9rem", outline: "none",
            marginBottom: "0.75rem", boxSizing: "border-box", fontFamily: "inherit",
          }}
        />
        {err && <p style={{ color: "#f87171", fontSize: "0.78rem", marginBottom: "0.75rem" }}>{err}</p>}
        <button
          onClick={tryLogin}
          disabled={loading || !token}
          style={{
            width: "100%", padding: "0.8rem", borderRadius: 10, border: "none",
            background: token ? "linear-gradient(135deg,#6e56ff,#c084fc)" : "rgba(255,255,255,0.05)",
            color: token ? "white" : "#3a3850", fontWeight: 700, fontSize: "0.9rem",
            cursor: token ? "pointer" : "not-allowed", fontFamily: "inherit",
          }}
        >{loading ? "Checking…" : "Enter Dashboard"}</button>
      </div>
    </div>
  );
}

// ── main dashboard ────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [authed, setAuthed] = useState(false);
  const [today, setToday] = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [activeNow, setActiveNow] = useState(0);
  const [donations, setDonations] = useState({ total: 0, donations: [] });
  const [tab, setTab] = useState("overview"); // overview | donations
  const [donForm, setDonForm] = useState({ donor_name: "", amount: "", method: "GCash", note: "" });
  const [donErr, setDonErr] = useState("");
  const [donLoading, setDonLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);

  const load = useCallback(async (t) => {
    setLoading(true);
    try {
      const [tod, mon, act, don] = await Promise.all([
        apiFetch("/admin/stats/today", t),
        apiFetch("/admin/stats/monthly", t),
        apiFetch("/admin/stats/active-now", t),
        apiFetch("/admin/donations", t),
      ]);
      setToday(tod);
      setMonthly(mon);
      setActiveNow(act.active_now ?? 0);
      setDonations(don);
      setLastRefresh(new Date());
    } catch (e) {
      if (e.message === "401") { localStorage.removeItem(TOKEN_KEY); setAuthed(false); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (authed) {
      load(token);
      const iv = setInterval(() => load(token), 30000); // refresh every 30s
      return () => clearInterval(iv);
    }
  }, [authed, token, load]);

  // auto-login if token stored
  useEffect(() => {
    if (token) {
      apiFetch("/admin/stats/today", token)
        .then(() => setAuthed(true))
        .catch(() => {});
    }
  }, []);

  if (!authed) return <LoginScreen onLogin={(t) => { setToken(t); setAuthed(true); }} />;

  const maxUploads = Math.max(...monthly.map(m => m.uploads || 0), 1);

  const addDonation = async () => {
    setDonErr("");
    if (!donForm.donor_name.trim() || !donForm.amount) { setDonErr("Name and amount required."); return; }
    setDonLoading(true);
    try {
      await apiFetch("/admin/donations", token, {
        method: "POST",
        body: JSON.stringify({ ...donForm, amount: parseFloat(donForm.amount) }),
      });
      setDonForm({ donor_name: "", amount: "", method: "GCash", note: "" });
      await load(token);
    } catch { setDonErr("Failed to save."); }
    finally { setDonLoading(false); }
  };

  const deleteDonation = async (id) => {
    if (!confirm("Delete this donation record?")) return;
    await apiFetch(`/admin/donations/${id}`, token, { method: "DELETE" });
    await load(token);
  };

  const s = { fontFamily: "'DM Sans', sans-serif", background: "#07070d", minHeight: "100vh", color: "#e8e6f0" };

  return (
    <div style={s}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,600;9..40,700;9..40,800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #07070d; }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .fade-in { animation: fadeIn 0.35s ease; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #0f0f14; }
        ::-webkit-scrollbar-thumb { background: #2a2838; border-radius: 4px; }
        input, select, button { font-family: inherit; }
      `}</style>

      {/* Header */}
      <div style={{
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "1rem 2rem",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "#0a0a0f",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: "1.1rem" }}>🛡</span>
          <div>
            <p style={{ fontWeight: 800, fontSize: "0.95rem", color: "#f0eeff", lineHeight: 1.1 }}>Admin Dashboard</p>
            <p style={{ fontSize: "0.65rem", color: "#3a3850" }}>Image-to-Document · SNSU</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          {lastRefresh && <span style={{ fontSize: "0.65rem", color: "#3a3850" }}>Last refresh {lastRefresh.toLocaleTimeString()}</span>}
          <button onClick={() => load(token)} disabled={loading} style={{
            padding: "5px 12px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.03)", color: "#7c7a94", fontSize: "0.75rem", cursor: "pointer",
          }}>{loading ? "…" : "↻ Refresh"}</button>
          <button onClick={() => { localStorage.removeItem(TOKEN_KEY); setAuthed(false); }} style={{
            padding: "5px 12px", borderRadius: 7, border: "1px solid rgba(239,68,68,0.2)",
            background: "rgba(239,68,68,0.06)", color: "#f87171", fontSize: "0.75rem", cursor: "pointer",
          }}>Sign out</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "0 2rem", background: "#0a0a0f" }}>
        {["overview", "donations"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "0.75rem 1rem", border: "none", background: "none",
            color: tab === t ? "#a590ff" : "#5a5870",
            fontWeight: tab === t ? 700 : 600, fontSize: "0.82rem",
            borderBottom: tab === t ? "2px solid #6e56ff" : "2px solid transparent",
            cursor: "pointer", textTransform: "capitalize", marginRight: "0.25rem",
            transition: "color 0.15s",
          }}>{t}</button>
        ))}
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1.75rem 2rem" }} className="fade-in">

        {tab === "overview" && (
          <>
            {/* Top stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "1.75rem" }}>
              <StatCard label="Active Right Now" value={activeNow} sub="last 15 minutes" accent="#22c55e" pulse />
              <StatCard label="Users Today" value={fmt(today?.active_users)} sub="unique IPs" accent="#6e56ff" />
              <StatCard label="Uploads Today" value={fmt(today?.uploads)} sub="image sets" accent="#c084fc" />
              <StatCard label="PDFs Today" value={fmt(today?.pdfs)} sub="documents" accent="#f59e0b" />
              <StatCard label="Word Docs Today" value={fmt(today?.docxs)} sub="documents" accent="#60a5fa" />
              <StatCard label="Total Donations" value={fmtMoney(donations.total)} sub={`${donations.donations.length} donor(s)`} accent="#f87171" />
            </div>

            {/* Monthly chart */}
            <div style={{
              background: "#0f0f14", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 16, padding: "1.5rem", marginBottom: "1.5rem",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
                <div>
                  <p style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#5a5870", marginBottom: 3 }}>Monthly Overview</p>
                  <p style={{ fontSize: "1rem", fontWeight: 800, color: "#f0eeff" }}>Uploads per Month</p>
                </div>
                <span style={{ fontSize: "0.7rem", color: "#3a3850" }}>Last 6 months</span>
              </div>
              {monthly.length === 0
                ? <p style={{ color: "#3a3850", fontSize: "0.82rem", textAlign: "center", padding: "2rem" }}>No data yet.</p>
                : monthly.map(m => (
                  <MonthBar
                    key={m.month}
                    month={m.month}
                    value={m.uploads}
                    max={maxUploads}
                    label={`${fmt(m.unique_users)} users`}
                  />
                ))
              }
            </div>

            {/* Monthly table */}
            <div style={{ background: "#0f0f14", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden" }}>
              <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <p style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#5a5870", marginBottom: 3 }}>Breakdown</p>
                <p style={{ fontSize: "1rem", fontWeight: 800, color: "#f0eeff" }}>Stats by Month</p>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                      {["Month", "Unique Users", "Uploads", "PDFs", "Word Docs", "Total Docs"].map(h => (
                        <th key={h} style={{ padding: "0.7rem 1.5rem", textAlign: "left", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#5a5870", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {monthly.length === 0 ? (
                      <tr><td colSpan={6} style={{ textAlign: "center", padding: "2rem", color: "#3a3850", fontSize: "0.82rem" }}>No data yet.</td></tr>
                    ) : monthly.map((m, i) => (
                      <tr key={m.month} style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                        <td style={{ padding: "0.75rem 1.5rem", fontWeight: 700, color: "#d8d4f0", fontSize: "0.85rem" }}>{m.month}</td>
                        <td style={{ padding: "0.75rem 1.5rem", color: "#6e56ff", fontWeight: 700 }}>{fmt(m.unique_users)}</td>
                        <td style={{ padding: "0.75rem 1.5rem", color: "#c084fc", fontWeight: 700 }}>{fmt(m.uploads)}</td>
                        <td style={{ padding: "0.75rem 1.5rem", color: "#f59e0b" }}>{fmt(m.pdfs)}</td>
                        <td style={{ padding: "0.75rem 1.5rem", color: "#60a5fa" }}>{fmt(m.docxs)}</td>
                        <td style={{ padding: "0.75rem 1.5rem", color: "#22c55e", fontWeight: 700 }}>{fmt((m.pdfs || 0) + (m.docxs || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {tab === "donations" && (
          <>
            {/* Summary */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "1.75rem" }}>
              <StatCard label="Total Received" value={fmtMoney(donations.total)} sub="all time" accent="#f87171" />
              <StatCard label="Total Donors" value={fmt(donations.donations.length)} sub="logged entries" accent="#f59e0b" />
            </div>

            {/* Add donation form */}
            <div style={{ background: "#0f0f14", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "1.5rem", marginBottom: "1.5rem" }}>
              <p style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#5a5870", marginBottom: "0.3rem" }}>Log New Donation</p>
              <p style={{ fontSize: "0.85rem", color: "#7c7a94", marginBottom: "1.1rem" }}>Manually record GCash / Maya / PayPal donations.</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.75rem", marginBottom: "0.75rem" }}>
                {[
                  { key: "donor_name", placeholder: "Donor name", type: "text" },
                  { key: "amount", placeholder: "Amount (₱)", type: "number" },
                  { key: "note", placeholder: "Note (optional)", type: "text" },
                ].map(f => (
                  <input key={f.key} type={f.type} placeholder={f.placeholder}
                    value={donForm[f.key]}
                    onChange={e => setDonForm(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{
                      padding: "0.6rem 0.85rem", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.04)", color: "#e8e6f0", fontSize: "0.85rem", outline: "none",
                    }}
                  />
                ))}
                <select value={donForm.method} onChange={e => setDonForm(p => ({ ...p, method: e.target.value }))}
                  style={{
                    padding: "0.6rem 0.85rem", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.04)", color: "#e8e6f0", fontSize: "0.85rem", outline: "none",
                  }}>
                  {["GCash", "Maya", "PayPal", "Other"].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              {donErr && <p style={{ color: "#f87171", fontSize: "0.78rem", marginBottom: "0.5rem" }}>{donErr}</p>}
              <button onClick={addDonation} disabled={donLoading} style={{
                padding: "0.65rem 1.4rem", borderRadius: 8, border: "none",
                background: "linear-gradient(135deg,#6e56ff,#c084fc)", color: "white",
                fontWeight: 700, fontSize: "0.85rem", cursor: "pointer",
              }}>{donLoading ? "Saving…" : "+ Log Donation"}</button>
            </div>

            {/* Donations table */}
            <div style={{ background: "#0f0f14", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden" }}>
              <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <p style={{ fontWeight: 800, fontSize: "1rem", color: "#f0eeff" }}>Donation Log</p>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                      {["Donor", "Amount", "Method", "Note", "Date", ""].map(h => (
                        <th key={h} style={{ padding: "0.7rem 1.5rem", textAlign: "left", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#5a5870", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {donations.donations.length === 0 ? (
                      <tr><td colSpan={6} style={{ textAlign: "center", padding: "2rem", color: "#3a3850", fontSize: "0.82rem" }}>No donations logged yet.</td></tr>
                    ) : donations.donations.map((d, i) => (
                      <tr key={d.id} style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                        <td style={{ padding: "0.75rem 1.5rem", fontWeight: 700, color: "#d8d4f0" }}>{d.donor_name}</td>
                        <td style={{ padding: "0.75rem 1.5rem", fontWeight: 800, color: "#22c55e" }}>{fmtMoney(d.amount)}</td>
                        <td style={{ padding: "0.75rem 1.5rem" }}>
                          <span style={{
                            padding: "3px 10px", borderRadius: 6, fontSize: "0.72rem", fontWeight: 700,
                            background: `${METHOD_COLOR[d.method] || "#5a5870"}22`,
                            color: METHOD_COLOR[d.method] || "#7c7a94",
                            border: `1px solid ${METHOD_COLOR[d.method] || "#5a5870"}44`,
                          }}>{d.method}</span>
                        </td>
                        <td style={{ padding: "0.75rem 1.5rem", color: "#5a5870", fontSize: "0.82rem" }}>{d.note || "—"}</td>
                        <td style={{ padding: "0.75rem 1.5rem", color: "#5a5870", fontSize: "0.8rem" }}>{fmtDate(d.ts)}</td>
                        <td style={{ padding: "0.75rem 1.5rem" }}>
                          <button onClick={() => deleteDonation(d.id)} style={{
                            padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(239,68,68,0.2)",
                            background: "rgba(239,68,68,0.06)", color: "#f87171", fontSize: "0.72rem", cursor: "pointer",
                          }}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}