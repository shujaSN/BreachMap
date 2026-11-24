import type { Incident } from "@breachmap/schema";

export type Lane = { entityId: string; x: number };
export type Row = { stepId: string; n: number; y: number; x1: number; x2: number };
export type Layout = {
  width: number;
  height: number;
  laneWidth: number;
  top: number;
  bottom: number;
  lanes: Lane[];
  rows: Row[];
};

const LANE_WIDTH = 160;
const ROW_HEIGHT = 56;
const TOP = 64;
const PAD = 24;

export function layout({ entities, steps }: Incident): Layout {
  const order = [
    ...new Set([...steps.flatMap((s) => [s.from, s.to]), ...entities.map((e) => e.id)]),
  ];
  const xOf = (id: string) => PAD + LANE_WIDTH * order.indexOf(id) + LANE_WIDTH / 2;
  const lanes = order.map((entityId) => ({ entityId, x: xOf(entityId) }));
  const rows = steps.map((step, j) => ({
    stepId: step.id,
    n: j + 1,
    y: TOP + ROW_HEIGHT * j + ROW_HEIGHT / 2,
    x1: xOf(step.from),
    x2: xOf(step.to),
  }));
  const height = TOP + ROW_HEIGHT * rows.length + PAD;
  return {
    width: 2 * PAD + LANE_WIDTH * lanes.length,
    height,
    laneWidth: LANE_WIDTH,
    top: TOP,
    bottom: height - PAD,
    lanes,
    rows,
  };
}
