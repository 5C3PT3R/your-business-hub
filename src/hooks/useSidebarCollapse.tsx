import { useState, createContext, useContext, ReactNode } from 'react';

interface SidebarCollapseContextType {
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
}

const SidebarCollapseContext = createContext<SidebarCollapseContextType | undefined>(undefined);

export function SidebarCollapseProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <SidebarCollapseContext.Provider value={{ collapsed, setCollapsed }}>
      {children}
    </SidebarCollapseContext.Provider>
  );
}

export function useSidebarCollapse() {
  const context = useContext(SidebarCollapseContext);
  if (context === undefined) {
    return { collapsed: false, setCollapsed: () => {} };
  }
  return context;
}
