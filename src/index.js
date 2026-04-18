require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { pool } = require('./db/pool');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'OnUp API' }));
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Routes
app.use('/api', require('./routes/auth'));
app.use('/api', require('./routes/growthPlans'));
app.use('/api', require('./routes/meetings'));
app.use('/api', require('./routes/users'));
app.use('/api', require('./routes/reports'));
app.use('/api', require('./routes/notifications'));
app.use('/api', require('./routes/thoughtpad'));
app.use('/api', require('./routes/tags'));
app.use('/api', require('./routes/training'));
app.use('/api', require('./routes/preferences'));
app.use('/api', require('./routes/workplan'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`\n🚀 OnUp backend running at http://localhost:${PORT}`);
  console.log(`📊 API ready at http://localhost:${PORT}/api`);
  try {
    await pool.query('SELECT 1');
    console.log(`✅ MySQL connected to ${process.env.DB_HOST}\n`);
  } catch (e) {
    console.error(`❌ MySQL connection failed: ${e.message}\n`);
  }
});
