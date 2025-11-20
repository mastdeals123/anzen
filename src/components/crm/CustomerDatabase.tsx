import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Users, Upload, Search, Edit, Trash2, Building, Mail, Phone, Globe, MapPin } from 'lucide-react';
import { Modal } from '../Modal';

interface Contact {
  id: string;
  company_name: string;
  company_type: string | null;
  industry: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  website: string | null;
  contact_person: string | null;
  designation: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  customer_type: string | null;
  tags: string[] | null;
  first_contact_date: string | null;
  last_contact_date: string | null;
  total_inquiries: number;
  total_orders: number;
  lifetime_value: number;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

interface CustomerDatabaseProps {
  canManage: boolean;
}

export function CustomerDatabase({ canManage }: CustomerDatabaseProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  const [formData, setFormData] = useState({
    company_name: '',
    company_type: '',
    industry: '',
    country: '',
    city: '',
    address: '',
    website: '',
    contact_person: '',
    designation: '',
    email: '',
    phone: '',
    mobile: '',
    customer_type: 'prospect' as 'prospect' | 'active' | 'inactive' | 'vip',
    notes: '',
  });

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      const { data, error } = await supabase
        .from('crm_contacts')
        .select('*')
        .order('company_name', { ascending: true });

      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error('Error loading contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (editingContact) {
        const { error } = await supabase
          .from('crm_contacts')
          .update(formData)
          .eq('id', editingContact.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('crm_contacts')
          .insert([{
            ...formData,
            created_by: user.id,
            first_contact_date: new Date().toISOString().split('T')[0],
          }]);

        if (error) throw error;
      }

      setModalOpen(false);
      resetForm();
      loadContacts();
    } catch (error) {
      console.error('Error saving contact:', error);
      alert('Failed to save contact. Please try again.');
    }
  };

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact);
    setFormData({
      company_name: contact.company_name,
      company_type: contact.company_type || '',
      industry: contact.industry || '',
      country: contact.country || '',
      city: contact.city || '',
      address: contact.address || '',
      website: contact.website || '',
      contact_person: contact.contact_person || '',
      designation: contact.designation || '',
      email: contact.email || '',
      phone: contact.phone || '',
      mobile: contact.mobile || '',
      customer_type: (contact.customer_type as any) || 'prospect',
      notes: contact.notes || '',
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) return;

    try {
      const { error } = await supabase
        .from('crm_contacts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadContacts();
    } catch (error) {
      console.error('Error deleting contact:', error);
      alert('Failed to delete contact. Please try again.');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const contactsToImport = [];

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        const contact: any = {
          created_by: user.id,
          first_contact_date: new Date().toISOString().split('T')[0],
        };

        headers.forEach((header, index) => {
          const lowerHeader = header.toLowerCase();
          if (lowerHeader.includes('company') && lowerHeader.includes('name')) {
            contact.company_name = values[index];
          } else if (lowerHeader.includes('contact') && lowerHeader.includes('person')) {
            contact.contact_person = values[index];
          } else if (lowerHeader.includes('email')) {
            contact.email = values[index];
          } else if (lowerHeader.includes('phone')) {
            contact.phone = values[index];
          } else if (lowerHeader.includes('country')) {
            contact.country = values[index];
          } else if (lowerHeader.includes('city')) {
            contact.city = values[index];
          } else if (lowerHeader.includes('website')) {
            contact.website = values[index];
          } else if (lowerHeader.includes('industry')) {
            contact.industry = values[index];
          }
        });

        if (contact.company_name) {
          contact.customer_type = 'prospect';
          contactsToImport.push(contact);
        }
      }

      if (contactsToImport.length === 0) {
        throw new Error('No valid contacts found in CSV file');
      }

      const { error } = await supabase
        .from('crm_contacts')
        .insert(contactsToImport);

      if (error) throw error;

      alert(`Successfully imported ${contactsToImport.length} contacts!`);
      setImportModalOpen(false);
      loadContacts();
    } catch (error) {
      console.error('Error importing contacts:', error);
      alert('Failed to import contacts: ' + (error as Error).message);
    } finally {
      setImporting(false);
      if (e.target) e.target.value = '';
    }
  };

  const resetForm = () => {
    setEditingContact(null);
    setFormData({
      company_name: '',
      company_type: '',
      industry: '',
      country: '',
      city: '',
      address: '',
      website: '',
      contact_person: '',
      designation: '',
      email: '',
      phone: '',
      mobile: '',
      customer_type: 'prospect',
      notes: '',
    });
  };

  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = contact.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (contact.contact_person?.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (contact.email?.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = filterType === 'all' || contact.customer_type === filterType;
    return matchesSearch && matchesType;
  });

  const customerTypeConfig = {
    prospect: { label: 'Prospect', color: 'bg-gray-100 text-gray-800' },
    active: { label: 'Active', color: 'bg-green-100 text-green-800' },
    inactive: { label: 'Inactive', color: 'bg-red-100 text-red-800' },
    vip: { label: 'VIP', color: 'bg-purple-100 text-purple-800' },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold">Customer Database</h3>
          <span className="text-sm text-gray-500">({contacts.length} contacts)</span>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <button
              onClick={() => setImportModalOpen(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition"
            >
              <Upload className="w-4 h-4" />
              Import CSV
            </button>
            <button
              onClick={() => {
                resetForm();
                setModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Users className="w-4 h-4" />
              Add Contact
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by company, contact person, or email..."
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Types</option>
          <option value="prospect">Prospect</option>
          <option value="active">Active</option>
          <option value="vip">VIP</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Company</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Contact Person</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Email</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Phone</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Country</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Type</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Inquiries</th>
                  {canManage && <th className="px-4 py-3 text-center font-semibold text-gray-700">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredContacts.length === 0 ? (
                  <tr>
                    <td colSpan={canManage ? 8 : 7} className="px-4 py-8 text-center text-gray-500">
                      No contacts found
                    </td>
                  </tr>
                ) : (
                  filteredContacts.map((contact) => (
                    <tr key={contact.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => {
                            setSelectedContact(contact);
                            setDetailModalOpen(true);
                          }}
                          className="font-medium text-blue-600 hover:text-blue-800"
                        >
                          {contact.company_name}
                        </button>
                        {contact.industry && (
                          <div className="text-xs text-gray-500">{contact.industry}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {contact.contact_person || '-'}
                        {contact.designation && (
                          <div className="text-xs text-gray-500">{contact.designation}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{contact.email || '-'}</td>
                      <td className="px-4 py-3 text-gray-600">{contact.phone || contact.mobile || '-'}</td>
                      <td className="px-4 py-3 text-gray-600">{contact.country || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${customerTypeConfig[contact.customer_type as keyof typeof customerTypeConfig]?.color || 'bg-gray-100 text-gray-800'}`}>
                          {customerTypeConfig[contact.customer_type as keyof typeof customerTypeConfig]?.label || contact.customer_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-medium">{contact.total_inquiries}</td>
                      {canManage && (
                        <td className="px-4 py-3">
                          <div className="flex gap-2 justify-center">
                            <button
                              onClick={() => handleEdit(contact)}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(contact.id)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          resetForm();
        }}
        title={editingContact ? 'Edit Contact' : 'Add New Contact'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company Name *
              </label>
              <input
                type="text"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact Person
              </label>
              <input
                type="text"
                value={formData.contact_person}
                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Designation
              </label>
              <input
                type="text"
                value={formData.designation}
                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Purchasing Manager"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Industry
              </label>
              <input
                type="text"
                value={formData.industry}
                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Pharmaceutical"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer Type
              </label>
              <select
                value={formData.customer_type}
                onChange={(e) => setFormData({ ...formData, customer_type: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="prospect">Prospect</option>
                <option value="active">Active</option>
                <option value="vip">VIP</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Country
              </label>
              <input
                type="text"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                City
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Website
              </label>
              <input
                type="url"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="https://..."
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => {
                setModalOpen(false);
                resetForm();
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              {editingContact ? 'Update Contact' : 'Add Contact'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Import Contacts from CSV"
      >
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900 font-medium mb-2">CSV Format Instructions:</p>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• Required column: Company Name</li>
              <li>• Optional columns: Contact Person, Email, Phone, Country, City, Website, Industry</li>
              <li>• First row should contain column headers</li>
              <li>• All contacts will be imported as "Prospect" type</li>
            </ul>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select CSV File
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={handleImport}
              disabled={importing}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {importing && (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
              <p className="text-sm text-gray-600">Importing contacts...</p>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          setSelectedContact(null);
        }}
        title="Contact Details"
      >
        {selectedContact && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{selectedContact.company_name}</h3>
              {selectedContact.industry && (
                <p className="text-sm text-gray-600">{selectedContact.industry}</p>
              )}
              <div className="mt-2">
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${customerTypeConfig[selectedContact.customer_type as keyof typeof customerTypeConfig]?.color}`}>
                  {customerTypeConfig[selectedContact.customer_type as keyof typeof customerTypeConfig]?.label}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <p className="text-sm text-gray-600">Total Inquiries</p>
                <p className="text-xl font-bold text-gray-900">{selectedContact.total_inquiries}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Orders</p>
                <p className="text-xl font-bold text-gray-900">{selectedContact.total_orders}</p>
              </div>
            </div>

            {selectedContact.contact_person && (
              <div className="pt-4 border-t">
                <p className="text-sm font-medium text-gray-700 mb-2">Contact Person</p>
                <p className="text-gray-900">{selectedContact.contact_person}</p>
                {selectedContact.designation && (
                  <p className="text-sm text-gray-600">{selectedContact.designation}</p>
                )}
              </div>
            )}

            <div className="space-y-2 pt-4 border-t">
              {selectedContact.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <a href={`mailto:${selectedContact.email}`} className="text-sm text-blue-600 hover:underline">
                    {selectedContact.email}
                  </a>
                </div>
              )}
              {selectedContact.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-900">{selectedContact.phone}</span>
                </div>
              )}
              {selectedContact.website && (
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-gray-400" />
                  <a href={selectedContact.website} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                    {selectedContact.website}
                  </a>
                </div>
              )}
              {(selectedContact.country || selectedContact.city) && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-900">
                    {[selectedContact.city, selectedContact.country].filter(Boolean).join(', ')}
                  </span>
                </div>
              )}
            </div>

            {selectedContact.notes && (
              <div className="pt-4 border-t">
                <p className="text-sm font-medium text-gray-700 mb-2">Notes</p>
                <p className="text-sm text-gray-600">{selectedContact.notes}</p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                onClick={() => {
                  setDetailModalOpen(false);
                  setSelectedContact(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Close
              </button>
              {canManage && (
                <button
                  onClick={() => {
                    setDetailModalOpen(false);
                    handleEdit(selectedContact);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Edit Contact
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
