import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useFarmId } from "../useFarmId";

export default function Workers() {
  const farmId = useFarmId();
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");

  async function loadWorkers() {
    if (!farmId) return;
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("workers")
      .select("id, full_name, phone, role, active, created_at")
      .eq("farm_id", farmId)
      .order("created_at", { ascending: false });

    if (error) setError(error.message);
    setWorkers(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadWorkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmId]);

  async function addWorker(e) {
    e.preventDefault();
    if (!farmId) return;

    if (!fullName.trim()) return setError("Worker name is required.");

    setBusy(true);
    setError("");

    const { error } = await supabase.from("workers").insert({
      farm_id: farmId,
      full_name: fullName.trim(),
      phone: phone.trim() || null,
      role: role.trim() || null,
      active: true,
    });

    setBusy(false);
    if (error) return setError(error.message);

    setFullName("");
    setPhone("");
    setRole("");
    await loadWorkers();
  }

  async function toggleActive(worker) {
    setBusy(true);
    setError("");
    const { error } = await supabase
      .from("workers")
      .update({ active: !worker.active })
      .eq("id", worker.id);

    setBusy(false);
    if (error) return setError(error.message);
    await loadWorkers();
  }

  return (
      <div style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
        <h2>Workers</h2>

        <form onSubmit={addWorker} style={{ display: "grid", gap: 10, padding: 12, background: "#fafafa", borderRadius: 12 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <label>Full name</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g., John Doe" style={{ padding: 10, borderRadius: 10 }} />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label>Phone (optional)</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g., 080..." style={{ padding: 10, borderRadius: 10 }} />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label>Role/Skill (optional)</label>
            <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g., planter, weeder" style={{ padding: 10, borderRadius: 10 }} />
          </div>

          {error && <div style={{ color: "crimson" }}>{error}</div>}

          <button disabled={busy || !farmId} style={{ padding: 12, borderRadius: 12, fontWeight: 700 }}>
            {busy ? "Saving..." : "Add worker"}
          </button>
        </form>

        <div style={{ marginTop: 16 }}>
          {loading ? (
            <p>Loading...</p>
          ) : workers.length === 0 ? (
            <p>No workers yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {workers.map((w) => (
                <div key={w.id} style={{ padding: 12, borderRadius: 12, border: "1px solid #eee" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>
                        {w.full_name}{" "}
                        <span style={{ fontSize: 12, opacity: 0.7 }}>
                          ({w.active ? "Active" : "Inactive"})
                        </span>
                      </div>
                      <div style={{ opacity: 0.8, fontSize: 13 }}>
                        {w.phone ? `Phone: ${w.phone} • ` : ""}
                        {w.role ? `Role: ${w.role}` : "Role: —"}
                      </div>
                    </div>

                    <button disabled={busy} onClick={() => toggleActive(w)} style={{ padding: "8px 10px", borderRadius: 10 }}>
                      {w.active ? "Deactivate" : "Activate"}
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

