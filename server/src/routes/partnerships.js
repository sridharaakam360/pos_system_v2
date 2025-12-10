import express from 'express';
import db from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Get all partnerships for a store with assets and blended ownership calculation
router.get('/store/:storeId', authenticateToken, async (req, res) => {
    try {
        // Only allow access to own store or SUPER_ADMIN
        if (req.user.role === 'STORE_ADMIN' && req.user.storeId !== req.params.storeId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const [partnerships] = await db.query(
            `SELECT p.id, p.store_id, p.partner_name, p.email, p.phone_number, 
                     p.cash_investment, p.investment_date, p.ownership_percentage, 
                     p.address, p.bank_details, p.notes, p.is_active, p.created_at, p.updated_at,
                     COALESCE(SUM(pa.asset_value), 0) as total_asset_value
             FROM partnerships p
             LEFT JOIN partnership_assets pa ON p.id = pa.partnership_id
             WHERE p.store_id = ?
             GROUP BY p.id
             ORDER BY p.cash_investment DESC`,
            [req.params.storeId]
        );

        // Fetch assets for each partnership
        const withAssets = await Promise.all(partnerships.map(async (p) => {
            const [assets] = await db.query(
                'SELECT id, partnership_id, asset_name, asset_description, asset_value, asset_type, contributed_date, notes, created_at, updated_at FROM partnership_assets WHERE partnership_id = ? ORDER BY contributed_date DESC',
                [p.id]
            );
            return { ...p, assets };
        }));

        // Calculate blended ownership percentages (cash + assets)
        const totalCash = withAssets.reduce((sum, p) => sum + parseFloat(p.cash_investment || 0), 0);
        const totalAssets = withAssets.reduce((sum, p) => sum + parseFloat(p.total_asset_value || 0), 0);
        const totalValue = totalCash + totalAssets;

        const enriched = withAssets.map(p => {
            const cashValue = parseFloat(p.cash_investment || 0);
            const assetValue = parseFloat(p.total_asset_value || 0);
            const partnerTotal = cashValue + assetValue;
            const calculatedPercentage = totalValue > 0 ? (partnerTotal / totalValue) * 100 : 0;

            return {
                id: p.id,
                storeId: p.store_id,
                partnerName: p.partner_name,
                email: p.email,
                phoneNumber: p.phone_number,
                investmentAmount: cashValue, // Legacy field name
                cashInvestment: cashValue,
                investmentDate: p.investment_date,
                ownershipPercentage: parseFloat(calculatedPercentage.toFixed(2)), // Auto-calculated from cash + assets
                address: p.address,
                bankDetails: p.bank_details,
                notes: p.notes,
                isActive: Boolean(p.is_active),
                createdAt: p.created_at,
                updatedAt: p.updated_at,
                assets: p.assets.map(a => ({
                    id: a.id,
                    partnershipId: a.partnership_id,
                    assetName: a.asset_name,
                    assetDescription: a.asset_description,
                    assetValue: parseFloat(a.asset_value),
                    assetType: a.asset_type,
                    contributedDate: a.contributed_date,
                    notes: a.notes,
                    createdAt: a.created_at,
                    updatedAt: a.updated_at
                })),
                contributionBreakdown: {
                    cash: cashValue,
                    assets: assetValue,
                    total: partnerTotal
                }
            };
        });

        res.json(enriched);
    } catch (error) {
        console.error('Get partnerships error:', error);
        res.status(500).json({ error: 'Failed to fetch partnerships' });
    }
});

// Get single partnership with assets and blended ownership
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const [partnerships] = await db.query(
            `SELECT p.id, p.store_id, p.partner_name, p.email, p.phone_number, 
                     p.cash_investment, p.investment_date, p.ownership_percentage, 
                     p.address, p.bank_details, p.notes, p.is_active, p.created_at, p.updated_at,
                     COALESCE(SUM(pa.asset_value), 0) as total_asset_value
             FROM partnerships p
             LEFT JOIN partnership_assets pa ON p.id = pa.partnership_id
             WHERE p.id = ?
             GROUP BY p.id`,
            [req.params.id]
        );

        if (partnerships.length === 0) {
            return res.status(404).json({ error: 'Partnership not found' });
        }

        // Check access
        const partnership = partnerships[0];
        if (req.user.role === 'STORE_ADMIN' && req.user.storeId !== partnership.store_id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Fetch assets
        const [assets] = await db.query(
            'SELECT id, partnership_id, asset_name, asset_description, asset_value, asset_type, contributed_date, notes, created_at, updated_at FROM partnership_assets WHERE partnership_id = ? ORDER BY contributed_date DESC',
            [req.params.id]
        );

        // Get all partnerships for this store to calculate percentage
        const [allPartnerships] = await db.query(
            `SELECT p.id, p.cash_investment, COALESCE(SUM(pa.asset_value), 0) as total_asset_value
             FROM partnerships p
             LEFT JOIN partnership_assets pa ON p.id = pa.partnership_id
             WHERE p.store_id = ?
             GROUP BY p.id`,
            [partnership.store_id]
        );

        const totalCash = allPartnerships.reduce((sum, p) => sum + parseFloat(p.cash_investment || 0), 0);
        const totalAssets = allPartnerships.reduce((sum, p) => sum + parseFloat(p.total_asset_value || 0), 0);
        const totalValue = totalCash + totalAssets;

        const cashValue = parseFloat(partnership.cash_investment || 0);
        const assetValue = parseFloat(partnership.total_asset_value || 0);
        const partnerTotal = cashValue + assetValue;
        const calculatedPercentage = totalValue > 0 ? (partnerTotal / totalValue) * 100 : 0;

        res.json({
            id: partnership.id,
            storeId: partnership.store_id,
            partnerName: partnership.partner_name,
            email: partnership.email,
            phoneNumber: partnership.phone_number,
            investmentAmount: cashValue, // Legacy field
            cashInvestment: cashValue,
            investmentDate: partnership.investment_date,
            ownershipPercentage: parseFloat(calculatedPercentage.toFixed(2)),
            address: partnership.address,
            bankDetails: partnership.bank_details,
            notes: partnership.notes,
            isActive: Boolean(partnership.is_active),
            createdAt: partnership.created_at,
            updatedAt: partnership.updated_at,
            assets: assets.map(a => ({
                id: a.id,
                partnershipId: a.partnership_id,
                assetName: a.asset_name,
                assetDescription: a.asset_description,
                assetValue: parseFloat(a.asset_value),
                assetType: a.asset_type,
                contributedDate: a.contributed_date,
                notes: a.notes,
                createdAt: a.created_at,
                updatedAt: a.updated_at
            })),
            contributionBreakdown: {
                cash: cashValue,
                assets: assetValue,
                total: partnerTotal
            }
        });
    } catch (error) {
        console.error('Get partnership error:', error);
        res.status(500).json({ error: 'Failed to fetch partnership' });
    }
});

// Create partnership
router.post('/', authenticateToken, requireRole('SUPER_ADMIN', 'STORE_ADMIN'), async (req, res) => {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const {
            storeId, partnerName, email, phoneNumber, investmentAmount, cashInvestment,
            investmentDate, address, bankDetails, notes, isActive, assets
        } = req.body;

        // Support both investmentAmount and cashInvestment field names
        const finalCashInvestment = cashInvestment || investmentAmount;

        if (!storeId || !partnerName || !finalCashInvestment || !investmentDate) {
            await connection.rollback();
            return res.status(400).json({ error: 'storeId, partnerName, cashInvestment, and investmentDate are required' });
        }

        // Only STORE_ADMIN can create partnerships for their own store, SUPER_ADMIN can do all
        if (req.user.role === 'STORE_ADMIN' && req.user.storeId !== storeId) {
            await connection.rollback();
            return res.status(403).json({ error: 'You can only add partnerships to your own store' });
        }

        // Validate investment amount
        if (finalCashInvestment <= 0) {
            await connection.rollback();
            return res.status(400).json({ error: 'Cash investment must be greater than 0' });
        }

        // Generate UUID for partnership
        const partnershipId = await connection.query('SELECT UUID() as id');
        const finalPartnershipId = partnershipId[0][0].id;

        await connection.query(
            `INSERT INTO partnerships 
             (id, store_id, partner_name, email, phone_number, cash_investment, investment_date, ownership_percentage, address, bank_details, notes, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                finalPartnershipId, storeId, partnerName, email || null, phoneNumber || null, finalCashInvestment,
                investmentDate, 0, address || null, bankDetails || null, notes || null,
                isActive !== false
            ]
        );

        // Add assets if provided
        if (Array.isArray(assets) && assets.length > 0) {
            for (const asset of assets) {
                if (asset.assetName && asset.assetValue > 0) {
                    const assetId = await connection.query('SELECT UUID() as id');
                    const finalAssetId = assetId[0][0].id;

                    await connection.query(
                        `INSERT INTO partnership_assets 
                         (id, partnership_id, asset_name, asset_description, asset_value, asset_type, contributed_date, notes)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            finalAssetId, finalPartnershipId, asset.assetName, asset.assetDescription || null,
                            asset.assetValue, asset.assetType || 'OTHER', asset.contributedDate || new Date().toISOString().split('T')[0],
                            asset.notes || null
                        ]
                    );
                }
            }
        }

        await connection.commit();

        res.status(201).json({
            message: 'Partnership created successfully',
            partnershipId: finalPartnershipId
        });
    } catch (error) {
        await connection.rollback();
        console.error('Create partnership error:', error);
        res.status(500).json({ error: 'Failed to create partnership' });
    } finally {
        connection.release();
    }
});

// Update partnership
router.put('/:id', authenticateToken, requireRole('SUPER_ADMIN', 'STORE_ADMIN'), async (req, res) => {
    try {
        const {
            partnerName, email, phoneNumber, investmentAmount, cashInvestment, investmentDate,
            address, bankDetails, notes, isActive, assetsToAdd, assetsToRemove
        } = req.body;

        // Check access
        const [partnerships] = await db.query('SELECT store_id FROM partnerships WHERE id = ?', [req.params.id]);
        if (partnerships.length === 0) {
            return res.status(404).json({ error: 'Partnership not found' });
        }

        const storeId = partnerships[0].store_id;
        if (req.user.role === 'STORE_ADMIN' && req.user.storeId !== storeId) {
            return res.status(403).json({ error: 'You can only update partnerships in your own store' });
        }

        // Support both investmentAmount and cashInvestment
        const finalCashInvestment = cashInvestment || investmentAmount;

        // Validate investment amount if provided
        if (finalCashInvestment !== undefined && finalCashInvestment <= 0) {
            return res.status(400).json({ error: 'Cash investment must be greater than 0' });
        }

        const [result] = await db.query(
            `UPDATE partnerships SET 
                partner_name = COALESCE(?, partner_name),
                email = ?,
                phone_number = ?,
                cash_investment = COALESCE(?, cash_investment),
                investment_date = COALESCE(?, investment_date),
                address = ?,
                bank_details = ?,
                notes = ?,
                is_active = COALESCE(?, is_active)
             WHERE id = ?`,
            [
                partnerName, email, phoneNumber, finalCashInvestment, investmentDate,
                address, bankDetails, notes, isActive, req.params.id
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Partnership not found' });
        }

        // Handle asset removals
        if (Array.isArray(assetsToRemove) && assetsToRemove.length > 0) {
            for (const assetId of assetsToRemove) {
                await db.query('DELETE FROM partnership_assets WHERE id = ? AND partnership_id = ?', [assetId, req.params.id]);
            }
        }

        // Handle asset additions
        if (Array.isArray(assetsToAdd) && assetsToAdd.length > 0) {
            for (const asset of assetsToAdd) {
                if (asset.assetName && asset.assetValue > 0) {
                    await db.query(
                        `INSERT INTO partnership_assets 
                         (partnership_id, asset_name, asset_description, asset_value, asset_type, contributed_date, notes)
                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [
                            req.params.id, asset.assetName, asset.assetDescription || null,
                            asset.assetValue, asset.assetType || 'OTHER', asset.contributedDate || new Date().toISOString().split('T')[0],
                            asset.notes || null
                        ]
                    );
                }
            }
        }

        res.json({ message: 'Partnership updated successfully' });
    } catch (error) {
        console.error('Update partnership error:', error);
        res.status(500).json({ error: 'Failed to update partnership' });
    }
});

// Delete partnership
router.delete('/:id', authenticateToken, requireRole('SUPER_ADMIN', 'STORE_ADMIN'), async (req, res) => {
    try {
        // Check access
        const [partnerships] = await db.query('SELECT store_id FROM partnerships WHERE id = ?', [req.params.id]);
        if (partnerships.length === 0) {
            return res.status(404).json({ error: 'Partnership not found' });
        }

        const storeId = partnerships[0].store_id;
        if (req.user.role === 'STORE_ADMIN' && req.user.storeId !== storeId) {
            return res.status(403).json({ error: 'You can only delete partnerships from your own store' });
        }

        const [result] = await db.query('DELETE FROM partnerships WHERE id = ?', [req.params.id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Partnership not found' });
        }

        res.json({ message: 'Partnership deleted successfully' });
    } catch (error) {
        console.error('Delete partnership error:', error);
        res.status(500).json({ error: 'Failed to delete partnership' });
    }
});

export default router;
