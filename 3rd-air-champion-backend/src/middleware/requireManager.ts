import { Request, Response, NextFunction } from "express";

// Only the people who run the house — the host and cohosts — past this point.
//
// authenticateToken alone is not enough for anything guests must not see.
// TiBook, the guest app, signs in too: it logs in with its own account and
// holds a perfectly valid token, so "has a token" includes every guest with
// devtools open. The login resolver marks the TiBook account (tibook@mock.com)
// with role "TiBook"; this turns that away.
//
// It can only refuse what it can recognise. If TiBook signs in with a real host
// or cohost login instead, its token IS that account's token and no server
// check can tell the two apart — TiBook needs its own account for this to hold.
//
// An allowlist rather than refusing "TiBook" alone, so a role added later
// starts out locked out of host data instead of quietly let in. Compared without
// case because older tokens and fixtures carry "host" as well as "Host".
//
// 403, knowing CloudFront rewrites a 403 into index.html with a 200 (see
// authenticateJWT). That trap bites a client expecting JSON; no TiMag session
// ever carries a role this refuses, so the only caller who meets it is one who
// was not meant to get an answer.
const MANAGER_ROLES = new Set(["host", "cohost"]);

export const requireManager = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  if (!user?.hostId) {
    return res.status(401).json({ error: "Authorization token missing" });
  }
  if (!MANAGER_ROLES.has(String(user.role ?? "").toLowerCase())) {
    return res.status(403).json({ error: "This is for the host's account only" });
  }
  return next();
};
