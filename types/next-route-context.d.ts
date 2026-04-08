// types/next-route-context.d.ts

export interface RouteContext<Params extends Record<string, any>> {
  params: Promise<Params>;
}
