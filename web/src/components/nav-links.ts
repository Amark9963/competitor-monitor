import { IconCompetitors, IconDashboard, IconInsights, IconRuns } from "./icons";

export const NAV_LINKS = [
  { href: "/", label: "Dashboard", icon: IconDashboard },
  { href: "/insights", label: "Insights", icon: IconInsights },
  { href: "/runs", label: "Runs", icon: IconRuns },
  { href: "/competitors", label: "Competitors", icon: IconCompetitors },
];

export function isActive(href: string, pathname: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
