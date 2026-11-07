const { test } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-only-secret-with-at-least-32-characters';

const pool = require('../config/db');
const authController = require('../controllers/authController');

function createResponse() {
    return {
        statusCode: 200,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        }
    };
}

async function withMockQuery(t, mockQuery) {
    const originalQuery = pool.query;
    pool.query = mockQuery;
    t.after(() => {
        pool.query = originalQuery;
    });
}

test('registration hashes the password and always creates a student account', async (t) => {
    let insertValues;
    await withMockQuery(t, async (query, values) => {
        assert.match(query, /INSERT INTO users/);
        insertValues = values;
        return [{ insertId: 7 }, undefined];
    });

    const res = createResponse();
    await authController.register({
        body: {
            full_name: 'Student Example',
            email: ' Student@Example.com ',
            phone_number: '+256700000000',
            institution: 'MUST',
            password: 'a-strong-password',
            role: 'ADMIN'
        }
    }, res);

    assert.equal(res.statusCode, 201);
    assert.equal(insertValues[1], 'student@example.com');
    assert.equal(insertValues[4], 'STUDENT');
    assert.notEqual(insertValues[3], 'a-strong-password');
    assert.equal(await bcrypt.compare('a-strong-password', insertValues[3]), true);
    assert.equal(res.body.user.role, 'STUDENT');
    assert.equal(jwt.verify(res.body.token, process.env.JWT_SECRET).id, 7);
});

test('registration explains MySQL credential errors', async (t) => {
    await withMockQuery(t, async () => {
        const error = new Error('Access denied');
        error.code = 'ER_ACCESS_DENIED_ERROR';
        throw error;
    });

    const originalConsoleError = console.error;
    console.error = () => {};
    t.after(() => {
        console.error = originalConsoleError;
    });

    const res = createResponse();
    await authController.register({
        body: {
            full_name: 'Student Example',
            email: 'student@example.com',
            phone_number: '+256700000000',
            institution: 'MUST',
            password: 'a-strong-password'
        }
    }, res);

    assert.equal(res.statusCode, 503);
    assert.match(res.body.message, /DB_USER and DB_PASSWORD/);
});

test('login checks the stored password hash and returns the account role', async (t) => {
    const passwordHash = await bcrypt.hash('correct-password', 4);
    await withMockQuery(t, async (_query, values) => {
        assert.equal(values[0], 'custodian@example.com');
        return [[{
            id: 8,
            full_name: 'Hostel Custodian',
            email: 'custodian@example.com',
            role: 'CUSTODIAN',
            institution: 'Hostel',
            password_hash: passwordHash
        }], undefined];
    });

    const res = createResponse();
    await authController.login({
        body: { email: ' CUSTODIAN@EXAMPLE.COM ', password: 'correct-password' }
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.user.role, 'CUSTODIAN');
    assert.equal(jwt.verify(res.body.token, process.env.JWT_SECRET).id, 8);
});

test('login rejects an incorrect password', async (t) => {
    const passwordHash = await bcrypt.hash('correct-password', 4);
    await withMockQuery(t, async () => [[{
        id: 8,
        full_name: 'Hostel Custodian',
        email: 'custodian@example.com',
        role: 'CUSTODIAN',
        institution: 'Hostel',
        password_hash: passwordHash
    }], undefined]);

    const res = createResponse();
    await authController.login({
        body: { email: 'custodian@example.com', password: 'incorrect-password' }
    }, res);

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.success, false);
});

test('session lookup returns the current database account', async (t) => {
    await withMockQuery(t, async (_query, values) => {
        assert.equal(values[0], 9);
        return [[{
            id: 9,
            full_name: 'Current Student',
            email: 'student@example.com',
            role: 'STUDENT',
            institution: 'MUST'
        }], undefined];
    });

    const res = createResponse();
    await authController.me({ user: { id: 9 } }, res);

    assert.equal(res.body.user.full_name, 'Current Student');
    assert.equal(res.body.user.role, 'STUDENT');
});
