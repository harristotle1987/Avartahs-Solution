import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BusinessOSLayout } from '../../components/business-os/BusinessOSLayout';
import { useBusinessOS } from '../../context/BusinessOSContext';
import { businessOSApi } from '../../lib/businessOSApi';
import { CatalogItem } from '../../types';
import {
  Package,
  Search,
  Plus,
  Filter,
  Edit2,
  Trash2,
  Tag,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Layers
} from 'lucide-react';

export const CatalogueOS: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { activeTenant, formatCurrency } = useBusinessOS();

  const catalogLabel = activeTenant?.settings?.catalog_label || 'Catalogue';

  const [items, setItems] = useState<CatalogItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);

  // Form Fields
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState('General');
  const [formType, setFormType] = useState<'service' | 'product'>('service');
  const [formUnitPrice, setFormUnitPrice] = useState<number | string>('');
  const [formCostPrice, setFormCostPrice] = useState<number | string>('');
  const [formSku, setFormSku] = useState('');
  const [formStock, setFormStock] = useState<number | string>(0);
  const [formTrackInventory, setFormTrackInventory] = useState(false);
  const [formDescription, setFormDescription] = useState('');
  const [formAvailable, setFormAvailable] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchItems = async () => {
    if (!activeTenant) return;
    try {
      const data = await businessOSApi.getCatalog(activeTenant.id, {
        search: search || undefined,
        category: selectedCategory !== 'ALL' ? selectedCategory : undefined,
        type: selectedType !== 'ALL' ? selectedType : undefined
      });
      setItems(data);

      // Extract unique categories
      const cats = Array.from(new Set(data.map(i => i.category || 'General'))).filter(Boolean);
      setCategories(cats);
    } catch (err) {
      console.error('Error fetching catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTenant) {
      fetchItems();
    }
    if (searchParams.get('action') === 'new') {
      openAddModal();
    }
  }, [activeTenant?.id, selectedCategory, selectedType]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchItems();
  };

  const openAddModal = () => {
    setEditingItem(null);
    setFormTitle('');
    setFormCategory('General');
    setFormType('service');
    setFormUnitPrice('');
    setFormCostPrice('');
    setFormSku(`SKU-${Date.now().toString().slice(-4)}`);
    setFormStock(0);
    setFormTrackInventory(false);
    setFormDescription('');
    setFormAvailable(true);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (item: CatalogItem) => {
    setEditingItem(item);
    setFormTitle(item.title);
    setFormCategory(item.category || 'General');
    setFormType(item.type || 'service');
    setFormUnitPrice(item.unit_price);
    setFormCostPrice(item.cost_price || '');
    setFormSku(item.sku || '');
    setFormStock(item.stock_quantity || 0);
    setFormTrackInventory(item.track_inventory || false);
    setFormDescription(item.description || '');
    setFormAvailable(item.is_available ?? true);
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError('Item title is required.');
      return;
    }
    const priceNum = Number(formUnitPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      setFormError('Please enter a valid unit price.');
      return;
    }
    if (!activeTenant) return;

    setSubmitting(true);
    setFormError(null);

    try {
      await businessOSApi.saveCatalogItem(activeTenant.id, {
        id: editingItem?.id,
        title: formTitle.trim(),
        category: formCategory.trim() || 'General',
        type: formType,
        unit_price: priceNum,
        cost_price: Number(formCostPrice || 0),
        sku: formSku.trim() || undefined,
        stock_quantity: Number(formStock || 0),
        track_inventory: formTrackInventory,
        description: formDescription.trim() || undefined,
        is_available: formAvailable
      });

      setModalOpen(false);
      fetchItems();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save catalogue item.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!activeTenant) return;
    if (!confirm('Are you sure you want to remove this item?')) return;
    try {
      await businessOSApi.deleteCatalogItem(activeTenant.id, id);
      fetchItems();
    } catch (err: any) {
      alert(err.message || 'Error deleting item');
    }
  };

  return (
    <BusinessOSLayout
      title={`${catalogLabel} Directory`}
      subtitle={`Configure services, products, pricing tiers, and stock availability.`}
      actionButton={
        <button
          onClick={openAddModal}
          className="px-4 py-2 rounded-xl bg-[#C58A52] hover:bg-[#D4985F] text-black font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-[#C58A52]/20 transition-all"
        >
          <Plus size={15} />
          <span>Add Item</span>
        </button>
      }
    >
      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6 items-center justify-between">
        <form onSubmit={handleSearch} className="relative flex-1 w-full">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8E959E]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${catalogLabel.toLowerCase()} by title, category, or SKU...`}
            className="w-full bg-[#16181C] border border-[#25282D] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-[#5A606A] focus:outline-none focus:border-[#C58A52] transition-colors"
          />
        </form>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="bg-[#16181C] border border-[#25282D] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C58A52]"
          >
            <option value="ALL">All Categories</option>
            {categories.map((cat, catIdx) => (
              <option key={`cat-filter-${cat}-${catIdx}`} value={cat}>{cat}</option>
            ))}
          </select>

          {/* Type Filter */}
          <select
            value={selectedType}
            onChange={e => setSelectedType(e.target.value)}
            className="bg-[#16181C] border border-[#25282D] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C58A52]"
          >
            <option value="ALL">All Types</option>
            <option value="service">Services Only</option>
            <option value="product">Products Only</option>
          </select>
        </div>
      </div>

      {/* Catalogue Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-12 text-center text-[#8E959E]">
            <Loader2 size={20} className="animate-spin inline mr-2 text-[#C58A52]" />
            Loading catalogue items...
          </div>
        ) : items.length === 0 ? (
          <div className="col-span-full py-16 text-center text-[#8E959E] bg-[#16181C] rounded-2xl border border-[#25282D]">
            No items in catalogue yet. Click "Add Item" to add your first billable service or product.
          </div>
        ) : (
          items.map((item, itemIdx) => (
            <div
              key={`cat-item-${item.id || 'id'}-${itemIdx}`}
              className="p-5 rounded-2xl bg-[#16181C] border border-[#25282D] hover:border-[#353A42] flex flex-col justify-between transition-all"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-[#1C1F24] border border-[#2B2F36] text-[#8E959E]">
                    {item.category || 'General'}
                  </span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                    item.type === 'service' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                  }`}>
                    {item.type.toUpperCase()}
                  </span>
                </div>

                <h3 className="font-bold text-white text-sm mb-1">{item.title}</h3>
                {item.description && (
                  <p className="text-[11px] text-[#8E959E] line-clamp-2 mb-3">{item.description}</p>
                )}

                {item.sku && (
                  <div className="text-[10px] font-mono text-[#5A606A] mb-3">SKU: {item.sku}</div>
                )}
              </div>

              <div className="pt-4 border-t border-[#22252A] flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-[#8E959E]">Selling Price</div>
                  <div className="text-base font-bold text-emerald-400 font-mono">
                    {formatCurrency(item.unit_price)}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => openEditModal(item)}
                    className="p-1.5 rounded-lg bg-[#1C1F24] hover:bg-[#25282D] text-[#8E959E] hover:text-white transition-colors"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 rounded-lg bg-[#1C1F24] hover:bg-red-500/20 text-[#8E959E] hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#181B1F] border border-[#2B2F36] rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-[#25282D] mb-4">
              <h3 className="text-base font-bold text-white">
                {editingItem ? 'Edit Catalogue Item' : 'New Catalogue Item'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-[#8E959E] hover:text-white hover:bg-[#22262C]"
              >
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-center gap-2">
                <AlertCircle size={15} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#ECEEEF] mb-1">
                  Item Title *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="e.g. Signature Facial Treatment or Italian Silk Suit"
                  className="w-full bg-[#141619] border border-[#2B2F36] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#C58A52]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#ECEEEF] mb-1">Category</label>
                  <input
                    type="text"
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value)}
                    placeholder="e.g. Services, Packages, Retail"
                    className="w-full bg-[#141619] border border-[#2B2F36] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#C58A52]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#ECEEEF] mb-1">Type</label>
                  <select
                    value={formType}
                    onChange={e => setFormType(e.target.value as any)}
                    className="w-full bg-[#141619] border border-[#2B2F36] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#C58A52]"
                  >
                    <option value="service">Service (Consultation/Time)</option>
                    <option value="product">Physical Product (Merchandise)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#ECEEEF] mb-1">
                    Selling Unit Price ({activeTenant?.currency || 'NGN'}) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formUnitPrice}
                    onChange={e => setFormUnitPrice(e.target.value)}
                    placeholder="e.g. 25000"
                    className="w-full bg-[#141619] border border-[#2B2F36] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#C58A52]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#ECEEEF] mb-1">SKU / Item Code</label>
                  <input
                    type="text"
                    value={formSku}
                    onChange={e => setFormSku(e.target.value)}
                    placeholder="e.g. SRV-01"
                    className="w-full bg-[#141619] border border-[#2B2F36] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#C58A52]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#ECEEEF] mb-1">Description</label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  placeholder="Details displayed on invoice line items..."
                  className="w-full bg-[#141619] border border-[#2B2F36] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#C58A52]"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#22252A] hover:bg-[#2B2F36] text-xs font-medium text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-[#C58A52] hover:bg-[#D4985F] text-black font-semibold text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  <span>Save Item</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </BusinessOSLayout>
  );
};
