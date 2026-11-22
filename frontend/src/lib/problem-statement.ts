export interface StatementSample {
  input: string;
  output: string;
}

const SAMPLE_LINE = /^\s*(?:example|sample)\s+(input|output)\s*:\s*(\S.*?)\s*$/i;

/**
 * Pulls one-line "Example input: … / Example output: …" pairs out of a problem
 * statement so the Arena can show them as a scannable sample. Anything it does
 * not fully understand (multi-line examples, an unpaired line, text between a
 * pair) leaves the statement untouched, so no instruction is ever dropped.
 */
export function splitProblemStatement(text: string): { body: string; samples: StatementSample[] } {
  const untouched = { body: text.trim(), samples: [] };
  const body: string[] = [];
  const samples: StatementSample[] = [];
  let pendingInput: string | null = null;
  for (const line of text.split(/\r?\n/)) {
    const match = SAMPLE_LINE.exec(line);
    if (!match) {
      if (pendingInput !== null) return untouched;
      body.push(line);
    } else if (match[1].toLowerCase() === "input") {
      if (pendingInput !== null) return untouched;
      pendingInput = match[2];
    } else {
      if (pendingInput === null) return untouched;
      samples.push({ input: pendingInput, output: match[2] });
      pendingInput = null;
    }
  }
  if (pendingInput !== null) return untouched;
  return { body: body.join("\n").trim(), samples };
}
