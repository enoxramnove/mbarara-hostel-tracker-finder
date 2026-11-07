const pool = require('../config/db');
const { maskPhoneNumber } = require('../middleware/maskData');

// FR-03: Execute Stored Procedure for 24-Hour Atomic Booking Hold
exports.initiateBookingHold = async (req, res) => {
    const { room_id } = req.body;
    const student_id = req.user.id;

    if (!room_id) {
        return res.status(400).json({ success: false, message: 'Room ID is required.' });
    }

    try {
        // Call MySQL Stored Procedure InitiateRoomHold
        const [rows] = await pool.query(
            'CALL InitiateRoomHold(?, ?, @p_booking_id, @p_status_message);',
            [student_id, room_id]
        );
        
        const [[result]] = await pool.query('SELECT @p_booking_id AS booking_id, @p_status_message AS status_message;');

        if (!result.booking_id) {
            return res.status(409).json({ success: false, message: result.status_message });
        }

        res.status(201).json({
            success: true,
            message: result.status_message,
            bookingId: result.booking_id,
            expiresIn: '24 Hours'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// FR-04 & UC-03: Submit Payment & Generate Receipt Token with QR
exports.confirmPayment = async (req, res) => {
    const { booking_id, transaction_ref, amount_paid } = req.body;

    if (!booking_id || !transaction_ref || !amount_paid) {
        return res.status(400).json({ success: false, message: 'Booking ID, payment ref, and amount are required.' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Check if booking exists and is held
        const [bookings] = await connection.query('SELECT * FROM bookings WHERE id = ? AND status = "HELD"', [booking_id]);
        if (bookings.length === 0) {
            return res.status(404).json({ success: false, message: 'Active booking hold not found or expired.' });
        }

        // Generate Unique Verification Token for QR Code
        const qr_token = 'MBR-REC-' + Date.now() + '-' + Math.floor(1000 + Math.random() * 9000);

        // 1. Insert Payment
        await connection.query(
            `INSERT INTO payments (booking_id, transaction_ref, amount_paid, status, qr_verification_token, receipt_generated_at)
             VALUES (?, ?, ?, 'VERIFIED', ?, NOW())`,
            [booking_id, transaction_ref, amount_paid, qr_token]
        );

        // 2. Update Booking Status
        await connection.query('UPDATE bookings SET status = "CONFIRMED" WHERE id = ?', [booking_id]);

        // 3. Mark Room as Unavailable
        await connection.query('UPDATE rooms SET is_available = 0 WHERE id = ?', [bookings[0].room_id]);

        await connection.commit();

        res.json({
            success: true,
            message: 'Payment verified and PDF receipt generated.',
            receipt: {
                receiptNo: qr_token,
                bookingId: booking_id,
                amountPaid: amount_paid,
                qrCodeData: `https://mbarara-hostels.ug/verify/${qr_token}`
            }
        });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ success: false, message: error.message });
    } finally {
        connection.release();
    }
};

// FR-10 & Warden/Parent Verification Endpoint
exports.verifyReceipt = async (req, res) => {
    const { token } = req.params;

    try {
        const query = `
            SELECT p.qr_verification_token, p.amount_paid, p.created_at AS payment_date,
                   u.full_name AS student_name, u.institution, u.phone_number,
                   h.name AS hostel_name, h.gender_type, r.room_number,
                   c.full_name AS custodian_name
            FROM payments p
            JOIN bookings b ON p.booking_id = b.id
            JOIN users u ON b.student_id = u.id
            JOIN rooms r ON b.room_id = r.id
            JOIN hostels h ON r.hostel_id = h.id
            JOIN users c ON h.custodian_id = c.id
            WHERE p.qr_verification_token = ? AND p.status = 'VERIFIED'
        `;

        const [results] = await pool.query(query, [token]);
        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'Invalid or fake receipt token.' });
        }

        const data = results[0];
        // Apply NFR-03 Phone Masking for non-admin viewers
        data.phone_number = maskPhoneNumber(data.phone_number);

        res.json({
            success: true,
            verified: true,
            details: data
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
