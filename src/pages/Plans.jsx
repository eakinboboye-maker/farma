import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useFarmId } from "../useFarmId";

export default function Plans() {
  const farmId = useFarmId();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [frequency, setFrequency] = useState("weekly");
  const [dateStart, setDateStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [dateEnd, setDateEnd] = useState(() => new Date().toISOString().slice(0, 10));

  async function loadPlans() {
    if (!farmId) return;
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("plans")
      .select("id, title, frequency, date_start, date_end, created_at")
      .eq("farm_id", farmId)
      .order("created_at", { ascending: false });

    if (error) setError(error.message);
    setPlans(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmId]);

  async function addPlan(e) {
    e.preventDefault();
    if (!farmId) return;
    if (!title.trim()) return setError("Title is required.");
    if (!dateStart || !dateEnd) return setError("Start and end dates are required.");
    if (dateEnd < dateStart) return setError("End date must be >= start date.");

    setBusy(true);
    setError("");

    const { error } = await supabase.from("plans").insert({
      farm_id: farmId,
      title: title.trim(),
      frequency,
      date_start: dateStart,
      date_end: dateEnd,
    });

    setBusy(false);
    if (error) return setError(error.message);

    setTitle("");
    await loadPlans();
  }

  async function deletePlan(id) {
    if (!confirm("Delete this plan? (All jobs in it will be deleted)")) return;
    setBusy(true);
    setError("");
    const { error } = await supabase.from("plans").delete().eq("id", id);
    setBusy(false);
    if (error) return setError(error.message);
    await loadPlans();
  }

  return (
    <div style={{ padding: 16 }}>
      <h2>Plans</h2>

      {!farmId && (
        <div style={{ padding: 12, background: "#fff3cd", borderRadius: 10 }}>
          No farm selected. Go to “Change Farm”.
        </div>
      )}

      <form onSubmit={addPlan} style={{ display: "grid", gap: 10, padding: 12, background: "#fafafa", borderRadius: 12 }}>
        <div style={{ fontWeight: 800 }}>Create Plan</div>

        <div style={{ display: "grid", gap: 6 }}>
          <label>Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Week 1 - Maize planting"
            style={{ padding: 10, borderRadius: 10 }}
          />
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <label>Frequency</label>
          <select value={frequency} onChange={(e) => setFrequency(e.target.value)} style={{ padding: 10, borderRadius: 10 }}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Biweekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <label>Start date</label>
            <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} style={{ padding: 10, borderRadius: 10 }} />
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <label>End date</label>
            <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} style={{ padding: 10, borderRadius: 10 }} />
          </div>
        </div>

        {error && <div style={{ color: "crimson" }}>{error}</div>}

        <button disabled={busy || !farmId} style={{ padding: 12, borderRadius: 12, fontWeight: 800 }}>
          {busy ? "Saving..." : "Add Plan"}
        </button>
      </form>

      <div style={{ marginTop: 16 }}>
        {loading ? (
          <p>Loading...</p>
        ) : plans.length === 0 ? (
          <p>No plans yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {plans.map((p) => (
              <div key={p.id} style={{ padding: 12, borderRadius: 12, border: "1px solid #eee" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{p.title}</div>
                    <div style={{ fontSize: 13, opacity: 0.8 }}>
                      {p.frequency} • {p.date_start} → {p.date_end}
                    </div>
                  </div>
                  <button disabled={busy} onClick={() => deletePlan(p.id)} style={{ padding: "8px 10px", borderRadius: 10 }}>
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

