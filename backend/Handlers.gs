/**
 * ============================================================
 * Handlers.gs — Business Logic Handlers for All API Actions
 * ============================================================
 */

// ── Permission Checking ────────────────────────────────────────────────────

function requirePermission(session, permission) {
  if (session.role === ROLES.OWNER) return true;
  if (!session.permissions.includes(permission)) {
    throw new Error(`Permission denied: ${permission}`);
  }
  return true;
}

// ── User Handlers ──────────────────────────────────────────────────────────

function handleUsersList(session) {
  if (session.role !== ROLES.OWNER) {
    return errorResponse('Only owners can manage user accounts.', 'FORBIDDEN');
  }

  const users = getAllUsers().map(u => ({
    id: u.id,
    name: u.name,
    username: u.username,
    role: u.role,
    status: u.status,
    permissions: u.permissions,
    createdDate: u.createdDate,
    lastLogin: u.lastLogin,
    // Never return passwordHash to the frontend
  }));

  return okResponse({ users });
}

function handleUsersCreate(session, payload) {
  if (session.role !== ROLES.OWNER) {
    return errorResponse('Only owners can create user accounts.', 'FORBIDDEN');
  }

  const { userData } = payload;
  if (!userData || !userData.name || !userData.username || !userData.password) {
    return errorResponse('Name, username, and password are required.', 'VALIDATION_ERROR');
  }

  if (userData.password.length < 8) {
    return errorResponse('Password must be at least 8 characters.', 'VALIDATION_ERROR');
  }

  // Check username uniqueness
  const existing = findUserByUsername(userData.username);
  if (existing) {
    return errorResponse('Username already exists.', 'DUPLICATE');
  }

  const userId = generateUserId();
  const passwordHash = hashPassword(userData.username.toLowerCase(), userData.password);

  createUserRecord({
    id: userId,
    name: userData.name,
    username: userData.username.toLowerCase(),
    role: userData.role === ROLES.OWNER ? ROLES.OWNER : ROLES.MANAGER,
    passwordHash,
    permissions: userData.permissions || [],
  });

  writeAuditLog(session.userId, 'CREATE_USER', 'USER', userId, 'SUCCESS',
    { username: userData.username, role: userData.role });

  return okResponse({ userId, message: 'User account created.' });
}

function handleUsersUpdate(session, payload) {
  if (session.role !== ROLES.OWNER) {
    return errorResponse('Only owners can update user accounts.', 'FORBIDDEN');
  }

  const { userId, updates } = payload;
  const found = updateUserRecord(userId, updates);
  if (!found) {
    return errorResponse('User not found.', 'NOT_FOUND');
  }

  writeAuditLog(session.userId, 'UPDATE_USER', 'USER', userId, 'SUCCESS', updates);
  return okResponse({ message: 'User updated.' });
}

function handleUsersDisable(session, payload) {
  if (session.role !== ROLES.OWNER) {
    return errorResponse('Only owners can disable user accounts.', 'FORBIDDEN');
  }

  const { userId } = payload;
  if (userId === session.userId) {
    return errorResponse('You cannot disable your own account.', 'FORBIDDEN');
  }

  const found = updateUserRecord(userId, { status: 'DISABLED' });
  if (!found) {
    return errorResponse('User not found.', 'NOT_FOUND');
  }

  writeAuditLog(session.userId, 'DISABLE_USER', 'USER', userId, 'SUCCESS');
  return okResponse({ message: 'User disabled.' });
}

function handleUsersResetPassword(session, payload) {
  if (session.role !== ROLES.OWNER) {
    return errorResponse('Only owners can reset passwords.', 'FORBIDDEN');
  }

  const { userId, tempPassword } = payload;
  if (!tempPassword || tempPassword.length < 8) {
    return errorResponse('Temporary password must be at least 8 characters.', 'VALIDATION_ERROR');
  }

  const user = findUserById(userId);
  if (!user) {
    return errorResponse('User not found.', 'NOT_FOUND');
  }

  const newHash = hashPassword(user.username, tempPassword);
  updateUserPassword(userId, newHash);

  // Mark that user must change password on next login
  updateUserRecord(userId, {});
  const sheet = getSheet(SHEET_NAMES.PASSWORDS);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][PASSWORD_DATA_COLS.USER_ID]) === String(userId)) {
      sheet.getRange(i + 1, PASSWORD_DATA_COLS.TEMP_PW_FLAG + 1).setValue(true);
      break;
    }
  }

  writeAuditLog(session.userId, 'RESET_PASSWORD', 'USER', userId, 'SUCCESS');
  return okResponse({ message: 'Password reset. User must change it on next login.' });
}

// ── Students Handlers ──────────────────────────────────────────────────────

// ── Students Handlers ──────────────────────────────────────────────────────

function handleStudentsList(session, payload) {
  try { requirePermission(session, 'students.view'); }
  catch (e) { return errorResponse(e.message, 'FORBIDDEN'); }

  const students = getAllStudents();
  const { filters } = payload || {};

  let filtered = students;
  if (filters) {
    if (filters.status) filtered = filtered.filter(s => s.status === filters.status);
    if (filters.slotPlan) filtered = filtered.filter(s => s.slotPlan === filters.slotPlan);
    if (filters.search) {
      const q = filters.search.toLowerCase().trim();
      filtered = filtered.filter(s =>
        (s.studentName && s.studentName.toLowerCase().includes(q)) ||
        (s.registrationNumber && s.registrationNumber.toLowerCase().includes(q)) ||
        (s.phone && s.phone.includes(q)) ||
        (s.fatherName && s.fatherName.toLowerCase().includes(q))
      );
    }
  }

  return okResponse({ students: filtered, total: filtered.length });
}

function handleStudentsSearch(session, payload) {
  try { requirePermission(session, 'students.view'); }
  catch (e) { return errorResponse(e.message, 'FORBIDDEN'); }

  const query = (payload.query || '').trim().toLowerCase();
  const searchType = payload.searchType || 'all'; // all | name | reg | phone | aadhaar
  const students = getAllStudents();

  if (!query) {
    return okResponse({ students: students.slice(0, 50), total: students.length });
  }

  const results = students.filter(s => {
    if (searchType === 'name') return s.studentName.toLowerCase().includes(query);
    if (searchType === 'reg') return s.registrationNumber.toLowerCase().includes(query);
    if (searchType === 'phone') return s.phone && s.phone.includes(query);
    if (searchType === 'aadhaar') {
      const cleanQ = query.replace(/\D/g, '');
      return s.aadhaarMasked && s.aadhaarMasked.includes(cleanQ);
    }
    // 'all' search
    const cleanQ = query.replace(/\D/g, '');
    return (
      (s.studentName && s.studentName.toLowerCase().includes(query)) ||
      (s.registrationNumber && s.registrationNumber.toLowerCase().includes(query)) ||
      (s.phone && s.phone.includes(query)) ||
      (s.fatherName && s.fatherName.toLowerCase().includes(query)) ||
      (cleanQ.length >= 4 && s.aadhaarMasked && s.aadhaarMasked.includes(cleanQ))
    );
  });

  return okResponse({ students: results, total: results.length });
}

function handleStudentsGet(session, payload) {
  try { requirePermission(session, 'students.view'); }
  catch (e) { return errorResponse(e.message, 'FORBIDDEN'); }

  const found = findStudentByRegNumber(payload.registrationNumber);
  if (!found) return errorResponse('Student not found.', 'NOT_FOUND');

  return okResponse({ student: found.student });
}

function handleStudentsGetProfile(session, payload) {
  try { requirePermission(session, 'students.view'); }
  catch (e) { return errorResponse(e.message, 'FORBIDDEN'); }

  const regNum = payload.registrationNumber;
  const found = findStudentByRegNumber(regNum);
  if (!found) return errorResponse('Student not found.', 'NOT_FOUND');

  const student = found.student;
  const payments = getAllPayments()
    .filter(p => p.registrationNumber === regNum)
    .sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));

  const ledger = getStudentLedgerRecords(regNum);

  // Compute fee summary & paid-through month
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalDue = ledger.reduce((sum, r) => sum + r.dueAmount, 0);
  const outstandingDues = ledger
    .filter(r => r.status === 'PENDING' || r.status === 'PARTIALLY_PAID')
    .reduce((sum, r) => sum + r.balance, 0);

  // Determine paid-through month
  const paidMonths = ledger.filter(r => r.status === 'PAID');
  const paidThrough = paidMonths.length > 0 ? paidMonths[paidMonths.length - 1].monthLabel : null;

  return okResponse({
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
  });
}

function handleStudentsCheckDuplicate(session, payload) {
  try { requirePermission(session, 'students.create'); }
  catch (e) { return errorResponse(e.message, 'FORBIDDEN'); }

  const { studentData } = payload || {};
  if (!studentData) return okResponse({ isDuplicate: false });

  if (studentData.phone) {
    const existing = findStudentByPhone(studentData.phone);
    if (existing) {
      return okResponse({
        isDuplicate: true,
        field: 'phone',
        message: `Student with phone ${studentData.phone} already exists (${existing.student.studentName}, ${existing.student.registrationNumber})`,
        existingStudent: existing.student,
      });
    }
  }

  if (studentData.aadhaar) {
    const existing = findStudentByAadhaar(studentData.aadhaar);
    if (existing) {
      return okResponse({
        isDuplicate: true,
        field: 'aadhaar',
        message: `Student with Aadhaar already exists (${existing.student.studentName}, ${existing.student.registrationNumber})`,
        existingStudent: existing.student,
      });
    }
  }

  return okResponse({ isDuplicate: false });
}

function handleStudentsCreate(session, payload) {
  try { requirePermission(session, 'students.create'); }
  catch (e) { return errorResponse(e.message, 'FORBIDDEN'); }

  const { studentData, idempotencyKey } = payload || {};
  if (!studentData || !studentData.studentName) {
    return errorResponse('Student name is required.', 'VALIDATION_ERROR');
  }

  // Idempotency check via cache
  if (idempotencyKey) {
    const cache = CacheService.getScriptCache();
    const cached = cache.get(`idemp_std_${idempotencyKey}`);
    if (cached) {
      try { return okResponse(JSON.parse(cached)); } catch(e){}
    }
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    // Check duplicates before creating
    if (studentData.phone) {
      const dup = findStudentByPhone(studentData.phone);
      if (dup) {
        return errorResponse(`Student with phone ${studentData.phone} already admitted: ${dup.student.studentName} (${dup.student.registrationNumber})`, 'DUPLICATE');
      }
    }
    if (studentData.aadhaar) {
      const dup = findStudentByAadhaar(studentData.aadhaar);
      if (dup) {
        return errorResponse(`Student with this Aadhaar number already admitted: ${dup.student.studentName} (${dup.student.registrationNumber})`, 'DUPLICATE');
      }
    }

    const regNumber = createStudentRecord({ ...studentData });
    writeAuditLog(session.userId, 'CREATE_STUDENT', 'STUDENT', regNumber, 'SUCCESS',
      { studentName: studentData.studentName, phone: studentData.phone, slotPlan: studentData.slotPlan });

    const responseData = {
      registrationNumber: regNumber,
      studentName: studentData.studentName,
      message: 'Student admitted successfully.',
    };

    if (idempotencyKey) {
      CacheService.getScriptCache().put(`idemp_std_${idempotencyKey}`, JSON.stringify(responseData), 3600);
    }

    return okResponse(responseData);
  } finally {
    lock.releaseLock();
  }
}

function handleStudentsUpdate(session, payload) {
  try { requirePermission(session, 'students.update'); }
  catch (e) { return errorResponse(e.message, 'FORBIDDEN'); }

  const { registrationNumber, updates } = payload || {};
  const found = findStudentByRegNumber(registrationNumber);
  if (!found) return errorResponse('Student not found.', 'NOT_FOUND');

  const sheet = getSheet(SHEET_NAMES.STUDENTS);
  const rowNum = found.row;
  const now = new Date().toISOString();

  const fieldMap = {
    studentName: STUDENT_COLS.STUDENT_NAME,
    fatherName: STUDENT_COLS.FATHER_NAME,
    phone: STUDENT_COLS.PHONE,
    address: STUDENT_COLS.ADDRESS,
    registrationFee: STUDENT_COLS.REG_FEE,
    lockerCharge: STUDENT_COLS.LOCKER_CHARGE,
    monthlyFee: STUDENT_COLS.MONTHLY_FEE,
    slotPlan: STUDENT_COLS.SLOT_PLAN,
    notes: STUDENT_COLS.NOTES,
    status: STUDENT_COLS.STATUS,
  };

  for (const [key, colIdx] of Object.entries(fieldMap)) {
    if (updates[key] !== undefined) {
      sheet.getRange(rowNum, colIdx + 1).setValue(updates[key]);
    }
  }
  sheet.getRange(rowNum, STUDENT_COLS.UPDATED_AT + 1).setValue(now);

  writeAuditLog(session.userId, 'UPDATE_STUDENT', 'STUDENT', registrationNumber, 'SUCCESS',
    { modifiedFields: Object.keys(updates) });

  return okResponse({ message: 'Student record updated successfully.' });
}

function handleStudentsDiscontinue(session, payload) {
  try { requirePermission(session, 'students.discontinue'); }
  catch (e) { return errorResponse(e.message, 'FORBIDDEN'); }

  const { registrationNumber, reason, date } = payload || {};
  const found = findStudentByRegNumber(registrationNumber);
  if (!found) return errorResponse('Student not found.', 'NOT_FOUND');
  if (found.student.status === 'INACTIVE') {
    return errorResponse('Student is already marked as inactive.', 'CONFLICT');
  }

  const sheet = getSheet(SHEET_NAMES.STUDENTS);
  const rowNum = found.row;
  const now = new Date().toISOString();
  const discDate = date || now.slice(0, 10);

  sheet.getRange(rowNum, STUDENT_COLS.STATUS + 1).setValue('INACTIVE');
  sheet.getRange(rowNum, STUDENT_COLS.DISCONT_DATE + 1).setValue(discDate);
  sheet.getRange(rowNum, STUDENT_COLS.NOTES + 1).setValue(
    (found.student.notes ? found.student.notes + '\n' : '') + `Discontinued on ${discDate}: ${reason || 'No reason provided'}`
  );
  sheet.getRange(rowNum, STUDENT_COLS.UPDATED_AT + 1).setValue(now);

  writeAuditLog(session.userId, 'DISCONTINUE_STUDENT', 'STUDENT', registrationNumber, 'SUCCESS',
    { reason, date: discDate });

  return okResponse({ message: `Student ${registrationNumber} marked as inactive.` });
}

function handleStudentsReactivate(session, payload) {
  try { requirePermission(session, 'students.update'); }
  catch (e) { return errorResponse(e.message, 'FORBIDDEN'); }

  const { registrationNumber, effectiveDate } = payload || {};
  const found = findStudentByRegNumber(registrationNumber);
  if (!found) return errorResponse('Student not found.', 'NOT_FOUND');
  if (found.student.status === 'ACTIVE') {
    return errorResponse('Student is already active.', 'CONFLICT');
  }

  const sheet = getSheet(SHEET_NAMES.STUDENTS);
  const rowNum = found.row;
  const now = new Date().toISOString();
  const effDate = effectiveDate || now.slice(0, 10);

  sheet.getRange(rowNum, STUDENT_COLS.STATUS + 1).setValue('ACTIVE');
  sheet.getRange(rowNum, STUDENT_COLS.DISCONT_DATE + 1).setValue('');
  sheet.getRange(rowNum, STUDENT_COLS.NOTES + 1).setValue(
    (found.student.notes ? found.student.notes + '\n' : '') + `Reactivated on ${effDate}`
  );
  sheet.getRange(rowNum, STUDENT_COLS.UPDATED_AT + 1).setValue(now);

  writeAuditLog(session.userId, 'REACTIVATE_STUDENT', 'STUDENT', registrationNumber, 'SUCCESS',
    { effectiveDate: effDate });

  return okResponse({ message: `Student ${registrationNumber} reactivated successfully.` });
}

// ── Payments Handlers ──────────────────────────────────────────────────────

function handlePaymentsList(session, payload) {
  try { requirePermission(session, 'payments.view'); }
  catch (e) { return errorResponse(e.message, 'FORBIDDEN'); }

  let payments = getAllPayments();
  const { filters } = payload || {};

  if (filters) {
    if (filters.registrationNumber) {
      payments = payments.filter(p => p.registrationNumber === filters.registrationNumber);
    }
    if (filters.dateFrom) {
      payments = payments.filter(p => p.paymentDate >= filters.dateFrom);
    }
    if (filters.dateTo) {
      payments = payments.filter(p => p.paymentDate <= filters.dateTo);
    }
    if (filters.paymentMethod) {
      payments = payments.filter(p => p.paymentMethod === filters.paymentMethod);
    }
  }

  // Sort newest first
  payments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return okResponse({ payments, total: payments.length });
}

function handlePaymentsPreviewAllocation(session, payload) {
  try { requirePermission(session, 'payments.view'); }
  catch (e) { return errorResponse(e.message, 'FORBIDDEN'); }

  const { registrationNumber, amount, startMonth, numMonths } = payload || {};
  const found = findStudentByRegNumber(registrationNumber);
  if (!found) return errorResponse('Student not found.', 'NOT_FOUND');

  const student = found.student;
  const monthlyRate = parseFloat(student.monthlyFee) || 0;
  const totalAmount = parseFloat(amount) || 0;

  // Determine starting month (YYYY-MM)
  let currYear, currMonth;
  if (startMonth && /^\d{4}-\d{2}$/.test(startMonth)) {
    const parts = startMonth.split('-');
    currYear = parseInt(parts[0]);
    currMonth = parseInt(parts[1]);
  } else {
    // Find next unpaid month from ledger
    const ledger = getStudentLedgerRecords(registrationNumber);
    const paidMonths = ledger.filter(r => r.status === 'PAID');
    if (paidMonths.length > 0) {
      const last = paidMonths[paidMonths.length - 1];
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
    } else {
      allocated = 0;
      status = 'PENDING';
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

  const expectedTotal = count * monthlyRate;

  return okResponse({
    preview: {
      registrationNumber,
      studentName: student.studentName,
      monthlyFee: monthlyRate,
      numMonths: count,
      expectedTotal,
      enteredAmount: totalAmount,
      balanceDiff: totalAmount - expectedTotal,
      allocations,
      remainingUnallocated: remaining,
    },
  });
}

function handlePaymentsRecord(session, payload) {
  try { requirePermission(session, 'payments.record'); }
  catch (e) { return errorResponse(e.message, 'FORBIDDEN'); }

  const { paymentData, idempotencyKey } = payload || {};
  if (!paymentData || !paymentData.registrationNumber || !paymentData.amount) {
    return errorResponse('Registration number and amount are required.', 'VALIDATION_ERROR');
  }

  const totalAmount = parseFloat(paymentData.amount);
  if (totalAmount <= 0) {
    return errorResponse('Payment amount must be greater than zero.', 'VALIDATION_ERROR');
  }

  // Idempotency check via cache
  if (idempotencyKey) {
    const cache = CacheService.getScriptCache();
    const cached = cache.get(`idemp_pay_${idempotencyKey}`);
    if (cached) {
      try { return okResponse(JSON.parse(cached)); } catch(e){}
    }
  }

  const found = findStudentByRegNumber(paymentData.registrationNumber);
  if (!found) return errorResponse('Student not found.', 'NOT_FOUND');
  const student = found.student;

  const lock = LockService.getScriptLock();
  lock.waitLock(12000);
  try {
    // 1. Record payment transaction in Fee Updation
    const paymentResult = createPaymentRecord({
      ...paymentData,
      amount: totalAmount,
      enteredBy: session.userId,
    });

    // 2. Compute allocation & update Monthly Fee Ledger
    let currYear, currMonth;
    if (paymentData.startMonth && /^\d{4}-\d{2}$/.test(paymentData.startMonth)) {
      const parts = paymentData.startMonth.split('-');
      currYear = parseInt(parts[0]);
      currMonth = parseInt(parts[1]);
    } else {
      const ledger = getStudentLedgerRecords(paymentData.registrationNumber);
      const paid = ledger.filter(r => r.status === 'PAID');
      if (paid.length > 0) {
        const last = paid[paid.length - 1];
        currYear = last.year;
        currMonth = last.month + 1;
        if (currMonth > 12) { currMonth = 1; currYear++; }
      } else {
        const now = new Date();
        currYear = now.getFullYear();
        currMonth = now.getMonth() + 1;
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
      } else {
        allocated = 0;
        status = 'PENDING';
      }

      upsertLedgerRecord({
        registrationNumber: paymentData.registrationNumber,
        year: currYear,
        month: currMonth,
        monthLabel: label,
        dueAmount: due,
        paidAmount: allocated,
        balance: Math.max(0, due - allocated),
        coveredBy: paymentResult.paymentId,
        status,
        notes: `Paid via ${paymentData.paymentMethod || 'CASH'} (RCP: ${paymentResult.receiptNumber})`,
      });

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

    writeAuditLog(session.userId, 'RECORD_PAYMENT', 'PAYMENT', paymentResult.paymentId, 'SUCCESS', {
      registrationNumber: paymentData.registrationNumber,
      amount: totalAmount,
      receiptNumber: paymentResult.receiptNumber,
      monthsCovered: allocatedMonths.length,
    });

    const responseData = {
      paymentId: paymentResult.paymentId,
      receiptNumber: paymentResult.receiptNumber,
      amount: totalAmount,
      studentName: student.studentName,
      registrationNumber: paymentData.registrationNumber,
      paymentDate: paymentData.paymentDate || new Date().toISOString().slice(0, 10),
      paymentMethod: paymentData.paymentMethod || 'CASH',
      allocatedMonths,
      remainingCredit: remaining,
      message: `Payment of ₹${totalAmount.toLocaleString('en-IN')} recorded successfully.`,
    };

    if (idempotencyKey) {
      CacheService.getScriptCache().put(`idemp_pay_${idempotencyKey}`, JSON.stringify(responseData), 3600);
    }

    return okResponse(responseData);
  } finally {
    lock.releaseLock();
  }
}

function handlePaymentsStudentHistory(session, payload) {
  try { requirePermission(session, 'payments.view'); }
  catch (e) { return errorResponse(e.message, 'FORBIDDEN'); }

  const payments = getAllPayments()
    .filter(p => p.registrationNumber === payload.registrationNumber)
    .sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));

  return okResponse({ payments });
}

// ── Ledger Handlers ────────────────────────────────────────────────────────

function handleLedgerGetStudent(session, payload) {
  try { requirePermission(session, 'payments.view'); }
  catch (e) { return errorResponse(e.message, 'FORBIDDEN'); }

  const ledger = getStudentLedgerRecords(payload.registrationNumber);
  return okResponse({ ledger });
}

function handleLedgerMonthlyStatus(session, payload) {
  try { requirePermission(session, 'reports.view'); }
  catch (e) { return errorResponse(e.message, 'FORBIDDEN'); }

  const year = parseInt(payload.year) || new Date().getFullYear();
  const month = parseInt(payload.month) || (new Date().getMonth() + 1);
  const targetLabel = `${year}-${String(month).padStart(2, '0')}`;

  const students = getAllStudents();
  const allLedger = getAllLedgerRecords();
  const targetLedger = allLedger.filter(l => l.monthLabel === targetLabel);

  const statusList = students.map(s => {
    const lRecord = targetLedger.find(l => l.registrationNumber === s.registrationNumber);
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

  const activeStudentsInMonth = statusList.filter(s => s.studentStatus === 'ACTIVE');
  const paidCount = activeStudentsInMonth.filter(s => s.feeStatus === 'PAID').length;
  const partialCount = activeStudentsInMonth.filter(s => s.feeStatus === 'PARTIALLY_PAID').length;
  const pendingCount = activeStudentsInMonth.filter(s => s.feeStatus === 'PENDING').length;
  const totalDue = activeStudentsInMonth.reduce((sum, s) => sum + s.dueAmount, 0);
  const totalCollected = activeStudentsInMonth.reduce((sum, s) => sum + s.paidAmount, 0);
  const totalOutstanding = activeStudentsInMonth.reduce((sum, s) => sum + s.balance, 0);

  return okResponse({
    monthLabel: targetLabel,
    year,
    month,
    summary: {
      totalStudents: activeStudentsInMonth.length,
      paidCount,
      partialCount,
      pendingCount,
      totalDue,
      totalCollected,
      totalOutstanding,
    },
    students: statusList,
  });
}

// ── Reports Handlers ───────────────────────────────────────────────────────

function handleReportsDashboard(session) {
  try { requirePermission(session, 'reports.view'); }
  catch (e) { return errorResponse(e.message, 'FORBIDDEN'); }

  const students = getAllStudents();
  const payments = getAllPayments();
  const ledger = getAllLedgerRecords();

  const activeStudents = students.filter(s => s.status === 'ACTIVE').length;
  const totalStudents = students.length;

  const now = new Date();
  const currentMonthLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Collections this month
  const thisMonthPayments = payments.filter(p => {
    const d = String(p.paymentDate || p.createdAt || '');
    return d.startsWith(currentMonthLabel);
  });
  const monthlyCollection = thisMonthPayments.reduce((sum, p) => sum + p.amount, 0);

  // New admissions this month
  const newAdmissions = students.filter(s => {
    const d = String(s.admissionDate || s.createdAt || '');
    return d.startsWith(currentMonthLabel);
  }).length;

  // Pending student fees this month
  const currentMonthLedger = ledger.filter(l => l.monthLabel === currentMonthLabel);
  let pendingFeesThisMonth = 0;
  let defaultersCount = 0;

  students.filter(s => s.status === 'ACTIVE').forEach(s => {
    const entry = currentMonthLedger.find(l => l.registrationNumber === s.registrationNumber);
    if (!entry) {
      // No ledger entry means entirely pending for current month
      pendingFeesThisMonth += (parseFloat(s.monthlyFee) || 0);
      defaultersCount++;
    } else if (entry.status === 'PENDING' || entry.status === 'PARTIALLY_PAID') {
      pendingFeesThisMonth += entry.balance;
      defaultersCount++;
    }
  });

  // Last 6 months collection trend
  const monthly = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const shortLabel = d.toLocaleString('en-IN', { month: 'short' });

    const monthPayments = payments.filter(p => String(p.paymentDate || '').startsWith(label));
    const amount = monthPayments.reduce((sum, p) => sum + p.amount, 0);
    const admissions = students.filter(s => String(s.admissionDate || '').startsWith(label)).length;
    const discontinuations = students.filter(s => String(s.discontinuationDate || '').startsWith(label)).length;

    monthly.push({ month: shortLabel, amount, admissions, discontinuations });
  }

  // Recent 10 payments
  const recentPayments = payments
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 10)
    .map(p => {
      const student = students.find(s => s.registrationNumber === p.registrationNumber);
      return { ...p, studentName: student?.studentName || p.registrationNumber };
    });

  return okResponse({
    data: {
      stats: {
        activeStudents,
        totalStudents,
        monthlyCollection,
        paymentsThisMonth: thisMonthPayments.length,
        pendingStudentFees: pendingFeesThisMonth,
        defaulters: defaultersCount,
        newAdmissions,
      },
      monthly,
      recentPayments,
    },
  });
}

function handleReportsMonthlyCollection(session, payload) {
  try { requirePermission(session, 'reports.view'); }
  catch (e) { return errorResponse(e.message, 'FORBIDDEN'); }

  const { year, month } = payload || {};
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  const payments = getAllPayments().filter(p => String(p.paymentDate || '').startsWith(monthStr));
  const total = payments.reduce((sum, p) => sum + p.amount, 0);

  return okResponse({ payments, total, month: monthStr });
}

function handleReportsFeeDefaulters(session) {
  try { requirePermission(session, 'reports.view'); }
  catch (e) { return errorResponse(e.message, 'FORBIDDEN'); }

  const now = new Date();
  const currentMonthLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const students = getAllStudents().filter(s => s.status === 'ACTIVE');
  const allLedger = getAllLedgerRecords().filter(l => l.monthLabel === currentMonthLabel);

  const defaulters = [];
  students.forEach(s => {
    const l = allLedger.find(r => r.registrationNumber === s.registrationNumber);
    if (!l) {
      defaulters.push({
        registrationNumber: s.registrationNumber,
        studentName: s.studentName,
        phone: s.phone,
        monthlyFee: s.monthlyFee,
        dueAmount: s.monthlyFee,
        status: 'PENDING',
      });
    } else if (l.status === 'PENDING' || l.status === 'PARTIALLY_PAID') {
      defaulters.push({
        registrationNumber: s.registrationNumber,
        studentName: s.studentName,
        phone: s.phone,
        monthlyFee: s.monthlyFee,
        dueAmount: l.balance,
        status: l.status,
      });
    }
  });

  return okResponse({ defaulters, month: currentMonthLabel });
}

