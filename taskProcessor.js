const fs = require("fs");

// Create and connect Redis client
const redisclient = require("./redisConnection") // Create Redis client

async function task(user_id) {
  //   console.log("user_id", user_id);
  const logMessage = `${user_id} - task completed at ${new Date().toISOString()}\n`;
  fs.appendFileSync("task_logs.txt", logMessage); // Log to file
  console.log("queue task Processed =>" + logMessage);
}

// Process each user's queue
async function processQueue() {
  try {
    // console.log("debugging");
    const keys = await redisclient.keys("queue_*"); // Find all user queues
    for (const key of keys) {
      const taskData = await redisclient.rPop(key); // Get the oldest task

      if (taskData) {
        const { user_id } = JSON.parse(taskData);
        await task(user_id); // Process the task
      }
    }
  } catch (error) {
    console.log("error", error);
  }
}

module.exports = { processQueue };
