import React, { createContext, useContext, useState } from 'react';

interface ContextMenuItem {
  label: string;
  icon: React.ComponentType<any>;
  action: () => void;
  shortcut?: string;
}

interface DriveContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
}

interface DriveContextType {
  contextMenu: DriveContextMenuState;
  showContextMenu: (x: number, y: number, items: ContextMenuItem[]) => void;
  hideContextMenu: () => void;
}

const DriveContext = createContext<DriveContextType | undefined>(undefined);

export const useDriveContext = () => {
  const context = useContext(DriveContext);
  if (!context) {
    throw new Error('useDriveContext deve ser usado dentro de DriveContextProvider');
  }
  return context;
};

export const DriveContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [contextMenu, setContextMenu] = useState<DriveContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
    items: []
  });

  const showContextMenu = (x: number, y: number, items: ContextMenuItem[]) => {
    setContextMenu({ isOpen: true, x, y, items });
  };

  const hideContextMenu = () => {
    setContextMenu({ isOpen: false, x: 0, y: 0, items: [] });
  };

  return (
    <DriveContext.Provider value={{ contextMenu, showContextMenu, hideContextMenu }}>
      {children}
    </DriveContext.Provider>
  );
};