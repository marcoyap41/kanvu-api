import type { CookieOptions, Response } from "express";

export const REFRESH_COOKIE = 'kanvu_rt';
export const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const isProd = process.env.NODE_ENV === 'production';
const base: CookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/auth',
};

export const setRefreshCookie = (res: Response, token: string) => 
    res.cookie(REFRESH_COOKIE, token, {...base, maxAge: REFRESH_TTL_MS});

export const clearRefreshCookie = (res: Response) => res.clearCookie(REFRESH_COOKIE, base)