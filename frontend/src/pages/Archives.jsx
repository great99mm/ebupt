import { useEffect, useState } from 'react';
import { Archive, RefreshCw } from 'lucide-react';
import { useApp } from '../store';
import MediaCardGrid from '../components/media/MediaCardGrid';
import MediaPosterCard from '../components/media/MediaPosterCard';
import Modal from '../components/Modal';
import { formatDateTime } from '../utils';

export default function Archives() {
  const { archives, loadArchives } = useApp();
  const [activeJob, setActiveJob] = useState(null);

  useEffect(() => {
    if (!archives.jobs.length && !archives.loading) loadArchives().catch(() => {});
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-2xl font-bold text-slate-900">我的归档</div>
          <p className="mt-1 text-sm text-slate-500">已完成入库比对并归档的任务</p>
        </div>
        <button type="button" className="btn-ghost btn-icon mt-0.5 shrink-0" onClick={() => loadArchives()} title="刷新归档" aria-label="刷新归档" disabled={archives.loading}>
          <RefreshCw className={archives.loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
        </button>
      </div>

      {archives.error ? <div className="rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700">{archives.error}</div> : null}

      <MediaCardGrid>
        {archives.jobs.map((job) => (
          <MediaPosterCard
            key={job.id}
            item={job}
            statusLabel="已归档"
            statusClass="bg-emerald-50 text-emerald-700 ring-emerald-100"
            subtitle={job.archived_at ? formatDateTime(job.archived_at) : '已完成'}
            onClick={() => setActiveJob(job)}
          />
        ))}
      </MediaCardGrid>

      {!archives.jobs.length && !archives.loading ? (
        <div className="card p-10 text-center text-sm text-slate-500">
          <Archive className="mx-auto h-8 w-8 text-primary-500" />
          <div className="mt-3 font-semibold text-slate-900">暂无归档</div>
          <div className="mt-1">认领任务比对完整后归档，会出现在这里。</div>
        </div>
      ) : null}

      {activeJob ? (
        <Modal title={activeJob.title} subtitle={`归档于 ${formatDateTime(activeJob.archived_at)}`} onClose={() => setActiveJob(null)}>
          <div className="grid gap-2 text-sm text-slate-600">
            <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
              <span>完整度</span>
              <span className="font-semibold text-slate-900">{Math.round(activeJob.compare?.progress || 0)}%</span>
            </div>
            <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
              <span>缺失集数</span>
              <span className="font-semibold text-slate-900">{activeJob.compare?.missing_count || 0}</span>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
