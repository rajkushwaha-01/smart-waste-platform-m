import { Navigate, Route, Routes } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage.jsx';
import BinsPage from './pages/BinsPage.jsx';
import BinDetailPage from './pages/BinDetailPage.jsx';
import CollectionPage from './pages/CollectionPage.jsx';
import AlertsPage from './pages/AlertsPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/bins" element={<BinsPage />} />
      <Route path="/bins/:binId" element={<BinDetailPage />} />
      <Route path="/collection" element={<CollectionPage />} />
      <Route path="/alerts" element={<AlertsPage />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
