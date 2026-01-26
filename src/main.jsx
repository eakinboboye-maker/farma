
import { registerSW } from "virtual:pwa-register";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { AuthProvider } from "./AuthProvider";
import ProtectedRoute from "./ProtectedRoute";

import Layout from "./components/Layout";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import FarmSelect from "./pages/FarmSelect";
import Plots from "./pages/Plots";
import Workers from "./pages/Workers";
import Teams from "./pages/Teams";

import Plans from "./pages/Plans";
import Jobs from "./pages/Jobs";
import JobDetail from "./pages/JobDetail";
import Approvals from "./pages/Approvals";
import Payroll from "./pages/Payroll";
import RateCards from "./pages/RateCards";

registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />

          {/* Protected */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/farms"
            element={
              <ProtectedRoute>
                  <FarmSelect />
              </ProtectedRoute>
            }
          />

          <Route
            path="/plots"
            element={
              <ProtectedRoute>
                <Layout>
                  <Plots />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/workers"
            element={
              <ProtectedRoute>
                <Layout>
                  <Workers />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/teams"
            element={
              <ProtectedRoute>
                <Layout>
                  <Teams />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
	  path="/plans"
	  element={
	    <ProtectedRoute>
	      <Layout>
		<Plans />
	      </Layout>
	    </ProtectedRoute>
	  }
	/>

	<Route
	  path="/jobs"
	  element={
	    <ProtectedRoute>
	      <Layout>
		<Jobs />
	      </Layout>
	    </ProtectedRoute>
	  }
	/>

	<Route
	  path="/jobs/:jobId"
	  element={
	    <ProtectedRoute>
	      <Layout>
		<JobDetail />
	      </Layout>
	    </ProtectedRoute>
	  }
	/>

	<Route
	  path="/approvals"
	  element={
	    <ProtectedRoute>
	      <Layout>
		<Approvals />
	      </Layout>
	    </ProtectedRoute>
	  }
	/>

	<Route
	  path="/payroll"
	  element={
	    <ProtectedRoute>
	      <Layout>
		<Payroll />
	      </Layout>
	    </ProtectedRoute>
	  }
	/>
	<Route
	  path="/rates"
	  element={
	    <ProtectedRoute>
	      <Layout>
		<RateCards />
	      </Layout>
	    </ProtectedRoute>
	  }
	/>

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);

