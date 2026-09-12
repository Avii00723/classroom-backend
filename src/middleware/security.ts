import type { Request, Response, NextFunction } from "express";
import aj from '../config/arcjet.js';
import { ArcjetNodeRequest, slidingWindow } from "@arcjet/node";

const securityMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    if (process.env.NODE_ENV === 'test') return next();

    try {
        const role: RateLimitRole = req.user?.role ?? 'guest';
        let limit = 60;
        let message = 'Guest request limit exceeded (60 per minute)';

        switch (role) {
            case 'admin':
                limit = 240;
                message = 'Admin request limit exceeded (240 per minute)';
                break;
            case 'teacher':
            case 'student':
                limit = 120;
                message = 'User request limit exceeded (120 per minute)';
                break;
            default:
                limit = 60;
                message = 'Guest request limit exceeded (60 per minute)';
                break;
        }

        const client = aj.withRule(
            slidingWindow({
                mode: 'LIVE',
                interval: '1m',
                max: limit,
            })
        );

        const arcjetRequest: ArcjetNodeRequest = {
            headers: req.headers,
            method: req.method,
            url: req.originalUrl ?? req.url,
            socket: { remoteAddress: req.socket.remoteAddress ?? req.ip ?? '0.0.0.0' },
        };

        const decision = await client.protect(arcjetRequest, { requested: 1 });

        if (decision.isDenied()) {
            if (decision.reason.isRateLimit()) {
                return res.status(429).json({ error: 'Too many requests', message });
            }
            if (decision.reason.isBot()) {
                return res.status(403).json({ error: 'Forbidden', message: 'Automated requests are not allowed' });
            }
            if (decision.reason.isShield()) {
                return res.status(403).json({ error: 'Forbidden', message: 'Request blocked by security policy' });
            }
            return res.status(403).json({ error: 'Forbidden', message: 'Request blocked by security policy' });
        }

        next();
    } catch (error) {
        console.error('Arcjet middleware error:', error);
        res.status(500).json({ error: 'Internal error', message: 'Something went wrong with security middleware' });
    }
};

export default securityMiddleware;