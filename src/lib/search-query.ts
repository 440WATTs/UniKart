/** Turns free text into a prefix tsquery: "sci calc" -> "sci:* & calc:*". Only letters and digits survive. */
export function toPrefixQuery(q: string) {
  const tokens = q
    .toLowerCase()
    .normalize("NFKC")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 0)
    .slice(0, 8);
  return tokens.map((t) => `${t}:*`).join(" & ");
}
