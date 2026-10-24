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

- Mortality reports extend record_change_requests through nullable mortality fields; database triggers apply decisions atomically, so every update path enforces CEO-only review and exactly-once application.
- Expense corrections use correct_expense with an expected updated_at, retaining approval/payment metadata and preventing stale edits; reviewed records only allow non-financial corrections.
