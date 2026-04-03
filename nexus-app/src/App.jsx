import { lazy, Suspense } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AppProvider } from './store/appStore';
import ErrorBoundary, { RouteErrorBoundary } from './components/ErrorBoundary';
import Layout from './components/Layout';
import SEOHead from './components/SEOHead';
import Landing from './pages/Landing';
import { PUBLIC_ROUTES } from './config/routes';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const GlobalPulse = lazy(() => import('./pages/GlobalPulse'));
const Projects = lazy(() => import('./pages/Projects'));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'));
const Milestones = lazy(() => import('./pages/Milestones'));
const Proposals = lazy(() => import('./pages/Proposals'));
const Verification = lazy(() => import('./pages/Verification'));
const Reputation = lazy(() => import('./pages/Reputation'));
const Assets = lazy(() => import('./pages/Assets'));
const AgentEconomy = lazy(() => import('./pages/AgentEconomy'));
const AgentsLanding = lazy(() => import('./pages/AgentsLanding'));
const BuildersLanding = lazy(() => import('./pages/BuildersLanding'));
const NgoLanding = lazy(() => import('./pages/NgoLanding'));
const EnterpriseLanding = lazy(() => import('./pages/EnterpriseLanding'));
const CitiesLanding = lazy(() => import('./pages/CitiesLanding'));
const NexusAI = lazy(() => import('./pages/NexusAI'));
const FeatureKits = lazy(() => import('./pages/FeatureKits'));
const AgentReadiness = lazy(() => import('./pages/AgentReadiness'));
const AgentMessages = lazy(() => import('./pages/AgentMessages'));
const OwnerDashboard = lazy(() => import('./pages/OwnerDashboard'));
const CommerceBlackhole = lazy(() => import('./pages/CommerceBlackhole'));

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
    <ErrorBoundary>
    <AppProvider>
      <SEOHead />
      <AppShell>
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">Loading...</div>}>
        <Routes>
          {/* Public landing pages — no shell */}
          <Route path="/" element={<Landing />} />
          <Route path="/pulse" element={<GlobalPulse />} />
          <Route path="/agents" element={<AgentsLanding />} />
          <Route path="/builders" element={<BuildersLanding />} />
          <Route path="/ngo" element={<NgoLanding />} />
          <Route path="/enterprise" element={<EnterpriseLanding />} />
          <Route path="/cities" element={<CitiesLanding />} />

          {/* App shell routes — each wrapped in RouteErrorBoundary so one page crash doesn't kill the app */}
          <Route path="/dashboard" element={<RouteErrorBoundary><Dashboard /></RouteErrorBoundary>} />
          <Route path="/projects" element={<RouteErrorBoundary><Projects /></RouteErrorBoundary>} />
          <Route path="/projects/:id" element={<RouteErrorBoundary><ProjectDetail /></RouteErrorBoundary>} />
          <Route path="/milestones" element={<RouteErrorBoundary><Milestones /></RouteErrorBoundary>} />
          <Route path="/proposals" element={<RouteErrorBoundary><Proposals /></RouteErrorBoundary>} />
          <Route path="/verification" element={<RouteErrorBoundary><Verification /></RouteErrorBoundary>} />
          <Route path="/reputation" element={<RouteErrorBoundary><Reputation /></RouteErrorBoundary>} />
          <Route path="/assets" element={<RouteErrorBoundary><Assets /></RouteErrorBoundary>} />
          <Route path="/agent-economy" element={<RouteErrorBoundary><AgentEconomy /></RouteErrorBoundary>} />
          <Route path="/nexus-ai" element={<RouteErrorBoundary><NexusAI /></RouteErrorBoundary>} />
          <Route path="/feature-kits" element={<RouteErrorBoundary><FeatureKits /></RouteErrorBoundary>} />
          <Route path="/agent-readiness" element={<RouteErrorBoundary><AgentReadiness /></RouteErrorBoundary>} />
          <Route path="/messages" element={<RouteErrorBoundary><AgentMessages /></RouteErrorBoundary>} />
          <Route path="/owner-dashboard" element={<RouteErrorBoundary><OwnerDashboard /></RouteErrorBoundary>} />
          <Route path="/commerce-blackhole" element={<RouteErrorBoundary><CommerceBlackhole /></RouteErrorBoundary>} />
        </Routes>
        </Suspense>
      </AppShell>
    </AppProvider>
    </ErrorBoundary>
  );
}
