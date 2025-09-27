const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// MySQL connection
const db = mysql.createPool({
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE, 
  port: process.env.MYSQLPORT,
  ssl: { rejectUnauthorized: false }
});

db.getConnection((err, connection) => {
  if (err) {
    console.error('❌ MySQL connection failed:', err);
  } else {
    console.log('✅ Connected to MySQL Database');
    connection.release();
  }
});

// Serve static files
app.use(express.static(path.join(__dirname)));

// Helper function: classify slot based on current time
function getSlotType() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  const morningStart = 8 * 60 + 30;  // 08:30 AM
  const morningEnd   = 14 * 60;      // 02:00 PM
  const eveningStart = 16 * 60 + 30; // 04:30 PM
  const eveningEnd   = 22 * 60;      // 10:00 PM

  if (totalMinutes >= morningStart && totalMinutes <= morningEnd) {
    return "Morning Slot Booked";
  } else if (totalMinutes >= eveningStart && totalMinutes <= eveningEnd) {
    return "Evening Slot Booked";
  } else {
    return null; // outside valid slots
  }
}

// Route to handle feedback submission
app.post('/submit', (req, res) => {
  const { name, message } = req.body;

  if (!name || !message) {
    return res.status(400).json({ status: 'error', message: 'Name and message are required' });
  }

  // Determine slot
  const slot_type = getSlotType();
  if (!slot_type) {
    return res.status(403).json({
      status: 'error',
      message: 'Appointments are only accepted between 8:30 AM - 2:00 PM or 4:30 PM - 10:00 PM'
    });
  }

  const sql = 'INSERT INTO feedback (name, message, slot_type) VALUES (?, ?, ?)';
  db.query(sql, [name, message, slot_type], (err, result) => {
    if (err) {
      console.error('❌ Error inserting feedback:', err);
      return res.status(500).json({ status: 'error', message: 'Database error' });
    }

    res.json({
      status: 'success',
      message: `${slot_type} booked successfully!`,
      appointmentNumber: result.insertId,
      slot_type: slot_type
    });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
