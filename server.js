require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const connectDB = require('./db');
const apiRoutes = require('./api/routes');

require('./bot/bot');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api', apiRoutes);

app.get('/health', (req, res) => {
    const dbState = mongoose.connection.readyState;
    if (dbState === 1) {
        res.json({
            status: "ok",
            mongodb: "connected",
            service: "MOBASTREAM CMS"
        });
    } else {
        res.status(500).json({
            status: "error",
            mongodb: "disconnected"
        });
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
    console.log(`Server is running on port ${PORT}`);
    await connectDB();
    console.log('🚀 MOBASTREAM CMS is ready.');
});
