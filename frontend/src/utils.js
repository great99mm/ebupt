export function joinClasses(...parts) {
  return parts.filter(Boolean).join(' ');
}

export function textListToArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function rootsToText(value) {
  if (!Array.isArray(value)) return '';
  return value
    .map((item) => {
      if (item && typeof item === 'object') {
        const id = String(item.id || '').trim();
        const path = String(item.path || '').trim();
        if (id && path) return `${id}=${path}`;
        if (path) return path;
      }
      return '';
    })
    .filter(Boolean)
    .join('\n');
}

export function mappingsToText(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  return Object.entries(value)
    .map(([key, val]) => `${key}=${val}`)
    .join('\n');
}

export function textToRoots(text) {
  return textListToArray(text).map((line) => {
    const pair = line.split(/\s*=\s*|\s*:\s*/);
    if (pair.length >= 2) {
      return { id: pair[0].trim(), path: pair.slice(1).join('=').trim() };
    }
    const path = line.trim();
    const id = path.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'root';
    return { id, path };
  }).filter((item) => item.id && item.path);
}

export function textToMapping(text) {
  return textListToArray(text).reduce((acc, line) => {
    const pair = line.split(/\s*=\s*|\s*:\s*/);
    if (pair.length >= 2) {
      acc[pair[0].trim()] = pair.slice(1).join('=').trim();
    }
    return acc;
  }, {});
}

export function prettifyPath(path) {
  if (!path) return '/';
  return path;
}

export function fileName(path) {
  if (!path) return '';
  const clean = String(path).replace(/\/+/g, '/');
  const parts = clean.split('/').filter(Boolean);
  return parts[parts.length - 1] || clean;
}

export function formatDateTime(value) {
  if (!value) return '未知';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function statusText(status) {
  const map = {
    claimed: '已认领',
    selection_ready: '已选路径',
    submitted: '已提交',
    failed: '失败',
    released: '已释放',
    completed: '已完成',
  };
  return map[status] || status || '未知';
}

export function statusTone(status) {
  const map = {
    claimed: 'bg-primary-50 text-primary-700 ring-primary-100',
    selection_ready: 'bg-blue-50 text-blue-700 ring-blue-100',
    submitted: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    failed: 'bg-red-50 text-red-700 ring-red-100',
    released: 'bg-slate-100 text-slate-600 ring-slate-200',
    completed: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  };
  return map[status] || 'bg-slate-100 text-slate-600 ring-slate-200';
}

export function itemTypeLabel(type) {
  const t = String(type || '').toLowerCase();
  if (t === 'dir' || t === 'folder') return '目录';
  if (t === 'file') return '文件';
  return type || '项';
}

export function isSecretKey(key) {
  return ['emby_api_key', 'tmdb_api_key', 'openlist_token', 'manager_token'].includes(key);
}

export function normalizeCategories(raw) {
  if (Array.isArray(raw)) return raw.map((item) => String(item)).filter(Boolean);
  if (raw && Array.isArray(raw.categories)) return raw.categories.map((item) => String(item)).filter(Boolean);
  return [];
}

export function normalizeBrowseItems(payload) {
  const content = payload?.data?.content || payload?.data?.files || payload?.content || payload?.files || payload?.items || [];
  return content
    .map((item) => {
      const path = item.path || item.Path || item.full_path || item.fullPath || '';
      const name = item.name || item.Name || fileName(path);
      const type = String(item.type || item.Type || item.kind || item.Kind || '').toLowerCase() || (item.is_dir || item.IsDir ? 'dir' : 'file');
      const size = item.size || item.Size || item.length || item.Length || null;
      return { ...item, path, name, type, size };
    })
    .filter((item) => item.path || item.name)
    .sort((a, b) => {
      const ad = a.type === 'dir' ? 0 : 1;
      const bd = b.type === 'dir' ? 0 : 1;
      if (ad !== bd) return ad - bd;
      return String(a.name).localeCompare(String(b.name), 'zh-CN');
    });
}

export function pickInitialBrowsePath(roots) {
  const first = Array.isArray(roots) ? roots[0] : null;
  if (first && first.path) return first.path;
  return '/';
}
