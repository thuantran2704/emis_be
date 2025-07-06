import mongoose from 'mongoose';

const appointmentSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'Name is required'],
    trim: true,
    maxlength: 100
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    maxlength: 100
  },
  phone: {
    type: String,
    required: [true, 'Phone is required'],
    trim: true,
    maxlength: 20
  },
  date: {
    type: Date,
    required: [true, 'Appointment date is required']
  },
  service: {
    type: String,
    required: [true, 'Service is required']
  },
  message: {
    type: String,
    trim: true,
    maxlength: 500
  },
  language: {
    type: String,
    required: [true, 'Language is required'],
    enum: ['vietnamese', 'english', 'simplified', 'traditional', 'french', 'korean'],
    default: 'vietnamese'
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

export default mongoose.model('Appointment', appointmentSchema);