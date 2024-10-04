const express = require('express');
const Bull = require('bull');
const redis = require('redis');
const { task } = require('./task');
const cluster = require('cluster');
const os = require('os');

// Create Redis client
const redisClient = redis.createClient();

// Create a task queue
const taskQueue = new Bull('task-queue', {
  redis: {
    host: '127.0.0.1',
    port: 6379,
  }
});

// Middleware for rate limiting
const rateLimiter = {};

// API route
const app = express();
app.use(express.json());

// Route for processing tasks
app.post('/task', async (req, res) => {
  const { user_id } = req.body;

  // Rate-limiting check
  if (!rateLimiter[user_id]) {
    rateLimiter[user_id] = {
      lastRequestTime: 0,
      requestCount: 0,
      minuteWindowStart: Date.now()
    };
  }

  const currentTime = Date.now();
  const userLimits = rateLimiter[user_id];

  // Check for 1 task per second and 20 tasks per minute
  if (currentTime - userLimits.lastRequestTime < 1000 || userLimits.requestCount >= 20) {
    return res.status(429).send('Rate limit exceeded, task queued.');
  }

  // Add task to queue
  await taskQueue.add({ user_id });

  // Update rate limiter
  userLimits.lastRequestTime = currentTime;
  userLimits.requestCount++;
  if (currentTime - userLimits.minuteWindowStart >= 60000) {
    userLimits.minuteWindowStart = currentTime;
    userLimits.requestCount = 1;
  }

  res.status(200).send('Task is being processed');
});

// Bull queue processor
taskQueue.process(async (job) => {
  const { user_id } = job.data;
  await task(user_id); // Call the task function
});

// Setup cluster for resiliency and load balancing
if (cluster.isMaster) {
  const numCPUs = os.cpus().length;
  for (let i = 0; i < 2; i++) { // Create 2 replicas
    cluster.fork();
  }
} else {
  app.listen(3000, () => {
    console.log('Server running on port 3000');
  });
}
