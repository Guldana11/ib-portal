import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import LoginPage from '@/components/auth/LoginPage';
import DocumentList from '@/components/documents/DocumentList';
import DocumentViewer from '@/components/documents/DocumentViewer';
import TestList from '@/components/tests/TestList';
import TestRunner from '@/components/tests/TestRunner';
import TestResults from '@/components/tests/TestResults';
import Dashboard from '@/components/admin/Dashboard';
import DocumentUpload from '@/components/admin/DocumentUpload';
import QuestionEditor from '@/components/admin/QuestionEditor';
import UserManagement from '@/components/admin/UserManagement';
import ComplianceReport from '@/components/admin/ComplianceReport';
import { Skeleton } from '@/components/ui/skeleton';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="space-y-4 w-96">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, isLoading } = useAuth();

  if (isLoading) return null;
  if (!isAdmin) return <Navigate to="/documents" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Routes>
                <Route path="/" element={<Navigate to="/documents" replace />} />
                <Route path="/documents" element={<DocumentList />} />
                <Route path="/documents/:id" element={<DocumentViewer />} />
                <Route path="/tests" element={<TestList />} />
                <Route path="/tests/:id" element={<TestRunner />} />
                <Route path="/tests/:id/results" element={<TestResults />} />
                <Route
                  path="/admin"
                  element={<AdminRoute><Dashboard /></AdminRoute>}
                />
                <Route
                  path="/admin/documents"
                  element={<AdminRoute><DocumentUpload /></AdminRoute>}
                />
                <Route
                  path="/admin/tests/:documentId"
                  element={<AdminRoute><QuestionEditor /></AdminRoute>}
                />
                <Route
                  path="/admin/users"
                  element={<AdminRoute><UserManagement /></AdminRoute>}
                />
                <Route
                  path="/admin/reports"
                  element={<AdminRoute><ComplianceReport /></AdminRoute>}
                />
              </Routes>
            </AppLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
