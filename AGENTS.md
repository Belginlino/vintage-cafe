<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- All POS data access goes through repository functions in `src/lib/pos/store.ts` (currently browser-storage demo mode); swap that module for a backend without touching UI.
- All money math uses `src/lib/pos/billing.ts` in integer paise; orders store line/total snapshots so old receipts never change.
