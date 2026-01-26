import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";

export default function FarmSelect() {
  const [farms, setFarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      setLoading(true);

      const { data, error } = await supabase
        .from("farm_memberships")
        .select("farm_id, role, farms(id, name, location)")
        .eq("is_active", true);

      if (error) {
        console.error(error);
        setFarms([]);
      } else {
        const list = (data ?? [])
          .map((m) => ({
            farm_id: m.farm_id,
            role: m.role,
            name: m.farms?.name,
            location: m.farms?.location,
          }))
          .filter((x) => x.farm_id && x.name);
        setFarms(list);
      }

      setLoading(false);
    }
    load();
  }, []);

  function chooseFarm(farmId) {
    localStorage.setItem("selectedFarmId", farmId);
    navigate("/", { replace: true });
  }

  if (loading) return <div style={{ padding: 16 }}>Loading farms...</div>;

  return (
    <div style={{ padding: 16, maxWidth: 700, margin: "0 auto" }}>
      <h2>Select Farm</h2>
      {farms.length === 0 ? (
        <p>No farm membership found. Ask admin to add you to a farm.</p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {farms.map((f) => (
            <button
              key={f.farm_id}
              onClick={() => chooseFarm(f.farm_id)}
              style={{ padding: 14, borderRadius: 12, textAlign: "left" }}
            >
              <div style={{ fontWeight: 700 }}>{f.name}</div>
              <div style={{ opacity: 0.8 }}>{f.location || "—"}</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Role: {f.role}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
