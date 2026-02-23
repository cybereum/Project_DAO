import { Routes, Route, useLocation } from 'react-router-dom';
import { AppProvider } from './store/appStore';
import Layout from './components/Layout';
import SEOHead from './components/SEOHead';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import GlobalPulse from './pages/GlobalPulse';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import Milestones from './pages/Milestones';
import Proposals from './pages/Proposals';
import Verification from './pages/Verification';
import Reputation from './pages/Reputation';
import Assets from './pages/Assets';

// Routes that render without the app shell (sidebar/topbar)
const PUBLIC_ROUTES = ['/', '/pulse'];

function AppShell({ children }) {
  const location = useLocation();
  const isPublic = PUBLIC_ROUTES.includes(location.pathname);

  if (isPublic) {
    return <>{children}</>;
  }

  return (
    <Layout>
      {children}
    </Layout>
  );
}

export default function App() {
  return (
    <AppProvider>
      <SEOHead />
      <AppShell>
        <Routes>
          {/* Public landing page — no shell */}
          <Route path="/" element={<Landing />} />
          <Route path="/pulse" element={<GlobalPulse />} />

          {/* App shell routes */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/milestones" element={<Milestones />} />
          <Route path="/proposals" element={<Proposals />} />
          <Route path="/verification" element={<Verification />} />
          <Route path="/reputation" element={<Reputation />} />
          <Route path="/assets" element={<Assets />} />
        </Routes>
      </AppShell>
    </AppProvider>
  );
}
