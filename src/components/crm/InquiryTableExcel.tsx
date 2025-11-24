import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import {
  ChevronDown, X, Mail, Phone, FileText, Calendar,
  Flame, ArrowUp, Minus, Send, MessageSquare, CheckSquare
} from 'lucide-react';
import { Modal } from '../Modal';
import { EmailComposerEnhanced } from './EmailComposerEnhanced';
import { TaskFormModal } from '../tasks/TaskFormModal';

interface Inquiry {
  id: string;
  inquiry_number: string;
  inquiry_date: string;
  product_name: string;
  specification?: string | null;
  quantity: string;
  supplier_name: string | null;
  supplier_country: string | null;
  company_name: string;
  contact_person: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  email_subject?: string | null;
  status: string;
  priority: string;
  coa_sent: boolean;
  msds_sent: boolean;
  sample_sent: boolean;
  price_quoted: boolean;
  remarks: string | null;
}

interface ColumnFilter {
  column: string;
  values: string[];
}

interface InquiryTableProps {
  inquiries: Inquiry[];
  onRefresh: () => void;
  canManage: boolean;
}

export function InquiryTableExcel({ inquiries, onRefresh, canManage }: InquiryTableProps) {
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<ColumnFilter[]>([]);
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [filteredData, setFilteredData] = useState<Inquiry[]>(inquiries);
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [selectedInquiryForEmail, setSelectedInquiryForEmail] = useState<Inquiry | null>(null);
  const [logCallModalOpen, setLogCallModalOpen] = useState(false);
  const [callNotes, setCallNotes] = useState('');
  const [followUpModalOpen, setFollowUpModalOpen] = useState(false);
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpNotes, setFollowUpNotes] = useState('');
  const [createTaskModalOpen, setCreateTaskModalOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  const statusOptions = [
    { value: 'new', label: 'New' },
    { value: 'price_quoted', label: 'Price Quoted' },
    { value: 'coa_pending', label: 'COA Pending' },
    { value: 'sample_sent', label: 'Sample Sent' },
    { value: 'negotiation', label: 'Negotiation' },
    { value: 'po_received', label: 'PO Received' },
    { value: 'won', label: 'Won' },
    { value: 'lost', label: 'Lost' },
    { value: 'on_hold', label: 'On Hold' },
  ];

  const priorityOptions = [
    { value: 'urgent', label: 'Urgent', icon: <Flame className="w-3 h-3 text-red-600" /> },
    { value: 'high', label: 'High', icon: <ArrowUp className="w-3 h-3 text-orange-600" /> },
    { value: 'medium', label: 'Medium', icon: <Minus className="w-3 h-3 text-gray-400" /> },
    { value: 'low', label: 'Low', icon: <Minus className="w-3 h-3 text-gray-300" /> },
  ];

  useEffect(() => {
    applyFilters();
  }, [inquiries, filters]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setOpenFilter(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const applyFilters = () => {
    let result = [...inquiries];

    filters.forEach(filter => {
      if (filter.values.length > 0) {
        result = result.filter(row => {
          const value = row[filter.column as keyof Inquiry];
          return filter.values.includes(String(value || ''));
        });
      }
    });

    setFilteredData(result);
  };

  const toggleFilter = (column: string, value: string) => {
    setFilters(prev => {
      const existing = prev.find(f => f.column === column);
      if (existing) {
        const newValues = existing.values.includes(value)
          ? existing.values.filter(v => v !== value)
          : [...existing.values, value];

        if (newValues.length === 0) {
          return prev.filter(f => f.column !== column);
        }
        return prev.map(f => f.column === column ? { ...f, values: newValues } : f);
      }
      return [...prev, { column, values: [value] }];
    });
  };

  const clearColumnFilter = (column: string) => {
    setFilters(prev => prev.filter(f => f.column !== column));
  };

  const getUniqueValues = (column: keyof Inquiry) => {
    const values = inquiries.map(i => i[column]);
    return [...new Set(values)].filter(Boolean).sort();
  };

  const isColumnFiltered = (column: string) => {
    return filters.some(f => f.column === column && f.values.length > 0);
  };

  const toggleRowSelection = (id: string) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.clear(); // Only allow single selection
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedRows.size === filteredData.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredData.map(i => i.id)));
    }
  };

  const startEditing = (inquiry: Inquiry, field: keyof Inquiry) => {
    if (!canManage) return;
    setEditingCell({ id: inquiry.id, field: field as string });
    setEditValue(String(inquiry[field] || ''));
  };

  const saveEdit = async () => {
    if (!editingCell) return;

    try {
      const { error } = await supabase
        .from('crm_inquiries')
        .update({ [editingCell.field]: editValue || null })
        .eq('id', editingCell.id);

      if (error) throw error;
      setEditingCell(null);
      onRefresh();
    } catch (error) {
      console.error('Error updating field:', error);
      alert('Failed to update. Please try again.');
    }
  };

  const updateStatus = async (inquiry: Inquiry, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('crm_inquiries')
        .update({ status: newStatus })
        .eq('id', inquiry.id);

      if (error) throw error;
      onRefresh();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const updatePriority = async (inquiry: Inquiry, newPriority: string) => {
    try {
      const { error } = await supabase
        .from('crm_inquiries')
        .update({ priority: newPriority })
        .eq('id', inquiry.id);

      if (error) throw error;
      onRefresh();
    } catch (error) {
      console.error('Error updating priority:', error);
    }
  };

  const handleSendQuote = () => {
    const selectedInquiry = filteredData.find(i => selectedRows.has(i.id));
    if (selectedInquiry) {
      setSelectedInquiryForEmail(selectedInquiry);
      setEmailModalOpen(true);
    }
  };

  const handleSendCOAMSDS = async () => {
    const selectedInquiry = filteredData.find(i => selectedRows.has(i.id));
    if (!selectedInquiry) return;

    setSelectedInquiryForEmail(selectedInquiry);
    setEmailModalOpen(true);
  };

  const handleLogCall = () => {
    setLogCallModalOpen(true);
  };

  const saveLogCall = async () => {
    const selectedInquiry = filteredData.find(i => selectedRows.has(i.id));
    if (!selectedInquiry) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      await supabase.from('crm_activities').insert({
        inquiry_id: selectedInquiry.id,
        activity_type: 'call',
        description: callNotes,
        activity_date: new Date().toISOString().split('T')[0],
        is_completed: true,
        created_by: user.id,
      });

      setLogCallModalOpen(false);
      setCallNotes('');
      alert('Call logged successfully!');
      onRefresh();
    } catch (error) {
      console.error('Error logging call:', error);
      alert('Failed to log call. Please try again.');
    }
  };

  const handleScheduleFollowUp = () => {
    setFollowUpModalOpen(true);
  };

  const saveFollowUp = async () => {
    const selectedInquiry = filteredData.find(i => selectedRows.has(i.id));
    if (!selectedInquiry) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      await supabase.from('crm_activities').insert({
        inquiry_id: selectedInquiry.id,
        activity_type: 'follow_up',
        description: followUpNotes,
        activity_date: new Date().toISOString().split('T')[0],
        follow_up_date: followUpDate,
        is_completed: false,
        created_by: user.id,
      });

      setFollowUpModalOpen(false);
      setFollowUpDate('');
      setFollowUpNotes('');
      alert('Follow-up scheduled successfully!');
      onRefresh();
    } catch (error) {
      console.error('Error scheduling follow-up:', error);
      alert('Failed to schedule follow-up. Please try again.');
    }
  };

  const selectedInquiry = filteredData.find(i => selectedRows.has(i.id));

  return (
    <div className="space-y-4">
      {/* Quick Actions Bar */}
      {selectedRows.size > 0 && canManage && selectedInquiry && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-sm font-medium text-blue-900">
                Selected: <span className="font-bold">{selectedInquiry.inquiry_number}</span> - {selectedInquiry.product_name}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSendQuote}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
              >
                <Send className="w-4 h-4" />
                Send Price Quote
              </button>
              <button
                onClick={handleSendCOAMSDS}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
              >
                <FileText className="w-4 h-4" />
                Send COA/MSDS
              </button>
              <button
                onClick={handleLogCall}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm"
              >
                <Phone className="w-4 h-4" />
                Log Call
              </button>
              <button
                onClick={handleScheduleFollowUp}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition text-sm"
              >
                <Calendar className="w-4 h-4" />
                Schedule Follow-up
              </button>
              <button
                onClick={() => setCreateTaskModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm"
              >
                <CheckSquare className="w-4 h-4" />
                Create Task
              </button>
              <button
                onClick={() => setSelectedRows(new Set())}
                className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg transition"
                title="Deselect"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Excel-like Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-50">
              <tr className="border-b border-gray-300">
                <th className="px-3 py-2 border-r border-gray-300">
                  <input
                    type="checkbox"
                    checked={selectedRows.size === filteredData.length && filteredData.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300"
                  />
                </th>

                {/* Inquiry Number */}
                <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-300 whitespace-nowrap">
                  No.
                </th>

                {/* Date */}
                <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-300 whitespace-nowrap">
                  Date
                </th>

                {/* Product */}
                <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-300 min-w-[200px]">
                  Product
                </th>

                {/* Specification */}
                <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-300 min-w-[150px]">
                  Specification
                </th>

                {/* Quantity */}
                <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-300">
                  Qty
                </th>

                {/* Supplier */}
                <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-300 min-w-[150px]">
                  Supplier
                </th>

                {/* Company */}
                <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-300 min-w-[150px]">
                  Company
                </th>

                {/* Status with filter */}
                <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-300 relative">
                  <div className="flex items-center justify-between gap-2">
                    <span>Status</span>
                    <button
                      onClick={() => setOpenFilter(openFilter === 'status' ? null : 'status')}
                      className={`p-0.5 rounded hover:bg-gray-200 ${isColumnFiltered('status') ? 'text-blue-600' : ''}`}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                  {openFilter === 'status' && (
                    <div ref={filterRef} className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 w-56">
                      <div className="p-2 border-b border-gray-200 flex items-center justify-between">
                        <span className="text-xs font-medium">Filter Status</span>
                        {isColumnFiltered('status') && (
                          <button
                            onClick={() => clearColumnFilter('status')}
                            className="text-xs text-blue-600 hover:text-blue-700"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <div className="p-2 max-h-64 overflow-y-auto">
                        {statusOptions.map(option => {
                          const isSelected = filters.find(f => f.column === 'status')?.values.includes(option.value);
                          return (
                            <label key={option.value} className="flex items-center gap-2 p-1.5 hover:bg-gray-50 rounded cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleFilter('status', option.value)}
                                className="rounded border-gray-300"
                              />
                              <span className="text-sm">{option.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </th>

                {/* Priority with filter */}
                <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-300 relative">
                  <div className="flex items-center justify-between gap-2">
                    <span>Priority</span>
                    <button
                      onClick={() => setOpenFilter(openFilter === 'priority' ? null : 'priority')}
                      className={`p-0.5 rounded hover:bg-gray-200 ${isColumnFiltered('priority') ? 'text-blue-600' : ''}`}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                  {openFilter === 'priority' && (
                    <div ref={filterRef} className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 w-48">
                      <div className="p-2 border-b border-gray-200 flex items-center justify-between">
                        <span className="text-xs font-medium">Filter Priority</span>
                        {isColumnFiltered('priority') && (
                          <button
                            onClick={() => clearColumnFilter('priority')}
                            className="text-xs text-blue-600 hover:text-blue-700"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <div className="p-2">
                        {priorityOptions.map(option => {
                          const isSelected = filters.find(f => f.column === 'priority')?.values.includes(option.value);
                          return (
                            <label key={option.value} className="flex items-center gap-2 p-1.5 hover:bg-gray-50 rounded cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleFilter('priority', option.value)}
                                className="rounded border-gray-300"
                              />
                              {option.icon}
                              <span className="text-sm">{option.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </th>

                {/* Remarks */}
                <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-300 min-w-[200px]">
                  Remarks
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-3 py-8 text-center text-gray-500">
                    No inquiries found
                  </td>
                </tr>
              ) : (
                filteredData.map((inquiry) => (
                  <tr
                    key={inquiry.id}
                    className={`border-b border-gray-200 hover:bg-blue-50 transition ${
                      selectedRows.has(inquiry.id) ? 'bg-blue-100' : ''
                    }`}
                  >
                    <td className="px-3 py-2 border-r border-gray-200">
                      <input
                        type="checkbox"
                        checked={selectedRows.has(inquiry.id)}
                        onChange={() => toggleRowSelection(inquiry.id)}
                        className="rounded border-gray-300"
                      />
                    </td>

                    <td className="px-3 py-2 border-r border-gray-200 font-medium text-blue-600">
                      {inquiry.inquiry_number}
                    </td>

                    <td className="px-3 py-2 border-r border-gray-200 text-gray-600 whitespace-nowrap">
                      {new Date(inquiry.inquiry_date).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>

                    <td className="px-3 py-2 border-r border-gray-200">
                      {editingCell?.id === inquiry.id && editingCell?.field === 'product_name' ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={saveEdit}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit();
                            if (e.key === 'Escape') setEditingCell(null);
                          }}
                          className="w-full px-2 py-1 border-2 border-blue-500 rounded focus:outline-none"
                          autoFocus
                        />
                      ) : (
                        <div
                          onDoubleClick={() => startEditing(inquiry, 'product_name')}
                          className="cursor-text hover:bg-yellow-50 px-2 py-1 rounded"
                        >
                          {inquiry.product_name}
                        </div>
                      )}
                    </td>

                    <td className="px-3 py-2 border-r border-gray-200 text-gray-600 text-xs">
                      {editingCell?.id === inquiry.id && editingCell?.field === 'specification' ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={saveEdit}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit();
                            if (e.key === 'Escape') setEditingCell(null);
                          }}
                          className="w-full px-2 py-1 border-2 border-blue-500 rounded focus:outline-none text-xs"
                          autoFocus
                        />
                      ) : (
                        <div
                          onDoubleClick={() => startEditing(inquiry, 'specification')}
                          className="cursor-text hover:bg-yellow-50 px-2 py-1 rounded"
                        >
                          {inquiry.specification || '-'}
                        </div>
                      )}
                    </td>

                    <td className="px-3 py-2 border-r border-gray-200">
                      {editingCell?.id === inquiry.id && editingCell?.field === 'quantity' ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={saveEdit}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit();
                            if (e.key === 'Escape') setEditingCell(null);
                          }}
                          className="w-full px-2 py-1 border-2 border-blue-500 rounded focus:outline-none"
                          autoFocus
                        />
                      ) : (
                        <div
                          onDoubleClick={() => startEditing(inquiry, 'quantity')}
                          className="cursor-text hover:bg-yellow-50 px-2 py-1 rounded"
                        >
                          {inquiry.quantity}
                        </div>
                      )}
                    </td>

                    <td className="px-3 py-2 border-r border-gray-200">
                      {editingCell?.id === inquiry.id && editingCell?.field === 'supplier_name' ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={saveEdit}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit();
                            if (e.key === 'Escape') setEditingCell(null);
                          }}
                          className="w-full px-2 py-1 border-2 border-blue-500 rounded focus:outline-none"
                          autoFocus
                        />
                      ) : (
                        <div
                          onDoubleClick={() => startEditing(inquiry, 'supplier_name')}
                          className="cursor-text hover:bg-yellow-50 px-2 py-1 rounded"
                        >
                          <div>{inquiry.supplier_name || '-'}</div>
                          {inquiry.supplier_country && (
                            <div className="text-xs text-gray-500">{inquiry.supplier_country}</div>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="px-3 py-2 border-r border-gray-200">
                      {editingCell?.id === inquiry.id && editingCell?.field === 'company_name' ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={saveEdit}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit();
                            if (e.key === 'Escape') setEditingCell(null);
                          }}
                          className="w-full px-2 py-1 border-2 border-blue-500 rounded focus:outline-none"
                          autoFocus
                        />
                      ) : (
                        <div
                          onDoubleClick={() => startEditing(inquiry, 'company_name')}
                          className="cursor-text hover:bg-yellow-50 px-2 py-1 rounded"
                        >
                          {inquiry.company_name}
                        </div>
                      )}
                    </td>

                    <td className="px-3 py-2 border-r border-gray-200">
                      <select
                        value={inquiry.status}
                        onChange={(e) => updateStatus(inquiry, e.target.value)}
                        disabled={!canManage}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:border-blue-500 focus:outline-none cursor-pointer"
                      >
                        {statusOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </td>

                    <td className="px-3 py-2 border-r border-gray-200">
                      <select
                        value={inquiry.priority}
                        onChange={(e) => updatePriority(inquiry, e.target.value)}
                        disabled={!canManage}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:border-blue-500 focus:outline-none cursor-pointer"
                      >
                        {priorityOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </td>

                    <td className="px-3 py-2 border-r border-gray-200">
                      {editingCell?.id === inquiry.id && editingCell?.field === 'remarks' ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={saveEdit}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit();
                            if (e.key === 'Escape') setEditingCell(null);
                          }}
                          className="w-full px-2 py-1 border-2 border-blue-500 rounded focus:outline-none"
                          autoFocus
                        />
                      ) : (
                        <div
                          onDoubleClick={() => startEditing(inquiry, 'remarks')}
                          className="cursor-text hover:bg-yellow-50 px-2 py-1 rounded text-gray-600"
                        >
                          {inquiry.remarks || '-'}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Email Composer Modal */}
      {emailModalOpen && selectedInquiryForEmail && (
        <EmailComposerEnhanced
          isOpen={emailModalOpen}
          onClose={() => {
            setEmailModalOpen(false);
            setSelectedInquiryForEmail(null);
            onRefresh();
          }}
          inquiry={selectedInquiryForEmail}
        />
      )}

      {/* Log Call Modal */}
      <Modal
        isOpen={logCallModalOpen}
        onClose={() => {
          setLogCallModalOpen(false);
          setCallNotes('');
        }}
        title="Log Phone Call"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Call Notes *
            </label>
            <textarea
              value={callNotes}
              onChange={(e) => setCallNotes(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="What was discussed during the call?"
              required
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setLogCallModalOpen(false);
                setCallNotes('');
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={saveLogCall}
              disabled={!callNotes.trim()}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              Save Call Log
            </button>
          </div>
        </div>
      </Modal>

      {/* Schedule Follow-up Modal */}
      <Modal
        isOpen={followUpModalOpen}
        onClose={() => {
          setFollowUpModalOpen(false);
          setFollowUpDate('');
          setFollowUpNotes('');
        }}
        title="Schedule Follow-up"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Follow-up Date *
            </label>
            <input
              type="date"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={followUpNotes}
              onChange={(e) => setFollowUpNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="What needs to be followed up?"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setFollowUpModalOpen(false);
                setFollowUpDate('');
                setFollowUpNotes('');
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={saveFollowUp}
              disabled={!followUpDate}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
            >
              Schedule Follow-up
            </button>
          </div>
        </div>
      </Modal>

      {/* Create Task Modal */}
      {createTaskModalOpen && selectedInquiry && (
        <TaskFormModal
          isOpen={createTaskModalOpen}
          onClose={() => setCreateTaskModalOpen(false)}
          onSuccess={() => {
            setCreateTaskModalOpen(false);
            onRefresh();
          }}
          initialData={{
            inquiry_id: selectedInquiry.id
          }}
        />
      )}
    </div>
  );
}
