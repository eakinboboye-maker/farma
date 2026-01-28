import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useFarmId } from "../useFarmId";

export default function Plots() {
  const farmId = useFarmId();
  const [plots, setPlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [sizeAcres, setSizeAcres] = useState("");

  // edit state
  const [editingId, setEditingId] = useState(null);
  const [eName, setEName] = useState("");
  const [eCode, setECode] = useState("");
  const [eSizeAcres, setESizeAcres] = useState("");

  async function loadPlots() {
    if (!farmId) return;
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("plots")
      .select("id, name, code, size_acres, created_at")
      .eq("farm_id", farmId)
      .order("created_at", { ascending: false });

    if (error) setError(error.message);
    setPlots(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadPlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmId]);

  async function addPlot(e) {
    e.preventDefault();
    if (!farmId) return;

    const acres = Number(sizeAcres);
    if (!name.trim()) return setError("Plot name is required.");
    if (!Number.isFinite(acres) || acres <= 0) return setError("Size (acres) must be > 0.");

    setBusy(true);
    setError("");

    const { error } = await supabase.from("plots").insert({
      farm_id: farmId,
      name: name.trim(),
      code: code.trim() || null,
      size_acres: acres,
    });

    setBusy(false);
    if (error) return setError(error.message);

    setName("");
    setCode("");
    setSizeAcres("");
    await loadPlots();
  }

  function startEdit(p) {
    setEditingId(p.id);
    setEName(p.name ?? "");
    setECode(p.code ?? "");
    setESizeAcres(String(p.size_acres ?? ""));
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id) {
    const acres = Number(eSizeAcres);
    if (!eName.trim()) return setError("Plot name is required.");
    if (!Number.isFinite(acres) || acres <= 0) return setError("Size (acres) must be > 0.");

    setBusy(true);
    setError("");

    const { error } = await supabase
      .from("plots")
      .update({
        name: eName.trim(),
        code: eCode.trim() || null,
        size_acres: acres,
      })
      .eq("id", id);

    setBusy(false);
    if (error) return setError(error.message);

    setEditingId(null);
    await loadPlots();
  }

  async function deletePlot(id) {
    if (!confirm("Delete this plot?")) return;
    setBusy(true);
    setError("");
    const { error } = await supabase.from("plots").delete().eq("id", id);
    setBusy(false);
    if (error) return setError(error.message);
    await loadPlots();
  }

  return (
    <div style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      <h2>Plots</h2>
      <p style={{ opacity: 0.8, marginTop: -8 }}>All land is measured in acres.</p>

      <form onSubmit={addPlot} style={{ display: "grid", gap: 10, padding: 12, background: "#fafafa", borderRadius: 12 }}>
        <div style={{ fontWeight: 800 }}>Add Plot</div>

        <div style={{ display: "grid", gap: 6 }}>
          <label>Plot name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} style={{ padding: 10, borderRadius: 10 }} />
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <label>Plot code (optional)</label>
          <input value={code} onChange={(e) => setCode(e.target.value)} style={{ padding: 10, borderRadius: 10 }} />
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <label>Size (acres)</label>
          <input value={sizeAcres} onChange={(e) => setSizeAcres(e.target.value)} inputMode="decimal" style={{ padding: 10, borderRadius: 10 }} />
        </div>

        {error && <div style={{ color: "crimson" }}>{error}</div>}

        <button disabled={busy || !farmId} style={{ padding: 12, borderRadius: 12, fontWeight: 700 }}>
          {busy ? "Saving..." : "Add plot"}
        </button>
      </form>

      <div style={{ marginTop: 16 }}>
        {loading ? (
          <p>Loading...</p>
        ) : plots.length === 0 ? (
          <p>No plots yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {plots.map((p) => {
              const isEditing = editingId === p.id;

              return (
                <div key={p.id} style={{ padding: 12, borderRadius: 12, border: "1px solid #eee" }}>
                  {!isEditing ? (
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div>
                        <div style={{ fontWeight: 800 }}>{p.name}</div>
                        <div style={{ opacity: 0.8, fontSize: 13 }}>
                          {p.code ? `Code: ${p.code} • ` : ""}Size: {p.size_acres} acres
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 10 }}>
                        <button disabled={busy} onClick={() => startEdit(p)} style={{ padding: "8px 10px", borderRadius: 10 }}>
                          Edit
                        </button>
                        <button disabled={busy} onClick={() => deletePlot(p.id)} style={{ padding: "8px 10px", borderRadius: 10 }}>
                          Delete
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 10 }}>
                      <div style={{ display: "grid", gap: 6 }}>
                        <label>Plot name</label>
                        <input value={eName} onChange={(e) => setEName(e.target.value)} style={{ padding: 10, borderRadius: 10 }} />
                      </div>
                      <div style={{ display: "grid", gap: 6 }}>
                        <label>Plot code</label>
                        <input value={eCode} onChange={(e) => setECode(e.target.value)} style={{ padding: 10, borderRadius: 10 }} />
                      </div>
                      <div style={{ display: "grid", gap: 6 }}>
                        <label>Size (acres)</label>
                        <input value={eSizeAcres} onChange={(e) => setESizeAcres(e.target.value)} inputMode="decimal" style={{ padding: 10, borderRadius: 10 }} />
                      </div>

                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button disabled={busy} onClick={() => saveEdit(p.id)} style={{ padding: "10px 12px", borderRadius: 10, fontWeight: 800 }}>
                          Save
                        </button>
                        <button disabled={busy} onClick={cancelEdit} style={{ padding: "10px 12px", borderRadius: 10 }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

