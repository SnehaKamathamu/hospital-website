// const express = require('express');
// const bodyParser = require('body-parser');
// const mysql = require('mysql2');
// const cors = require('cors');
// const path = require('path');

// const app = express();
// const PORT = 3000;

// // Middleware
// app.use(cors());
// app.use(bodyParser.urlencoded({ extended: true }));
// app.use(bodyParser.json());

// // MySQL connection
// const db = mysql.createPool({
//   host: process.env.MYSQLHOST,
//   user: process.env.MYSQLUSER,
//   password: process.env.MYSQLPASSWORD,
//   database: process.env.MYSQLDATABASE, 
//   port: process.env.MYSQLPORT,
//   ssl: { rejectUnauthorized: false }
// });

// db.getConnection((err, connection) => {
//   if (err) {
//     console.error('❌ MySQL connection failed:', err);
//   } else {
//     console.log('✅ Connected to MySQL Database');
//     connection.release();
//   }
// });

// // Serve static files
// app.use(express.static(path.join(__dirname)));

// // Helper function: classify slot based on IST
// function getSlotType() {
//   const now = new Date();

//   // Convert UTC to IST (+5:30)
//   const istOffset = 5.5 * 60; // in minutes
//   const totalMinutesUTC = now.getUTCHours() * 60 + now.getUTCMinutes();
//   const totalMinutesIST = totalMinutesUTC + istOffset;

//   const morningStart = 8 * 60 + 30;  // 08:30 AM IST
//   const morningEnd   = 14 * 60 + 30;      // 02:00 PM IST
//   const eveningStart = 16 * 60 + 30; // 04:30 PM IST
//   const eveningEnd   = 22 * 60;      // 10:00 PM IST

//   if (totalMinutesIST >= morningStart && totalMinutesIST <= morningEnd) {
//     return "Morning Slot Booked";
//   } else if (totalMinutesIST >= eveningStart && totalMinutesIST <= eveningEnd) {
//     return "Evening Slot Booked";
//   } else {
//     return null; // outside valid slots
//   }
// }

// // Route to handle feedback submission
// app.post('/submit', (req, res) => {
//   const { name, message } = req.body;

//   if (!name || !message) {
//     return res.status(400).json({ status: 'error', message: 'Name and message are required' });
//   }

//   // Determine slot
//   const slot_type = getSlotType();
//   if (!slot_type) {
//     return res.status(403).json({
//       status: 'error',
//       message: 'Appointments are only accepted between 8:30 AM - 2:00 PM or 4:30 PM - 10:00 PM IST'
//     });
//   }

//   const sql = 'INSERT INTO feedback (name, message, slot_type) VALUES (?, ?, ?)';
//   db.query(sql, [name, message, slot_type], (err, result) => {
//     if (err) {
//       console.error('❌ Error inserting feedback:', err);
//       return res.status(500).json({ status: 'error', message: 'Database error' });
//     }

//     res.json({
//       status: 'success',
//       message: `${slot_type} booked successfully!`,
//       appointmentNumber: result.insertId,
//       slot_type: slot_type
//     });
//   });
// });

// // Start server
// app.listen(PORT, () => {
//   console.log(`🚀 Server running on port ${PORT}`);
// }); 

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

// Helper: classify slot based on IST
function getSlotType() {
  const now = new Date();
  const istOffset = 5.5 * 60; // minutes
  const totalMinutesUTC = now.getUTCHours() * 60 + now.getUTCMinutes();
  const totalMinutesIST = totalMinutesUTC + istOffset;

  const morningStart = 8 * 60 + 30;  // 08:30 AM
  const morningEnd = 14 * 60 + 30;   // 02:00 PM
  const eveningStart = 16 * 60 + 30; // 04:30 PM
  const eveningEnd = 22 * 60;        // 10:00 PM

  if (totalMinutesIST >= morningStart && totalMinutesIST <= morningEnd) {
    return "Morning Slot Booked";
  } else if (totalMinutesIST >= eveningStart && totalMinutesIST <= eveningEnd) {
    return "Evening Slot Booked";
  } else {
    return null;
  }
}

// Helper: assign clinic visit time
function getClinicVisitTime(slotType, tokenNumber) {
  let startTime, endTime, maxAppointments = 40;

  if (slotType === "Morning Slot Booked") {
    startTime = new Date();
    startTime.setHours(10, 45, 0, 0); // 10:45 AM
    endTime = new Date();
    endTime.setHours(14, 0, 0, 0); // 2:00 PM
  } else if (slotType === "Evening Slot Booked") {
    startTime = new Date();
    startTime.setHours(18, 45, 0, 0); // 6:45 PM
    endTime = new Date();
    endTime.setHours(22, 0, 0, 0); // 10:00 PM
  } else {
    return null;
  }

  const totalMinutes = (endTime - startTime) / (1000 * 60); // total clinic minutes
  const interval = Math.floor(totalMinutes / maxAppointments); // per patient

  let visitTime;

  if (tokenNumber > maxAppointments) {
    visitTime = endTime; // cap at clinic closing time
  } else {
    visitTime = new Date(startTime.getTime() + interval * (tokenNumber - 1) * 60000);
  }

  const hours = visitTime.getHours().toString().padStart(2, "0");
  const minutes = visitTime.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

// Route to handle feedback submission
app.post('/submit', (req, res) => {
  const { name, message } = req.body;

  if (!name || !message) {
    return res.status(400).json({ status: 'error', message: 'Name and message are required' });
  }

  const slot_type = getSlotType();
  if (!slot_type) {
    return res.status(403).json({
      status: 'error',
      message: 'Appointments are only accepted between 8:30 AM - 2:00 PM or 4:30 PM - 10:00 PM IST'
    });
  }

  // Count existing appointments
  const countSql = 'SELECT COUNT(*) AS count FROM feedback WHERE slot_type = ?';
  db.query(countSql, [slot_type], (err, result) => {
    if (err) {
      console.error('❌ Error counting feedback:', err);
      return res.status(500).json({ status: 'error', message: 'Database error' });
    }

    const tokenNumber = result[0].count + 1;
    const clinicTime = getClinicVisitTime(slot_type, tokenNumber);

    const sql = 'INSERT INTO feedback (name, message, slot_type) VALUES (?, ?, ?)';
    db.query(sql, [name, message, slot_type], (err, result2) => {
      if (err) {
        console.error('❌ Error inserting feedback:', err);
        return res.status(500).json({ status: 'error', message: 'Database error' });
      }

      res.json({
        status: 'success',
        message: `${slot_type} booked successfully!`,
        appointmentNumber: result2.insertId,
        slot_type: slot_type,
        clinicTime: clinicTime
      });
    });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

