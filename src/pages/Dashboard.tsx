import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Plus, TrendingUp, Target, Brain, Flag, AlertTriangle } from "lucide-react";
import { calculateTiger5 } from "@/lib/tiger5";
import { cn } from "@/lib/utils";

interface RoundHoleRow {
  hole_par: number;
  score: number | null;
  putts: number | null;
  mental_commitment: string | null;
  approach_zone: string | null;
  approach_target: string | null;
  approach_error_side: string | null;
  gir: boolean | null;
  gir_proximity_bucket: string | null;
  first_putt_bucket: string | null;
  penalties: number;
  tee_result: string | null;
}

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [holes, setHoles] = useState<RoundHoleRow[]>([]);
  const [roundCount, setRoundCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    // Fetch last 10 rounds' holes
    supabase
      .from("rounds")
      .select("id")
      .eq("owner_id", user.id)
      .order("played_at", { ascending: false })
      .limit(10)
      .then(async ({ data: rounds }) => {
        const ids = rounds?.map((r) => r.id) ?? [];
        setRoundCount(ids.length);
        if (ids.length === 0) { setLoading(false); return; }
        const { data } = await supabase
          .from("round_holes")
          .select("hole_par, score, putts, mental_commitment, approach_zone, approach_target, approach_error_side, gir, gir_proximity_bucket, first_putt_bucket, penalties, tee_result")
          .in("round_id", ids);
        setHoles((data ?? []) as RoundHoleRow[]);
        setLoading(false);
      });
  }, [user]);

  if (loading) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-lg space-y-4 px-4 pt-12">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />)}
        </div>
      </AppLayout>
    );
  }

  if (roundCount === 0) {
    return (
      <AppLayout>
        <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
          <div className="mb-4 text-5xl">⛳</div>
          <h1 className="mb-2 text-2xl font-bold">Golf Tracker</h1>
          <p className="mb-6 text-muted-foreground">Registra tu primera ronda para ver tus métricas DECADE</p>
          <Button size="xl" onClick={() => navigate("/rondas/nueva")}>
            <Plus className="mr-2 h-5 w-5" /> Nueva Ronda
          </Button>
        </div>
      </AppLayout>
    );
  }

  // Calculations
  const scoredHoles = holes.filter((h) => h.score != null);
  const totalHoles = scoredHoles.length;

  // Tiger 5
  const tiger5 = scoredHoles.map(calculateTiger5);
  const tiger5Total = tiger5.reduce((s, t) => s + t.count, 0);
  const tiger5ByType = {
    bogeyPar5: tiger5.filter((t) => t.bogeyPar5).length,
    doublePlus: tiger5.filter((t) => t.doublePlus).length,
    threePutt: tiger5.filter((t) => t.threePutt).length,
    bogeyWithWedge: tiger5.filter((t) => t.bogeyWithWedge).length,
    penalty: tiger5.filter((t) => t.penalty).length,
  };

  // Mental
  const mental = { perfecto: 0, dude_en_1: 0, perdi_el_foco: 0 };
  scoredHoles.forEach((h) => {
    if (h.mental_commitment && h.mental_commitment in mental) mental[h.mental_commitment as keyof typeof mental]++;
  });
  const mentalTotal = mental.perfecto + mental.dude_en_1 + mental.perdi_el_foco;
  const mentalPct = mentalTotal > 0 ? Math.round((mental.perfecto / mentalTotal) * 100) : 0;

  // Discipline
  const withTarget = scoredHoles.filter((h) => h.approach_target != null);
  const banderaCount = withTarget.filter((h) => h.approach_target === "bandera").length;
  const ladoMalo = scoredHoles.filter((h) => h.approach_error_side === "lado_malo").length;
  const withError = scoredHoles.filter((h) => h.approach_error_side != null).length;

  // GIR
  const girHoles = scoredHoles.filter((h) => h.gir != null);
  const girCount = girHoles.filter((h) => h.gir).length;
  const girPct = girHoles.length > 0 ? Math.round((girCount / girHoles.length) * 100) : 0;

  // 3-putt
  const puttHoles = scoredHoles.filter((h) => h.putts != null);
  const threePuttCount = puttHoles.filter((h) => (h.putts ?? 0) >= 3).length;
  const threePuttPct = puttHoles.length > 0 ? Math.round((threePuttCount / puttHoles.length) * 100) : 0;

  return (
    <AppLayout>
      <div className="mx-auto max-w-lg space-y-4 px-4 pt-10 pb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <span className="text-xs text-muted-foreground">Últimas {roundCount} rondas · {totalHoles} hoyos</span>
        </div>

        {/* Tiger 5 */}
        <KPICard
          icon={<AlertTriangle className="h-5 w-5 text-tiger" />}
          title="Tiger 5"
          value={tiger5Total.toString()}
          subtitle={`${(tiger5Total / Math.max(roundCount, 1)).toFixed(1)} por ronda`}
          variant="tiger"
        >
          <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
            <span>Bogey en Par 5: {tiger5ByType.bogeyPar5}</span>
            <span>Doble+: {tiger5ByType.doublePlus}</span>
            <span>3-Putt: {tiger5ByType.threePutt}</span>
            <span>Bogey c/Wedge: {tiger5ByType.bogeyWithWedge}</span>
            <span>Penalidad: {tiger5ByType.penalty}</span>
          </div>
        </KPICard>

        {/* Mental Score */}
        <KPICard
          icon={<Brain className="h-5 w-5 text-primary" />}
          title="Mental Score"
          value={`${mentalPct}%`}
          subtitle="Rutina perfecta"
        >
          <div className="mt-2 flex gap-3 text-xs">
            <span>🟢 {mental.perfecto}</span>
            <span>🟡 {mental.dude_en_1}</span>
            <span>🔴 {mental.perdi_el_foco}</span>
          </div>
        </KPICard>

        {/* Discipline */}
        <KPICard
          icon={<Target className="h-5 w-5 text-primary" />}
          title="Disciplina de Approach"
          value={withTarget.length > 0 ? `${Math.round(((withTarget.length - banderaCount) / withTarget.length) * 100)}%` : "–"}
          subtitle="Target a centro green"
        >
          <div className="mt-2 text-xs space-y-1">
            <p>Bandera: {banderaCount} / {withTarget.length}</p>
            <p>Lado malo: {ladoMalo} / {withError} ({withError > 0 ? Math.round((ladoMalo / withError) * 100) : 0}%)</p>
          </div>
        </KPICard>

        <div className="grid grid-cols-2 gap-4">
          {/* GIR */}
          <KPICard
            icon={<Flag className="h-5 w-5 text-success" />}
            title="GIR"
            value={`${girPct}%`}
            subtitle={`${girCount}/${girHoles.length}`}
          />

          {/* 3-putt */}
          <KPICard
            icon={<TrendingUp className="h-5 w-5 text-warning" />}
            title="3-Putt"
            value={`${threePuttPct}%`}
            subtitle={`${threePuttCount}/${puttHoles.length}`}
          />
        </div>
      </div>
    </AppLayout>
  );
};

const KPICard = ({
  icon,
  title,
  value,
  subtitle,
  variant,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  subtitle: string;
  variant?: "tiger";
  children?: React.ReactNode;
}) => (
  <div className={cn(
    "rounded-xl border border-border bg-card p-4",
    variant === "tiger" && "border-tiger/30 bg-tiger/5"
  )}>
    <div className="flex items-start gap-3">
      {icon}
      <div className="flex-1">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
    {children}
  </div>
);

export default Dashboard;
