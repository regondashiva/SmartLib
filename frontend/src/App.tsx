import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";

// Pages
import LoginPage from "@/pages/Login";
import UnauthorizedPage from "@/pages/Unauthorized";
import DashboardPage from "@/pages/Dashboard";
import BookCatalogPage from "@/pages/books/BookCatalog";
import BookDetailPage from "@/pages/books/BookDetail";
import CataloguingPage from "@/pages/cataloguing/Cataloguing";
import MembersPage from "@/pages/members/Members";
import MemberDetailPage from "@/pages/members/MemberDetail";
import CirculationPage from "@/pages/circulation/Circulation";
import RFIDTaggingPage from "@/pages/rfid/RFIDTagging";
import RFIDDevicesPage from "@/pages/rfid/RFIDDevices";
import InventoryManagementPage from "@/pages/inventory/InventoryManagement";
import SecurityGateMonitoringPage from "@/pages/security/SecurityGateMonitoring";
import DataMigrationPage from "@/pages/migration/DataMigration";
import ReportsAnalyticsPage from "@/pages/reports/ReportsAnalytics";
import NotificationsPage from "@/pages/notifications/Notifications";
import UserManagementPage from "@/pages/users/UserManagement";
import RolesPermissionsPage from "@/pages/roles/RolesPermissions";
import AuditLogsPage from "@/pages/audit/AuditLogs";
import SystemSettingsPage from "@/pages/settings/SystemSettings";
import BackupUpdatesPage from "@/pages/backup/BackupUpdates";
import PublicOpacPage from "@/pages/opac/PublicOpac";
import LabelsManagementPage from "@/pages/labels/LabelsManagement";
import AcquisitionsAndSerialsPage from "@/pages/acquisitions/Acquisitions";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/unauthorized"
              element={
                <AppLayout>
                  <UnauthorizedPage />
                </AppLayout>
              }
            />
            {/* Public OPAC Route (Accessible without staff login) */}
            <Route path="/opac" element={<PublicOpacPage />} />

            {/* Protected Routes wrapped in AppLayout */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <DashboardPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/books"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <BookCatalogPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/books/:id"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <BookDetailPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/cataloguing"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <CataloguingPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/members"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <MembersPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/members/:id"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <MemberDetailPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/circulation"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <CirculationPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/rfid/tagging"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <RFIDTaggingPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/rfid/devices"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <RFIDDevicesPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/inventory"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <InventoryManagementPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/security-gate"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <SecurityGateMonitoringPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/migration"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <DataMigrationPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <ReportsAnalyticsPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <NotificationsPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            {/* Admin only routes */}
            <Route
              path="/users"
              element={
                <ProtectedRoute requiredRoles={["ADMIN"]}>
                  <AppLayout>
                    <UserManagementPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/roles"
              element={
                <ProtectedRoute requiredRoles={["ADMIN"]}>
                  <AppLayout>
                    <RolesPermissionsPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/audit"
              element={
                <ProtectedRoute requiredRoles={["ADMIN"]}>
                  <AppLayout>
                    <AuditLogsPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route path="/audit-logs" element={<Navigate to="/audit" replace />} />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <SystemSettingsPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/backup"
              element={
                <ProtectedRoute requiredRoles={["ADMIN"]}>
                  <AppLayout>
                    <BackupUpdatesPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/labels"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <LabelsManagementPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/acquisitions"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <AcquisitionsAndSerialsPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/serials"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <AcquisitionsAndSerialsPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/bookshelf"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <PublicOpacPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

