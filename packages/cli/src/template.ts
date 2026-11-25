export function starter(id: string, today: string) {
  const source = (sourceId: string, type: string) => ({
    id: sourceId,
    url: `https://example.com/${sourceId}`,
    title: `TODO: ${type} title`,
    publisher: "TODO: publisher",
    type,
    retrievedAt: today,
  });
  return {
    schemaVersion: 1,
    id,
    title: "TODO: incident title",
    summary: "TODO: two or three sentences on what happened, in your own words.",
    dates: { started: null, discovered: null, disclosed: null },
    entities: [
      { id: "attacker", name: "TODO: attacker", kind: "attacker" },
      { id: "victim", name: "TODO: victim", kind: "victim" },
    ],
    steps: [
      {
        id: "first-step",
        title: "TODO: first step",
        description: "TODO: what happened in this step, in your own words.",
        phase: "initial-access",
        from: "attacker",
        to: "victim",
        confidence: "reported",
        sourceIds: ["advisory"],
      },
    ],
    impact: { description: "TODO: what was affected.", sourceIds: ["advisory"] },
    defenses: [
      {
        id: "first-defense",
        action: "TODO: what defenders should check or do.",
        stepIds: ["first-step"],
        sourceIds: ["report"],
      },
    ],
    sources: [source("advisory", "advisory"), source("report", "report")],
    provenance: { createdBy: "human", createdAt: today },
  };
}
