import React from "react";
import { Link, useLocation } from "react-router-dom";

const linkStyle = (active) => ({
  padding: "10px 12px",
  borderRadius: 10,
  textDecoration: "none",
  color: active ? "white" : "#111",
  background: active ? "#111" : "#f2f2f2",
  fontWeight: 600,
  fontSize: 14,
});

export default function Nav() {
  const { pathname } = useLocation();

  return (
    <div style={{ padding: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
      <Link to="/" style={linkStyle(pathname === "/")}>Dashboard</Link>
      <Link to="/plots" style={linkStyle(pathname === "/plots")}>Plots</Link>
      <Link to="/workers" style={linkStyle(pathname === "/workers")}>Workers</Link>
      <Link to="/teams" style={linkStyle(pathname === "/teams")}>Teams</Link>

      <Link to="/plans" style={linkStyle(pathname === "/plans")}>Plans</Link>
      <Link to="/jobs" style={linkStyle(pathname === "/jobs")}>Jobs</Link>
      <Link to="/approvals" style={linkStyle(pathname === "/approvals")}>Approvals</Link>
      <Link to="/payroll" style={linkStyle(pathname === "/payroll")}>Payroll</Link>
      <Link to="/rates" style={linkStyle(pathname === "/rates")}>Rates</Link>


      <Link to="/farms" style={linkStyle(pathname === "/farms")}>Change Farm</Link>
    </div>
  );
}

