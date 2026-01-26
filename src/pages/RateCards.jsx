import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { useFarmId } from "../useFarmId";

const fmt = (n) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return "";
  return x.toFixed(0);
};

export default function RateCards() {
  const farmId = useFarmId();

  const [jobTypes, setJobTypes] = useState([]);
  const [rateCards, setRateCards] = useState([]);
  const [selectedCardId, setSelectedCardId] = useState("");
  const [rates, setRates] = useState([]); // rows for selected card

  const [newCardName, setNewCardName] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Editable rates state: { [job_type]: number }
  const [editMap, setEditMap] = useState({});

  const selectedCard = useMemo(
    () => rateCards.find((c) => c.id === selectedCardId) || null,
    [rateCards, selectedCardId]
  );

  async function loadJobTypes() {
    if (!farmId) return;
    // Prefer job_types table, fallback to hardcoded list if it doesn't exist
    const res = await supabase
      .from("job_types")
      .select("name")
      .eq("farm_id", farmId)
      .eq("is_active", true)
      .order("name");

    if (res.error) {
      setJobTypes([
        "planting",
        "weeding",
        "fertilizing",
        "irrigating",
        "harvesting",
        "pest control",
        "fencing",
        "animal feeding",
        "heaping",
        "composting",
        "construction",
      ]);
      return;
    }
    setJobTypes((res.data ?? []).map((x) => x.name));
  }

  async function loadRateCards() {
    if (!farmId) return;
    const { data, error } = await supabase
      .from("rate_cards")
      .select("id, name, currency, effective_from, is_active, created_at")
      .eq("farm_id", farmId)
      .order("created_at", { ascending: false });

    if (error) return setError(error.message);

    setRateCards(data ?? []);
    if (!selectedCardId && (data ?? []).length > 0) setSelectedCardId(data[0].id);
  }

  async function loadRates(cardId) {
    if (!cardId) {
      setRates([]);
      setEditMap({});
      return;
    }

    const { data, error } = await supabase
      .from("rates")
      .select("id, rate_card_id, job_type, crop, pay_type, rate_amount")
      .eq("rate_card_id", cardId)
      .is("crop", null)
      .eq("pay_type", "per_acre")
      .order("job_type");

    if (error) return setError(error.message);

    setRates(data ?? []);

    // Build editMap from existing rates
    const map = {};
    (data ?? []).forEach((r) => {
      map[r.job_type] = r.rate_amount;
    });

    // For job types missing rates, set defaults (within ₦30k–₦35k)
    jobTypes.forEach((jt) => {
      if (map[jt] == null) map[jt] = 30000;
    });

    setEditMap(map);
  }

  useEffect(() => {
    (async () => {
      setError("");
      await loadJobTypes();
      await loadRateCards();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmId]);

  useEffect(() => {
    loadRates(selectedCardId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCardId, jobTypes.length]);

  async function createRateCard(e) {
    e.preventDefault();
    if (!farmId) return;
    if (!newCardName.trim()) return setError("Rate card name is required.");

    setBusy(true);
    setError("");

    const { data, error } = await supabase
      .from("rate_cards")
      .insert({
        farm_id: farmId,
        name: newCardName.trim(),
        currency: "NGN",
        effective_from: effectiveFrom,
        is_active: true,
      })
      .select("id")
      .single();

    setBusy(false);
    if (error) return setError(error.message);

    setNewCardName("");
    await loadRateCards();
    if (data?.id) setSelectedCardId(data.id);
  }

  async function setActiveCard(cardId) {
    if (!farmId) return;
    setBusy(true);
    setError("");

    // set all inactive, then set selected active
    const off = await supabase
      .from("rate_cards")
      .update({ is_active: false })
      .eq("farm_id", farmId);

    if (off.error) {
      setBusy(false);
      return setError(off.error.message);
    }

    const on = await supabase
      .from("rate_cards")
      .update({ is_active: true })
      .eq("id", cardId);

    setBusy(false);
    if (on.error) return setError(on.error.message);

    await loadRateCards();
  }

  function updateEdit(jobType, val) {
    // Allow empty string while typing
    setEditMap((prev) => ({ ...prev, [jobType]: val }));
  }

  async function saveRates() {
    if (!selectedCardId) return setError("Select a rate card first.");
    if (jobTypes.length === 0) return setError("No job types found.");

    // validate: each is 30000–35000 (as your requirement)
    for (const jt of jobTypes) {
      const v = Number(editMap[jt]);
      if (!Number.isFinite(v)) return setError(`Rate for "${jt}" must be a number.`);
      if (v < 10000 || v > 50000) return setError(`Rate for "${jt}" must be ₦10,000–₦50,000.`);
    }

    setBusy(true);
    setError("");

    // Upsert rows into rates: crop=null, per_acre
    // Note: Supabase "upsert" needs conflict target configured in DB (unique index exists)
    const payload = jobTypes.map((jt) => ({
      rate_card_id: selectedCardId,
      job_type: jt,
      crop: null,
      pay_type: "per_acre",
      rate_amount: Number(editMap[jt]),
    }));

    const { error } = await supabase.from("rates").upsert(payload, {
      onConflict: "rate_card_id,job_type,crop",
      ignoreDuplicates: false,
    });

    setBusy(false);
    if (error) return setError(error.message);

    await loadRates(selectedCardId);
    alert("Rates saved.");
  }

  return (
    <div style={{ padding: 16 }}>
      <h2>Rates</h2>
      <p style={{ opacity: 0.8, marginTop: -8 }}>
        Set per-acre pay rates (₦10,000–₦50,000) by job type.
      </p>

      {error && <div style={{ color: "crimson", marginBottom: 10 }}>{error}</div>}

      {/* Create rate card */}
      <form
        onSubmit={createRateCard}
        style={{ display: "grid", gap: 10, padding: 12, background: "#fafafa", borderRadius: 12 }}
      >
        <div style={{ fontWeight: 800 }}>Create Rate Card</div>

        <div style={{ display: "grid", gap: 6 }}>
          <label>Name</label>
          <input
            value={newCardName}
            onChange={(e) => setNewCardName(e.target.value)}
            placeholder="e.g., Standard Per-Acre 2026"
            style={{ padding: 10, borderRadius: 10 }}
          />
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <label>Effective from</label>
          <input
            type="date"
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
            style={{ padding: 10, borderRadius: 10 }}
          />
        </div>

        <button disabled={busy || !farmId} style={{ padding: 12, borderRadius: 12, fontWeight: 800 }}>
          {busy ? "Saving..." : "Create rate card"}
        </button>
      </form>

      {/* Select rate card */}
      <div style={{ marginTop: 14, padding: 12, borderRadius: 12, border: "1px solid #eee" }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Select Rate Card</div>

        <select
          value={selectedCardId}
          onChange={(e) => setSelectedCardId(e.target.value)}
          style={{ padding: 10, borderRadius: 10, width: "100%" }}
        >
          <option value="">Select...</option>
          {rateCards.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} {c.is_active ? "(active)" : ""} • {c.effective_from}
            </option>
          ))}
        </select>

        {selectedCard && (
          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              disabled={busy}
              onClick={() => setActiveCard(selectedCard.id)}
              style={{ padding: "10px 12px", borderRadius: 10, fontWeight: 800 }}
            >
              Set Active
            </button>
          </div>
        )}
      </div>

      {/* Rates editor */}
      <div style={{ marginTop: 14, padding: 12, borderRadius: 12, border: "1px solid #eee" }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Per-acre rates (NGN)</div>
        <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 10 }}>
          These rates apply when crop is not specified (crop = all). You can extend later for crop-specific rates.
        </div>

        {!selectedCardId ? (
          <p>Select a rate card to edit rates.</p>
        ) : jobTypes.length === 0 ? (
          <p>No job types found.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {jobTypes.map((jt) => (
              <div
                key={jt}
                style={{
                  display: "grid",
                  gap: 10,
                  gridTemplateColumns: "1fr 160px",
                  alignItems: "center",
                  padding: 10,
                  borderRadius: 10,
                  background: "#fafafa",
                }}
              >
                <div style={{ fontWeight: 700, textTransform: "capitalize" }}>{jt}</div>

                <input
                  value={editMap[jt] ?? ""}
                  onChange={(e) => updateEdit(jt, e.target.value)}
                  inputMode="numeric"
                  placeholder="30000"
                  style={{ padding: 10, borderRadius: 10 }}
                />
              </div>
            ))}

            <button disabled={busy} onClick={saveRates} style={{ padding: 12, borderRadius: 12, fontWeight: 900 }}>
              {busy ? "Saving..." : "Save rates"}
            </button>
          </div>
        )}
      </div>

      {/* Quick view of saved rates */}
      {rates.length > 0 && (
        <div style={{ marginTop: 14, padding: 12, borderRadius: 12, border: "1px solid #eee" }}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Saved rates (current card)</div>
          <div style={{ display: "grid", gap: 8 }}>
            {rates.map((r) => (
              <div key={r.id} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={{ textTransform: "capitalize" }}>{r.job_type}</div>
                <div style={{ fontWeight: 800 }}>₦{fmt(r.rate_amount)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

