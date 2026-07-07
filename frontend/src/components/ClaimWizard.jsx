import { useEffect, useState } from 'react';
import { Archive, RefreshCw, Trash2 } from 'lucide-react';
import { useApp } from '../store';
import Modal from './Modal';
import { formatDateTime, statusText } from '../utils';

export default function ClaimWizard({ job, onClose }) {
  const { compareJob, archiveJob, releaseJob, setWizardJobId } = useApp();
  const [compare, setCompare] = useState(job?.compare || null);
  const [refreshing, setRefreshing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setCompare(job?.compare || null);
    setError('');
    setRefreshing(false);
    setArchiving(false);
    setReleasing(false);
  }, [job?.id]);

  if (!job) return null;

  const compared = Boolean(compare?.checked_at);
  const progress = Number(compare?.progress || 0);
  const missing = Number(compare?.missing_count || 0);
  const canArchive = compared && progress >= 100 && missing <= 0;
  const archiveReason = !compared ? '先刷新比对' : '完整度未到 100% 或仍有缺失';

  return (
    <Modal
      title={job.title}
      subtitle={`我的认领 · ${statusText(job.status)} · ${formatDateTime(job.created_at)}`}
      onClose={onClose}
    >
      <div className="space-y-4">
        {error ? <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        <div className="grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            className="btn-primary"
            disabled={refreshing}
            onClick={async () => {
              setRefreshing(true);
              setError('');
              try {
                const result = await compareJob(job.id);
                setCompare(result);
              } catch (err) {
                setError(err.message || '刷新失败');
              } finally {
                setRefreshing(false);
              }
            }}
          >
            <RefreshCw className={refreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            刷新比对
          </button>

          <button
            type="button"
            className="btn-secondary"
            disabled={!canArchive || archiving}
            title={canArchive ? '归档' : archiveReason}
            onClick={async () => {
              setArchiving(true);
              setError('');
              try {
                await archiveJob(job.id);
                setWizardJobId(null);
                onClose?.();
              } catch (err) {
                setError(err.message || '归档失败');
              } finally {
                setArchiving(false);
              }
            }}
          >
            <Archive className="h-4 w-4" />
            {archiving ? '归档中' : '归档'}
          </button>

          <button
            type="button"
            className="btn-ghost text-red-600 hover:bg-red-50 hover:text-red-700"
            disabled={releasing}
            onClick={async () => {
              setReleasing(true);
              setError('');
              try {
                await releaseJob(job.id);
                setWizardJobId(null);
                onClose?.();
              } catch (err) {
                setError(err.message || '释放失败');
              } finally {
                setReleasing(false);
              }
            }}
          >
            <Trash2 className="h-4 w-4" />
            释放
          </button>
        </div>

        <div className="card border-slate-200 p-4">
          <div className="text-sm font-semibold text-slate-900">入库比对</div>
          <div className="mt-3 grid gap-2 text-sm text-slate-600">
            <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
              <span>完整度</span>
              <span className="font-semibold text-slate-900">{compared ? `${Math.round(progress)}%` : '未比对'}</span>
            </div>
            <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
              <span>缺失集数</span>
              <span className="font-semibold text-slate-900">{compared ? missing : '未比对'}</span>
            </div>
            <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
              <span>归档状态</span>
              <span className={canArchive ? 'font-semibold text-emerald-700' : 'font-semibold text-slate-500'}>{canArchive ? '可归档' : archiveReason}</span>
            </div>
            {compare?.checked_at ? (
              <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
                <span>刷新时间</span>
                <span className="font-semibold text-slate-900">{formatDateTime(compare.checked_at)}</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </Modal>
  );
}
