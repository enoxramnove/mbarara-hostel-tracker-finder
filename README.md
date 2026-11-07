# Mbarara Student Hostel Finder

The project is a small Express web application with a MySQL-backed authentication API and a browser-based hostel finder.

## Requirements

- Node.js 18 or later
- MySQL 8 or later

## Setup

1. Install the Node dependencies:

   ```powershell
   npm install
   ```

2. Create the database and users table:

   ```powershell
   mysql -u root -p < database\schema.sql
   ```

3. Create a local environment file and set its values:

   ```powershell
   Copy-Item .env.example .env
   ```

   Edit `.env` to match your MySQL account. Set `JWT_SECRET` to a unique random value of at least 32 characters. For example, generate one with:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

   Replace the example `DB_PASSWORD` value with your actual MySQL password (or leave it empty if your local MySQL user has no password). The example password will not work.
   Do not commit `.env` or share its contents.

4. Start or restart the application so it loads the updated `.env`:

   ```powershell
   npm run dev
   ```

5. Open [http://localhost:5000](http://localhost:5000) in a browser. Use the Express server URL; opening the HTML file directly does not provide the authentication API.

## How authentication works

1. Visitors can browse the sample hostel listings and select **Login / Register**.
2. Sign-up collects the user's name, email, phone number, institution, and password. Public sign-up always creates a `STUDENT` account; a role submitted by a browser is not trusted.
3. The server validates the input, normalizes the email, hashes the password with bcrypt, and inserts the account into the MySQL `users` table. The original password is never stored.
4. Sign-in looks up the email in MySQL and compares the submitted password with the stored bcrypt hash. An incorrect email or password is rejected.
5. Successful sign-up and sign-in return a signed JWT. The browser keeps it in session storage and uses it to restore the current account and authorize API requests. Tokens expire after 24 hours; signing out removes the token from the browser.
6. The account role returned from the database selects the corresponding portal. Custodian and warden accounts must be created or promoted by a trusted administrator; do not allow public role selection.

Authentication endpoints:

- `POST /api/auth/register` — create a student account and sign in
- `POST /api/auth/login` — verify credentials and sign in
- `GET /api/auth/me` — return the database account for a valid bearer token

Example registration request:

```json
{
  "full_name": "A Student",
  "email": "student@example.com",
  "phone_number": "+256700000000",
  "institution": "MUST",
  "password": "a-strong-password"
}
```

For protected API requests, send the token as `Authorization: Bearer <token>`. Existing role-protected endpoints use the role from the signed token.

## Database and current app scope

`database/schema.sql` creates the `mbarara_hostels` database and the `users` table needed by registration, sign-in, and session verification. Password hashes are stored in `password_hash`; email addresses are unique. The HTML currently renders sample hostel listings in the browser. The separate hostel and booking API controllers expect additional hostel, room, booking, and payment tables (and a booking stored procedure); those are not created by this authentication schema.

## Configuration

| Variable | Purpose |
| --- | --- |
| `PORT` | Express port (defaults to `5000`) |
| `DB_HOST` | MySQL server host |
| `DB_USER` | MySQL username |
| `DB_PASSWORD` | MySQL password |
| `DB_NAME` | MySQL database name (defaults to `mbarara_hostels`) |
| `JWT_SECRET` | Private signing secret, at least 32 characters |

Never use the example secret in a deployed environment. Use HTTPS and a strong, private signing secret when deploying.
