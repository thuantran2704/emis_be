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

    // 2. Verify reCAPTCHA first (before processing the form)
    if (!recaptchaToken) {
      return res.status(400).json({ 
        success: false,
        message: "reCAPTCHA verification required" 
      });
    }

    // 3. Validate with Google's API
    const recaptchaResponse = await axios.post(
      `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${recaptchaToken}`
    );

    if (!recaptchaResponse.data.success) {
      return res.status(400).json({
        success: false,
        message: "Failed reCAPTCHA verification",
        errors: recaptchaResponse.data["error-codes"] || []
      });
    }

    // 4. Proceed with your existing validation
    const requiredFields = ['name', 'email', 'phone'];
    const missingFields = requiredFields.filter(field => !formData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}` 
      });
    }

    // 5. Create and save appointment (your existing logic)
    const newAppointment = new Appointment({
      name: formData.name.trim().substring(0, 100),
      email: formData.email.trim().toLowerCase().substring(0, 100),
      phone: formData.phone.trim().substring(0, 20),
      date: formData.date || undefined,
      service: formData.service || 'General Checkup',
      message: formData.message?.trim().substring(0, 500) || '',
      language: language // Optional: Store language preference
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