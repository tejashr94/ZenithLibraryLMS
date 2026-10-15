// src/pages/PaymentsPage.jsx  — Step 3 will implement full functionality
import React from 'react';
import { CreditCard, Plus } from 'lucide-react';
import EmptyState from '../components/ui/EmptyState';

export default function PaymentsPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Payments</h1>
          <p className="page-subtitle">Record and track fee payments</p>
        </div>
        <button className="btn btn-primary" id="record-payment-btn">
          <Plus size={16} />
          Record Payment
        </button>
      </div>

      <EmptyState
        icon={CreditCard}
        title="Fee Management Coming in Step 3"
        description="Payment recording, advance fee tracking, monthly ledger, and receipt generation will be implemented in Step 3."
      />
    </div>
  );
}
