import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Admin from './models/Admin.js';
import jwt from 'jsonwebtoken';
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

const createToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d'
  });
};

// Add after your CORS middleware
app.post('/api/admin/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const admin = await Admin.create({ username, email, password });
    const token = createToken(admin._id);
    
    res.status(201).json({ 
      status: 'success', 
      token,
      data: { admin } 
    });
  } catch (err) {
    res.status(400).json({
      status: 'fail',
      message: err.message
    });
  }
});

app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // 1) Check if email and password exist
    if (!email || !password) {
      throw new Error('Please provide email and password');
    }
    
    // 2) Check if admin exists and password is correct
    const admin = await Admin.findOne({ email }).select('+password');
    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      throw new Error('Incorrect email or password');
    }
    
    // 3) Send token
    const token = createToken(admin._id);
    res.status(200).json({
      status: 'success',
      token,
      data: { admin }
    });
  } catch (err) {
    res.status(401).json({
      status: 'fail',
      message: err.message
    });
  }
});

// Add protected route example
app.get('/api/admin/protected', async (req, res) => {
  try {
    // Get token from header
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) throw new Error('No token provided');
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get admin data
    const admin = await Admin.findById(decoded.id);
    if (!admin) throw new Error('Admin no longer exists');
    
    res.status(200).json({
      status: 'success',
      data: { admin }
    });
  } catch (err) {
    res.status(401).json({
      status: 'fail',
      message: err.message
    });
  }
});
// 4. Form submission endpoint
app.post('/api/appointments', async (req, res) => {
  try {
    // Validate required fields
    const requiredFields = ['name', 'email', 'phone', 'language'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        message: `Missing required fields: ${missingFields.join(', ')}` 
      });
    }

    // Validate language
    const validLanguages = ['vietnamese', 'english', 'simplified', 'traditional', 'french', 'korean'];
    if (!validLanguages.includes(req.body.language.toLowerCase())) {
      return res.status(400).json({ 
        message: `Invalid language. Must be one of: ${validLanguages.join(', ')}` 
      });
    }

    // Create and save appointment
    const newAppointment = new Appointment({
      name: req.body.name.trim().substring(0, 100),
      email: req.body.email.trim().toLowerCase().substring(0, 100),
      phone: req.body.phone.trim().substring(0, 20),
      date: req.body.date || undefined,
      service: req.body.service || 'General Checkup',
      message: req.body.message?.trim().substring(0, 500) || '',
      language: req.body.language.toLowerCase() // Ensure lowercase
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