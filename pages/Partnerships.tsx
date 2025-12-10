import React, { useState, useEffect } from 'react';
import { Store } from '../types';
import { partnershipsApi, Partnership, Asset } from '../src/api/partnerships';
import { Card, Button, Input, Select, Badge, Modal } from '../components/UI';
import { Plus, Edit2, Trash2, Users, Briefcase, DollarSign, Calendar } from 'lucide-react';

interface PartnershipsProps {
    store: Store;
}

export const Partnerships: React.FC<PartnershipsProps> = ({ store }) => {
    const [partnerships, setPartnerships] = useState<Partnership[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form State
    const [formData, setFormData] = useState<Partial<Partnership>>({
        storeId: store.id,
        partnerName: '',
        email: '',
        phoneNumber: '',
        cashInvestment: 0,
        investmentDate: new Date().toISOString().split('T')[0],
        isActive: true,
        assets: []
    });

    const [newAsset, setNewAsset] = useState<Partial<Asset>>({
        assetName: '',
        assetValue: 0,
        assetType: 'OTHER'
    });

    useEffect(() => {
        loadPartnerships();
    }, [store.id]);

    const loadPartnerships = async () => {
        try {
            setLoading(true);
            const data = await partnershipsApi.getByStore(store.id);
            setPartnerships(data);
        } catch (error) {
            console.error('Failed to load partnerships:', error);
            alert('Failed to load partnerships');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (partnership?: Partnership) => {
        if (partnership) {
            setEditingId(partnership.id);
            setFormData({ ...partnership });
        } else {
            setEditingId(null);
            setFormData({
                storeId: store.id,
                partnerName: '',
                email: '',
                phoneNumber: '',
                cashInvestment: 0,
                investmentDate: new Date().toISOString().split('T')[0],
                isActive: true,
                assets: []
            });
        }
        setModalOpen(true);
    };

    const handleSave = async () => {
        try {
            if (!formData.partnerName || !formData.cashInvestment) {
                alert('Name and Cash Investment are required');
                return;
            }

            const payload = { ...formData, storeId: store.id };

            if (editingId) {
                await partnershipsApi.update(editingId, payload);
            } else {
                await partnershipsApi.create(payload as any);
            }

            setModalOpen(false);
            loadPartnerships();
        } catch (error) {
            console.error('Failed to save partnership:', error);
            alert('Failed to save partnership');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure? This action cannot be undone.')) return;
        try {
            await partnershipsApi.delete(id);
            loadPartnerships();
        } catch (error) {
            console.error('Failed to delete:', error);
            alert('Failed to delete partnership');
        }
    };

    const handleAddAssetToForm = () => {
        if (!newAsset.assetName || !newAsset.assetValue) return;

        // In edit mode, we might want to immediately call API, but for simplicity let's rely on the main Update
        // Actually, the API supports assetsToAdd. For valid UX, let's just push to local state and let Update handle it?
        // The current API implementation for Update expects `assetsToAdd` and `assetsToRemove` arrays effectively.
        // Simplifying: if editing, we add to a temporary list that gets mapped to `assetsToAdd`.

        // For simplicity in this v1: We just append to formData.assets.
        // Note: The backend update logic separates assetsToAdd.
        // We need to handle this discrepancy.
        // If editing, new assets need to be in `assetsToAdd`.

        const asset = { ...newAsset } as Asset;
        if (editingId) {
            // If editing, we need to handle this specially or the backend needs to be smart.
            // My backend implementation checks `assetsToAdd`.
            // Let's modify the save logic to split them or modify the backend to accept just `assets`.
            // Checking backend again... 
            // Backend `update` checks `assetsToAdd`. It ignores `assets` array for existing ones.
            // So for EDIT mode, we need to track new assets separately in UI state or map them at save time.
        }

        setFormData(prev => ({
            ...prev,
            assets: [...(prev.assets || []), asset]
        }));
        setNewAsset({ assetName: '', assetValue: 0, assetType: 'OTHER' });
    };

    // Custom Save for Assets handling
    const handleSaveWithAssets = async () => {
        try {
            if (!formData.partnerName || formData.cashInvestment === undefined) {
                alert('Name and Investment required');
                return;
            }

            if (editingId) {
                // Find assets that are NEW (don't have an ID)
                const assetsToAdd = formData.assets?.filter(a => !a.id) || [];
                // We don't support deleting assets in this simple modal yet, or editing existing assets inside the modal.

                await partnershipsApi.update(editingId, {
                    ...formData,
                    assetsToAdd
                });
            } else {
                await partnershipsApi.create(formData as any);
            }
            setModalOpen(false);
            loadPartnerships();
        } catch (e) {
            console.error(e);
            alert('Error saving');
        }
    };

    if (loading) return <div className="text-center py-10">Loading Partners...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold flex items-center gap-2"><Users size={24} /> Partnerships</h3>
                <Button onClick={() => handleOpenModal()} className="flex items-center gap-2">
                    <Plus size={18} /> Add Partner
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {partnerships.map(partner => (
                    <Card key={partner.id} className="relative overflow-hidden">
                        {!partner.isActive && <div className="absolute top-0 right-0 bg-red-500 text-white text-xs px-2 py-1">Inactive</div>}

                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h4 className="font-bold text-lg">{partner.partnerName}</h4>
                                <p className="text-sm text-slate-500">{partner.phoneNumber}</p>
                            </div>
                            <div className="flex gap-1">
                                <button onClick={() => handleOpenModal(partner)} className="p-2 hover:bg-slate-100 rounded text-slate-600"><Edit2 size={16} /></button>
                                <button onClick={() => handleDelete(partner.id)} className="p-2 hover:bg-red-50 rounded text-red-600"><Trash2 size={16} /></button>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-600">Ownership</span>
                                <span className="font-bold text-indigo-600">{partner.ownershipPercentage}%</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-600">Cash Invested</span>
                                <span className="font-medium">{store.currency} {partner.cashInvestment?.toLocaleString()}</span>
                            </div>
                            {partner.assets && partner.assets.length > 0 && (
                                <div className="bg-slate-50 p-3 rounded text-sm">
                                    <p className="font-semibold text-slate-700 mb-2">Assets Contributed</p>
                                    {partner.assets.map((asset, i) => (
                                        <div key={i} className="flex justify-between text-xs text-slate-600 mb-1">
                                            <span>{asset.assetName}</span>
                                            <span>{store.currency} {asset.assetValue.toLocaleString()}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </Card>
                ))}
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Partner' : 'New Partner'}>
                <div className="space-y-4">
                    <Input label="Partner Name" value={formData.partnerName} onChange={e => setFormData({ ...formData, partnerName: e.target.value })} required />
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Phone" value={formData.phoneNumber || ''} onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })} />
                        <Input label="Email" value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Input label={`Cash Investment (${store.currency})`} type="number" value={formData.cashInvestment} onChange={e => setFormData({ ...formData, cashInvestment: +e.target.value })} />
                        <Input label="Date" type="date" value={formData.investmentDate?.toString().split('T')[0]} onChange={e => setFormData({ ...formData, investmentDate: e.target.value })} />
                    </div>

                    <div className="border-t pt-4">
                        <h5 className="font-semibold mb-3">Add Assets (Equipment/Inventory to Equity)</h5>
                        <div className="flex gap-2 mb-2">
                            <Input placeholder="Asset Name" value={newAsset.assetName} onChange={e => setNewAsset({ ...newAsset, assetName: e.target.value })} className="flex-grow" />
                            <Input placeholder="Value" type="number" value={newAsset.assetValue || ''} onChange={e => setNewAsset({ ...newAsset, assetValue: +e.target.value })} className="w-24" />
                            <Button onClick={handleAddAssetToForm} variant="secondary" size="sm"><Plus size={16} /></Button>
                        </div>

                        {/* List of assets in form */}
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                            {formData.assets?.map((a, i) => (
                                <div key={i} className="flex justify-between items-center bg-slate-50 p-2 rounded text-sm">
                                    <span>{a.assetName} ({a.assetType})</span>
                                    <span className="font-medium">{a.assetValue}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveWithAssets}>Save Partner</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
