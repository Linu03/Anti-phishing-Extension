export type TlsFinding = {
  rule: string;
  points: number;
  detail: string;
};

export type TlsStepResult =
  | { status: "ok"; score: number; findings: TlsFinding[] }
  | { status: "skipped"; reason: string }
  | { status: "failed"; errorMessage: string };
