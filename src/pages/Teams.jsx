import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { useFarmId } from "../useFarmId";

export default function Teams() {
  const farmId = useFarmId();

  const [teams, setTeams] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [members, setMembers] = useState([]); // memberships for selected team

  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Create team
  const [teamName, setTeamName] = useState("");
  const [leaderWorkerId, setLeaderWorkerId] = useState("");

  // Add member
  const [memberWorkerId, setMemberWorkerId] = useState("");
  const [memberStartDate, setMemberStartDate] = useState(() => new Date().toISOString().slice(0, 10));

  const selectedTeam = useMemo(
    () => teams.find((t) => t.id === selectedTeamId) || null,
    [teams, selectedTeamId]
  );

  async function loadWorkers() {
    if (!farmId) return;
    const { data, error } = await supabase
      .from("workers")
      .select("id, full_name, active")
      .eq("farm_id", farmId)
      .order("full_name");
    if (error) console.error(error);
    setWorkers(data ?? []);
  }

  async function loadTeams() {
    if (!farmId) return;
    const { data, error } = await supabase
      .from("teams")
      .select("id, name, leader_worker_id, created_at, workers(full_name)")
      .eq("farm_id", farmId)
      .order("created_at", { ascending: false });

    if (error) return setError(error.message);

    const list = (data ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      leader_worker_id: t.leader_worker_id,
      leader_name: t.workers?.full_name ?? null,
    }));

    setTeams(list);
    if (!selectedTeamId && list.length > 0) setSelectedTeamId(list[0].id);
  }

  async function loadMembers(teamId) {
    if (!teamId) return;
    const { data, error } = await supabase
      .from("team_members")
      .select("id, team_id, worker_id, start_date, end_date, workers(full_name)")
      .eq("team_id", teamId)
      .order("start_date", { ascending: false });

    if (error) return setError(error.message);

    const list = (data ?? []).map((m) => ({
      id: m.id,
      team_id: m.team_id,
      worker_id: m.worker_id,
      full_name: m.workers?.full_name ?? "—",
      start_date: m.start_date,
      end_date: m.end_date,
    }));
    setMembers(list);
  }

  async function refreshAll() {
    if (!farmId) return;
    setLoading(true);
    setError("");
    await Promise.all([loadWorkers(), loadTeams()]);
    setLoading(false);
  }

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmId]);

  useEffect(() => {
    if (selectedTeamId) loadMembers(selectedTeamId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTeamId]);

  async function addTeam(e) {
    e.preventDefault();
    if (!farmId) return;
    if (!teamName.trim()) return setError("Team name is required.");

    setBusy(true);
    setError("");

    const { error } = await supabase.from("teams").insert({
      farm_id: farmId,
      name: teamName.trim(),
      leader_worker_id: leaderWorkerId || null,
    });

    setBusy(false);
    if (error) return setError(error.message);

    setTeamName("");
    setLeaderWorkerId("");
    await loadTeams();
  }

  async function deleteTeam(teamId) {
    if (!confirm("Delete this team? (Members will also be removed)")) return;
    setBusy(true);
    setError("");
    const { error } = await supabase.from("teams").delete().eq("id", teamId);
    setBusy(false);
    if (error) return setError(error.message);
    if (selectedTeamId === teamId) setSelectedTeamId(null);
    await loadTeams();
  }

  async function addMember(e) {
    e.preventDefault();
    if (!selectedTeamId) return setError("Select a team first.");
    if (!memberWorkerId) return setError("Select a worker.");

    setBusy(true);
    setError("");

    const { error } = await supabase.from("team_members").insert({
      team_id: selectedTeamId,
      worker_id: memberWorkerId,
      start_date: memberStartDate,
      end_date: null,
    });

    setBusy(false);
    if (error) return setError(error.message);

    setMemberWorkerId("");
    await loadMembers(selectedTeamId);
  }

  async function endMembership(memberId) {
    const endDate = prompt("Enter end date (YYYY-MM-DD):", new Date().toISOString().slice(0, 10));
    if (!endDate) return;

    setBusy(true);
    setError("");

    const { error } = await supabase
      .from("team_members")
      .update({ end_date: endDate })
      .eq("id", memberId);

    setBusy(false);
    if (error) return setError(error.message);

    await loadMembers(selectedTeamId);
  }

  return (
      <div style={{ padding: 16, maxWidth: 1000, margin: "0 auto" }}>
        <h2>Teams</h2>

        {error && <div style={{ color: "crimson", marginBottom: 10 }}>{error}</div>}

        {loading ? (
          <p>Loading...</p>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {/* Create Team */}
            <form onSubmit={addTeam} style={{ display: "grid", gap: 10, padding: 12, background: "#fafafa", borderRadius: 12 }}>
              <div style={{ fontWeight: 800 }}>Create Team</div>

              <div style={{ display: "grid", gap: 6 }}>
                <label>Team name</label>
                <input
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="e.g., Team A"
                  style={{ padding: 10, borderRadius: 10 }}
                />
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <label>Leader (optional)</label>
                <select
                  value={leaderWorkerId}
                  onChange={(e) => setLeaderWorkerId(e.target.value)}
                  style={{ padding: 10, borderRadius: 10 }}
                >
                  <option value="">—</option>
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.full_name} {w.active ? "" : "(inactive)"}
                    </option>
                  ))}
                </select>
              </div>

              <button disabled={busy || !farmId} style={{ padding: 12, borderRadius: 12, fontWeight: 700 }}>
                {busy ? "Saving..." : "Add team"}
              </button>
            </form>

            {/* Team selector + members */}
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr", }}>
              <div style={{ padding: 12, borderRadius: 12, border: "1px solid #eee" }}>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>Teams</div>

                {teams.length === 0 ? (
                  <p>No teams yet.</p>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {teams.map((t) => (
                      <div
                        key={t.id}
                        style={{
                          padding: 12,
                          borderRadius: 12,
                          border: selectedTeamId === t.id ? "2px solid #111" : "1px solid #eee",
                          cursor: "pointer",
                        }}
                        onClick={() => setSelectedTeamId(t.id)}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                          <div>
                            <div style={{ fontWeight: 800 }}>{t.name}</div>
                            <div style={{ opacity: 0.8, fontSize: 13 }}>
                              Leader: {t.leader_name ?? "—"}
                            </div>
                          </div>
                          <button
                            disabled={busy}
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteTeam(t.id);
                            }}
                            style={{ padding: "8px 10px", borderRadius: 10 }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ padding: 12, borderRadius: 12, border: "1px solid #eee" }}>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>
                  Team Members {selectedTeam ? `— ${selectedTeam.name}` : ""}
                </div>

                {!selectedTeamId ? (
                  <p>Select a team to manage members.</p>
                ) : (
                  <>
                    {/* Add member */}
                    <form onSubmit={addMember} style={{ display: "grid", gap: 10, marginBottom: 14 }}>
                      <div style={{ display: "grid", gap: 6 }}>
                        <label>Add worker</label>
                        <select
                          value={memberWorkerId}
                          onChange={(e) => setMemberWorkerId(e.target.value)}
                          style={{ padding: 10, borderRadius: 10 }}
                        >
                          <option value="">Select worker...</option>
                          {workers
                            .filter((w) => w.active)
                            .map((w) => (
                              <option key={w.id} value={w.id}>
                                {w.full_name}
                              </option>
                            ))}
                        </select>
                      </div>

                      <div style={{ display: "grid", gap: 6 }}>
                        <label>Start date</label>
                        <input
                          type="date"
                          value={memberStartDate}
                          onChange={(e) => setMemberStartDate(e.target.value)}
                          style={{ padding: 10, borderRadius: 10 }}
                        />
                      </div>

                      <button disabled={busy} style={{ padding: 12, borderRadius: 12, fontWeight: 700 }}>
                        {busy ? "Saving..." : "Add member"}
                      </button>
                    </form>

                    {/* Members list */}
                    {members.length === 0 ? (
                      <p>No members yet.</p>
                    ) : (
                      <div style={{ display: "grid", gap: 10 }}>
                        {members.map((m) => (
                          <div key={m.id} style={{ padding: 12, borderRadius: 12, background: "#fafafa" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                              <div>
                                <div style={{ fontWeight: 800 }}>{m.full_name}</div>
                                <div style={{ opacity: 0.8, fontSize: 13 }}>
                                  {m.start_date} → {m.end_date ?? "active"}
                                </div>
                              </div>
                              <button disabled={busy} onClick={() => endMembership(m.id)} style={{ padding: "8px 10px", borderRadius: 10 }}>
                                End
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
  );
}

