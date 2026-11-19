import type { NextFunction, Request, Response } from "express";
import { supabaseAdmin } from "./supabase.js";
import { HttpError } from "./errors.js";

export interface AuthedRequest extends Request {
  userId?: string;
}

/** Verifies the Supabase access token sent as `Authorization: Bearer <jwt>`. */
export async function requireUser(req: AuthedRequest, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) throw new HttpError(401, "Not signed in");
    const { data, error } = await supabaseAdmin().auth.getUser(token);
    if (error || !data.user) throw new HttpError(401, "Session expired, please sign in again");
    req.userId = data.user.id;
    next();
  } catch (err) {
    next(err);
  }
}
