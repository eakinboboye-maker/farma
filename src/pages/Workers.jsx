import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useFarmId } from "../useFarmId";

export default function Workers() {
  const farmId = useFarmId();

  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Create worker
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");

  // Edit worker state
  const [editingId, setEditingId] = useState(null);
  const [editFullName, setEditFullName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editActive, setEditActive] = useState(true);

  async function loadWorkers() {
    if (!farmId) return;
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("workers")
      .select("id, full_name, phone, role, active, photo_url, created_at")
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

  function startEdit(w) {
    setEditingId(w.id);
    setEditFullName(w.full_name ?? "");
    setEditPhone(w.phone ?? "");
    setEditRole(w.role ?? "");
    setEditActive(!!w.active);
    setError("");
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id) {
    if (!editFullName.trim()) return setError("Worker name is required.");

    setBusy(true);
    setError("");

    const { error } = await supabase
      .from("workers")
      .update({
        full_name: editFullName.trim(),
        phone: editPhone.trim() || null,
        role: editRole.trim() || null,
        active: !!editActive,
      })
      .eq("id", id);

    setBusy(false);
    if (error) return setError(error.message);

    setEditingId(null);
    await loadWorkers();
  }

  // Upload photo to Supabase Storage and save public URL to workers.photo_url
  async function uploadPhoto(worker) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment"; // helps on Android to open camera/gallery

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      setBusy(true);
      setError("");

      try {
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";

        const path = `${farmId}/${worker.id}/${Date.now()}.${safeExt}`;

        const up = await supabase.storage
          .from("worker-photos")
          .upload(path, file, { upsert: true });

        if (up.error) throw up.error;

        // If bucket is PUBLIC, we can use getPublicUrl
        const { data } = supabase.storage.from("worker-photos").getPublicUrl(path);
        const publicUrl = data?.publicUrl;

        if (!publicUrl) throw new Error("Could not generate public URL.");

        const upd = await supabase
          .from("workers")
          .update({ photo_url: publicUrl })
          .eq("id", worker.id);

        if (upd.error) throw upd.error;

        await loadWorkers();
      } catch (e) {
        setError(e.message || "Upload failed.");
      } finally {
        setBusy(false);
      }
    };

    input.click();
  }

  return (
    <div style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      <h2>Workers</h2>

      <form
        onSubmit={addWorker}
        style={{ display: "grid", gap: 10, padding: 12, background: "#fafafa", borderRadius: 12 }}
      >
        <div style={{ fontWeight: 800 }}>Add Worker</div>

        <div style={{ display: "grid", gap: 6 }}>
          <label>Full name</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g., John Doe"
            style={{ padding: 10, borderRadius: 10 }}
          />
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <label>Phone (optional)</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g., 080..."
            style={{ padding: 10, borderRadius: 10 }}
          />
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <label>Role/Skill (optional)</label>
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g., planter, weeder"
            style={{ padding: 10, borderRadius: 10 }}
          />
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
            {workers.map((w) => {
              const isEditing = editingId === w.id;

              return (
                <div key={w.id} style={{ padding: 12, borderRadius: 12, border: "1px solid #eee" }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div style={{ width: 64, height: 64, borderRadius: 12, overflow: "hidden", background: "#f2f2f2", flex: "0 0 64px" }}>
                      {w.photo_url ? (
                        <img src={w.photo_url} alt="worker" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : null}
                    </div>

                    <div style={{ flex: 1 }}>
                      {!isEditing ? (
                        <>
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

                          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                            <button disabled={busy} onClick={() => startEdit(w)} style={{ padding: "8px 10px", borderRadius: 10 }}>
                              Edit
                            </button>
                            <button disabled={busy} onClick={() => uploadPhoto(w)} style={{ padding: "8px 10px", borderRadius: 10 }}>
                              {w.photo_url ? "Change picture" : "Upload picture"}
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ display: "grid", gap: 10 }}>
                            <div style={{ display: "grid", gap: 6 }}>
                              <label>Full name</label>
                              <input value={editFullName} onChange={(e) => setEditFullName(e.target.value)} style={{ padding: 10, borderRadius: 10 }} />
                            </div>

                            <div style={{ display: "grid", gap: 6 }}>
                              <label>Phone</label>
                              <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} style={{ padding: 10, borderRadius: 10 }} />
                            </div>

                            <div style={{ display: "grid", gap: 6 }}>
                              <label>Role</label>
                              <input value={editRole} onChange={(e) => setEditRole(e.target.value)} style={{ padding: 10, borderRadius: 10 }} />
                            </div>

                            <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <input type="checkbox" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} />
                              Active
                            </label>

                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                              <button disabled={busy} onClick={() => saveEdit(w.id)} style={{ padding: "10px 12px", borderRadius: 10, fontWeight: 800 }}>
                                Save
                              </button>
                              <button disabled={busy} onClick={cancelEdit} style={{ padding: "10px 12px", borderRadius: 10 }}>
                                Cancel
                              </button>
                              <button disabled={busy} onClick={() => uploadPhoto(w)} style={{ padding: "10px 12px", borderRadius: 10 }}>
                                {w.photo_url ? "Change picture" : "Upload picture"}
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

