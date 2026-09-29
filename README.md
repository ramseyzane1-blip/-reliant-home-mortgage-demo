# Reliant Home Mortgage: redesign demo

A redesign concept for [relianthomemtg.com](https://www.relianthomemtg.com), a family-owned
mortgage broker in Middletown, Ohio.

**Live:** https://reliant-home-mortgage.greaterpurposeweb.com/demo/site/

- Drag-to-turn 3D model home in the hero
- One primary action: a two-minute pre-qualification with an answer review step
- A knock-and-walk-in 3D sequence when the pre-qualification is submitted
- Loan finder, refinance break-even calculator, rate factors, Homebuying 101 course,
  interactive glossary, local resource finder with a checklist
- Submissions saved to Supabase (insert-only), with a demo notice

## Run locally

```bash
python3 -m http.server 8765
# open http://127.0.0.1:8765/demo/site/
```

No build step. See `CLAUDE.md` for structure, decisions and next steps.
