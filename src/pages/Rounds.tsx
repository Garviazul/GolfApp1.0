import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Plus, ChevronRight, ClipboardList } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Round {
  id: string;
  played_at: string;
  notes: string | null;
  courses: { name: string } | null;
}

const Rounds = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("rounds")
      .select("id, played_at, notes, courses(name)")
      .eq("owner_id", user.id)
      .order("played_at", { ascending: false })
      .then(({ data }) => {
        setRounds((data as unknown as Round[]) ?? []);
        setLoading(false);
      });
  }, [user]);

  return (
    <AppLayout>
      <div className="mx-auto max-w-lg px-4 pt-12">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Rondas</h1>
          <Button size="sm" onClick={() => navigate("/rondas/nueva")}>
            <Plus className="h-4 w-4" /> Nueva
          </Button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />)}
          </div>
        ) : rounds.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <ClipboardList className="mx-auto mb-3 h-10 w-10 opacity-40" />
            <p className="font-medium">Sin rondas aún</p>
            <p className="text-sm">Registra tu primera ronda</p>
            <Button className="mt-4" onClick={() => navigate("/rondas/nueva")}>
              <Plus className="mr-2 h-4 w-4" /> Nueva Ronda
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {rounds.map((r) => (
              <button
                key={r.id}
                onClick={() => navigate(`/rondas/${r.id}`)}
                className="flex w-full items-center justify-between rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-secondary tap-highlight-none active:scale-[0.98]"
              >
                <div>
                  <p className="font-semibold">{r.courses?.name ?? "Campo"}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.played_at).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Rounds;
