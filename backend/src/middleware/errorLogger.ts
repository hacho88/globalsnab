import fs from 'fs';
import path from 'path';
import type { Request, Response, NextFunction } from 'express';

const logFilePath = path.join(__dirname, '..', '..', 'logs', 'errors.log');

export function errorLogger(err: any, req: Request, res: Response, _next: NextFunction) {
  try {
    const logDir = path.dirname(logFilePath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const payload = {
      time: new Date().toISOString(),
      method: req.method,
      url: req.originalUrl,
      message: err?.message || String(err),
      stack: err?.stack || null,
    };

    const line = JSON.stringify(payload) + '\n';
    fs.appendFile(logFilePath, line, () => {
      // ignore write errors here
    });
  } catch (_e) {
    // не даём падать приложению из-за проблем с логированием
  }

  if (res.headersSent) {
    return;
  }

  const status = typeof err?.status === 'number' ? err.status : 500;
  res.status(status).json({
    message: 'Внутренняя ошибка сервера',
  });
}
