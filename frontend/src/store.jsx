import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { normalizeBrowseItems, normalizeCategories } from './utils';

const AppContext = createContext(null);

function toErrorMessage(err) {
  if (!err) return '请求失败';
  if (err.status === 401) return '登录已过期';
  return err.message || '请求失败';
}

export function AppProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('ebupteam_token') || '');
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [hall, setHall] = useState({ items: [], loading: false, error: '' });
  const [emby, setEmby] = useState({ items: [], loading: false, error: '' });
  const [claims, setClaims] = useState({ jobs: [], loading: false, error: '' });
  const [categories, setCategories] = useState({ items: [], loading: false, error: '' });
  const [settings, setSettings] = useState({ data: null, loading: false, error: '' });
  const [users, setUsers] = useState({ items: [], loading: false, error: '' });
  const [notice, setNotice] = useState('');
  const [wizardJobId, setWizardJobId] = useState(null);
  const [wizardSeedPath, setWizardSeedPath] = useState('');

  const clearSession = () => {
    localStorage.removeItem('ebupteam_token');
    setToken('');
    setUser(null);
    setHall({ items: [], loading: false, error: '' });
    setEmby({ items: [], loading: false, error: '' });
    setClaims({ jobs: [], loading: false, error: '' });
    setCategories({ items: [], loading: false, error: '' });
    setSettings({ data: null, loading: false, error: '' });
    setUsers({ items: [], loading: false, error: '' });
    setWizardJobId(null);
    setWizardSeedPath('');
  };

  const handleAuthError = (err) => {
    if (err?.status === 401) clearSession();
  };

  const loadMe = async (authToken = token) => {
    const data = await api('/api/me', {}, authToken);
    setUser(data.user || null);
    return data.user || null;
  };

  const loadSection = async (section, authToken = token) => {
    const setter = section === 'hall' ? setHall : setEmby;
    setter((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      const data = await api(`/api/source-items?section=${section}`, {}, authToken);
      setter({ items: data.items || [], loading: false, error: '' });
      return data.items || [];
    } catch (err) {
      handleAuthError(err);
      setter((prev) => ({ ...prev, loading: false, error: toErrorMessage(err) }));
      throw err;
    }
  };

  const loadClaims = async (authToken = token) => {
    setClaims((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      const data = await api('/api/my-claims', {}, authToken);
      setClaims({ jobs: data.jobs || [], loading: false, error: '' });
      return data.jobs || [];
    } catch (err) {
      handleAuthError(err);
      setClaims((prev) => ({ ...prev, loading: false, error: toErrorMessage(err) }));
      throw err;
    }
  };

  const loadCategories = async (authToken = token) => {
    setCategories((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      const data = await api('/api/categories', {}, authToken);
      setCategories({ items: normalizeCategories(data), loading: false, error: '' });
      return normalizeCategories(data);
    } catch (err) {
      handleAuthError(err);
      setCategories((prev) => ({ ...prev, loading: false, error: toErrorMessage(err) }));
      throw err;
    }
  };

  const loadSettings = async (authToken = token) => {
    setSettings((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      const data = await api('/api/settings', {}, authToken);
      setSettings({ data, loading: false, error: '' });
      return data;
    } catch (err) {
      handleAuthError(err);
      setSettings((prev) => ({ ...prev, loading: false, error: toErrorMessage(err) }));
      throw err;
    }
  };

  const loadUsers = async (authToken = token) => {
    setUsers((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      const data = await api('/api/users', {}, authToken);
      setUsers({ items: data.users || [], loading: false, error: '' });
      return data.users || [];
    } catch (err) {
      handleAuthError(err);
      setUsers((prev) => ({ ...prev, loading: false, error: toErrorMessage(err) }));
      throw err;
    }
  };

  const bootstrap = async (authToken = token) => {
    if (!authToken) {
      setBooting(false);
      return;
    }
    setBooting(true);
    try {
      const me = await loadMe(authToken);
      await Promise.all([loadSection('hall', authToken), loadSection('emby', authToken), loadClaims(authToken), loadCategories(authToken)]);
      if (me?.is_admin) await Promise.all([loadSettings(authToken), loadUsers(authToken)]);
      setNotice('');
    } catch (err) {
      if (err?.status === 401) {
        clearSession();
      }
    } finally {
      setBooting(false);
    }
  };

  useEffect(() => {
    bootstrap(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const login = async (username, password) => {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    localStorage.setItem('ebupteam_token', data.token);
    setToken(data.token);
    setUser(data.user || null);
    setNotice('登录成功');
    return data.user || null;
  };

  const logout = async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' }, token);
    } catch {
      // ignore
    }
    clearSession();
  };

  const claimItem = async (item, section) => {
    const data = await api(`/api/source-items/${item.id}/claim`, { method: 'POST' }, token);
    setNotice('已创建认领');
    await Promise.all([loadClaims(), loadSection(section || item.source || 'hall')]);
    setWizardJobId(data.job_id);
    return data;
  };

  const releaseJob = async (jobId) => {
    await api(`/api/jobs/${jobId}/release`, { method: 'POST' }, token);
    setNotice('已释放');
    await Promise.all([loadClaims(), loadSection('hall'), loadSection('emby')]);
  };

  const loadBrowse = async (path) => {
    const qs = new URLSearchParams({ path });
    const data = await api(`/api/openlist/browse?${qs.toString()}`, {}, token);
    return normalizeBrowseItems(data);
  };

  const selectJob = async (jobId, payload) => {
    const data = await api(`/api/jobs/${jobId}/select`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token);
    setWizardSeedPath(payload.path || '');
    await loadClaims();
    return data;
  };

  const submitJob = async (jobId, payload) => {
    const data = await api(`/api/jobs/${jobId}/submit`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token);
    setNotice('已提交');
    await Promise.all([loadClaims(), loadSection('hall'), loadSection('emby')]);
    return data;
  };

  const saveSettings = async (payload) => {
    const data = await api('/api/settings', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token);
    setSettings({ data, loading: false, error: '' });
    setNotice('设置已保存');
    return data;
  };

  const changePassword = async (payload) => api('/api/me/password', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);

  const createUser = async (payload) => {
    const data = await api('/api/users', { method: 'POST', body: JSON.stringify(payload) }, token);
    await loadUsers();
    return data.user;
  };

  const updateUser = async (id, payload) => {
    const data = await api(`/api/users/${id}`, { method: 'POST', body: JSON.stringify(payload) }, token);
    await loadUsers();
    return data.user;
  };

  const deleteUser = async (id) => {
    await api(`/api/users/${id}/delete`, { method: 'POST' }, token);
    await loadUsers();
  };

  const refreshEmby = async () => {
    const data = await api('/api/emby/refresh', { method: 'POST' }, token);
    await loadSection('emby');
    return data;
  };

  const compareJob = async (jobId) => {
    await refreshEmby();
    const data = await api(`/api/jobs/${jobId}/compare`, { method: 'POST' }, token);
    await loadClaims();
    return data.compare;
  };

  const archiveJob = async (jobId) => {
    const data = await api(`/api/jobs/${jobId}/archive`, { method: 'POST' }, token);
    setNotice('已归档');
    await Promise.all([loadClaims(), loadSection('hall'), loadSection('emby')]);
    return data;
  };

  const value = useMemo(() => ({
    token,
    user,
    booting,
    hall,
    emby,
    claims,
    categories,
    settings,
    users,
    notice,
    setNotice,
    wizardJobId,
    setWizardJobId,
    wizardSeedPath,
    setWizardSeedPath,
    login,
    logout,
    bootstrap,
    loadSection,
    loadClaims,
    loadCategories,
    loadSettings,
    loadUsers,
    loadBrowse,
    claimItem,
    releaseJob,
    selectJob,
    submitJob,
    saveSettings,
    changePassword,
    createUser,
    updateUser,
    deleteUser,
    refreshEmby,
    compareJob,
    archiveJob,
  }), [token, user, booting, hall, emby, claims, categories, settings, users, notice, wizardJobId, wizardSeedPath]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
