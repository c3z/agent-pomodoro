import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
  layout("routes/layout.tsx", [
    index("routes/home.tsx"),
    route("timer", "routes/timer.tsx"),
    route("history", "routes/history.tsx"),
    route("sign-in/*", "routes/sign-in.tsx"),
  ]),
] satisfies RouteConfig;
