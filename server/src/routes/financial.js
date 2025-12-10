import express from 'express';
import db from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get Financial Summary (Profit/Loss)
router.get('/financial-summary', authenticateToken, async (req, res) => {
    try {
        const { storeId, startDate, endDate } = req.query;

        if (!storeId) {
            return res.status(400).json({ error: 'Store ID is required' });
        }

        // Only allow access to own store or SUPER_ADMIN
        if (req.user.role === 'STORE_ADMIN' && req.user.storeId !== storeId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const start = startDate ? new Date(startDate) : new Date(0);
        const end = endDate ? new Date(endDate) : new Date();

        // 1. Calculate Revenue, Tax, and COGS from Invoices
        const [salesData] = await db.query(
            `SELECT 
                COALESCE(SUM(i.grand_total), 0) as total_revenue,
                COALESCE(SUM(i.tax_total), 0) as total_tax,
                COALESCE(SUM(ii.quantity * COALESCE(p.cost_price, 0)), 0) as total_cogs
             FROM invoices i
             JOIN invoice_items ii ON i.id = ii.invoice_id
             LEFT JOIN products p ON ii.product_id = p.id
             WHERE i.store_id = ? 
             AND i.date BETWEEN ? AND ?`,
            [storeId, start, end]
        );

        const totalRevenue = parseFloat(salesData[0].total_revenue);
        const totalTax = parseFloat(salesData[0].total_tax);
        const totalCOGS = parseFloat(salesData[0].total_cogs);

        // 2. Fetch Expenses
        const [expenseData] = await db.query(
            `SELECT COALESCE(SUM(amount), 0) as total_expenses 
             FROM expenses 
             WHERE store_id = ? 
             AND expense_date BETWEEN ? AND ?`,
            [storeId, start, end]
        );
        const totalExpenses = parseFloat(expenseData[0].total_expenses);

        // 3. Calculate Profit Metrics
        const grossProfit = totalRevenue - totalTax - totalCOGS; // Trading Profit
        const netIncome = grossProfit - totalExpenses; // Bottom Line
        const margin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;

        res.json({
            totalRevenue,
            totalCost: totalCOGS, // Cost of Goods Sold
            totalExpenses,
            grossProfit,
            taxCollected: totalTax,
            netIncome,
            margin: parseFloat(margin.toFixed(2))
        });

    } catch (error) {
        console.error('Get financial summary error:', error);
        res.status(500).json({ error: 'Failed to fetch financial summary' });
    }
});

// Get Sales Trend (Daily)
router.get('/sales-trend', authenticateToken, async (req, res) => {
    try {
        const { storeId, days = 30 } = req.query;

        if (!storeId) {
            return res.status(400).json({ error: 'Store ID is required' });
        }

        const [trendData] = await db.query(
            `SELECT 
                DATE(i.date) as date,
                SUM(i.grand_total) as revenue,
                SUM(i.grand_total - i.tax_total - (ii.quantity * COALESCE(p.cost_price, 0))) as gross_profit
             FROM invoices i
             JOIN invoice_items ii ON i.id = ii.invoice_id
             LEFT JOIN products p ON ii.product_id = p.id
             WHERE i.store_id = ? 
             AND i.date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
             GROUP BY DATE(i.date)
             ORDER BY DATE(i.date) ASC`,
            [storeId, days]
        );

        res.json(trendData.map(d => ({
            date: d.date.toISOString().split('T')[0],
            revenue: parseFloat(d.revenue),
            profit: parseFloat(d.gross_profit)
        })));

    } catch (error) {
        console.error('Get sales trend error:', error);
        res.status(500).json({ error: 'Failed to fetch sales trend' });
    }
});

// Get Top Products (or Category Products)
router.get('/top-products', authenticateToken, async (req, res) => {
    try {
        const { storeId, limit = 5, categoryId } = req.query;

        let query = `SELECT 
                p.id,
                p.name,
                SUM(ii.quantity) as quantity_sold,
                SUM(ii.line_total) as revenue,
                SUM(ii.line_total - (ii.quantity * COALESCE(p.cost_price, 0))) as profit
             FROM invoice_items ii
             JOIN invoices i ON ii.invoice_id = i.id
             JOIN products p ON ii.product_id = p.id
             WHERE i.store_id = ?`;

        const params = [storeId];

        if (categoryId) {
            query += ` AND p.category_id = ?`;
            params.push(categoryId);
        }

        query += ` GROUP BY p.id ORDER BY revenue DESC`;

        if (limit && !categoryId) {
            query += ` LIMIT ?`;
            params.push(parseInt(limit));
        } else if (categoryId) {
            query += ` LIMIT 50`; // Reasonable limit for category view
        } else {
            query += ` LIMIT ?`;
            params.push(parseInt(limit));
        }

        const [topProducts] = await db.query(query, params);

        res.json(topProducts.map(p => ({
            id: p.id,
            name: p.name,
            quantitySold: parseInt(p.quantity_sold),
            revenue: parseFloat(p.revenue),
            profit: parseFloat(p.profit)
        })));

    } catch (error) {
        console.error('Get top products error:', error);
        res.status(500).json({ error: 'Failed to fetch top products' });
    }
});

// ... (Category Performance, Payment Stats, Heatmap remain unchanged) ...

// Drill Down Invoices
router.get('/drill-down/invoices', authenticateToken, async (req, res) => {
    try {
        const { storeId, categoryId, paymentMethod, startDate, endDate } = req.query;
        if ((req.user.role === 'STORE_ADMIN' && req.user.storeId !== storeId)) return res.sendStatus(403);

        let query = `
            SELECT i.id, i.invoice_number, i.date, i.grand_total, i.payment_method,
                   GROUP_CONCAT(p.name SEPARATOR ', ') as item_names,
                   SUM(ii.line_total - (ii.quantity * COALESCE(p.cost_price, 0))) as profit
            FROM invoices i
            JOIN invoice_items ii ON i.id = ii.invoice_id
            JOIN products p ON ii.product_id = p.id
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE i.store_id = ? AND i.date BETWEEN ? AND ?
        `;
        const params = [storeId, startDate, endDate];

        if (categoryId) {
            query += ` AND c.id = ?`;
            params.push(categoryId);
        }

        if (paymentMethod) {
            if (paymentMethod === 'Online') {
                query += ` AND i.payment_method IN ('UPI', 'CARD', 'QR')`;
            } else {
                query += ` AND i.payment_method = ?`;
                params.push(paymentMethod);
            }
        }

        query += ` GROUP BY i.id ORDER BY i.date DESC LIMIT 50`;

        const [rows] = await db.query(query, params);
        res.json(rows.map(r => ({
            id: r.id,
            invoiceNumber: r.invoice_number,
            date: r.date,
            items: r.item_names,
            paymentMethod: r.payment_method,
            total: parseFloat(r.grand_total),
            profit: parseFloat(r.profit)
        })));

    } catch (e) { console.error(e); res.status(500).send('Error'); }
});

// Category Performance
router.get('/category-performance', authenticateToken, async (req, res) => {
    try {
        const { storeId, startDate, endDate } = req.query;
        if ((req.user.role === 'STORE_ADMIN' && req.user.storeId !== storeId)) return res.sendStatus(403);
        const start = startDate ? new Date(startDate) : new Date(0);
        const end = endDate ? new Date(endDate) : new Date();

        const [rows] = await db.query(`
            SELECT 
                c.id as categoryId,
                c.name as categoryName,
                SUM(ii.line_total) as revenue,
                SUM(ii.line_total - (ii.quantity * COALESCE(p.cost_price, 0))) as profit,
                SUM(ii.quantity) as itemCount
            FROM invoice_items ii
            JOIN invoices i ON ii.invoice_id = i.id
            JOIN products p ON ii.product_id = p.id
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE i.store_id = ? AND i.date BETWEEN ? AND ?
            GROUP BY c.id
            ORDER BY revenue DESC
        `, [storeId, start, end]);

        res.json(rows.map(r => ({ ...r, revenue: parseFloat(r.revenue), profit: parseFloat(r.profit) })));
    } catch (e) { console.error(e); res.status(500).send('Error'); }
});

// Payment Stats
router.get('/payment-method-stats', authenticateToken, async (req, res) => {
    try {
        const { storeId, startDate, endDate } = req.query;
        if ((req.user.role === 'STORE_ADMIN' && req.user.storeId !== storeId)) return res.sendStatus(403);
        const start = startDate ? new Date(startDate) : new Date(0);
        const end = endDate ? new Date(endDate) : new Date();

        const [rows] = await db.query(`
            SELECT payment_method, COUNT(*) as count, SUM(grand_total) as revenue
            FROM invoices
            WHERE store_id = ? AND date BETWEEN ? AND ?
            GROUP BY payment_method
        `, [storeId, start, end]);

        res.json(rows.map(r => ({ method: r.payment_method, count: r.count, revenue: parseFloat(r.revenue) })));
    } catch (e) { console.error(e); res.status(500).send('Error'); }
});

// Sales Heatmap (Data by Hour/Day)
router.get('/sales-heatmap', authenticateToken, async (req, res) => {
    try {
        const { storeId, startDate, endDate } = req.query;
        if (req.user.role === 'STORE_ADMIN' && req.user.storeId !== storeId) return res.sendStatus(403);

        // Note: DAYNAME() and HOUR() are MySQL functions
        const [rows] = await db.query(`
            SELECT 
                DATE_FORMAT(date, '%a') as dayOfWeek,
                HOUR(date) as hour,
                COUNT(*) as salesCount,
                SUM(grand_total) as revenue
            FROM invoices
            WHERE store_id = ? AND date BETWEEN ? AND ?
            GROUP BY dayOfWeek, hour
            ORDER BY FIELD(dayOfWeek, 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'), hour
        `, [storeId, startDate, endDate]);

        res.json(rows);
    } catch (e) { console.timeLog(e); res.status(500).send('Error'); }
});

// Drill Down Invoices
router.get('/drill-down/invoices', authenticateToken, async (req, res) => {
    try {
        const { storeId, categoryId, startDate, endDate } = req.query;
        if ((req.user.role === 'STORE_ADMIN' && req.user.storeId !== storeId)) return res.sendStatus(403);

        let query = `
            SELECT i.id, i.invoice_number, i.date, i.grand_total,
                   GROUP_CONCAT(p.name SEPARATOR ', ') as item_names,
                   SUM(ii.line_total - (ii.quantity * COALESCE(p.cost_price, 0))) as profit
            FROM invoices i
            JOIN invoice_items ii ON i.id = ii.invoice_id
            JOIN products p ON ii.product_id = p.id
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE i.store_id = ? AND i.date BETWEEN ? AND ?
        `;
        const params = [storeId, startDate, endDate];

        if (categoryId) {
            query += ` AND c.id = ?`;
            params.push(categoryId);
        }

        query += ` GROUP BY i.id ORDER BY i.date DESC LIMIT 50`;

        const [rows] = await db.query(query, params);
        res.json(rows.map(r => ({
            id: r.id,
            invoiceNumber: r.invoice_number,
            date: r.date,
            items: r.item_names,
            total: parseFloat(r.grand_total),
            profit: parseFloat(r.profit)
        })));

    } catch (e) { console.error(e); res.status(500).send('Error'); }
});

export default router;
