import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, ChevronLeft } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FfIcon } from "@/components/FfIcon";
import { MetricInfoDialog, type MetricInfoContent } from "@/components/MetricInfoDialog";
import { calculateTiger5 } from "@/lib/tiger5";
import { calculateStrokesGainedProxy } from "@/lib/strokesGained";

interface HoleData {
  id: string;
  hole_number: number;
  hole_par: number;
  hole_meters_total: number;
  score: number | null;
  mental_commitment: string | null;
  tee_club: string | null;
  tee_result: string | null;
  approach_zone: string | null;
  approach_lie: string | null;
  approach_target: string | null;
  approach_error_side: string | null;
  gir: boolean | null;
  gir_proximity_bucket: string | null;
  putts: number | null;
  first_putt_bucket: string | null;
  first_putt_overridden: boolean;
  scrambling_attempt: boolean;
  scrambling_success: boolean | null;
  penalties: number;
  sg_off_tee: number | null;
  sg_approach: number | null;
  sg_short_game: number | null;
  sg_putting: number | null;
  sg_total: number | null;
  sg_confidence: "low" | "medium" | "high";
  sg_model_version: string;
}

const MENTAL = [
  { value: "perfecto", label: "Rutina perfecta", icon: "cloud-check", iconClass: "text-success" },
  { value: "dude_en_1", label: "Dudé en 1 golpe", icon: "triangle-warning", iconClass: "text-warning" },
  { value: "perdi_el_foco", label: "Perdí el enfoque", icon: "cross-circle", iconClass: "text-destructive" },
];

const TEE_CLUBS = [
  { value: "driver", label: "Driver" },
  { value: "madera", label: "Madera" },
  { value: "hierro", label: "Hierro" },
];

const TEE_RESULTS_PAR45 = [
  { value: "calle", label: "Calle", variant: "chip-success" as const },
  { value: "izquierda", label: "Izq", variant: "chip" as const },
  { value: "derecha", label: "Der", variant: "chip" as const },
  { value: "penalidad", label: "Penal.", variant: "chip-destructive" as const },
];

const TEE_RESULTS_PAR3 = [
  { value: "calle", label: "En green", variant: "chip-success" as const },
  { value: "izquierda", label: "Fallo izq", variant: "chip" as const },
  { value: "derecha", label: "Fallo der", variant: "chip" as const },
  { value: "penalidad", label: "Penal.", variant: "chip-destructive" as const },
];

const APPROACH_ZONES = ["<60", "60-90", "90-135", "135-180", ">180"];
const APPROACH_LIES = [
  { value: "fairway", label: "Fairway" },
  { value: "rough", label: "Rough" },
  { value: "bunker", label: "Bunker" },
  { value: "recovery", label: "Recovery" },
];
const PROXIMITY_BUCKETS = ["<3m", "3-5m", "5-10m", ">10m"];

const TIGER5_INFO: MetricInfoContent = {
  title: "Tiger 5",
  what: "Los 5 errores que más castigan el resultado. Se registran automáticamente por hoyo.",
  calculation:
    "Se activa cuando hay: bogey en par 5, doble bogey o peor, 3 putts, no salvar un hoyo sin GIR y bogey tras approach corto (<135m).",
  target: "Reducirlos de forma sostenida durante bloques de 10-20 rondas.",
  improve: [
    "Evita dobles con decisiones conservadoras tras un golpe malo.",
    "Elige centro de green cuando la bandera implique riesgo alto.",
    "Prioriza control de distancia para bajar 3 putts.",
  ],
};

const MENTAL_INFO: MetricInfoContent = {
  title: "Mental Score",
  what: "Mide tu compromiso con la rutina mental en cada hoyo.",
  calculation:
    "Cada hoyo se etiqueta como rutina perfecta, duda puntual o pérdida de foco. El dashboard usa estos registros para el porcentaje.",
  target: "Mantener la mayoría de hoyos en rutina perfecta.",
  improve: [
    "Mismo patrón pre-golpe para todos los palos.",
    "Si dudas, reinicia visualización y respiración.",
    "Evalúa cada 3 hoyos para corregir durante la ronda.",
  ],
};

const HoleCapture = () => {
  const { roundId, holeNum } = useParams<{ roundId: string; holeNum: string }>();
  const navigate = useNavigate();
  const currentHole = parseInt(holeNum ?? "1");
  const [hole, setHole] = useState<HoleData | null>(null);
  const [saving, setSaving] = useState(false);
  const [finishingRound, setFinishingRound] = useState(false);
  const [totalHoles, setTotalHoles] = useState(18);
  const [registeredHoles, setRegisteredHoles] = useState(0);

  const fetchRoundMeta = useCallback(async () => {
    if (!roundId) return;

    const [{ data: holes }, { data: round }] = await Promise.all([
      supabase.from("round_holes").select("hole_number").eq("round_id", roundId),
      supabase.from("rounds").select("status").eq("id", roundId).single(),
    ]);

    if (holes) setTotalHoles(holes.length);
    if (round?.status === "finished") {
      toast.info("Esta ronda ya está cerrada.");
      navigate(`/rondas/${roundId}`, { replace: true });
    }
  }, [navigate, roundId]);

  const fetchRegisteredHoles = useCallback(async () => {
    if (!roundId) return;
    const { count } = await supabase
      .from("round_holes")
      .select("id", { count: "exact", head: true })
      .eq("round_id", roundId)
      .not("score", "is", null);
    setRegisteredHoles(count ?? 0);
  }, [roundId]);

  const fetchHole = useCallback(async () => {
    if (!roundId) return;
    const { data } = await supabase
      .from("round_holes")
      .select("*")
      .eq("round_id", roundId)
      .eq("hole_number", currentHole)
      .single();
    if (data) setHole(data as unknown as HoleData);
  }, [roundId, currentHole]);

  useEffect(() => {
    fetchHole();
    fetchRoundMeta();
    fetchRegisteredHoles();
  }, [fetchHole, fetchRoundMeta, fetchRegisteredHoles]);

  const update = async (fields: Partial<HoleData>) => {
    if (!hole) return;

    // Auto-first putt logic
    let extra: Partial<HoleData> = {};
    if ("gir" in fields && fields.gir && fields.gir_proximity_bucket !== undefined) {
      extra.first_putt_bucket = fields.gir_proximity_bucket;
      extra.first_putt_overridden = false;
    }
    if ("gir_proximity_bucket" in fields && hole.gir && !hole.first_putt_overridden) {
      extra.first_putt_bucket = fields.gir_proximity_bucket!;
    }

    const updated = { ...hole, ...fields, ...extra };
    const sg = calculateStrokesGainedProxy(updated);
    const updatedWithSg: HoleData = {
      ...updated,
      sg_off_tee: sg.offTee,
      sg_approach: sg.approach,
      sg_short_game: sg.shortGame,
      sg_putting: sg.putting,
      sg_total: sg.total,
      sg_confidence: sg.confidence,
      sg_model_version: "v1_bucket_proxy",
    };
    setHole(updatedWithSg);

    setSaving(true);
    const { id, ...rest } = updatedWithSg;
    const { error } = await supabase.from("round_holes").update(rest).eq("id", id);
    setSaving(false);
    if (error) {
      toast.error("No se pudo guardar el hoyo");
      return;
    }
    await fetchRegisteredHoles();
  };

  const goToHole = (n: number) => {
    navigate(`/rondas/${roundId}/hoyo/${n}`, { replace: true });
  };

  const finishRound = async () => {
    if (!roundId) return;
    const confirmed = window.confirm("¿Seguro que quieres terminar y cerrar esta ronda?");
    if (!confirmed) return;

    setFinishingRound(true);
    const { error } = await supabase
      .from("rounds")
      .update({ status: "finished", finished_at: new Date().toISOString() })
      .eq("id", roundId);
    setFinishingRound(false);

    if (error) {
      toast.error("No se pudo cerrar la ronda");
      return;
    }

    toast.success("Ronda cerrada");
    navigate(`/rondas/${roundId}`, { replace: true });
  };

  if (!hole) return <div className="flex app-shell items-center justify-center text-muted-foreground">Cargando...</div>;

  const isPar3 = hole.hole_par === 3;
  const requiresApproach = hole.hole_par >= 4;
  const teeResults = isPar3 ? TEE_RESULTS_PAR3 : TEE_RESULTS_PAR45;

  const checklist: Array<{ label: string; done: boolean }> = [
    { label: "Score", done: hole.score != null },
    { label: "Mental", done: hole.mental_commitment != null },
    { label: isPar3 ? "Salida (Par 3)" : "Salida", done: hole.tee_result != null },
    { label: "GIR/No GIR", done: hole.gir != null },
    { label: "Putts", done: hole.putts != null },
    { label: "Distancia 1er putt", done: hole.first_putt_bucket != null },
  ];
  if (requiresApproach) {
    checklist.splice(3, 0, {
      label: "Approach",
      done:
        hole.approach_zone != null &&
        hole.approach_lie != null &&
        hole.approach_target != null &&
        hole.approach_error_side != null,
    });
  }
  const checklistDone = checklist.filter((item) => item.done).length;
  const checklistPct = Math.round((checklistDone / checklist.length) * 100);
  const missingChecklist = checklist.filter((item) => !item.done).map((item) => item.label);

  const tiger5 = calculateTiger5({
    hole_par: hole.hole_par,
    score: hole.score,
    putts: hole.putts,
    gir: hole.gir,
    scrambling_attempt: hole.scrambling_attempt,
    scrambling_success: hole.scrambling_success,
    approach_zone: hole.approach_zone,
  });
  const tiger5Flags = [
    tiger5.bogeyPar5 ? "Bogey en par 5" : null,
    tiger5.doublePlus ? "Doble bogey o peor" : null,
    tiger5.threePutt ? "3 putts" : null,
    tiger5.blownEasySave ? "No salvó sin GIR" : null,
    tiger5.bogeyShortIron ? "Bogey tras approach corto" : null,
  ].filter((flag): flag is string => Boolean(flag));

  const sgLive = calculateStrokesGainedProxy(hole);
  const sgOffTee = hole.sg_off_tee ?? sgLive.offTee;
  const sgApproach = hole.sg_approach ?? sgLive.approach;
  const sgShortGame = hole.sg_short_game ?? sgLive.shortGame;
  const sgPutting = hole.sg_putting ?? sgLive.putting;
  const sgTotal = hole.sg_total ?? sgLive.total;
  const sgConfidence = hole.sg_confidence ?? sgLive.confidence;
  const formatSg = (value: number | null) => (value == null ? "–" : `${value > 0 ? "+" : ""}${value.toFixed(2)}`);

  return (
    <div className="app-shell bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/rondas/${roundId}`)}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="text-center">
            <p className="text-lg font-bold">Hoyo {currentHole}</p>
            <p className="text-xs text-muted-foreground">Par {hole.hole_par} · {hole.hole_meters_total}m</p>
            <p className="text-xs text-muted-foreground">Hoyos registrados: {registeredHoles}</p>
          </div>
          <span className={cn("text-xs font-medium transition-opacity", saving ? "text-muted-foreground opacity-100" : "opacity-0")}>
            Guardando...
          </span>
        </div>
        {/* Hole dots */}
        <div className="flex justify-center gap-1 pb-2 px-4">
          {Array.from({ length: totalHoles }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => goToHole(n)}
              className={cn(
                "h-2 w-2 rounded-full transition-all tap-highlight-none",
                n === currentHole ? "bg-primary scale-125" : "bg-border hover:bg-muted-foreground/40"
              )}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-lg space-y-5 px-4 py-4 pb-[calc(6rem+env(safe-area-inset-bottom))]">
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Calidad de datos del hoyo</p>
            <span className="text-xs font-semibold text-primary">{checklistPct}%</span>
          </div>
          <Progress value={checklistPct} className="mt-2 h-2" />
          <p className="mt-2 text-xs text-muted-foreground">
            {missingChecklist.length === 0
              ? "Registro completo. Este hoyo aporta al 100% en tus métricas."
              : `Faltan: ${missingChecklist.join(", ")}.`}
          </p>
        </div>

        {/* Score */}
        <Section title="Score" info={TIGER5_INFO}>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 8 }, (_, i) => i + 1).map((s) => {
              const diff = s - hole.hole_par;
              return (
                <Button
                  key={s}
                  variant="score"
                  size="score"
                  data-active={hole.score === s}
                  className={cn(
                    hole.score === s && diff < 0 && "border-success bg-success/10 text-success",
                    hole.score === s && diff === 0 && "border-primary bg-primary/10 text-primary",
                    hole.score === s && diff === 1 && "border-warning bg-warning/10 text-warning",
                    hole.score === s && diff >= 2 && "border-tiger bg-tiger/10 text-tiger",
                  )}
                  onClick={() => update({ score: s })}
                >
                  {s}
                </Button>
              );
            })}
          </div>

          {hole.score != null && (
            <div className="rounded-lg border border-border bg-muted/50 p-2 text-xs">
              <p className="font-medium">Impacto Tiger 5 en este hoyo: {tiger5.count}</p>
              <p className="mt-1 text-muted-foreground">
                {tiger5Flags.length > 0 ? tiger5Flags.join(" · ") : "Sin errores Tiger 5 en este hoyo."}
              </p>
            </div>
          )}
        </Section>

        {/* Mental */}
        <Section title="Rutina y enfoque" info={MENTAL_INFO}>
          <div className="flex gap-2">
            {MENTAL.map((m) => (
              <Button
                key={m.value}
                variant="chip"
                size="chip-lg"
                data-active={hole.mental_commitment === m.value}
                onClick={() => update({ mental_commitment: m.value })}
                className="flex-1"
              >
                <FfIcon name={m.icon} className={cn("text-sm", m.iconClass)} />
                <span>{m.label}</span>
              </Button>
            ))}
          </div>
        </Section>

        {/* Tee */}
        <Section title={isPar3 ? "Salida (Par 3)" : "Salida"}>
          <div className="space-y-2">
            {isPar3 && (
              <p className="text-xs text-muted-foreground">
                Registra el resultado del tiro de tee en el par 3.
              </p>
            )}
            <div className="flex gap-2">
              {TEE_CLUBS.map((c) => (
                <Button key={c.value} variant="chip" size="chip-lg" data-active={hole.tee_club === c.value} onClick={() => update({ tee_club: c.value })} className="flex-1">
                  {c.label}
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              {teeResults.map((r) => (
                <Button key={r.value} variant={r.variant} size="chip-lg" data-active={hole.tee_result === r.value} onClick={() => update({ tee_result: r.value })} className="flex-1">
                  {r.label}
                </Button>
              ))}
            </div>
          </div>
        </Section>

        {/* Approach */}
        {requiresApproach && (
          <Section title="Approach">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Zona (m)</p>
              <div className="flex flex-wrap gap-2">
                {APPROACH_ZONES.map((z) => (
                  <Button key={z} variant="chip" size="chip-lg" data-active={hole.approach_zone === z} onClick={() => update({ approach_zone: z })}>
                    {z}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Lie de approach</p>
              <div className="flex flex-wrap gap-2">
                {APPROACH_LIES.map((lie) => (
                  <Button
                    key={lie.value}
                    variant="chip"
                    size="chip-lg"
                    data-active={hole.approach_lie === lie.value}
                    onClick={() => update({ approach_lie: lie.value })}
                  >
                    {lie.label}
                  </Button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="chip" size="chip-lg" data-active={hole.approach_target === "centro_green"} onClick={() => update({ approach_target: "centro_green" })} className="flex-1">
                  <FfIcon name="bullseye-pointer" className="text-sm" /> Centro
                </Button>
                <Button variant="chip" size="chip-lg" data-active={hole.approach_target === "bandera"} onClick={() => update({ approach_target: "bandera" })} className="flex-1">
                  <FfIcon name="flag-alt" className="text-sm" /> Bandera
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="chip-success" size="chip-lg" data-active={hole.approach_error_side === "lado_bueno"} onClick={() => update({ approach_error_side: "lado_bueno" })} className="flex-1">
                  Lado Bueno
                </Button>
                <Button variant="chip-destructive" size="chip-lg" data-active={hole.approach_error_side === "lado_malo"} onClick={() => update({ approach_error_side: "lado_malo" })} className="flex-1">
                  Lado Malo
                </Button>
              </div>
            </div>
          </Section>
        )}

        {/* GIR */}
        <Section title="Green en Regulación">
          <div className="space-y-2">
            <div className="flex gap-2">
              <Button
                variant="chip-success"
                size="chip-lg"
                data-active={hole.gir === true}
                onClick={() => update({ gir: true, scrambling_attempt: false, scrambling_success: null })}
                className="flex-1"
              >
                <FfIcon name="check-circle" className="text-sm" /> GIR
              </Button>
              <Button
                variant="chip-destructive"
                size="chip-lg"
                data-active={hole.gir === false}
                onClick={() => update({ gir: false, gir_proximity_bucket: null })}
                className="flex-1"
              >
                <FfIcon name="cross-circle" className="text-sm" /> No GIR
              </Button>
            </div>
            {hole.gir && (
              <div className="animate-fade-in">
                <p className="mb-1 text-xs text-muted-foreground">Proximidad al pin</p>
                <div className="flex gap-2">
                  {PROXIMITY_BUCKETS.map((b) => (
                    <Button key={b} variant="chip" size="chip-lg" data-active={hole.gir_proximity_bucket === b} onClick={() => update({ gir_proximity_bucket: b })} className="flex-1">
                      {b}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {hole.gir === false && (
              <div className="animate-fade-in space-y-2">
                <p className="text-xs text-muted-foreground">Salvar el par</p>
                <div className="flex gap-2">
                  <Button
                    variant="chip-success"
                    size="chip-lg"
                    data-active={hole.scrambling_attempt && hole.scrambling_success === true}
                    onClick={() => update({ scrambling_attempt: true, scrambling_success: true })}
                    className="flex-1"
                  >
                    Sí
                  </Button>
                  <Button
                    variant="chip-destructive"
                    size="chip-lg"
                    data-active={hole.scrambling_attempt && hole.scrambling_success === false}
                    onClick={() => update({ scrambling_attempt: true, scrambling_success: false })}
                    className="flex-1"
                  >
                    No
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Section>

        {/* Putts */}
        <Section title="Putts">
          <div className="flex gap-2">
            {[0, 1, 2, 3, 4].map((p) => (
              <Button
                key={p}
                variant={p >= 3 ? "chip-warning" : "chip"}
                size="chip-lg"
                data-active={hole.putts === p}
                onClick={() => update({ putts: p })}
                className="flex-1"
              >
                {p}{p === 4 ? "+" : ""}
              </Button>
            ))}
          </div>
        </Section>

        {/* 1st Putt Distance */}
        <Section title="Distancia 1er Putt">
          <div className="flex gap-2">
            {PROXIMITY_BUCKETS.map((b) => (
              <Button
                key={b}
                variant="chip"
                size="chip-lg"
                data-active={hole.first_putt_bucket === b}
                onClick={() => update({ first_putt_bucket: b, first_putt_overridden: hole.gir === true })}
                className="flex-1"
              >
                {b}
              </Button>
            ))}
          </div>
          {hole.gir && hole.gir_proximity_bucket && !hole.first_putt_overridden && (
            <p className="mt-1 text-xs text-success">Auto: desde proximidad GIR</p>
          )}
        </Section>

        {/* Penalties */}
        <Section title="Penalidades">
          <div className="flex gap-2">
            {[0, 1, 2, 3].map((p) => (
              <Button key={p} variant={p > 0 ? "chip-warning" : "chip"} size="chip-lg" data-active={hole.penalties === p} onClick={() => update({ penalties: p })} className="flex-1">
                {p}
              </Button>
            ))}
          </div>
        </Section>

        <Section title="Strokes Gained (Beta Elite)">
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <SgItem label="SG Tee" value={formatSg(sgOffTee)} />
              <SgItem label="SG Approach" value={formatSg(sgApproach)} />
              <SgItem label="SG Short Game" value={formatSg(sgShortGame)} />
              <SgItem label="SG Putting" value={formatSg(sgPutting)} />
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-border pt-2">
              <p className="text-sm font-semibold">SG Total</p>
              <p
                className={cn(
                  "text-sm font-semibold",
                  sgTotal == null ? "text-foreground" : sgTotal < 0 ? "text-warning" : "text-success",
                )}
              >
                {formatSg(sgTotal)}
              </p>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Confianza del cálculo:{" "}
              <span className="font-semibold">
                {sgConfidence === "high" ? "Alta" : sgConfidence === "medium" ? "Media" : "Baja"}
              </span>
            </p>
          </div>
        </Section>
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md safe-area-bottom">
        <div className="mx-auto grid max-w-lg grid-cols-3 gap-2 px-4 py-3">
          <Button
            variant="outline"
            size="lg"
            disabled={currentHole <= 1}
            onClick={() => goToHole(currentHole - 1)}
            className="w-full"
          >
            <ArrowLeft className="mr-1 h-4 w-4" /> Ant.
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={finishRound}
            disabled={finishingRound}
            className="w-full border-success text-success hover:bg-success/10"
          >
            {finishingRound ? "Cerrando..." : "Terminar ronda"}
          </Button>
          {currentHole < totalHoles ? (
            <Button size="lg" onClick={() => goToHole(currentHole + 1)} className="w-full">
              Sig. <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button size="lg" onClick={() => navigate(`/rondas/${roundId}`)} className="w-full">
              Lista hoyos
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

const Section = ({
  title,
  info,
  children,
}: {
  title: string;
  info?: MetricInfoContent;
  children: React.ReactNode;
}) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      {info && <MetricInfoDialog content={info} className="-mr-1" />}
    </div>
    {children}
  </div>
);

const SgItem = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-md border border-border bg-background px-2 py-1.5">
    <p className="text-[11px] text-muted-foreground">{label}</p>
    <p className="text-sm font-semibold">{value}</p>
  </div>
);

export default HoleCapture;
