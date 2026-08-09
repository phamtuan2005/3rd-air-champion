import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const SECRET_TOKEN =
  process.env.SECRET_TOKEN ||
  "509ea5f1fd64b855c9c372453b8f114593d1aabdb02653e880b4432f661d0eaee73bc06d631064b0ec8c0ecb4b77656b4fa0390dc0805812c365a7f15891efa1";

export const authenticateToken = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authorizationHeader = req.headers.authorization;

  if (!authorizationHeader)
    return res.status(401).json({ error: "Authorization token missing" });

  const token = authorizationHeader.split(" ")[1]; // Bearer <token>

  jwt.verify(token, SECRET_TOKEN, (err, decoded) => {
    // 401, not 403. Two reasons, and the second is why the app went blank.
    //
    // Semantically, 401 is "your credentials are missing or no longer valid" —
    // exactly this case. 403 means "we know who you are and you still may not".
    //
    // Operationally, the CloudFront distribution maps 403 -> /index.html with
    // status 200, and CloudFront custom error responses are distribution-wide:
    // they cannot be scoped to a behaviour, so the rule meant for SPA deep links
    // also swallowed every API rejection. An expired token came back to the
    // browser as a successful HTML page, the app stored markup where it expected
    // JSON, and the first .filter() on it blanked the screen. 401 is not in that
    // rule, so the real status now reaches the client and the refresh flow works.
    if (err) return res.status(401).json({ error: "Invalid or expired token" });

    (req as any).user = decoded;
    return next();
  });
};
