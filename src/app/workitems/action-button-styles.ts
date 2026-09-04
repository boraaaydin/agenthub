const WORKITEM_ACTION_BASE_CLASS =
  "inline-flex h-8 items-center rounded-lg border bg-white px-2.5 text-xs font-medium shadow-sm transition focus:outline-none focus:ring-3 disabled:cursor-not-allowed disabled:bg-slate-100";

export const WORKITEM_ACTION_LINK_CLASS =
  `${WORKITEM_ACTION_BASE_CLASS} border-sky-200 text-sky-800 hover:border-sky-300 hover:bg-sky-50 focus:ring-sky-100`;

export const WORKITEM_ACTION_NEUTRAL_CLASS =
  `${WORKITEM_ACTION_BASE_CLASS} border-slate-300 text-slate-800 hover:border-slate-400 hover:bg-slate-50 focus:ring-sky-100`;

export const WORKITEM_ACTION_DANGER_CLASS =
  `${WORKITEM_ACTION_BASE_CLASS} border-red-300 text-red-800 hover:border-red-400 hover:bg-red-50 focus:ring-red-100`;
