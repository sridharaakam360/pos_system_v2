import React, { useState, useEffect } from 'react';
import { Store, ReportData, SalesTrend, TopProduct, CategoryPerformance, HeatmapData, PaymentStats, DrillDownInvoice } from '../types';
import { Card, Button, Input, Select, Modal } from '../components/UI';
import { DollarSign, Activity, TrendingUp, PieChart as PieIcon, BarChart3, Clock, CreditCard } from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';

interface FinancialReportsProps {
    store: Store;
}

export const FinancialReports: React.FC<FinancialReportsProps> = ({ store }) => {
    // Data States
    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [salesTrend, setSalesTrend] = useState<SalesTrend[]>([]);
    const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
    const [categoryPerf, setCategoryPerf] = useState<CategoryPerformance[]>([]);
    const [heatmapData, setHeatmapData] = useState<HeatmapData[]>([]);
    const [paymentStats, setPaymentStats] = useState<PaymentStats[]>([]);

    // Drill Down State
    const [isDrillModalOpen, setDrillModalOpen] = useState(false);
    const [drillTitle, setDrillTitle] = useState("");
    const [drillType, setDrillType] = useState<'INVOICES' | 'PRODUCTS' | 'EXPENSES'>('INVOICES');
    const [drillDownInvoices, setDrillDownInvoices] = useState<DrillDownInvoice[]>([]);
    const [drillDownProducts, setDrillDownProducts] = useState<TopProduct[]>([]);
    const [drillDownExpenses, setDrillDownExpenses] = useState<any[]>([]); // Using any for simplicity or import Expense type
    const [drillLoading, setDrillLoading] = useState(false);

    // Filters for drill down
    const [activeFilters, setActiveFilters] = useState<{
        categoryId?: string;
        paymentMethod?: string;
        specificDate?: string;
    }>({});

    const [loading, setLoading] = useState(false);

    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });

    const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

    useEffect(() => {
        fetchMainReports();
    }, [store.id, dateRange]);

    useEffect(() => {
        if (isDrillModalOpen) fetchDrillData();
    }, [isDrillModalOpen, activeFilters]);

    const fetchMainReports = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('auth_token');
            const headers = { 'Authorization': `Bearer ${token}` };
            const base = `http://localhost:3001/api/financial`;
            const query = `?storeId=${store.id}&startDate=${dateRange.start}&endDate=${dateRange.end}`;

            // Parallel Fetching
            const [summaryRes, trendRes, topRes, catRes, heatRes, payRes] = await Promise.all([
                fetch(`${base}/financial-summary${query}`, { headers }),
                fetch(`${base}/sales-trend?storeId=${store.id}&days=30`, { headers }),
                fetch(`${base}/top-products?storeId=${store.id}&limit=5`, { headers }),
                fetch(`${base}/category-performance${query}`, { headers }),
                fetch(`${base}/sales-heatmap${query}`, { headers }),
                fetch(`${base}/payment-method-stats${query}`, { headers })
            ]);

            if (summaryRes.ok) setReportData(await summaryRes.json());
            if (trendRes.ok) setSalesTrend(await trendRes.json());
            if (topRes.ok) setTopProducts(await topRes.json());
            if (catRes.ok) setCategoryPerf(await catRes.json());
            if (heatRes.ok) setHeatmapData(await heatRes.json());
            if (payRes.ok) setPaymentStats(await payRes.json());

        } catch (error) {
            console.error('Error fetching reports:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchDrillData = async () => {
        setDrillLoading(true);
        try {
            const token = localStorage.getItem('auth_token');
            const headers = { 'Authorization': `Bearer ${token}` };
            const base = `http://localhost:3001/api/financial`;

            if (drillType === 'INVOICES') {
                let url = `${base}/drill-down/invoices?storeId=${store.id}`;
                // If specific date is selected, use that for start/end
                if (activeFilters.specificDate) {
                    url += `&startDate=${activeFilters.specificDate}&endDate=${activeFilters.specificDate}`;
                } else {
                    url += `&startDate=${dateRange.start}&endDate=${dateRange.end}`;
                }
                if (activeFilters.categoryId) url += `&categoryId=${activeFilters.categoryId}`;
                if (activeFilters.paymentMethod) url += `&paymentMethod=${activeFilters.paymentMethod}`;

                const res = await fetch(url, { headers });
                if (res.ok) setDrillDownInvoices(await res.json());

            } else if (drillType === 'PRODUCTS') {
                let url = `${base}/top-products?storeId=${store.id}`;
                if (activeFilters.categoryId) url += `&categoryId=${activeFilters.categoryId}`;
                const res = await fetch(url, { headers });
                if (res.ok) setDrillDownProducts(await res.json());
            } else if (drillType === 'EXPENSES') {
                // Use correct endpoint: /store/:storeId with from/to query params
                const res = await fetch(`http://localhost:3001/api/expenses/store/${store.id}?from=${dateRange.start}&to=${dateRange.end}`, { headers });
                if (res.ok) setDrillDownExpenses(await res.json());
            }
        } catch (e) {
            console.error(e);
        } finally {
            setDrillLoading(false);
        }
    };

    // Click Handlers
    const handleRevenueClick = () => {
        setDrillTitle("All Revenue Invoices");
        setDrillType("INVOICES");
        setActiveFilters({});
        setDrillModalOpen(true);
    };

    const handleTrendClick = (data: any) => {
        if (!data || !data.activePayload) return;
        const date = data.activePayload[0].payload.date; // "YYYY-MM-DD"
        setDrillTitle(`Sales on ${date}`);
        setDrillType("INVOICES");
        setActiveFilters({ specificDate: date });
        setDrillModalOpen(true);
    };

    const handleCategoryClick = (data: any) => {
        setDrillTitle(`Products in ${data.categoryName}`);
        setDrillType("PRODUCTS");
        setActiveFilters({ categoryId: data.categoryId });
        setDrillModalOpen(true);
    };

    const handlePaymentClick = (method: string) => {
        setDrillTitle(`Invoices via ${method}`);
        setDrillType("INVOICES");
        setActiveFilters({ paymentMethod: method });
        setDrillModalOpen(true);
    };

    const handleNetProfitClick = () => {
        setDrillTitle(`Expenses & Net Profit Breakdown`);
        setDrillType("EXPENSES");
        setActiveFilters({});
        setDrillModalOpen(true);
    };

    if (loading && !reportData) return <div className="p-10 text-center animate-pulse">Loading Analytics...</div>;

    return (
        <div className="space-y-6">
            {/* Date Filter */}
            <Card className="flex flex-col sm:flex-row gap-4 items-end justify-between bg-white/80 backdrop-blur sticky top-0 z-10 border-b border-indigo-100">
                <div className="flex gap-4">
                    <Input label="Start Date" type="date" value={dateRange.start} onChange={e => setDateRange({ ...dateRange, start: e.target.value })} />
                    <Input label="End Date" type="date" value={dateRange.end} onChange={e => setDateRange({ ...dateRange, end: e.target.value })} />
                </div>
                <Button onClick={fetchMainReports} variant="secondary">Refresh Data</Button>
            </Card>

            {/* 1. KPIs */}
            {reportData && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div onClick={handleRevenueClick} className="cursor-pointer">
                        <Card className="border-t-4 border-indigo-500 hover:shadow-lg transition-transform hover:-translate-y-1">
                            <p className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Revenue</p>
                            <div className="flex items-center gap-2 mt-1">
                                <DollarSign className="text-indigo-600" size={24} />
                                <span className="text-3xl font-bold text-slate-800">{store.currency} {(reportData.totalRevenue || 0).toLocaleString()}</span>
                            </div>
                            <p className="text-xs text-indigo-400 mt-2">Click for details &rarr;</p>
                        </Card>
                    </div>
                    <Card className="border-t-4 border-orange-500 hover:shadow-lg transition-shadow">
                        <p className="text-slate-500 text-xs uppercase tracking-wider font-semibold">COGS & Tax</p>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-2xl font-bold text-slate-700">{store.currency} {((reportData.totalCost || 0) + (reportData.taxCollected || 0)).toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-orange-600 mt-1">Cost: {reportData.totalCost.toLocaleString()} | Tax: {reportData.taxCollected.toLocaleString()}</p>
                    </Card>
                    <Card className="border-t-4 border-emerald-500 bg-gradient-to-br from-white to-emerald-50 hover:shadow-lg transition-shadow cursor-pointer" onClick={handleNetProfitClick}>
                        <p className="text-emerald-700 text-xs uppercase tracking-wider font-semibold">Net Profit</p>
                        <div className="flex items-center gap-2 mt-1">
                            <Activity className="text-emerald-600" size={24} />
                            <span className="text-3xl font-bold text-emerald-700">{store.currency} {(reportData.netIncome || 0).toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-emerald-600 mt-1 font-medium">Margin: {reportData.margin || 0}%</p>
                        <p className="text-xs text-emerald-600 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">Click for Expense Breakdown</p>
                    </Card>
                    <Card className="border-t-4 border-purple-500 hover:shadow-lg transition-shadow">
                        <p className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Payment Split</p>
                        <div className="flex h-12 gap-1 mt-2">
                            {(() => {
                                const total = paymentStats.reduce((a, b) => a + b.count, 0);
                                const online = paymentStats.filter(s => ['UPI', 'CARD', 'QR'].includes(s.method))
                                    .reduce((acc, curr) => ({ count: acc.count + curr.count, revenue: acc.revenue + curr.revenue }), { count: 0, revenue: 0 });
                                const cash = paymentStats.find(s => s.method === 'CASH') || { count: 0, revenue: 0 };

                                const groups = [
                                    { method: 'Online', ...online, color: '#8b5cf6' },
                                    { method: 'Cash', count: cash.count, revenue: cash.revenue, color: '#10b981' }
                                ].filter(g => g.count > 0);

                                return groups.map((group) => (
                                    <div key={group.method}
                                        onClick={() => handlePaymentClick(group.method === 'Cash' ? 'CASH' : 'Online')}
                                        className="h-full rounded flex items-center justify-center text-xs font-bold text-white relative group cursor-pointer hover:opacity-90 transition-opacity"
                                        style={{ width: `${(group.count / total * 100)}%`, backgroundColor: group.color }}>
                                        {group.method}
                                        <div className="absolute bottom-full mb-1 hidden group-hover:block bg-slate-800 text-white p-1 rounded whitespace-nowrap z-20 pointer-events-none">
                                            {group.method}: {group.count} ({store.currency}{group.revenue.toLocaleString()})
                                        </div>
                                    </div>
                                ));
                            })()}
                        </div>
                        <p className="text-xs text-center text-slate-400 mt-1">Click section to filter</p>
                    </Card>        </div>
            )}

            {/* 2. Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card title="Category Performance" className="lg:col-span-1">
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={categoryPerf}
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="revenue"
                                    nameKey="categoryName"
                                    onClick={handleCategoryClick}
                                    cursor="pointer"
                                >
                                    {categoryPerf.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value: number) => `${store.currency} ${value.toLocaleString()}`} />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <p className="text-center text-xs text-slate-400 mt-2">Click slice to view products</p>
                </Card>

                <Card title="Sales vs Profit Trend" className="lg:col-span-2">
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={salesTrend} onClick={handleTrendClick}>
                                <defs>
                                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="date" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                                <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={(val) => `${val / 1000}k`} />
                                <Tooltip />
                                <Area type="monotone" dataKey="revenue" stroke="#6366f1" fill="#e0e7ff" strokeWidth={2} activeDot={{ r: 6, onClick: handleTrendClick, cursor: 'pointer' }} />
                                <Area type="monotone" dataKey="profit" stroke="#10b981" fill="url(#colorProfit)" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                    <p className="text-center text-xs text-slate-400 mt-2">Click on chart to see daily report</p>
                </Card>
            </div>

            {/* Heatmap Row */}
            <div className="grid grid-cols-1 gap-6">
                <Card title="Busy Hours (Heatmap)">
                    <div className="h-48 overflow-x-auto flex gap-4">
                        {/*  Simplified textual heatmap  */}
                        <div className="space-y-2 flex-1">
                            {heatmapData.length === 0 ? <p className="text-slate-400 text-center py-10">No data</p> :
                                <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-7 gap-2">
                                    {heatmapData.map((h, i) => (
                                        <div key={i} className="text-center p-2 rounded bg-slate-50 border border-slate-100">
                                            <p className="text-xs font-bold text-slate-500">{h.dayOfWeek}</p>
                                            <p className="text-lg font-bold text-indigo-600">{h.hour}:00</p>
                                            <p className="text-xs text-slate-400">{h.salesCount} sales</p>
                                        </div>
                                    )).slice(0, 14)}
                                </div>
                            }
                        </div>
                    </div>
                </Card>
            </div>

            {/* Drill Down Modal */}
            <Modal isOpen={isDrillModalOpen} onClose={() => setDrillModalOpen(false)} title={drillTitle}>
                <div className="max-h-[60vh] overflow-y-auto">
                    {drillLoading ? (
                        <div className="p-10 text-center text-slate-500">Loading details...</div>
                    ) : (
                        <>
                            {drillType === 'INVOICES' ? (
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 text-slate-500 sticky top-0">
                                        <tr>
                                            <th className="p-3">Invoice</th>
                                            <th className="p-3">Date</th>
                                            <th className="p-3">Pay</th>
                                            <th className="p-3">Items</th>
                                            <th className="p-3 text-right">Total</th>
                                            <th className="p-3 text-right">Profit</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {drillDownInvoices.length === 0 ? (
                                            <tr><td colSpan={6} className="p-4 text-center text-slate-400">No invoices found</td></tr>
                                        ) : (
                                            drillDownInvoices.map(inv => (
                                                <tr key={inv.id} className="hover:bg-slate-50">
                                                    <td className="p-3 font-mono text-slate-600">#{inv.invoiceNumber}</td>
                                                    <td className="p-3 text-slate-500">{new Date(inv.date).toLocaleDateString()}</td>
                                                    <td className="p-3 text-xs">{inv.paymentMethod}</td>
                                                    <td className="p-3 max-w-xs truncate text-xs" title={inv.items}>{inv.items}</td>
                                                    <td className="p-3 text-right font-medium">{store.currency} {inv.total.toLocaleString()}</td>
                                                    <td className="p-3 text-right text-emerald-600">+{inv.profit.toLocaleString()}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            ) : drillType === 'EXPENSES' ? (
                                <div className="space-y-4">
                                    <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-100">
                                        <h4 className="font-bold text-emerald-800 mb-2">Profit Logic</h4>
                                        <div className="text-sm space-y-1 text-emerald-700">
                                            <div className="flex justify-between"><span>Total Revenue:</span> <span>{store.currency} {(reportData?.totalRevenue || 0).toLocaleString()}</span></div>
                                            <div className="flex justify-between"><span>(-) COGS & Tax:</span> <span>{store.currency} {((reportData?.totalCost || 0) + (reportData?.taxCollected || 0)).toLocaleString()}</span></div>
                                            <div className="flex justify-between font-semibold border-t border-emerald-200 pt-1"><span>= Gross Profit:</span> <span>{store.currency} {(reportData?.grossProfit || 0).toLocaleString()}</span></div>
                                            <div className="flex justify-between text-red-600"><span>(-) Total Expenses:</span> <span>{store.currency} {(reportData?.totalExpenses || 0).toLocaleString()}</span></div>
                                            <div className="flex justify-between font-bold text-lg border-t border-emerald-300 pt-1"><span>= Net Income:</span> <span>{store.currency} {(reportData?.netIncome || 0).toLocaleString()}</span></div>
                                        </div>
                                    </div>
                                    <h4 className="font-bold text-slate-700">Expense List</h4>
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-50 text-slate-500 sticky top-0">
                                            <tr>
                                                <th className="p-3">Date</th>
                                                <th className="p-3">Title</th>
                                                <th className="p-3">Category</th>
                                                <th className="p-3 text-right">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {drillDownExpenses.length === 0 ? (
                                                <tr><td colSpan={4} className="p-4 text-center text-slate-400">No expenses recorded</td></tr>
                                            ) : (
                                                drillDownExpenses.map((exp: any) => (
                                                    <tr key={exp.id} className="hover:bg-slate-50">
                                                        <td className="p-3 text-slate-500">{new Date(exp.expenseDate).toLocaleDateString()}</td>
                                                        <td className="p-3 font-medium">{exp.title}</td>
                                                        <td className="p-3 text-xs bg-slate-100 rounded px-2 w-fit">{exp.category}</td>
                                                        <td className="p-3 text-right font-bold text-slate-700">{store.currency} {exp.amount.toLocaleString()}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 text-slate-500 sticky top-0">
                                        <tr>
                                            <th className="p-3">Product Name</th>
                                            <th className="p-3 text-right">Qty Sold</th>
                                            <th className="p-3 text-right">Revenue</th>
                                            <th className="p-3 text-right">Profit</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {drillDownProducts.length === 0 ? (
                                            <tr><td colSpan={4} className="p-4 text-center text-slate-400">No products found</td></tr>
                                        ) : (
                                            drillDownProducts.map(prod => (
                                                <tr key={prod.id} className="hover:bg-slate-50">
                                                    <td className="p-3 font-medium">{prod.name}</td>
                                                    <td className="p-3 text-right">{prod.quantitySold}</td>
                                                    <td className="p-3 text-right">{store.currency} {prod.revenue.toLocaleString()}</td>
                                                    <td className="p-3 text-right text-emerald-600">+{prod.profit.toLocaleString()}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </>
                    )}
                </div>
                <div className="flex justify-end pt-4 border-t mt-4">
                    <Button onClick={() => setDrillModalOpen(false)}>Close</Button>
                </div>
            </Modal>
        </div>
    );
};
