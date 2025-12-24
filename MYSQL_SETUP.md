# MySQL POS System - Setup Guide

## Prerequisites

1. **MySQL Server** - Install MySQL Server (version 8.0 or higher)
   - Download from: https://dev.mysql.com/downloads/mysql/
   - Or use XAMPP/WAMP which includes MySQL

2. **Node.js** - Already installed (required for running the app)

## Setup Steps

### 1. Start MySQL Server

Make sure MySQL is running on your system:
- **Windows (XAMPP)**: Start Apache and MySQL from XAMPP Control Panel
- **Windows (Standalone)**: MySQL should be running as a service
- **Command line test**: `mysql --version`

### 2. Create Database and Tables

Open MySQL command line or MySQL Workbench and run:

```bash
# Login to MySQL (default password is usually empty or 'root')
mysql -u root -p

# Then run the schema file
source C:/Users/Hi/Desktop/New folder (2)/server/src/config/db-schema.sql
```

**OR** if you're using MySQL Workbench:
1. Open MySQL Workbench
2. Connect to your local MySQL instance
3. File → Run SQL Script
4. Select `server/src/config/db-schema.sql`
5. Click "Run"

### 3. Configure Database Connection

Edit `server/.env` if your MySQL credentials are different:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password_here
DB_NAME=pos_system
```

### 4. Install Dependencies

Dependencies are already installed, but if needed:

```bash
# Frontend dependencies
npm install

# Backend dependencies  
cd server
npm install
cd ..
```

### 5. Start the Application

You need **TWO terminals**:

**Terminal 1 - Backend Server:**
```bash
cd server
npm start
```

You should see:
```
✅ MySQL Database connected successfully
🚀 Server running on https://apipostest.yugan.tech/api/
```

**Terminal 2 - Frontend Dev Server:**
```bash
npm run dev
```

### 6. Login

Open your browser to `http://localhost:5173` (or the URL shown by Vite)

**Default Credentials:**
- Username: `admin`
- Password: `admin123`

## Troubleshooting

### MySQL Connection Failed

**Error**: `ER_ACCESS_DENIED_ERROR` or `ECONNREFUSED`

**Solutions**:
1. Check MySQL is running: `mysql -u root -p`
2. Verify credentials in `server/.env`
3. Make sure database `pos_system` exists: `SHOW DATABASES;`

### Database Not Found

**Error**: `ER_BAD_DB_ERROR: Unknown database 'pos_system'`

**Solution**: Run the schema file again (Step 2)

### Port Already in Use

**Error**: `EADDRINUSE: address already in use :::3001`

**Solution**: 
- Change port in `server/.env`: `PORT=3002`
- Update frontend API URL in `constants.ts`: `mysqlApiUrl: 'http://localhost:3002/api'`

## API Endpoints

Once running, the backend provides:

- `POST /api/auth/login` - User login
- `GET /api/stores` - Get all stores
- `GET /api/categories` - Get categories
- `GET /api/products` - Get products
- `POST /api/invoices` - Create invoice
- And more...

## Database Schema

The system creates these tables:
- `users` - User accounts and authentication
- `stores` - Store information
- `categories` - Product categories
- `products` - Product inventory
- `invoices` - Sales invoices
- `invoice_items` - Invoice line items

## Next Steps

1. ✅ Login with admin credentials
2. ✅ Create stores from Super Admin dashboard
3. ✅ Add categories and products
4. ✅ Start creating invoices from POS

## Notes

- All Firebase code has been removed
- Data is now stored in MySQL database
- Authentication uses JWT tokens
- Passwords are hashed with bcrypt
