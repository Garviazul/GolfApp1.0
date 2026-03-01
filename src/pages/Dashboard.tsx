import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Brain,
  ClipboardCheck,
  Flag,
  Plus,
  ShieldAlert,
  Target,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { MetricInfoDialog, type MetricInfoContent } from "@/components/MetricInfoDialog";
import { calculateTiger5 } from "@/lib/tiger5";
import { aggregateSg, buildSub80Coaching, calculateStrokesGainedProxy } from "@/lib/strokesGained";
import { cn } from "@/lib/utils";

interface RoundHoleRow {
  round_id: string;
  hole_par: number;
  score: number | null;
  putts: number | null;
  mental_commitment: string | null;
  approach_zone: string | null;
  approach_lie: string | null;
  approach_target: string | null;
  approach_error_side: string | null;
  gir: boolean | null;
  gir_proximity_bucket: string | null;
  first_putt_bucket: string | null;
  penalties: number;
  tee_result: string | null;
  scrambling_attempt: boolean;
  scrambling_success: boolean | null;
  sg_off_tee: number | null;
  sg_approach: number | null;
  sg_short_game: number | null;
  sg_putting: number | null;
  sg_total: number | null;
  sg_confidence: string | null;
  sg_model_version: string | null;
}

interface DashboardMetrics {
  totalHoles: number;
  tiger5Total: number;
  tiger5ByType: {
    bogeyPar5: number;
    doublePlus: number;
    threePutt: number;
    blownEasySave: number;
    bogeyShortIron: number;
  };
  mental: { perfecto: number; dude_en_1: number; perdi_el_foco: number };
  mentalPct: number | null;
  centerTargetPct: number | null;
  withTargetCount: number;
  banderaCount: number;
  ladoMalo: number;
  withError: number;
  girPct: number | null;
  girCount: number;
  girTotal: number;
  threePuttPct: number | null;
  threePuttCount: number;
  puttTotal: number;
  fairwayPct: number | null;
  fairways: number;
  fairwayTotal: number;
  scramblingPct: number | null;
  scramblingMade: number;
  scramblingTotal: number;
  penaltiesPerHole: number | null;
  penaltyHoles: number;
  penaltyHolePct: number | null;
  completenessPct: number | null;
  completeHoles: number;
  sgTotalAvg: number | null;
  sgOffTeeAvg: number | null;
  sgApproachAvg: number | null;
  sgShortGameAvg: number | null;
  sgPuttingAvg: number | null;
  sgHighConfidencePct: number | null;
}

type WindowSize = 5 | 10 | 20;

const WINDOW_OPTIONS: WindowSize[] = [5, 10, 20];

const TIGER5_INFO: MetricInfoContent = {
  title: "Tiger 5",
  what: "Cuenta los 5 errores que más penalizan el resultado en jugadores competitivos.",
  calculation:
    "Suma por hoyo: bogey en par 5, doble bogey o peor, 3 putts, no salvar hoyos sin GIR y bogey tras approach corto (<135m).",
  target: "Sub-80: bajar tu media progresivamente y sostener tendencia descendente en bloques de 10-20 rondas.",
  improve: [
    "Prioriza estrategia de centro de green en situaciones de riesgo.",
    "Reduce errores dobles con decisiones conservadoras tras un mal golpe.",
    "Entrena control de distancia para evitar 3 putts.",
  ],
};

const MENTAL_INFO: MetricInfoContent = {
  title: "Mental Score",
  what: "Mide tu disciplina mental en cada hoyo según calidad de rutina y compromiso de golpe.",
  calculation:
    "Porcentaje de hoyos con 'Rutina perfecta' sobre hoyos con registro mental (perfecto, dudé en 1, perdí el enfoque).",
  target: "Sub-80: mantener un porcentaje alto y estable, minimizando episodios rojos en tramos clave de la vuelta.",
  improve: [
    "Estandariza una rutina pre-golpe corta y repetible.",
    "Si dudas, reinicia el proceso antes de ejecutar.",
    "Evalúa foco por bloques de 3 hoyos para corregir durante la ronda.",
  ],
};

const SG_INFO: MetricInfoContent = {
  title: "Strokes Gained (Beta Elite)",
  what: "Estimación por categorías (tee, approach, juego corto y putting) para detectar dónde ganas o pierdes golpes.",
  calculation:
    "Modelo v1 por buckets: combina lie, zona de approach, GIR, distancia 1er putt, putts y penalidades.",
  target: "Sub-80: llevar SG Total a positivo y evitar una categoría claramente negativa por ventana.",
  improve: [
    "Ataca primero la categoría más débil durante 2-3 semanas.",
    "Revisa tendencia en ventanas de 10 y 20 rondas.",
    "Mantén alta calidad de registro para aumentar confianza del cálculo.",
  ],
};

const formatPct = (value: number | null) => (value == null ? "–" : `${value}%`);
const formatSg = (value: number | null) => (value == null ? "–" : `${value > 0 ? "+" : ""}${value.toFixed(2)}`);

const buildDelta = (
  current: number | null,
  previous: number | null,
  decimals = 0,
  unit = "pp",
) => {
  if (current == null || previous == null) return undefined;

  const diff = Number((current - previous).toFixed(decimals));
  if (diff === 0) return "Sin cambio vs periodo previo";

  const suffix = unit.length > 0 ? unit : "";
  const sign = diff > 0 ? "+" : "";
  const formatted = decimals > 0 ? diff.toFixed(decimals) : diff.toString();
  return `${sign}${formatted}${suffix} vs periodo previo`;
};

const calculateMetrics = (holes: RoundHoleRow[]): DashboardMetrics => {
  const scoredHoles = holes.filter((h) => h.score != null);
  const totalHoles = scoredHoles.length;

  const tiger5 = scoredHoles.map(calculateTiger5);
  const tiger5Total = tiger5.reduce((sum, row) => sum + row.count, 0);
  const tiger5ByType = {
    bogeyPar5: tiger5.filter((row) => row.bogeyPar5).length,
    doublePlus: tiger5.filter((row) => row.doublePlus).length,
    threePutt: tiger5.filter((row) => row.threePutt).length,
    blownEasySave: tiger5.filter((row) => row.blownEasySave).length,
    bogeyShortIron: tiger5.filter((row) => row.bogeyShortIron).length,
  };

  const mental = { perfecto: 0, dude_en_1: 0, perdi_el_foco: 0 };
  scoredHoles.forEach((h) => {
    if (h.mental_commitment && h.mental_commitment in mental) {
      mental[h.mental_commitment as keyof typeof mental] += 1;
    }
  });
  const mentalTotal = mental.perfecto + mental.dude_en_1 + mental.perdi_el_foco;
  const mentalPct = mentalTotal > 0 ? Math.round((mental.perfecto / mentalTotal) * 100) : null;

  const approachHoles = scoredHoles.filter((h) => h.hole_par >= 4);
  const withTarget = approachHoles.filter((h) => h.approach_target != null);
  const banderaCount = withTarget.filter((h) => h.approach_target === "bandera").length;
  const centerTargetPct =
    withTarget.length > 0 ? Math.round(((withTarget.length - banderaCount) / withTarget.length) * 100) : null;
  const withErrorRows = approachHoles.filter((h) => h.approach_error_side != null);
  const ladoMalo = withErrorRows.filter((h) => h.approach_error_side === "lado_malo").length;
  const withError = withErrorRows.length;

  const girHoles = scoredHoles.filter((h) => h.gir != null);
  const girCount = girHoles.filter((h) => h.gir).length;
  const girPct = girHoles.length > 0 ? Math.round((girCount / girHoles.length) * 100) : null;

  const puttHoles = scoredHoles.filter((h) => h.putts != null);
  const threePuttCount = puttHoles.filter((h) => (h.putts ?? 0) >= 3).length;
  const threePuttPct = puttHoles.length > 0 ? Math.round((threePuttCount / puttHoles.length) * 100) : null;

  const fairwayTracked = scoredHoles.filter((h) => h.hole_par >= 4 && h.tee_result != null);
  const fairways = fairwayTracked.filter((h) => h.tee_result === "calle").length;
  const fairwayPct = fairwayTracked.length > 0 ? Math.round((fairways / fairwayTracked.length) * 100) : null;

  const scramblingTracked = scoredHoles.filter((h) => h.gir === false && h.scrambling_success != null);
  const scramblingMade = scramblingTracked.filter((h) => h.scrambling_success === true).length;
  const scramblingPct =
    scramblingTracked.length > 0 ? Math.round((scramblingMade / scramblingTracked.length) * 100) : null;

  const penaltiesTotal = scoredHoles.reduce((sum, h) => sum + (h.penalties ?? 0), 0);
  const penaltyHoles = scoredHoles.filter((h) => h.penalties > 0 || h.tee_result === "penalidad").length;
  const penaltiesPerHole = totalHoles > 0 ? Number((penaltiesTotal / totalHoles).toFixed(2)) : null;
  const penaltyHolePct = totalHoles > 0 ? Math.round((penaltyHoles / totalHoles) * 100) : null;

  const completeHoles = scoredHoles.filter(
    (h) =>
      h.mental_commitment != null &&
      h.tee_result != null &&
      (h.hole_par === 3 ||
        (h.approach_zone != null &&
          h.approach_lie != null &&
          h.approach_target != null &&
          h.approach_error_side != null)) &&
      h.gir != null &&
      h.putts != null &&
      h.first_putt_bucket != null,
  ).length;
  const completenessPct = totalHoles > 0 ? Math.round((completeHoles / totalHoles) * 100) : null;

  const sgRows = scoredHoles.map((h) => {
    const estimated = calculateStrokesGainedProxy(h);
    return {
      offTee: h.sg_off_tee ?? estimated.offTee,
      approach: h.sg_approach ?? estimated.approach,
      shortGame: h.sg_short_game ?? estimated.shortGame,
      putting: h.sg_putting ?? estimated.putting,
      total: h.sg_total ?? estimated.total,
      confidence: (h.sg_confidence as "low" | "medium" | "high" | null) ?? estimated.confidence,
    };
  });
  const sgAgg = aggregateSg(sgRows);
  const sgHighConfidenceCount = sgRows.filter((row) => row.confidence === "high").length;
  const sgHighConfidencePct = sgRows.length > 0 ? Math.round((sgHighConfidenceCount / sgRows.length) * 100) : null;

  return {
    totalHoles,
    tiger5Total,
    tiger5ByType,
    mental,
    mentalPct,
    centerTargetPct,
    withTargetCount: withTarget.length,
    banderaCount,
    ladoMalo,
    withError,
    girPct,
    girCount,
    girTotal: girHoles.length,
    threePuttPct,
    threePuttCount,
    puttTotal: puttHoles.length,
    fairwayPct,
    fairways,
    fairwayTotal: fairwayTracked.length,
    scramblingPct,
    scramblingMade,
    scramblingTotal: scramblingTracked.length,
    penaltiesPerHole,
    penaltyHoles,
    penaltyHolePct,
    completenessPct,
    completeHoles,
    sgTotalAvg: sgAgg.total,
    sgOffTeeAvg: sgAgg.offTee,
    sgApproachAvg: sgAgg.approach,
    sgShortGameAvg: sgAgg.shortGame,
    sgPuttingAvg: sgAgg.putting,
    sgHighConfidencePct,
  };
};

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [roundWindow, setRoundWindow] = useState<WindowSize>(10);
  const [roundCount, setRoundCount] = useState(0);
  const [previousRoundCount, setPreviousRoundCount] = useState(0);
  const [holes, setHoles] = useState<RoundHoleRow[]>([]);
  const [previousHoles, setPreviousHoles] = useState<RoundHoleRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let active = true;

    const fetchDashboardData = async () => {
      setLoading(true);

      const { data: rounds } = await supabase
        .from("rounds")
        .select("id")
        .eq("owner_id", user.id)
        .order("played_at", { ascending: false })
        .limit(roundWindow * 2);

      if (!active) return;

      const allIds = rounds?.map((round) => round.id) ?? [];
      const currentIds = allIds.slice(0, roundWindow);
      const previousIds = allIds.slice(roundWindow, roundWindow * 2);
      setRoundCount(currentIds.length);
      setPreviousRoundCount(previousIds.length);

      if (currentIds.length === 0) {
        setHoles([]);
        setPreviousHoles([]);
        setLoading(false);
        return;
      }

      const idsToFetch = [...currentIds, ...previousIds];
      const { data: allHoles } = await supabase
        .from("round_holes")
        .select(
          "round_id, hole_par, score, putts, mental_commitment, approach_zone, approach_lie, approach_target, approach_error_side, gir, gir_proximity_bucket, first_putt_bucket, penalties, tee_result, scrambling_attempt, scrambling_success, sg_off_tee, sg_approach, sg_short_game, sg_putting, sg_total, sg_confidence, sg_model_version",
        )
        .in("round_id", idsToFetch);

      if (!active) return;

      const rows = (allHoles ?? []) as RoundHoleRow[];
      const currentSet = new Set(currentIds);
      const previousSet = new Set(previousIds);
      setHoles(rows.filter((hole) => currentSet.has(hole.round_id)));
      setPreviousHoles(rows.filter((hole) => previousSet.has(hole.round_id)));
      setLoading(false);
    };

    fetchDashboardData();
    return () => {
      active = false;
    };
  }, [roundWindow, user]);

  const metrics = useMemo(() => calculateMetrics(holes), [holes]);
  const previousMetrics = useMemo(() => calculateMetrics(previousHoles), [previousHoles]);

  const tigerPerRound = roundCount > 0 ? metrics.tiger5Total / roundCount : null;
  const previousTigerPerRound = previousRoundCount > 0 ? previousMetrics.tiger5Total / previousRoundCount : null;
  const coachingPlan = useMemo(
    () =>
      buildSub80Coaching({
        sg: {
          total: metrics.sgTotalAvg,
          offTee: metrics.sgOffTeeAvg,
          approach: metrics.sgApproachAvg,
          shortGame: metrics.sgShortGameAvg,
          putting: metrics.sgPuttingAvg,
        },
        mentalPct: metrics.mentalPct,
        tigerPerRound,
      }),
    [metrics, tigerPerRound],
  );

  if (loading) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-lg space-y-4 px-4 pb-4 pt-12">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
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

  return (
    <AppLayout>
      <div className="mx-auto max-w-lg space-y-4 px-4 pb-4 pt-10">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <span className="text-xs text-muted-foreground">
              Últimas {roundCount} rondas · {metrics.totalHoles} hoyos
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Ventana:</span>
            {WINDOW_OPTIONS.map((window) => (
              <Button
                key={window}
                variant="chip"
                size="chip"
                data-active={roundWindow === window}
                onClick={() => setRoundWindow(window)}
              >
                {window}
              </Button>
            ))}
          </div>
          {previousRoundCount === 0 && (
            <p className="text-xs text-muted-foreground">
              Sin periodo previo suficiente para comparar en esta ventana.
            </p>
          )}
        </div>

        <KPICard
          icon={<AlertTriangle className="h-5 w-5 text-tiger" />}
          title="Tiger 5"
          value={metrics.tiger5Total.toString()}
          subtitle={`${(tigerPerRound ?? 0).toFixed(1)} por ronda`}
          comparison={buildDelta(tigerPerRound, previousTigerPerRound, 1, "")}
          variant="tiger"
          info={TIGER5_INFO}
        >
          <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
            <span>Bogey en Par 5: {metrics.tiger5ByType.bogeyPar5}</span>
            <span>Doble+: {metrics.tiger5ByType.doublePlus}</span>
            <span>3-Putt: {metrics.tiger5ByType.threePutt}</span>
            <span>No salva sin GIR: {metrics.tiger5ByType.blownEasySave}</span>
            <span>Bogey approach corto: {metrics.tiger5ByType.bogeyShortIron}</span>
          </div>
        </KPICard>

        <KPICard
          icon={<Brain className="h-5 w-5 text-primary" />}
          title="Mental Score"
          value={formatPct(metrics.mentalPct)}
          subtitle="Rutina perfecta"
          comparison={buildDelta(metrics.mentalPct, previousMetrics.mentalPct)}
          info={MENTAL_INFO}
        >
          <div className="mt-2 flex gap-3 text-xs">
            <span>🟢 {metrics.mental.perfecto}</span>
            <span>🟡 {metrics.mental.dude_en_1}</span>
            <span>🔴 {metrics.mental.perdi_el_foco}</span>
          </div>
        </KPICard>

        <KPICard
          icon={<Target className="h-5 w-5 text-primary" />}
          title="Disciplina de Approach"
          value={formatPct(metrics.centerTargetPct)}
          subtitle="Target a centro green"
          comparison={buildDelta(metrics.centerTargetPct, previousMetrics.centerTargetPct)}
        >
          <div className="mt-2 space-y-1 text-xs">
            <p>
              Bandera: {metrics.banderaCount} / {metrics.withTargetCount}
            </p>
            <p>
              Lado malo: {metrics.ladoMalo} / {metrics.withError} (
              {metrics.withError > 0 ? Math.round((metrics.ladoMalo / metrics.withError) * 100) : 0}%)
            </p>
          </div>
        </KPICard>

        <KPICard
          icon={<ShieldAlert className="h-5 w-5 text-warning" />}
          title="Penalidades"
          value={metrics.penaltiesPerHole == null ? "–" : metrics.penaltiesPerHole.toFixed(2)}
          subtitle="Promedio por hoyo"
          comparison={buildDelta(metrics.penaltiesPerHole, previousMetrics.penaltiesPerHole, 2, "")}
        >
          <p className="mt-2 text-xs text-muted-foreground">
            Hoyos con penalidad: {metrics.penaltyHoles}/{metrics.totalHoles} (
            {metrics.penaltyHolePct ?? 0}%)
          </p>
        </KPICard>

        <KPICard
          icon={<Activity className="h-5 w-5 text-primary" />}
          title="SG Total (Beta Elite)"
          value={formatSg(metrics.sgTotalAvg)}
          subtitle="Promedio por hoyo"
          comparison={buildDelta(metrics.sgTotalAvg, previousMetrics.sgTotalAvg, 2, "")}
          info={SG_INFO}
        >
          <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
            <span>SG Tee: {formatSg(metrics.sgOffTeeAvg)}</span>
            <span>SG Approach: {formatSg(metrics.sgApproachAvg)}</span>
            <span>SG Short Game: {formatSg(metrics.sgShortGameAvg)}</span>
            <span>SG Putting: {formatSg(metrics.sgPuttingAvg)}</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Confianza alta en el cálculo: {metrics.sgHighConfidencePct ?? 0}% de hoyos.
          </p>
        </KPICard>

        <div className="grid grid-cols-2 gap-4">
          <KPICard
            icon={<Flag className="h-5 w-5 text-success" />}
            title="GIR"
            value={formatPct(metrics.girPct)}
            subtitle={`${metrics.girCount}/${metrics.girTotal}`}
            comparison={buildDelta(metrics.girPct, previousMetrics.girPct)}
          />

          <KPICard
            icon={<TrendingUp className="h-5 w-5 text-warning" />}
            title="3-Putt"
            value={formatPct(metrics.threePuttPct)}
            subtitle={`${metrics.threePuttCount}/${metrics.puttTotal}`}
            comparison={buildDelta(metrics.threePuttPct, previousMetrics.threePuttPct)}
          />

          <KPICard
            icon={<Activity className="h-5 w-5 text-primary" />}
            title="Fairway"
            value={formatPct(metrics.fairwayPct)}
            subtitle={`${metrics.fairways}/${metrics.fairwayTotal}`}
            comparison={buildDelta(metrics.fairwayPct, previousMetrics.fairwayPct)}
          />

          <KPICard
            icon={<ClipboardCheck className="h-5 w-5 text-success" />}
            title="Scrambling"
            value={formatPct(metrics.scramblingPct)}
            subtitle={`${metrics.scramblingMade}/${metrics.scramblingTotal}`}
            comparison={buildDelta(metrics.scramblingPct, previousMetrics.scramblingPct)}
          />
        </div>

        <KPICard
          icon={<ClipboardCheck className="h-5 w-5 text-primary" />}
          title="Calidad de Registro"
          value={formatPct(metrics.completenessPct)}
          subtitle={`${metrics.completeHoles}/${metrics.totalHoles} hoyos completos`}
          comparison={buildDelta(metrics.completenessPct, previousMetrics.completenessPct)}
        />

        <KPICard
          icon={<ClipboardCheck className="h-5 w-5 text-primary" />}
          title="Focos Semanales (Sub80)"
          value={coachingPlan.length.toString()}
          subtitle="Prioridades automáticas"
        >
          <div className="mt-2 space-y-2 text-xs">
            {coachingPlan.length === 0 ? (
              <p className="text-muted-foreground">Sin focos críticos en esta ventana.</p>
            ) : (
              coachingPlan.map((item) => (
                <div key={item.title} className="rounded-md border border-border bg-muted/40 p-2">
                  <p className="font-semibold">{item.title}</p>
                  <p className="mt-1 text-muted-foreground">{item.detail}</p>
                </div>
              ))
            )}
          </div>
        </KPICard>
      </div>
    </AppLayout>
  );
};

const KPICard = ({
  icon,
  title,
  value,
  subtitle,
  comparison,
  variant,
  info,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  subtitle: string;
  comparison?: string;
  variant?: "tiger";
  info?: MetricInfoContent;
  children?: React.ReactNode;
}) => (
  <div className={cn("rounded-xl border border-border bg-card p-4", variant === "tiger" && "border-tiger/30 bg-tiger/5")}>
    <div className="flex items-start gap-3">
      {icon}
      <div className="flex-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          {info && <MetricInfoDialog content={info} className="-mr-1 -mt-1" />}
        </div>
      </div>
    </div>
    {comparison && <p className="mt-2 text-[11px] text-muted-foreground">{comparison}</p>}
    {children}
  </div>
);

export default Dashboard;
