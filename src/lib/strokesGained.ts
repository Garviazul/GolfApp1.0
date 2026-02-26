export type SgConfidence = "low" | "medium" | "high";

export interface StrokeGainedInput {
  hole_par: number;
  score: number | null;
  putts: number | null;
  tee_result: string | null;
  approach_zone: string | null;
  approach_target: string | null;
  approach_error_side: string | null;
  approach_lie: string | null;
  gir: boolean | null;
  gir_proximity_bucket: string | null;
  first_putt_bucket: string | null;
  scrambling_success: boolean | null;
  penalties: number;
}

export interface StrokeGainedBreakdown {
  offTee: number | null;
  approach: number | null;
  shortGame: number | null;
  putting: number | null;
  total: number | null;
  confidence: SgConfidence;
}

const round3 = (value: number) => Number(value.toFixed(3));

const average = (values: number[]) => {
  if (values.length === 0) return null;
  return round3(values.reduce((sum, value) => sum + value, 0) / values.length);
};

const expectedAfterTee = (holePar: number, teeResult: string) => {
  if (holePar === 4) {
    if (teeResult === "calle") return 3.02;
    if (teeResult === "izquierda" || teeResult === "derecha") return 3.24;
    if (teeResult === "penalidad") return 4.15;
  }
  if (holePar === 5) {
    if (teeResult === "calle") return 3.78;
    if (teeResult === "izquierda" || teeResult === "derecha") return 3.98;
    if (teeResult === "penalidad") return 4.95;
  }
  return null;
};

const expectedFromApproachZone = (approachZone: string) => {
  if (approachZone === "<60") return 2.55;
  if (approachZone === "60-90") return 2.75;
  if (approachZone === "90-135") return 2.95;
  if (approachZone === "135-180") return 3.15;
  if (approachZone === ">180") return 3.45;
  return null;
};

const lieAdjustment = (approachLie: string | null) => {
  if (approachLie === "rough") return 0.12;
  if (approachLie === "bunker") return 0.25;
  if (approachLie === "recovery") return 0.45;
  return 0;
};

const expectedAfterApproach = (input: StrokeGainedInput) => {
  if (input.gir === true) {
    if (input.gir_proximity_bucket === "<3m") return 1.25;
    if (input.gir_proximity_bucket === "3-5m") return 1.55;
    if (input.gir_proximity_bucket === "5-10m") return 1.85;
    if (input.gir_proximity_bucket === ">10m") return 2.15;
    return 1.95;
  }
  if (input.gir === false) {
    if (input.approach_error_side === "lado_bueno") return 2.25;
    if (input.approach_error_side === "lado_malo") return 2.55;
    return 2.4;
  }
  return null;
};

const expectedPutts = (firstPuttBucket: string) => {
  if (firstPuttBucket === "<3m") return 1.22;
  if (firstPuttBucket === "3-5m") return 1.56;
  if (firstPuttBucket === "5-10m") return 1.84;
  if (firstPuttBucket === ">10m") return 2.13;
  return null;
};

export const calculateStrokesGainedProxy = (input: StrokeGainedInput): StrokeGainedBreakdown => {
  const teeBase = input.hole_par === 4 ? 4.05 : input.hole_par === 5 ? 4.85 : null;
  const teeAfter = input.tee_result ? expectedAfterTee(input.hole_par, input.tee_result) : null;
  const offTee = teeBase != null && teeAfter != null ? round3(teeBase - (1 + teeAfter)) : null;

  const approachStartBase = input.approach_zone ? expectedFromApproachZone(input.approach_zone) : null;
  const approachStart = approachStartBase != null ? approachStartBase + lieAdjustment(input.approach_lie) : null;
  const approachAfter = expectedAfterApproach(input);
  const approach = approachStart != null && approachAfter != null ? round3(approachStart - (1 + approachAfter)) : null;

  let shortGame: number | null = null;
  if (input.gir === false) {
    const start = input.approach_error_side === "lado_malo" ? 2.55 : 2.35;
    if (input.scrambling_success === true) shortGame = round3(start - 2);
    else if (input.scrambling_success === false) shortGame = round3(start - 2.8);
    else if (input.putts != null) {
      if (input.putts <= 1) shortGame = round3(start - 2.1);
      else if (input.putts === 2) shortGame = round3(start - 2.5);
      else shortGame = round3(start - 2.9);
    }
  }

  const puttBucket = input.first_putt_bucket ?? (input.gir === true ? input.gir_proximity_bucket : null);
  const expectedPuttCount = puttBucket ? expectedPutts(puttBucket) : null;
  const putting =
    expectedPuttCount != null && input.putts != null ? round3(expectedPuttCount - input.putts) : null;

  const components = [offTee, approach, shortGame, putting].filter((value): value is number => value != null);
  const penaltyAdj = input.penalties > 0 ? -0.25 * input.penalties : 0;
  const total = components.length > 0 || penaltyAdj !== 0 ? round3(components.reduce((sum, value) => sum + value, 0) + penaltyAdj) : null;

  const confidenceSignals = [
    input.score != null,
    input.tee_result != null || input.hole_par === 3,
    input.approach_zone != null,
    input.gir != null,
    input.putts != null,
    puttBucket != null,
    input.approach_lie != null,
  ].filter(Boolean).length;

  let confidence: SgConfidence = "low";
  if (confidenceSignals >= 6) confidence = "high";
  else if (confidenceSignals >= 4) confidence = "medium";

  return { offTee, approach, shortGame, putting, total, confidence };
};

export interface SgAggregate {
  total: number | null;
  offTee: number | null;
  approach: number | null;
  shortGame: number | null;
  putting: number | null;
}

export const aggregateSg = (rows: StrokeGainedBreakdown[]): SgAggregate => {
  const total = average(rows.map((row) => row.total).filter((value): value is number => value != null));
  const offTee = average(rows.map((row) => row.offTee).filter((value): value is number => value != null));
  const approach = average(rows.map((row) => row.approach).filter((value): value is number => value != null));
  const shortGame = average(rows.map((row) => row.shortGame).filter((value): value is number => value != null));
  const putting = average(rows.map((row) => row.putting).filter((value): value is number => value != null));
  return { total, offTee, approach, shortGame, putting };
};

export interface CoachingItem {
  title: string;
  detail: string;
}

export const buildSub80Coaching = ({
  sg,
  mentalPct,
  tigerPerRound,
}: {
  sg: SgAggregate;
  mentalPct: number | null;
  tigerPerRound: number | null;
}): CoachingItem[] => {
  const candidates: Array<{ key: string; value: number | null }> = [
    { key: "approach", value: sg.approach },
    { key: "putting", value: sg.putting },
    { key: "offTee", value: sg.offTee },
    { key: "shortGame", value: sg.shortGame },
  ];

  const weakest = candidates
    .filter((candidate) => candidate.value != null)
    .sort((a, b) => (a.value ?? 0) - (b.value ?? 0))
    .slice(0, 2);

  const items: CoachingItem[] = weakest.map((item) => {
    if (item.key === "approach") {
      return {
        title: "Approach bajo presión",
        detail: "Prioriza centro de green cuando el error sea caro. Objetivo: subir SG Approach con decisiones conservadoras.",
      };
    }
    if (item.key === "putting") {
      return {
        title: "Control de distancia en green",
        detail: "Bloquea una sesión semanal de ladder drill y putts de 1-2m para reducir 3-putts.",
      };
    }
    if (item.key === "offTee") {
      return {
        title: "Salida en juego",
        detail: "Ajusta objetivo de salida para aumentar fairways útiles y bajar penalidades desde tee.",
      };
    }
    return {
      title: "Scrambling competitivo",
      detail: "Entrena chips/pitches desde lies variados y plan de dos putts para mejorar conversiones de par.",
    };
  });

  if (mentalPct != null && mentalPct < 70) {
    items.push({
      title: "Rutina mental estable",
      detail: "Activa checkpoint cada 3 hoyos: respiración, objetivo claro y compromiso antes del golpe.",
    });
  }

  if (tigerPerRound != null && tigerPerRound > 2) {
    items.push({
      title: "Recorte de Tiger 5",
      detail: "Define regla personal de riesgo: sin ataques a bandera si no hay lie y ángulo claros.",
    });
  }

  return items.slice(0, 3);
};
