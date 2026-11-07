const pool = require('../config/db');

// FR-01: Search Hostels with Filters (Price, Distance, Gender)
exports.searchHostels = async (req, res) => {
    try {
        const { max_price, max_distance, gender_type } = req.query;

        let query = `
            SELECT r.id AS room_id, r.room_number, r.price_per_semester, r.is_available, r.photos_json,
                   h.id AS hostel_id, h.name AS hostel_name, h.distance_km, h.gender_type, h.address_description,
                   u.full_name AS custodian_name
            FROM rooms r
            JOIN hostels h ON r.hostel_id = h.id
            JOIN users u ON h.custodian_id = u.id
            WHERE r.is_available = 1
        `;
        const params = [];

        if (max_price) {
            query += ` AND r.price_per_semester <= ?`;
            params.push(parseFloat(max_price));
        }

        if (max_distance) {
            query += ` AND h.distance_km <= ?`;
            params.push(parseFloat(max_distance));
        }

        if (gender_type && ['BOYS', 'GIRLS', 'MIXED'].includes(gender_type.toUpperCase())) {
            query += ` AND h.gender_type = ?`;
            params.push(gender_type.toUpperCase());
        }

        query += ` ORDER BY h.distance_km ASC, r.price_per_semester ASC`;

        const [results] = await pool.query(query, params);
        res.json({ success: true, count: results.length, data: results });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// FR-02: Custodian Posts a Room
exports.createHostelWithRoom = async (req, res) => {
    const { hostel_name, distance_km, gender_type, address_description, room_number, price_per_semester, photos } = req.body;

    if (!hostel_name || !distance_km || !gender_type || !room_number || !price_per_semester) {
        return res.status(400).json({ success: false, message: 'Missing required hostel/room fields.' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Create Hostel (if not exists for custodian or add new)
        const [hostelRes] = await connection.query(
            `INSERT INTO hostels (custodian_id, name, distance_km, gender_type, address_description)
             VALUES (?, ?, ?, ?, ?)`,
            [req.user.id, hostel_name, distance_km, gender_type, address_description || '']
        );
        const hostelId = hostelRes.insertId;

        // 2. Add Room
        const photosJson = photos ? JSON.stringify(photos) : JSON.stringify([]);
        const [roomRes] = await connection.query(
            `INSERT INTO rooms (hostel_id, room_number, price_per_semester, photos_json)
             VALUES (?, ?, ?, ?)`,
            [hostelId, room_number, price_per_semester, photosJson]
        );

        await connection.commit();
        res.status(201).json({
            success: true,
            message: 'Hostel and room posted successfully.',
            hostelId,
            roomId: roomRes.insertId
        });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ success: false, message: error.message });
    } finally {
        connection.release();
    }
};
