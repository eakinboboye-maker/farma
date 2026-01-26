import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../AuthProvider";
import { useNavigate } from "react-router-dom";
import { useFarmId } from "../useFarmId";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const farmId = useFarmId();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [submittedCount, setSubmittedCount] = useState(0);
  const [overdueJobs, setOverdueJobs] = useState([]);
  const [dueSoonJobs, setDueSoonJobs] = useState([]);
  const [approvedAcres7d, setApprovedAcres7d] = useState(0);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const plus7 = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  }, []);
  const minus7 = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  }, []);

  useEffect(() => {
    const selected = localStorage.getItem("selectedFarmId");
    if (!selected) navigate("/farms", { replace: true });
  }, [navigate]);

  useEffect(() => {
    async function loadKPIs() {
      if (!farmId) return;
      setLoading(true);
      setError("");

      // 1) submitted logs count
      const subRes = await supabase
        .from("job_logs")
        .select("id", { count: "exact", head: true })
        .eq("farm_id", farmId)
        .eq("status", "submitted");

      // 2) overdue jobs (due_date < today and not done)
      const overdueRes = await supabase
        .from("jobs")
        .select("id, job_type, crop, due_date, percent_complete, teams(name), plots(name)")
        .eq("farm_id", farmId)
        .neq("status", "done")
        .lt("due_date", today)
        .order("due_date", { ascending: true })
        .limit(8);

      // 3) due soon (today -> next 7 days and not done)
      const soonRes = await supabase
        .from("jobs")
        .select("id, job_type, crop, due_date, percent_complete, teams(name), plots(name)")
        .eq("farm_id", farmId)
        .neq("status", "done")
        .gte("due_date", today)
        .lte("due_date", plus7)
        .order("due_date", { ascending: true })
        .limit(8);

      // 4) total approved acres in last 7 days
      const acresRes = await supabase
        .from("job_logs")
        .select("acres_done")
        .eq("farm_id", farmId)
        .eq("status", "approved")
        .gte("log_date", minus7)
        .lte("log_date", today);

      if (subRes.error) setError(subRes.error.message);
      if (overdueRes.error) setError(overdueRes.error.message);
      if (soonRes.error) setError(soonRes.error.message);
      if (acresRes.error) setError(acresRes.error.message);

      setSubmittedCount(subRes.count ?? 0);

      setOverdueJobs(
        (overdueRes.data ?? []).map((j) => ({
          id: j.id,
          label: `${j.job_type}${j.crop ? ` • ${j.crop}` : ""}`,
          due_date: j.due_date,
          pct: Number(j.percent_complete || 0).toFixed(0),
          team: j.teams?.name ?? "—",
          plot: j.plots?.name ?? "—",
        }))
      );

      setDueSoonJobs(
        (soonRes.data ?? []).map((j) => ({
          id: j.id,
          label: `${j.job_type}${j.crop ? ` • ${j.crop}` : ""}`,
          due_date: j.due_date,
          pct: Number(j.percent_complete || 0).toFixed(0),
          team: j.teams?.name ?? "—",
          plot: j.plots?.name ?? "—",
        }))
      );

      const total = (acresRes.data ?? []).reduce((s, r) => s + Number(r.acres_done || 0), 0);
      setApprovedAcres7d(total);

      setLoading(false);
    }

    loadKPIs();
  }, [farmId, minus7, plus7, today]);

  async function logout() {
    await supabase.auth.signOut();
  }

  return (
    <div style={{ padding: 16 }}>
      <h2>Dashboard</h2>
      <div style={{ fontSize: 13, opacity: 0.85 }}>
        Logged in as <b>{user?.email}</b>
      </div>

      <button onClick={logout} style={{ padding: "10px 12px", borderRadius: 10, marginTop: 10 }}>
        Logout
      </button>

      {!farmId && (
        <div style={{ marginTop: 12, padding: 12, background: "#fff3cd", borderRadius: 10 }}>
          No farm selected. Go to “Change Farm”.
        </div>
      )}

      {error && <div style={{ marginTop: 12, color: "crimson" }}>{error}</div>}
      {loading ? <p style={{ marginTop: 12 }}>Loading KPIs...</p> : null}

      <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
        <div style={{ padding: 12, borderRadius: 12, border: "1px solid #eee" }}>
          <div style={{ fontWeight: 800 }}>Approvals waiting</div>
          <div style={{ fontSize: 28, fontWeight: 900, marginTop: 6 }}>{submittedCount}</div>
          <div style={{ fontSize: 13, opacity: 0.85 }}>
            Go to Approvals to approve submitted logs before payroll.
          </div>
        </div>

        <div style={{ padding: 12, borderRadius: 12, border: "1px solid #eee" }}>
          <div style={{ fontWeight: 800 }}>Approved acres (last 7 days)</div>
          <div style={{ fontSize: 28, fontWeight: 900, marginTop: 6 }}>{approvedAcres7d.toFixed(2)} ac</div>
          <div style={{ fontSize: 13, opacity: 0.85 }}>
            Based on approved logs from {minus7} to {today}.
          </div>
        </div>

        <div style={{ padding: 12, borderRadius: 12, border: "1px solid #eee" }}>
          <div style={{ fontWeight: 800 }}>Overdue jobs</div>
          {overdueJobs.length === 0 ? (
            <div style={{ marginTop: 8, opacity: 0.85 }}>None 🎉</div>
          ) : (
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              {overdueJobs.map((j) => (
                <div key={j.id} style={{ padding: 10, borderRadius: 10, background: "#fafafa" }}>
                  <div style={{ fontWeight: 800 }}>{j.label}</div>
                  <div style={{ fontSize: 13, opacity: 0.85 }}>
                    Due: {j.due_date} • {j.pct}% • Team: {j.team} • Plot: {j.plot}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: 12, borderRadius: 12, border: "1px solid #eee" }}>
          <div style={{ fontWeight: 800 }}>Due in next 7 days</div>
          {dueSoonJobs.length === 0 ? (
            <div style={{ marginTop: 8, opacity: 0.85 }}>None</div>
          ) : (
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              {dueSoonJobs.map((j) => (
                <div key={j.id} style={{ padding: 10, borderRadius: 10, background: "#fafafa" }}>
                  <div style={{ fontWeight: 800 }}>{j.label}</div>
                  <div style={{ fontSize: 13, opacity: 0.85 }}>
                    Due: {j.due_date} • {j.pct}% • Team: {j.team} • Plot: {j.plot}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

