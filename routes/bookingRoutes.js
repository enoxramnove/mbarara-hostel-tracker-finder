const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

router.post('/hold', verifyToken, authorizeRoles('STUDENT'), bookingController.initiateBookingHold);
router.post('/confirm-payment', verifyToken, authorizeRoles('STUDENT', 'CUSTODIAN'), bookingController.confirmPayment);
router.get('/verify/:token', bookingController.verifyReceipt);

module.exports = router;
