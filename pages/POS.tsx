import React, { useState, useMemo, useEffect } from 'react';
import { Store, Product, Category, CartItem, Invoice } from '../types';
import { Button, Input, Modal, Badge, Card } from '../components/UI';
import { Search, Trash2, Printer, CreditCard, Banknote, QrCode, History, Calculator, Clock, CheckCircle } from 'lucide-react';
import { InvoicePrint } from './InvoicePrint';

interface POSProps {
  store: Store;
  products: Product[];
  categories: Category[];
  invoices: Invoice[];
  onSaveInvoice: (invoice: Invoice) => void;
  onUpdateProductStock: (id: string, qty: number) => void;
  onRefreshData?: () => void;
}

export const POS: React.FC<POSProps> = ({ store, products, categories, invoices, onSaveInvoice, onUpdateProductStock, onRefreshData }) => {
  const [activeView, setActiveView] = useState<'REGISTER' | 'HISTORY'>('REGISTER');

  useEffect(() => {
    if (onRefreshData) {
      onRefreshData();
    }
  }, [onRefreshData]);

  // Register State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [paymentMode, setPaymentMode] = useState<Invoice['paymentMethod']>('CASH');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [lastInvoice, setLastInvoice] = useState<Invoice | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // History State
  const [historySearch, setHistorySearch] = useState('');
  const [selectedHistoryInvoice, setSelectedHistoryInvoice] = useState<Invoice | null>(null);

  // Filter Products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat = selectedCategory === 'all' || p.categoryId === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [products, searchQuery, selectedCategory]);

  // Filter History
  const filteredHistory = useMemo(() => {
    return invoices
      .filter(inv => inv.invoiceNumber.toLowerCase().includes(historySearch.toLowerCase()))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [invoices, historySearch]);

  const addToCart = (product: Product) => {
    if (product.stockQty <= 0) {
      alert(`Item Out of Stock: ${product.name}`);
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);

      // Calculate Defaults
      const category = categories.find(c => c.id === product.categoryId);
      const appliedTaxPercent = product.taxOverride !== null && product.taxOverride !== undefined
        ? product.taxOverride
        : (category?.defaultGST || 0);

      // Discount Logic: Store Global > Category Default > 0
      // If store has global discount, use it. Else use category default.
      const defaultDiscount = store.globalDiscount || category?.defaultDiscount || 0;

      if (existing) {
        // Recalculate line total with new qty, keeping existing manual discount if any (implicit in existing item)
        // Actually, let's keep the logic simple: update qty, recalc total based on current item state
        if (existing.quantity + 1 > product.stockQty) {
          alert(`Insufficient stock! Only ${product.stockQty} items available.`);
          return prev;
        }
        const newQty = existing.quantity + 1;

        // Math: Price * Qty - Discount + Tax
        // Discount Amount = (Price * Discount% / 100)
        // Tax Amount = (Price - DiscountAmt) * Tax% / 100
        const basePrice = existing.price;
        const discountAmt = basePrice * (existing.appliedDiscountPercent / 100);
        const taxableAmt = basePrice - discountAmt;
        const taxAmt = taxableAmt * (existing.appliedTaxPercent / 100);
        const unitFinal = taxableAmt + taxAmt;

        return prev.map(item => item.id === product.id
          ? { ...item, quantity: newQty, lineTotal: unitFinal * newQty }
          : item
        );
      }

      // New Item
      const discountAmt = product.price * (defaultDiscount / 100);
      const taxableAmt = product.price - discountAmt;
      const taxAmt = taxableAmt * (appliedTaxPercent / 100);
      const unitFinal = taxableAmt + taxAmt;

      return [...prev, {
        ...product,
        quantity: 1,
        appliedTaxPercent,
        appliedDiscountPercent: defaultDiscount,
        lineTotal: unitFinal
      }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        // Look up latest stock info
        const product = products.find(p => p.id === id);
        const currentStock = product ? product.stockQty : item.stockQty; // Fallback if not found (rare)

        const newQty = Math.max(1, item.quantity + delta);

        if (delta > 0 && newQty > currentStock) {
          alert(`Insufficient stock! Only ${currentStock} items available.`);
          return item;
        }
        // Recalculate
        const basePrice = item.price;
        const discountAmt = basePrice * (item.appliedDiscountPercent / 100);
        const taxableAmt = basePrice - discountAmt;
        const taxAmt = taxableAmt * (item.appliedTaxPercent / 100);
        const unitFinal = taxableAmt + taxAmt;

        return { ...item, quantity: newQty, lineTotal: unitFinal * newQty };
      }
      return item;
    }));
  };

  const updateDiscount = (id: string, newDiscountPercent: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const validDisc = Math.min(100, Math.max(0, newDiscountPercent));

        const basePrice = item.price;
        const discountAmt = basePrice * (validDisc / 100);
        const taxableAmt = basePrice - discountAmt;
        const taxAmt = taxableAmt * (item.appliedTaxPercent / 100);
        const unitFinal = taxableAmt + taxAmt;

        return { ...item, appliedDiscountPercent: validDisc, lineTotal: unitFinal * item.quantity };
      }
      return item;
    }));
  };

  // Totals Calculation
  const { subtotal, taxTotal, discountTotal, grandTotal } = useMemo(() => {
    let sub = 0;
    let tax = 0;
    let disc = 0;

    cart.forEach(item => {
      const baseTotal = item.price * item.quantity;
      const itemDisc = baseTotal * (item.appliedDiscountPercent / 100);
      const taxable = baseTotal - itemDisc;
      const itemTax = taxable * (item.appliedTaxPercent / 100);

      sub += baseTotal;
      disc += itemDisc;
      tax += itemTax;
    });
    return { subtotal: sub, taxTotal: tax, discountTotal: disc, grandTotal: sub - disc + tax };
  }, [cart]);

  const handleCheckout = () => {
    if (cart.length === 0) return;
    setShowPaymentModal(true);
  };
  const finalizePayment = async () => {
    if (cart.length === 0) return;
    if (isSubmitting) return; // Prevent double click

    setIsSubmitting(true);

    const formatMySQLDate = (date: Date) =>
      date.toISOString().slice(0, 19).replace('T', ' ');

    const payload = {
      storeId: store.id,
      date: formatMySQLDate(new Date()),
      items: cart.map(item => ({
        productId: item.id,           // ← this is productId
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        appliedTaxPercent: item.appliedTaxPercent,
        appliedDiscountPercent: item.appliedDiscountPercent,
        lineTotal: Number(item.lineTotal.toFixed(2))
      })),
      subtotal: Number(subtotal.toFixed(2)),
      taxTotal: Number(taxTotal.toFixed(2)),
      discountTotal: Number(discountTotal.toFixed(2)),
      grandTotal: Number(grandTotal.toFixed(2)),
      paymentMethod: paymentMode
    };

    try {
      const token = localStorage.getItem('auth_token');  // ← THIS IS THE KEY

      const response = await fetch('http://localhost:3001/api/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`  // ← ADD THIS HEADER
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Invoice save failed:', errorData);
        alert('Failed: ' + (errorData.error || 'Unknown error'));
        return;
      }

      const result = await response.json();
      const fullInvoice: Invoice = {
        id: result.invoiceId,
        invoiceNumber: result.invoiceNumber,
        ...payload,
        items: payload.items.map((it, i) => ({ ...it, id: `item_${i}` })),
        synced: true
      };

      setLastInvoice(fullInvoice);
      onSaveInvoice(fullInvoice);

      // Deduct stock locally
      cart.forEach(item => onUpdateProductStock(item.id, -item.quantity));

      setCart([]);
      setShowPaymentModal(false);
      setShowReceipt(true);

    } catch (error) {
      console.error('Network error:', error);
      alert('Connection failed. Check if server is running.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Generate UPI String
  const upiString = useMemo(() => {
    // Resolve Active UPI ID
    const activeUpi = store.activeUpiIdType === 'SECONDARY' ? store.secondaryUpiId : store.primaryUpiId;

    if (!activeUpi) return '';
    return `upi://pay?pa=${activeUpi}&pn=${encodeURIComponent(store.name)}&am=${grandTotal}&tn=InvoicePayment`;
  }, [store, grandTotal]);

  const qrUrl = upiString
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiString)}`
    : null;

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col -m-4 md:-m-8">

      {/* POS Top Navigation */}
      <div className="bg-white border-b border-slate-200 px-8 py-3 flex items-center gap-4 shadow-sm z-10">
        <button
          onClick={() => setActiveView('REGISTER')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === 'REGISTER' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
            }`}
        >
          <Calculator size={18} /> Register
        </button>
        <button
          onClick={() => setActiveView('HISTORY')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === 'HISTORY' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
            }`}
        >
          <History size={18} /> Sales History
        </button>
      </div>

      <div className="flex-1 overflow-hidden p-4 md:p-8 bg-slate-100">

        {/* --- REGISTER VIEW --- */}
        {activeView === 'REGISTER' && (
          <div className="flex flex-col md:flex-row h-full gap-4 md:gap-6">
            {/* Left: Product Grid */}
            <div className="flex-1 flex flex-col gap-4 overflow-hidden">
              {/* Search & Filter */}
              <div className="flex gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                  <Input
                    placeholder="Scan Barcode or Search Product..."
                    className="pl-10 w-full"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
                <select
                  className="border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                >
                  <option value="all">All Categories</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Product List */}
              <div className="flex-1 overflow-y-auto grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 content-start">
                {filteredProducts.map(product => {
                  const cat = categories.find(c => c.id === product.categoryId);
                  const lowStockLimit = cat?.lowStockThreshold ?? 5;
                  const isLowStock = product.stockQty <= lowStockLimit;

                  return (
                    <div
                      key={product.id}
                      onClick={() => addToCart(product)}
                      className={`
                            bg-white p-4 rounded-xl border border-slate-200 cursor-pointer hover:shadow-md transition-all flex flex-col justify-between
                            ${product.stockQty <= 0 ? 'opacity-50 grayscale pointer-events-none' : ''}
                            `}
                    >
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <Badge color="blue">{cat?.name.slice(0, 10)}</Badge>
                          {isLowStock && <span className="text-xs font-bold text-red-600">Low Stock</span>}
                        </div>
                        {product.imageUrl && (
                          <div className="h-24 w-full mb-2 bg-slate-50 rounded flex items-center justify-center overflow-hidden">
                            <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                          </div>
                        )}
                        <h3 className="font-semibold text-slate-800 line-clamp-2">{product.name}</h3>
                        <div className="text-xs text-slate-500 mt-1">SKU: {product.sku}</div>
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        <span className="font-bold text-lg text-indigo-600">{store.currency} {product.price}</span>
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-indigo-600 hover:text-white transition-colors">
                          +
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Right: Cart Panel */}
            <div className="w-full md:w-96 bg-white border border-slate-200 rounded-xl shadow-lg flex flex-col h-full">
              <div className="p-4 border-b border-slate-100">
                <h2 className="text-lg font-bold text-slate-800">Current Order</h2>
                <div className="text-xs text-slate-400">Order #{Date.now().toString().slice(-6)}</div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400">
                    <div className="bg-slate-50 p-6 rounded-full mb-4">
                      <ShoppingCartIcon size={48} />
                    </div>
                    <p>Cart is empty</p>
                    <p className="text-sm">Scan items to begin</p>
                  </div>
                ) : (
                  cart.map(item => (
                    <div key={item.id} className="flex gap-3 bg-slate-50 p-2 rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium text-slate-800">{item.name}</div>
                        <div className="text-xs text-slate-500 flex flex-col gap-1 mt-1">
                          <span>{store.currency} {item.price} x {item.quantity}</span>
                          <div className="flex items-center gap-2">
                            <span>Disc %:</span>
                            <input
                              type="number"
                              className="w-10 p-0.5 text-center text-xs border rounded bg-white"
                              value={item.appliedDiscountPercent}
                              onChange={(e) => updateDiscount(item.id, Number(e.target.value))}
                              min="0" max="100"
                            />
                            <span>Tax: {item.appliedTaxPercent}%</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <div className="font-bold text-slate-800">{store.currency} {item.lineTotal.toFixed(2)}</div>
                        <div className="flex items-center gap-2 bg-white rounded-lg p-1 border">
                          <button onClick={() => updateQuantity(item.id, -1)} className="w-5 h-5 flex items-center justify-center hover:bg-slate-100 rounded text-slate-600">-</button>
                          <span className="text-xs font-medium w-4 text-center">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, 1)} className="w-5 h-5 flex items-center justify-center hover:bg-slate-100 rounded text-slate-600">+</button>
                        </div>
                        <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-600 p-1 text-xs mt-1">
                          Remove
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-200">
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>Subtotal</span>
                    <span>{store.currency} {subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount</span>
                    <span>-{store.currency} {discountTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>Tax</span>
                    <span>{store.currency} {taxTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xl font-bold text-slate-800 pt-2 border-t border-slate-200">
                    <span>Total</span>
                    <span>{store.currency} {grandTotal.toFixed(2)}</span>
                  </div>
                </div>
                <Button
                  className="w-full py-3 text-lg"
                  onClick={handleCheckout}
                  disabled={cart.length === 0}
                >
                  Charge {store.currency} {grandTotal.toFixed(2)}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* --- HISTORY VIEW --- */}
        {activeView === 'HISTORY' && (
          <div className="h-full flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">Sales History</h2>
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                <Input
                  placeholder="Search Invoice Number..."
                  className="pl-10 w-full"
                  value={historySearch}
                  onChange={e => setHistorySearch(e.target.value)}
                />
              </div>
            </div>

            <Card className="flex-1 overflow-hidden p-0 flex flex-col">
              <div className="overflow-auto flex-1">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-600 font-medium border-b sticky top-0">
                    <tr>
                      <th className="p-4">Invoice #</th>
                      <th className="p-4">Time</th>
                      <th className="p-4">Items</th>
                      <th className="p-4">Total</th>
                      <th className="p-4">Discount</th>
                      <th className="p-4">Payment</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredHistory.map(inv => (
                      <tr key={inv.id} className="hover:bg-slate-50">
                        <td className="p-4 font-mono text-sm font-bold text-slate-700">{inv.invoiceNumber}</td>
                        <td className="p-4 text-sm text-slate-600">{new Date(inv.date).toLocaleString()}</td>
                        <td className="p-4">{inv.items.length}</td>
                        <td className="p-4 font-bold">{store.currency} {inv.grandTotal.toFixed(2)}</td>
                        <td className="p-4 text-green-600 font-medium">
                          {inv.discountTotal > 0 ? `-${store.currency} ${inv.discountTotal.toFixed(2)}` : '-'}
                        </td>
                        <td className="p-4"><Badge color="blue">{inv.paymentMethod}</Badge></td>
                        <td className="p-4">
                          {inv.synced ? (
                            <div className="flex items-center gap-1 text-green-600 text-xs font-medium">
                              <CheckCircle size={14} /> Synced
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-amber-600 text-xs font-medium">
                              <Clock size={14} /> Pending
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <Button variant="secondary" className="text-xs flex items-center gap-1 ml-auto" onClick={() => setSelectedHistoryInvoice(inv)}>
                            <Printer size={14} /> Reprint
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {filteredHistory.length === 0 && (
                      <tr><td colSpan={8} className="p-8 text-center text-slate-400">No transactions found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      <Modal isOpen={showPaymentModal} onClose={() => setShowPaymentModal(false)} title="Select Payment Method">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <PaymentOption
            icon={Banknote}
            label="Cash"
            selected={paymentMode === 'CASH'}
            onClick={() => setPaymentMode('CASH')}
          />
          <PaymentOption
            icon={CreditCard}
            label="Card"
            selected={paymentMode === 'CARD'}
            onClick={() => setPaymentMode('CARD')}
          />
          <PaymentOption
            icon={QrCode}
            label="UPI / QR"
            selected={paymentMode === 'UPI'}
            onClick={() => setPaymentMode('UPI')}
          />
        </div>

        {paymentMode === 'UPI' && (
          <div className="bg-slate-100 p-4 rounded-lg flex flex-col items-center justify-center mb-6">
            <div className="w-48 h-48 bg-white p-2 rounded-lg mb-2 flex items-center justify-center overflow-hidden">
              {qrUrl ? (
                <img src={qrUrl} alt="UPI QR" className="w-full h-full object-contain" />
              ) : (
                <div className="text-center text-slate-400 text-sm p-4">
                  UPI ID not configured or active for this store.
                </div>
              )}
            </div>
            {qrUrl && (
              <div className="text-center">
                <p className="text-sm font-bold text-slate-800">Scan to pay {store.currency} {grandTotal.toFixed(2)}</p>
                <p className="text-xs text-slate-500 mt-1">Paying to: {store.activeUpiIdType === 'SECONDARY' ? store.secondaryUpiId : store.primaryUpiId}</p>
              </div>
            )}
          </div>
        )}

        <Button className="w-full py-3" onClick={finalizePayment} variant="success" disabled={isSubmitting}>
          {isSubmitting ? 'Processing...' : 'Complete Payment'}
        </Button>
      </Modal>

      {/* Receipt Modal (For New Sale) */}
      {showReceipt && lastInvoice && (
        <Modal isOpen={showReceipt} onClose={() => setShowReceipt(false)} title="Receipt Created">
          <ReceiptContent invoice={lastInvoice} store={store} />
        </Modal>
      )}

      {/* Receipt Modal (For History) */}
      {selectedHistoryInvoice && (
        <Modal isOpen={!!selectedHistoryInvoice} onClose={() => setSelectedHistoryInvoice(null)} title="Reprint Receipt">
          <ReceiptContent invoice={selectedHistoryInvoice} store={store} />
        </Modal>
      )}

    </div>
  );
};

// Subcomponents for clearer structure

const ReceiptContent = ({ invoice, store }: { invoice: Invoice, store: Store }) => (
  <div className="flex flex-col gap-4">
    {/* Only show success message if it's a new invoice (implied context) but here generally valid */}
    <div className="bg-green-50 text-green-700 p-4 rounded-lg flex items-center gap-2 no-print">
      <div className="w-6 h-6 bg-green-200 rounded-full flex items-center justify-center">✓</div>
      <span className="font-medium">Invoice Ready</span>
    </div>

    <div className="border rounded-lg p-4 bg-slate-50 max-h-[50vh] overflow-y-auto">
      <InvoicePrint invoice={invoice} store={store} />
    </div>

    <div className="flex gap-2 no-print">
      <Button onClick={() => window.print()} className="flex-1 flex items-center justify-center gap-2">
        <Printer size={18} /> Print Thermal
      </Button>
      <Button onClick={() => window.print()} variant="secondary" className="flex-1 flex items-center justify-center gap-2">
        <Printer size={18} /> Print A4
      </Button>
    </div>
  </div>
);

const ShoppingCartIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="21" r="1" />
    <circle cx="20" cy="21" r="1" />
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
  </svg>
);

const PaymentOption = ({ icon: Icon, label, selected, onClick }: any) => (
  <button
    onClick={onClick}
    className={`
      flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all
      ${selected ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 hover:border-indigo-200 hover:bg-slate-50'}
    `}
  >
    <Icon size={32} className="mb-2" />
    <span className="font-medium">{label}</span>
  </button>
);