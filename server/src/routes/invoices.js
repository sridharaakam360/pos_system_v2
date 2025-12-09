import express from 'express';
import db from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get all invoices (optionally filtered by store)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { storeId } = req.query;

        let query = `SELECT id, invoice_number, store_id, date, subtotal, tax_total, 
                        discount_total, grand_total, payment_method, synced 
                 FROM invoices`;
        let params = [];

        if (storeId) {
            query += ' WHERE store_id = ?';
            params.push(storeId);
        }

        query += ' ORDER BY date DESC';

        const [invoices] = await db.query(query, params);

        // Get items for each invoice
        const invoicesWithItems = await Promise.all(
            invoices.map(async (invoice) => {
                const [items] = await db.query(
                    `SELECT id, product_id, product_name, quantity, unit_price, 
                  applied_tax_percent, applied_discount_percent, line_total 
           FROM invoice_items WHERE invoice_id = ?`,
                    [invoice.id]
                );

                return {
                    id: invoice.id,
                    invoiceNumber: invoice.invoice_number,
                    storeId: invoice.store_id,
                    date: invoice.date,
                    items: items.map(item => ({
                        id: item.product_id,
                        name: item.product_name,
                        quantity: item.quantity,
                        price: parseFloat(item.unit_price),
                        appliedTaxPercent: parseFloat(item.applied_tax_percent),
                        appliedDiscountPercent: parseFloat(item.applied_discount_percent),
                        lineTotal: parseFloat(item.line_total)
                    })),
                    subtotal: parseFloat(invoice.subtotal),
                    taxTotal: parseFloat(invoice.tax_total),
                    discountTotal: parseFloat(invoice.discount_total),
                    grandTotal: parseFloat(invoice.grand_total),
                    paymentMethod: invoice.payment_method,
                    synced: Boolean(invoice.synced)
                };
            })
        );

        res.json(invoicesWithItems);
    } catch (error) {
        console.error('Get invoices error:', error);
        res.status(500).json({ error: 'Failed to fetch invoices' });
    }
});

// Create invoice with items (transaction)
router.post('/', authenticateToken, async (req, res) => {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const {
            id, invoiceNumber, storeId, date, items, subtotal, taxTotal,
            discountTotal, grandTotal, paymentMethod
        } = req.body;

        if (!storeId || !invoiceNumber || !items || items.length === 0) {
            return res.status(400).json({ error: 'Store ID, invoice number, and items are required' });
        }

        // Insert invoice
        await connection.query(
            `INSERT INTO invoices (id, invoice_number, store_id, date, subtotal, tax_total, 
                             discount_total, grand_total, payment_method, synced) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id, invoiceNumber, storeId, date || new Date(), subtotal, taxTotal,
                discountTotal, grandTotal, paymentMethod, true
            ]
        );

        // Insert invoice items
        for (const item of items) {
            // Lock the product row and verify stock is sufficient
            const [prodRows] = await connection.query('SELECT stock_qty FROM products WHERE id = ? FOR UPDATE', [item.id]);
            if (!prodRows || prodRows.length === 0) {
                throw new Error(`Product not found: ${item.id}`);
            }

            const currentStock = parseInt(prodRows[0].stock_qty, 10) || 0;
            if (currentStock < item.quantity) {
                // Insufficient stock - rollback and return error
                await connection.rollback();
                return res.status(400).json({ error: `Insufficient stock for product ${item.name} (id: ${item.id}). Available: ${currentStock}, requested: ${item.quantity}` });
            }

            await connection.query(
                `INSERT INTO invoice_items (invoice_id, product_id, product_name, quantity, 
                                     unit_price, applied_tax_percent, applied_discount_percent, line_total) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id, item.id, item.name, item.quantity, item.price,
                    item.appliedTaxPercent, item.appliedDiscountPercent, item.lineTotal
                ]
            );

            // Update product stock (safe because we locked the row above)
            await connection.query(
                'UPDATE products SET stock_qty = stock_qty - ? WHERE id = ?',
                [item.quantity, item.id]
            );
        }

        await connection.commit();

        res.status(201).json({
            message: 'Invoice created successfully',
            invoiceId: id
        });
    } catch (error) {
        await connection.rollback();
        console.error('Create invoice error:', error);
        res.status(500).json({ error: 'Failed to create invoice' });
    } finally {
        connection.release();
    }
});

// Get single invoice with items
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const [invoices] = await db.query(
            `SELECT id, invoice_number, store_id, date, subtotal, tax_total, 
              discount_total, grand_total, payment_method, synced 
       FROM invoices WHERE id = ?`,
            [req.params.id]
        );

        if (invoices.length === 0) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        const invoice = invoices[0];

        const [items] = await db.query(
            `SELECT id, product_id, product_name, quantity, unit_price, 
              applied_tax_percent, applied_discount_percent, line_total 
       FROM invoice_items WHERE invoice_id = ?`,
            [invoice.id]
        );

        res.json({
            id: invoice.id,
            invoiceNumber: invoice.invoice_number,
            storeId: invoice.store_id,
            date: invoice.date,
            items: items.map(item => ({
                id: item.product_id,
                name: item.product_name,
                quantity: item.quantity,
                price: parseFloat(item.unit_price),
                appliedTaxPercent: parseFloat(item.applied_tax_percent),
                appliedDiscountPercent: parseFloat(item.applied_discount_percent),
                lineTotal: parseFloat(item.line_total)
            })),
            subtotal: parseFloat(invoice.subtotal),
            taxTotal: parseFloat(invoice.tax_total),
            discountTotal: parseFloat(invoice.discount_total),
            grandTotal: parseFloat(invoice.grand_total),
            paymentMethod: invoice.payment_method,
            synced: Boolean(invoice.synced)
        });
    } catch (error) {
        console.error('Get invoice error:', error);
        res.status(500).json({ error: 'Failed to fetch invoice' });
    }
});

export default router;
