import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import sanitizePackage from 'express-mongo-sanitize';
import Appointment from './models/Appointments.js';

// Initialize environment variables
dotenv.config();

// Create Express app
const app = express();

// 2. Security middlewares

app.use(cors({
  origin: function (origin, callback) {
    const allowed = [
      'https://www.emisdental.com',
      'https://emisdental.com',
      'http://localhost:5173',
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

// // 2. Rate limiting configuration
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 50, // Limit each IP to 50 requests per window
//   message: 'Too many submissions from this IP, please try again later',
//   standardHeaders: true,
//   legacyHeaders: false
// });


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


// // Apply rate limiting to appointments endpoint
// app.use('/api/appointments', limiter);

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
// 5. Get appointments endpoints
app.get('/api/appointments', async (req, res) => {
  try {
    // Basic authentication check (you might want to enhance this)
    if (!req.headers.authorization || req.headers.authorization !== `Bearer ${process.env.ADMIN_TOKEN}`) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Get all appointments (sorted by date descending)
    const appointments = await Appointment.find().sort({ createdAt: -1 });
    res.status(200).json(appointments);
  } catch (error) {
    console.error('🚨 Fetch error:', error);
    res.status(500).json({ 
      message: 'Failed to fetch appointments',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get appointments by time frame
app.get('/api/appointments/:timeframe', async (req, res) => {
  try {
    // Authentication check
    if (!req.headers.authorization || req.headers.authorization !== `Bearer ${process.env.ADMIN_TOKEN}`) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { timeframe } = req.params;
    let startDate, endDate = new Date();

    // Set date ranges based on timeframe
    switch (timeframe) {
      case 'today':
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'year':
        startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        return res.status(400).json({ message: 'Invalid timeframe. Use today, week, month, or year' });
    }

    const appointments = await Appointment.find({
      createdAt: { $gte: startDate, $lte: endDate }
    }).sort({ createdAt: -1 });

    res.status(200).json(appointments);
  } catch (error) {
    console.error('🚨 Timeframe fetch error:', error);
    res.status(500).json({ 
      message: 'Failed to fetch appointments',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get appointments between custom dates
app.get('/api/appointments/custom/:start/:end', async (req, res) => {
  try {
    // Authentication check
    if (!req.headers.authorization || req.headers.authorization !== `Bearer ${process.env.ADMIN_TOKEN}`) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const startDate = new Date(req.params.start);
    const endDate = new Date(req.params.end);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD' });
    }

    // Add time to end date to include the entire day
    endDate.setHours(23, 59, 59, 999);

    const appointments = await Appointment.find({
      createdAt: { $gte: startDate, $lte: endDate }
    }).sort({ createdAt: -1 });

    res.status(200).json({
      count: appointments.length,
      appointments
    });
  } catch (error) {
    console.error('🚨 Custom date fetch error:', error);
    res.status(500).json({ 
      message: 'Failed to fetch appointments',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});
// Confirm appointment endpoint
app.put('/api/appointments/:id/confirm', async (req, res) => {
  try {
    if (!req.headers.authorization || req.headers.authorization !== `Bearer ${process.env.ADMIN_TOKEN}`) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const updatedAppointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      { status: 'confirmed' },
      { new: true }
    );

    if (!updatedAppointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    res.status(200).json(updatedAppointment);
  } catch (error) {
    console.error('🚨 Confirmation error:', error);
    res.status(500).json({ 
      message: 'Failed to confirm appointment',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Delete appointment endpoint
app.delete('/api/appointments/:id', async (req, res) => {
  try {
    if (!req.headers.authorization || req.headers.authorization !== `Bearer ${process.env.ADMIN_TOKEN}`) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const deletedAppointment = await Appointment.findByIdAndDelete(req.params.id);

    if (!deletedAppointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    res.status(200).json({ message: 'Appointment deleted successfully' });
  } catch (error) {
    console.error('🚨 Deletion error:', error);
    res.status(500).json({ 
      message: 'Failed to delete appointment',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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