import { Router, Request, Response } from 'express';
import { authRouter } from './auth';
import { productsRouter } from './products';
import { invoicesRouter } from './invoices';
import { carsRouter } from './cars';
import { driversRouter } from './drivers';
import { ocrRouter } from './ocr';
import { warehouseRouter } from './warehouse';
import { reportsRouter } from './reports';
import { financeRouter } from './finance';
import { counterpartiesRouter } from './counterparties';
import { counterpartyReportsRouter } from './counterpartyReports';
import { checksRouter } from './checks';
import { clientsRouter } from './clients';
import { aiRouter } from './ai';
import { salariesRouter } from './salaries';
import { usersRouter } from './users';
import { filesRouter } from './files';
import { messagesRouter } from './messages';
import { pushRouter } from './push';

export const apiRouter = Router();

apiRouter.get('/ping', (_req: Request, res: Response) => {
  res.json({ message: 'pong' });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/products', productsRouter);
apiRouter.use('/invoices', invoicesRouter);
apiRouter.use('/cars', carsRouter);
apiRouter.use('/drivers', driversRouter);
apiRouter.use('/ocr', ocrRouter);
apiRouter.use('/warehouse', warehouseRouter);
apiRouter.use('/reports', reportsRouter);
apiRouter.use('/finance', financeRouter);
apiRouter.use('/counterparties', counterpartiesRouter);
apiRouter.use('/counterparty-reports', counterpartyReportsRouter);
apiRouter.use('/checks', checksRouter);
apiRouter.use('/clients', clientsRouter);
apiRouter.use('/ai', aiRouter);
apiRouter.use('/salaries', salariesRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/files', filesRouter);
apiRouter.use('/messages', messagesRouter);
apiRouter.use('/push', pushRouter);
