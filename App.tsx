import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { SuperAdmin } from './pages/SuperAdmin';
import { StoreAdmin } from './pages/StoreAdmin';
import { POS } from './pages/POS';
import { Profile } from './pages/Profile';
import { Store, Category, Product, Invoice, ViewMode, User, GlobalSettings } from './types';
import { INITIAL_STORES, INITIAL_CATEGORIES, INITIAL_PRODUCTS, INITIAL_INVOICES, INITIAL_GLOBAL_SETTINGS } from './constants';
import { useLocalStorage } from './hooks/useLocalStorage';
import { storesApi } from './src/api/stores';
import { authApi } from './src/api/auth';
import { categoriesApi } from './src/api/categories';
import { productsApi } from './src/api/products';
import { invoicesApi } from './src/api/invoices';


const App = () => {
  // Global Settings
  const [globalSettings, setGlobalSettings] = useLocalStorage<GlobalSettings>('unibill_settings', INITIAL_GLOBAL_SETTINGS);

  // Global State with Persistence
  const [stores, setStores] = useLocalStorage<Store[]>('unibill_stores', INITIAL_STORES);
  const [categories, setCategories] = useLocalStorage<Category[]>('unibill_categories', INITIAL_CATEGORIES);
  const [products, setProducts] = useLocalStorage<Product[]>('unibill_products', INITIAL_PRODUCTS);

  // Invoices - Logic depends on Data Source
  const [invoices, setInvoices] = useState<Invoice[]>(INITIAL_INVOICES);

  // Auth State
  const [currentUser, setCurrentUser] = useLocalStorage<User | null>('unibill_user', null);

  // App View State (Persisted)
  const [currentView, setCurrentView] = useLocalStorage<ViewMode>('unibill_current_view', 'SUPER_ADMIN');
  const [activeStoreId, setActiveStoreId] = useLocalStorage<string | null>('unibill_active_store_id', null);

  // Test mode for Data Connect testing
  const [showDataConnectTest, setShowDataConnectTest] = useState(false);


  // Global guard to prevent double-fetching on HMR or remounts
  const dataLoadedRef = React.useRef(false);

  // --- Data Synchronization Logic ---
  const refreshData = React.useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      // Load stores, categories, products, invoices from API
      const [storesData, categoriesData, productsData, invoicesData] = await Promise.all([
        storesApi.getAll(),
        categoriesApi.getAll(),
        productsApi.getAll(),
        invoicesApi.getAll()
      ]);

      setStores(storesData);
      setCategories(categoriesData);
      setProducts(productsData);
      setInvoices(invoicesData);
    } catch (error) {
      console.error('Failed to load data from API:', error);
    }
  }, []); // Empty dependencies to ensure stability and prevent loop

  useEffect(() => {
    // Only fetch if not already loaded (guard against remounts)
    if (dataLoadedRef.current) return;
    dataLoadedRef.current = true;

    refreshData();
  }, []); // Run once on mount


  // Sync activeStoreId with User's storeId if applicable
  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'SUPER_ADMIN') {
        // If super admin is in a store view but no store is active, redirect to dashboard
        if (!activeStoreId && (currentView === 'STORE_ADMIN' || currentView === 'POS')) {
          setCurrentView('SUPER_ADMIN');
        }
      } else if (currentUser.storeId) {
        // Enforce store ID for non-super users
        if (activeStoreId !== currentUser.storeId) {
          setActiveStoreId(currentUser.storeId);
        }

        if (currentUser.role === 'STORE_ADMIN' && currentView === 'SUPER_ADMIN') {
          setCurrentView('STORE_ADMIN');
        } else if (currentUser.role === 'CASHIER' && currentView !== 'PROFILE' && currentView !== 'POS') {
          setCurrentView('POS');
        }
      }
    }
  }, [currentUser, activeStoreId, currentView]);


  const activeStore = stores.find(s => s.id === activeStoreId);

  // Helper Accessors
  const storeCategories = categories.filter(c => c.storeId === activeStoreId);
  const storeProducts = products.filter(p => p.storeId === activeStoreId);
  const storeInvoices = invoices.filter(i => i.storeId === activeStoreId);

  // --- Auth Handlers ---
  const handleLogin = (user: User) => {
    setCurrentUser(user);
    if (user.role === 'SUPER_ADMIN') {
      setCurrentView('SUPER_ADMIN');
      setActiveStoreId(null);
    } else if (user.role === 'STORE_ADMIN') {
      setCurrentView('STORE_ADMIN');
      setActiveStoreId(user.storeId || null);
    } else if (user.role === 'CASHIER') {
      setCurrentView('POS');
      setActiveStoreId(user.storeId || null);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveStoreId(null);
    setCurrentView('SUPER_ADMIN');
  };

  const handleUpdateUser = async (updatedUser: User) => {
    // Persist profile updates to backend when using API
    try {
      const saved = await authApi.updateProfile({
        username: updatedUser.username,
        displayName: (updatedUser as any).displayName,
        email: updatedUser.email,
        phoneNumber: (updatedUser as any).phoneNumber,
        imageUrl: (updatedUser as any).imageUrl
      } as any);
      setCurrentUser(saved);
      return saved;
    } catch (err) {
      console.error('Failed to update profile on server:', err);
      alert('Failed to update profile on server. See console for details.');
    }
  };

  // --- CRUD Handlers ---

  const handleUpdateGlobalSettings = (newSettings: GlobalSettings) => {
    setGlobalSettings(newSettings);
    alert(`Data Source switched to: ${newSettings.dataSource}`);
  };

  // Store
  const handleAddStore = (store: Store) => {
    setStores([...stores, store]);
  };
  const handleUpdateStore = async (updatedStore: Store) => {
    // Persist to MySQL API when configured, otherwise update local state
    if (globalSettings?.dataSource === 'MYSQL_API') {
      try {
        await storesApi.update(updatedStore.id, updatedStore);
        setStores(stores.map(s => s.id === updatedStore.id ? updatedStore : s));
      } catch (err) {
        console.error('Failed to update store on server:', err);
        alert('Failed to update store on server. Changes not saved. See console for details.');
        return;
      }
    } else {
      setStores(stores.map(s => s.id === updatedStore.id ? updatedStore : s));
    }
  };
  // --- Category CRUD with Backend Sync ---
  const handleAddCategory = async (category: Category) => {
    try {
      const result = await categoriesApi.create(category);
      // Backend returns { message, categoryId }, but we already have full object
      // So we use the local one (it has the temp ID we generated)
      setCategories(prev => [...prev, category]);
      console.log('Category created:', result);
    } catch (error: any) {
      console.error('Failed to create category:', error);
      alert('Failed to save category to server: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleUpdateCategory = async (updatedCategory: Category) => {
    try {
      await categoriesApi.update(updatedCategory.id, updatedCategory);
      setCategories(prev => prev.map(c => c.id === updatedCategory.id ? updatedCategory : c));
    } catch (error: any) {
      console.error('Failed to update category:', error);
      alert('Failed to update category: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    const hasProducts = products.some(p => p.categoryId === categoryId);
    if (hasProducts) {
      alert("Cannot delete category with products. Move or delete products first.");
      return;
    }
    if (!confirm("Delete this category permanently?")) return;

    try {
      await categoriesApi.delete(categoryId);
      setCategories(prev => prev.filter(c => c.id !== categoryId));
    } catch (error: any) {
      console.error('Failed to delete category:', error);
      alert('Could not delete category: ' + (error.response?.data?.error || error.message));
    }
  };

  // --- Product CRUD with Backend Sync ---
  const handleAddProduct = async (product: Product) => {
    try {
      await productsApi.create(product);
      setProducts(prev => [...prev, product]);
    } catch (error: any) {
      console.error('Failed to create product:', error);
      alert('Failed to save product: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleUpdateProduct = async (updatedProduct: Product) => {
    try {
      await productsApi.update(updatedProduct.id, updatedProduct);
      setProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
    } catch (error: any) {
      console.error('Failed to update product:', error);
      alert('Update failed: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Delete this product permanently?')) return;
    try {
      await productsApi.delete(productId);
      setProducts(prev => prev.filter(p => p.id !== productId));
    } catch (error: any) {
      console.error('Failed to delete product:', error);
      alert('Could not delete product: ' + (error.response?.data?.error || error.message));
    }
  };

  // Bonus: Sync stock changes too (Recommended)
  const handleUpdateProductStock = async (id: string, delta: number) => {
    setProducts(prev => prev.map(p =>
      p.id === id ? { ...p, stockQty: p.stockQty + delta } : p
    ));

    try {
      await productsApi.updateStock(id, delta);
    } catch (error: any) {
      console.error('Failed to sync stock change:', error);
      alert('Stock updated locally but failed to sync with server.');
      // Optionally revert local change here
    }
  };

  // Local only update for POS to avoid double deduction (Backend deducts on Invoice create)
  const handleLocalProductStockUpdate = (id: string, delta: number) => {
    setProducts(prev => prev.map(p =>
      p.id === id ? { ...p, stockQty: p.stockQty + delta } : p
    ));
  };

  // Invoice
  const handleSaveInvoice = async (invoice: Invoice) => {
    // Optimistic UI Update
    const newInvoice = { ...invoice, synced: false };
    setInvoices(prev => [newInvoice, ...prev]);

    // Save to MySQL API
    try {
      await invoicesApi.create(invoice);
      // Mark as synced
      setInvoices(prev => prev.map(inv => inv.id === invoice.id ? { ...inv, synced: true } : inv));
      console.log('✅ Invoice saved successfully');
    } catch (error) {
      console.error('❌ Failed to save invoice:', error);
      // Optionally show error to user
    }
  };

  // Navigation Handlers
  const handleViewChange = (view: ViewMode) => {
    // Permission Check
    if (currentUser?.role === 'CASHIER' && view !== 'POS' && view !== 'PROFILE') {
      alert("Access Denied: Cashiers can only access POS.");
      return;
    }
    if (currentUser?.role === 'STORE_ADMIN' && view === 'SUPER_ADMIN') {
      alert("Access Denied: Restricted to Store Admin.");
      return;
    }

    if ((view === 'STORE_ADMIN' || view === 'POS') && !activeStoreId) {
      alert("Please select a store from Super Admin dashboard first.");
      setCurrentView('SUPER_ADMIN');
      return;
    }
    setCurrentView(view);
  };

  const handleStoreSelect = (storeId: string) => {
    setActiveStoreId(storeId);
    setCurrentView('STORE_ADMIN');
  };

  // Render Page Content based on ViewMode
  const renderContent = () => {
    if (!currentUser) return null;

    if (currentView === 'PROFILE') {
      return <Profile user={currentUser} onUpdateUser={handleUpdateUser} />;
    }

    switch (currentView) {
      case 'SUPER_ADMIN':
        return (
          <SuperAdmin
            stores={stores}
            invoices={invoices}
            settings={globalSettings}
            onAddStore={handleAddStore}
            onUpdateStore={handleUpdateStore}
            onSelectStore={handleStoreSelect}
            onUpdateSettings={handleUpdateGlobalSettings}
          />
        );
      case 'STORE_ADMIN':
        return activeStore ? (
          <StoreAdmin
            store={activeStore}
            categories={storeCategories}
            products={storeProducts}
            invoices={storeInvoices}
            onAddCategory={handleAddCategory}
            onUpdateCategory={handleUpdateCategory}
            onDeleteCategory={handleDeleteCategory}
            onAddProduct={handleAddProduct}
            onUpdateProduct={handleUpdateProduct}
            onDeleteProduct={handleDeleteProduct}
            onUpdateProductStock={handleUpdateProductStock}
            onUpdateStore={handleUpdateStore}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-500">Store not found or not selected.</div>
        );
      case 'POS':
        return activeStore ? (
          <POS
            store={activeStore}
            categories={storeCategories}
            products={storeProducts}
            invoices={storeInvoices}
            onSaveInvoice={handleSaveInvoice}
            onUpdateProductStock={handleLocalProductStockUpdate}
            onRefreshData={refreshData}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-500">Store not found or not selected.</div>
        );
      default:
        return <div>Select a view</div>;
    }
  };

  if (!currentUser) {
    return <Login stores={stores} onLogin={handleLogin} />;
  }

  return (
    <Layout
      currentView={currentView}
      onChangeView={handleViewChange}
      activeStoreName={activeStore?.name}
      user={currentUser}
      onLogout={handleLogout}
    >
      <div className="print-only">
        {/* Print content is handled via specific components triggering window.print() */}
      </div>
      <div className="no-print h-full">
        {renderContent()}
      </div>
    </Layout>
  );
};

export default App;