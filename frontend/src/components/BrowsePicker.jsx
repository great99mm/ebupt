import { ChevronRight, Folder, FileText, Home, Check } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../store';
import Modal from './Modal';
import { fileName, itemTypeLabel, pickInitialBrowsePath } from '../utils';

function Breadcrumbs({ path, roots, onJump }) {
  const parts = useMemo(() => {
    if (!path || path === '/') return [{ label: '根目录', path: '/' }];
    const segments = path.split('/').filter(Boolean);
    const items = [{ label: '根目录', path: '/' }];
    let current = '';
    segments.forEach((seg) => {
      current += `/${seg}`;
      items.push({ label: seg, path: current });
    });
    return items;
  }, [path]);

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
      {roots?.length ? (
        <>
          <button type="button" className="btn-ghost px-2.5 py-1.5" onClick={() => onJump('/')}>根</button>
          <span className="text-slate-300">/</span>
        </>
      ) : null}
      {parts.map((part, index) => (
        <button
          key={`${part.path}-${index}`}
          type="button"
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium hover:bg-slate-100"
          onClick={() => onJump(part.path)}
        >
          {index === 0 ? <Home className="h-4 w-4" /> : null}
          {part.label}
          {index < parts.length - 1 ? <ChevronRight className="h-4 w-4 text-slate-400" /> : null}
        </button>
      ))}
    </div>
  );
}

export default function BrowsePicker({ job, open, onClose, onPicked, roots = [] }) {
  const { loadBrowse } = useApp();
  const [currentPath, setCurrentPath] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  const rootOptions = roots.length ? roots : [{ id: 'default', path: '/' }];

  const runBrowse = async (path) => {
    setLoading(true);
    setError('');
    try {
      const list = await loadBrowse(path);
      setItems(list);
      setCurrentPath(path);
      setSelected(null);
    } catch (err) {
      setError(err.message || '读取目录失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const initial = pickInitialBrowsePath(rootOptions);
    runBrowse(initial);
  }, [open]);

  if (!open) return null;

  return (
    <Modal
      title="选择路径"
      subtitle={job?.title || ''}
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-500">
            {selected ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-primary-700">
                <Check className="h-4 w-4" />
                {selected.type === 'dir' ? '目录' : '文件'} {fileName(selected.path)}
              </span>
            ) : (
              '先进入目录，再点选目录或文件。'
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>取消</button>
            <button
              type="button"
              className="btn-primary"
              disabled={!selected}
              onClick={async () => {
                await onPicked?.(selected);
              }}
            >
              确认选择
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {rootOptions.map((root) => (
            <button key={root.id || root.path} type="button" className="btn-secondary" onClick={() => runBrowse(root.path || '/') }>
              <Home className="h-4 w-4" />
              {root.id || fileName(root.path)}
            </button>
          ))}
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <Breadcrumbs path={currentPath} roots={rootOptions} onJump={runBrowse} />
        </div>

        {error ? <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
            当前目录 <span className="font-mono text-slate-400">{currentPath || '/'}</span>
          </div>
          <div className="max-h-[50vh] overflow-y-auto">
            {loading ? (
              <div className="px-4 py-10 text-center text-sm text-slate-500">加载中...</div>
            ) : items.length ? (
              <div className="divide-y divide-slate-100">
                {items.map((item) => {
                  const isDir = item.type === 'dir' || item.type === 'folder';
                  const active = selected?.path === item.path;
                  return (
                    <div
                      key={item.path}
                      className={active ? 'flex w-full items-center gap-2 bg-primary-50 px-4 py-3 text-left' : 'flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-slate-50'}
                    >
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        onClick={() => {
                          if (isDir) {
                            runBrowse(item.path);
                            return;
                          }
                          setSelected({ path: item.path, item_type: 'file' });
                        }}
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                          {isDir ? <Folder className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-slate-900">{item.name || fileName(item.path)}</div>
                          <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                            <span>{itemTypeLabel(item.type)}</span>
                            <span className="truncate">{item.path}</span>
                          </div>
                        </div>
                        {isDir ? <ChevronRight className="h-4 w-4 text-slate-400" /> : null}
                      </button>
                      <button
                        type="button"
                        className="btn-ghost px-3"
                        onClick={() => setSelected({ path: item.path, item_type: isDir ? 'dir' : 'file' })}
                      >
                        选中
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-4 py-10 text-center text-sm text-slate-500">当前目录为空。</div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
