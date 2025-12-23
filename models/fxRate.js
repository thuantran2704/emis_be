import mongoose from 'mongoose';

const fxRateSchema = new mongoose.Schema({
  rate: { type: Number, required: true },
  lastUpdated: { type: Date, required: true } // store as Date; can format to VN time when displaying
});

export default mongoose.model('FxRate', fxRateSchema);
