# EMIS Dental - Appointment API

This is a secure Express.js backend service for handling appointment submissions from the EMIS Dental website. It connects to MongoDB, applies security best practices, and supports appointment data validation and rate limiting.

---

## 🚀 Features

- 📬 Accepts appointment submissions via POST
- 🔒 Secured with:
  - Rate limiting (50 req / 15 mins)
  - Body size restriction (10KB)
  - Input sanitization to prevent MongoDB injection
- 🌐 CORS-enabled for frontend integration
- 📦 MongoDB integration with Mongoose
- 🧪 Basic input validation for required fields

---

## 🛠 Technologies

- **Node.js** + **Express.js**
- **MongoDB** with **Mongoose**
- **dotenv** for environment configuration
- **express-rate-limit** for throttling
- **express-mongo-sanitize** for input sanitization
- **CORS**

---

## 📁 Project Structure

