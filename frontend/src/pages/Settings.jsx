import { useEffect, useMemo, useState } from 'react';
import { FolderOpen, Plus, RefreshCw, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { useApp } from '../store';
import { mappingsToText, rootsToText, textToMapping, textToRoots, textListToArray } from '../utils';
import BrowsePicker from '../components/BrowsePicker';

function Field({ label, children, hint }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <label className="field-label">{label}</label>
      {children}
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}

function UserManager({ globalRoots }) {
  const { user, users, loadUsers, createUser, updateUser, deleteUser } = useApp();
  const [activeId, setActiveId] = useState('new');
  const [form, setForm] = useState({ username: '', password: '', is_admin: false, visible_roots: [] });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!users.items.length && !users.loading) loadUsers().catch(() => {});
  }, []);

  useEffect(() => {
    if (activeId === 'new') {
      setForm({ username: '', password: '', is_admin: false, visible_roots: [] });
      return;
    }
    const row = users.items.find((item) => item.id === activeId);
    if (row) setForm({ username: row.username || '', password: '', is_admin: Boolean(row.is_admin), visible_roots: Array.isArray(row.visible_roots) ? row.visible_roots : [] });
  }, [activeId, users.items]);

  const addRoot = (path) => {
    const exists = form.visible_roots.some((root) => root.path === path);
    if (exists) return;
    const id = path.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'root';
    setForm({ ...form, visible_roots: [...form.visible_roots, { id, path }] });
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = { username: form.username, is_admin: form.is_admin, visible_roots: form.visible_roots };
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
    <div className="card lg:col-span-2">
      <div className="card-body space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-bold text-slate-900">用户与可见库</div>
            <div className="mt-1 text-sm text-slate-500">为空时使用全局可见根目录；设置后只允许访问指定目录。</div>
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

          <div className="space-y-4">
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
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label className="field-label mb-0">可见范围</label>
                <button type="button" className="btn-secondary btn-sm" onClick={() => setPickerOpen(true)}>
                  <FolderOpen className="h-4 w-4" />
                  选择路径
                </button>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-2">
                {form.visible_roots.length ? form.visible_roots.map((root, index) => (
                  <div key={`${root.path}-${index}`} className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-slate-50">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-slate-900">{root.id}</div>
                      <div className="truncate font-mono text-xs text-slate-500">{root.path}</div>
                    </div>
                    <button type="button" className="btn-ghost btn-icon-sm text-red-600" onClick={() => setForm({ ...form, visible_roots: form.visible_roots.filter((_, i) => i !== index) })}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )) : <div className="px-2 py-6 text-center text-sm text-slate-500">使用全局可见根目录。</div>}
              </div>
            </div>

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

      <BrowsePicker
        open={pickerOpen}
        job={{ title: '选择用户可见目录' }}
        roots={globalRoots.length ? globalRoots : [{ id: 'root', path: '/' }]}
        onClose={() => setPickerOpen(false)}
        onPicked={async (item) => {
          addRoot(item.path);
          setPickerOpen(false);
        }}
      />
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
    const data = settings.data;
    setForm({
      emby_url: data.emby_url || '',
      emby_api_key: '',
      tmdb_api_key: '',
      openlist_url: data.openlist_url || '',
      openlist_token: '',
      visible_roots: rootsToText(data.visible_roots),
      categories: textListToArray(data.categories).join('\n'),
      manager_url: data.manager_url || '',
      manager_token: '',
      rclone_source_prefix: data.rclone_source_prefix || '',
      destination_mappings: mappingsToText(data.destination_mappings),
      transfer_mode: data.transfer_mode || 'copy',
    });
  }, [settings.data]);

  const submit = async () => {
    setSaving(true);
    try {
      await saveSettings({
        emby_url: form.emby_url || null,
        emby_api_key: form.emby_api_key || null,
        tmdb_api_key: form.tmdb_api_key || null,
        openlist_url: form.openlist_url || null,
        openlist_token: form.openlist_token || null,
        visible_roots: textToRoots(form.visible_roots),
        categories: textListToArray(form.categories),
        manager_url: form.manager_url || null,
        manager_token: form.manager_token || null,
        rclone_source_prefix: form.rclone_source_prefix ?? '',
        destination_mappings: textToMapping(form.destination_mappings),
        transfer_mode: form.transfer_mode || 'copy',
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

  if (!form) {
    return <div className="card p-8 text-sm text-slate-500">加载中...</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-2xl font-bold text-slate-900">设置</div>
          <p className="mt-1 text-sm text-slate-500">管理 OpenList、Emby 与任务转存参数</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" onClick={() => refreshEmby()}>
            <RefreshCw className="h-4 w-4" />
            刷新 Emby
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
            <div className="text-lg font-bold text-slate-900">OpenList / 管理器</div>
            <Field label="OpenList URL" hint="用于浏览和选择路径">
              <input className="input" value={form.openlist_url} onChange={(e) => setForm({ ...form, openlist_url: e.target.value })} />
            </Field>
            <Field label="OpenList Token" hint="密码字段，留空表示不改动">
              <input type="password" className="input" value={form.openlist_token} onChange={(e) => setForm({ ...form, openlist_token: e.target.value })} />
            </Field>
            <Field label="可见根目录" hint="每行一个，格式 id=/path">
              <textarea className="textarea font-mono text-sm" value={form.visible_roots} onChange={(e) => setForm({ ...form, visible_roots: e.target.value })} />
            </Field>
            <Field label="管理器 URL" hint="提交任务的目标服务">
              <input className="input" value={form.manager_url} onChange={(e) => setForm({ ...form, manager_url: e.target.value })} />
            </Field>
            <Field label="管理器 Token" hint="密码字段，留空表示不改动">
              <input type="password" className="input" value={form.manager_token} onChange={(e) => setForm({ ...form, manager_token: e.target.value })} />
            </Field>
            <Field label="转存前缀" hint="拼接在源路径前">
              <input className="input" value={form.rclone_source_prefix} onChange={(e) => setForm({ ...form, rclone_source_prefix: e.target.value })} />
            </Field>
            <Field label="转存模式" hint="copy 或 move">
              <select className="select" value={form.transfer_mode} onChange={(e) => setForm({ ...form, transfer_mode: e.target.value })}>
                <option value="copy">copy</option>
                <option value="move">move</option>
              </select>
            </Field>
          </div>
        </div>

        <div className="card">
          <div className="card-body space-y-4">
            <div className="text-lg font-bold text-slate-900">媒体与分类</div>
            <Field label="Emby URL" hint="用于同步库信息">
              <input className="input" value={form.emby_url} onChange={(e) => setForm({ ...form, emby_url: e.target.value })} />
            </Field>
            <Field label="Emby API Key" hint="密码字段，留空表示不改动">
              <input type="password" className="input" value={form.emby_api_key} onChange={(e) => setForm({ ...form, emby_api_key: e.target.value })} />
            </Field>
            <Field label="TMDB API Key" hint="密码字段，留空表示不改动">
              <input type="password" className="input" value={form.tmdb_api_key} onChange={(e) => setForm({ ...form, tmdb_api_key: e.target.value })} />
            </Field>
            <Field label="分类列表" hint="每行一个分类名">
              <textarea className="textarea font-mono text-sm" value={form.categories} onChange={(e) => setForm({ ...form, categories: e.target.value })} />
            </Field>
            <Field label="分类映射" hint="每行一个，格式 分类=/dest/path">
              <textarea className="textarea font-mono text-sm" value={form.destination_mappings} onChange={(e) => setForm({ ...form, destination_mappings: e.target.value })} />
            </Field>
            <Field label="Webhook Token（本地）" hint="仅保存在浏览器，不提交到后端">
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

        <UserManager globalRoots={textToRoots(form.visible_roots)} />
      </div>
    </div>
  );
}
