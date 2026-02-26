import { ReactNode } from "react";
import { BottomTabBar } from "./BottomTabBar";

export const AppLayout = ({ children, hideTabBar = false }: { children: ReactNode; hideTabBar?: boolean }) => {
  return (
    <div className="min-h-screen bg-background">
      <main className={hideTabBar ? "" : "pb-20"}>
        {children}
      </main>
      {!hideTabBar && <BottomTabBar />}
    </div>
  );
};
