const History = require('../models/History');

exports.getUserHistory = async (req, res) => {
  try {
    const history = await History.find({ userId: req.user }).sort({ timestamp: -1 });
    res.json(history);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.addHistoryEntry = async (req, res) => {
  const { info } = req.body;
  try {
    const entry = new History({ userId: req.user, info });
    await entry.save();
    res.status(201).json({ message: 'History entry added' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
