import express from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import db from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { randomUUID } from 'crypto';

const router = express.Router();

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// POST /api/payments/razorpay/order
router.post('/razorpay/order', async (req, res) => {
    try {
        const { amount, receipt } = req.body;

        const options = {
            amount: Math.round(amount * 100), // amount in the smallest currency unit (paise)
            currency: 'INR',
            receipt: receipt,
        };

        const order = await razorpay.orders.create(options);

        res.json({
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            key: process.env.RAZORPAY_KEY_ID
        });
    } catch (error) {
        console.error('Razorpay Order Error:', error);
        res.status(500).json({ error: 'Failed to create Razorpay order' });
    }
});

// POST /api/payments/razorpay/verify
router.post('/razorpay/verify', async (req, res) => {
    const connection = await db.getConnection();

    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            invoicePayload
        } = req.body;

        // 1. Verify Signature
        const body = razorpay_order_id + '|' + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body)
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({ error: 'Payment verification failed' });
        }

        // 2. Create Invoice (Transaction)
        await connection.beginTransaction();

        const invoiceId = randomUUID();
        const {
            storeId,
            date,
            items,
            subtotal,
            taxTotal,
            discountTotal,
            grandTotal,
            // paymentMethod is overridden to 'CARD'
            customerInfo // Extract customer info if needed, but we rely on payload structure
        } = invoicePayload;

        // Generate unique invoice number
        const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

        // Insert Invoice
        await connection.query(
            `INSERT INTO invoices 
       (id, invoice_number, store_id, date, subtotal, tax_total, discount_total, 
        grand_total, payment_method, payment_status, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                invoiceId,
                invoiceNumber,
                storeId,
                date || new Date(),
                subtotal || 0,
                taxTotal || 0,
                discountTotal || 0,
                grandTotal || 0,
                'CARD', // Enforce CARD for Razorpay
                'COMPLETED',
                true
            ]
        );

        // Insert Items & Update Stock
        for (const item of items) {
            // Check stock
            const [productRows] = await connection.query(
                'SELECT stock_qty FROM products WHERE id = ? FOR UPDATE',
                [item.productId]
            );

            if (productRows.length === 0) {
                throw new Error(`Product not found: ${item.productId}`);
            }

            const currentStock = parseInt(productRows[0].stock_qty);
            if (currentStock < item.quantity) {
                throw new Error(`Insufficient stock for ${item.name}`);
            }

            // Insert Item
            await connection.query(
                `INSERT INTO invoice_items 
         (invoice_id, product_id, product_name, quantity, unit_price,
          applied_tax_percent, applied_discount_percent, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    invoiceId,
                    item.productId,
                    item.name,
                    item.quantity,
                    item.price,
                    item.appliedTaxPercent || 0,
                    item.appliedDiscountPercent || 0,
                    item.lineTotal,
                ]
            );

            // Deduct Stock
            await connection.query(
                'UPDATE products SET stock_qty = stock_qty - ? WHERE id = ?',
                [item.quantity, item.productId]
            );
        }

        await connection.commit();

        // Construct response matching what frontend expects
        const invoice = {
            id: invoiceId,
            invoiceNumber: invoiceNumber,
            grandTotal: grandTotal,
            paymentMethod: 'CARD',
            paymentStatus: 'COMPLETED',
            razorpay: {
                razorpay_payment_id,
                razorpay_order_id
            },
            // Include other fields if necessary for Receipt
            date: date || new Date(),
            items: items,
            subtotal,
            taxTotal,
            discountTotal,
            customerInfo: customerInfo
        };

        res.json({
            success: true,
            invoice
        });

    } catch (error) {
        await connection.rollback();
        console.error('Payment Verification/Invoice Creation Error:', error);
        res.status(500).json({ error: 'Payment verified but invoice creation failed: ' + error.message });
    } finally {
        connection.release();
    }
});

export default router;
