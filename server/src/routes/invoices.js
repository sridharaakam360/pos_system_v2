import express from 'express';
import db from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { randomUUID } from 'crypto';

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

    if (invoices.length === 0) {
      return res.json([]);
    }

    // Fixed N+1 query: Get all items for all invoices in one query
    const invoiceIds = invoices.map(inv => inv.id);
    const placeholders = invoiceIds.map(() => '?').join(',');

    const [allItems] = await db.query(
      `SELECT invoice_id, id, product_id, product_name, quantity, unit_price, 
                    applied_tax_percent, applied_discount_percent, line_total 
             FROM invoice_items 
             WHERE invoice_id IN (${placeholders})`,
      invoiceIds
    );

    // Group items by invoice_id
    const itemsByInvoice = {};
    allItems.forEach(item => {
      if (!itemsByInvoice[item.invoice_id]) {
        itemsByInvoice[item.invoice_id] = [];
      }
      itemsByInvoice[item.invoice_id].push({
        id: item.product_id,
        name: item.product_name,
        quantity: item.quantity,
        price: parseFloat(item.unit_price),
        appliedTaxPercent: parseFloat(item.applied_tax_percent),
        appliedDiscountPercent: parseFloat(item.applied_discount_percent),
        lineTotal: parseFloat(item.line_total)
      });
    });

    // Map invoices with their items
    const invoicesWithItems = invoices.map(invoice => ({
      id: invoice.id,
      invoiceNumber: invoice.invoice_number,
      storeId: invoice.store_id,
      date: invoice.date,
      items: itemsByInvoice[invoice.id] || [],
      subtotal: parseFloat(invoice.subtotal),
      taxTotal: parseFloat(invoice.tax_total),
      discountTotal: parseFloat(invoice.discount_total),
      grandTotal: parseFloat(invoice.grand_total),
      paymentMethod: invoice.payment_method,
      synced: Boolean(invoice.synced)
    }));

    res.json(invoicesWithItems);
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({ error: 'Failed to fetch invoices', details: error.message });
  }
});

// POST /api/invoices — FIXED VERSION
router.post('/', authenticateToken, async (req, res) => {
  const connection = await db.getConnection();
  const invoiceId = randomUUID();

  try {
    await connection.beginTransaction();

    const {
      storeId,
      date,
      items,
      subtotal,
      taxTotal,
      discountTotal,
      grandTotal,
      paymentMethod,
    } = req.body;

    if (!storeId || !items || items.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Generate unique invoice number on backend
    const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // 1. Insert invoice with UUID
    await connection.query(
      `INSERT INTO invoices 
       (id, invoice_number, store_id, date, subtotal, tax_total, discount_total, 
        grand_total, payment_method, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        invoiceId,
        invoiceNumber,
        storeId,
        date || new Date(),
        subtotal || 0,
        taxTotal || 0,
        discountTotal || 0,
        grandTotal || 0,
        paymentMethod || 'CASH',
        true,
      ]
    );

    // 2. Insert items + deduct stock
    for (const item of items) {
      // Check product exists and lock row
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

      // Insert invoice item
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

      // Deduct stock
      await connection.query(
        'UPDATE products SET stock_qty = stock_qty - ? WHERE id = ?',
        [item.quantity, item.productId]
      );
    }

    await connection.commit();

    res.status(201).json({
      message: 'Invoice created successfully',
      invoiceId,
      invoiceNumber,
    });
  } catch (error) {
    await connection.rollback();
    console.error('Create invoice error:', error);

    if (error.message.includes('Insufficient stock') || error.message.includes('Product not found')) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({
      error: 'Failed to create invoice',
      details: error.message,
    });
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
