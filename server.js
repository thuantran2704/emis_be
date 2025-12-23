import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import sanitizePackage from 'express-mongo-sanitize';
import Appointment from './models/appointments.js';
import FxRate from './models/fxRate.js';
import axios from 'axios';
import nodemailer from 'nodemailer';

// Initialize environment variables
dotenv.config();

// Create Express app
const app = express();

// =======================
// 2. Security middlewares
// =======================

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_SENDER,
    pass: process.env.EMAIL_APP_PASSWORD
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

app.use((req, _, next) => {
  if (req.body) req.body = sanitizePackage.sanitize(req.body);
  if (req.query) sanitizePackage.sanitize(req.query);
  next();
});

// =======================
// MongoDB connection
// =======================
mongoose.connect(process.env.MONGODB_URI)
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// =======================
// 3. Appointments endpoint
// =======================
app.post('/api/appointments', async (req, res) => {
  try {
    const { recaptchaToken, language, ...formData } = req.body;

    if (!recaptchaToken) {
      return res.status(400).json({
        success: false,
        error: "RECAPTCHA_REQUIRED",
        message: "reCAPTCHA verification required"
      });
    }

    // Validate reCAPTCHA
    let recaptchaResponse;
    try {
      recaptchaResponse = await axios.post(
        `https://www.google.com/recaptcha/api/siteverify`,
        new URLSearchParams({
          secret: process.env.RECAPTCHA_SECRET_KEY,
          response: recaptchaToken
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
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

    // Validate required fields
    const requiredFields = ['name', 'phone'];
    const missingFields = requiredFields.filter(f => !formData[f]);
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: "MISSING_FIELDS",
        message: `Missing required fields: ${missingFields.join(', ')}`,
        missingFields
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      return res.status(400).json({
        success: false,
        error: "INVALID_EMAIL",
        message: "Please provide a valid email address"
      });
    }

    // Save appointment
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
Hệ thống EMIS Dental`
    };

    await transporter.sendMail(mailOptions);

    return res.status(201).json({
      success: true,
      message: 'Appointment request received! We will contact you soon.'
    });

  } catch (error) {
    console.error('Submission error:', error);

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_ERROR",
        message: "Invalid data provided",
        details: error.errors
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: "DUPLICATE_ENTRY",
        message: "An appointment with this email already exists"
      });
    }

    return res.status(500).json({
      success: false,
      error: "SERVER_ERROR",
      message: 'An unexpected error occurred. Please try again later.'
    });
  }
});

// =======================
// 4. FX RATE logic
// =======================

let fxCache = { rate: null, lastUpdated: null };
const FX_UPDATE_INTERVAL = 2 * 60 * 60 * 1000; // 2 hours

async function fetchFxRateFromApi() {
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
    if (!vndRate) throw new Error('VND rate missing in response');

    const now = new Date();

    await FxRate.findOneAndUpdate({}, { rate: vndRate, lastUpdated: now }, { upsert: true, new: true });

    fxCache.rate = vndRate;
    fxCache.lastUpdated = now;

    console.log(`💱 FX updated: 1 USD = ${vndRate} VND (VN time: ${now.toLocaleString("en-US",{ timeZone:"Asia/Ho_Chi_Minh" })})`);
    return { rate: vndRate, lastUpdated: now };

  } catch (err) {
    console.error('❌ FX API fetch failed:', err.message);
    return null;
  }
}

async function loadFxRate() {
  try {
    const doc = await FxRate.findOne({});
    if (doc) {
      fxCache.rate = doc.rate;
      fxCache.lastUpdated = new Date(doc.lastUpdated);
      console.log(`🗄️ Loaded FX rate from DB: ${fxCache.rate} (VN time: ${fxCache.lastUpdated.toLocaleString("en-US",{ timeZone:"Asia/Ho_Chi_Minh" })})`);
    } else {
      console.log('No FX rate found in DB, fetching from API...');
      await fetchFxRateFromApi();
    }
  } catch (err) {
    console.error('❌ Failed to load FX rate from DB:', err);
    await fetchFxRateFromApi();
  }
}

async function getFxRate() {
  const now = new Date();
  if (!fxCache.rate || !fxCache.lastUpdated || (now - fxCache.lastUpdated > FX_UPDATE_INTERVAL)) {
    console.log('FX cache expired or empty, fetching from API...');
    const result = await fetchFxRateFromApi();
    if (result) return result;
  }
  return fxCache;
}

// FX rate endpoint for frontend
app.get('/api/exchange-rate', async (req, res) => {
  try {
    const fx = await getFxRate();
    res.json({
      success: true,
      base: 'USD',
      target: 'VND',
      rate: fx.rate,
      lastUpdated: fx.lastUpdated.toLocaleString("en-US",{ timeZone:"Asia/Ho_Chi_Minh" })
    });
  } catch (err) {
    console.error('❌ /api/exchange-rate error:', err);
    res.status(500).json({
      success: false,
      base: 'USD',
      target: 'VND',
      rate: 25000,
      lastUpdated: null,
      message: 'Error retrieving FX rate'
    });
  }
});

// Initial load & periodic update
loadFxRate();
setInterval(fetchFxRateFromApi, FX_UPDATE_INTERVAL);

// =======================
// 5. Start server
// =======================
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on 0.0.0.0:${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('💤 Server terminated');
    process.exit(0);
  });
});