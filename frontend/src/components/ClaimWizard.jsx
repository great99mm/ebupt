import { useEffect, useMemo, useState } from 'react';
import { Archive, Check, FolderOpen, RefreshCw, Save, SquareCheckBig, Trash2 } from 'lucide-react';
import { useApp } from '../store';
import Modal from './Modal';
import BrowsePicker from './BrowsePicker';
import SubmitReviewModal from './SubmitReviewModal';
import { formatDateTime, joinClasses, statusText } from '../utils';

export default function ClaimWizard({ job, onClose }) {
  const { categories, loadCategories, selectJob, submitJob, releaseJob, compareJob, archiveJob, settings, wizardSeedPath, setWizardJobId } = useApp();
  const [browserOpen, setBrowserOpen] = useState(false);
  const [activePanel, setActivePanel] = useState('');
  const [selectedPath, setSelectedPath] = useState(job?.selected_path || wizardSeedPath || '');
  const [selectedType, setSelectedType] = useState(job?.selected_type || 'dir');
  const [selectionToken, setSelectionToken] = useState('');
  const [categoryId, setCategoryId] = useState(job?.category || '');
  const [scrapeEnabled, setScrapeEnabled] = useState(Boolean(job?.scrape));
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState('');
  const [releaseConfirmOpen, setReleaseConfirmOpen] = useState(false);
  const [submitReviewOpen, setSubmitReviewOpen] = useState(false);
  const [compareRefreshing, setCompareRefreshing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [compareResult, setCompareResult] = useState(job?.compare || null);

  const rootOptions = useMemo(() => {
    const roots = settings.data?.visible_roots || [];
    return Array.isArray(roots) ? roots : [];
  }, [settings.data]);

  useEffect(() => {
    if (!categories.items.length && !categories.loading) {
      loadCategories().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!job) return;
    setSelectedPath(job.selected_path || wizardSeedPath || '');
    setSelectedType(job.selected_type || 'dir');
    setCategoryId(job.category || '');
    setScrapeEnabled(Boolean(job.scrape));
    setSelectionToken('');
    setActivePanel('');
    setReleaseConfirmOpen(false);
    setSubmitReviewOpen(false);
    setCompareRefreshing(false);
    setArchiving(false);
    setCompareResult(job.compare || null);
  }, [job?.id]);

  if (!job) return null;

  const categoriesList = categories.items;
  const pathReady = Boolean(selectedPath);
  const canSubmit = Boolean(pathReady && categoryId && !busy);
  const pathActionLabel = pathReady ? '更换路径' : '选择路径';
  const canRelease = job.status !== 'submitted';
  const releaseTargetText = job.source === 'emby' ? 'Emby' : '大厅';
  const sourceLabel = job.source === 'emby' ? 'Emby' : '大厅';
  const compare = compareResult || job.compare || null;
  const compareComplete = Boolean(compare?.complete);
  const compared = Boolean(compare?.checked_at);
  const archiveLockedReason = !compared ? '先完成比对' : !compareComplete ? '进度未到 100% 或仍有缺失' : '';

  const confirmSubmit = async () => {
    setBusy(true);
    setLocalError('');
    try {
      let token = selectionToken;
      if (!token && selectedPath) {
        const result = await selectJob(job.id, {
          path: selectedPath,
          item_type: selectedType || 'dir',
        });
        token = result.selection_token || '';
        setSelectionToken(token);
      }
      if (!token) throw new Error('请先选择路径');
      await submitJob(job.id, {
        selection_token: token,
        category_id: categoryId,
        scrape_enabled: scrapeEnabled,
      });
      setSubmitReviewOpen(false);
      setWizardJobId(null);
      onClose?.();
    } catch (err) {
      setLocalError(err.message || '提交失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {!submitReviewOpen && !releaseConfirmOpen && !browserOpen ? (
        <Modal
          title={job.title}
          subtitle={`${job.source === 'emby' ? 'Emby' : '大厅'} · ${statusText(job.status)} · ${formatDateTime(job.created_at)}`}
          onClose={onClose}
        >
        <div className="space-y-4">
          {localError ? <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{localError}</div> : null}

          <div className="sticky top-0 z-10 -mx-1 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white/95 p-2 shadow-sm backdrop-blur">
            {canRelease ? (
              <button
                type="button"
                className="btn-ghost btn-sm text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => setReleaseConfirmOpen(true)}
                disabled={busy}
              >
                <Trash2 className="h-4 w-4" />
                释放
              </button>
            ) : (
              <span className="badge bg-slate-100 text-slate-500 ring-slate-200">已提交，不能释放</span>
            )}
            <div className="flex min-w-0 items-center gap-2 text-xs text-slate-500">
              <span className={joinClasses('badge', pathReady ? 'bg-emerald-50 text-emerald-700 ring-emerald-100' : 'bg-slate-100 text-slate-500 ring-slate-200')}>{pathReady ? '路径已选' : '待选路径'}</span>
              <span className={joinClasses('badge', categoryId ? 'bg-emerald-50 text-emerald-700 ring-emerald-100' : 'bg-slate-100 text-slate-500 ring-slate-200')}>{categoryId || '待分类'}</span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              className={joinClasses('rounded-lg border p-4 text-left transition', activePanel === 'maintain' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50')}
              onClick={() => setActivePanel((panel) => (panel === 'maintain' ? '' : 'maintain'))}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold">维护</div>
                <span className={joinClasses('badge', activePanel === 'maintain' ? 'bg-white/15 text-white ring-white/20' : 'bg-slate-100 text-slate-500 ring-slate-200')}>{activePanel === 'maintain' ? '已展开' : '展开'}</span>
              </div>
              <div className={joinClasses('mt-2 text-xs', activePanel === 'maintain' ? 'text-white/70' : 'text-slate-500')}>选择路径、分类、刮削状态并提交。</div>
            </button>

            <div className={joinClasses('rounded-lg border p-4 transition', activePanel === 'compare' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-900')}>
              <button
                type="button"
                className="w-full text-left"
                onClick={() => setActivePanel((panel) => (panel === 'compare' ? '' : 'compare'))}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold">比对</div>
                  <span className={joinClasses('badge', activePanel === 'compare' ? 'bg-white/15 text-white ring-white/20' : 'bg-slate-100 text-slate-500 ring-slate-200')}>{activePanel === 'compare' ? '已展开' : '展开'}</span>
                </div>
                <div className={joinClasses('mt-2 text-xs', activePanel === 'compare' ? 'text-white/70' : 'text-slate-500')}>刷新 Emby 后检查是否完整。</div>
              </button>
              <button
                type="button"
                className={joinClasses('mt-3 w-full', activePanel === 'compare' ? 'btn-secondary' : 'btn-ghost')}
                onClick={async () => {
                  setCompareRefreshing(true);
                  setLocalError('');
                  try {
                    const result = await compareJob(job.id);
                    setCompareResult(result);
                  } catch (err) {
                    setLocalError(err.message || '刷新失败');
                  } finally {
                    setCompareRefreshing(false);
                  }
                }}
                disabled={compareRefreshing}
              >
                <RefreshCw className={compareRefreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                刷新
              </button>
            </div>
          </div>

          {activePanel === 'maintain' ? (
          <div className="space-y-4">
          <div className={joinClasses('card border-slate-200 p-4', pathReady ? 'border-primary-200 bg-primary-50/40' : '')}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <SquareCheckBig className={joinClasses('h-4 w-4', pathReady ? 'text-primary-600' : 'text-slate-300')} />
                  Step 1 · 路径
                </div>
              </div>
              <button type="button" className={joinClasses('btn-secondary btn-sm', busy ? 'opacity-60' : '')} onClick={() => setBrowserOpen(true)} disabled={busy}>
                <FolderOpen className="h-4 w-4" />
                {pathActionLabel}
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className={joinClasses('badge', pathReady ? 'bg-emerald-50 text-emerald-700 ring-emerald-100' : 'bg-slate-100 text-slate-500 ring-slate-200')}>
                {pathReady ? '已选择' : '未选择'}
              </span>
              <span className="badge bg-white text-slate-600 ring-slate-200">{selectedPath || '等待选择'}</span>
              {selectedType ? <span className="badge bg-slate-100 text-slate-500 ring-slate-200">{selectedType}</span> : null}
            </div>
          </div>

          <div className="card border-slate-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Check className={joinClasses('h-4 w-4', categoryId ? 'text-primary-600' : 'text-slate-300')} />
                  Step 2 · 分类
                </div>
              </div>
            </div>

            <div className="mt-4">
              <div>
                <div className="field-label">分类</div>
                <select className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={busy}>
                  <option value="">请选择</option>
                  {categoriesList.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="card border-slate-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Check className="h-4 w-4 text-primary-600" />
                  Step 3 · 刮削状态
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                className={joinClasses('flex h-10 items-center justify-center rounded-md border px-3 text-sm font-semibold transition', scrapeEnabled ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}
                onClick={() => setScrapeEnabled(true)}
                disabled={busy}
              >
                已刮削
              </button>
              <button
                type="button"
                className={joinClasses('flex h-10 items-center justify-center rounded-md border px-3 text-sm font-semibold transition', !scrapeEnabled ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}
                onClick={() => setScrapeEnabled(false)}
                disabled={busy}
              >
                未刮削
              </button>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className="btn-primary btn-sm md:min-w-24"
                disabled={!canSubmit}
                onClick={() => setSubmitReviewOpen(true)}
              >
                <Save className="h-4 w-4" />
                提交
              </button>
            </div>
          </div>
          </div>
          ) : null}

          {activePanel === 'compare' ? (
            <div className="card border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-900">比对状态</div>
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  disabled={!compareComplete || archiving}
                  title={archiveLockedReason || '归档'}
                  onClick={async () => {
                    setArchiving(true);
                    setLocalError('');
                    try {
                      await archiveJob(job.id);
                      onClose?.();
                    } catch (err) {
                      setLocalError(err.message || '归档失败');
                    } finally {
                      setArchiving(false);
                    }
                  }}
                >
                  <Archive className="h-4 w-4" />
                  {archiving ? '归档中' : '归档'}
                </button>
              </div>
              <div className="mt-3 grid gap-2 text-sm text-slate-600">
                <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
                  <span>完整度</span>
                  <span className="font-semibold text-slate-900">{compared ? `${Math.round(compare.progress || 0)}%` : '未比对'}</span>
                </div>
                <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
                  <span>缺失</span>
                  <span className="font-semibold text-slate-900">{compared ? `${compare.missing_count || 0}` : '未比对'}</span>
                </div>
                <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
                  <span>归档</span>
                  <span className={compareComplete ? 'font-semibold text-emerald-700' : 'font-semibold text-slate-500'}>{compareComplete ? '可归档' : archiveLockedReason}</span>
                </div>
                <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
                  <span>来源</span>
                  <span className="font-semibold text-slate-900">{sourceLabel}</span>
                </div>
                <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
                  <span>任务状态</span>
                  <span className="font-semibold text-slate-900">{statusText(job.status)}</span>
                </div>
                <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
                  <span>提交状态</span>
                  <span className="font-semibold text-slate-900">{job.submitted_at ? '已提交' : '未提交'}</span>
                </div>
                <div className="rounded-md bg-slate-50 px-3 py-2">
                  <div className="text-slate-500">路径</div>
                  <div className="mt-1 break-all font-mono text-xs text-slate-900">{selectedPath || job.selected_path || '未选择'}</div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
        </Modal>
      ) : null}

      {releaseConfirmOpen ? (
        <Modal
          title="确认释放"
          subtitle={`回到${releaseTargetText}`}
          onClose={() => setReleaseConfirmOpen(false)}
          footer={
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary btn-sm" onClick={() => setReleaseConfirmOpen(false)}>
                取消
              </button>
              <button
                type="button"
                className="btn-destructive btn-sm"
                onClick={async () => {
                  setBusy(true);
                  setLocalError('');
                  try {
                    await releaseJob(job.id);
                    setReleaseConfirmOpen(false);
                    onClose?.();
                  } catch (err) {
                    setLocalError(err.message || '释放失败');
                  } finally {
                    setBusy(false);
                  }
                }}
                disabled={busy || job.status === 'submitted'}
              >
                确认释放
              </button>
            </div>
          }
        >
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            任务会回到{releaseTargetText}，当前认领将移除。
          </div>
        </Modal>
      ) : null}

      {submitReviewOpen ? (
        <SubmitReviewModal
          job={job}
          selectedPath={selectedPath}
          selectedType={selectedType}
          categoryId={categoryId}
          scrapeEnabled={scrapeEnabled}
          busy={busy}
          error={localError}
          onClose={() => setSubmitReviewOpen(false)}
          onConfirm={confirmSubmit}
        />
      ) : null}

      <BrowsePicker
        open={browserOpen}
        onClose={() => setBrowserOpen(false)}
        roots={rootOptions}
        job={job}
        onPicked={async (picked) => {
          setBusy(true);
          setLocalError('');
          try {
            const result = await selectJob(job.id, {
              path: picked.path,
              item_type: picked.item_type,
            });
            setSelectionToken(result.selection_token || '');
            setSelectedPath(picked.path);
            setSelectedType(picked.item_type);
            setBrowserOpen(false);
          } catch (err) {
            setLocalError(err.message || '选择失败');
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}
