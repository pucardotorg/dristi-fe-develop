/**
 * Copy for the cases area's own states. The load error covers every page under /cases
 * (the list, folders, search and a case's own pages), so it names no single one.
 */
export const CASES_LOAD_ERROR = {
  title: "This page couldn't be loaded",
  body: "Something went wrong while fetching your cases. Try again; if it keeps happening, this part of DRISTI may not be connected to the court's system yet.",
  retry: "Try again",
} as const;
