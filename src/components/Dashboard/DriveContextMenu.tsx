import React, { useEffect, useRef } from 'react';
import { useDriveContext } from './DriveManagerContext';

const DriveContextMenu: React.FC = () => {
  const { contextMenu, hideContextMenu } = useDriveContext();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        hideContextMenu();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        hideContextMenu();
      }
    };

    if (contextMenu.isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [contextMenu.isOpen, hideContextMenu]);

  if (!contextMenu.isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white border border-gray-200 rounded-xl shadow-lg py-2 min-w-48"
      style={{
        left: contextMenu.x,
        top: contextMenu.y,
      }}
    >
      {contextMenu.items.map((item, index) => (
        <button
          key={index}
          onClick={() => {
            item.action();
            hideContextMenu();
          }}
          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-3"
        >
          <item.icon className="h-4 w-4" />
          <span>{item.label}</span>
          {item.shortcut && (
            <span className="ml-auto text-xs text-gray-400">{item.shortcut}</span>
          )}
        </button>
      ))}
    </div>
  );
};

export default DriveContextMenu;