import { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ title, subtitle, onClose, children, footer }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 p-0 md:items-center md:p-4">
      <button type="button" aria-label="关闭" className="absolute inset-0 h-full w-full" onClick={onClose} />
      <div className="relative z-10 w-full max-w-4xl rounded-t-lg border border-slate-200 bg-white shadow-lg md:rounded-lg">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-4 md:p-5">
          <div>
            <div className="text-lg font-bold text-slate-900">{title}</div>
            {subtitle ? <div className="mt-1 text-sm text-slate-500">{subtitle}</div> : null}
          </div>
          <button type="button" onClick={onClose} className="btn-ghost btn-icon">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[calc(100vh-8rem)] overflow-y-auto p-4 md:p-5">{children}</div>
        {footer ? <div className="border-t border-slate-100 p-4 md:p-5">{footer}</div> : null}
      </div>
    </div>
  );
}
