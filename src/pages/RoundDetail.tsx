import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface RoundHole {
  hole_number: number;
  hole_par: number;
  score: number | null;
  putts: number | null;
  gir: boolean | null;
  mental_commitment: string | null;
  penalties: number;
}

const RoundDetail = () => {
  const { roundId } = useParams<{ roundId: string }>();
  const navigate = useNavigate();
  const [courseName, setCourseName] = useState("");
  const [playedAt, setPlayedAt] = useState("");
  const [holes, setHoles] = useState<RoundHole[]>([]);

  useEffect(() => {
    if (!roundId) return;
    supabase.from("rounds").select("played_at, courses(name)").eq("id", roundId).single().then(({ data }) => {
      if (data) {
        setPlayedAt(data.played_at);
        setCourseName((data.courses as any)?.name ?? "");
      }
    });
    supabase.from("round_holes").select("hole_number, hole_par, score, putts, gir, mental_commitment, penalties")
      .eq("round_id", roundId).order("hole_number").then(({ data }) => {
        setHoles((data ?? []) as RoundHole[]);
      });
  }, [roundId]);

  const totalScore = holes.reduce((s, h) => s + (h.score ?? 0), 0);
  const totalPar = holes.reduce((s, h) => s + h.hole_par, 0);
  const diff = totalScore - totalPar;

  const handleDelete = async () => {
    if (!confirm("¿Eliminar esta ronda?")) return;
    await supabase.from("rounds").delete().eq("id", roundId!);
    toast.success("Ronda eliminada");
    navigate("/rondas");
  };

  return (
    <AppLayout hideTabBar>
      <div className="mx-auto max-w-lg px-4 pt-4">
        <div className="mb-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/rondas")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">{courseName}</h1>
            <p className="text-xs text-muted-foreground">{playedAt && new Date(playedAt).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => navigate(`/rondas/${roundId}/hoyo/1`)}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>

        {/* Summary */}
        <div className="mb-4 flex items-center justify-center gap-6 rounded-xl bg-primary p-4 text-primary-foreground">
          <div className="text-center">
            <p className="text-3xl font-bold">{totalScore || "–"}</p>
            <p className="text-xs opacity-70">Total</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold">{diff > 0 ? `+${diff}` : diff || "E"}</p>
            <p className="text-xs opacity-70">vs Par</p>
          </div>
        </div>

        {/* Scorecard */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="grid grid-cols-[2.5rem_1fr_2.5rem_2.5rem_2.5rem] gap-0 border-b border-border px-2 py-2 text-[10px] font-semibold text-muted-foreground">
            <span>Hoyo</span><span></span><span className="text-center">Par</span><span className="text-center">Sc.</span><span className="text-center">Pt.</span>
          </div>
          {holes.map((h) => {
            const scoreDiff = (h.score ?? 0) - h.hole_par;
            return (
              <div
                key={h.hole_number}
                onClick={() => navigate(`/rondas/${roundId}/hoyo/${h.hole_number}`)}
                className="grid cursor-pointer grid-cols-[2.5rem_1fr_2.5rem_2.5rem_2.5rem] items-center gap-0 border-b border-border/50 px-2 py-2 text-sm last:border-0 tap-highlight-none hover:bg-secondary"
              >
                <span className="font-bold text-primary">{h.hole_number}</span>
                <span className="text-[10px]">
                  {h.mental_commitment === "perfecto" && "🟢"}
                  {h.mental_commitment === "dude_en_1" && "🟡"}
                  {h.mental_commitment === "perdi_el_foco" && "🔴"}
                  {h.gir && " ✅"}
                  {h.penalties > 0 && " ⚠️"}
                </span>
                <span className="text-center text-muted-foreground">{h.hole_par}</span>
                <span className={cn(
                  "text-center font-bold",
                  scoreDiff < 0 && "text-success",
                  scoreDiff === 0 && "text-foreground",
                  scoreDiff === 1 && "text-warning",
                  scoreDiff >= 2 && "text-tiger",
                )}>
                  {h.score ?? "–"}
                </span>
                <span className={cn("text-center", (h.putts ?? 0) >= 3 && "text-tiger font-bold")}>{h.putts ?? "–"}</span>
              </div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
};

export default RoundDetail;
