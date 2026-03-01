export interface Tiger5Result {
  bogeyPar5: boolean;
  doublePlus: boolean;
  threePutt: boolean;
  blownEasySave: boolean;
  bogeyShortIron: boolean;
  count: number;
}

export function calculateTiger5(hole: {
  hole_par: number;
  score: number | null;
  putts: number | null;
  gir: boolean | null;
  scrambling_attempt: boolean;
  scrambling_success: boolean | null;
  approach_zone: string | null;
}): Tiger5Result {
  const score = hole.score ?? 0;
  const diff = score - hole.hole_par;

  const bogeyPar5 = hole.hole_par === 5 && diff >= 1;
  const doublePlus = diff >= 2;
  const threePutt = (hole.putts ?? 0) >= 3;
  const blownEasySave =
    hole.gir === false && hole.scrambling_attempt && hole.scrambling_success === false;
  const bogeyShortIron =
    diff >= 1 &&
    (hole.approach_zone === "<60" || hole.approach_zone === "60-90" || hole.approach_zone === "90-135");

  const flags = [bogeyPar5, doublePlus, threePutt, blownEasySave, bogeyShortIron];
  const count = flags.filter(Boolean).length;

  return { bogeyPar5, doublePlus, threePutt, blownEasySave, bogeyShortIron, count };
}
