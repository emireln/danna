import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AppShell } from './components/Shell';
import { Notice } from './components/ui';
import { AuthProvider, useAuth } from './state/auth';
import { AIProvider } from './state/ai';
import { AppDataProvider, useAppData } from './state/appData';
import { ToastProvider } from './state/toast';
import { Splash } from './screens/Splash';
import { AuthScreen } from './screens/AuthScreen';
import { SetupScreen } from './screens/SetupScreen';
import { TodayScreen } from './screens/TodayScreen';
import { RoadmapScreen } from './screens/RoadmapScreen';
import { StudyScreen, StudySectionScreen } from './screens/StudyScreen';
import { ReviewScreen } from './screens/ReviewScreen';
import { CoachScreen } from './screens/CoachScreen';
import { RunnerScreen } from './screens/RunnerScreen';
import { ReportScreen } from './screens/ReportScreen';
import { FriendsScreen } from './screens/FriendsScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { WhatsNewScreen } from './screens/WhatsNewScreen';

function RequireSignedIn({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <Splash />;
  if (status === 'out') return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

function ProfileProblem({ message }: { message: string }) {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  return (
    <div className="auth">
      <div className="auth__card">
        <Notice tone="error">{message}</Notice>
        <p className="small muted">
          If this is a new Supabase project, run supabase/schema.sql in the SQL editor, then sign in again.
        </p>
        <button
          className="btn btn--ghost btn--block"
          onClick={async () => {
            await signOut();
            navigate('/auth', { replace: true });
          }}
        >
          Back to sign in
        </button>
      </div>
    </div>
  );
}

function RequireSetup({ children }: { children: ReactNode }) {
  const { ready, profile, loadError } = useAppData();
  if (!ready) return <Splash />;
  if (!profile) return <ProfileProblem message={loadError ?? 'Your profile could not be loaded.'} />;
  if (!profile.onboarding_done) return <Navigate to="/setup" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthScreen />} />
      <Route
        path="/setup"
        element={
          <RequireSignedIn>
            <SetupScreen />
          </RequireSignedIn>
        }
      />
      <Route
        path="/play/diagnostic"
        element={
          <RequireSignedIn>
            <RequireSetup>
              <RunnerScreen />
            </RequireSetup>
          </RequireSignedIn>
        }
      />
      <Route
        path="/play/review"
        element={
          <RequireSignedIn>
            <RequireSetup>
              <RunnerScreen />
            </RequireSetup>
          </RequireSignedIn>
        }
      />
      <Route
        path="/play/:kind/:id"
        element={
          <RequireSignedIn>
            <RequireSetup>
              <RunnerScreen />
            </RequireSetup>
          </RequireSignedIn>
        }
      />
      <Route
        element={
          <RequireSignedIn>
            <RequireSetup>
              <AppShell />
            </RequireSetup>
          </RequireSignedIn>
        }
      >
        <Route index element={<TodayScreen />} />
        <Route path="roadmap" element={<RoadmapScreen />} />
        <Route path="study" element={<StudyScreen />} />
        <Route path="study/:skill" element={<StudySectionScreen />} />
        <Route path="review" element={<ReviewScreen />} />
        <Route path="coach" element={<CoachScreen />} />
        <Route path="report/:id" element={<ReportScreen />} />
        <Route path="friends" element={<FriendsScreen />} />
        <Route path="profile" element={<ProfileScreen />} />
        <Route path="settings" element={<SettingsScreen />} />
        <Route path="whats-new" element={<WhatsNewScreen />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AIProvider>
          <AppDataProvider>
            <AppRoutes />
          </AppDataProvider>
        </AIProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
