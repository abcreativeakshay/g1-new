import { Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { VoiceProvider } from './contexts/VoiceContext';
import { LoginPage } from './components/LoginPage';

const Dashboard = lazy(() => import('./components/Dashboard').then(module => ({ default: module.Dashboard })));

const AppContent = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return user ? (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-600 border-t-transparent"></div>
      </div>
    }>
      <Dashboard />
    </Suspense>
  ) : <LoginPage />;
};

function App() {
  return (
    <AuthProvider>
      <VoiceProvider>
        <AppContent />
      </VoiceProvider>
    </AuthProvider>
  );
}

export default App;
