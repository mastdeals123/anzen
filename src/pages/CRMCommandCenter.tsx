import { useState } from 'react';
import { Layout } from '../components/Layout';
import { EmailListPanel } from '../components/commandCenter/EmailListPanel';
import { InquiryFormPanel, InquiryFormData } from '../components/commandCenter/InquiryFormPanel';
import { QuickActionsPanel } from '../components/commandCenter/QuickActionsPanel';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Email, ParsedEmailData, Inquiry } from '../types/commandCenter';
import { CheckCircle2, Zap } from 'lucide-react';

export function CRMCommandCenter() {
  const { profile } = useAuth();
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [parsedData, setParsedData] = useState<ParsedEmailData | null>(null);
  const [createdInquiry, setCreatedInquiry] = useState<Inquiry | null>(null);
  const [saving, setSaving] = useState(false);

  const handleEmailSelect = (email: Email, data: ParsedEmailData | null) => {
    setSelectedEmail(email);
    setParsedData(data);
    setCreatedInquiry(null);
  };

  const handleSave = async (formData: InquiryFormData) => {
    if (!selectedEmail || !profile) return;

    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const inquiryData = {
        inquiry_date: new Date().toISOString().split('T')[0],
        product_name: formData.productName,
        quantity: formData.quantity,
        supplier_name: formData.supplierName || null,
        supplier_country: formData.supplierCountry || null,
        company_name: formData.companyName,
        contact_person: formData.contactPerson || null,
        contact_email: formData.contactEmail,
        contact_phone: formData.contactPhone || null,
        email_subject: selectedEmail.subject,
        email_body: selectedEmail.body,
        inquiry_source: 'email',
        status: 'new',
        priority: formData.priority,
        purpose_icons: formData.purposeIcons,
        delivery_date_expected: formData.deliveryDateExpected || null,
        ai_confidence_score: parsedData?.confidenceScore || 0.0,
        auto_detected_company: parsedData?.autoDetectedCompany || false,
        auto_detected_contact: parsedData?.autoDetectedContact || false,
        coa_sent: false,
        msds_sent: false,
        sample_sent: false,
        price_quoted: false,
        remarks: formData.remarks || null,
        assigned_to: user.id,
        created_by: user.id,
        source: 'email',
        source_email_id: selectedEmail.id,
      };

      const { data: inquiry, error: inquiryError } = await supabase
        .from('crm_inquiries')
        .insert([inquiryData])
        .select()
        .single();

      if (inquiryError) throw inquiryError;

      await supabase
        .from('crm_email_inbox')
        .update({
          is_processed: true,
          is_inquiry: true,
          converted_to_inquiry: inquiry.id,
        })
        .eq('id', selectedEmail.id);

      if (formData.coaRequested || formData.msdsRequested || formData.sampleRequested || formData.priceRequested) {
        const reminders = [];

        if (formData.coaRequested) {
          reminders.push({
            inquiry_id: inquiry.id,
            reminder_type: 'send_coa',
            title: 'Send COA to customer',
            due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
            assigned_to: user.id,
            created_by: user.id,
          });
        }

        if (formData.msdsRequested) {
          reminders.push({
            inquiry_id: inquiry.id,
            reminder_type: 'send_coa',
            title: 'Send MSDS to customer',
            due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
            assigned_to: user.id,
            created_by: user.id,
          });
        }

        if (formData.sampleRequested) {
          reminders.push({
            inquiry_id: inquiry.id,
            reminder_type: 'send_sample',
            title: 'Send sample to customer',
            due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
            assigned_to: user.id,
            created_by: user.id,
          });
        }

        if (formData.priceRequested) {
          reminders.push({
            inquiry_id: inquiry.id,
            reminder_type: 'send_price',
            title: 'Send price quote to customer',
            due_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
            assigned_to: user.id,
            created_by: user.id,
          });
        }

        if (reminders.length > 0) {
          await supabase.from('crm_reminders').insert(reminders);
        }
      }

      setCreatedInquiry(inquiry);
      setParsedData(null);

      alert(`Inquiry #${inquiry.inquiry_number} created successfully!\n\nUse Quick Actions to send documents.`);
    } catch (error: any) {
      console.error('Error creating inquiry:', error);
      if (error.message?.includes('duplicate key')) {
        alert('This inquiry number already exists. Please use a different number.');
      } else {
        alert('Failed to create inquiry. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleActionComplete = () => {
    setCreatedInquiry(null);
    setSelectedEmail(null);
    setParsedData(null);
  };

  return (
    <Layout>
      <div className="h-screen flex flex-col">
        <div className="flex-shrink-0 bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 border-b border-blue-800">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Zap className="w-7 h-7" />
                CRM Command Center
              </h1>
              <p className="text-blue-100 text-sm mt-1">
                Ultra-fast inquiry processing with AI automation
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-blue-200">Total Clicks Required</p>
              <p className="text-3xl font-bold text-white">2</p>
              <p className="text-xs text-blue-100">Email → Save</p>
            </div>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-1/4 min-w-[300px] max-w-[400px]">
            <EmailListPanel
              onEmailSelect={handleEmailSelect}
              selectedEmailId={selectedEmail?.id || null}
            />
          </div>

          <div className="flex-1">
            <InquiryFormPanel
              email={selectedEmail}
              parsedData={parsedData}
              onSave={handleSave}
              saving={saving}
            />
          </div>

          <div className="w-1/4 min-w-[300px] max-w-[400px]">
            <QuickActionsPanel
              inquiry={createdInquiry}
              onActionComplete={handleActionComplete}
            />
          </div>
        </div>

        {createdInquiry && (
          <div className="flex-shrink-0 bg-green-50 border-t border-green-200 px-6 py-3">
            <div className="flex items-center justify-center gap-2 text-green-800">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-medium">
                Inquiry #{createdInquiry.inquiry_number} created successfully! Use Quick Actions on the right →
              </span>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
