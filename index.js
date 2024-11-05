const express = require("express");
const cluster = require("cluster");
const { RateLimiterRedis } = require("rate-limiter-flexible");
const fs = require("fs");
const {processQueue} = require("./taskProcessor"); // Import task processor
const redisclient = require("./redisConnection"); // Create Redis client


if (cluster.isMaster) { // Check if running as master
  for (let i = 0; i < 2; i++) {
    cluster.fork(); // Create  cluster with two replica
  }
  cluster.on("exit", (worker) => { // Restart worker if crashed
    console.log(`Worker ${worker.process.pid} exited`);
    cluster.fork(); // Restart the worker if it crashes
  });
} else {
  const app = express();
  app.use(express.json());
  setInterval(processQueue, 1000); // Process queue every second

  const rateLimiterPerSecond = new RateLimiterRedis({ // Create rate limiters
    storeClient: redisclient,
    points: 1,            // 1 task per second
    duration: 1,          // per 1 second
    blockDuration: 1,     // Block for 1 second if the limit is reached
    keyPrefix: "rateLimiterPerSecond",
  });

  const rateLimiterPerMinute = new RateLimiterRedis({
    storeClient: redisclient,
    points: 20,           // 20 tasks per minute
    duration: 60,         // per 60 seconds
    blockDuration: 1,     // Block for 1 second if the limit is reached
    keyPrefix: "rateLimiterPerMinute",
  });

  async function task(user_id) {
    const logMessage = `${user_id} - task completed at ${new Date().toISOString()}\n`;
    fs.appendFileSync("task_logs.txt", logMessage); // Logs task to file
    console.log(logMessage);
  }

  app.post("/task", async (req, res) => {
    const { user_id } = req.body; // Get user_id from request
    try {
      // Check rate limit for this user
      await rateLimiterPerSecond.consume(user_id);
      await rateLimiterPerMinute.consume(user_id);
      // If rate limit is OK, process task immediately
      console.log("Task processed immediately")
      await task(user_id);
     
      res.status(200).send("Task processed immediately");
    } catch (rateLimitError) {
      // If rate limit exceeded, add task to queue in Redis
      try {
        await redisclient.lPush(
          `queue_${user_id}`,
          JSON.stringify({ user_id, timestamp: Date.now() })
        );
        console.log("task queued");
        res.status(429).send("Task queued due to rate limit");
      } catch (err) {
        console.error("Error queuing task:", err);
        res.status(500).send("Server error");
      }
    }
  });

  app.listen(3000, () => {
    console.log(`Worker ${process.pid} running on port 3000`);
  });
}
