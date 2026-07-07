import { useEffect, useState } from 'react';
import { Plus, RefreshCw, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { useApp } from '../store';

function Field({ label, children, hint }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <label className="field-label">{label}</label>
      {children}
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}

function UserManager() {
  const { user, users, loadUsers, createUser, updateUser, deleteUser } = useApp();
  const [activeId, setActiveId] = useState('new');
  const [form, setForm] = useState({ username: '', password: '', is_admin: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!users.items.length && !users.loading) loadUsers().catch(() => {});
  }, []);

  useEffect(() => {
    if (activeId === 'new') {
      setForm({ username: '', password: '', is_admin: false });
      return;
    }
    const row = users.items.find((item) => item.id === activeId);
    if (row) setForm({ username: row.username || '', password: '', is_admin: Boolean(row.is_admin) });
  }, [activeId, users.items]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = { username: form.username, is_admin: form.is_admin, visible_roots: [] };
      if (form.password) payload.password = form.password;
      if (activeId === 'new') {
        await createUser(payload);
        setActiveId('new');
      } else {
        await updateUser(activeId, payload);
      }
    } catch (err) {
      setError(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <div className="card-body space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-bold text-slate-900">用户</div>
            <div className="mt-1 text-sm text-slate-500">管理可登录账号和管理员权限。</div>
          </div>
          <button type="button" className="btn-secondary btn-sm" onClick={() => { setActiveId('new'); setError(''); }}>
            <Plus className="h-4 w-4" />
            新用户
          </button>
        </div>

        {error || users.error ? <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error || users.error}</div> : null}

        <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
            <button type="button" className={activeId === 'new' ? 'nav-item w-full bg-slate-900 text-white' : 'nav-item w-full text-slate-600'} onClick={() => setActiveId('new')}>新建用户</button>
            {users.items.map((row) => (
              <button key={row.id} type="button" className={activeId === row.id ? 'nav-item w-full bg-slate-900 text-white' : 'nav-item w-full text-slate-600'} onClick={() => setActiveId(row.id)}>
                <span className="truncate">{row.username}</span>
                <span className="ml-auto text-xs opacity-70">{row.is_admin ? '管理员' : '用户'}</span>
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <Field label="用户名">
              <input className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </Field>
            <Field label={activeId === 'new' ? '初始密码' : '新密码'} hint={activeId === 'new' ? '' : '留空表示不改'}>
              <input type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </Field>
            <Field label="权限">
              <label className="flex h-10 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={form.is_admin} onChange={(e) => setForm({ ...form, is_admin: e.target.checked })} />
                管理员
              </label>
            </Field>
            <div className="flex flex-wrap justify-between gap-2">
              <button type="button" className="btn-primary" disabled={saving} onClick={save}>{saving ? '保存中' : '保存用户'}</button>
              {activeId !== 'new' && activeId !== user?.id ? (
                <button type="button" className="btn-destructive" onClick={() => deleteUser(activeId).then(() => setActiveId('new')).catch((err) => setError(err.message || '删除失败'))}>
                  <Trash2 className="h-4 w-4" />
                  删除用户
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Settings() {
  const { user, settings, loadSettings, saveSettings, refreshEmby } = useApp();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [localWebhook, setLocalWebhook] = useState(() => localStorage.getItem('ebupteam_webhook_token') || '');

  useEffect(() => {
    if (!user?.is_admin) return;
    if (!settings.data && !settings.loading) loadSettings().catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!settings.data) return;
    setForm({
      emby_url: settings.data.emby_url || '',
      emby_api_key: '',
    });
  }, [settings.data]);

  const submit = async () => {
    setSaving(true);
    try {
      await saveSettings({
        emby_url: form.emby_url || null,
        emby_api_key: form.emby_api_key || null,
      });
    } finally {
      setSaving(false);
    }
  };

  if (!user?.is_admin) {
    return (
      <div className="card p-8">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-primary-600" />
          <div>
            <div className="text-lg font-bold text-slate-900">设置</div>
            <div className="mt-1 text-sm text-slate-500">当前账号没有管理权限。</div>
          </div>
        </div>
      </div>
    );
  }

  if (!form) return <div className="card p-8 text-sm text-slate-500">加载中...</div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-2xl font-bold text-slate-900">设置</div>
          <p className="mt-1 text-sm text-slate-500">管理媒体库比对和账号</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" onClick={() => refreshEmby()}>
            <RefreshCw className="h-4 w-4" />
            刷新媒体库
          </button>
          <button type="button" className="btn-primary" disabled={saving} onClick={submit}>
            <Save className="h-4 w-4" />
            {saving ? '保存中' : '保存'}
          </button>
        </div>
      </div>

      {settings.error ? <div className="rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700">{settings.error}</div> : null}

      <div className="space-y-4">
        <div className="card">
          <div className="card-body space-y-4">
            <div className="text-lg font-bold text-slate-900">媒体库</div>
            <Field label="Emby URL" hint="用于刷新媒体库并比对入库状态">
              <input className="input" value={form.emby_url} onChange={(e) => setForm({ ...form, emby_url: e.target.value })} />
            </Field>
            <Field label="Emby API Key" hint="留空表示不改动">
              <input type="password" className="input" value={form.emby_api_key} onChange={(e) => setForm({ ...form, emby_api_key: e.target.value })} />
            </Field>
            <Field label="Webhook Token（本地）" hint="仅保存在浏览器，不提交到后端；真实 token 可从容器日志或环境变量查看">
              <input
                type="password"
                className="input"
                value={localWebhook}
                onChange={(e) => {
                  setLocalWebhook(e.target.value);
                  localStorage.setItem('ebupteam_webhook_token', e.target.value);
                }}
              />
            </Field>
          </div>
        </div>

        <UserManager />
      </div>
    </div>
  );
}
