import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { config } from './config/env';
import routes from './routes';
import { errorHandler } from './middlewares/errorHandler';
import { ApiError } from './utils/apiError';

const app: Application = express();

// Security and utility middlewares
app.use(helmet());
app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
  })
);
app.use(morgan(config.nodeEnv === 'development' ? 'dev' : 'combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Base route
app.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'Backend API is running successfully',
    version: '1.0.0',
  });
});

// API Routes
app.use('/api/v1', routes);

// 404 Not Found Handler
app.use((req: Request, _res: Response, next: NextFunction) => {
  next(new ApiError(404, `Cannot find ${req.originalUrl} on this server`));
});

// Global Error Handler
app.use(errorHandler);

export default app;
