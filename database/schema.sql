CREATE DATABASE IF NOT EXISTS mbarara_hostels
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE mbarara_hostels;

CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(254) NOT NULL,
    phone_number VARCHAR(30) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('STUDENT', 'CUSTODIAN', 'WARDEN', 'ADMIN') NOT NULL DEFAULT 'STUDENT',
    institution VARCHAR(100) NOT NULL DEFAULT 'MUST',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email)
);
