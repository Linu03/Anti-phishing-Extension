export type WhitelistStepResult =
  | { status: "trusted" }
  | { status: "clear" }
  | { status: "skipped"; reason: string };
