import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

import authRoutes from './routes/auth.js';
import storeRoutes from './routes/stores.js';
import categoryRoutes from './routes/categories.js';
import productRoutes from './routes/products.js';
import invoiceRoutes from './routes/invoices.js';
import partnershipRoutes from './routes/partnerships.js';
import expenseRoutes from './routes/expenses.js';
import financialRoutes from './routes/financial.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/partnerships', partnershipRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/financial', financialRoutes);

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
