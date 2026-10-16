@AGENTS.md

## Prime Mart rules (append to CLAUDE.md)
- Read docs/product-decisions.md before any schema or order work
- POS is source of truth for price + stock; app never edits them
- Use theme tokens only, no raw hex in components
- Saffron (accent) is fill-only; use accent-text for text on light backgrounds
- Tap targets >= 44px
- data/ holds client data: never commit it
