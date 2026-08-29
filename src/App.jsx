import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import DashboardProduction from "./pages/DashboardProduction";
import Maintenance from "./pages/Maintenance";
import ImportExcel from "./pages/ImportExcel";
import MonCompte from "./pages/MonCompte";
import Users from "./pages/admin/Users";
import Permissions from "./pages/admin/Permissions";
import Organigramme from "./pages/Organigramme";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute moduleId="dashboard_qualite">
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard-production"
            element={
              <ProtectedRoute moduleId="dashboard_production">
                <Layout>
                  <DashboardProduction />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard-maintenance"
            element={
              <ProtectedRoute moduleId="dashboard_maintenance">
                <Layout>
                  <Maintenance />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/import"
            element={
              <ProtectedRoute moduleId="import">
                <Layout>
                  <ImportExcel />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/mon-compte"
            element={
              <ProtectedRoute>
                <Layout>
                  <MonCompte />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/organigramme"
            element={
              <ProtectedRoute>
                <Layout>
                  <Organigramme />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/utilisateurs"
            element={
              <ProtectedRoute allowedRoles={["super_admin", "manager"]}>
                <Layout>
                  <Users />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/permissions"
            element={
              <ProtectedRoute allowedRoles={["super_admin"]}>
                <Layout>
                  <Permissions />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
