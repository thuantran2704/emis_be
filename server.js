import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import sanitizePackage from 'express-mongo-sanitize';
import Appointment from './models/appointments.js';
import axios from 'axios';
import nodemailer from 'nodemailer';
// Initialize environment variiables
dotenv.config();

// Create Express app
const app = express();

// =======================
// FX RATE CACHE (USD -> VND)
// =======================
let fxCache = {
  rate: 25000, // safe fallback
  lastUpdated: null
};


const FX_UPDATE_INTERVAL = 2 * 60 * 60 * 1000; // 2 hours

async function updateFxRate() {
  try {
    const response = await axios.get('https://api.fxratesapi.com/latest', {
      params: {
        api_key: process.env.FX_API_KEY,
        base: 'USD',
        currencies: 'VND',
        places: 6,
        format: 'JSON'
      },
      timeout: 5000
    });

    const vndRate = response.data?.rates?.VND;

    if (!vndRate) {
      throw new Error('VND rate missing in response');
    }

    fxCache.rate = vndRate;
    fxCache.lastUpdated = new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" });

    console.log(`💱 FX updated: 1 USD = ${vndRate} VND`);
  } catch (err) {
    console.error('❌ FX update failed:', err.message);
    // IMPORTANT: keep old rate if fetch fails
  }
}

// Initial fetch on boot
updateFxRate();

// Refresh every 2 hours
setInterval(updateFxRate, FX_UPDATE_INTERVAL);


// 2. Security middlewares

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_SENDER,         // e.g. emisdental@gmail.com
    pass: process.env.EMAIL_APP_PASSWORD    // Use App Password, NOT real Gmail password
  }
});

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
    const notifyList = ['duonglandai@gmail.com', 'thuantran2704@gmail.com', 'quoctritran2000@gmail.com'];

    const mailOptions = {
      from: `"EMIS Dental" <${process.env.EMAIL_SENDER}>`,
      to: notifyList,
      subject: '🦷 Có lịch hẹn mới tại EMIS Dental',
      text: `Xin chào,

    Một lịch hẹn mới vừa được đặt thông qua website EMIS Dental:

    👤 Họ tên: ${formData.name}
    📧 Email: ${formData.email}
    📞 Số điện thoại: ${formData.phone}
    📅 Ngày: ${formData.date}
    🕒 Giờ: ${formData.time}
    💬 Dịch vụ: ${formData.service}

    Vui lòng đăng nhập vào trang quản lý để xem chi tiết và phản hồi:
    👉 https://emis-dental.netlify.app/login

    Trân trọng,
    Hệ thống EMIS Dental
    `
    };
    await transporter.sendMail(mailOptions);
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

app.get('/api/exchange-rate', (req, res) => {
  try {
    // Always return cached rate
    if (typeof fxCache.rate === 'number') {
      return res.json({
        success: true,
        base: 'USD',
        target: 'VND',
        rate: fxCache.rate,
        lastUpdated: fxCache.lastUpdated
      });
    }

    // Cache corrupted (not a number)
    console.warn('⚠️ FX cache invalid. Sending alert email...');
    transporter.sendMail({
      from: `"EMIS Dental" <${process.env.EMAIL_SENDER}>`,
      to: 'thuantran2704@gmail.com',
      subject: '⚠️ FX Rate Corrupted',
      text: `Alert: The FX rate for USD→VND is invalid.
Time: ${new Date().toISOString()}`
    }).catch(err => console.error('❌ Failed to send FX alert email:', err));

    // Return safe fallback
    return res.json({
      success: false,
      base: 'USD',
      target: 'VND',
      rate: 25000,
      lastUpdated: fxCache.lastUpdated,
      warning: 'FX rate cache invalid. Admin notified.'
    });

  } catch (err) {
    console.error('❌ /api/exchange-rate error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving FX rate'
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