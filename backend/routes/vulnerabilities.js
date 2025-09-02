const express = require('express');
const router = express.Router();
const History = require('../models/History');

// GET /api/vulnerabilities/ - get user history
router.get('/', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    
    const history = await History.find({ userId: req.user }).sort({ timestamp: -1 });
    res.json(history);
  } catch (err) {
    console.error('Get vulnerabilities error:', err);
    res.status(500).json({ message: 'Server error retrieving vulnerabilities' });
  }
});

// POST /api/vulnerabilities/ - add history entry
router.post('/', async (req, res) => {
  const { info } = req.body;
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    if (!info) {
      return res.status(400).json({ message: 'Info field is required' });
    }

    const entry = new History({ userId: req.user, info });
    await entry.save();
    res.status(201).json({ message: 'History entry added', entry });
  } catch (err) {
    console.error('Add vulnerability error:', err);
    res.status(500).json({ message: 'Server error adding vulnerability' });
  }
});

module.exports = router;