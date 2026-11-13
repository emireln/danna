// Who a report belongs to. A report a friend shared with you is theirs, so it is shown as their report.

/** True when another person took the test. Without a profile, the report is not treated as shared. */
export function isSharedReport(ownerId: string, viewerId: string | null | undefined): boolean {
  return Boolean(viewerId) && ownerId !== viewerId;
}
