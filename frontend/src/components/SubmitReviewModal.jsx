import { Save } from 'lucide-react';
import Modal from './Modal';
import { statusText } from '../utils';

function SummaryItem({ label, children, mono = false }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-xs font-semibold uppercase text-slate-400">{label}</div>
      <div className={mono ? 'mt-1 break-all font-mono text-xs text-slate-700' : 'mt-1 font-semibold text-slate-900'}>{children}</div>
    </div>
  );
}

export default function SubmitReviewModal({ job, selectedPath, selectedType, categoryId, scrapeEnabled, busy, error, onClose, onConfirm }) {
  return (
    <Modal
      title="提交总览"
      subtitle="确认这些信息无误后再提交任务。"
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-3">
          <div className="flex gap-2">
            <button type="button" className="btn-secondary btn-sm" onClick={onClose} disabled={busy}>返回修改</button>
            <button type="button" className="btn-primary btn-sm" onClick={onConfirm} disabled={busy}>
              <Save className="h-4 w-4" />
              {busy ? '提交中' : '确认提交'}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-3 text-sm">
        {error ? <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-red-700">{error}</div> : null}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold uppercase text-slate-400">媒体</div>
          <div className="mt-1 font-semibold text-slate-900">{job.title}</div>
          <div className="mt-1 text-slate-500">{job.source === 'emby' ? 'Emby' : '大厅'} · {statusText(job.status)}</div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <SummaryItem label="路径" mono>{selectedPath}</SummaryItem>
          <SummaryItem label="类型">{selectedType === 'file' ? '文件' : '目录'}</SummaryItem>
          <SummaryItem label="分类">{categoryId}</SummaryItem>
          <SummaryItem label="刮削状态">{scrapeEnabled ? '已刮削' : '未刮削'}</SummaryItem>
        </div>
      </div>
    </Modal>
  );
}
