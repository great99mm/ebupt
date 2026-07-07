import { useLocation, useNavigate } from 'react-router-dom';
import { Archive, Building2, ClipboardList, Clapperboard, KeyRound, LogOut, PanelLeftClose, PanelLeftOpen, Settings2, UserRound } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '../store';
import { joinClasses } from '../utils';
import Modal from './Modal';

const tabs = [
  { path: '/hall', label: '大厅', icon: Building2 },
  { path: '/claims', label: '我的认领', icon: ClipboardList },
  { path: '/archives', label: '我的归档', icon: Archive },
  { path: '/settings', label: '设置', icon: Settings2, adminOnly: true },
];

export default function Shell({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, changePassword } = useApp();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '' });
  const [passwordError, setPasswordError] = useState('');

  const doLogout = async () => {
    await logout();
    navigate('/');
  };

  const visibleTabs = tabs.filter((tab) => !tab.adminOnly || user?.is_admin);

  return (
    <div className="min-h-screen text-slate-900">
      <aside className={joinClasses(
        'fixed inset-y-0 left-0 hidden flex-col border-r border-slate-200 bg-white/95 backdrop-blur transition-all md:flex',
        sidebarCollapsed ? 'w-20' : 'w-60',
      )}>
        <div className="border-b border-slate-100 px-3 py-3">
          <div className={joinClasses('flex items-center', sidebarCollapsed ? 'justify-center' : 'gap-3')}>
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-900 text-white shadow-sm">
              <Clapperboard className="h-4 w-4" />
            </div>
            <div className={sidebarCollapsed ? 'hidden' : ''}>
              <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-slate-500">Ebupteam</div>
              <div className="text-sm font-semibold leading-tight text-slate-900">认领面板</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-2 py-3">
          <div className="space-y-1">
            {visibleTabs.map(({ path, label, icon: Icon }) => {
              const active = location.pathname === path;
              return (
                <button
                  key={path}
                  type="button"
                  onClick={() => navigate(path)}
                  className={joinClasses(
                    'nav-item w-full',
                    sidebarCollapsed ? 'justify-center px-2' : '',
                    active ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                  )}
                  title={sidebarCollapsed ? label : undefined}
                >
                  <Icon className="h-4 w-4" />
                  <span className={sidebarCollapsed ? 'hidden' : ''}>{label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-slate-100 p-3">
          <div className={joinClasses('rounded-lg border border-slate-200 bg-slate-50 p-2.5', sidebarCollapsed ? 'space-y-2' : 'space-y-3')}>
            <div className={joinClasses('flex items-center', sidebarCollapsed ? 'justify-center' : 'gap-3')}>
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-900 text-xs font-semibold text-white">
                {(user?.username || 'U').slice(0, 1).toUpperCase()}
              </div>
              <div className={joinClasses('min-w-0 flex-1', sidebarCollapsed ? 'hidden' : '')}>
                <div className="truncate text-sm font-semibold text-slate-900">{user?.username || '用户'}</div>
                <div className="text-xs text-slate-500">{user?.is_admin ? '管理员' : '普通账号'}</div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await doLogout();
                }}
                className={joinClasses('btn-ghost btn-icon shrink-0', sidebarCollapsed ? 'hidden' : '')}
                title="退出"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>

            <div className={joinClasses('flex items-center gap-2', sidebarCollapsed ? 'justify-center' : '')}>
              <button
                type="button"
                onClick={() => setSidebarCollapsed((v) => !v)}
                className={joinClasses('btn-ghost btn-icon shrink-0', sidebarCollapsed ? 'mx-auto' : 'ml-auto')}
                title={sidebarCollapsed ? '展开侧栏' : '折叠侧栏'}
              >
                {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </aside>

      <div className={joinClasses('transition-all', sidebarCollapsed ? 'md:pl-20' : 'md:pl-60')}>
        <header className="sticky top-0 z-40 hidden border-b border-slate-200 bg-white/90 backdrop-blur md:block">
          <div className="flex h-14 items-center justify-between px-4 md:px-6">
            <div className="hidden md:block">
              <div className="text-sm font-medium text-slate-500">任务认领与归档</div>
            </div>
            <div className="hidden md:block" />
          </div>
        </header>

        <div className="fixed right-4 top-4 z-50 md:hidden">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white shadow-lg shadow-slate-900/15 ring-1 ring-white/80"
            onClick={() => setAccountOpen((v) => !v)}
            aria-label="账号菜单"
          >
            {(user?.username || 'U').slice(0, 1).toUpperCase()}
          </button>
          {accountOpen ? (
            <div className="absolute right-0 mt-2 w-52 rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
              <div className="px-3 py-2">
                <div className="truncate text-sm font-semibold text-slate-900">{user?.username || '用户'}</div>
                <div className="text-xs text-slate-500">{user?.is_admin ? '管理员' : '普通账号'}</div>
              </div>
              {user?.is_admin ? (
                <button type="button" className="nav-item w-full text-slate-700" onClick={() => { setAccountOpen(false); navigate('/settings'); }}>
                  <UserRound className="h-4 w-4" />
                  <span>个人资料</span>
                </button>
              ) : null}
              <button type="button" className="nav-item w-full text-slate-700" onClick={() => { setAccountOpen(false); setPasswordOpen(true); }}>
                <KeyRound className="h-4 w-4" />
                <span>修改密码</span>
              </button>
              <button type="button" className="nav-item w-full text-red-600 hover:bg-red-50" onClick={doLogout}>
                <LogOut className="h-4 w-4" />
                <span>退出登录</span>
              </button>
            </div>
          ) : null}
        </div>

        <main className="mx-auto max-w-7xl px-4 py-5 pb-24 md:px-6 md:pb-8">
          {children}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/96 backdrop-blur md:hidden">
        <div className={joinClasses('grid gap-1 px-2 py-2', visibleTabs.length === 3 ? 'grid-cols-3' : 'grid-cols-4')}>
          {visibleTabs.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path;
            return (
              <button
                key={path}
                type="button"
                onClick={() => {
                  setAccountOpen(false);
                  navigate(path);
                }}
                className={joinClasses(
                  'flex flex-col items-center justify-center gap-1 rounded-md px-2 py-2 text-xs font-semibold',
                  active ? 'bg-slate-900 text-white' : 'text-slate-500',
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {passwordOpen ? (
        <Modal
          title="修改密码"
          subtitle={user?.username || ''}
          onClose={() => setPasswordOpen(false)}
          footer={
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setPasswordOpen(false)}>取消</button>
              <button
                type="button"
                className="btn-primary"
                onClick={async () => {
                  setPasswordError('');
                  try {
                    await changePassword(passwordForm);
                    setPasswordForm({ current_password: '', new_password: '' });
                    setPasswordOpen(false);
                  } catch (err) {
                    setPasswordError(err.message || '修改失败');
                  }
                }}
              >
                保存
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            {passwordError ? <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">{passwordError}</div> : null}
            <div>
              <label className="field-label">当前密码</label>
              <input type="password" className="input" value={passwordForm.current_password} onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })} />
            </div>
            <div>
              <label className="field-label">新密码</label>
              <input type="password" className="input" value={passwordForm.new_password} onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })} />
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
