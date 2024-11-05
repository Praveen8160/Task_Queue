const Redis = require("redis");

// Create and connect Redis client
const redisclient = Redis.createClient(); // Create Redis client


// Connect to Redis
async function connectRedis() {
  try {
    await redisclient.connect(); // Explicitly connect the Redis client
    console.log("Connected to Redis");
  } catch (error) {
    console.error("Redis connection error:", error);
  }
}
connectRedis();

module.exports = redisclient;