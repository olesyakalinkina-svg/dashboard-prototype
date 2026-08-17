/** True while a ticket filter setState is flushing the urgent UI turn. */
let ticketsUiTurnActive = false;

export function isTicketsUiTurnActive(): boolean {
  return ticketsUiTurnActive;
}

/**
 * Marks the current JS turn as a filter-bar update. Heavy tickets compute
 * must not run before the matching `tickets-ui-turn` console.timeEnd.
 */
export function beginTicketsUiTurn(): void {
  ticketsUiTurnActive = true;
  console.time("tickets-ui-turn");
  queueMicrotask(() => {
    console.timeEnd("tickets-ui-turn");
    ticketsUiTurnActive = false;
  });
}

export function noteTicketsCompute(label: string): () => void {
  if (ticketsUiTurnActive) {
    console.error(`[tickets] ${label} ran during filter UI turn`);
  }
  console.time(label);
  return () => {
    console.timeEnd(label);
  };
}
