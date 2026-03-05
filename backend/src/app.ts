import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import cookieParser from 'cookie-parser';

import { apiRouter } from './routes';
import { errorLogger } from './middleware/errorLogger';

export const createApp = () => {
  const app = express();

  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(morgan('dev'));

  // Статические файлы (для загруженных изображений и чеков)
  app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'globalsnab-backend' });
  });

  app.use('/api/v1', apiRouter);

  // Централизованный обработчик ошибок и логирование в файл
  app.use(errorLogger);

  return app;
};
