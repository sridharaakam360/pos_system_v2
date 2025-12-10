import express from 'express';
import db from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get all customers for a store
router.get('/store/:storeId', authenticateToken, async (req, res) => {
    try {
        // Only allow access to own store or SUPER_ADMIN
        if (req.user.role === 'STORE_ADMIN' && req.user.storeId !== req.params.storeId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const [customers] = await db.query(
            `SELECT id, store_id, name, mobile, email, gender, place, address, notes, created_at, updated_at
             FROM customers
             WHERE store_id = ?
             ORDER BY created_at DESC`,
            [req.params.storeId]
        );

        res.json(customers.map(c => ({
            id: c.id,
            storeId: c.store_id,
            name: c.name,
            mobile: c.mobile,
            email: c.email,
            gender: c.gender,
            place: c.place,
            address: c.address,
            notes: c.notes,
            createdAt: c.created_at,
            updatedAt: c.updated_at
        })));
    } catch (error) {
        console.error('Get customers error:', error);
        res.status(500).json({ error: 'Failed to fetch customers', details: error.message });
    }
});

// Search customers by mobile or name
router.get('/search', authenticateToken, async (req, res) => {
    try {
        const { storeId, query } = req.query;

        if (!storeId || !query) {
            return res.status(400).json({ error: 'Store ID and search query are required' });
        }

        // Only allow access to own store or SUPER_ADMIN
        if (req.user.role === 'STORE_ADMIN' && req.user.storeId !== storeId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const searchTerm = `%${query}%`;
        const [customers] = await db.query(
            `SELECT id, store_id, name, mobile, email, gender, place
             FROM customers
             WHERE store_id = ? AND (mobile LIKE ? OR name LIKE ?)
             ORDER BY created_at DESC
             LIMIT 10`,
            [storeId, searchTerm, searchTerm]
        );

        res.json(customers.map(c => ({
            id: c.id,
            storeId: c.store_id,
            name: c.name,
            mobile: c.mobile,
            email: c.email,
            gender: c.gender,
            place: c.place
        })));
    } catch (error) {
        console.error('Search customers error:', error);
        res.status(500).json({ error: 'Failed to search customers', details: error.message });
    }
});

// Get single customer
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const [customers] = await db.query(
            `SELECT id, store_id, name, mobile, email, gender, place, address, notes, created_at, updated_at
             FROM customers
             WHERE id = ?`,
            [req.params.id]
        );

        if (customers.length === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        const customer = customers[0];

        // Check access
        if (req.user.role === 'STORE_ADMIN' && req.user.storeId !== customer.store_id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json({
            id: customer.id,
            storeId: customer.store_id,
            name: customer.name,
            mobile: customer.mobile,
            email: customer.email,
            gender: customer.gender,
            place: customer.place,
            address: customer.address,
            notes: customer.notes,
            createdAt: customer.created_at,
            updatedAt: customer.updated_at
        });
    } catch (error) {
        console.error('Get customer error:', error);
        res.status(500).json({ error: 'Failed to fetch customer', details: error.message });
    }
});

// Create customer
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { storeId, name, mobile, email, gender, place, address, notes } = req.body;

        if (!storeId || !name) {
            return res.status(400).json({ error: 'Store ID and name are required' });
        }

        // Only STORE_ADMIN can create customers for their own store, SUPER_ADMIN can do all
        if (req.user.role === 'STORE_ADMIN' && req.user.storeId !== storeId) {
            return res.status(403).json({ error: 'You can only add customers to your own store' });
        }

        // Check if customer with same mobile already exists (if mobile provided)
        if (mobile) {
            const [existing] = await db.query(
                'SELECT id FROM customers WHERE store_id = ? AND mobile = ?',
                [storeId, mobile]
            );

            if (existing.length > 0) {
                return res.status(409).json({
                    error: 'Customer with this mobile number already exists',
                    existingCustomerId: existing[0].id
                });
            }
        }

        // Generate UUID for customer
        const customerId = await db.query('SELECT UUID() as id');
        const finalCustomerId = customerId[0][0].id;

        await db.query(
            `INSERT INTO customers 
             (id, store_id, name, mobile, email, gender, place, address, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                finalCustomerId, storeId, name, mobile || null, email || null,
                gender || null, place || null, address || null, notes || null
            ]
        );

        res.status(201).json({
            message: 'Customer created successfully',
            customerId: finalCustomerId
        });
    } catch (error) {
        console.error('Create customer error:', error);
        res.status(500).json({ error: 'Failed to create customer', details: error.message });
    }
});

// Update customer
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { name, mobile, email, gender, place, address, notes } = req.body;

        // Check access
        const [customers] = await db.query('SELECT store_id FROM customers WHERE id = ?', [req.params.id]);
        if (customers.length === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        const storeId = customers[0].store_id;
        if (req.user.role === 'STORE_ADMIN' && req.user.storeId !== storeId) {
            return res.status(403).json({ error: 'You can only update customers in your own store' });
        }

        const [result] = await db.query(
            `UPDATE customers SET 
                name = COALESCE(?, name),
                mobile = ?,
                email = ?,
                gender = ?,
                place = ?,
                address = ?,
                notes = ?
             WHERE id = ?`,
            [name, mobile, email, gender, place, address, notes, req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        res.json({ message: 'Customer updated successfully' });
    } catch (error) {
        console.error('Update customer error:', error);
        res.status(500).json({ error: 'Failed to update customer', details: error.message });
    }
});

// Delete customer
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        // Check access
        const [customers] = await db.query('SELECT store_id FROM customers WHERE id = ?', [req.params.id]);
        if (customers.length === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        const storeId = customers[0].store_id;
        if (req.user.role === 'STORE_ADMIN' && req.user.storeId !== storeId) {
            return res.status(403).json({ error: 'You can only delete customers from your own store' });
        }

        const [result] = await db.query('DELETE FROM customers WHERE id = ?', [req.params.id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        res.json({ message: 'Customer deleted successfully' });
    } catch (error) {
        console.error('Delete customer error:', error);
        res.status(500).json({ error: 'Failed to delete customer', details: error.message });
    }
});

export default router;
