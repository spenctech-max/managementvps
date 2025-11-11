import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import PageLoader from './components/PageLoader';
import ChunkLoadError from './components/ChunkLoadError';

// Lazy load all pages for code splitting
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Servers = lazy(() => import('./pages/Servers'));
const Services = lazy(() => import('./pages/Services'));
const Scans = lazy(() => import('./pages/Scans'));
const ScanDetail = lazy(() => import('./pages/ScanDetail'));
const Backups = lazy(() => import('./pages/Backups'));
const Users = lazy(() => import('./pages/Users'));
const Settings = lazy(() => import('./pages/Settings'));
const BackupSchedules = lazy(() => import('./pages/BackupSchedules').then(module => ({ default: module.BackupSchedules })));
const ScanComparison = lazy(() => import('./pages/ScanComparison').then(module => ({ default: module.ScanComparison })));
const HealthDashboard = lazy(() => import('./pages/HealthDashboard').then(module => ({ default: module.HealthDashboard })));
const BitLaunch = lazy(() => import('./pages/BitLaunch'));

function App() {
  return (
    <ChunkLoadError>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />

              {/* Protected routes */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <Dashboard />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/servers"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <Servers />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/services"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <Services />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/scans"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <Scans />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/scans/:id"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <ScanDetail />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/backups"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <Backups />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/backup-schedules"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <BackupSchedules />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/scan-comparison"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <ScanComparison />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/users"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <Layout>
                      <Users />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/health"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <Layout>
                      <HealthDashboard />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/bitlaunch"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <Layout>
                      <BitLaunch />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <Settings />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              {/* Root redirect */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />

              {/* 404 */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1e293b',
              color: '#fff',
              border: '1px solid #334155',
              borderRadius: '0.5rem',
            },
          }}
        />
      </AuthProvider>
    </ChunkLoadError>
  );
}

export default App;
