import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { useFarmId } from "../useFarmId";
import { useNavigate, useParams } from "react-router-dom";

export default function JobDetail() {
  const { jobId } = useParams();
  const farmId = useFarmId();
  const nav = useNavigate();

  const [job, setJob] = useState(null);
  const [logs, setLogs] = useState([]);
  const [workers, setWorkers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Add log fields
  const [logDate, setLogDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [acresDone, setAcresDone] = useState("");
  const [notes, setNotes] = useState("");
  const [performedBy, setPerformedBy] = useState("");
  const [saveMode, setSaveMode] = useState("submitted"); // 'draft' or 'submitted'

  const statusLabel = useMemo(
    () => ({
      draft: "Draft",
      submitted: "Submitted",
      approved: "Approved",
      rejected: "Rejected",
    }),
    []
  );

  async function loadAll() {
    if (!farmId || !jobId) return;
    setLoading(true);
    setError("");

    const jobRes = await supabase
      .from("jobs")
      .select("id, job_type, crop, activity, allotted_acres, start_date, due_date, status, percent_complete, team_id, plot_id, teams(name), plots(name)")
      .eq("id", jobId)
      .single();

    if (jobRes.error) {
      setError(jobRes.error.message);
      setLoading(false);
      return;
    }

    const j = jobRes.data;
    setJob({
      ...j,
      team_name: j.teams?.name ?? "—",
      plot_name: j.plots?.name ?? "—",
    });

    const logsRes = await supabase
      .from("job_logs")
      .select("id, log_date, acres_done, notes, status, rejection_reason, approved_at, performed_by_worker_id, workers(full_name), created_at")
      .eq("job_id", jobId)
      .order("log_date", { ascending: false })
      .order("created_at", { ascending: false });

    // workers join may fail if performed_by_worker_id not added; handle gracefully
    if (logsRes.error) {
      const fallback = await supabase
        .from("job_logs")
        .select("id, log_date, acres_done, notes, status, rejection_reason, approved_at, created_at")
        .eq("job_id", jobId)
        .order("log_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (fallback.error) setError(fallback.error.message);
      setLogs(fallback.data ?? []);
    } else {
      setLogs(
        (logsRes.data ?? []).map((l) => ({
          ...l,
          performed_by_name: l.workers?.full_name ?? null,
        }))
      );
    }

    const wRes = await supabase
	  .from("team_members")
	  .select("worker_id, workers(full_name)")
	  .eq("team_id", j.team_id)
	  .is("end_date", null);

    setWorkers(
	  (wRes.data ?? []).map((x) => ({
	    id: x.worker_id,
	    full_name: x.workers?.full_name ?? "—",
	  }))
	);

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmId, jobId]);

  async function addLog(e) {
    e.preventDefault();
    if (!farmId || !jobId) return;

    const acres = Number(acresDone);
    if (!Number.isFinite(acres) || acres <= 0) return setError("Acres done must be > 0.");
    
    if (!performedBy) return setError("Performed by (worker) is required for payroll.");

    setBusy(true);
    setError("");

    // Build insert; performed_by_worker_id may not exist – safe to omit if empty
    const payload = {
      farm_id: farmId,
      job_id: jobId,
      log_date: logDate,
      acres_done: acres,
      notes: notes.trim() || null,
      status: saveMode,
      performed_by_worker_id: performedBy,
    };

    if (performedBy) payload.performed_by_worker_id = performedBy;

    const { error } = await supabase.from("job_logs").insert(payload);

    setBusy(false);
    if (error) return setError(error.message);

    setAcresDone("");
    setNotes("");
    setPerformedBy("");
    await loadAll();
  }

  async function deleteLog(id, status) {
    if (status === "approved") return alert("Approved logs cannot be deleted.");
    if (!confirm("Delete this log?")) return;

    setBusy(true);
    setError("");
    const { error } = await supabase.from("job_logs").delete().eq("id", id);
    setBusy(false);
    if (error) return setError(error.message);
    await loadAll();
  }

  if (loading) return <div style={{ padding: 16 }}>Loading...</div>;

  if (!job) {
    return (
      <div style={{ padding: 16 }}>
        <p>Job not found.</p>
        <button onClick={() => nav("/jobs")} style={{ padding: 10, borderRadius: 10 }}>Back</button>
      </div>
    );
  }
  
  async function setJobStatus(newStatus) {
  setBusy(true);
  setError("");

  const { error } = await supabase
    .from("jobs")
    .update({ status: newStatus })
    .eq("id", jobId);

  setBusy(false);
  if (error) return setError(error.message);

  await loadAll();
 }


  return (
    <div style={{ padding: 16 }}>
      <button onClick={() => nav("/jobs")} style={{ padding: "10px 12px", borderRadius: 10 }}>
        ← Back to Jobs
      </button>

      <h2 style={{ marginTop: 12 }}>
        {job.job_type}{job.crop ? ` • ${job.crop}` : ""}
      </h2>

      <div style={{ padding: 12, borderRadius: 12, border: "1px solid #eee" }}>
        <div style={{ fontSize: 13, opacity: 0.85 }}>Team: {job.team_name} • Plot: {job.plot_name}</div>
        <div style={{ fontSize: 13, opacity: 0.85 }}>
          {job.start_date} → {job.due_date} • Allotted: {job.allotted_acres} ac
        </div>
        {job.activity && <div style={{ marginTop: 8 }}>{job.activity}</div>}
        <div style={{ marginTop: 10, fontWeight: 800 }}>
          Progress: {Number(job.percent_complete).toFixed(0)}% • Status: {job.status}
        </div>
        <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
	  <button
	    disabled={busy}
	    onClick={() => setJobStatus("done")}
	    style={{ padding: "10px 12px", borderRadius: 10, fontWeight: 800 }}
	  >
	    Mark Done
	  </button>

	  <button
	    disabled={busy}
	    onClick={() => setJobStatus("in_progress")}
	    style={{ padding: "10px 12px", borderRadius: 10 }}
	  >
	    Mark In Progress
	  </button>

	  <button
	    disabled={busy}
	    onClick={() => setJobStatus("blocked")}
	    style={{ padding: "10px 12px", borderRadius: 10 }}
	  >
	    Mark Blocked
	  </button>

	  <button
	    disabled={busy}
	    onClick={() => setJobStatus("not_started")}
	    style={{ padding: "10px 12px", borderRadius: 10 }}
	  >
	    Reset Not Started
	  </button>
	</div>

      </div>

      <form onSubmit={addLog} style={{ marginTop: 16, display: "grid", gap: 10, padding: 12, background: "#fafafa", borderRadius: 12 }}>
        <div style={{ fontWeight: 800 }}>Add Log (acres done)</div>

        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <label>Date</label>
            <input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} style={{ padding: 10, borderRadius: 10 }} />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label>Acres done</label>
            <input value={acresDone} onChange={(e) => setAcresDone(e.target.value)} inputMode="decimal" placeholder="e.g., 0.5" style={{ padding: 10, borderRadius: 10 }} />
          </div>
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <label>Performed by <b style={{ color: "crimson" }}>*</b></label>
          <select required value={performedBy} onChange={(e) => setPerformedBy(e.target.value)} style={{ padding: 10, borderRadius: 10 }}>
            <option value="">Select worker...</option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>{w.full_name}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <label>Notes (optional)</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g., finished ridges on south side" style={{ padding: 10, borderRadius: 10 }} />
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="radio"
              name="mode"
              value="draft"
              checked={saveMode === "draft"}
              onChange={() => setSaveMode("draft")}
            />
            Save as draft
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="radio"
              name="mode"
              value="submitted"
              checked={saveMode === "submitted"}
              onChange={() => setSaveMode("submitted")}
            />
            Submit for approval
          </label>
        </div>

        {error && <div style={{ color: "crimson" }}>{error}</div>}

        <button disabled={busy} style={{ padding: 12, borderRadius: 12, fontWeight: 800 }}>
          {busy ? "Saving..." : "Add Log"}
        </button>
      </form>

      <div style={{ marginTop: 16 }}>
        <h3>Logs</h3>
        {logs.length === 0 ? (
          <p>No logs yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {logs.map((l) => (
              <div key={l.id} style={{ padding: 12, borderRadius: 12, border: "1px solid #eee" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>
                      {l.log_date} • {l.acres_done} ac • {statusLabel[l.status] ?? l.status}
                    </div>
                    {(l.performed_by_name || l.performed_by_worker_id) && (
                      <div style={{ fontSize: 13, opacity: 0.85 }}>
                        Worker: {l.performed_by_name ?? l.performed_by_worker_id}
                      </div>
                    )}
                    {l.notes && <div style={{ marginTop: 6 }}>{l.notes}</div>}
                    {l.status === "rejected" && l.rejection_reason && (
                      <div style={{ marginTop: 6, color: "crimson" }}>Rejected: {l.rejection_reason}</div>
                    )}
                  </div>

                  <button disabled={busy} onClick={() => deleteLog(l.id, l.status)} style={{ padding: "8px 10px", borderRadius: 10 }}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

