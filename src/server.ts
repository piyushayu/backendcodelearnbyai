import app from './app';
import { config } from './config/env';

const server = app.listen(config.port, () => {
  console.log(`🚀 Server listening on port ${config.port} in ${config.nodeEnv} mode`);
  console.log(`📡 Local URL: http://localhost:${config.port}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received. Shutting down gracefully');
  server.close(() => {
    console.log('💥 Process terminated!');
  });
});

process.on('SIGINT', () => {
  console.log('👋 SIGINT received. Shutting down gracefully');
  server.close(() => {
    console.log('💥 Process terminated!');
  });
});
