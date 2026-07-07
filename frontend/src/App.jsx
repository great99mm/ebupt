import { Navigate, Route, Routes } from 'react-router-dom';
import { useEffect } from 'react';
import { useApp } from './store';
import Shell from './components/Shell';
import Login from './pages/Login';
import Hall from './pages/Hall';
import Claims from './pages/Claims';
import Archives from './pages/Archives';
import Settings from './pages/Settings';

function GuardedApp() {
  const { token, booting, user } = useApp();

  if (booting && token) {
    return <div className="min-h-screen bg-slate-50" />;
  }

  if (!token) {
    return <Login />;
  }

  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Navigate to="/hall" replace />} />
        <Route path="/hall" element={<Hall />} />
        <Route path="/claims" element={<Claims />} />
        <Route path="/archives" element={<Archives />} />
        <Route path="/settings" element={user?.is_admin ? <Settings /> : <Navigate to="/hall" replace />} />
        <Route path="*" element={<Navigate to="/hall" replace />} />
      </Routes>
    </Shell>
  );
}

export default function App() {
  const { notice, setNotice } = useApp();

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 2200);
    return () => clearTimeout(timer);
  }, [notice, setNotice]);

  return (
    <>
      <GuardedApp />
      {notice ? (
        <div className="pointer-events-none fixed left-1/2 top-4 z-[70] -translate-x-1/2 rounded-md border border-primary-100 bg-white px-4 py-2 text-sm font-medium text-primary-700 shadow-card">
          {notice}
        </div>
      ) : null}
    </>
  );
}
