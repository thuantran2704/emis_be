import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import sanitizePackage from 'express-mongo-sanitize';
import Appointment from './models/appointments.js';
import axios from 'axios';
// Initialize environment variiables
dotenv.config();

// Create Express app
const app = express();

// 2. Security middlewares

app.use(cors({
  origin: function (origin, callback) {
    const allowed = [
      'https://www.emisdental.com',
      'https://emisdental.com',
      /\.vercel\.app$/
    ];
    if (!origin) return callback(null, true);
    if (allowed.some(pattern => typeof pattern === 'string' ? origin === pattern : pattern.test(origin))) {
      return callback(null, true);
    } else {
      console.warn('Blocked by CORS:', origin);
      return callback(new Error(`CORS: Not allowed - ${origin}`));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
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


mongoose.connect(process.env.MONGODB_URI)
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

app.post('/api/appointments', async (req, res) => {
  try {
    // 1. Extract recaptchaToken and other fields
    const { recaptchaToken, language, ...formData } = req.body;

    // 2. Verify reCAPTCHA exists
    if (!recaptchaToken) {
      return res.status(400).json({ 
        success: false,
        error: "RECAPTCHA_REQUIRED",
        message: "reCAPTCHA verification required" 
      });
    }

    // 3. Validate with Google's API
    let recaptchaResponse;
    try {
      recaptchaResponse = await axios.post(
        `https://www.google.com/recaptcha/api/siteverify`,
        new URLSearchParams({
          secret: process.env.RECAPTCHA_SECRET_KEY,
          response: recaptchaToken
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
    } catch (recaptchaError) {
      console.error('reCAPTCHA API error:', recaptchaError);
      return res.status(502).json({
        success: false,
        error: "RECAPTCHA_SERVICE_ERROR",
        message: "Unable to verify reCAPTCHA at this time"
      });
    }

    if (!recaptchaResponse.data.success) {
      return res.status(400).json({
        success: false,
        error: "RECAPTCHA_FAILED",
        message: "Failed reCAPTCHA verification",
        details: recaptchaResponse.data['error-codes'] || []
      });
    }

    // 4. Validate required fields
    const requiredFields = ['name', 'phone'];
    const missingFields = requiredFields.filter(field => !formData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        success: false,
        error: "MISSING_FIELDS",
        message: `Missing required fields: ${missingFields.join(', ')}`,
        missingFields
      });
    }

    // 5. Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      return res.status(400).json({
        success: false,
        error: "INVALID_EMAIL",
        message: "Please provide a valid email address"
      });
    }

    // 6. Create and save appointment
    const newAppointment = new Appointment({
      name: formData.name.trim().substring(0, 100),
      email: formData.email.trim().toLowerCase().substring(0, 100),
      phone: formData.phone.trim().substring(0, 20),
      date: formData.date || undefined,
      service: formData.service || 'General Checkup',
      message: formData.message?.trim().substring(0, 500) || '',
      language: language
    });

    await newAppointment.save();
    
    return res.status(201).json({ 
      success: true,
      message: 'Appointment request received! We will contact you soon.' 
    });

  } catch (error) {
    console.error('Submission error:', error);

    // Handle specific database errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_ERROR",
        message: "Invalid data provided",
        details: error.errors
      });
    }

    if (error.code === 11000) { // MongoDB duplicate key
      return res.status(409).json({
        success: false,
        error: "DUPLICATE_ENTRY",
        message: "An appointment with this email already exists"
      });
    }

    // Generic server error
    return res.status(500).json({ 
      success: false,
      error: "SERVER_ERROR",
      message: 'An unexpected error occurred. Please try again later.'
    });
  }
});

// 5. Start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on 0.0.0.0:${PORT}`);
});

// Handle shutdown gracefully
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('💤 Server terminated');
    process.exit(0);
  });
});