import { useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, ClipboardList, MapPin, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { path: "/", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/rondas", icon: ClipboardList, label: "Rondas" },
  { path: "/campos", icon: MapPin, label: "Campos" },
  { path: "/perfil", icon: UserCircle, label: "Perfil" },
];

export const BottomTabBar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md safe-area-bottom">
      <div className="mx-auto flex max-w-lg items-stretch">
        {tabs.map((tab) => (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2 pt-2.5 text-[10px] font-medium transition-colors tap-highlight-none",
              isActive(tab.path) ? "text-primary" : "text-muted-foreground"
            )}
          >
            <tab.icon className={cn("h-5 w-5", isActive(tab.path) && "stroke-[2.5px]")} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};
