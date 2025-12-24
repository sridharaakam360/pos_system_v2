import React, { useState, useEffect } from 'react';
import { Customer } from '../types';
import { customersApi } from '../src/api/customers';
import { Input, Button } from '../components/UI';
import { Search, User, X, Check } from 'lucide-react';

interface CustomerInputProps {
    storeId: string;
    onCustomerSelect: (customer: Customer | null) => void;
    selectedCustomer: Customer | null;
}

export const CustomerInput: React.FC<CustomerInputProps> = ({ storeId, onCustomerSelect, selectedCustomer }) => {
    const [mobile, setMobile] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [existingCustomer, setExistingCustomer] = useState<Customer | null>(null);
    const [suggestions, setSuggestions] = useState<Customer[]>([]);

    // New customer form (only shown if mobile doesn't match existing customer)
    const [newCustomer, setNewCustomer] = useState<Partial<Customer>>({
        name: '',
        gender: undefined,
        place: ''
    });

    // Search for customer by mobile number (with suggestions)
    useEffect(() => {
        const searchByMobile = async () => {
            if (mobile.length < 3) {
                setExistingCustomer(null);
                setSuggestions([]);
                return;
            }

            setIsSearching(true);
            try {
                const results = await customersApi.search(storeId, mobile);

                // Check for exact match
                const exactMatch = results.find(c => c.mobile === mobile);
                if (exactMatch) {
                    // Exact match found - auto-fill
                    setExistingCustomer(exactMatch);
                    onCustomerSelect(exactMatch);
                    setSuggestions([]);
                } else {
                    // Show suggestions for partial matches
                    setExistingCustomer(null);
                    setSuggestions(results.filter(c => c.mobile?.startsWith(mobile)));
                }
            } catch (error) {
                console.error('Customer search error:', error);
            } finally {
                setIsSearching(false);
            }
        };

        const debounce = setTimeout(searchByMobile, 300);
        return () => clearTimeout(debounce);
    }, [mobile, storeId]);

    // Sync with selectedCustomer prop (e.g., when restoring from queue)
    useEffect(() => {
        if (selectedCustomer) {
            setExistingCustomer(selectedCustomer);
            setMobile(selectedCustomer.mobile || '');
        } else {
            // Only clear if we actually had an existing customer but now don't
            // This prevents clearing the mobile input while the user is typing
            if (existingCustomer) {
                setExistingCustomer(null);
                setMobile('');
            }
        }
    }, [selectedCustomer]);

    const handleCreateCustomer = async () => {
        if (!newCustomer.name || !mobile) {
            alert('Mobile number and name are required');
            return;
        }

        try {
            const result = await customersApi.create({
                storeId,
                name: newCustomer.name,
                mobile: mobile,
                gender: newCustomer.gender,
                place: newCustomer.place
            });

            // Fetch the created customer
            const customer = await customersApi.getById(result.customerId);
            onCustomerSelect(customer);
            setExistingCustomer(customer);
            setSuggestions([]);

            // Reset form
            setNewCustomer({ name: '', gender: undefined, place: '' });
        } catch (error: any) {
            console.error('Create customer error:', error);
            if (error.response?.status === 409) {
                alert('Customer with this mobile number already exists');
            } else {
                alert('Failed to create customer');
            }
        }
    };

    const handleSelectSuggestion = (customer: Customer) => {
        setMobile(customer.mobile || '');
        setExistingCustomer(customer);
        onCustomerSelect(customer);
        setSuggestions([]);
    };

    const handleClear = () => {
        setMobile('');
        setExistingCustomer(null);
        setSuggestions([]);
        setNewCustomer({ name: '', gender: undefined, place: '' });
        onCustomerSelect(null);
    };

    // If customer is already selected (existing customer found)
    if (existingCustomer) {
        return (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                            <Check className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <div className="font-semibold text-green-900">{existingCustomer.name}</div>
                            <div className="text-sm text-green-700 space-y-1 mt-1">
                                <div>📱 {existingCustomer.mobile}</div>
                                {existingCustomer.place && <div>📍 {existingCustomer.place}</div>}
                                {existingCustomer.gender && <div>👤 {existingCustomer.gender}</div>}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={handleClear}
                        className="text-green-600 hover:text-green-800"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Mobile Number Input - Always First */}
            <div className="relative">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                    Mobile Number *
                </label>
                <input
                    type="tel"
                    placeholder="Enter mobile number"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    autoFocus
                />
                {isSearching && (
                    <div className="text-xs text-blue-600 mt-1">Searching...</div>
                )}

                {/* Suggestions Dropdown */}
                {suggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {suggestions.map((customer) => (
                            <button
                                key={customer.id}
                                onClick={() => handleSelectSuggestion(customer)}
                                className="w-full text-left px-4 py-2 hover:bg-blue-50 border-b border-slate-100 last:border-0 transition-colors"
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="font-medium text-slate-900">{customer.name}</div>
                                        <div className="text-sm text-slate-600">
                                            📱 {customer.mobile}
                                            {customer.place && ` • 📍 ${customer.place}`}
                                        </div>
                                    </div>
                                    <div className="text-xs text-blue-600">Select →</div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* New Customer Form - Only shown if mobile entered and no match found */}
            {mobile.length === 10 && !existingCustomer && !isSearching && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                        <User className="w-4 h-4" />
                        <span>New Customer - Fill Details</span>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Name *
                        </label>
                        <input
                            type="text"
                            placeholder="Customer name"
                            value={newCustomer.name}
                            onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Gender
                            </label>
                            <select
                                value={newCustomer.gender || ''}
                                onChange={(e) => setNewCustomer({ ...newCustomer, gender: e.target.value as any })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Select</option>
                                <option value="MALE">Male</option>
                                <option value="FEMALE">Female</option>
                                <option value="OTHER">Other</option>
                                <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Place
                            </label>
                            <input
                                type="text"
                                placeholder="City/Area"
                                value={newCustomer.place}
                                onChange={(e) => setNewCustomer({ ...newCustomer, place: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                        <button
                            onClick={handleCreateCustomer}
                            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
                        >
                            Save Customer
                        </button>
                        <button
                            onClick={handleClear}
                            className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
                        >
                            Clear
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
