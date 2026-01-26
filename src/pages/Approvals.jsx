import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useFarmId } from "../useFarmId";

export default function Approvals() {
  const farmId = useFarmId();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  async function loadSubmitted() {
    if (!farmId) return;
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("job_logs")
      .select(`
        id,
        log_date,
        acres_done,
        notes,
        status,
        job_id,
        performed_by_worker_id,
        created_at,
        jobs (
          job_type,
          crop,
          teams(name),
          plots(name)
        ),
        workers:performed_by_worker_id ( full_name )
      `)
      .eq("farm_id", farmId)
      .eq("status", "submitted")
      .order("log_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
      setLogs([]);
      setLoading(false);
      return;
    }

    const list = (data ?? []).map((l) => ({
      id: l.id,
      log_date: l.log_date,
      acres_done: l.acres_done,
      notes: l.notes,
      job_id: l.job_id,
      worker_name: l.workers?.full_name ?? "—",
      job_type: l.jobs?.job_type ?? "—",
      crop: l.jobs?.crop ?? null,
      team_name: l.jobs?.teams?.name ?? "—",
      plot_name: l.jobs?.plots?.name ?? "—",
    }));

    setLogs(list);
    setLoading(false);
  }

  useEffect(() => {
    loadSubmitted();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmId]);

  async function approve(logId) {
    setBusyId(logId);
    setError("");

    // If you implemented RPCs, use this:
    const { error } = await supabase.rpc("approve_job_log", { p_log_id: logId });

    // If you didn't implement RPCs yet, comment the line above and use:
    // const { error } = await supabase
    //   .from("job_logs")
    //   .update({ status: "approved", approved_at: new Date().toISOString(), rejection_reason: null })
    //   .eq("id", logId);

    setBusyId(null);
    if (error) return setError(error.message);
    await loadSubmitted();
  }

  async function reject(logId) {
    const reason = prompt("Reason for rejection:");
    if (!reason) return;

    setBusyId(logId);
    setError("");

    // If you implemented RPCs, use this:
    const { error } = await supabase.rpc("reject_job_log", {
      p_log_id: logId,
      p_reason: reason,
    });

    // If you didn't implement RPCs yet, comment the line above and use:
    // const { error } = await supabase
    //   .from("job_logs")
    //   .update({ status: "rejected", rejection_reason: reason })
    //   .eq("id", logId);

    setBusyId(null);
    if (error) return setError(error.message);
    await loadSubmitted();
  }

  return (
    <div style={{ padding: 16 }}>
      <h2>Approvals</h2>
      <p style={{ opacity: 0.8, marginTop: -8 }}>Submitted logs waiting for approval.</p>

      {error && <div style={{ color: "crimson", marginBottom: 10 }}>{error}</div>}

      {loading ? (
        <p>Loading...</p>
      ) : logs.length === 0 ? (
        <p>No submitted logs.</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {logs.map((l) => (
            <div key={l.id} style={{ padding: 12, borderRadius: 12, border: "1px solid #eee" }}>
              <div style={{ fontWeight: 800 }}>
                {l.log_date} • {l.acres_done} ac
              </div>

              <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
                Worker: <b>{l.worker_name}</b>
              </div>

              <div style={{ fontSize: 13, opacity: 0.85 }}>
                {l.job_type}{l.crop ? ` • ${l.crop}` : ""} • Team: {l.team_name} • Plot: {l.plot_name}
              </div>

              {l.notes && <div style={{ marginTop: 6 }}>{l.notes}</div>}

              <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
                <button
                  disabled={busyId === l.id}
                  onClick={() => approve(l.id)}
                  style={{ padding: "10px 12px", borderRadius: 10, fontWeight: 800 }}
                >
                  {busyId === l.id ? "Working..." : "Approve"}
                </button>
                <button
                  disabled={busyId === l.id}
                  onClick={() => reject(l.id)}
                  style={{ padding: "10px 12px", borderRadius: 10 }}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        <button onClick={loadSubmitted} style={{ padding: "10px 12px", borderRadius: 10 }}>
          Refresh
        </button>
      </div>
    </div>
  );
}

