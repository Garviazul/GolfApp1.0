import { ReactNode } from "react";
import { BottomTabBar } from "./BottomTabBar";

export const AppLayout = ({ children, hideTabBar = false }: { children: ReactNode; hideTabBar?: boolean }) => {
  return (
    <div className="app-shell bg-background">
      <main className={hideTabBar ? "" : "pb-tabbar"}>
        {children}
      </main>
      {!hideTabBar && <BottomTabBar />}
    </div>
  );
};
