export type BlocklistStepResult =
  | { status: "listed"; sources: string[] }
  | { status: "clear" }
  | { status: "skipped"; reason: string }
  | { status: "failed"; errorMessage: string };
