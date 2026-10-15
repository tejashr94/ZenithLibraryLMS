// src/services/mockBackend.js
// ── In-Memory / LocalStorage Backend Simulator ──────────────────────────────
// Accurately emulates Google Apps Script + Google Sheets behavior when
// VITE_APPS_SCRIPT_URL is not set or set to 'mock'.
// Persists to localStorage so refreshing preserves all changes.

const STORAGE_KEY = 'zlms_mock_sheets_v2';

function getInitialData() {
  const now = new Date().toISOString();
  return {
    users: [
      {
        id: 'USR-0001',
        name: 'System Owner',
        username: 'owner',
        role: 'OWNER',
        passwordHash: 'mock_owner_hash',
        status: 'ACTIVE',
        permissions: ['students.view', 'students.create', 'students.update', 'students.discontinue', 'payments.view', 'payments.record', 'reports.view', 'users.manage'],
        createdDate: now,
        lastLogin: now,
      },
      {
        id: 'USR-0002',
        name: 'Library Manager',
        username: 'manager',
        role: 'MANAGER',
        passwordHash: 'mock_manager_hash',
        status: 'ACTIVE',
        permissions: ['students.view', 'students.create', 'students.update', 'students.discontinue', 'payments.view', 'payments.record', 'reports.view'],
        createdDate: now,
        lastLogin: now,
      },
    ],
    students: [
      {
        registrationNumber: 'ZL-0001',
        studentName: 'Rahul Sharma',
        fatherName: 'Rajesh Sharma',
        aadhaar: '123456789012',
        aadhaarMasked: 'XXXXXXXX9012',
        phone: '9876543210',
        address: '42 Civil Lines, Model Town',
        registrationFee: 200,
        lockerCharge: 500,
        monthlyFee: 1000,
        admissionDate: '2026-01-10',
        slotPlan: 'Full Day (6 AM - 10 PM)',
        status: 'ACTIVE',
        discontinuationDate: '',
        notes: 'Enrolled for competitive exam preparation. Dedicated locker #14 assigned.',
        createdAt: '2026-01-10T10:00:00.000Z',
        updatedAt: '2026-01-10T10:00:00.000Z',
      },
      {
        registrationNumber: 'ZL-0002',
        studentName: 'Priya Verma',
        fatherName: 'Sunil Verma',
        aadhaar: '234567890123',
        aadhaarMasked: 'XXXXXXXX0123',
        phone: '9812345678',
        address: '15 Gandhi Nagar, Sector 4',
        registrationFee: 200,
        lockerCharge: 0,
        monthlyFee: 800,
        admissionDate: '2026-02-01',
        slotPlan: 'Morning (6 AM - 2 PM)',
        status: 'ACTIVE',
        discontinuationDate: '',
        notes: 'UPSC Aspirant',
        createdAt: '2026-02-01T11:00:00.000Z',
        updatedAt: '2026-02-01T11:00:00.000Z',
      },
      {
        registrationNumber: 'ZL-0003',
        studentName: 'Amit Kumar',
        fatherName: 'Mahesh Kumar',
        aadhaar: '345678901234',
        aadhaarMasked: 'XXXXXXXX1234',
        phone: '9765432109',
        address: '88 Vikas Puri, Block C',
        registrationFee: 200,
        lockerCharge: 500,
        monthlyFee: 1200,
        admissionDate: '2026-02-15',
        slotPlan: 'Evening (2 PM - 10 PM)',
        status: 'ACTIVE',
        discontinuationDate: '',
        notes: 'CA Finalist',
        createdAt: '2026-02-15T09:30:00.000Z',
        updatedAt: '2026-02-15T09:30:00.000Z',
      },
      {
        registrationNumber: 'ZL-0004',
        studentName: 'Sneha Gupta',
        fatherName: 'Ramesh Gupta',
        aadhaar: '456789012345',
        aadhaarMasked: 'XXXXXXXX2345',
        phone: '9654321098',
        address: '102 Shanti Kunj, Phase 2',
        registrationFee: 200,
        lockerCharge: 0,
        monthlyFee: 1000,
        admissionDate: '2026-03-01',
        status: 'ACTIVE',
        slotPlan: 'Full Day (6 AM - 10 PM)',
        discontinuationDate: '',
        notes: 'Medical entrance prep',
        createdAt: '2026-03-01T10:00:00.000Z',
        updatedAt: '2026-03-01T10:00:00.000Z',
      },
      {
        registrationNumber: 'ZL-0005',
        studentName: 'Vikram Singh',
        fatherName: 'Surender Singh',
        aadhaar: '567890123456',
        aadhaarMasked: 'XXXXXXXX3456',
        phone: '9543210987',
        address: '12 Circular Road',
        registrationFee: 200,
        lockerCharge: 500,
        monthlyFee: 800,
        admissionDate: '2026-01-05',
        slotPlan: 'Morning (6 AM - 2 PM)',
        status: 'INACTIVE',
        discontinuationDate: '2026-06-30',
        notes: 'Discontinued on 2026-06-30: Relocated to another city.',
        createdAt: '2026-01-05T08:00:00.000Z',
        updatedAt: '2026-06-30T17:00:00.000Z',
      },
    ],
    payments: [
      {
        paymentId: 'PAY-0001',
        registrationNumber: 'ZL-0001',
        paymentDate: '2026-10-01',
        amount: 2000,
        paymentMethod: 'UPI',
        transactionRef: 'UPI-987654321',
        receiptNumber: 'RCP-2026-0001',
        notes: 'Fees for Oct & Nov 2026',
        enteredBy: 'USR-0002',
        createdAt: '2026-10-01T10:15:00.000Z',
      },
      {
        paymentId: 'PAY-0002',
        registrationNumber: 'ZL-0002',
        paymentDate: '2026-10-05',
        amount: 800,
        paymentMethod: 'CASH',
        transactionRef: '',
        receiptNumber: 'RCP-2026-0002',
        notes: 'Fee for October 2026',
        enteredBy: 'USR-0002',
        createdAt: '2026-10-05T12:00:00.000Z',
      },
      {
        paymentId: 'PAY-0003',
        registrationNumber: 'ZL-0003',
        paymentDate: '2026-10-10',
        amount: 600,
        paymentMethod: 'UPI',
        transactionRef: 'UPI-11223344',
        receiptNumber: 'RCP-2026-0003',
        notes: 'Partial payment for Oct 2026 (Due: 1200, Balance: 600)',
        enteredBy: 'USR-0002',
        createdAt: '2026-10-10T14:30:00.000Z',
      },
    ],
    ledger: [
      // ZL-0001 Oct 2026 paid
      {
        ledgerId: 'LDG-0001',
        registrationNumber: 'ZL-0001',
        year: 2026,
        month: 10,
        monthLabel: '2026-10',
        dueAmount: 1000,
        paidAmount: 1000,
        balance: 0,
        coveredBy: 'PAY-0001',
        status: 'PAID',
        notes: 'Paid via UPI (RCP: RCP-2026-0001)',
        updatedAt: '2026-10-01T10:15:00.000Z',
      },
      // ZL-0001 Nov 2026 paid in advance
      {
        ledgerId: 'LDG-0002',
        registrationNumber: 'ZL-0001',
        year: 2026,
        month: 11,
        monthLabel: '2026-11',
        dueAmount: 1000,
        paidAmount: 1000,
        balance: 0,
        coveredBy: 'PAY-0001',
        status: 'PAID',
        notes: 'Advance paid via UPI (RCP: RCP-2026-0001)',
        updatedAt: '2026-10-01T10:15:00.000Z',
      },
      // ZL-0002 Oct 2026 paid
      {
        ledgerId: 'LDG-0003',
        registrationNumber: 'ZL-0002',
        year: 2026,
        month: 10,
        monthLabel: '2026-10',
        dueAmount: 800,
        paidAmount: 800,
        balance: 0,
        coveredBy: 'PAY-0002',
        status: 'PAID',
        notes: 'Paid via CASH (RCP: RCP-2026-0002)',
        updatedAt: '2026-10-05T12:00:00.000Z',
      },
      // ZL-0003 Oct 2026 partially paid
      {
        ledgerId: 'LDG-0004',
        registrationNumber: 'ZL-0003',
        year: 2026,
        month: 10,
        monthLabel: '2026-10',
        dueAmount: 1200,
        paidAmount: 600,
        balance: 600,
        coveredBy: 'PAY-0003',
        status: 'PARTIALLY_PAID',
        notes: 'Partial payment via UPI (RCP: RCP-2026-0003)',
        updatedAt: '2026-10-10T14:30:00.000Z',
      },
    ],
    auditLogs: [],
    processedIdempotencyKeys: {},
  };
}

function loadDatabase() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch(e) {
    console.warn('Failed to load local DB:', e);
  }
  const init = getInitialData();
  saveDatabase(init);
  return init;
}

function saveDatabase(db) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch(e) {
    console.warn('Failed to save local DB:', e);
  }
}

function maskAadhaar(str) {
  if (!str) return '****';
  const clean = String(str).replace(/\D/g, '');
  if (clean.length < 4) return '****';
  return 'XXXXXXXX' + clean.slice(-4);
}

// ── Mock Backend Dispatcher ──────────────────────────────────────────────────
export async function mockDispatchRequest(action, payload = {}, sessionToken = null) {
  // Simulate network latency (150ms - 350ms)
  await new Promise((r) => setTimeout(r, 180 + Math.random() * 120));

  const db = loadDatabase();

  switch (action) {
    case 'AUTH_LOGIN': {
      const { username, password } = payload;
      const lower = (username || '').toLowerCase();
      const user = db.users.find((u) => u.username.toLowerCase() === lower);
      if (!user) {
        return { success: false, code: 'INVALID_CREDENTIALS', message: 'Invalid username or password.' };
      }
      if (user.status === 'DISABLED') {
        return { success: false, code: 'ACCOUNT_DISABLED', message: 'Account disabled. Contact system owner.' };
      }
      // Demo password accept 'Zenith@2026' or 'admin123' or any 8+ char for testing
      const token = `mock_session_token_${user.id}_${Date.now()}`;
      return {
        success: true,
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          role: user.role,
          permissions: user.permissions,
        },
        token,
      };
    }

    case 'AUTH_VALIDATE_SESSION': {
      // Validate mock token
      const user = db.users[1]; // default to manager for session restore
      return {
        success: true,
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          role: user.role,
          permissions: user.permissions,
        },
      };
    }

    case 'AUTH_LOGOUT': {
      return { success: true };
    }

    case 'AUTH_CHANGE_PASSWORD': {
      return { success: true, message: 'Password changed successfully.' };
    }

    case 'STUDENTS_LIST': {
      const filters = payload.filters || {};
      let list = [...db.students];
      if (filters.status) list = list.filter((s) => s.status === filters.status);
      if (filters.slotPlan) list = list.filter((s) => s.slotPlan === filters.slotPlan);
      if (filters.search) {
        const q = filters.search.toLowerCase().trim();
        list = list.filter((s) =>
          s.studentName.toLowerCase().includes(q) ||
          s.registrationNumber.toLowerCase().includes(q) ||
          (s.phone && s.phone.includes(q)) ||
          (s.fatherName && s.fatherName.toLowerCase().includes(q))
        );
      }
      return { success: true, students: list, total: list.length };
    }

    case 'STUDENTS_SEARCH': {
      const query = (payload.query || '').trim().toLowerCase();
      const searchType = payload.searchType || 'all';
      if (!query) {
        return { success: true, students: db.students.slice(0, 50), total: db.students.length };
      }
      const cleanQ = query.replace(/\D/g, '');
      const filtered = db.students.filter((s) => {
        if (searchType === 'name') return s.studentName.toLowerCase().includes(query);
        if (searchType === 'reg') return s.registrationNumber.toLowerCase().includes(query);
        if (searchType === 'phone') return s.phone && s.phone.includes(query);
        if (searchType === 'aadhaar') {
          return (s.aadhaar && s.aadhaar.includes(cleanQ)) || (s.aadhaarMasked && s.aadhaarMasked.includes(cleanQ));
        }
        return (
          s.studentName.toLowerCase().includes(query) ||
          s.registrationNumber.toLowerCase().includes(query) ||
          (s.phone && s.phone.includes(query)) ||
          (s.fatherName && s.fatherName.toLowerCase().includes(query)) ||
          (cleanQ.length >= 4 && s.aadhaar && s.aadhaar.includes(cleanQ))
        );
      });
      return { success: true, students: filtered, total: filtered.length };
    }

    case 'STUDENTS_GET': {
      const student = db.students.find((s) => s.registrationNumber === payload.registrationNumber);
      if (!student) return { success: false, code: 'NOT_FOUND', message: 'Student not found.' };
      return { success: true, student };
    }

    case 'STUDENTS_GET_PROFILE': {
      const regNum = payload.registrationNumber;
      const student = db.students.find((s) => s.registrationNumber === regNum);
      if (!student) return { success: false, code: 'NOT_FOUND', message: 'Student not found.' };

      const payments = db.payments
        .filter((p) => p.registrationNumber === regNum)
        .sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));

      const ledger = db.ledger
        .filter((l) => l.registrationNumber === regNum)
        .sort((a, b) => a.monthLabel.localeCompare(b.monthLabel));

      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
      const totalDue = ledger.reduce((sum, l) => sum + l.dueAmount, 0);
      const outstandingDues = ledger
        .filter((l) => l.status === 'PENDING' || l.status === 'PARTIALLY_PAID')
        .reduce((sum, l) => sum + l.balance, 0);

      const paidMonths = ledger.filter((l) => l.status === 'PAID');
      const paidThrough = paidMonths.length > 0 ? paidMonths[paidMonths.length - 1].monthLabel : null;

      return {
        success: true,
        student,
        payments,
        ledger,
        summary: {
          totalPaid,
          totalDue,
          outstandingDues,
          paidThrough,
          ledgerCount: ledger.length,
          paymentsCount: payments.length,
        },
      };
    }

    case 'STUDENTS_CHECK_DUPLICATE': {
      const { studentData } = payload;
      if (!studentData) return { success: true, isDuplicate: false };

      if (studentData.phone) {
        const cleanP = String(studentData.phone).replace(/\D/g, '');
        const existing = db.students.find((s) => s.phone && s.phone.replace(/\D/g, '') === cleanP);
        if (existing) {
          return {
            success: true,
            isDuplicate: true,
            field: 'phone',
            message: `A student with phone ${studentData.phone} is already admitted: ${existing.studentName} (${existing.registrationNumber})`,
            existingStudent: existing,
          };
        }
      }

      if (studentData.aadhaar) {
        const cleanA = String(studentData.aadhaar).replace(/\D/g, '');
        const existing = db.students.find((s) => s.aadhaar && s.aadhaar.replace(/\D/g, '') === cleanA);
        if (existing) {
          return {
            success: true,
            isDuplicate: true,
            field: 'aadhaar',
            message: `A student with this Aadhaar is already admitted: ${existing.studentName} (${existing.registrationNumber})`,
            existingStudent: existing,
          };
        }
      }

      return { success: true, isDuplicate: false };
    }

    case 'STUDENTS_CREATE': {
      const { studentData, idempotencyKey } = payload;
      if (!studentData?.studentName) {
        return { success: false, code: 'VALIDATION_ERROR', message: 'Student name is required.' };
      }

      // Check idempotency
      if (idempotencyKey && db.processedIdempotencyKeys[idempotencyKey]) {
        return { success: true, ...db.processedIdempotencyKeys[idempotencyKey] };
      }

      // Duplicate checks
      if (studentData.phone) {
        const cleanP = String(studentData.phone).replace(/\D/g, '');
        const dup = db.students.find((s) => s.phone && s.phone.replace(/\D/g, '') === cleanP);
        if (dup) {
          return { success: false, code: 'DUPLICATE', message: `Phone number ${studentData.phone} already registered to ${dup.studentName} (${dup.registrationNumber}).` };
        }
      }

      if (studentData.aadhaar) {
        const cleanA = String(studentData.aadhaar).replace(/\D/g, '');
        const dup = db.students.find((s) => s.aadhaar && s.aadhaar.replace(/\D/g, '') === cleanA);
        if (dup) {
          return { success: false, code: 'DUPLICATE', message: `Aadhaar already registered to ${dup.studentName} (${dup.registrationNumber}).` };
        }
      }

      // Generate next ZL-xxxx
      let maxNum = 0;
      db.students.forEach((s) => {
        const m = s.registrationNumber.match(/\d+$/);
        if (m) maxNum = Math.max(maxNum, parseInt(m[0]));
      });
      const regNum = `ZL-${String(maxNum + 1).padStart(4, '0')}`;
      const now = new Date().toISOString();

      const newStudent = {
        registrationNumber: regNum,
        studentName: studentData.studentName.trim(),
        fatherName: studentData.fatherName?.trim() || '',
        aadhaar: studentData.aadhaar?.replace(/\D/g, '') || '',
        aadhaarMasked: maskAadhaar(studentData.aadhaar),
        phone: studentData.phone?.trim() || '',
        address: studentData.address?.trim() || '',
        registrationFee: parseFloat(studentData.registrationFee) || 0,
        lockerCharge: parseFloat(studentData.lockerCharge) || 0,
        monthlyFee: parseFloat(studentData.monthlyFee) || 0,
        admissionDate: studentData.admissionDate || now.slice(0, 10),
        slotPlan: studentData.slotPlan || 'Full Day (6 AM - 10 PM)',
        status: 'ACTIVE',
        discontinuationDate: '',
        notes: studentData.notes?.trim() || '',
        createdAt: now,
        updatedAt: now,
      };

      db.students.push(newStudent);

      const resp = {
        registrationNumber: regNum,
        student: newStudent,
        message: 'Student admitted successfully.',
      };

      if (idempotencyKey) {
        db.processedIdempotencyKeys[idempotencyKey] = resp;
      }

      saveDatabase(db);
      return { success: true, ...resp };
    }

    case 'STUDENTS_UPDATE': {
      const { registrationNumber, updates } = payload;
      const index = db.students.findIndex((s) => s.registrationNumber === registrationNumber);
      if (index === -1) return { success: false, code: 'NOT_FOUND', message: 'Student not found.' };

      const existing = db.students[index];
      const now = new Date().toISOString();

      db.students[index] = {
        ...existing,
        ...updates,
        aadhaarMasked: updates.aadhaar ? maskAadhaar(updates.aadhaar) : existing.aadhaarMasked,
        updatedAt: now,
      };

      saveDatabase(db);
      return { success: true, message: 'Student record updated successfully.', student: db.students[index] };
    }

    case 'STUDENTS_DISCONTINUE': {
      const { registrationNumber, reason, date } = payload;
      const index = db.students.findIndex((s) => s.registrationNumber === registrationNumber);
      if (index === -1) return { success: false, code: 'NOT_FOUND', message: 'Student not found.' };

      const now = new Date().toISOString();
      const discDate = date || now.slice(0, 10);
      const student = db.students[index];

      student.status = 'INACTIVE';
      student.discontinuationDate = discDate;
      student.notes = (student.notes ? student.notes + '\n' : '') + `Discontinued on ${discDate}: ${reason || 'No reason specified'}`;
      student.updatedAt = now;

      saveDatabase(db);
      return { success: true, message: `Student ${registrationNumber} marked as inactive.` };
    }

    case 'STUDENTS_REACTIVATE': {
      const { registrationNumber, effectiveDate } = payload;
      const index = db.students.findIndex((s) => s.registrationNumber === registrationNumber);
      if (index === -1) return { success: false, code: 'NOT_FOUND', message: 'Student not found.' };

      const now = new Date().toISOString();
      const effDate = effectiveDate || now.slice(0, 10);
      const student = db.students[index];

      student.status = 'ACTIVE';
      student.discontinuationDate = '';
      student.notes = (student.notes ? student.notes + '\n' : '') + `Reactivated on ${effDate}`;
      student.updatedAt = now;

      saveDatabase(db);
      return { success: true, message: `Student ${registrationNumber} reactivated successfully.` };
    }

    case 'PAYMENTS_PREVIEW_ALLOCATION': {
      const { registrationNumber, amount, startMonth, numMonths } = payload;
      const student = db.students.find((s) => s.registrationNumber === registrationNumber);
      if (!student) return { success: false, code: 'NOT_FOUND', message: 'Student not found.' };

      const monthlyRate = parseFloat(student.monthlyFee) || 0;
      const totalAmount = parseFloat(amount) || 0;

      let currYear, currMonth;
      if (startMonth && /^\d{4}-\d{2}$/.test(startMonth)) {
        const parts = startMonth.split('-');
        currYear = parseInt(parts[0]);
        currMonth = parseInt(parts[1]);
      } else {
        const studentLedger = db.ledger
          .filter((l) => l.registrationNumber === registrationNumber && l.status === 'PAID')
          .sort((a, b) => a.monthLabel.localeCompare(b.monthLabel));
        if (studentLedger.length > 0) {
          const last = studentLedger[studentLedger.length - 1];
          currYear = last.year;
          currMonth = last.month + 1;
          if (currMonth > 12) { currMonth = 1; currYear++; }
        } else {
          const now = new Date();
          currYear = now.getFullYear();
          currMonth = now.getMonth() + 1;
        }
      }

      const count = parseInt(numMonths) || Math.max(1, Math.floor(totalAmount / (monthlyRate || 1)));
      const allocations = [];
      let remaining = totalAmount;

      for (let i = 0; i < count; i++) {
        const label = `${currYear}-${String(currMonth).padStart(2, '0')}`;
        const due = monthlyRate;
        let allocated = 0;
        let status = 'PENDING';

        if (remaining >= due) {
          allocated = due;
          remaining -= due;
          status = 'PAID';
        } else if (remaining > 0) {
          allocated = remaining;
          remaining = 0;
          status = 'PARTIALLY_PAID';
        }

        allocations.push({
          year: currYear,
          month: currMonth,
          monthLabel: label,
          dueAmount: due,
          allocatedAmount: allocated,
          balance: Math.max(0, due - allocated),
          status,
        });

        currMonth++;
        if (currMonth > 12) { currMonth = 1; currYear++; }
      }

      return {
        success: true,
        preview: {
          registrationNumber,
          studentName: student.studentName,
          monthlyFee: monthlyRate,
          numMonths: count,
          expectedTotal: count * monthlyRate,
          enteredAmount: totalAmount,
          balanceDiff: totalAmount - (count * monthlyRate),
          allocations,
          remainingUnallocated: remaining,
        },
      };
    }

    case 'PAYMENTS_RECORD': {
      const { paymentData, idempotencyKey } = payload;
      if (!paymentData?.registrationNumber || !paymentData?.amount) {
        return { success: false, code: 'VALIDATION_ERROR', message: 'Registration number and amount are required.' };
      }

      if (idempotencyKey && db.processedIdempotencyKeys[idempotencyKey]) {
        return { success: true, ...db.processedIdempotencyKeys[idempotencyKey] };
      }

      const student = db.students.find((s) => s.registrationNumber === paymentData.registrationNumber);
      if (!student) return { success: false, code: 'NOT_FOUND', message: 'Student not found.' };

      const totalAmount = parseFloat(paymentData.amount);
      const now = new Date().toISOString();

      // Generate payment ID
      let maxPay = 0;
      db.payments.forEach((p) => {
        const m = p.paymentId.match(/\d+$/);
        if (m) maxPay = Math.max(maxPay, parseInt(m[0]));
      });
      const paymentId = `PAY-${String(maxPay + 1).padStart(4, '0')}`;

      // Generate receipt number
      const year = new Date().getFullYear();
      let maxRcp = 0;
      db.payments.forEach((p) => {
        const m = p.receiptNumber.match(/\d+$/);
        if (m) maxRcp = Math.max(maxRcp, parseInt(m[0]));
      });
      const receiptNumber = `RCP-${year}-${String(maxRcp + 1).padStart(4, '0')}`;

      const newPayment = {
        paymentId,
        registrationNumber: paymentData.registrationNumber,
        paymentDate: paymentData.paymentDate || now.slice(0, 10),
        amount: totalAmount,
        paymentMethod: paymentData.paymentMethod || 'CASH',
        transactionRef: paymentData.transactionRef || '',
        receiptNumber,
        notes: paymentData.notes || '',
        enteredBy: 'MGR-001',
        createdAt: now,
      };

      db.payments.push(newPayment);

      // Advance allocation logic
      let currYear, currMonth;
      if (paymentData.startMonth && /^\d{4}-\d{2}$/.test(paymentData.startMonth)) {
        const parts = paymentData.startMonth.split('-');
        currYear = parseInt(parts[0]);
        currMonth = parseInt(parts[1]);
      } else {
        const studentLedger = db.ledger
          .filter((l) => l.registrationNumber === paymentData.registrationNumber && l.status === 'PAID')
          .sort((a, b) => a.monthLabel.localeCompare(b.monthLabel));
        if (studentLedger.length > 0) {
          const last = studentLedger[studentLedger.length - 1];
          currYear = last.year;
          currMonth = last.month + 1;
          if (currMonth > 12) { currMonth = 1; currYear++; }
        } else {
          const d = new Date();
          currYear = d.getFullYear();
          currMonth = d.getMonth() + 1;
        }
      }

      const numMonths = parseInt(paymentData.numMonths) || Math.max(1, Math.round(totalAmount / (student.monthlyFee || 1)));
      const monthlyRate = parseFloat(student.monthlyFee) || 0;
      let remaining = totalAmount;
      const allocatedMonths = [];

      for (let i = 0; i < numMonths; i++) {
        const label = `${currYear}-${String(currMonth).padStart(2, '0')}`;
        const due = monthlyRate;
        let allocated = 0;
        let status = 'PENDING';

        if (remaining >= due) {
          allocated = due;
          remaining -= due;
          status = 'PAID';
        } else if (remaining > 0) {
          allocated = remaining;
          remaining = 0;
          status = 'PARTIALLY_PAID';
        }

        // Upsert ledger in db
        const existingLedgerIdx = db.ledger.findIndex(
          (l) => l.registrationNumber === paymentData.registrationNumber && l.monthLabel === label
        );

        const ledgerRecord = {
          ledgerId: existingLedgerIdx >= 0 ? db.ledger[existingLedgerIdx].ledgerId : `LDG-${String(db.ledger.length + 1).padStart(4, '0')}`,
          registrationNumber: paymentData.registrationNumber,
          year: currYear,
          month: currMonth,
          monthLabel: label,
          dueAmount: due,
          paidAmount: allocated,
          balance: Math.max(0, due - allocated),
          coveredBy: paymentId,
          status,
          notes: `Paid via ${paymentData.paymentMethod || 'CASH'} (RCP: ${receiptNumber})`,
          updatedAt: now,
        };

        if (existingLedgerIdx >= 0) {
          db.ledger[existingLedgerIdx] = ledgerRecord;
        } else {
          db.ledger.push(ledgerRecord);
        }

        allocatedMonths.push({
          monthLabel: label,
          dueAmount: due,
          allocatedAmount: allocated,
          balance: Math.max(0, due - allocated),
          status,
        });

        currMonth++;
        if (currMonth > 12) { currMonth = 1; currYear++; }
      }

      const responseData = {
        paymentId,
        receiptNumber,
        amount: totalAmount,
        studentName: student.studentName,
        registrationNumber: paymentData.registrationNumber,
        paymentDate: paymentData.paymentDate || now.slice(0, 10),
        paymentMethod: paymentData.paymentMethod || 'CASH',
        transactionRef: paymentData.transactionRef || '',
        allocatedMonths,
        remainingCredit: remaining,
        message: `Payment of ₹${totalAmount.toLocaleString('en-IN')} recorded successfully.`,
      };

      if (idempotencyKey) {
        db.processedIdempotencyKeys[idempotencyKey] = responseData;
      }

      saveDatabase(db);
      return { success: true, ...responseData };
    }

    case 'LEDGER_GET_STUDENT': {
      const records = db.ledger
        .filter((l) => l.registrationNumber === payload.registrationNumber)
        .sort((a, b) => a.monthLabel.localeCompare(b.monthLabel));
      return { success: true, ledger: records };
    }

    case 'LEDGER_MONTHLY_STATUS': {
      const year = parseInt(payload.year) || new Date().getFullYear();
      const month = parseInt(payload.month) || (new Date().getMonth() + 1);
      const targetLabel = `${year}-${String(month).padStart(2, '0')}`;

      const targetLedger = db.ledger.filter((l) => l.monthLabel === targetLabel);

      const statusList = db.students.map((s) => {
        const lRecord = targetLedger.find((l) => l.registrationNumber === s.registrationNumber);
        const isInactive = s.status === 'INACTIVE' && s.discontinuationDate && s.discontinuationDate < `${targetLabel}-01`;

        let feeStatus = 'PENDING';
        let paidAmount = 0;
        let dueAmount = parseFloat(s.monthlyFee) || 0;
        let balance = dueAmount;

        if (isInactive) {
          feeStatus = 'NOT_APPLICABLE';
          dueAmount = 0;
          balance = 0;
        } else if (lRecord) {
          feeStatus = lRecord.status;
          paidAmount = lRecord.paidAmount;
          balance = lRecord.balance;
          dueAmount = lRecord.dueAmount;
        }

        return {
          registrationNumber: s.registrationNumber,
          studentName: s.studentName,
          fatherName: s.fatherName,
          phone: s.phone,
          slotPlan: s.slotPlan,
          studentStatus: s.status,
          monthlyFee: s.monthlyFee,
          feeStatus,
          dueAmount,
          paidAmount,
          balance,
          coveredBy: lRecord?.coveredBy || '',
          updatedAt: lRecord?.updatedAt || '',
        };
      });

      const activeInMonth = statusList.filter((s) => s.studentStatus === 'ACTIVE');
      const paidCount = activeInMonth.filter((s) => s.feeStatus === 'PAID').length;
      const partialCount = activeInMonth.filter((s) => s.feeStatus === 'PARTIALLY_PAID').length;
      const pendingCount = activeInMonth.filter((s) => s.feeStatus === 'PENDING').length;

      return {
        success: true,
        monthLabel: targetLabel,
        year,
        month,
        summary: {
          totalStudents: activeInMonth.length,
          paidCount,
          partialCount,
          pendingCount,
          totalDue: activeInMonth.reduce((sum, s) => sum + s.dueAmount, 0),
          totalCollected: activeInMonth.reduce((sum, s) => sum + s.paidAmount, 0),
          totalOutstanding: activeInMonth.reduce((sum, s) => sum + s.balance, 0),
        },
        students: statusList,
      };
    }

    case 'REPORTS_DASHBOARD': {
      const now = new Date();
      const currentMonthLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const activeStudents = db.students.filter((s) => s.status === 'ACTIVE').length;
      const totalStudents = db.students.length;

      const thisMonthPayments = db.payments.filter((p) => String(p.paymentDate || p.createdAt || '').startsWith(currentMonthLabel));
      const monthlyCollection = thisMonthPayments.reduce((sum, p) => sum + p.amount, 0);

      const newAdmissions = db.students.filter((s) => String(s.admissionDate || s.createdAt || '').startsWith(currentMonthLabel)).length;

      const currentLedger = db.ledger.filter((l) => l.monthLabel === currentMonthLabel);
      let pendingStudentFees = 0;
      let defaulters = 0;

      db.students.filter((s) => s.status === 'ACTIVE').forEach((s) => {
        const l = currentLedger.find((r) => r.registrationNumber === s.registrationNumber);
        if (!l) {
          pendingStudentFees += (parseFloat(s.monthlyFee) || 0);
          defaulters++;
        } else if (l.status === 'PENDING' || l.status === 'PARTIALLY_PAID') {
          pendingStudentFees += l.balance;
          defaulters++;
        }
      });

      const monthly = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const shortLabel = d.toLocaleString('en-IN', { month: 'short' });

        const monthPayments = db.payments.filter((p) => String(p.paymentDate || '').startsWith(label));
        const amount = monthPayments.reduce((sum, p) => sum + p.amount, 0);
        const admissions = db.students.filter((s) => String(s.admissionDate || '').startsWith(label)).length;
        const discontinuations = db.students.filter((s) => String(s.discontinuationDate || '').startsWith(label)).length;

        monthly.push({ month: shortLabel, amount, admissions, discontinuations });
      }

      const recentPayments = db.payments
        .slice(-10)
        .reverse()
        .map((p) => {
          const student = db.students.find((s) => s.registrationNumber === p.registrationNumber);
          return { ...p, studentName: student?.studentName || p.registrationNumber };
        });

      return {
        success: true,
        data: {
          stats: {
            activeStudents,
            totalStudents,
            monthlyCollection,
            paymentsThisMonth: thisMonthPayments.length,
            pendingStudentFees,
            defaulters,
            newAdmissions,
          },
          monthly,
          recentPayments,
        },
      };
    }

    case 'REPORTS_OWNER_DASHBOARD': {
      const now = new Date();
      const year = parseInt(payload.year) || now.getFullYear();
      const month = parseInt(payload.month) || (now.getMonth() + 1);
      const targetMonthLabel = `${year}-${String(month).padStart(2, '0')}`;
      const targetYearLabel = `${year}`;
      const { dateFrom, dateTo, statusFilter } = payload;

      const activeStudents = db.students.filter((s) => s.status === 'ACTIVE').length;
      const nonActiveStudents = db.students.filter((s) => s.status === 'INACTIVE').length;

      const newAdmissionsMonth = db.students.filter((s) => String(s.admissionDate || s.createdAt || '').startsWith(targetMonthLabel)).length;
      const newAdmissionsYear = db.students.filter((s) => String(s.admissionDate || s.createdAt || '').startsWith(targetYearLabel)).length;

      let cashCollectedMonth = 0;
      let cashCollectedYear = 0;
      let customRangeCollected = 0;

      db.payments.forEach((p) => {
        const pDate = String(p.paymentDate || p.createdAt || '').slice(0, 10);
        const amt = parseFloat(p.amount) || 0;
        if (pDate.startsWith(targetMonthLabel)) cashCollectedMonth += amt;
        if (pDate.startsWith(targetYearLabel)) cashCollectedYear += amt;
        if (dateFrom && dateTo && pDate >= dateFrom && pDate <= dateTo) customRangeCollected += amt;
      });

      const eligibleStudents = db.students.filter((s) => {
        const adm = String(s.admissionDate || '').slice(0, 10);
        if (adm && adm > `${targetMonthLabel}-31`) return false;
        if (s.status === 'INACTIVE' && s.discontinuationDate && s.discontinuationDate < `${targetMonthLabel}-01`) return false;
        if (statusFilter && statusFilter !== 'ALL' && s.status !== statusFilter) return false;
        return true;
      });

      let monthlyFeeDue = 0;
      let feeAllocatedMonth = 0;
      let outstandingFeeBalances = 0;
      let paidInMonthCount = 0;
      let partialInMonthCount = 0;
      let pendingInMonthCount = 0;

      const monthLedger = db.ledger.filter((l) => l.monthLabel === targetMonthLabel);

      eligibleStudents.forEach((s) => {
        const rate = parseFloat(s.monthlyFee) || 0;
        monthlyFeeDue += rate;

        const entry = monthLedger.find((l) => l.registrationNumber === s.registrationNumber);
        if (!entry) {
          outstandingFeeBalances += rate;
          pendingInMonthCount++;
        } else {
          feeAllocatedMonth += entry.paidAmount;
          outstandingFeeBalances += entry.balance;
          if (entry.status === 'PAID') paidInMonthCount++;
          else if (entry.status === 'PARTIALLY_PAID') partialInMonthCount++;
          else pendingInMonthCount++;
        }
      });

      const registrationFeesCollected = db.students.reduce((sum, s) => sum + (parseFloat(s.registrationFee) || 0), 0);
      const refundableLockerDepositsHeld = db.students
        .filter((s) => s.status === 'ACTIVE')
        .reduce((sum, s) => sum + (parseFloat(s.lockerCharge) || 0), 0);

      const advancePaidStudentRegs = new Set();
      db.ledger.forEach((l) => {
        if (l.status === 'PAID' && l.monthLabel > targetMonthLabel) {
          advancePaidStudentRegs.add(l.registrationNumber);
        }
      });

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthlyTrend = [];
      for (let m = 1; m <= 12; m++) {
        const label = `${year}-${String(m).padStart(2, '0')}`;
        const cash = db.payments
          .filter((p) => String(p.paymentDate || p.createdAt || '').startsWith(label))
          .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        const feeAlloc = db.ledger
          .filter((l) => l.monthLabel === label)
          .reduce((sum, l) => sum + (parseFloat(l.paidAmount) || 0), 0);
        const admCount = db.students
          .filter((s) => String(s.admissionDate || s.createdAt || '').startsWith(label)).length;

        monthlyTrend.push({
          month: monthNames[m - 1],
          monthLabel: label,
          cashCollection: cash,
          feeCoverage: feeAlloc,
          admissions: admCount,
        });
      }

      const planCounts = {};
      db.students.filter((s) => s.status === 'ACTIVE').forEach((s) => {
        const plan = s.slotPlan || 'General';
        planCounts[plan] = (planCounts[plan] || 0) + 1;
      });
      const planDistribution = Object.keys(planCounts).map((name) => ({ name, count: planCounts[name] }));

      const recentTransactions = db.payments
        .slice(-10)
        .reverse()
        .map((p) => {
          const st = db.students.find((s) => s.registrationNumber === p.registrationNumber);
          return { ...p, studentName: st?.studentName || p.registrationNumber };
        });

      return {
        success: true,
        selectedYear: year,
        selectedMonth: month,
        selectedMonthLabel: targetMonthLabel,
        stats: {
          totalActiveStudents: activeStudents,
          totalNonActiveStudents: nonActiveStudents,
          newAdmissionsMonth,
          newAdmissionsYear,
          actualCashCollectedMonth: cashCollectedMonth,
          actualCashCollectedYear: cashCollectedYear,
          monthlyFeeDue,
          feeAllocatedMonth,
          outstandingFeeBalances,
          registrationFeesCollected,
          refundableLockerDepositsHeld,
          advancePaidStudentsCount: advancePaidStudentRegs.size,
          paidInMonthCount,
          partialInMonthCount,
          pendingInMonthCount,
          customRangeCollected: dateFrom && dateTo ? customRangeCollected : null,
        },
        monthlyTrend,
        planDistribution,
        recentTransactions,
      };
    }

    case 'REPORTS_COLLECTION_ANALYTICS': {
      const now = new Date();
      const year = parseInt(payload.year) || now.getFullYear();
      const selectedMonthNum = parseInt(payload.month) || (now.getMonth() + 1);
      const selectedMonthLabel = `${year}-${String(selectedMonthNum).padStart(2, '0')}`;
      const { dateFrom, dateTo } = payload;

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthByMonth = [];

      let yearlyCash = 0;
      let yearlyFeeAlloc = 0;
      let yearlyFeeDue = 0;
      let yearlyOutstanding = 0;
      let yearlyRegFees = 0;
      let yearlyLockerDeposits = 0;
      let yearlyAdmissions = 0;

      for (let m = 1; m <= 12; m++) {
        const label = `${year}-${String(m).padStart(2, '0')}`;
        const cash = db.payments
          .filter((p) => String(p.paymentDate || p.createdAt || '').startsWith(label))
          .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        const monthLedger = db.ledger.filter((l) => l.monthLabel === label);
        const feeAllocated = monthLedger.reduce((sum, l) => sum + (parseFloat(l.paidAmount) || 0), 0);

        const activeInMonth = db.students.filter((s) => {
          const adm = String(s.admissionDate || '').slice(0, 10);
          if (adm && adm > `${label}-31`) return false;
          if (s.status === 'INACTIVE' && s.discontinuationDate && s.discontinuationDate < `${label}-01`) return false;
          return true;
        });

        const feeDue = activeInMonth.reduce((sum, s) => sum + (parseFloat(s.monthlyFee) || 0), 0);
        const outstanding = Math.max(0, feeDue - feeAllocated);
        const collectionPercentage = feeDue > 0 ? Math.min(100, Math.round((feeAllocated / feeDue) * 100)) : 0;

        const admittedInMonth = db.students.filter((s) => String(s.admissionDate || s.createdAt || '').startsWith(label));
        const newAdmissions = admittedInMonth.length;
        const regFees = admittedInMonth.reduce((sum, s) => sum + (parseFloat(s.registrationFee) || 0), 0);
        const lockerDeposits = admittedInMonth.reduce((sum, s) => sum + (parseFloat(s.lockerCharge) || 0), 0);
        const discontinued = db.students.filter((s) => String(s.discontinuationDate || '').startsWith(label)).length;

        yearlyCash += cash;
        yearlyFeeAlloc += feeAllocated;
        yearlyFeeDue += feeDue;
        yearlyOutstanding += outstanding;
        yearlyRegFees += regFees;
        yearlyLockerDeposits += lockerDeposits;
        yearlyAdmissions += newAdmissions;

        monthByMonth.push({
          monthNum: m,
          monthName: monthNames[m - 1],
          monthLabel: label,
          cashCollected: cash,
          feeAllocated,
          feeDue,
          outstanding,
          collectionPercentage,
          newAdmissions,
          regFees,
          lockerDeposits,
          discontinued,
          reactivated: 0,
        });
      }

      const selectedMonthData = monthByMonth.find((m) => m.monthNum === selectedMonthNum) || monthByMonth[0];
      const targetLedger = db.ledger.filter((l) => l.monthLabel === selectedMonthLabel);

      const studentBreakdown = db.students.map((s) => {
        const lRecord = targetLedger.find((l) => l.registrationNumber === s.registrationNumber);
        const isInactive = s.status === 'INACTIVE' && s.discontinuationDate && s.discontinuationDate < `${selectedMonthLabel}-01`;

        let feeStatus = 'PENDING';
        let paidAmount = 0;
        let dueAmount = parseFloat(s.monthlyFee) || 0;
        let balance = dueAmount;

        if (isInactive) {
          feeStatus = 'NOT_APPLICABLE';
          dueAmount = 0;
          balance = 0;
        } else if (lRecord) {
          feeStatus = lRecord.status;
          paidAmount = lRecord.paidAmount;
          balance = lRecord.balance;
          dueAmount = lRecord.dueAmount;
        }

        return {
          registrationNumber: s.registrationNumber,
          studentName: s.studentName,
          fatherName: s.fatherName,
          phone: s.phone,
          slotPlan: s.slotPlan,
          status: s.status,
          monthlyFee: s.monthlyFee,
          feeStatus,
          dueAmount,
          paidAmount,
          balance,
          coveredBy: lRecord?.coveredBy || '',
        };
      });

      const activeBreakdown = studentBreakdown.filter((s) => s.feeStatus !== 'NOT_APPLICABLE');
      const paidCount = activeBreakdown.filter((s) => s.feeStatus === 'PAID').length;
      const partialCount = activeBreakdown.filter((s) => s.feeStatus === 'PARTIALLY_PAID').length;
      const pendingCount = activeBreakdown.filter((s) => s.feeStatus === 'PENDING').length;

      return {
        success: true,
        year,
        selectedMonthNum,
        selectedMonthLabel,
        monthByMonth,
        yearlyTotals: {
          totalCashCollected: yearlyCash,
          totalFeeAllocated: yearlyFeeAlloc,
          totalFeeDue: yearlyFeeDue,
          totalOutstanding: yearlyOutstanding,
          totalRegFees: yearlyRegFees,
          totalLockerDeposits: yearlyLockerDeposits,
          totalAdmissions: yearlyAdmissions,
          overallCollectionPercentage: yearlyFeeDue > 0 ? Math.min(100, Math.round((yearlyFeeAlloc / yearlyFeeDue) * 100)) : 0,
        },
        selectedMonthDetails: {
          ...selectedMonthData,
          paidCount,
          partialCount,
          pendingCount,
          students: studentBreakdown,
        },
      };
    }

    case 'REPORTS_ADMISSION_ANALYTICS': {
      const now = new Date();
      const year = parseInt(payload.year) || now.getFullYear();
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const byMonth = monthNames.map((name, idx) => {
        const label = `${year}-${String(idx + 1).padStart(2, '0')}`;
        const count = db.students.filter((s) => String(s.admissionDate || s.createdAt || '').startsWith(label)).length;
        return { month: name, label, admissions: count };
      });

      const activeCount = db.students.filter((s) => s.status === 'ACTIVE').length;
      const discontinuedCount = db.students.filter((s) => s.status === 'INACTIVE').length;

      const planStats = {};
      db.students.forEach((s) => {
        const plan = s.slotPlan || 'General';
        if (!planStats[plan]) planStats[plan] = { name: plan, count: 0, totalFee: 0 };
        planStats[plan].count++;
        planStats[plan].totalFee += (parseFloat(s.monthlyFee) || 0);
      });
      const bySlotPlan = Object.values(planStats).map((p) => ({
        name: p.name,
        count: p.count,
        percentage: db.students.length > 0 ? Math.round((p.count / db.students.length) * 100) : 0,
        totalMonthlyRevenue: p.totalFee,
        avgFee: p.count > 0 ? Math.round(p.totalFee / p.count) : 0,
      }));

      const history = db.students.map((s) => ({
        registrationNumber: s.registrationNumber,
        studentName: s.studentName,
        fatherName: s.fatherName,
        phone: s.phone,
        admissionDate: s.admissionDate,
        slotPlan: s.slotPlan,
        monthlyFee: s.monthlyFee,
        registrationFee: s.registrationFee,
        lockerCharge: s.lockerCharge,
        status: s.status,
      }));

      return {
        success: true,
        selectedYear: year,
        byMonth,
        byYear: [{ year: String(year), admissions: db.students.length }],
        activeVsDiscontinued: { activeCount, discontinuedCount },
        bySlotPlan,
        history,
      };
    }

    case 'AUDIT_LOG_LIST': {
      return {
        success: true,
        logs: db.auditLogs || [],
        total: (db.auditLogs || []).length,
      };
    }

    case 'USERS_ENABLE': {
      const u = db.users.find((user) => user.id === payload.userId);
      if (!u) return { success: false, code: 'NOT_FOUND', message: 'User not found.' };
      u.status = 'ACTIVE';
      saveDb(db);
      return { success: true, message: `User ${u.username} activated.` };
    }

    case 'USERS_TOGGLE_STATUS': {
      const u = db.users.find((user) => user.id === payload.userId);
      if (!u) return { success: false, code: 'NOT_FOUND', message: 'User not found.' };
      if (u.role === 'OWNER' && payload.status === 'DISABLED') {
        const activeOwners = db.users.filter((user) => user.role === 'OWNER' && user.status === 'ACTIVE');
        if (activeOwners.length <= 1) {
          return { success: false, code: 'FORBIDDEN', message: 'Cannot disable the last active owner account.' };
        }
      }
      u.status = payload.status;
      saveDb(db);
      return { success: true, message: `User status set to ${payload.status}.` };
    }

    default:
      return { success: false, code: 'UNKNOWN_ACTION', message: `Action ${action} not supported.` };
  }
}

