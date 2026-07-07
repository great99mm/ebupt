import { useEffect, useMemo, useState } from 'react';
import { FolderHeart, RefreshCw, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../store';
import MediaCardGrid from '../components/media/MediaCardGrid';
import MediaPosterCard from '../components/media/MediaPosterCard';
import DetailModal from '../components/DetailModal';

export default function Hall() {
  const { hall, loadSection, claimItem, claims } = useApp();
  const [activeItem, setActiveItem] = useState(null);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!hall.items.length && !hall.loading) loadSection('hall').catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return hall.items;
    return hall.items.filter((item) => [item.title, item.media_type, item.source].filter(Boolean).join(' ').toLowerCase().includes(q));
  }, [hall.items, search]);

  const currentJob = useMemo(
    () => (activeItem ? claims.jobs.find((job) => job.source_item_id === activeItem.id) || null : null),
    [activeItem, claims.jobs],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-2xl font-bold text-slate-900">大厅</div>
          <p className="mt-1 text-sm text-slate-500">浏览待认领内容</p>
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
            onClick={() => loadSection('hall')}
            title="刷新大厅"
            aria-label="刷新大厅"
            disabled={hall.loading}
          >
            <RefreshCw className={hall.loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          </button>
        </div>
      </div>

      {hall.error ? <div className="rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700">{hall.error}</div> : null}

      <MediaCardGrid>
        {filtered.map((item) => (
          <MediaPosterCard
            key={item.id}
            item={item}
            statusLabel="可认领"
            statusClass="bg-emerald-50 text-emerald-700 ring-emerald-100"
            subtitle="待认领"
            onClick={() => setActiveItem(item)}
          />
        ))}
      </MediaCardGrid>

      {!filtered.length && !hall.loading ? (
        <div className="card p-10 text-center text-sm text-slate-500">
          <FolderHeart className="mx-auto h-8 w-8 text-primary-500" />
          <div className="mt-3 font-semibold text-slate-900">没有内容</div>
          <div className="mt-1">Webhook 创建的新任务会出现在这里。</div>
        </div>
      ) : null}

      {activeItem ? (
        <DetailModal
          item={activeItem}
          section="hall"
          claimLabel={currentJob ? '继续处理' : '我要认领'}
          onClose={() => setActiveItem(null)}
          onClaim={async () => {
            if (currentJob) {
              navigate('/claims');
              setActiveItem(null);
              return;
            }
            await claimItem(activeItem, 'hall');
            setActiveItem(null);
            navigate('/claims');
          }}
          locked={!activeItem.available}
          job={currentJob}
        />
      ) : null}
    </div>
  );
}
