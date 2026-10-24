import { Request, Response } from 'express';
import { ApiResponse } from '../utils/apiResponse';

export const getHealth = (_req: Request, res: Response): void => {
  const healthData = {
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    status: 'healthy',
  };

  res.status(200).json(new ApiResponse('Service is up and running', healthData));
};
