import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
}

const MENTAL = [
  { value: "perfecto", label: "Rutina perfecta", emoji: "🟢" },
  { value: "dude_en_1", label: "Dudé en 1 golpe", emoji: "🟡" },
  { value: "perdi_el_foco", label: "Perdí el enfoque", emoji: "🔴" },
];

const TEE_CLUBS = [
  { value: "driver", label: "Driver" },
  { value: "madera", label: "Madera" },
  { value: "hierro", label: "Hierro" },
];

const TEE_RESULTS = [
  { value: "calle", label: "Calle", variant: "chip-success" as const },
  { value: "izquierda", label: "Izq", variant: "chip" as const },
  { value: "derecha", label: "Der", variant: "chip" as const },
  { value: "penalidad", label: "Penal.", variant: "chip-destructive" as const },
];

const APPROACH_ZONES = ["<60", "60-90", "90-135", "135-180", ">180"];
const PROXIMITY_BUCKETS = ["<3m", "3-5m", "5-10m", ">10m"];

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
    setHole(updated);

    setSaving(true);
    const { id, ...rest } = updated;
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

  if (!hole) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Cargando...</div>;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/rondas`)}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="text-center">
            <p className="text-lg font-bold">Hoyo {currentHole}</p>
            <p className="text-xs text-muted-foreground">Par {hole.hole_par} · {hole.hole_meters_total}m</p>
            <p className="text-xs text-muted-foreground">Hoyos registrados: {registeredHoles}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={finishRound}
              disabled={finishingRound}
            >
              {finishingRound ? "Cerrando..." : "Terminar ronda"}
            </Button>
            <span className={cn("text-xs font-medium transition-opacity", saving ? "text-muted-foreground opacity-100" : "opacity-0")}>
              Guardando...
            </span>
          </div>
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
      <div className="mx-auto max-w-lg space-y-5 px-4 py-4 pb-24">
        {/* Score */}
        <Section title="Score">
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
        </Section>

        {/* Mental */}
        <Section title="Rutina y enfoque">
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
                {m.emoji} {m.label}
              </Button>
            ))}
          </div>
        </Section>

        {/* Tee */}
        <Section title="Salida">
          <div className="space-y-2">
            <div className="flex gap-2">
              {TEE_CLUBS.map((c) => (
                <Button key={c.value} variant="chip" size="chip-lg" data-active={hole.tee_club === c.value} onClick={() => update({ tee_club: c.value })} className="flex-1">
                  {c.label}
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              {TEE_RESULTS.map((r) => (
                <Button key={r.value} variant={r.variant} size="chip-lg" data-active={hole.tee_result === r.value} onClick={() => update({ tee_result: r.value })} className="flex-1">
                  {r.label}
                </Button>
              ))}
            </div>
          </div>
        </Section>

        {/* Approach */}
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
            <div className="flex gap-2">
              <Button variant="chip" size="chip-lg" data-active={hole.approach_target === "centro_green"} onClick={() => update({ approach_target: "centro_green" })} className="flex-1">
                🎯 Centro
              </Button>
              <Button variant="chip" size="chip-lg" data-active={hole.approach_target === "bandera"} onClick={() => update({ approach_target: "bandera" })} className="flex-1">
                🏁 Bandera
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
                ✅ GIR
              </Button>
              <Button
                variant="chip-destructive"
                size="chip-lg"
                data-active={hole.gir === false}
                onClick={() => update({ gir: false, gir_proximity_bucket: null })}
                className="flex-1"
              >
                ❌ No GIR
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
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <Button
            variant="outline"
            size="lg"
            disabled={currentHole <= 1}
            onClick={() => goToHole(currentHole - 1)}
          >
            <ArrowLeft className="mr-1 h-4 w-4" /> Anterior
          </Button>
          {currentHole < totalHoles ? (
            <Button size="lg" onClick={() => goToHole(currentHole + 1)}>
              Siguiente <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button size="lg" onClick={() => navigate(`/rondas/${roundId}`)}>
              Ver resumen
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="space-y-2">
    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
    {children}
  </div>
);

export default HoleCapture;
