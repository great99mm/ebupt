import { useEffect, useMemo, useState } from 'react';
import { Clapperboard, LockKeyhole, RefreshCw, Search, ShieldAlert } from 'lucide-react';
import { useApp } from '../store';
import MediaCardGrid from '../components/media/MediaCardGrid';
import MediaPosterCard from '../components/media/MediaPosterCard';
import DetailModal from '../components/DetailModal';
import { useNavigate } from 'react-router-dom';

export default function Emby() {
  const { emby, loadSection, claimItem, claims } = useApp();
  const [activeItem, setActiveItem] = useState(null);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!emby.items.length && !emby.loading) loadSection('emby').catch(() => {});
  }, []);

  const jobMap = useMemo(() => new Map(claims.jobs.map((job) => [job.source_item_id, job])), [claims.jobs]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return emby.items;
    return emby.items.filter((item) => [item.title, item.media_type, item.source].filter(Boolean).join(' ').toLowerCase().includes(q));
  }, [emby.items, search]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-2xl font-bold text-slate-900">Emby</div>
          <p className="mt-1 text-sm text-slate-500">带锁状态的维护列表</p>
        </div>
        <div className="flex w-full items-end gap-2 md:w-auto">
          <div className="min-w-0 flex-1 md:w-80 md:flex-none">
            <label className="field-label">搜索</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className="input pl-9" placeholder="标题、类型" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <button
            type="button"
            className="btn-ghost btn-icon mb-0.5 shrink-0"
            onClick={() => loadSection('emby')}
            title="刷新 Emby"
            aria-label="刷新 Emby"
            disabled={emby.loading}
          >
            <RefreshCw className={emby.loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          </button>
        </div>
      </div>

      {emby.error ? <div className="rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700">{emby.error}</div> : null}

      <MediaCardGrid>
        {filtered.map((item) => {
          const job = jobMap.get(item.id);
          const locked = !item.available || Boolean(job);
          return (
            <MediaPosterCard
              key={item.id}
              item={item}
              statusLabel={job ? '维护中' : locked ? '已锁定' : '可维护'}
              statusClass={job ? 'bg-blue-50 text-blue-700 ring-blue-100' : locked ? 'bg-amber-50 text-amber-700 ring-amber-100' : 'bg-emerald-50 text-emerald-700 ring-emerald-100'}
              subtitle={job ? '处理中' : locked ? '暂不可用' : '待维护'}
              onClick={() => setActiveItem(item)}
              selected={job?.id && activeItem?.id === item.id}
            />
          );
        })}
      </MediaCardGrid>

      {!filtered.length && !emby.loading ? (
        <div className="card p-10 text-center text-sm text-slate-500">
          <Clapperboard className="mx-auto h-8 w-8 text-primary-500" />
          <div className="mt-3 font-semibold text-slate-900">没有 Emby 内容</div>
          <div className="mt-1">先执行刷新，或检查后端同步配置。</div>
        </div>
      ) : null}

      {activeItem ? (
        <DetailModal
          item={activeItem}
          section="emby"
          claimLabel={jobMap.get(activeItem.id) ? '继续维护' : '我要维护'}
          onClose={() => setActiveItem(null)}
          onClaim={async () => {
            if (jobMap.get(activeItem.id)) {
              navigate('/claims');
              setActiveItem(null);
              return;
            }
            await claimItem(activeItem, 'emby');
            setActiveItem(null);
            navigate('/claims');
          }}
          locked={!activeItem.available}
          job={jobMap.get(activeItem.id)}
        />
      ) : null}
    </div>
  );
}
