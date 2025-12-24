import React, { useState, useMemo } from 'react';
import { Store, Category, Product, Invoice } from '../types';
import { Card, Button, Input, Select, Badge, Modal, Tabs } from '../components/UI';
import { Plus, Package, Tag, Users, DollarSign, Settings, BarChart3, Edit2, Trash2, AlertTriangle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Partnerships } from './Partnerships';
import { FinancialReports } from './FinancialReports';
import { Expenses } from './Expenses';

type Tab = 'DASHBOARD' | 'PRODUCTS' | 'CATEGORIES' | 'PARTNERSHIPS' | 'FINANCIAL' | 'SETTINGS';

interface StoreAdminProps {
  store: Store;
  categories: Category[];
  products: Product[];
  invoices: Invoice[];
  onAddCategory: (category: Category) => void;
  onUpdateCategory: (updatedCategory: Category) => void;
  onDeleteCategory: (categoryId: string) => void;
  onAddProduct: (product: Product) => void;
  onUpdateProduct: (updatedProduct: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onUpdateProductStock: (id: string, delta: number) => void;
  onUpdateStore: (store: Store) => void;
}

export const StoreAdmin: React.FC<StoreAdminProps> = ({
  store,
  categories,
  products,
  invoices,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onUpdateProductStock,
  onUpdateStore
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('DASHBOARD');
  const [isCategoryModalOpen, setCategoryModalOpen] = useState(false);
  const [isProductModalOpen, setProductModalOpen] = useState(false);
  const [isSettingsModalOpen, setSettingsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [currentCategory, setCurrentCategory] = useState<Partial<Category>>({
    storeId: store.id,
    defaultGST: 0,
    defaultDiscount: 0,
    lowStockThreshold: 10
  });

  const [currentProduct, setCurrentProduct] = useState<Partial<Product>>({
    storeId: store.id,
    price: 0,
    stockQty: 0
  });

  // Analytics calculations
  const analytics = useMemo(() => {
    const storeInvoices = invoices.filter(inv => inv.storeId === store.id);
    const totalRevenue = storeInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0);
    const totalProducts = products.length;
    const lowStockProducts = products.filter(p => {
      const cat = categories.find(c => c.id === p.categoryId);
      return p.stockQty <= (cat?.lowStockThreshold || 10);
    }).length;
    const totalCategories = categories.length;

    // Revenue trend - last 14 days
    const days = 14;
    const dateMap = new Map<string, number>();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dateMap.set(d.toLocaleDateString('en-GB'), 0);
    }

    storeInvoices.forEach(inv => {
      const dateKey = new Date(inv.date).toLocaleDateString('en-GB');
      if (dateMap.has(dateKey)) {
        dateMap.set(dateKey, dateMap.get(dateKey)! + inv.grandTotal);
      }
    });

    const revenueChartData = Array.from(dateMap.entries())
      .map(([date, sales]) => ({
        date: new Date(date.split('/').reverse().join('-')).toLocaleDateString('default', { month: 'short', day: 'numeric' }),
        sales: Math.round(sales)
      }))
      .reverse();

    // Category distribution for PieChart
    const categoryData = categories.map(cat => ({
      name: cat.name,
      value: products.filter(p => p.categoryId === cat.id).length,
      color: ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'][categories.indexOf(cat) % 6] || '#6366f1'
    })).filter(c => c.value > 0);

    return {
      totalRevenue,
      totalProducts,
      lowStockProducts,
      totalCategories,
      revenueChartData,
      categoryData,
      recentInvoices: storeInvoices.slice(-5).reverse()
    };
  }, [store.id, invoices, products, categories]);

  // Handlers
  const openCategoryModal = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      setCurrentCategory({ ...category });
    } else {
      setEditingCategory(null);
      setCurrentCategory({ storeId: store.id, defaultGST: 0, defaultDiscount: 0, lowStockThreshold: 10 });
    }
    setCategoryModalOpen(true);
  };

  const openProductModal = (product?: Product) => {
    // Check if categories exist before opening modal for new product
    if (!product && categories.length === 0) {
      const confirmed = confirm(
        'No categories found! You need to create at least one category before adding products.\n\nWould you like to go to the Categories tab now?'
      );
      if (confirmed) {
        setActiveTab('CATEGORIES');
      }
      return;
    }

    if (product) {
      setEditingProduct(product);
      setCurrentProduct({ ...product });
    } else {
      setEditingProduct(null);
      setCurrentProduct({ storeId: store.id, price: 0, stockQty: 0, costPrice: 0 });
    }
    setProductModalOpen(true);
  };

  const handleSaveCategory = () => {
    if (!currentCategory.name?.trim()) return;

    if (editingCategory) {
      onUpdateCategory({ ...editingCategory, ...currentCategory } as Category);
    } else {
      const newCat: Category = {
        id: `cat_${Date.now()}`,
        storeId: store.id,
        name: currentCategory.name!,
        defaultGST: currentCategory.defaultGST || 0,
        defaultDiscount: currentCategory.defaultDiscount || 0,
        lowStockThreshold: currentCategory.lowStockThreshold || 10
      };
      onAddCategory(newCat);
    }

    setCategoryModalOpen(false);
    setEditingCategory(null);
  };

  const handleSaveProduct = () => {
    if (!currentProduct.name?.trim() || !currentProduct.categoryId) return;

    if (editingProduct) {
      onUpdateProduct({ ...editingProduct, ...currentProduct } as Product);
    } else {
      const newProd: Product = {
        id: `prod_${Date.now()}`,
        storeId: store.id,
        categoryId: currentProduct.categoryId!,
        name: currentProduct.name!,
        price: currentProduct.price || 0,
        stockQty: currentProduct.stockQty || 0,
        sku: currentProduct.sku,
        imageUrl: currentProduct.imageUrl,
        taxOverride: currentProduct.taxOverride
      };
      onAddProduct(newProd);
    }

    setProductModalOpen(false);
    setEditingProduct(null);
  };

  const renderDashboard = () => (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="flex items-center gap-4 border-l-4 border-l-indigo-500">
          <div className="p-3 rounded-full bg-indigo-50 text-indigo-600"><DollarSign size={28} /></div>
          <div>
            <p className="text-sm text-slate-500">Total Revenue</p>
            <p className="text-2xl font-bold">{store.currency} {analytics.totalRevenue.toLocaleString()}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 border-l-4 border-l-green-500">
          <div className="p-3 rounded-full bg-green-50 text-green-600"><Package size={28} /></div>
          <div>
            <p className="text-sm text-slate-500">Products</p>
            <p className="text-2xl font-bold">{analytics.totalProducts}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 border-l-4 border-l-orange-500">
          <div className="p-3 rounded-full bg-orange-50 text-orange-600"><AlertTriangle size={28} /></div>
          <div>
            <p className="text-sm text-slate-500">Low Stock</p>
            <p className="text-2xl font-bold text-orange-600">{analytics.lowStockProducts}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 border-l-4 border-l-purple-500">
          <div className="p-3 rounded-full bg-purple-50 text-purple-600"><Tag size={28} /></div>
          <div>
            <p className="text-sm text-slate-500">Categories</p>
            <p className="text-2xl font-bold">{analytics.totalCategories}</p>
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Revenue Trend (Last 14 Days)">
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.revenueChartData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => `${store.currency} ${value.toLocaleString()}`} />
                <Area type="monotone" dataKey="sales" stroke="#6366f1" strokeWidth={3} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Products by Category">
          <div className="h-72 w-full flex items-center justify-center">
            {analytics.categoryData.length === 0 ? (
              <p className="text-slate-400">No products yet</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {analytics.categoryData.map((entry, i) => (
                      <Cell key={`cell-${i}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card title="Recent Transactions">
        <div className="divide-y">
          {analytics.recentInvoices.length === 0 ? (
            <p className="text-center py-8 text-slate-400">No transactions yet</p>
          ) : (
            analytics.recentInvoices.map(inv => (
              <div key={inv.id} className="py-4 flex justify-between items-center">
                <div>
                  <p className="font-medium">#{inv.invoiceNumber}</p>
                  <p className="text-sm text-slate-500">{new Date(inv.date).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-indigo-600">{store.currency} {inv.grandTotal.toFixed(2)}</p>
                  <Badge color="blue">{inv.paymentMethod}</Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );

  const renderProducts = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold">Products</h3>
        <Button onClick={() => openProductModal()} className="flex items-center gap-2">
          <Plus size={18} /> Add Product
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {products.map(product => {
          const category = categories.find(c => c.id === product.categoryId);
          const isLowStock = product.stockQty <= (category?.lowStockThreshold || 10);

          return (
            <Card key={product.id} className={`${isLowStock ? 'ring-2 ring-red-300' : ''}`}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-semibold text-lg">{product.name}</h4>
                  <p className="text-sm text-slate-500">{category?.name || 'Uncategorized'}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openProductModal(product)} className="p-2 hover:bg-slate-100 rounded">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => onDeleteProduct(product.id)} className="p-2 hover:bg-red-50 rounded text-red-600">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Price</span>
                  <span className="font-bold text-indigo-600">{store.currency} {product.price.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Stock</span>
                  <span className={`font-bold ${isLowStock ? 'text-red-600' : 'text-green-600'}`}>
                    {product.stockQty} {isLowStock && <AlertTriangle className="inline ml-1" size={14} />}
                  </span>
                </div>
                {product.sku && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">SKU</span>
                    <code className="text-xs bg-slate-100 px-2 py-1 rounded">{product.sku}</code>
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-4">
                <Button size="sm" variant="secondary" onClick={() => onUpdateProductStock(product.id, 1)} className="flex-1">
                  +1
                </Button>
                <Button size="sm" variant="secondary" onClick={() => onUpdateProductStock(product.id, -1)} disabled={product.stockQty <= 0} className="flex-1">
                  -1
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );

  const renderCategories = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold">Categories</h3>
        <Button onClick={() => openCategoryModal()} className="flex items-center gap-2">
          <Plus size={18} /> Add Category
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map(category => {
          const count = products.filter(p => p.categoryId === category.id).length;
          return (
            <Card key={category.id}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="font-semibold text-lg">{category.name}</h4>
                  <p className="text-sm text-slate-500">{count} products</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openCategoryModal(category)} className="p-2 hover:bg-slate-100 rounded">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => onDeleteCategory(category.id)} className="p-2 hover:bg-red-50 rounded text-red-600">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="text-sm space-y-2">
                <div className="flex justify-between"><span className="text-slate-600">GST</span><span>{category.defaultGST}%</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Discount</span><span>{category.defaultDiscount || 0}%</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Low Stock Alert</span><span>{category.lowStockThreshold || 10}</span></div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'DASHBOARD': return renderDashboard();
      case 'PRODUCTS': return renderProducts();
      case 'CATEGORIES': return renderCategories();
      case 'EXPENSES': return <Expenses store={store} />;
      case 'FINANCIAL': return <FinancialReports store={store} />;
      case 'PARTNERSHIPS': return <Partnerships store={store} />;
      case 'SETTINGS': return (
        <Card>
          <Button onClick={() => setSettingsModalOpen(true)} className="flex items-center gap-2">
            <Settings size={18} /> Edit Store Settings
          </Button>
        </Card>
      );
      default: return renderDashboard();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{store.name}</h1>
            <p className="text-slate-500">Manage your store inventory, sales & settings</p>
          </div>
        </div>

        <Tabs
          tabs={[
            { id: 'DASHBOARD', label: 'Dashboard', icon: BarChart3 },
            { id: 'PRODUCTS', label: 'Products', icon: Package },
            { id: 'CATEGORIES', label: 'Categories', icon: Tag },
            { id: 'PARTNERSHIPS', label: 'Partners', icon: Users },
            { id: 'EXPENSES', label: 'Expenses', icon: DollarSign },
            { id: 'FINANCIAL', label: 'Financial', icon: DollarSign },
            { id: 'SETTINGS', label: 'Settings', icon: Settings },
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {renderContent()}

        {/* Category Modal */}
        <Modal isOpen={isCategoryModalOpen} onClose={() => setCategoryModalOpen(false)} title={editingCategory ? 'Edit Category' : 'New Category'}>
          <div className="space-y-4">
            <Input label="Name" value={currentCategory.name || ''} onChange={e => setCurrentCategory({ ...currentCategory, name: e.target.value })} placeholder="Beverages" required />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Default GST (%)" type="number" value={currentCategory.defaultGST || 0} onChange={e => setCurrentCategory({ ...currentCategory, defaultGST: +e.target.value })} />
              <Input label="Default Discount (%)" type="number" value={currentCategory.defaultDiscount || 0} onChange={e => setCurrentCategory({ ...currentCategory, defaultDiscount: +e.target.value })} />
            </div>
            <Input label="Low Stock Alert" type="number" value={currentCategory.lowStockThreshold || 10} onChange={e => setCurrentCategory({ ...currentCategory, lowStockThreshold: +e.target.value })} />
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="secondary" onClick={() => setCategoryModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveCategory}>{editingCategory ? 'Update' : 'Create'}</Button>
            </div>
          </div>
        </Modal>

        {/* Product Modal */}
        <Modal isOpen={isProductModalOpen} onClose={() => setProductModalOpen(false)} title={editingProduct ? 'Edit Product' : 'New Product'}>
          <div className="space-y-4">
            <Input label="Product Name" value={currentProduct.name || ''} onChange={e => setCurrentProduct({ ...currentProduct, name: e.target.value })} required />
            <Select label="Category" value={currentProduct.categoryId || ''} onChange={e => setCurrentProduct({ ...currentProduct, categoryId: e.target.value })}>
              <option value="">Select category</option>
              {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </Select>
            <div className="grid grid-cols-2 gap-4">
              <Input label={`Price (${store.currency})`} type="number" step="0.01" value={currentProduct.price || 0} onChange={e => setCurrentProduct({ ...currentProduct, price: +e.target.value })} />
              <Input label="Stock" type="number" value={currentProduct.stockQty || 0} onChange={e => setCurrentProduct({ ...currentProduct, stockQty: +e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label={`Cost Price (${store.currency})`} type="number" step="0.01" value={currentProduct.costPrice || 0} onChange={e => setCurrentProduct({ ...currentProduct, costPrice: +e.target.value })} />
              <Input label="SKU (optional)" value={currentProduct.sku || ''} onChange={e => setCurrentProduct({ ...currentProduct, sku: e.target.value })} />
            </div>
            <Input label="Image URL (optional)" value={currentProduct.imageUrl || ''} onChange={e => setCurrentProduct({ ...currentProduct, imageUrl: e.target.value })} />
            <Input label="Tax Override (%)" type="number" placeholder="Use category default" value={currentProduct.taxOverride ?? ''} onChange={e => setCurrentProduct({ ...currentProduct, taxOverride: e.target.value ? +e.target.value : undefined })} />
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="secondary" onClick={() => setProductModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveProduct}>{editingProduct ? 'Update' : 'Create'}</Button>
            </div>
          </div>
        </Modal>
        {/* Store Settings Modal */}
        <Modal
          isOpen={isSettingsModalOpen}
          onClose={() => setSettingsModalOpen(false)}
          title="Edit Store Settings"
        >
          <div className="space-y-5">
            <Input
              label="Store Name"
              value={store.name}
              onChange={(e) => onUpdateStore({ ...store, name: e.target.value })}
              placeholder="My Awesome Store"
            />

            <Select
              label="Currency"
              value={store.currency}
              onChange={(e) => onUpdateStore({ ...store, currency: e.target.value })}
            >
              <option value="₹">₹ INR - Indian Rupee</option>
              <option value="$">$ USD - US Dollar</option>
              <option value="€">€ EUR - Euro</option>
              <option value="£">£ GBP - British Pound</option>
              <option value="¥">¥ JPY - Japanese Yen</option>
            </Select>

            <Input
              label="Store Address (optional)"
              value={store.address || ''}
              onChange={(e) => onUpdateStore({ ...store, address: e.target.value })}
              placeholder="123 Main St, Mumbai"
            />

            <Input
              label="Contact Phone (optional)"
              value={store.phone || ''}
              onChange={(e) => onUpdateStore({ ...store, phone: e.target.value })}
              placeholder="+91 98765 43210"
            />

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="secondary" onClick={() => setSettingsModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setSettingsModalOpen(false)}>
                Save Changes
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
};