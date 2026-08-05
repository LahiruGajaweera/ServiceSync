import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

import LoginPage from "./pages/LoginPage";
import SetupPage from "./pages/SetupPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ForcePasswordChangePage from "./pages/ForcePasswordChangePage";
import TrackingPage from "./pages/TrackingPage";
import AdminLayout from "./layouts/AdminLayout";
import TechnicianLayout from "./layouts/TechnicianLayout";

// Admin pages
import AdminDashboard      from "./pages/admin/AdminDashboard";
import AnalyticsDashboard  from "./pages/admin/AnalyticsDashboard";
import PredictiveAnalytics from "./pages/admin/PredictiveAnalytics";
import JobManagement       from "./pages/admin/JobManagement";
// Removed JobDetail
import CustomerRegistry    from "./pages/admin/CustomerRegistry";
import InventoryManager    from "./pages/admin/InventoryManager";
import TechnicianPanel     from "./pages/admin/TechnicianPanel";
import InvoiceManager      from "./pages/admin/InvoiceManager";
import SalvageConsole      from "./pages/admin/SalvageConsole";
import DonorDeviceConsole  from "./pages/admin/DonorDeviceConsole";

// Technician pages
import TechDashboard from "./pages/technician/TechDashboard";
import JobQueue      from "./pages/technician/JobQueue";
import TechDonorDevices from "./pages/technician/TechDonorDevices";

// Shared pages
import ProfilePage from "./pages/ProfilePage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* ── Public ─────────────────────────────────────────── */}          <Route path="/setup" element={<SetupPage />} />          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/set-password" element={<ForcePasswordChangePage />} />
          <Route path="/track" element={<TrackingPage />} />
          <Route path="/track/:jobId" element={<TrackingPage />} />

          {/* ── Admin (role: admin) ─────────────────────────────── */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute role="admin">
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index             element={<AdminDashboard />} />
            <Route path="jobs"        element={<JobManagement />} />
            {/* Removed jobs/:jobId route */}
            <Route path="customers"   element={<CustomerRegistry />} />
            <Route path="inventory"   element={<InventoryManager />} />
            <Route path="technicians" element={<TechnicianPanel />} />
            <Route path="invoices"    element={<InvoiceManager />} />
            <Route path="salvage"     element={<SalvageConsole />} />
            <Route path="analytics"   element={<AnalyticsDashboard />} />
            <Route path="predictions" element={<PredictiveAnalytics />} />
            <Route path="donors"      element={<DonorDeviceConsole />} />
            <Route path="profile"     element={<ProfilePage />} />
          </Route>

          {/* ── Technician (role: technician) ───────────────────── */}
          <Route
            path="/tech"
            element={
              <ProtectedRoute role="technician">
                <TechnicianLayout />
              </ProtectedRoute>
            }
          >
            <Route index      element={<TechDashboard />} />
            <Route path="jobs" element={<JobQueue />} />
            <Route path="donors" element={<TechDonorDevices />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>

          {/* ── Fallback ────────────────────────────────────────── */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
