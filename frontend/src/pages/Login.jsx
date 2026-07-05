import { useState } from 'react';
import { KeyRound, LogIn } from 'lucide-react';
import { useApp } from '../store';

export default function Login() {
  const { login } = useApp();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="card w-full max-w-md">
        <div className="card-body space-y-5">
          <div>
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary-600 text-white shadow-sm shadow-primary-200">
              <KeyRound className="h-5 w-5" />
            </div>
            <h1 className="mt-4 text-2xl font-bold text-slate-900">登录</h1>
            <p className="mt-1 text-sm text-slate-500">进入认领与维护面板</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="field-label">用户名</label>
              <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div>
              <label className="field-label">密码</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          </div>

          {error ? <div className="rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

          <button
            type="button"
            className="btn-primary w-full"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              setError('');
              try {
                await login(username, password);
              } catch (err) {
                setError(err.message || '登录失败');
              } finally {
                setLoading(false);
              }
            }}
          >
            <LogIn className="h-4 w-4" />
            {loading ? '登录中' : '登录'}
          </button>

          <div className="text-xs leading-5 text-slate-500">
            用户名为 <span className="font-semibold text-slate-700">admin</span>，密码以部署时生成的 `.env` 为准。
          </div>
        </div>
      </div>
    </div>
  );
}
