import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { useFarmId } from "../useFarmId";
import { useNavigate } from "react-router-dom";

export default function Jobs() {
  const farmId = useFarmId();
  const nav = useNavigate();

  const [plans, setPlans] = useState([]);
  const [teams, setTeams] = useState([]);
  const [plots, setPlots] = useState([]);
  const [jobTypes, setJobTypes] = useState([]);

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Create job fields
  const [planId, setPlanId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [plotId, setPlotId] = useState("");
  const [jobType, setJobType] = useState("");
  const [crop, setCrop] = useState("");
  const [activity, setActivity] = useState("");
  const [allottedAcres, setAllottedAcres] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Filters
  const [filterStatus, setFilterStatus] = useState("");
  const [filterTeam, setFilterTeam] = useState("");

  async function loadSetup() {
    if (!farmId) return;

    const [pRes, tRes, plRes, jtRes] = await Promise.all([
      supabase.from("plans").select("id, title, date_start, date_end").eq("farm_id", farmId).order("created_at", { ascending: false }),
      supabase.from("teams").select("id, name").eq("farm_id", farmId).order("name"),
      supabase.from("plots").select("id, name, size_acres").eq("farm_id", farmId).order("name"),
      supabase.from("job_types").select("id, name").eq("farm_id", farmId).eq("is_active", true).order("name"),
    ]);

    if (pRes.error) setError(pRes.error.message);
    if (tRes.error) setError(tRes.error.message);
    if (plRes.error) setError(plRes.error.message);
    if (jtRes.error) {
      // job_types table may not exist yet; fallback
      setJobTypes([]);
    }

    setPlans(pRes.data ?? []);
    setTeams(tRes.data ?? []);
    setPlots(plRes.data ?? []);
    setJobTypes(jtRes.data ?? []);

    // defaults
    const firstPlan = (pRes.data ?? [])[0];
    const firstTeam = (tRes.data ?? [])[0];
    const firstPlot = (plRes.data ?? [])[0];
    const firstJT = (jtRes.data ?? [])[0];

    if (!planId && firstPlan) setPlanId(firstPlan.id);
    if (!teamId && firstTeam) setTeamId(firstTeam.id);
    if (!plotId && firstPlot) setPlotId(firstPlot.id);
    if (!jobType && firstJT) setJobType(firstJT.name);
  }

  async function loadJobs() {
    if (!farmId) return;
    setLoading(true);
    setError("");

    let q = supabase
      .from("jobs")
      .select("id, job_type, crop, activity, allotted_acres, start_date, due_date, status, percent_complete, team_id, plot_id, teams(name), plots(name)")
      .eq("farm_id", farmId)
      .order("due_date", { ascending: true });

    if (filterStatus) q = q.eq("status", filterStatus);
    if (filterTeam) q = q.eq("team_id", filterTeam);

    const { data, error } = await q;
    if (error) setError(error.message);

    const list = (data ?? []).map((j) => ({
      ...j,
      team_name: j.teams?.name ?? "—",
      plot_name: j.plots?.name ?? "—",
    }));

    setJobs(list);
    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadSetup();
      await loadJobs();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmId]);

  useEffect(() => {
    loadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, filterTeam]);

  async function addJob(e) {
    e.preventDefault();
    if (!farmId) return;
    if (!planId) return setError("Create/select a plan first.");
    if (!teamId) return setError("Select a team.");
    if (!plotId) return setError("Select a plot.");
    if (!jobType.trim()) return setError("Job type is required.");

    const acres = Number(allottedAcres);
    if (!Number.isFinite(acres) || acres <= 0) return setError("Allotted acres must be > 0.");
    if (!startDate || !dueDate) return setError("Start and due dates are required.");
    if (dueDate < startDate) return setError("Due date must be >= start date.");

    setBusy(true);
    setError("");

    const { error } = await supabase.from("jobs").insert({
      plan_id: planId,
      farm_id: farmId,
      team_id: teamId,
      plot_id: plotId,
      job_type: jobType.trim(),
      crop: crop.trim() || null,
      activity: activity.trim() || null,
      allotted_acres: acres,
      start_date: startDate,
      due_date: dueDate,
      status: "not_started",
      percent_complete: 0,
    });

    setBusy(false);
    if (error) return setError(error.message);

    setCrop("");
    setActivity("");
    setAllottedAcres("");
    await loadJobs();
  }

  const statusLabel = useMemo(
    () => ({
      not_started: "Not started",
      in_progress: "In progress",
      done: "Done",
      blocked: "Blocked",
    }),
    []
  );

  return (
    <div style={{ padding: 16 }}>
      <h2>Jobs</h2>

      <form onSubmit={addJob} style={{ display: "grid", gap: 10, padding: 12, background: "#fafafa", borderRadius: 12 }}>
        <div style={{ fontWeight: 800 }}>Create Job</div>

        <div style={{ display: "grid", gap: 6 }}>
          <label>Plan</label>
          <select value={planId} onChange={(e) => setPlanId(e.target.value)} style={{ padding: 10, borderRadius: 10 }}>
            <option value="">Select plan...</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} ({p.date_start} → {p.date_end})
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <label>Team</label>
            <select value={teamId} onChange={(e) => setTeamId(e.target.value)} style={{ padding: 10, borderRadius: 10 }}>
              <option value="">Select team...</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label>Plot</label>
            <select value={plotId} onChange={(e) => setPlotId(e.target.value)} style={{ padding: 10, borderRadius: 10 }}>
              <option value="">Select plot...</option>
              {plots.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.size_acres} ac)
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <label>Job type</label>

            {jobTypes.length > 0 ? (
              <select value={jobType} onChange={(e) => setJobType(e.target.value)} style={{ padding: 10, borderRadius: 10 }}>
                <option value="">Select type...</option>
                {jobTypes.map((jt) => (
                  <option key={jt.id} value={jt.name}>{jt.name}</option>
                ))}
              </select>
            ) : (
              <input
                value={jobType}
                onChange={(e) => setJobType(e.target.value)}
                placeholder="e.g., planting"
                style={{ padding: 10, borderRadius: 10 }}
              />
            )}
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label>Crop (optional)</label>
            <input value={crop} onChange={(e) => setCrop(e.target.value)} placeholder="e.g., maize" style={{ padding: 10, borderRadius: 10 }} />
          </div>
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <label>Activity detail (optional)</label>
          <input value={activity} onChange={(e) => setActivity(e.target.value)} placeholder="e.g., plant maize on ridges" style={{ padding: 10, borderRadius: 10 }} />
        </div>

        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr 1fr" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <label>Allotted acres</label>
            <input value={allottedAcres} onChange={(e) => setAllottedAcres(e.target.value)} inputMode="decimal" placeholder="e.g., 1.5" style={{ padding: 10, borderRadius: 10 }} />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label>Start date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ padding: 10, borderRadius: 10 }} />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label>Due date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ padding: 10, borderRadius: 10 }} />
          </div>
        </div>

        {error && <div style={{ color: "crimson" }}>{error}</div>}

        <button disabled={busy || !farmId} style={{ padding: 12, borderRadius: 12, fontWeight: 800 }}>
          {busy ? "Saving..." : "Add Job"}
        </button>
      </form>

      <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ fontWeight: 800 }}>Jobs list</div>

          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ padding: 10, borderRadius: 10 }}>
            <option value="">All statuses</option>
            <option value="not_started">Not started</option>
            <option value="in_progress">In progress</option>
            <option value="done">Done</option>
            <option value="blocked">Blocked</option>
          </select>

          <select value={filterTeam} onChange={(e) => setFilterTeam(e.target.value)} style={{ padding: 10, borderRadius: 10 }}>
            <option value="">All teams</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          <button onClick={loadJobs} style={{ padding: "10px 12px", borderRadius: 10 }}>Refresh</button>
        </div>

        {loading ? (
          <p>Loading...</p>
        ) : jobs.length === 0 ? (
          <p>No jobs found.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {jobs.map((j) => (
              <div key={j.id} style={{ padding: 12, borderRadius: 12, border: "1px solid #eee" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{j.job_type}{j.crop ? ` • ${j.crop}` : ""}</div>
                    <div style={{ fontSize: 13, opacity: 0.8 }}>
                      Team: {j.team_name} • Plot: {j.plot_name}
                    </div>
                    <div style={{ fontSize: 13, opacity: 0.8 }}>
                      {j.start_date} → {j.due_date} • Allotted: {j.allotted_acres} ac
                    </div>
                    <div style={{ fontSize: 13, opacity: 0.9, marginTop: 6 }}>
                      Status: <b>{statusLabel[j.status] ?? j.status}</b> • Progress: <b>{Number(j.percent_complete).toFixed(0)}%</b>
                    </div>
                  </div>

                  <button onClick={() => nav(`/jobs/${j.id}`)} style={{ padding: "10px 12px", borderRadius: 10 }}>
                    Open
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

