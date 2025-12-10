import express from 'express';
import db from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get all products (optionally filtered by store)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { storeId } = req.query;

        let query = `SELECT id, store_id, category_id, name, price, stock_qty, 
                        tax_override, sku, image_url, cost_price
                 FROM products`;
        let params = [];

        if (storeId) {
            query += ' WHERE store_id = ?';
            params.push(storeId);
        }

        query += ' ORDER BY name ASC';

        const [products] = await db.query(query, params);

        res.json(products.map(prod => ({
            id: prod.id,
            storeId: prod.store_id,
            categoryId: prod.category_id,
            name: prod.name,
            price: parseFloat(prod.price),
            stockQty: prod.stock_qty,
            taxOverride: prod.tax_override ? parseFloat(prod.tax_override) : null,
            sku: prod.sku,
            imageUrl: prod.image_url,
            costPrice: prod.cost_price ? parseFloat(prod.cost_price) : 0
        })));
    } catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

// Create product
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { id, storeId, categoryId, name, price, stockQty, taxOverride, sku, imageUrl, costPrice } = req.body;

        if (!storeId || !categoryId || !name || price === undefined) {
            return res.status(400).json({ error: 'Store ID, category ID, name, and price are required' });
        }

        await db.query(
            `INSERT INTO products (id, store_id, category_id, name, price, stock_qty, tax_override, sku, image_url, cost_price) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, storeId, categoryId, name, price, stockQty || 0, taxOverride || null, sku || null, imageUrl || null, costPrice || 0]
        );

        res.status(201).json({
            message: 'Product created successfully',
            productId: id
        });
    } catch (error) {
        console.error('Create product error:', error);
        res.status(500).json({ error: 'Failed to create product' });
    }
});

// Update product
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { categoryId, name, price, stockQty, taxOverride, sku, imageUrl, costPrice } = req.body;

        const [result] = await db.query(
            `UPDATE products SET 
        category_id = COALESCE(?, category_id),
        name = COALESCE(?, name),
        price = COALESCE(?, price),
        stock_qty = COALESCE(?, stock_qty),
        tax_override = ?,
        sku = ?,
        image_url = ?,
        cost_price = COALESCE(?, cost_price)
       WHERE id = ?`,
            [categoryId, name, price, stockQty, taxOverride, sku, imageUrl, costPrice, req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.json({ message: 'Product updated successfully' });
    } catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({ error: 'Failed to update product' });
    }
});

// Update product stock
router.patch('/:id/stock', authenticateToken, async (req, res) => {
    try {
        const { delta } = req.body;

        if (delta === undefined) {
            return res.status(400).json({ error: 'Stock delta is required' });
        }

        // Fetch current stock and ensure we won't go negative
        const [rows] = await db.query('SELECT stock_qty FROM products WHERE id = ?', [req.params.id]);
        if (!rows || rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const currentStock = parseInt(rows[0].stock_qty, 10) || 0;
        const newStock = currentStock + Number(delta);
        if (newStock < 0) {
            return res.status(400).json({ error: `Insufficient stock. Current: ${currentStock}, requested change: ${delta}` });
        }

        const [result] = await db.query(
            'UPDATE products SET stock_qty = ? WHERE id = ?',
            [newStock, req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        // Get updated stock
        const [products] = await db.query(
            'SELECT stock_qty FROM products WHERE id = ?',
            [req.params.id]
        );

        res.json({
            message: 'Stock updated successfully',
            newStock: products[0].stock_qty
        });
    } catch (error) {
        console.error('Update stock error:', error);
        res.status(500).json({ error: 'Failed to update stock' });
    }
});

// Delete product
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const [result] = await db.query('DELETE FROM products WHERE id = ?', [req.params.id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

export default router;
