export interface Tiger5Result {
  bogeyPar5: boolean;
  doublePlus: boolean;
  threePutt: boolean;
  bogeyWithWedge: boolean;
  penalty: boolean;
  count: number;
}

export function calculateTiger5(hole: {
  hole_par: number;
  score: number | null;
  putts: number | null;
  approach_zone: string | null;
  penalties: number;
  tee_result: string | null;
}): Tiger5Result {
  const score = hole.score ?? 0;
  const diff = score - hole.hole_par;

  const bogeyPar5 = hole.hole_par === 5 && diff >= 1;
  const doublePlus = diff >= 2;
  const threePutt = (hole.putts ?? 0) >= 3;
  const bogeyWithWedge =
    diff >= 1 &&
    (hole.approach_zone === "<60" || hole.approach_zone === "60-90" || hole.approach_zone === "90-135");
  const penalty = hole.penalties >= 1 || hole.tee_result === "penalidad";

  const flags = [bogeyPar5, doublePlus, threePutt, bogeyWithWedge, penalty];
  const count = flags.filter(Boolean).length;

  return { bogeyPar5, doublePlus, threePutt, bogeyWithWedge, penalty, count };
}
