const express = require('express');
const router = express.Router();
const hostelController = require('../controllers/hostelController');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

router.get('/search', hostelController.searchHostels);
router.post('/create', verifyToken, authorizeRoles('CUSTODIAN', 'ADMIN'), hostelController.createHostelWithRoom);

module.exports = router;
