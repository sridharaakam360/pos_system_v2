-- ============================================================================
-- POS System - Complete Database Schema
-- ============================================================================
-- Version: 2.0
-- Last Updated: 2025-12-10
-- Includes: All tables, indexes, constraints, and sample data
-- ============================================================================

-- Drop existing database if exists and create fresh
DROP DATABASE IF EXISTS pos_system;
CREATE DATABASE pos_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pos_system;

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Users Table
CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('SUPER_ADMIN', 'STORE_ADMIN', 'CASHIER') NOT NULL,
    store_id VARCHAR(36) NULL,
    display_name VARCHAR(100),
    email VARCHAR(100),
    phone_number VARCHAR(20),
    image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_store_id (store_id)
) ENGINE=InnoDB;

-- Stores Table
CREATE TABLE stores (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(100) NOT NULL,
    owner_name VARCHAR(100) NOT NULL,
    currency ENUM('INR', 'USD', 'AED', 'EUR') DEFAULT 'INR',
    gst_number VARCHAR(50),
    address TEXT,
    upi_primary VARCHAR(100),
    upi_secondary VARCHAR(100),
    active_upi_type ENUM('PRIMARY', 'SECONDARY'),
    is_active BOOLEAN DEFAULT TRUE,
    logo_url TEXT,
    timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
    global_discount DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB;

-- Categories Table
CREATE TABLE categories (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    store_id VARCHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL,
    default_gst DECIMAL(5,2) DEFAULT 0,
    default_discount DECIMAL(5,2) DEFAULT 0,
    low_stock_threshold INT DEFAULT 10,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
    INDEX idx_store_id (store_id)
) ENGINE=InnoDB;

-- Products Table (with cost_price for profit tracking)
CREATE TABLE products (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    store_id VARCHAR(36) NOT NULL,
    category_id VARCHAR(36) NOT NULL,
    name VARCHAR(200) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    stock_qty INT DEFAULT 0,
    tax_override DECIMAL(5,2) NULL,
    sku VARCHAR(50),
    image_url TEXT,
    cost_price DECIMAL(10,2) DEFAULT 0,  -- Added for profit calculation
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
    INDEX idx_store_id (store_id),
    INDEX idx_category_id (category_id),
    INDEX idx_sku (sku)
) ENGINE=InnoDB;

-- Invoices Table
CREATE TABLE invoices (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    store_id VARCHAR(36) NOT NULL,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,  -- Changed to DATETIME for better precision
    subtotal DECIMAL(10,2) NOT NULL,
    tax_total DECIMAL(10,2) NOT NULL,
    discount_total DECIMAL(10,2) NOT NULL,
    grand_total DECIMAL(10,2) NOT NULL,
    payment_method ENUM('CASH', 'CARD', 'UPI', 'QR') NOT NULL,
    synced BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
    INDEX idx_store_id (store_id),
    INDEX idx_invoice_number (invoice_number),
    INDEX idx_date (date),
    INDEX idx_store_date (store_id, date)  -- Composite index for date range queries
) ENGINE=InnoDB;

-- Invoice Items Table
CREATE TABLE invoice_items (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    invoice_id VARCHAR(36) NOT NULL,
    product_id VARCHAR(36),
    product_name VARCHAR(200) NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    applied_tax_percent DECIMAL(5,2) NOT NULL,
    applied_discount_percent DECIMAL(5,2) NOT NULL,
    line_total DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
    INDEX idx_invoice_id (invoice_id),
    INDEX idx_product_id (product_id)
) ENGINE=InnoDB;

-- ============================================================================
-- PARTNERSHIP & FINANCIAL TABLES
-- ============================================================================

-- Business Partnerships Table (Equity/Investment Partners)
CREATE TABLE partnerships (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    store_id VARCHAR(36) NOT NULL,
    partner_name VARCHAR(150) NOT NULL,
    email VARCHAR(100),
    phone_number VARCHAR(20),
    cash_investment DECIMAL(12,2) NOT NULL DEFAULT 0,
    investment_date DATE NOT NULL,
    ownership_percentage DECIMAL(5,2) NOT NULL,
    address TEXT,
    bank_details TEXT,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
    INDEX idx_store_id (store_id),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB;

-- Partnership Assets Table (Equipment, Property, Inventory contributed)
CREATE TABLE partnership_assets (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    partnership_id VARCHAR(36) NOT NULL,
    asset_name VARCHAR(200) NOT NULL,
    asset_description TEXT,
    asset_value DECIMAL(12,2) NOT NULL,
    asset_type ENUM('EQUIPMENT', 'PROPERTY', 'INVENTORY', 'VEHICLE', 'OTHER') DEFAULT 'OTHER',
    contributed_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (partnership_id) REFERENCES partnerships(id) ON DELETE CASCADE,
    INDEX idx_partnership_id (partnership_id),
    INDEX idx_asset_type (asset_type)
) ENGINE=InnoDB;

-- Expenses Table (for store-level financial tracking)
CREATE TABLE expenses (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    store_id VARCHAR(36) NOT NULL,
    title VARCHAR(200) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    expense_date DATE NOT NULL,
    category VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
    INDEX idx_store_id (store_id),
    INDEX idx_expense_date (expense_date),
    INDEX idx_store_date (store_id, expense_date)  -- Composite index for date range queries
) ENGINE=InnoDB;

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

-- Add foreign key constraint for users.store_id
ALTER TABLE users ADD CONSTRAINT fk_users_store 
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL;

-- ============================================================================
-- SAMPLE DATA
-- ============================================================================

-- Insert default admin user (password: admin123)
INSERT INTO users (id, username, password_hash, role, display_name) VALUES 
('admin-001', 'admin', '$2a$10$q8BB.jAl5qiWR9KU5JQmSuR1vzdBdFk1dAZqOSbwIbgMnFevF.8Fu', 'SUPER_ADMIN', 'System Administrator');

-- Insert sample store
INSERT INTO stores (id, name, owner_name, currency, address, is_active) VALUES 
('store-001', 'Main Store', 'John Doe', 'INR', '123 Main Street, City', TRUE);

-- Insert sample category
INSERT INTO categories (id, store_id, name, default_gst) VALUES 
('cat-001', 'store-001', 'General', 18.0);

-- Insert sample products (with cost_price for profit tracking)
INSERT INTO products (id, store_id, category_id, name, price, stock_qty, sku, cost_price) VALUES 
('prod-001', 'store-001', 'cat-001', 'Sample Product 1', 100.00, 50, 'SKU001', 60.00),
('prod-002', 'store-001', 'cat-001', 'Sample Product 2', 200.00, 30, 'SKU002', 120.00);

-- ============================================================================
-- PERFORMANCE OPTIMIZATION
-- ============================================================================
-- Note: Most indexes are already created inline with table definitions above
-- The following are additional composite indexes for specific query patterns

-- Additional composite indexes for financial reports
CREATE INDEX idx_invoices_payment_method ON invoices(payment_method);
CREATE INDEX idx_categories_name ON categories(name);
CREATE INDEX idx_products_name ON products(name);

-- ============================================================================
-- DATABASE SCHEMA COMPLETE
-- ============================================================================
-- Total Tables: 9
-- Total Indexes: 25+
-- Features:
--   ✓ UUID primary keys
--   ✓ Proper foreign key constraints
--   ✓ Cascading deletes where appropriate
--   ✓ Composite indexes for performance
--   ✓ Cost price tracking for profit calculations
--   ✓ Timestamp tracking (created_at, updated_at)
--   ✓ Sample data for testing
-- ============================================================================
