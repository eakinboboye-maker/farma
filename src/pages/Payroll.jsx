import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { useFarmId } from "../useFarmId";

export default function Payroll() {
  const farmId = useFarmId();

  const [rateCards, setRateCards] = useState([]);
  const [payPeriods, setPayPeriods] = useState([]);
  const [payrollLines, setPayrollLines] = useState([]);
  const [workers, setWorkers] = useState([]);

  const [selectedRateCardId, setSelectedRateCardId] = useState("");
  const [selectedPayPeriodId, setSelectedPayPeriodId] = useState("");

  const [periodType, setPeriodType] = useState("weekly");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [adjWorkerId, setAdjWorkerId] = useState("");
  const [adjType, setAdjType] = useState("deduction");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjReason, setAdjReason] = useState("");

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function loadAll() {
    if (!farmId) return;
    setLoading(true);
    setError("");

    const [rcRes, ppRes, wRes] = await Promise.all([
      supabase.from("rate_cards").select("id, name, effective_from, is_active").eq("farm_id", farmId).order("created_at", { ascending: false }),
      supabase.from("pay_periods").select("id, period_type, start_date, end_date, status, created_at").eq("farm_id", farmId).order("created_at", { ascending: false }),
      supabase.from("workers").select("id, full_name, active").eq("farm_id", farmId).eq("active", true).order("full_name"),
    ]);

    if (rcRes.error) setError(rcRes.error.message);
    if (ppRes.error) setError(ppRes.error.message);
    if (wRes.error) setError(wRes.error.message);

    setRateCards(rcRes.data ?? []);
    setPayPeriods(ppRes.data ?? []);
    setWorkers(wRes.data ?? []);

    // defaults
    const firstRC = (rcRes.data ?? [])[0];
    const firstPP = (ppRes.data ?? [])[0];

    if (!selectedRateCardId && firstRC) setSelectedRateCardId(firstRC.id);
    if (!selectedPayPeriodId && firstPP) setSelectedPayPeriodId(firstPP.id);

    setLoading(false);
  }

  async function loadPayrollLines(payPeriodId) {
    if (!payPeriodId) {
      setPayrollLines([]);
      return;
    }

    const { data, error } = await supabase
      .from("payroll_lines")
      .select("id, worker_id, gross_pay, deductions, net_pay, breakdown, workers(full_name)")
      .eq("pay_period_id", payPeriodId)
      .order("net_pay", { ascending: false });

    if (error) return setError(error.message);

    setPayrollLines(
      (data ?? []).map((l) => ({
        ...l,
        worker_name: l.workers?.full_name ?? l.worker_id,
      }))
    );
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmId]);

  useEffect(() => {
    loadPayrollLines(selectedPayPeriodId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPayPeriodId]);

  async function createPayPeriod(e) {
    e.preventDefault();
    if (!farmId) return;
    if (!startDate || !endDate) return setError("Start and end dates are required.");
    if (endDate < startDate) return setError("End date must be >= start date.");

    setBusy(true);
    setError("");

    const { data, error } = await supabase
      .from("pay_periods")
      .insert({
        farm_id: farmId,
        period_type: periodType,
        start_date: startDate,
        end_date: endDate,
        status: "open",
      })
      .select("id")
      .single();

    setBusy(false);
    if (error) return setError(error.message);

    await loadAll();
    if (data?.id) setSelectedPayPeriodId(data.id);
  }

  async function runPayroll() {
    if (!selectedPayPeriodId) return setError("Select a pay period.");
    if (!selectedRateCardId) return setError("Select a rate card.");

    setBusy(true);
    setError("");

    const { error } = await supabase.rpc("run_payroll", {
      p_pay_period_id: selectedPayPeriodId,
      p_rate_card_id: selectedRateCardId,
    });

    setBusy(false);
    if (error) return setError(error.message);

    await loadPayrollLines(selectedPayPeriodId);
    alert("Payroll computed. Scroll down to see payroll lines.");
  }

  async function addAdjustment(e) {
    e.preventDefault();
    if (!farmId) return;
    if (!adjWorkerId) return setError("Select a worker.");
    const amt = Number(adjAmount);
    if (!Number.isFinite(amt) || amt <= 0) return setError("Amount must be > 0.");

    setBusy(true);
    setError("");

    const { error } = await supabase.from("adjustments").insert({
      farm_id: farmId,
      worker_id: adjWorkerId,
      pay_period_id: selectedPayPeriodId || null,
      adj_type: adjType,
      amount: amt,
      reason: adjReason.trim() || null,
    });

    setBusy(false);
    if (error) return setError(error.message);

    setAdjAmount("");
    setAdjReason("");
    alert("Adjustment saved. Rerun payroll to apply it.");
  }

  const totals = useMemo(() => {
    const gross = payrollLines.reduce((s, x) => s + Number(x.gross_pay || 0), 0);
    const ded = payrollLines.reduce((s, x) => s + Number(x.deductions || 0), 0);
    const net = payrollLines.reduce((s, x) => s + Number(x.net_pay || 0), 0);
    return { gross, ded, net };
  }, [payrollLines]);
  
  function downloadCSV(filename, rows) {
  const escape = (v) => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replaceAll('"', '""')}"`;
    }
    return s;
  };

  const csv = rows.map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}


  return (
    <div style={{ padding: 16 }}>
      <h2>Payroll</h2>
      <p style={{ opacity: 0.8, marginTop: -8 }}>Approve logs first, then run payroll.</p>

      {error && <div style={{ color: "crimson", marginBottom: 10 }}>{error}</div>}
      {loading ? <p>Loading...</p> : null}

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr", marginTop: 10 }}>
        {/* Rate card + pay period selection */}
        <div style={{ padding: 12, borderRadius: 12, border: "1px solid #eee" }}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>1) Select Rate Card + Pay Period</div>

          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <label>Rate card</label>
              <select value={selectedRateCardId} onChange={(e) => setSelectedRateCardId(e.target.value)} style={{ padding: 10, borderRadius: 10 }}>
                <option value="">Select rate card...</option>
                {rateCards.map((rc) => (
                  <option key={rc.id} value={rc.id}>
                    {rc.name} {rc.is_active ? "" : "(inactive)"}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <label>Pay period</label>
              <select value={selectedPayPeriodId} onChange={(e) => setSelectedPayPeriodId(e.target.value)} style={{ padding: 10, borderRadius: 10 }}>
                <option value="">Select pay period...</option>
                {payPeriods.map((pp) => (
                  <option key={pp.id} value={pp.id}>
                    {pp.period_type}: {pp.start_date} → {pp.end_date} ({pp.status})
                  </option>
                ))}
              </select>
            </div>

            <button disabled={busy} onClick={runPayroll} style={{ padding: 12, borderRadius: 12, fontWeight: 800 }}>
              {busy ? "Working..." : "2) Run payroll"}
            </button>
          </div>
        </div>

        {/* Create pay period */}
        <form onSubmit={createPayPeriod} style={{ padding: 12, borderRadius: 12, background: "#fafafa" }}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Create New Pay Period</div>

          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <label>Period type</label>
              <select value={periodType} onChange={(e) => setPeriodType(e.target.value)} style={{ padding: 10, borderRadius: 10 }}>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
              <div style={{ display: "grid", gap: 6 }}>
                <label>Start date</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ padding: 10, borderRadius: 10 }} />
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <label>End date</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ padding: 10, borderRadius: 10 }} />
              </div>
            </div>

            <button disabled={busy} style={{ padding: 12, borderRadius: 12, fontWeight: 800 }}>
              {busy ? "Saving..." : "Create pay period"}
            </button>
          </div>
        </form>

        {/* Adjustments */}
        <form onSubmit={addAdjustment} style={{ padding: 12, borderRadius: 12, border: "1px solid #eee" }}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Adjustments (bonus / deduction / advance)</div>

          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <label>Worker</label>
              <select value={adjWorkerId} onChange={(e) => setAdjWorkerId(e.target.value)} style={{ padding: 10, borderRadius: 10 }}>
                <option value="">Select worker...</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>{w.full_name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
              <div style={{ display: "grid", gap: 6 }}>
                <label>Type</label>
                <select value={adjType} onChange={(e) => setAdjType(e.target.value)} style={{ padding: 10, borderRadius: 10 }}>
                  <option value="deduction">Deduction</option>
                  <option value="bonus">Bonus</option>
                  <option value="advance">Advance</option>
                </select>
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <label>Amount (NGN)</label>
                <input value={adjAmount} onChange={(e) => setAdjAmount(e.target.value)} inputMode="decimal" placeholder="e.g., 5000" style={{ padding: 10, borderRadius: 10 }} />
              </div>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <label>Reason (optional)</label>
              <input value={adjReason} onChange={(e) => setAdjReason(e.target.value)} placeholder="e.g., transport" style={{ padding: 10, borderRadius: 10 }} />
            </div>

            <div style={{ fontSize: 12, opacity: 0.75 }}>
              Tip: Add adjustment, then rerun payroll to apply.
            </div>

            <button disabled={busy} style={{ padding: 12, borderRadius: 12, fontWeight: 800 }}>
              {busy ? "Saving..." : "Save adjustment"}
            </button>
          </div>
        </form>

        {/* Payroll results */}
        <div style={{ padding: 12, borderRadius: 12, border: "1px solid #eee" }}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Payroll Lines</div>
		  <button
		  onClick={() => {
		    if (payrollLines.length === 0) return alert("No payroll lines to export.");
		    const rows = [
		      ["Worker", "Gross", "Deductions", "Net"],
		      ...payrollLines.map((l) => [
			l.worker_name,
			Number(l.gross_pay).toFixed(2),
			Number(l.deductions).toFixed(2),
			Number(l.net_pay).toFixed(2),
		      ]),
		    ];
		    downloadCSV("payroll_summary.csv", rows);
		  }}
		  style={{ padding: "10px 12px", borderRadius: 10, marginBottom: 10 }}
		>
		  Export CSV (Summary)
		</button>
		
		<button
		  onClick={() => {
		    const rows = [["Worker", "Job Type", "Crop", "Acres", "Rate", "Amount"]];
		    payrollLines.forEach((l) => {
		      const items = l.breakdown?.piece_items ?? [];
		      items.forEach((it) => {
			rows.push([
			  l.worker_name,
			  it.job_type,
			  it.crop ?? "",
			  it.acres_done,
			  Number(it.rate).toFixed(2),
			  Number(it.amount).toFixed(2),
			]);
		      });
		    });
		    if (rows.length === 1) return alert("No breakdown items to export.");
		    downloadCSV("payroll_breakdown.csv", rows);
		  }}
		  style={{ padding: "10px 12px", borderRadius: 10, marginLeft: 10, marginBottom: 10 }}
		>
		  Export CSV (Breakdown)
		</button>

          {payrollLines.length === 0 ? (
            <p>No payroll lines yet. Run payroll for a selected pay period.</p>
          ) : (
            <>
              <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 10 }}>
                Totals — Gross: ₦{totals.gross.toFixed(2)} • Deductions: ₦{totals.ded.toFixed(2)} • Net: ₦{totals.net.toFixed(2)}
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                {payrollLines.map((l) => {
		  const items = l.breakdown?.piece_items ?? [];
		  return (
		    <details key={l.id} style={{ padding: 12, borderRadius: 12, background: "#fafafa" }}>
		      <summary style={{ cursor: "pointer", fontWeight: 800 }}>
			{l.worker_name} — Net: ₦{Number(l.net_pay).toFixed(2)}
		      </summary>

		      <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9 }}>
			Gross: ₦{Number(l.gross_pay).toFixed(2)} • Deductions: ₦{Number(l.deductions).toFixed(2)}
		      </div>

		      {items.length === 0 ? (
			<div style={{ marginTop: 10, fontSize: 13, opacity: 0.8 }}>
			  No breakdown items (check logs were approved and have worker attribution).
			</div>
		      ) : (
			<div style={{ marginTop: 10, display: "grid", gap: 8 }}>
			  {items.map((it, idx) => (
			    <div
			      key={idx}
			      style={{
				padding: 10,
				borderRadius: 10,
				border: "1px solid #eee",
				background: "white",
			      }}
			    >
			      <div style={{ fontWeight: 700 }}>
				{it.job_type}{it.crop ? ` • ${it.crop}` : ""}
			      </div>
			      <div style={{ fontSize: 13, opacity: 0.85 }}>
				Acres: {it.acres_done} • Rate: ₦{Number(it.rate).toFixed(2)} • Amount: ₦{Number(it.amount).toFixed(2)}
			      </div>
			    </div>
			  ))}
			</div>
		      )}
		    </details>
		  );
		})}

              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

