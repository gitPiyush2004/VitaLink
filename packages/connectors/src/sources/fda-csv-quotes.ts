/** Narrow repair for illegal embedded quotes seen in legacy FDA prose fields. */
type Token = { text: string; consumed: number; open: boolean; repaired: number };
function quotedToken(input: string, index: number): Token {
  const character = input[index] ?? '';
  const next = input[index + 1];
  if (character !== '"') return { text: character, consumed: 1, open: true, repaired: 0 };
  if (next === '"') return { text: '""', consumed: 2, open: true, repaired: 0 };
  if (next === undefined || next === ',' || next === '\r' || next === '\n') {
    return { text: '"', consumed: 1, open: false, repaired: 0 };
  }
  // A CSV closing quote must be followed by a delimiter or record boundary.
  // Otherwise preserve it as a literal quote by escaping it. Ambiguous quotes
  // before delimiters are not guessed; strict record-length checks still apply.
  return { text: '""', consumed: 1, open: true, repaired: 1 };
}
export function repairEmbeddedQuotes(input: string): { text: string; repaired: number } {
  const parts: string[] = [];
  let quoted = false;
  let start = true;
  let repaired = 0;
  for (let index = 0; index < input.length; index++) {
    const character = input[index] ?? '';
    if (quoted) {
      const token = quotedToken(input, index);
      parts.push(token.text);
      index += token.consumed - 1;
      quoted = token.open;
      repaired += token.repaired;
      start = false;
    } else {
      parts.push(character);
      if (character === '"' && start) quoted = true;
      start = character === ',' || character === '\r' || character === '\n';
    }
  }
  return { text: parts.join(''), repaired };
}
