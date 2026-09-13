---
paths:
  - "app/**/*.ts"
  - "app/**/*.tsx"
---

# App Router rules (loaded only when working under `app/`)

- Route handlers: `export async function GET(_req: NextRequest, ctx: RouteContext<'/api/example/[id]'>)` and `await ctx.params`.
- Respond with `Response.json(...)`; validate input; never read `process.env` inline inside a handler.
- Pages and layouts are Server Components; the global `PageProps<'/x'>` / `LayoutProps<'/'>` helpers come from `next typegen`.
- Keep handlers thin: business logic goes to `lib/` where it can be unit-tested without Next.
