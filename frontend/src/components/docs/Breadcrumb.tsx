import { ChevronRight, Home } from 'lucide-react';
import { useDocsStore } from '@/stores/docsStore';

export default function Breadcrumb() {
  const { currentPath, navigateTo } = useDocsStore();

  // Split path into segments
  const segments = currentPath.split('/').filter(Boolean);

  // Build breadcrumb items
  const breadcrumbItems = [
    { name: 'My Files', path: '/' },
    ...segments.map((segment, index) => ({
      name: segment,
      path: '/' + segments.slice(0, index + 1).join('/'),
    })),
  ];

  return (
    <nav className="flex items-center gap-1 text-sm">
      {breadcrumbItems.map((item, index) => (
        <div key={item.path} className="flex items-center gap-1">
          {index > 0 && (
            <ChevronRight size={16} className="text-gray-400" />
          )}
          {index === 0 ? (
            <button
              onClick={() => navigateTo(item.path)}
              className="flex items-center gap-1 px-2 py-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
            >
              <Home size={16} />
              <span>{item.name}</span>
            </button>
          ) : index === breadcrumbItems.length - 1 ? (
            <span className="px-2 py-1 font-medium text-gray-900">
              {item.name}
            </span>
          ) : (
            <button
              onClick={() => navigateTo(item.path)}
              className="px-2 py-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
            >
              {item.name}
            </button>
          )}
        </div>
      ))}
    </nav>
  );
}
