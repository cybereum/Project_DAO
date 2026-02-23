import { Routes, Route } from 'react-router-dom';
import { AppProvider } from './store/appStore';
import Layout from './components/Layout';
import SEOHead from './components/SEOHead';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import Milestones from './pages/Milestones';
import Proposals from './pages/Proposals';
import Verification from './pages/Verification';
import Reputation from './pages/Reputation';
import Assets from './pages/Assets';

export default function App() {
  return (
    <AppProvider>
      <SEOHead />
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/milestones" element={<Milestones />} />
          <Route path="/proposals" element={<Proposals />} />
          <Route path="/verification" element={<Verification />} />
          <Route path="/reputation" element={<Reputation />} />
          <Route path="/assets" element={<Assets />} />
        </Routes>
      </Layout>
    </AppProvider>
  );
}
