import { AlertTriangle, CheckCircle2, Film, Info, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import Modal from './Modal';
import { useApp } from '../store';
import { itemTypeLabel } from '../utils';

export default function DetailModal({ item, section, claimLabel = '我要认领', onClose, onClaim, locked, job }) {
  const { claims } = useApp();
  const [pending, setPending] = useState(false);
  const currentJob = useMemo(() => {
    if (job) return job;
    return claims.jobs.find((row) => row.source_item_id === item?.id) || null;
  }, [job, claims.jobs, item?.id]);

  const active = currentJob && currentJob.status !== 'released' && currentJob.status !== 'completed';
  const ownerLabel = active ? '已认领' : '';

  return (
    <Modal
      title={item?.title || '详情'}
      subtitle={item?.metadata?.overview || item?.overview || item?.metadata?.Plot || item?.metadata?.plot || ''}
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-500">
            {active ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-amber-700">
                <LockKeyhole className="h-4 w-4" />
                当前状态 {ownerLabel}
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                <ShieldCheck className="h-4 w-4" />
                可操作
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>关闭</button>
            {pending ? (
              <>
                <button type="button" className="btn-ghost" onClick={() => setPending(false)}>取消</button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={async () => {
                    await onClaim?.();
                    setPending(false);
                  }}
                  disabled={locked && !currentJob}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  确认
                </button>
              </>
            ) : (
              <button type="button" className="btn-primary" onClick={() => setPending(true)} disabled={locked && !currentJob}>
                {claimLabel}
              </button>
            )}
          </div>
        </div>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
          {item?.poster_url ? (
            <img src={item.poster_url} alt={item.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex aspect-[2/3] items-center justify-center text-slate-400">
              <Film className="h-10 w-10" />
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <span className="badge bg-primary-50 text-primary-700 ring-primary-100">大厅</span>
            <span className="badge bg-slate-100 text-slate-600 ring-slate-200">{itemTypeLabel(item?.media_type)}</span>
            {active ? <span className="badge bg-amber-50 text-amber-700 ring-amber-100">{currentJob?.status || '维护中'}</span> : null}
          </div>

          <div className="card border-slate-100 bg-slate-50 shadow-none">
            <div className="card-body grid gap-3 text-sm text-slate-600 md:grid-cols-2">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">ID</div>
                <div className="mt-1 break-all text-slate-900">{item?.id}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">来源</div>
                <div className="mt-1 text-slate-900">{item?.source}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">类型</div>
                <div className="mt-1 text-slate-900">{itemTypeLabel(item?.media_type)}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">状态</div>
                <div className="mt-1 text-slate-900">{active ? '已占用' : '可认领'}</div>
              </div>
            </div>
          </div>

          {item?.metadata?.overview || item?.metadata?.Overview || item?.metadata?.plot || item?.metadata?.Plot ? (
            <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600">
              {item?.metadata?.overview || item?.metadata?.Overview || item?.metadata?.plot || item?.metadata?.Plot}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              <Info className="mb-2 h-4 w-4" />
              暂无更多信息。
            </div>
          )}

          {active ? (
            <div className="rounded-lg border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">
              <div className="font-semibold">当前已有认领任务</div>
              <div className="mt-1">如果这是你的任务，请到“我的认领”继续处理。</div>
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
