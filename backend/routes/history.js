const express = require('express');
const router = express.Router();
const historyController = require('../controllers/historyController');

router.get('/', historyController.getUserHistory);
router.post('/', historyController.addHistoryEntry);

module.exports = router;
