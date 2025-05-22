import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import sanitizePackage from 'express-mongo-sanitize';
import Appointment from './models/Appointments.js';

// Initialize environment variables
dotenv.config();

// Create Express app
const app = express();

// 1. Rate limiting configuration
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 requests per window
  message: 'Too many submissions from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

// 2. Security middlewares
app.use(cors({
  origin: function (origin, callback) {
    // Allow all in development
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }

    const allowed = [
      'https://www.emisdental.com',
      'https://emisdental.com',
      'http://localhost:5173',
      /\.vercel\.app$/
    ];
    
    if (!origin) return callback(null, true);
    
    if (allowed.some(pattern => {
      return typeof pattern === 'string' 
        ? origin === pattern 
        : pattern.test(origin);
    })) {
      callback(null, true);
    } else {
      console.warn('Blocked by CORS:', origin);
      callback(new Error(`Not allowed by CORS. Origin: ${origin}`));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10kb' }));

// Correct sanitization middleware
app.use((req, _, next) => {
  if (req.body) {
    req.body = sanitizePackage.sanitize(req.body); // OK, since you can reassign body
  }
  if (req.query) {
    sanitizePackage.sanitize(req.query); // ✅ directly sanitize in place without reassignment
  }
  next();
});


// Apply rate limiting to appointments endpoint
app.use('/api/appointments', limiter);

// 3. MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// 4. Form submission endpoint
app.post('/api/appointments', async (req, res) => {
  try {
    // Validate required fields
    const requiredFields = ['name', 'email', 'phone'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        message: `Missing required fields: ${missingFields.join(', ')}` 
      });
    }

    // Create and save appointment
    const newAppointment = new Appointment({
      name: req.body.name.trim().substring(0, 100),
      email: req.body.email.trim().toLowerCase().substring(0, 100),
      phone: req.body.phone.trim().substring(0, 20),
      date: req.body.date || undefined,
      service: req.body.service || 'General Checkup',
      message: req.body.message?.trim().substring(0, 500) || ''
    });

    await newAppointment.save();
    
    res.status(201).json({ 
      success: true,
      message: 'Appointment request received! We will contact you soon.' 
    });
  } catch (error) {
    console.error('🚨 Submission error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to process request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 5. Start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// Handle shutdown gracefully
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('💤 Server terminated');
    process.exit(0);
  });
});