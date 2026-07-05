import { useEffect, useState } from 'react';
import { ClipboardList, RefreshCw } from 'lucide-react';
import { useApp } from '../store';
import MediaCardGrid from '../components/media/MediaCardGrid';
import MediaPosterCard from '../components/media/MediaPosterCard';
import ClaimWizard from '../components/ClaimWizard';

export default function Claims() {
  const { claims, loadClaims, wizardJobId, setWizardJobId } = useApp();
  const [activeJob, setActiveJob] = useState(null);

  useEffect(() => {
    if (!claims.jobs.length && !claims.loading) loadClaims().catch(() => {});
  }, []);

  useEffect(() => {
    if (!wizardJobId) return;
    const job = claims.jobs.find((row) => row.id === wizardJobId);
    if (job) setActiveJob(job);
  }, [wizardJobId, claims.jobs]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-2xl font-bold text-slate-900">我的认领</div>
          <p className="mt-1 text-sm text-slate-500">处理已认领项目</p>
        </div>
        <button
          type="button"
          className="btn-ghost btn-icon mt-0.5 shrink-0"
          onClick={() => loadClaims()}
          title="刷新认领"
          aria-label="刷新认领"
          disabled={claims.loading}
        >
          <RefreshCw className={claims.loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
        </button>
      </div>

      {claims.error ? <div className="rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700">{claims.error}</div> : null}

      <MediaCardGrid>
        {claims.jobs.map((job) => (
          <MediaPosterCard
            key={job.id}
            item={job}
            statusLabel={job.status === 'submitted' ? '已提交' : job.status === 'claimed' ? '处理中' : '待处理'}
            statusClass={job.status === 'submitted' ? 'bg-emerald-50 text-emerald-700 ring-emerald-100' : job.status === 'claimed' ? 'bg-blue-50 text-blue-700 ring-blue-100' : 'bg-slate-100 text-slate-600 ring-slate-200'}
            subtitle={job.status === 'submitted' ? '已进入后台' : '待维护'}
            onClick={() => setActiveJob(job)}
          />
        ))}
      </MediaCardGrid>

      {!claims.jobs.length && !claims.loading ? (
        <div className="card p-10 text-center text-sm text-slate-500">
          <ClipboardList className="mx-auto h-8 w-8 text-primary-500" />
          <div className="mt-3 font-semibold text-slate-900">暂无认领</div>
          <div className="mt-1">从大厅或 Emby 创建一个任务后会出现在这里。</div>
        </div>
      ) : null}

      {activeJob ? <ClaimWizard job={activeJob} onClose={() => { setActiveJob(null); setWizardJobId(null); }} /> : null}
    </div>
  );
}
