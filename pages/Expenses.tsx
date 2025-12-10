import React, { useState, useEffect } from 'react';
import { Store } from '../types';
import { Card, Button, Input, Select, Modal } from '../components/UI';
import { Plus, Trash2, Calendar, FileText, Tag, DollarSign } from 'lucide-react';
import { expensesApi, Expense } from '../src/api/expenses';

interface ExpensesProps {
    store: Store;
}

export const Expenses: React.FC<ExpensesProps> = ({ store }) => {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(false);
    const [isExpenseModalOpen, setExpenseModalOpen] = useState(false);
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });

    const [newExpense, setNewExpense] = useState<Partial<Expense>>({
        title: '',
        amount: 0,
        expenseDate: new Date().toISOString().split('T')[0],
        category: 'General',
        notes: ''
    });

    useEffect(() => {
        fetchExpenses();
    }, [store.id, dateRange]);

    const fetchExpenses = async () => {
        setLoading(true);
        try {
            const data = await expensesApi.getByStore(store.id, dateRange.start, dateRange.end);
            setExpenses(data);
        } catch (error) {
            console.error("Failed to load expenses", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddExpense = async () => {
        if (!newExpense.title || !newExpense.amount) {
            alert("Title and Amount are required");
            return;
        }
        try {
            await expensesApi.create({ ...newExpense, storeId: store.id });
            setExpenseModalOpen(false);
            setNewExpense({
                title: '',
                amount: 0,
                expenseDate: new Date().toISOString().split('T')[0],
                category: 'General',
                notes: ''
            });
            fetchExpenses();
        } catch (error) {
            console.error(error);
            alert("Failed to add expense");
        }
    };

    const handleDeleteExpense = async (id: string) => {
        if (!confirm("Delete this expense?")) return;
        try {
            await expensesApi.delete(id);
            fetchExpenses();
        } catch (error) {
            console.error(error);
            alert("Failed to delete expense");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end">
                <div className="flex gap-4">
                    <Input label="Start Date" type="date" value={dateRange.start} onChange={e => setDateRange({ ...dateRange, start: e.target.value })} />
                    <Input label="End Date" type="date" value={dateRange.end} onChange={e => setDateRange({ ...dateRange, end: e.target.value })} />
                </div>
                <Button onClick={() => setExpenseModalOpen(true)} className="flex items-center gap-2"><Plus size={16} /> Add Expense</Button>
            </div>

            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500">
                            <tr>
                                <th className="p-3">Date</th>
                                <th className="p-3">Title</th>
                                <th className="p-3">Category</th>
                                <th className="p-3">Description</th>
                                <th className="p-3 text-right">Amount</th>
                                <th className="p-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {expenses.length === 0 ? (
                                <tr><td colSpan={6} className="p-4 text-center text-slate-400">No expenses recorded for this period</td></tr>
                            ) : (
                                expenses.map(exp => (
                                    <tr key={exp.id}>
                                        <td className="p-3">{new Date(exp.expenseDate).toLocaleDateString()}</td>
                                        <td className="p-3 font-medium">{exp.title}</td>
                                        <td className="p-3"><span className="bg-slate-100 px-2 py-1 rounded text-xs">{exp.category}</span></td>
                                        <td className="p-3 text-slate-500 max-w-xs truncate">{exp.notes}</td>
                                        <td className="p-3 text-right font-bold text-slate-700">{store.currency} {exp.amount.toLocaleString()}</td>
                                        <td className="p-3 text-right">
                                            <button onClick={() => handleDeleteExpense(exp.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <Modal isOpen={isExpenseModalOpen} onClose={() => setExpenseModalOpen(false)} title="Add Daily Expense">
                <div className="space-y-4">
                    <Input label="Expense Title" placeholder="e.g. Electricity Bill" value={newExpense.title} onChange={e => setNewExpense({ ...newExpense, title: e.target.value })} />
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Amount" type="number" value={newExpense.amount || ''} onChange={e => setNewExpense({ ...newExpense, amount: +e.target.value })} />
                        <Input label="Date" type="date" value={newExpense.expenseDate} onChange={e => setNewExpense({ ...newExpense, expenseDate: e.target.value })} />
                    </div>
                    <Select label="Category" value={newExpense.category} onChange={e => setNewExpense({ ...newExpense, category: e.target.value })}>
                        <option value="General">General</option>
                        <option value="Rent">Rent</option>
                        <option value="Salary">Salary</option>
                        <option value="Utilities">Utilities</option>
                        <option value="Inventory">Inventory</option>
                        <option value="Marketing">Marketing</option>
                        <option value="Maintenance">Maintenance</option>
                    </Select>
                    <Input label="Description (Notes)" placeholder="Additional details..." value={newExpense.notes || ''} onChange={e => setNewExpense({ ...newExpense, notes: e.target.value })} />
                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="secondary" onClick={() => setExpenseModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleAddExpense}>Save Expense</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
