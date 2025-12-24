import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Layout } from '../components/Layout';
import { Package, Plus, Search, Eye, Edit, Trash2, CheckCircle, Download, FileCheck } from 'lucide-react';
import { Modal } from '../components/Modal';

interface Supplier {
  id: string;
  company_name: string;
}

interface Product {
  id: string;
  product_name: string;
  product_code: string;
  unit: string;
}

interface PurchaseOrder {
  id: string;
  po_number: string;
  purchase_order_items?: any[];
}

interface GRNItem {
  id?: string;
  line_number: number;
  po_item_id?: string;
  product_id: string;
  batch_number?: string;
  expiry_date?: string;
  manufacture_date?: string;
  description: string;
  quantity_received: number;
  unit: string;
  unit_cost: number;
  line_total: number;
  notes?: string;
  products?: Product;
}

interface GoodsReceiptNote {
  id: string;
  grn_number: string;
  grn_date: string;
  supplier_id: string;
  po_id?: string;
  po_number?: string;
  supplier_invoice_number?: string;
  supplier_invoice_date?: string;
  delivery_note_number?: string;
  received_by?: string;
  currency: string;
  exchange_rate: number;
  total_quantity: number;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  notes?: string;
  created_by: string;
  created_at: string;
  posted_at?: string;
  suppliers?: Supplier;
  goods_receipt_items?: GRNItem[];
}

export default function GoodsReceiptNotes() {
  const { user, profile } = useAuth();
  const [grns, setGRNs] = useState<GoodsReceiptNote[]>([]);
  const [filteredGRNs, setFilteredGRNs] = useState<GoodsReceiptNote[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedGRN, setSelectedGRN] = useState<GoodsReceiptNote | null>(null);
  const [editingGRN, setEditingGRN] = useState<GoodsReceiptNote | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    supplier_id: '',
    po_id: '',
    grn_date: new Date().toISOString().split('T')[0],
    supplier_invoice_number: '',
    supplier_invoice_date: '',
    delivery_note_number: '',
    received_by: profile?.full_name || '',
    currency: 'IDR',
    exchange_rate: 1,
    notes: '',
  });
  const [grnItems, setGRNItems] = useState<GRNItem[]>([
    {
      line_number: 1,
      product_id: '',
      description: '',
      quantity_received: 0,
      unit: '',
      unit_cost: 0,
      line_total: 0,
      batch_number: '',
      expiry_date: '',
      manufacture_date: '',
    },
  ]);

  useEffect(() => {
    fetchGRNs();
    fetchSuppliers();
    fetchProducts();
  }, []);

  useEffect(() => {
    filterGRNs();
  }, [searchTerm, statusFilter, grns]);

  useEffect(() => {
    if (formData.supplier_id) {
      fetchPurchaseOrders(formData.supplier_id);
    }
  }, [formData.supplier_id]);

  const fetchGRNs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('goods_receipt_notes')
        .select(`
          *,
          suppliers (
            id,
            company_name,
            contact_person,
            phone
          ),
          goods_receipt_items (
            *,
            products (
              id,
              product_name,
              product_code,
              unit
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGRNs(data || []);
    } catch (error: any) {
      console.error('Error fetching GRNs:', error.message);
      alert('Failed to load GRNs');
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, company_name')
        .eq('is_active', true)
        .order('company_name');

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error: any) {
      console.error('Error fetching suppliers:', error.message);
    }
  };

  const fetchPurchaseOrders = async (supplierId: string) => {
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          id,
          po_number,
          purchase_order_items (
            id,
            product_id,
            description,
            quantity,
            quantity_received,
            unit,
            unit_price,
            products (
              id,
              product_name,
              product_code,
              unit
            )
          )
        `)
        .eq('supplier_id', supplierId)
        .eq('status', 'approved')
        .order('po_date', { ascending: false });

      if (error) throw error;
      setPurchaseOrders(data || []);
    } catch (error: any) {
      console.error('Error fetching purchase orders:', error.message);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, product_name, product_code, unit, default_purchase_price')
        .eq('is_active', true)
        .order('product_name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error: any) {
      console.error('Error fetching products:', error.message);
    }
  };

  const filterGRNs = () => {
    let filtered = grns;

    if (searchTerm) {
      filtered = filtered.filter(grn =>
        grn.grn_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        grn.po_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        grn.suppliers?.company_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(grn => grn.status === statusFilter);
    }

    setFilteredGRNs(filtered);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; label: string }> = {
      draft: { color: 'bg-gray-100 text-gray-800', label: 'Draft' },
      posted: { color: 'bg-green-100 text-green-800', label: 'Posted' },
    };

    const config = statusConfig[status] || statusConfig.draft;
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const formatCurrency = (amount: number, currency: string) => {
    const formatted = amount.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return currency === 'USD' ? `$ ${formatted}` : `Rp ${formatted}`;
  };

  const handleCreateNew = () => {
    setEditingGRN(null);
    setFormData({
      supplier_id: '',
      po_id: '',
      grn_date: new Date().toISOString().split('T')[0],
      supplier_invoice_number: '',
      supplier_invoice_date: '',
      delivery_note_number: '',
      received_by: profile?.full_name || '',
      currency: 'IDR',
      exchange_rate: 1,
      notes: '',
    });
    setGRNItems([
      {
        line_number: 1,
        product_id: '',
        description: '',
        quantity_received: 0,
        unit: '',
        unit_cost: 0,
        line_total: 0,
        batch_number: '',
        expiry_date: '',
        manufacture_date: '',
      },
    ]);
    setShowCreateModal(true);
  };

  const handlePOChange = (poId: string) => {
    setFormData({ ...formData, po_id: poId });

    if (poId) {
      const po = purchaseOrders.find(p => p.id === poId);
      if (po && po.purchase_order_items) {
        const items = po.purchase_order_items
          .filter(item => item.quantity_received < item.quantity)
          .map((item, index) => ({
            line_number: index + 1,
            po_item_id: item.id,
            product_id: item.product_id,
            description: item.products?.product_name || item.description,
            quantity_received: item.quantity - item.quantity_received,
            unit: item.unit,
            unit_cost: item.unit_price,
            line_total: (item.quantity - item.quantity_received) * item.unit_price,
            batch_number: '',
            expiry_date: '',
            manufacture_date: '',
          }));

        if (items.length > 0) {
          setGRNItems(items);
        }
      }
    }
  };

  const handleProductChange = (index: number, productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      const newItems = [...grnItems];
      newItems[index] = {
        ...newItems[index],
        product_id: productId,
        description: product.product_name,
        unit: product.unit,
        unit_cost: (product as any).default_purchase_price || 0,
      };
      calculateLineTotal(index, newItems);
      setGRNItems(newItems);
    }
  };

  const calculateLineTotal = (index: number, items: GRNItem[]) => {
    const item = items[index];
    items[index].line_total = item.quantity_received * item.unit_cost;
  };

  const addGRNItem = () => {
    setGRNItems([
      ...grnItems,
      {
        line_number: grnItems.length + 1,
        product_id: '',
        description: '',
        quantity_received: 0,
        unit: '',
        unit_cost: 0,
        line_total: 0,
        batch_number: '',
        expiry_date: '',
        manufacture_date: '',
      },
    ]);
  };

  const removeGRNItem = (index: number) => {
    if (grnItems.length > 1) {
      setGRNItems(grnItems.filter((_, i) => i !== index));
    }
  };

  const calculateTotals = () => {
    const subtotal = grnItems.reduce((sum, item) => sum + item.line_total, 0);
    const tax = subtotal * 0.11; // 11% PPN
    const total = subtotal + tax;
    const totalQty = grnItems.reduce((sum, item) => sum + item.quantity_received, 0);
    return { subtotal, tax, total, totalQty };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.supplier_id) {
      alert('Please select a supplier');
      return;
    }

    if (grnItems.length === 0 || !grnItems[0].product_id) {
      alert('Please add at least one product');
      return;
    }

    try {
      const { subtotal, tax, total, totalQty } = calculateTotals();

      const grnData = {
        ...formData,
        subtotal,
        tax_amount: tax,
        total_amount: total,
        total_quantity: totalQty,
        status: 'draft',
        created_by: user?.id,
      };

      const { data: newGRN, error: grnError } = await supabase
        .from('goods_receipt_notes')
        .insert(grnData)
        .select()
        .single();

      if (grnError) throw grnError;

      // Insert items
      const itemsToInsert = grnItems.map((item, index) => ({
        ...item,
        grn_id: newGRN.id,
        line_number: index + 1,
      }));

      const { error: itemsError } = await supabase
        .from('goods_receipt_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      alert('GRN created successfully!');
      setShowCreateModal(false);
      fetchGRNs();
    } catch (error: any) {
      console.error('Error saving GRN:', error);
      alert('Failed to save GRN: ' + error.message);
    }
  };

  const handlePost = async (grnId: string) => {
    if (!confirm('Post this GRN? This will create batches and cannot be undone.')) return;

    try {
      const { error } = await supabase
        .from('goods_receipt_notes')
        .update({ status: 'posted' })
        .eq('id', grnId);

      if (error) throw error;

      alert('GRN posted successfully! Batches created and accounting entries posted.');
      fetchGRNs();
    } catch (error: any) {
      console.error('Error posting GRN:', error);
      alert('Failed to post GRN: ' + error.message);
    }
  };

  const handleDelete = async (grnId: string) => {
    if (!confirm('Are you sure you want to delete this GRN?')) return;

    try {
      const { error } = await supabase
        .from('goods_receipt_notes')
        .delete()
        .eq('id', grnId);

      if (error) throw error;

      alert('GRN deleted successfully!');
      fetchGRNs();
    } catch (error: any) {
      console.error('Error deleting GRN:', error);
      alert('Failed to delete GRN: ' + error.message);
    }
  };

  const handleView = (grn: GoodsReceiptNote) => {
    setSelectedGRN(grn);
    setShowViewModal(true);
  };

  const handlePrint = (grn: GoodsReceiptNote) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const supplier = grn.suppliers;
    const items = grn.goods_receipt_items || [];

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Goods Receipt Note - ${grn.grn_number}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          .header { text-align: center; margin-bottom: 30px; }
          .company-name { font-size: 24px; font-weight: bold; }
          .doc-title { font-size: 20px; margin-top: 10px; }
          .info-section { display: flex; justify-content: space-between; margin: 20px 0; }
          .info-box { flex: 1; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f8f9fa; }
          .text-right { text-align: right; }
          .totals { margin-left: auto; width: 300px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">PT. SHUBHAM ANZEN PHARMA JAYA</div>
          <div class="doc-title">GOODS RECEIPT NOTE</div>
        </div>

        <div class="info-section">
          <div class="info-box">
            <strong>Supplier:</strong><br/>
            ${supplier?.company_name}<br/>
            ${grn.supplier_invoice_number ? `<strong>Supplier Invoice:</strong> ${grn.supplier_invoice_number}<br/>` : ''}
            ${grn.delivery_note_number ? `<strong>Delivery Note:</strong> ${grn.delivery_note_number}<br/>` : ''}
          </div>
          <div class="info-box">
            <strong>GRN Number:</strong> ${grn.grn_number}<br/>
            <strong>GRN Date:</strong> ${new Date(grn.grn_date).toLocaleDateString()}<br/>
            ${grn.po_number ? `<strong>PO Number:</strong> ${grn.po_number}<br/>` : ''}
            <strong>Received By:</strong> ${grn.received_by || 'N/A'}<br/>
            <strong>Status:</strong> ${grn.status.toUpperCase()}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>No.</th>
              <th>Product</th>
              <th>Batch Number</th>
              <th>Expiry Date</th>
              <th class="text-right">Qty Received</th>
              <th>Unit</th>
              <th class="text-right">Unit Cost</th>
              <th class="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${item.products?.product_name || item.description}</td>
                <td>${item.batch_number || 'Auto-generated'}</td>
                <td>${item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : 'N/A'}</td>
                <td class="text-right">${item.quantity_received}</td>
                <td>${item.unit}</td>
                <td class="text-right">${formatCurrency(item.unit_cost, grn.currency)}</td>
                <td class="text-right">${formatCurrency(item.line_total, grn.currency)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="totals">
          <table>
            <tr>
              <td>Subtotal:</td>
              <td class="text-right">${formatCurrency(grn.subtotal, grn.currency)}</td>
            </tr>
            <tr>
              <td>Tax (11%):</td>
              <td class="text-right">${formatCurrency(grn.tax_amount, grn.currency)}</td>
            </tr>
            <tr style="font-weight: bold;">
              <td>Total:</td>
              <td class="text-right">${formatCurrency(grn.total_amount, grn.currency)}</td>
            </tr>
          </table>
        </div>

        ${grn.notes ? `<div style="margin-top: 20px;"><strong>Notes:</strong><br/>${grn.notes}</div>` : ''}

        <script>
          window.print();
          window.onafterprint = () => window.close();
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Goods Receipt Notes</h1>
            <p className="text-gray-600">Record received goods and create batches</p>
          </div>
          <button
            onClick={handleCreateNew}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-5 w-5" />
            New GRN
          </button>
        </div>

        {/* Filters */}
        <div className="mb-6 flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search GRN number, PO, supplier..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="posted">Posted</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">GRN Number</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO Number</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredGRNs.map((grn) => (
                <tr key={grn.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {grn.grn_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(grn.grn_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {grn.suppliers?.company_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {grn.po_number || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                    {formatCurrency(grn.total_amount, grn.currency)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(grn.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleView(grn)}
                        className="text-blue-600 hover:text-blue-800"
                        title="View"
                      >
                        <Eye className="h-5 w-5" />
                      </button>
                      {grn.status === 'draft' && (
                        <>
                          <button
                            onClick={() => handleDelete(grn.id)}
                            className="text-red-600 hover:text-red-800"
                            title="Delete"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handlePost(grn.id)}
                            className="text-green-600 hover:text-green-800"
                            title="Post GRN"
                          >
                            <CheckCircle className="h-5 w-5" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handlePrint(grn)}
                        className="text-gray-600 hover:text-gray-800"
                        title="Print"
                      >
                        <Download className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredGRNs.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No goods receipt notes found
            </div>
          )}
        </div>

        {/* Create Modal - Continuing in next part due to length */}
        {showCreateModal && (
          <Modal
            isOpen={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            title="New Goods Receipt Note"
            maxWidth="max-w-6xl"
          >
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Supplier *</label>
                  <select
                    value={formData.supplier_id}
                    onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.company_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Order</label>
                  <select
                    value={formData.po_id}
                    onChange={(e) => handlePOChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    disabled={!formData.supplier_id}
                  >
                    <option value="">Select PO (optional)</option>
                    {purchaseOrders.map((po) => (
                      <option key={po.id} value={po.id}>
                        {po.po_number}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">GRN Date</label>
                  <input
                    type="date"
                    value={formData.grn_date}
                    onChange={(e) => setFormData({ ...formData, grn_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Supplier Invoice No.</label>
                  <input
                    type="text"
                    value={formData.supplier_invoice_number}
                    onChange={(e) => setFormData({ ...formData, supplier_invoice_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Date</label>
                  <input
                    type="date"
                    value={formData.supplier_invoice_date}
                    onChange={(e) => setFormData({ ...formData, supplier_invoice_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Note No.</label>
                  <input
                    type="text"
                    value={formData.delivery_note_number}
                    onChange={(e) => setFormData({ ...formData, delivery_note_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-sm font-medium text-gray-700">Items</label>
                  <button
                    type="button"
                    onClick={addGRNItem}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    + Add Item
                  </button>
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {grnItems.map((item, index) => (
                    <div key={index} className="border rounded-lg p-3 space-y-2">
                      <div className="grid grid-cols-6 gap-2">
                        <div className="col-span-2">
                          <label className="block text-xs text-gray-600 mb-1">Product *</label>
                          <select
                            value={item.product_id}
                            onChange={(e) => handleProductChange(index, e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                            required
                          >
                            <option value="">Select Product</option>
                            {products.map((product) => (
                              <option key={product.id} value={product.id}>
                                {product.product_name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Qty Received *</label>
                          <input
                            type="number"
                            value={item.quantity_received}
                            onChange={(e) => {
                              const newItems = [...grnItems];
                              newItems[index].quantity_received = parseFloat(e.target.value) || 0;
                              calculateLineTotal(index, newItems);
                              setGRNItems(newItems);
                            }}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Unit Cost *</label>
                          <input
                            type="number"
                            value={item.unit_cost}
                            onChange={(e) => {
                              const newItems = [...grnItems];
                              newItems[index].unit_cost = parseFloat(e.target.value) || 0;
                              calculateLineTotal(index, newItems);
                              setGRNItems(newItems);
                            }}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Total</label>
                          <input
                            type="text"
                            value={formatCurrency(item.line_total, formData.currency)}
                            readOnly
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded bg-gray-50"
                          />
                        </div>
                        <div className="flex items-end">
                          {grnItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeGRNItem(index)}
                              className="text-red-600 hover:text-red-800 p-1"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Batch Number</label>
                          <input
                            type="text"
                            value={item.batch_number}
                            onChange={(e) => {
                              const newItems = [...grnItems];
                              newItems[index].batch_number = e.target.value;
                              setGRNItems(newItems);
                            }}
                            placeholder="Auto-generated if empty"
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Expiry Date</label>
                          <input
                            type="date"
                            value={item.expiry_date}
                            onChange={(e) => {
                              const newItems = [...grnItems];
                              newItems[index].expiry_date = e.target.value;
                              setGRNItems(newItems);
                            }}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Manufacture Date</label>
                          <input
                            type="date"
                            value={item.manufacture_date}
                            onChange={(e) => {
                              const newItems = [...grnItems];
                              newItems[index].manufacture_date = e.target.value;
                              setGRNItems(newItems);
                            }}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="border-t pt-4">
                <div className="flex justify-end">
                  <div className="w-64 space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span className="font-medium">{formatCurrency(calculateTotals().subtotal, formData.currency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tax (11%):</span>
                      <span className="font-medium">{formatCurrency(calculateTotals().tax, formData.currency)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold border-t pt-2">
                      <span>Total:</span>
                      <span>{formatCurrency(calculateTotals().total, formData.currency)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create GRN
                </button>
              </div>
            </form>
          </Modal>
        )}

        {/* View Modal */}
        {showViewModal && selectedGRN && (
          <Modal
            isOpen={showViewModal}
            onClose={() => setShowViewModal(false)}
            title={`GRN: ${selectedGRN.grn_number}`}
            maxWidth="max-w-4xl"
          >
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-2">Supplier Information</h3>
                  <div className="space-y-1 text-sm">
                    <p><strong>Supplier:</strong> {selectedGRN.suppliers?.company_name}</p>
                    <p><strong>Invoice No:</strong> {selectedGRN.supplier_invoice_number || 'N/A'}</p>
                    <p><strong>Delivery Note:</strong> {selectedGRN.delivery_note_number || 'N/A'}</p>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">GRN Details</h3>
                  <div className="space-y-1 text-sm">
                    <p><strong>GRN Number:</strong> {selectedGRN.grn_number}</p>
                    <p><strong>GRN Date:</strong> {new Date(selectedGRN.grn_date).toLocaleDateString()}</p>
                    <p><strong>PO Number:</strong> {selectedGRN.po_number || 'N/A'}</p>
                    <p><strong>Received By:</strong> {selectedGRN.received_by || 'N/A'}</p>
                    <p><strong>Status:</strong> {getStatusBadge(selectedGRN.status)}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Items Received</h3>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Product</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Batch</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Qty</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Unit Cost</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Total</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {selectedGRN.goods_receipt_items?.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-2 text-sm">{item.products?.product_name}</td>
                        <td className="px-4 py-2 text-sm">{item.batch_number || 'Auto'}</td>
                        <td className="px-4 py-2 text-sm text-right">{item.quantity_received} {item.unit}</td>
                        <td className="px-4 py-2 text-sm text-right">{formatCurrency(item.unit_cost, selectedGRN.currency)}</td>
                        <td className="px-4 py-2 text-sm text-right font-medium">{formatCurrency(item.line_total, selectedGRN.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end">
                <div className="w-64 space-y-2 border-t pt-4">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(selectedGRN.subtotal, selectedGRN.currency)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Tax:</span>
                    <span>{formatCurrency(selectedGRN.tax_amount, selectedGRN.currency)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Total:</span>
                    <span>{formatCurrency(selectedGRN.total_amount, selectedGRN.currency)}</span>
                  </div>
                </div>
              </div>

              {selectedGRN.notes && (
                <div>
                  <h3 className="font-semibold mb-2">Notes</h3>
                  <p className="text-sm text-gray-600">{selectedGRN.notes}</p>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => handlePrint(selectedGRN)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Print GRN
                </button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </Layout>
  );
}
