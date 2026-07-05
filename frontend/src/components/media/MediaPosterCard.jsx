import { CircleAlert, Film, LockKeyhole, Sparkles } from 'lucide-react';
import { fileName, joinClasses, statusText, statusTone } from '../../utils';

function mediaTitle(item) {
  return item?.title || item?.name || fileName(item?.poster_url) || '未命名';
}

function PosterVisual({ item, title, overlay }) {
  return (
    <div className="relative aspect-[2/3] overflow-hidden bg-slate-100">
      {item?.poster_url ? (
        <img src={item.poster_url} alt={title} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-slate-100 via-white to-slate-50 px-4 text-center text-slate-500">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200">
            <Film className="h-6 w-6 text-slate-900" />
          </div>
          <div className="line-clamp-2 text-sm font-medium leading-5">{title}</div>
        </div>
      )}

      {overlay ? (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/45 px-2 text-center text-white">
          <div>
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm">
              {overlay.kind === 'lock' ? <LockKeyhole className="h-4 w-4" /> : overlay.kind === 'warn' ? <CircleAlert className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            </div>
            <div className="mt-2 text-xs font-semibold leading-4">{overlay.label}</div>
            {overlay.detail ? <div className="mt-1 text-[11px] leading-4 text-white/80">{overlay.detail}</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function MediaPosterCard({ item, status, statusLabel, statusClass, subtitle, overlay, selected, onClick }) {
  const title = mediaTitle(item);

  return (
    <button
      type="button"
      onClick={onClick}
      className={joinClasses('card group overflow-hidden text-left transition hover:-translate-y-0.5 hover:shadow-md', selected ? 'ring-2 ring-primary-400' : '')}
    >
      <div className="relative">
        <PosterVisual item={item} title={title} overlay={overlay} />
        {(statusLabel || status) ? (
          <div className="absolute left-3 right-3 top-3 flex flex-wrap gap-1.5">
            <span className={joinClasses('badge shadow-sm', statusClass || statusTone(status))}>{statusLabel || statusText(status)}</span>
          </div>
        ) : null}
      </div>

      <div className="space-y-2 p-3">
        <div className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-5 text-slate-900">{title}</div>
        {subtitle ? <div className="line-clamp-1 text-xs leading-5 text-slate-500">{subtitle}</div> : null}
      </div>
    </button>
  );
}
