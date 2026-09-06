import express from 'express';
import cors from 'cors';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { config } from './config/env';
import emailRoutes from './routes/email.routes';
import slackRoutes from './routes/slack.routes';
import { emailQueue } from './queue/email.queue';
import { startEmailWorker } from './queue/email.worker';
import { reconcileQueueWithDB } from './queue/reconcile';
import { initElasticsearch } from './services/elasticsearch.service';

const app = express();

app.use(cors());
app.use(express.json());

// BullMQ Queue Dashboard Mount
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter,
});

app.use('/admin/queues', serverAdapter.getRouter());

// API Endpoints
app.use('/api/emails', emailRoutes);
app.use('/api/slack', slackRoutes);

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    queues: {
      bullBoardUrl: `http://localhost:${config.PORT}/admin/queues`,
    },
  });
});

app.listen(config.PORT, async () => {
  console.log(`[Server] Email Scheduler Service listening on port ${config.PORT}`);
  console.log(`[Server] Queue Dashboard: http://localhost:${config.PORT}/admin/queues`);

  // Initialize search index, worker, and database queue reconciliation
  await initElasticsearch();
  startEmailWorker();
  await reconcileQueueWithDB();
});
