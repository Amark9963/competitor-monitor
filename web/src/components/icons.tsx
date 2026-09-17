// Small stroke icons (24px viewBox) so the UI has no icon-library dependency.
type P = { className?: string };
const base = { fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const I = ({ className, children }: P & { children: React.ReactNode }) => (
  <svg viewBox="0 0 24 24" className={className ?? "h-4 w-4"} aria-hidden {...base}>{children}</svg>
);

export const IconDashboard = (p: P) => <I {...p}><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></I>;
export const IconInsights = (p: P) => <I {...p}><path d="M12 3l1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4z" /><path d="M5 17l.9 2.1L8 20l-2.1.9L5 23l-.9-2.1L2 20l2.1-.9z" /></I>;
export const IconRuns = (p: P) => <I {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></I>;
export const IconCompetitors = (p: P) => <I {...p}><path d="M3 21h18" /><path d="M5 21V7l7-4 7 4v14" /><path d="M9 21v-6h6v6" /><path d="M9 10h.01M15 10h.01M12 10h.01" /></I>;
export const IconPlay = (p: P) => <I {...p}><path d="M7 5l12 7-12 7z" /></I>;
export const IconExternal = (p: P) => <I {...p}><path d="M14 4h6v6" /><path d="M20 4l-9 9" /><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></I>;
export const IconDownload = (p: P) => <I {...p}><path d="M12 4v12" /><path d="M7 11l5 5 5-5" /><path d="M4 20h16" /></I>;
export const IconAlert = (p: P) => <I {...p}><path d="M12 3l9.5 16.5H2.5z" /><path d="M12 10v4" /><path d="M12 17.5h.01" /></I>;
export const IconTrendUp = (p: P) => <I {...p}><path d="M3 17l6-6 4 4 8-8" /><path d="M14 7h7v7" /></I>;
export const IconTrendDown = (p: P) => <I {...p}><path d="M3 7l6 6 4-4 8 8" /><path d="M14 17h7v-7" /></I>;
export const IconCheck = (p: P) => <I {...p}><path d="M5 12l5 5L20 7" /></I>;
export const IconEye = (p: P) => <I {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></I>;
export const IconLayers = (p: P) => <I {...p}><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5" /><path d="M3 17l9 5 9-5" /></I>;
export const IconTarget = (p: P) => <I {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></I>;
export const IconFile = (p: P) => <I {...p}><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h6" /></I>;
export const IconChevron = (p: P) => <I {...p}><path d="M9 6l6 6-6 6" /></I>;
export const IconSearch = (p: P) => <I {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></I>;
export const IconBolt = (p: P) => <I {...p}><path d="M13 2L4 14h7l-1 8 9-12h-7z" /></I>;
export const IconArrowRight = (p: P) => <I {...p}><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></I>;
export const IconInbox = (p: P) => <I {...p}><path d="M3 13l2.5-8h13L21 13" /><path d="M3 13v6a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-6" /><path d="M3 13h5l1.5 3h5L16 13h5" /></I>;
