"""Withholds AI tutor replies that reproduce a challenge's reference solution.

The check is structural: comments are dropped, identifiers are normalised (so
renaming variables does not hide a copied solution), and the starter code the
student already has is subtracted. A reply is withheld when it contains most of
the solution's remaining 4-token sequences. For short solutions that add one line
to supplied starter code, an exact token match of that line also counts.
When the latest failed sample differs from the reference on just one line, that
line is also withheld, even when the starter code already includes it.

The comparison uses one reference. A solution written in a substantially
different way can pass that check, so challenge chat also rejects code blocks.
"""

from __future__ import annotations

import re

NGRAM = 4
# Partial overlap is unreliable for small solutions.
MIN_SOLUTION_NGRAMS = 8
# Share of the solution's sequences a reply must contain to be withheld.
BLOCK_COVERAGE = 0.6

WITHHELD_REPLY = (
    "I can't show code that solves this challenge, because working it out is the point. "
    "Tell me which step you're stuck on, or what your program prints compared with what "
    "you expected, and I'll explain the idea behind that step."
)

WITHHELD_HINT = (
    "Compare what your program printed with the expected sample output, line by line. "
    "Find the first place they differ, then trace your code by hand for that input to see "
    "which step produces the wrong value."
)

_COMMENT = re.compile(r"/\*.*?\*/|//[^\n]*|#(?!include)[^\n]*", re.S)
_CODE_BLOCK = re.compile(
    r"(?m)^[ \t]*(?:`{3,}|~{3,}|\w+\s*(?:[+*/%-]=|=(?!=))\s*\S|"
    r"for\s+\w+\s+in\s+[^\n]+:\s*$|(?:if|while|for)\s*\([^\n]+\)\s*\{)"
)
_TOKEN = re.compile(
    r"[A-Za-z_]\w*|\d+(?:\.\d+)?|==|!=|<=|>=|\+=|-=|\*=|/=|%=|\+\+|--|&&|\|\||<<|>>|->|::|[^\sA-Za-z0-9_]"
)
# Keywords and common built-ins stay literal; every other identifier becomes "ID".
_KEEP = frozenset(
    """
    and as assert break class continue def del elif else except False finally for from global if import
    in is lambda None nonlocal not or pass raise return True try while with yield print input int float
    str len range list dict set tuple sum min max abs sorted enumerate zip map append split strip join
    auto bool case catch char const default delete do double enum extern friend goto inline long namespace
    new operator private protected public short signed sizeof static struct switch template this throw
    typedef typename union unsigned using virtual void volatile include iostream std cin cout endl string
    vector main boolean byte extends final implements instanceof interface package super synchronized
    System out println Scanner nextInt nextLine next null true false
    """.split()
)


def _tokens(source: str) -> list[str]:
    raw = _TOKEN.findall(_COMMENT.sub(" ", source))
    return [token if token in _KEEP or not (token[0].isalpha() or token[0] == "_") else "ID" for token in raw]


def _ngrams(tokens: list[str]) -> set[tuple[str, ...]]:
    return {tuple(tokens[index:index + NGRAM]) for index in range(len(tokens) - NGRAM + 1)}


def _contains_tokens(tokens: list[str], fragment: list[str]) -> bool:
    return any(tokens[index:index + len(fragment)] == fragment
               for index in range(len(tokens) - len(fragment) + 1))


def _single_line_repair(reference: str, failed_sample: str) -> list[str]:
    expected = [_TOKEN.findall(line) for line in _COMMENT.sub(" ", reference).splitlines() if line.strip()]
    attempted = [_TOKEN.findall(line) for line in _COMMENT.sub(" ", failed_sample).splitlines() if line.strip()]
    if len(expected) != len(attempted):
        return []
    changed = [" ".join(target) for target, actual in zip(expected, attempted) if target != actual]
    return _tokens(changed[0]) if len(changed) == 1 else []


def reveals_solution(
    reply: str,
    reference_solution: str | None,
    starter_code: str | None = None,
    *,
    failed_sample: str | None = None,
    prose_only: bool = False,
) -> bool:
    """True for a reproduced solution or a code block in a prose-only challenge hint."""
    if prose_only and _CODE_BLOCK.search(reply):
        return True
    if not reply or not reference_solution:
        return False
    reply_tokens = _tokens(reply)
    if failed_sample:
        repair = _single_line_repair(reference_solution, failed_sample)
        if len(repair) >= NGRAM and _contains_tokens(reply_tokens, repair):
            return True
    solution = _ngrams(_tokens(reference_solution)) - _ngrams(_tokens(starter_code or ""))
    if len(solution) < MIN_SOLUTION_NGRAMS:
        if not starter_code or not solution:
            return False
        starter_lines = {tuple(_tokens(line)) for line in starter_code.splitlines()}
        added_lines = {tuple(_tokens(line)) for line in reference_solution.splitlines()} - starter_lines
        added_lines = [line for line in added_lines if len(line) >= NGRAM]
        if len(added_lines) != 1:
            return False
        return _contains_tokens(reply_tokens, list(added_lines[0]))
    shared = solution & _ngrams(reply_tokens)
    return len(shared) / len(solution) >= BLOCK_COVERAGE
