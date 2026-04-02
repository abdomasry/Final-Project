const mongoose = require("mongoose")

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI)
    console.log(`✅ MongoDB connected: ${conn.connection.host}`)
  } catch (error) {
    console.log(`❌ MongoDB error: ${error.message}`)
    process.exit(1) // ← stop the server if DB fails, no point running without it
  }
}

module.exports = connectDB