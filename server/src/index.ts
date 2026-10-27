import path from 'node:path';
import cors from 'cors';
import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import { prisma } from './lib/prisma';
import { errorHandler, notFoundHandler } from './middleware/error';
import { authRouter } from './routes/auth.routes';
import { authorRouter, bookRouter, categoryRouter } from './routes/book.routes';
import { cartRouter } from './routes/cart.routes';
import { checkoutRouter, couponRouter } from './routes/checkout.routes';
import { orderRouter, paymentRouter } from './routes/order.routes';
import { reviewRouter } from './routes/review.routes';

dotenv.config();

export const app = express();

const corsOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173,http://localhost:3000')
  .split(',')
  .map((o) => o.trim());

app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json());

// OpenAPI / Swagger UI
const openApiDocument = YAML.load(path.join(__dirname, 'docs', 'openapi.yaml'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocument, { customSiteTitle: 'Book Worm API Docs' }));
app.get('/api-docs.json', (_req, res) => {
  res.json(openApiDocument);
});

// Health check
app.get('/api/health', async (_req: Request, res: Response) => {
  const body = {
    status: 'ok',
    database: 'connected',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  };
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json(body);
  } catch {
    res.status(503).json({ ...body, status: 'error', database: 'disconnected' });
  }
});

// API routes
app.use('/api/auth', authRouter);
app.use('/api/categories', categoryRouter);
app.use('/api/books', bookRouter);
app.use('/api/authors', authorRouter);
app.use('/api', reviewRouter); // /books/:bookId/reviews and /reviews/:reviewId
app.use('/api/cart', cartRouter);
app.use('/api/checkout', checkoutRouter);
app.use('/api/coupons', couponRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/orders', orderRouter);

// 404 + error middleware (must stay last)
app.use(notFoundHandler);
app.use(errorHandler);

const port = Number(process.env.PORT) || 5000;

async function start() {
  await prisma.$connect();
  console.log('Database connected');
  app.listen(port, () => {
    console.log(`Book Worm API listening on http://localhost:${port}`);
    console.log(`Swagger UI:  http://localhost:${port}/api-docs`);
    console.log(`Health:      http://localhost:${port}/api/health`);
  });
}

if (require.main === module) {
  start().catch((err) => {
    console.error('Failed to start server', err);
    process.exit(1);
  });
}
