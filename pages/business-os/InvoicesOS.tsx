import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BusinessOSLayout } from '../../components/business-os/BusinessOSLayout';
import { useBusinessOS } from '../../context/BusinessOSContext';
import { businessOSApi } from '../../lib/businessOSApi';
import { Invoice, Quotation, Customer, CatalogItem } from '../../types';
import {
  Receipt,
  FileText,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  Share2,
  Printer,
  DollarSign,
  ArrowRight,
  Trash2,
  Eye,
  Loader2,
  X,
  CreditCard
} from 'lucide-react';

export const InvoicesOS: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { activeTenant, formatCurrency } = useBusinessOS();

  const customerLabel = activeTenant?.settings?.customer_label || 'Customer';

  const [activeTab, setActiveTab] = useState<'invoices' | 'quotes'>(
    searchParams.get('tab') === 'quotes' ? 'quotes' : 'invoices'
  );

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Status Filter
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal States
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [activeReceiptInvoice, setActiveReceiptInvoice] = useState<Invoice | null>(null);

  // Invoice Form Fields
  const [formCustomerId, setFormCustomerId] = useState('');
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formCustomerEmail, setFormCustomerEmail] = useState('');
  const [formCustomerPhone, setFormCustomerPhone] = useState('');
  const [formDueDate, setFormDueDate] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [lineItems, setLineItems] = useState<
    { catalog_item_id?: string; title: string; quantity: number; unit_price: number }[]
  >([{ title: '', quantity: 1, unit_price: 0 }]);
  const [formDiscount, setFormDiscount] = useState<number>(0);
  const [formTax, setFormTax] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Payment Form Fields
  const [paymentAmount, setPaymentAmount] = useState<number | string>('');
  const [paymentMethod, setPaymentMethod] = useState<'BANK_TRANSFER' | 'CASH' | 'POS_CARD' | 'ONLINE'>('BANK_TRANSFER');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  const loadData = async () => {
    if (!activeTenant) return;
    setLoading(true);
    try {
      const [invs, quotes, custs, cats] = await Promise.all([
        businessOSApi.getInvoices(activeTenant.id, statusFilter !== 'ALL' ? statusFilter : undefined),
        businessOSApi.getQuotations(activeTenant.id),
        businessOSApi.getCustomers(activeTenant.id),
        businessOSApi.getCatalog(activeTenant.id)
      ]);
      setInvoices(invs);
      setQuotations(quotes);
      setCustomers(custs);
      setCatalogItems(cats);
    } catch (err) {
      console.error('Failed to load invoice records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTenant) {
      loadData();
    }
  }, [activeTenant?.id, statusFilter]);

  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      const cid = searchParams.get('customer_id');
      const cname = searchParams.get('customer_name');
      if (searchParams.get('tab') === 'quotes') {
        openQuoteModal(cid, cname);
      } else {
        openInvoiceModal(cid, cname);
      }
    }
  }, [searchParams]);

  const openInvoiceModal = (presetCustId?: string | null, presetCustName?: string | null) => {
    setFormCustomerId(presetCustId || '');
    setFormCustomerName(presetCustName || '');
    setFormCustomerEmail('');
    setFormCustomerPhone('');
    setFormDueDate('');
    setFormNotes(activeTenant?.settings?.payment_instructions || '');
    setLineItems([{ title: '', quantity: 1, unit_price: 0 }]);
    setFormDiscount(0);
    setFormTax(0);
    setFormError(null);
    setInvoiceModalOpen(true);
  };

  const openQuoteModal = (presetCustId?: string | null, presetCustName?: string | null) => {
    setFormCustomerId(presetCustId || '');
    setFormCustomerName(presetCustName || '');
    setFormCustomerEmail('');
    setFormCustomerPhone('');
    setFormNotes('This estimate is valid for 14 days.');
    setLineItems([{ title: '', quantity: 1, unit_price: 0 }]);
    setFormDiscount(0);
    setFormTax(0);
    setFormError(null);
    setQuoteModalOpen(true);
  };

  const openPaymentModal = (inv: Invoice) => {
    setSelectedInvoice(inv);
    setPaymentAmount(inv.balance_due);
    setPaymentMethod('BANK_TRANSFER');
    setPaymentRef(`TRF-${Date.now().toString().slice(-5)}`);
    setPaymentNotes('');
    setPaymentModalOpen(true);
  };

  const handleSelectCustomer = (cid: string) => {
    setFormCustomerId(cid);
    const found = customers.find(c => c.id === cid);
    if (found) {
      setFormCustomerName(found.name);
      setFormCustomerEmail(found.email || '');
      setFormCustomerPhone(found.phone || '');
    }
  };

  const handleAddLineItem = () => {
    setLineItems([...lineItems, { title: '', quantity: 1, unit_price: 0 }]);
  };

  const handleRemoveLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const handleSelectCatalogItem = (index: number, catId: string) => {
    const item = catalogItems.find(c => c.id === catId);
    if (item) {
      const updated = [...lineItems];
      updated[index] = {
        catalog_item_id: item.id,
        title: item.title,
        quantity: updated[index].quantity || 1,
        unit_price: Number(item.unit_price)
      };
      setLineItems(updated);
    }
  };

  const calculateSubtotal = () => {
    return lineItems.reduce((sum, item) => sum + Number(item.unit_price || 0) * Number(item.quantity || 1), 0);
  };

  const calculateTotal = () => {
    const sub = calculateSubtotal();
    return Math.max(0, sub + Number(formTax || 0) - Number(formDiscount || 0));
  };

  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCustomerName.trim()) {
      setFormError(`Please specify the ${customerLabel} name.`);
      return;
    }
    if (lineItems.length === 0 || !lineItems[0].title.trim()) {
      setFormError('Please add at least one line item.');
      return;
    }
    if (!activeTenant) return;

    setSubmitting(true);
    setFormError(null);

    try {
      await businessOSApi.saveInvoice(activeTenant.id, {
        customer_id: formCustomerId || undefined,
        customer_name: formCustomerName.trim(),
        customer_email: formCustomerEmail.trim() || undefined,
        customer_phone: formCustomerPhone.trim() || undefined,
        due_date: formDueDate || undefined,
        items: lineItems,
        discount_amount: Number(formDiscount || 0),
        tax_amount: Number(formTax || 0),
        notes: formNotes.trim() || undefined
      });

      setInvoiceModalOpen(false);
      loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save invoice.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCustomerName.trim()) {
      setFormError(`Please specify the ${customerLabel} name.`);
      return;
    }
    if (lineItems.length === 0 || !lineItems[0].title.trim()) {
      setFormError('Please add at least one line item.');
      return;
    }
    if (!activeTenant) return;

    setSubmitting(true);
    setFormError(null);

    try {
      await businessOSApi.saveQuotation(activeTenant.id, {
        customer_id: formCustomerId || undefined,
        customer_name: formCustomerName.trim(),
        customer_email: formCustomerEmail.trim() || undefined,
        customer_phone: formCustomerPhone.trim() || undefined,
        items: lineItems,
        discount_amount: Number(formDiscount || 0),
        tax_amount: Number(formTax || 0),
        notes: formNotes.trim() || undefined
      });

      setQuoteModalOpen(false);
      loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save quotation.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConvertQuote = async (quoteId: string) => {
    if (!activeTenant) return;
    try {
      await businessOSApi.convertQuotationToInvoice(activeTenant.id, quoteId);
      setActiveTab('invoices');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to convert quote.');
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice || !activeTenant) return;

    const amt = Number(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid payment amount.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await businessOSApi.recordPayment(activeTenant.id, selectedInvoice.id, {
        amount: amt,
        payment_method: paymentMethod,
        reference: paymentRef,
        notes: paymentNotes
      });

      setPaymentModalOpen(false);
      loadData();

      // Open receipt viewer immediately!
      setActiveReceiptInvoice(res.invoice);
      setReceiptModalOpen(true);
    } catch (err: any) {
      alert(err.message || 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteInvoice = async (id: string) => {
    if (!activeTenant) return;
    if (!confirm('Are you sure you want to delete this invoice?')) return;
    try {
      await businessOSApi.deleteInvoice(activeTenant.id, id);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error deleting invoice');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">PAID</span>;
      case 'PARTIALLY_PAID':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">PARTIAL</span>;
      case 'UNPAID':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">UNPAID</span>;
      case 'OVERDUE':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">OVERDUE</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#1C1F24] text-[#8E959E] border border-[#282B31]">{status}</span>;
    }
  };

  return (
    <BusinessOSLayout
      title="Invoices & Quotations"
      subtitle="Issue professional bills, accept bank transfers, record payments, and send receipts."
      actionButton={
        <div className="flex items-center gap-2">
          <button
            onClick={() => openQuoteModal()}
            className="px-3.5 py-2 rounded-xl bg-[#1C1F24] hover:bg-[#25282D] text-white border border-[#2B2F36] font-medium text-xs flex items-center gap-1.5 transition-colors"
          >
            <FileText size={14} className="text-[#8E959E]" />
            <span>Draft Quote</span>
          </button>
          <button
            onClick={() => openInvoiceModal()}
            className="px-4 py-2 rounded-xl bg-[#C58A52] hover:bg-[#D4985F] text-black font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-[#C58A52]/20 transition-all"
          >
            <Plus size={15} />
            <span>New Invoice</span>
          </button>
        </div>
      }
    >
      {/* Tabs and Status Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-[#202327]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('invoices')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'invoices'
                ? 'bg-[#C58A52] text-black shadow-md shadow-[#C58A52]/15'
                : 'bg-[#16181C] text-[#8E959E] hover:text-white border border-[#25282D]'
            }`}
          >
            Invoices ({invoices.length})
          </button>
          <button
            onClick={() => setActiveTab('quotes')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'quotes'
                ? 'bg-[#C58A52] text-black shadow-md shadow-[#C58A52]/15'
                : 'bg-[#16181C] text-[#8E959E] hover:text-white border border-[#25282D]'
            }`}
          >
            Quotations / Estimates ({quotations.length})
          </button>
        </div>

        {activeTab === 'invoices' && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#8E959E]">Filter Status:</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-[#16181C] border border-[#25282D] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#C58A52]"
            >
              <option value="ALL">All Invoices</option>
              <option value="UNPAID">Unpaid</option>
              <option value="PARTIALLY_PAID">Partially Paid</option>
              <option value="PAID">Paid in Full</option>
            </select>
          </div>
        )}
      </div>

      {/* Main Table: Invoices */}
      {activeTab === 'invoices' && (
        <div className="rounded-2xl bg-[#16181C] border border-[#25282D] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#141619] text-[#8E959E] uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-5 py-3 font-semibold">Invoice #</th>
                  <th className="px-5 py-3 font-semibold">{customerLabel}</th>
                  <th className="px-5 py-3 font-semibold">Issue / Due Date</th>
                  <th className="px-5 py-3 font-semibold">Total Amount</th>
                  <th className="px-5 py-3 font-semibold">Balance Due</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#202327]">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-[#8E959E]">
                      <Loader2 size={18} className="animate-spin inline mr-2 text-[#C58A52]" />
                      Loading invoices...
                    </td>
                  </tr>
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-[#8E959E]">
                      No invoices found. Click "New Invoice" to create one.
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv, invIdx) => (
                    <tr key={`inv-${inv.id || 'id'}-${invIdx}`} className="hover:bg-[#1A1D21] transition-colors">
                      <td className="px-5 py-3.5 font-mono font-semibold text-white">
                        {inv.invoice_number}
                      </td>
                      <td className="px-5 py-3.5 text-white">
                        <div className="font-semibold">{inv.customer_name}</div>
                        {inv.customer_phone && <div className="text-[10px] text-[#8E959E]">{inv.customer_phone}</div>}
                      </td>
                      <td className="px-5 py-3.5 text-[#8E959E]">
                        <div>Issued: {new Date(inv.issue_date).toLocaleDateString()}</div>
                        <div className="text-[10px]">Due: {new Date(inv.due_date).toLocaleDateString()}</div>
                      </td>
                      <td className="px-5 py-3.5 font-mono font-semibold text-white">
                        {formatCurrency(inv.total_amount)}
                      </td>
                      <td className="px-5 py-3.5 font-mono">
                        {Number(inv.balance_due) > 0 ? (
                          <span className="text-[#E5A96A] font-semibold">{formatCurrency(inv.balance_due)}</span>
                        ) : (
                          <span className="text-emerald-400">Settled (₦0)</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {getStatusBadge(inv.status)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {Number(inv.balance_due) > 0 && (
                            <button
                              onClick={() => openPaymentModal(inv)}
                              className="px-2.5 py-1 rounded-lg bg-[#C58A52] hover:bg-[#D4985F] text-black font-semibold text-[11px] transition-colors"
                            >
                              Record Payment
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setActiveReceiptInvoice(inv);
                              setReceiptModalOpen(true);
                            }}
                            title="View Receipt / Invoice"
                            className="p-1.5 rounded-lg bg-[#1C1F24] hover:bg-[#25282D] text-[#ECEEEF] transition-colors"
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteInvoice(inv.id)}
                            title="Delete"
                            className="p-1.5 rounded-lg bg-[#1C1F24] hover:bg-red-500/20 text-[#8E959E] hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Main Table: Quotations */}
      {activeTab === 'quotes' && (
        <div className="rounded-2xl bg-[#16181C] border border-[#25282D] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#141619] text-[#8E959E] uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-5 py-3 font-semibold">Quote #</th>
                  <th className="px-5 py-3 font-semibold">{customerLabel}</th>
                  <th className="px-5 py-3 font-semibold">Issue Date</th>
                  <th className="px-5 py-3 font-semibold">Expiry Date</th>
                  <th className="px-5 py-3 font-semibold">Total Amount</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#202327]">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-[#8E959E]">
                      <Loader2 size={18} className="animate-spin inline mr-2 text-[#C58A52]" />
                      Loading quotations...
                    </td>
                  </tr>
                ) : quotations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-[#8E959E]">
                      No quotations drafted yet. Click "Draft Quote" to send an estimate.
                    </td>
                  </tr>
                ) : (
                  quotations.map((qte, qteIdx) => (
                    <tr key={`qte-${qte.id || 'id'}-${qteIdx}`} className="hover:bg-[#1A1D21] transition-colors">
                      <td className="px-5 py-3.5 font-mono font-semibold text-white">
                        {qte.quotation_number}
                      </td>
                      <td className="px-5 py-3.5 text-white">
                        <div className="font-semibold">{qte.customer_name}</div>
                        {qte.customer_phone && <div className="text-[10px] text-[#8E959E]">{qte.customer_phone}</div>}
                      </td>
                      <td className="px-5 py-3.5 text-[#8E959E]">
                        {new Date(qte.issue_date).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3.5 text-[#8E959E]">
                        {new Date(qte.expiry_date).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3.5 font-mono font-semibold text-white">
                        {formatCurrency(qte.total_amount)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          qte.status === 'CONVERTED' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        }`}>
                          {qte.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {qte.status !== 'CONVERTED' && (
                          <button
                            onClick={() => handleConvertQuote(qte.id)}
                            className="px-3 py-1.5 rounded-lg bg-[#C58A52] hover:bg-[#D4985F] text-black font-semibold text-[11px] transition-colors inline-flex items-center gap-1"
                          >
                            <span>Convert to Invoice</span>
                            <ArrowRight size={12} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Invoice / Quote Modal */}
      {(invoiceModalOpen || quoteModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#181B1F] border border-[#2B2F36] rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative my-8">
            <div className="flex items-center justify-between pb-3 border-b border-[#25282D] mb-4">
              <h3 className="text-base font-bold text-white">
                {invoiceModalOpen ? 'Create New Invoice' : 'Draft Quotation / Estimate'}
              </h3>
              <button
                onClick={() => {
                  setInvoiceModalOpen(false);
                  setQuoteModalOpen(false);
                }}
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

            <form onSubmit={invoiceModalOpen ? handleSaveInvoice : handleSaveQuote} className="space-y-4">
              {/* Customer Selector / Input */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#ECEEEF] mb-1">
                    Select Existing {customerLabel}
                  </label>
                  <select
                    value={formCustomerId}
                    onChange={e => handleSelectCustomer(e.target.value)}
                    className="w-full bg-[#141619] border border-[#2B2F36] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C58A52]"
                  >
                    <option value="">-- Choose or type below --</option>
                    {customers.map((c, cIdx) => (
                      <option key={`cust-opt-${c.id || 'id'}-${cIdx}`} value={c.id}>{c.name} {c.company_name ? `(${c.company_name})` : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#ECEEEF] mb-1">
                    {customerLabel} Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formCustomerName}
                    onChange={e => setFormCustomerName(e.target.value)}
                    placeholder="e.g. Amara Kalu"
                    className="w-full bg-[#141619] border border-[#2B2F36] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#C58A52]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#ECEEEF] mb-1">Email</label>
                  <input
                    type="email"
                    value={formCustomerEmail}
                    onChange={e => setFormCustomerEmail(e.target.value)}
                    placeholder="client@mail.com"
                    className="w-full bg-[#141619] border border-[#2B2F36] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#C58A52]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#ECEEEF] mb-1">Phone / WhatsApp</label>
                  <input
                    type="tel"
                    value={formCustomerPhone}
                    onChange={e => setFormCustomerPhone(e.target.value)}
                    placeholder="+234..."
                    className="w-full bg-[#141619] border border-[#2B2F36] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#C58A52]"
                  />
                </div>
              </div>

              {/* Line Items */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-white">Line Items</label>
                  <button
                    type="button"
                    onClick={handleAddLineItem}
                    className="text-[11px] text-[#C58A52] hover:underline flex items-center gap-1 font-semibold"
                  >
                    <Plus size={13} />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {lineItems.map((item, idx) => (
                    <div key={`line-item-${idx}`} className="p-3 rounded-xl bg-[#141619] border border-[#262A30] flex flex-col sm:flex-row gap-2 items-center">
                      <div className="flex-1 w-full">
                        <select
                          onChange={e => handleSelectCatalogItem(idx, e.target.value)}
                          className="w-full bg-[#1C1F24] border border-[#2B2F36] rounded-lg px-2.5 py-1.5 text-xs text-white mb-1.5"
                        >
                          <option value="">-- Choose from catalogue preset --</option>
                          {catalogItems.map((c, cIdx) => (
                            <option key={`cat-opt-${c.id || 'id'}-${cIdx}`} value={c.id}>{c.title} ({formatCurrency(c.unit_price)})</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          required
                          value={item.title}
                          onChange={e => {
                            const updated = [...lineItems];
                            updated[idx].title = e.target.value;
                            setLineItems(updated);
                          }}
                          placeholder="Item or service description"
                          className="w-full bg-[#1C1F24] border border-[#2B2F36] rounded-lg px-2.5 py-1.5 text-xs text-white"
                        />
                      </div>
                      <div className="w-20 shrink-0">
                        <label className="text-[10px] text-[#8E959E] block mb-0.5">Qty</label>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={e => {
                            const updated = [...lineItems];
                            updated[idx].quantity = Number(e.target.value);
                            setLineItems(updated);
                          }}
                          className="w-full bg-[#1C1F24] border border-[#2B2F36] rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                        />
                      </div>
                      <div className="w-28 shrink-0">
                        <label className="text-[10px] text-[#8E959E] block mb-0.5">Price ({activeTenant?.currency})</label>
                        <input
                          type="number"
                          min="0"
                          value={item.unit_price}
                          onChange={e => {
                            const updated = [...lineItems];
                            updated[idx].unit_price = Number(e.target.value);
                            setLineItems(updated);
                          }}
                          className="w-full bg-[#1C1F24] border border-[#2B2F36] rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                        />
                      </div>
                      {lineItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLineItem(idx)}
                          className="p-1.5 rounded-lg text-[#8E959E] hover:text-red-400 sm:mt-4"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Calculation summary */}
              <div className="p-3.5 rounded-xl bg-[#141619] border border-[#262A30] space-y-1.5 text-xs">
                <div className="flex justify-between text-[#8E959E]">
                  <span>Subtotal:</span>
                  <span className="font-mono text-white font-medium">{formatCurrency(calculateSubtotal())}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[#8E959E]">VAT / Tax ({activeTenant?.settings?.tax_rate_percentage || 7.5}%):</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFormTax(Math.round(calculateSubtotal() * ((activeTenant?.settings?.tax_rate_percentage || 7.5) / 100)))}
                      className="text-[10px] text-[#C58A52] hover:underline"
                    >
                      Apply 7.5%
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={formTax}
                      onChange={e => setFormTax(Number(e.target.value))}
                      className="w-24 bg-[#1C1F24] border border-[#2B2F36] rounded px-2 py-0.5 text-right font-mono text-white text-xs"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[#8E959E]">Discount:</span>
                  <input
                    type="number"
                    min="0"
                    value={formDiscount}
                    onChange={e => setFormDiscount(Number(e.target.value))}
                    className="w-24 bg-[#1C1F24] border border-[#2B2F36] rounded px-2 py-0.5 text-right font-mono text-white text-xs"
                  />
                </div>
                <div className="border-t border-[#202327] pt-2 flex justify-between font-bold text-sm text-white">
                  <span>Grand Total:</span>
                  <span className="font-mono text-emerald-400">{formatCurrency(calculateTotal())}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#ECEEEF] mb-1">Notes & Bank Instructions</label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  className="w-full bg-[#141619] border border-[#2B2F36] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#C58A52]"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setInvoiceModalOpen(false);
                    setQuoteModalOpen(false);
                  }}
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
                  <span>{invoiceModalOpen ? 'Issue Invoice' : 'Create Quotation'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {paymentModalOpen && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#181B1F] border border-[#2B2F36] rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-[#25282D] mb-4">
              <div>
                <h3 className="text-base font-bold text-white">Record Payment</h3>
                <p className="text-[11px] text-[#8E959E]">Invoice {selectedInvoice.invoice_number} · {selectedInvoice.customer_name}</p>
              </div>
              <button
                onClick={() => setPaymentModalOpen(false)}
                className="p-1 rounded-lg text-[#8E959E] hover:text-white hover:bg-[#22262C]"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#ECEEEF] mb-1">
                  Payment Amount ({activeTenant?.currency || 'NGN'}) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max={selectedInvoice.balance_due}
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  className="w-full bg-[#141619] border border-[#2B2F36] rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#C58A52]"
                />
                <span className="text-[10px] text-[#8E959E] mt-1 block">
                  Remaining balance due: {formatCurrency(selectedInvoice.balance_due)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#ECEEEF] mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value as any)}
                  className="w-full bg-[#141619] border border-[#2B2F36] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#C58A52]"
                >
                  <option value="BANK_TRANSFER">Direct Bank Transfer</option>
                  <option value="POS_CARD">POS Terminal / Debit Card</option>
                  <option value="CASH">Cash Settlement</option>
                  <option value="ONLINE">Online Checkout</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#ECEEEF] mb-1">Payment Reference / Transfer ID</label>
                <input
                  type="text"
                  value={paymentRef}
                  onChange={e => setPaymentRef(e.target.value)}
                  placeholder="e.g. ZEN-TRF-994821 or Stanbic-POS"
                  className="w-full bg-[#141619] border border-[#2B2F36] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#C58A52]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#ECEEEF] mb-1">Payment Notes</label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={e => setPaymentNotes(e.target.value)}
                  placeholder="Optional memo..."
                  className="w-full bg-[#141619] border border-[#2B2F36] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#C58A52]"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#22252A] hover:bg-[#2B2F36] text-xs font-medium text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-[#C58A52] hover:bg-[#D4985F] text-black font-semibold text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <DollarSign size={14} />}
                  <span>Confirm Settlement</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Branded Receipt / Invoice View Modal */}
      {receiptModalOpen && activeReceiptInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-[#181B1F] border border-[#2B2F36] rounded-2xl max-w-xl w-full p-6 shadow-2xl relative my-8 text-xs">
            {/* Action Bar */}
            <div className="flex items-center justify-between pb-4 border-b border-[#25282D] mb-6">
              <span className="font-mono text-[#8E959E] uppercase tracking-wider text-[11px]">
                Official Transaction Record
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-lg bg-[#22252A] hover:bg-[#2B2F36] text-white flex items-center gap-1.5 text-xs transition-colors"
                >
                  <Printer size={13} />
                  <span>Print</span>
                </button>
                <a
                  href={`https://wa.me/${(activeReceiptInvoice.customer_phone || '').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                    `Hello ${activeReceiptInvoice.customer_name}, here is your official receipt for invoice ${activeReceiptInvoice.invoice_number} from ${activeTenant?.name}. Total settled: ${formatCurrency(activeReceiptInvoice.amount_paid)}. Thank you!`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 text-xs transition-colors"
                >
                  <Share2 size={13} />
                  <span>WhatsApp</span>
                </a>
                <button
                  onClick={() => setReceiptModalOpen(false)}
                  className="p-1 rounded-lg text-[#8E959E] hover:text-white hover:bg-[#22262C]"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Printable Receipt Paper Container */}
            <div className="bg-[#141619] p-6 rounded-xl border border-[#25282D]">
              {/* Header */}
              <div className="flex items-start justify-between pb-4 border-b border-[#22252A] mb-4">
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight">{activeTenant?.name}</h2>
                  <p className="text-[11px] text-[#8E959E]">{activeTenant?.email || activeTenant?.owner_email}</p>
                  <p className="text-[11px] text-[#8E959E]">{activeTenant?.phone}</p>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono font-bold text-white">{activeReceiptInvoice.invoice_number}</div>
                  <div className="text-[10px] text-[#8E959E]">Date: {new Date(activeReceiptInvoice.issue_date).toLocaleDateString()}</div>
                  <div className="mt-1">{getStatusBadge(activeReceiptInvoice.status)}</div>
                </div>
              </div>

              {/* Billed To */}
              <div className="mb-4 text-xs">
                <span className="text-[#8E959E] uppercase tracking-wider text-[10px] block mb-0.5">Billed To:</span>
                <div className="font-semibold text-white">{activeReceiptInvoice.customer_name}</div>
                {activeReceiptInvoice.customer_email && <div className="text-[#8E959E]">{activeReceiptInvoice.customer_email}</div>}
                {activeReceiptInvoice.customer_phone && <div className="text-[#8E959E]">{activeReceiptInvoice.customer_phone}</div>}
              </div>

              {/* Line Items Table */}
              <div className="border-t border-[#22252A] pt-3 mb-4">
                <table className="w-full text-left text-xs">
                  <thead className="text-[#8E959E] border-b border-[#22252A]">
                    <tr>
                      <th className="py-1.5 font-medium">Description</th>
                      <th className="py-1.5 font-medium text-center">Qty</th>
                      <th className="py-1.5 font-medium text-right">Price</th>
                      <th className="py-1.5 font-medium text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#202327]">
                    {activeReceiptInvoice.items && activeReceiptInvoice.items.length > 0 ? (
                      activeReceiptInvoice.items.map((item, i) => (
                        <tr key={`rcpt-item-${item.id || item.title || 'item'}-${i}`}>
                          <td className="py-2 text-white">{item.title}</td>
                          <td className="py-2 text-center text-[#8E959E]">{item.quantity}</td>
                          <td className="py-2 text-right font-mono text-[#8E959E]">{formatCurrency(item.unit_price)}</td>
                          <td className="py-2 text-right font-mono text-white">{formatCurrency(item.total_price ?? (item.unit_price * item.quantity))}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-2 text-white">Full Services Delivered</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Financial Totals */}
              <div className="border-t border-[#22252A] pt-3 space-y-1 text-right font-mono text-xs">
                <div className="flex justify-between text-[#8E959E]">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(activeReceiptInvoice.subtotal)}</span>
                </div>
                {Number(activeReceiptInvoice.tax_amount) > 0 && (
                  <div className="flex justify-between text-[#8E959E]">
                    <span>VAT (7.5%):</span>
                    <span>{formatCurrency(activeReceiptInvoice.tax_amount)}</span>
                  </div>
                )}
                {Number(activeReceiptInvoice.discount_amount) > 0 && (
                  <div className="flex justify-between text-[#8E959E]">
                    <span>Discount:</span>
                    <span>-{formatCurrency(activeReceiptInvoice.discount_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-white font-bold text-sm pt-1 border-t border-[#22252A]">
                  <span>Total Amount:</span>
                  <span>{formatCurrency(activeReceiptInvoice.total_amount)}</span>
                </div>
                <div className="flex justify-between text-emerald-400 font-semibold">
                  <span>Amount Paid:</span>
                  <span>{formatCurrency(activeReceiptInvoice.amount_paid)}</span>
                </div>
                <div className="flex justify-between text-[#E5A96A] font-semibold">
                  <span>Balance Due:</span>
                  <span>{formatCurrency(activeReceiptInvoice.balance_due)}</span>
                </div>
              </div>

              {/* Bank Details note on receipt */}
              {activeTenant?.settings?.bank_name && (
                <div className="mt-5 p-3 rounded-lg bg-[#181B1F] border border-[#25282D] text-[11px] text-[#8E959E]">
                  <div className="font-semibold text-white mb-0.5">Payment Instructions</div>
                  <div>Bank: <span className="text-white">{activeTenant.settings.bank_name}</span></div>
                  <div>Account #: <span className="text-white font-mono">{activeTenant.settings.bank_account_number}</span></div>
                  <div>Account Name: <span className="text-white">{activeTenant.settings.bank_account_name}</span></div>
                </div>
              )}

              {/* Footer note */}
              <div className="mt-4 text-center text-[10px] text-[#5A606A]">
                {activeTenant?.settings?.receipt_footer_note || 'Thank you for your valued patronage!'}
              </div>
            </div>
          </div>
        </div>
      )}
    </BusinessOSLayout>
  );
};
