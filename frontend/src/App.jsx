
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  GraduationCap,
  IndianRupee,
  Users,
  Wallet,
  Plus,
  Search,
  Pencil,
  Trash2,
  MoreVertical,
  Menu,
  X,
  RefreshCw,
  CircleAlert,
  UserRoundPlus,
  BookOpen,
  CalendarDays,
  UsersRound,
  Download,
} from "lucide-react";

import { departmentApi, studentApi, staffApi, financeApi, authApi } from "./api";
import { firebaseAuth } from "./firebase";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import StaffFinance from "./StaffFinance";
import Finance from "./Finance";
import CollegeExpenses from "./CollegeExpenses";
import { Receipt } from "lucide-react";

const emptyDepartment = {
  name: "",
  code: "",
  description: "",
  is_active: true,
};

const emptyStudent = {
  admission_number: "",
  full_name: "",
  email: "",
  phone: "",
  department_id: "",
  course: "",
  batch: "",
  admission_date: "",
  status: "active",
};


function DepartmentRow({ department, onEdit, onDelete, isOwner }) {
  return (
    <tr>
      <td>
        <div className="department-name">
          <span className="department-symbol"><Building2 size={17} /></span>
          <div>
            <strong>{department.name}</strong>
            <small>{department.description || "No description added"}</small>
          </div>
        </div>
      </td>
      <td><span className="code-pill">{department.code}</span></td>
      <td>
        <span className={`status ${department.is_active ? "active" : "inactive"}`}>
          {department.is_active ? "Active" : "Inactive"}
        </span>
      </td>
      <td className="actions-cell">
        <button className="icon-button" aria-label={`Edit ${department.name}`} onClick={() => onEdit(department)}>
          <Pencil size={16} />
        </button>
        {isOwner && <button className="icon-button danger" aria-label={`Delete ${department.name}`} onClick={() => onDelete(department)}>
          <Trash2 size={16} />
        </button>}
      </td>
    </tr>
  );
}

function getYearOfStudy(batch, latestBatchStartYear) {
  // Determine each batch relative to the newest batch entered for its department.
  // Example: latest start 2027 => 2027 batch is 1st year, 2026 is 2nd, etc.
  const match = String(batch || "").trim().match(/^(20\d{2})\s*[-–—/]\s*(20\d{2})$/);
  if (!match) return null;

  const startYear = Number(match[1]);
  const endYear = Number(match[2]);
  const duration = endYear - startYear;
  if (duration < 1 || duration > 8) return null;

  const referenceYear = Number.isFinite(Number(latestBatchStartYear))
    ? Number(latestBatchStartYear)
    : startYear;
  const year = referenceYear - startYear + 1;

  // The cohort's duration is inferred from its saved start/end range.
  if (year > duration) return "graduated";
  if (year < 1) return 1;
  return year;
}

function splitBatch(batch) {
  // Also preserve partial input while the user is typing the start/end years.
  const match = String(batch || "").trim().match(/^(\d{0,4})\s*[-–—/]?\s*(\d{0,4})$/);
  return { start: match?.[1] || "", end: match?.[2] || "" };
}

function yearLabel(year) {
  if (year === "graduated") return "Graduated";
  const labels = { 1: "1st Year", 2: "2nd Year", 3: "3rd Year", 4: "4th Year", 5: "5th Year", 6: "6th Year", 7: "7th Year", 8: "8th Year" };
  return labels[year] || `${year}th Year`;
}

function StudentRow({
  student,
  departments,
  onEdit,
  onDiscontinue,
  onGraduate,
  onDelete,
  isOwner,
  selected,
  onToggle,
}) {
  const department = departments.find(
    (item) => item.id === student.department_id
  );

  const closeMenu = (event) => {
    event.currentTarget.closest("details")?.removeAttribute("open");
  };

  return (
    <tr>
      <td>
        <input
          type="checkbox"
          aria-label={`Select ${student.admission_number}`}
          checked={Boolean(selected)}
          disabled={student.status !== "active"}
          onChange={() => onToggle(student.id)}
        />
      </td>
      <td>
        <div className="department-name">
          <span className="department-symbol"><Users size={17} /></span>
          <div>
            <strong>{student.full_name || "Profile incomplete"}</strong>
            <small>{student.admission_number}</small>
          </div>
        </div>
      </td>
      <td>{student.course || "Not added"}</td>
      <td>{department?.name || "Department unavailable"}</td>
      <td>{student.batch || "Not added"}</td>
      <td>
        <span className={`status ${student.status === "active" ? "active" : "inactive"}`}>
          {student.status}
        </span>
      </td>
      <td className="student-actions-cell">
        <details className="row-action-menu">
          <summary
            className="icon-button row-action-trigger"
            aria-label={`Actions for ${student.full_name || student.admission_number}`}
            title="More actions"
          >
            <MoreVertical size={18} />
          </summary>
          <div className="row-action-popover">
            <button
              type="button"
              onClick={(event) => {
                closeMenu(event);
                onEdit(student);
              }}
            >
              <Pencil size={15} /> Edit student
            </button>
            {student.status === "active" && (
              <button
                type="button"
                onClick={(event) => {
                  closeMenu(event);
                  onGraduate(student);
                }}
              >
                <GraduationCap size={15} /> Graduate
              </button>
            )}
            {student.status === "active" && (
              <button
                type="button"
                onClick={(event) => {
                  closeMenu(event);
                  onDiscontinue(student);
                }}
              >
                <CircleAlert size={15} /> Discontinue
              </button>
            )}
            {isOwner && <button
              type="button"
              className="menu-danger"
              onClick={(event) => {
                closeMenu(event);
                onDelete(student);
              }}
            >
              <Trash2 size={15} /> Delete permanently
            </button>}
          </div>
        </details>
      </td>
    </tr>
  );
}

export default function App() {
  // Firebase Authentication is the source of truth for login and role claims.
  const [currentUser, setCurrentUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const isOwner = currentUser?.role === "owner";

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
      if (!firebaseUser) { setCurrentUser(null); setAuthReady(true); return; }
      try {
        const tokenResult = await firebaseUser.getIdTokenResult(true);
        const role = tokenResult.claims.role;
        if (role !== "owner" && role !== "staff") {
          await signOut(firebaseAuth);
          setLoginError("This account is not authorized for CampusLedger.");
          setCurrentUser(null);
        } else setCurrentUser({ uid: firebaseUser.uid, email: firebaseUser.email, role });
      } catch {
        setLoginError("Unable to verify your account. Please sign in again.");
        await signOut(firebaseAuth); setCurrentUser(null);
      } finally { setAuthReady(true); }
    });
    return unsubscribe;
  }, []);

  const [activePage, setActivePage] = useState("departments");

  const [departments, setDepartments] = useState([]);
  const [students, setStudents] = useState([]);
  const [staffRecords, setStaffRecords] = useState([]);

  const [departmentForm, setDepartmentForm] = useState(emptyDepartment);
  const [studentForm, setStudentForm] = useState(emptyStudent);
  const [studentFinanceForm, setStudentFinanceForm] = useState({
    academic_year: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
    fee_category: "Tuition Fee",
    assigned_amount: "",
    concession_amount: "0",
    due_date: "",
    installment: "Full payment",
    payment_amount: "",
    paid_date: new Date().toISOString().slice(0, 10),
    payment_method: "upi",
    receipt_number: "",
    donation_amount: "",
  });
  const [savedStudentFinance, setSavedStudentFinance] = useState({ loading: false, fees: [], payments: [], donations: [], error: "" });
  const [studentMode, setStudentMode] = useState("single");
  const [studentStep, setStudentStep] = useState(0);
  const studentSaveAllowed = useRef(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedBatch, setExpandedBatch] = useState(null);
  const [bulkForm, setBulkForm] = useState({
    admission_prefix: "",
    start_number: "",
    end_number: "",
    number_padding: "",
    department_id: "",
    course: "",
    from_year: "",
    to_year: "",
    batch: "",
  });

  const [editingDepartmentId, setEditingDepartmentId] = useState(null);
  const [editingStudentId, setEditingStudentId] = useState(null);

  const [departmentSearch, setDepartmentSearch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkEditForm, setBulkEditForm] = useState({ from_year: "", to_year: "", department_id: "", course: "" });

  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const selectedBulkDepartment = departments.find(
  (department) => department.id === bulkForm.department_id
);

const departmentCode =
  selectedBulkDepartment?.code ||
  selectedBulkDepartment?.short_name ||
  selectedBulkDepartment?.abbreviation ||
  "";

const generatedBatch =
  `${bulkForm.from_year}-${bulkForm.to_year}`;

const generatedPrefix =
  `${String(bulkForm.from_year).slice(-2)}${departmentCode}`.toUpperCase();

  const loadDepartments = useCallback(async () => {
    setLoadingDepartments(true);
    try {
      const data = await departmentApi.list();
      setDepartments(data);
    } catch (err) {
      setError(`Unable to load departments: ${err.message}`);
    } finally {
      setLoadingDepartments(false);
    }
  }, []);

  const loadStudents = useCallback(async () => {
    setLoadingStudents(true);
    try {
      const data = await studentApi.list();
      setStudents(data);
    } catch (err) {
      setError(`Unable to load students: ${err.message}`);
    } finally {
      setLoadingStudents(false);
    }
  }, []);

  const loadStaffAndFinance = useCallback(async () => {
    try {
      const staffData = await staffApi.list();
      setStaffRecords(staffData);
    } catch (err) {
      setError(`Unable to load staff data: ${err.message}`);
    }
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    loadDepartments();
    loadStudents();
    loadStaffAndFinance();
  }, [currentUser, loadDepartments, loadStudents, loadStaffAndFinance]);

  const activeDepartments = useMemo(
    () => departments.filter((department) => department.is_active),
    [departments]
  );

  const filteredDepartments = useMemo(() => {
    const term = departmentSearch.trim().toLowerCase();
    return departments.filter((item) =>
      item.name.toLowerCase().includes(term) ||
      item.code.toLowerCase().includes(term)
    );
  }, [departments, departmentSearch]);

  const filteredStudents = useMemo(() => {
    const term = studentSearch.trim().toLowerCase();
    return students.filter((student) =>
      [
        student.full_name,
        student.admission_number,
        student.email || "",
        student.course,
        student.batch,
      ].some((value) => (value || "").toLowerCase().includes(term))
    );
  }, [students, studentSearch]);

  function csvCell(value) {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
  }

  function downloadCsv(filename, headers, rows) {
    const content = [headers, ...rows]
      .map((row) => row.map(csvCell).join(","))
      .join("\r\n");
    const blob = new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function downloadStudentReport(reportType, selectedDepartmentId = "all") {
    setError("");
    setNotice("");
    try {
      const departmentName = (student) =>
        departments.find((d) => d.id === student.department_id)?.name || "Department unavailable";
      const departmentFiltered = selectedDepartmentId === "all"
        ? [...students]
        : students.filter((student) => String(student.department_id) === String(selectedDepartmentId));
      const sorted = departmentFiltered.sort((a, b) =>
        departmentName(a).localeCompare(departmentName(b)) ||
        String(a.batch || "").localeCompare(String(b.batch || "")) ||
        String(a.full_name || "").localeCompare(String(b.full_name || ""))
      );
      const departmentSuffix = selectedDepartmentId === "all"
        ? "All_Departments"
        : (departments.find((d) => String(d.id) === String(selectedDepartmentId))?.code || "Selected_Department");
      const batchYear = (student) => {
        const match = String(student.batch || "").match(/(20\d{2})\s*[-–—/]\s*(20\d{2})/);
        return match ? `${match[1]}-${match[2]}` : (student.batch || "Not available");
      };

      if (reportType === "roster") {
        downloadCsv(`CampusLedger_Student_List_${departmentSuffix}_${new Date().toISOString().slice(0, 10)}.csv`,
          ["Department", "Batch year", "Student name", "Roll number"],
          sorted.map((student) => [departmentName(student), batchYear(student), student.full_name || "Profile incomplete", student.admission_number || ""]));
        return;
      }

      const [feeRecords, paymentRecords] = await Promise.all([financeApi.fees(), financeApi.payments()]);
      const statusForStudent = (student) => {
        const studentFees = feeRecords.filter((fee) => String(fee.student_id) === String(student.id));
        if (!studentFees.length) return "Not paid";
        const assigned = studentFees.reduce((sum, fee) => sum + Math.max(0, Number(fee.assigned_amount || 0) - Number(fee.concession_amount || 0)), 0);
        const feeIds = new Set(studentFees.map((fee) => String(fee.id || fee.fee_assignment_id || "")));
        const paid = paymentRecords.filter((payment) =>
          String(payment.student_id) === String(student.id) &&
          (feeIds.has(String(payment.fee_assignment_id || "")) || !payment.fee_assignment_id)
        ).reduce((sum, payment) => sum + Math.max(0, Number(payment.amount || 0)), 0);
        if (assigned > 0 && paid >= assigned) return "Paid";
        if (paid > 0) return "Pending";
        return "Not paid";
      };
      const withStatus = sorted.map((student) => ({ student, status: statusForStudent(student) }));
      // Only export students who have fees that are not fully paid.
      const selected = withStatus.filter((item) => item.status !== "Paid");
      downloadCsv(`CampusLedger_Fees_Not_Paid_${departmentSuffix}_${new Date().toISOString().slice(0, 10)}.csv`,
        ["Department", "Batch year", "Student name", "Roll number", "Fee status"],
        selected.map(({ student, status }) => [departmentName(student), batchYear(student), student.full_name || "Profile incomplete", student.admission_number || "", status]));
    } catch (err) {
      setError(`Could not download student report: ${err.message || "Unknown error"}`);
    }
  }

  function changeDepartmentField(event) {
    const { name, value, type, checked } = event.target;
    setDepartmentForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function changeStudentField(event) {
    const { name, value } = event.target;
    setStudentForm((current) => {
      const next = { ...current, [name]: value };
      // When department/batch changes, keep an auto-generated admission prefix in sync,
      // but do not overwrite a manually entered admission number.
      if (name === "department_id" || name === "batch") {
        const dept = departments.find((d) => d.id === (name === "department_id" ? value : current.department_id));
        const code = String(dept?.code || dept?.short_name || dept?.abbreviation || "").trim().toUpperCase();
        const years = splitBatch(name === "batch" ? value : current.batch);
        const oldYears = splitBatch(current.batch);
        if (code && years.start) {
          const newPrefix = `${years.start.slice(-2)}${code}`;
          const oldPrefix = oldYears.start ? `${oldYears.start.slice(-2)}${code}` : "";
          const admission = current.admission_number || "";
          if (!admission || (oldPrefix && admission.toUpperCase().startsWith(oldPrefix))) {
            next.admission_number = `${newPrefix}${admission.slice(oldPrefix.length)}`;
          } else if (name === "department_id" && !admission) {
            next.admission_number = newPrefix;
          }
        }
      }
      return next;
    });
  }

  function changeBatchYear(which, value) {
    setStudentForm((current) => {
      const years = splitBatch(current.batch);
      const start = which === "start" ? value : years.start;
      const end = which === "end" ? value : years.end;
      const batch = start && end ? `${start}-${end}` : (start || end ? `${start}-${end}` : "");
      const next = { ...current, batch };
      const dept = departments.find((d) => d.id === current.department_id);
      const code = String(dept?.code || dept?.short_name || dept?.abbreviation || "").trim().toUpperCase();
      if (code && /^20\d{2}$/.test(start)) {
        const prefix = `${start.slice(-2)}${code}`;
        const admission = current.admission_number || "";
        const priorStart = years.start;
        const priorPrefix = priorStart ? `${priorStart.slice(-2)}${code}` : "";
        if (!admission || (priorPrefix && admission.toUpperCase().startsWith(priorPrefix))) {
          next.admission_number = `${prefix}${admission.slice(priorPrefix.length)}`;
        }
      }
      return next;
    });
  }

  function editDepartment(department) {
    setEditingDepartmentId(department.id);
    setDepartmentForm({
      name: department.name,
      code: department.code,
      description: department.description || "",
      is_active: department.is_active,
    });
    setError("");
    setNotice("");
    setActivePage("departments");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetDepartmentForm() {
    setDepartmentForm(emptyDepartment);
    setEditingDepartmentId(null);
  }

  async function submitDepartment(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const payload = {
        ...departmentForm,
        name: departmentForm.name.trim(),
        code: departmentForm.code.trim().toUpperCase(),
        description: departmentForm.description.trim() || null,
      };

      if (editingDepartmentId) {
        await departmentApi.update(editingDepartmentId, payload);
        setNotice("Department updated successfully.");
      } else {
        await departmentApi.create(payload);
        setNotice("Department added successfully.");
      }

      resetDepartmentForm();
      await loadDepartments();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteDepartment(department) {
    if (!isOwner) { setError("Only the Owner can delete records."); return; }
    if (!window.confirm(`Delete department "${department.name}"?`)) return;

    setError("");
    setNotice("");

    try {
      await departmentApi.remove(department.id);
      setNotice("Department deleted.");
      if (editingDepartmentId === department.id) resetDepartmentForm();
      await loadDepartments();
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadSavedStudentFinance(studentId) {
    setSavedStudentFinance({ loading: true, fees: [], payments: [], donations: [], error: "" });
    try {
      const [allFees, allPayments, allDonations] = await Promise.all([
        financeApi.fees(),
        financeApi.payments(),
        financeApi.donations(),
      ]);
      const sameStudent = (record) => String(record?.student_id ?? "") === String(studentId ?? "");
      const fees = (Array.isArray(allFees) ? allFees : []).filter(sameStudent);
      const payments = (Array.isArray(allPayments) ? allPayments : []).filter(sameStudent);
      const donations = (Array.isArray(allDonations) ? allDonations : []).filter(sameStudent);
      setSavedStudentFinance({ loading: false, fees, payments, donations, error: "" });

      // Copy saved values into the controlled form fields so they remain editable.
      // Finance totals are still shown separately and are not silently submitted as new transactions.
      const firstFee = fees[0] || {};
      setStudentFinanceForm((current) => ({
        ...current,
        academic_year: firstFee.academic_year || current.academic_year,
        fee_category: firstFee.fee_category || current.fee_category,
        assigned_amount: fees.length ? String(fees.reduce((sum, fee) => sum + Number(fee.assigned_amount || 0), 0)) : "0",
        concession_amount: fees.length ? String(fees.reduce((sum, fee) => sum + Number(fee.concession_amount || 0), 0)) : "0",
        due_date: firstFee.due_date || current.due_date,
        installment: firstFee.installment || current.installment,
        payment_amount: String(payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)),
        paid_date: payments[0]?.paid_date || payments[0]?.received_date || current.paid_date,
        payment_method: payments[0]?.method || current.payment_method,
        receipt_number: payments[0]?.receipt_number || current.receipt_number,
        donation_amount: String(donations.reduce((sum, donation) => sum + Number(donation.amount || 0), 0)),
      }));
    } catch (err) {
      setSavedStudentFinance({ loading: false, fees: [], payments: [], donations: [], error: err?.message || "Unable to load saved financial records." });
    }
  }

  async function editStudent(student) {
    setStudentStep(0);
    setEditingStudentId(student.id);
    setSavedStudentFinance({ loading: true, fees: [], payments: [], donations: [], error: "" });
    loadSavedStudentFinance(student.id);
    setStudentForm({
      admission_number: student.admission_number,
      full_name: student.full_name || "",
      email: student.email || "",
      phone: student.phone || "",
      department_id: student.department_id,
      course: student.course || "",
      batch: student.batch || "",
      admission_date: student.admission_date || "",
      status: student.status,
    });
    setError("");
    setNotice("");
    window.setTimeout(() => {
      document.getElementById("student-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  function resetStudentForm() {
    studentSaveAllowed.current = false;
    setStudentStep(0);
    setStudentForm(emptyStudent);
    setStudentFinanceForm({
      academic_year: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
      fee_category: "Tuition Fee", assigned_amount: "", concession_amount: "0",
      due_date: "", installment: "Full payment", payment_amount: "",
      paid_date: new Date().toISOString().slice(0, 10), payment_method: "upi",
      receipt_number: "", donation_amount: "",
    });
    setEditingStudentId(null);
    setSavedStudentFinance({ loading: false, fees: [], payments: [], donations: [], error: "" });
  }

  function changeStudentFinanceField(event) {
    const { name, value } = event.target;
    setStudentFinanceForm((current) => ({ ...current, [name]: value }));
  }

  function goToStudentFeeStep(event) {
    event.preventDefault();
    event.stopPropagation();
    studentSaveAllowed.current = false;

    const form = document.getElementById("student-entry-form");
    if (!form) return;

    // The academic page is the only page mounted at step 0.
    const requiredFields = Array.from(
      form.querySelectorAll("input[required], select[required], textarea[required]")
    );
    const firstInvalid = requiredFields.find((field) => !field.checkValidity());
    if (firstInvalid) {
      firstInvalid.reportValidity();
      firstInvalid.focus();
      return;
    }

    const years = splitBatch(studentForm.batch);
    if (!years.start || !years.end || Number(years.end) <= Number(years.start)) {
      setError("Enter a valid batch start and end year, for example 2027 and 2031.");
      return;
    }

    setError("");
    setStudentStep(1);
  }

  const money = (amount) => `₹${Number(amount || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

  // Distribute an edited aggregate amount across the existing records without
  // deleting receipt/history documents. Rounding is handled in paise.
  function allocateTotal(totalValue, records, weightField = "amount") {
    const totalPaise = Math.round(Math.max(0, Number(totalValue || 0)) * 100);
    if (!records.length) return [];
    const weights = records.map((record) => Math.max(0, Number(record?.[weightField] || 0)));
    const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
    const effectiveWeights = weightSum > 0 ? weights : records.map(() => 1);
    const effectiveSum = effectiveWeights.reduce((sum, weight) => sum + weight, 0);
    let remaining = totalPaise;
    return effectiveWeights.map((weight, index) => {
      const amount = index === effectiveWeights.length - 1
        ? remaining
        : Math.floor(totalPaise * weight / effectiveSum);
      remaining -= amount;
      return Math.max(0, amount) / 100;
    });
  }
  const savedAssignedAmount = savedStudentFinance.fees.reduce((sum, fee) => sum + Number(fee.assigned_amount || 0), 0);
  const savedConcessionAmount = savedStudentFinance.fees.reduce((sum, fee) => sum + Number(fee.concession_amount || 0), 0);
  const savedPaymentAmount = savedStudentFinance.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const savedDonationAmount = savedStudentFinance.donations.reduce((sum, donation) => sum + Number(donation.amount || 0), 0);
  const displayAssignedAmount = Number(studentFinanceForm.assigned_amount || 0);
  const displayConcessionAmount = Number(studentFinanceForm.concession_amount || 0);
  const displayPaymentAmount = Number(studentFinanceForm.payment_amount || 0);
  const displayDonationAmount = Number(studentFinanceForm.donation_amount || 0);
  const netStudentFee = Math.max(0, displayAssignedAmount - displayConcessionAmount);
  const initialStudentPayment = displayPaymentAmount;
  const studentOutstanding = Math.max(0, netStudentFee - initialStudentPayment);

  async function submitStudent(event) {
    event.preventDefault();

    // This function may only save after an explicit click on the final Save button.
    if (!studentSaveAllowed.current || studentStep !== 1) return;
    studentSaveAllowed.current = false;

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const years = splitBatch(studentForm.batch);
      if (!years.start || !years.end || Number(years.end) <= Number(years.start)) {
        throw new Error("Enter a valid batch start and end year, for example 2027 and 2031.");
      }
      const payload = {
        ...studentForm,
        admission_number: studentForm.admission_number.trim(),
        full_name: studentForm.full_name.trim(),
        email: studentForm.email.trim() || null,
        phone: studentForm.phone.trim() || null,
        department_id: studentForm.department_id,
        course: studentForm.course.trim(),
        batch: `${years.start}-${years.end}`,
        admission_date: studentForm.admission_date,
      };

      const f = studentFinanceForm;
      const assigned = Number(f.assigned_amount || 0);
      const concession = Number(f.concession_amount || 0);
      const payment = Number(f.payment_amount || 0);
      const donation = Number(f.donation_amount || 0);
      if ([assigned, concession, payment, donation].some((amount) => !Number.isFinite(amount) || amount < 0)) {
        throw new Error("Financial amounts must be valid non-negative numbers.");
      }
      if (concession > assigned) throw new Error("Concession cannot exceed the assigned fee.");
      if (assigned === 0 && (concession > 0 || payment > 0)) {
        throw new Error("Enter an assigned fee before entering a concession or fee payment.");
      }
      if (assigned > 0 && !f.due_date) throw new Error("Select a due date when assigning a fee.");
      if (payment > Math.max(0, assigned - concession) && assigned > 0) {
        throw new Error("Amount received cannot exceed the net assigned fee.");
      }
      if ((payment > 0 || donation > 0) && !f.paid_date) throw new Error("Select the payment/received date.");

      let studentId = editingStudentId;
      if (editingStudentId) {
        await studentApi.update(editingStudentId, payload);
      } else {
        const createdStudent = await studentApi.create(payload);
        studentId = createdStudent?.id;
        if (!studentId) throw new Error("Student saved, but the API did not return the new student ID. Financial records were not submitted.");
      }

      const saved = [];
      if (editingStudentId) {
        const current = savedStudentFinance;
        if (current.loading) throw new Error("Saved financial records are still loading. Refresh them and try again.");
        if (current.error) throw new Error(`Cannot safely update financial records: ${current.error}`);

        // Fee fields represent totals across this student's saved fee assignments.
        if (current.fees.length) {
          const assignedParts = allocateTotal(assigned, current.fees, "assigned_amount");
          const concessionParts = allocateTotal(concession, current.fees, "assigned_amount");
          const netTarget = Math.max(0, assigned - concession);
          const totalPayments = current.payments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
          if (totalPayments > netTarget + 0.0001) {
            throw new Error(`Saved payments total ${money(totalPayments)}. Net fees cannot be reduced below that amount.`);
          }
          for (let i = 0; i < current.fees.length; i += 1) {
            const fee = current.fees[i];
            await financeApi.updateFee(fee.id, {
              assigned_amount: assignedParts[i],
              concession_amount: concessionParts[i],
            });
          }
          saved.push("fee assignment(s)");
        } else if (assigned > 0) {
          await financeApi.assignFee({
            student_id: studentId, academic_year: f.academic_year, fee_category: f.fee_category,
            assigned_amount: assigned, concession_amount: concession, due_date: f.due_date, installment: f.installment,
          });
          saved.push("fee assignment");
        }

        // Existing payments are edited in place; receipt IDs remain unchanged. Update
        // reductions first so the backend never sees a temporary overpayment.
        if (current.payments.length) {
          const paymentParts = allocateTotal(payment, current.payments, "amount");
          const paymentUpdates = current.payments.map((record, index) => ({ record, amount: paymentParts[index] }))
            .sort((a, b) => (a.amount - Number(a.record.amount || 0)) - (b.amount - Number(b.record.amount || 0)));
          for (const item of paymentUpdates) {
            await financeApi.updatePayment(item.record.id, { amount: item.amount });
          }
          saved.push("payment record(s)");
        } else if (payment > 0) {
          const [allFeesResponse, allPaymentsResponse] = await Promise.all([
            financeApi.fees(),
            financeApi.payments(),
          ]);
          const allFees = Array.isArray(allFeesResponse) ? allFeesResponse : [];
          const allPayments = Array.isArray(allPaymentsResponse) ? allPaymentsResponse : [];

          // Prefer the fee assignment IDs already loaded for this student. This avoids
          // relying on an exact student_id match when legacy Firestore records use a
          // different ID representation, while still using refreshed fee balances.
          const savedFeeIds = new Set(
            (current.fees || []).map((fee) => String(fee.id ?? fee.fee_assignment_id ?? "")).filter(Boolean)
          );
          let matchingFees = allFees.filter((fee) => savedFeeIds.has(String(fee.id ?? "")));
          if (!matchingFees.length) {
            matchingFees = allFees.filter(
              (fee) => String(fee.student_id ?? "") === String(studentId ?? "")
            );
          }

          const availableFees = matchingFees.map((fee) => {
            const feeId = String(fee.id ?? "");
            const paid = allPayments
              .filter((item) => String(item.fee_assignment_id ?? "") === feeId)
              .reduce((sum, item) => sum + Number(item.amount || 0), 0);
            return {
              fee,
              feeId,
              available: Math.max(
                0,
                Number(fee.assigned_amount || 0) - Number(fee.concession_amount || 0) - paid
              ),
            };
          }).filter((item) => item.feeId && item.available > 0);

          const totalAvailable = availableFees.reduce((sum, item) => sum + item.available, 0);
          if (totalAvailable + 0.0001 < payment) {
            throw new Error(
              matchingFees.length
                ? `Payment ₹${payment.toLocaleString("en-IN")} exceeds the available fee balance of ₹${totalAvailable.toLocaleString("en-IN")}. Check the assigned fee, concession, and existing payments.`
                : "No saved fee assignment was found for this student. Save an assigned fee before recording a payment."
            );
          }

          // The amount in the form is the student's aggregate payment. If no payment
          // record exists yet, split it across the student's fee assignments according
          // to each assignment's remaining balance rather than requiring one fee to
          // cover the entire amount.
          let remainingPayment = Math.round(payment * 100) / 100;
          const receiptBase = f.receipt_number.trim() || `RCPT-${Date.now()}`;
          let paymentIndex = 0;
          for (const item of availableFees) {
            if (remainingPayment <= 0.0001) break;
            const part = Math.round(Math.min(remainingPayment, item.available) * 100) / 100;
            if (part <= 0) continue;
            const receiptNumber = paymentIndex === 0
              ? receiptBase
              : `${receiptBase}-${paymentIndex + 1}`;
            await financeApi.recordPayment({
              student_id: studentId,
              fee_assignment_id: item.feeId,
              amount: part,
              paid_date: f.paid_date,
              method: f.payment_method,
              receipt_number: receiptNumber,
            });
            remainingPayment = Math.round((remainingPayment - part) * 100) / 100;
            paymentIndex += 1;
          }
          saved.push(paymentIndex > 1 ? `${paymentIndex} payment records` : "payment");
        }

        // Update donation amounts in place, preserving each existing receipt record.
        if (current.donations.length) {
          const donationParts = allocateTotal(donation, current.donations, "amount");
          for (let i = 0; i < current.donations.length; i += 1) {
            await financeApi.updateDonation(current.donations[i].id, { amount: donationParts[i] });
          }
          saved.push("donation record(s)");
        } else if (donation > 0) {
          await financeApi.recordDonation({ student_id: studentId, amount: donation, received_date: f.paid_date, method: f.payment_method, receipt_number: `DON-${Date.now()}`, purpose: "Student registration donation" });
          saved.push("donation");
        }
      } else {
        let feeAssignment = null;
        if (assigned > 0) {
          feeAssignment = await financeApi.assignFee({ student_id: studentId, academic_year: f.academic_year, fee_category: f.fee_category, assigned_amount: assigned, concession_amount: concession, due_date: f.due_date, installment: f.installment });
          saved.push("fee assignment");
        }
        if (payment > 0) {
          let targetFee = feeAssignment;
          if (!targetFee?.id) {
            const [allFees, allPayments] = await Promise.all([financeApi.fees(), financeApi.payments()]);
            targetFee = allFees.filter((fee) => fee.student_id === studentId).find((fee) => {
              const paid = allPayments.filter((item) => item.fee_assignment_id === fee.id).reduce((sum, item) => sum + Number(item.amount || 0), 0);
              return Number(fee.assigned_amount || 0) - Number(fee.concession_amount || 0) - paid >= payment;
            });
            if (!targetFee) throw new Error("No existing fee assignment has enough balance for this payment.");
          }
          await financeApi.recordPayment({ student_id: studentId, fee_assignment_id: targetFee.id, amount: payment, paid_date: f.paid_date, method: f.payment_method, receipt_number: f.receipt_number.trim() || `RCPT-${Date.now()}` });
          saved.push("payment");
        }
        if (donation > 0) {
          await financeApi.recordDonation({ student_id: studentId, amount: donation, received_date: f.paid_date, method: f.payment_method, receipt_number: `DON-${Date.now()}`, purpose: "Student registration donation" });
          saved.push("donation");
        }
      }
      setNotice(`${editingStudentId ? "Student and financial records updated" : "Student registered"} successfully${saved.length ? `; updated/saved ${saved.join(", ")}` : ". No financial values changed."}`);
      resetStudentForm();
      await Promise.all([loadStudents(), loadDepartments()]);
    } catch (err) {
      setError(err.message || "Unable to save student.");
    } finally {
      setSaving(false);
    }
  }

function changeBulkField(event) {
  const { name, value } = event.target;

  setBulkForm((current) => {
    const updated = { ...current, [name]: value };

    const department = departments.find((item) => item.id === updated.department_id);
    const code = String(department?.code || department?.short_name || department?.abbreviation || "").trim().toUpperCase();
    const startYear = name === "from_year" ? value : updated.from_year;
    if (code && /^20\d{2}$/.test(startYear || "")) {
      updated.admission_prefix = `${startYear.slice(-2)}${code}`;
    }
    if (name === "from_year" || name === "to_year") {
      updated.batch = updated.from_year && updated.to_year ? `${updated.from_year}-${updated.to_year}` : "";
    }
    return updated;
  });
}


  async function submitBulkStudents(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      if (!bulkForm.department_id) {
        throw new Error("Please select a department.");
      }
      if (!/^20\d{2}$/.test(bulkForm.from_year) || !/^20\d{2}$/.test(bulkForm.to_year) || Number(bulkForm.to_year) <= Number(bulkForm.from_year)) {
        throw new Error("Enter a valid batch start and end year.");
      }
      const start = Number(bulkForm.start_number);
      const end = Number(bulkForm.end_number);
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) {
        throw new Error("Enter a valid admission-number range.");
      }
      if (end - start + 1 > 500) {
        throw new Error("You can generate a maximum of 500 students per request.");
      }

        const payload = {
          admission_prefix: generatedPrefix,
          start_number: start,
          end_number: end,
          number_padding: Number(bulkForm.number_padding),
          department_id: bulkForm.department_id,
          course: bulkForm.course.trim(),
          batch: generatedBatch,
          admission_date: bulkForm.admission_date,
        };

await studentApi.bulk(payload);
      setNotice(`Created ${end - start + 1} student placeholder records. Complete their profiles by editing each record.`);
      setBulkForm((current) => ({
        ...current,
        start_number: String(end + 1),
        end_number: String(end + 10),
      }));
      await loadStudents();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function toggleStudentSelection(studentId) {
    setSelectedStudentIds(current => current.includes(studentId) ? current.filter(id => id !== studentId) : [...current, studentId]);
  }

  function openBulkEdit(studentIds = selectedStudentIds) {
    const chosen = students.filter((student) => studentIds.includes(student.id));
    if (!chosen.length) return;
    const first = chosen[0];
    const years = splitBatch(first.batch);
    setBulkEditForm({
      from_year: years.start,
      to_year: years.end,
      department_id: first.department_id || "",
      course: first.course || "",
    });
    setSelectedStudentIds(chosen.map((student) => student.id));
    setShowBulkEdit(true);
    setError("");
    setNotice("");
    window.setTimeout(() => {
      document.getElementById("bulk-student-edit-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  async function saveBulkEdit(event) {
    event.preventDefault();
    if (!selectedStudentIds.length) return;
    if (!/^20\d{2}$/.test(bulkEditForm.from_year) || !/^20\d{2}$/.test(bulkEditForm.to_year) || Number(bulkEditForm.to_year) <= Number(bulkEditForm.from_year)) {
      setError("Enter a valid batch start and end year.");
      return;
    }
    setSaving(true); setError(""); setNotice("");
    try {
      const selected = students.filter((student) => selectedStudentIds.includes(student.id));
      const updatedBatch = `${bulkEditForm.from_year}-${bulkEditForm.to_year}`;
      const results = await Promise.allSettled(selected.map((student) =>
        studentApi.updateBatch(student.id, {
          batch: updatedBatch,
          department_id: bulkEditForm.department_id || student.department_id,
          course: bulkEditForm.course.trim() || student.course,
        })
      ));
      const failed = results.filter((result) => result.status === "rejected");
      if (failed.length) {
        throw new Error(`${failed.length} of ${selected.length} student updates failed. First error: ${failed[0].reason?.message || "Unknown API error"}. No successful updates were rolled back; refresh and retry only the students still showing the old batch.`);
      }
      setNotice(`Updated ${selected.length} student records to batch ${updatedBatch}. Financial records were left unchanged.`);
      setShowBulkEdit(false);
      setSelectedStudentIds([]);
      await loadStudents();
    } catch (err) {
      setError(err.message || "Unable to update selected students.");
      await loadStudents();
    } finally { setSaving(false); }
  }

  async function deleteStudents(studentIds, label = "selected students") {
    if (!isOwner) { setError("Only the Owner can delete records."); return; }
    const chosen = students.filter((student) => studentIds.includes(student.id));
    if (!chosen.length) return;
    if (!window.confirm(`PERMANENTLY DELETE ${chosen.length} ${label}? This removes the student records from Firestore and cannot be undone. Related finance records are not deleted by this student endpoint.`)) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const results = await Promise.allSettled(chosen.map((student) => studentApi.permanentDelete(student.id)));
      const failed = results.filter((result) => result.status === "rejected");
      if (failed.length) {
        throw new Error(`${failed.length} of ${chosen.length} delete requests failed. First error: ${failed[0].reason?.message || "Unknown API error"}.`);
      }
      setNotice(`Permanently deleted ${chosen.length} student records.`);
      setSelectedStudentIds((ids) => ids.filter((id) => !studentIds.includes(id)));
      if (chosen.some((student) => student.id === editingStudentId)) resetStudentForm();
      await loadStudents();
    } catch (err) {
      setError(err.message || "Unable to delete all selected students. Refresh the list and check which records remain before retrying.");
      await loadStudents();
    } finally { setSaving(false); }
  }

  async function bulkGraduateStudents() {
    if (selectedStudentIds.length === 0) { setError("Select at least one active student first."); return; }
    if (!window.confirm(`Mark ${selectedStudentIds.length} selected students as graduated?`)) return;
    setSaving(true); setError(""); setNotice("");
    try {
      await studentApi.bulkGraduate(selectedStudentIds);
      setNotice(`${selectedStudentIds.length} students marked as graduated. Records preserved.`);
      setSelectedStudentIds([]);
      await loadStudents();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function graduateStudent(student) {
    if (!window.confirm(`Mark ${student.full_name || student.admission_number} as graduated?`)) return;
    setError(""); setNotice("");
    try {
      await studentApi.graduate(student.id);
      setNotice("Student marked as graduated. Historical record preserved.");
      await loadStudents();
    } catch (err) { setError(err.message); }
  }


async function graduateBatch(batchStudents) {
  const activeStudents = batchStudents.filter(
    (student) => student.status === "active"
  );

  if (activeStudents.length === 0) {
    setError("This batch has no active students to graduate.");
    return;
  }

  if (
    !window.confirm(
      `Graduate all ${activeStudents.length} active students in this batch?`
    )
  ) {
    return;
  }

  setSaving(true);
  setError("");
  setNotice("");

  try {
    const results = await Promise.allSettled(
      activeStudents.map((student) => studentApi.graduate(student.id))
    );
    const failed = results.filter((result) => result.status === "rejected");
    const succeeded = results.length - failed.length;
    if (failed.length) {
      throw new Error(`${succeeded} students graduated; ${failed.length} failed. First error: ${failed[0].reason?.message || "Unknown API error"}. Refresh and verify the remaining records.`);
    }
    setNotice(`${succeeded} students graduated successfully.`);
    await loadStudents();
  } catch (err) {
    setError(err.message || "Failed to graduate students.");
    await loadStudents();
  } finally {
    setSaving(false);
  }
}



  async function discontinueStudent(student) {
    const confirmed = window.confirm(
      `Discontinue ${student.full_name}? Their record will be preserved for history.`
    );
    if (!confirmed) return;

    setError("");
    setNotice("");

    try {
      await studentApi.discontinue(student.id);
      setNotice("Student discontinued. The historical record was preserved.");
      if (editingStudentId === student.id) resetStudentForm();
      await loadStudents();
    } catch (err) {
      setError(err.message);
    }
  }

const pageTitle = {
  departments: "Department management",
  students: "Student management",
  staff: "Staff management",
  "college-expenses": "College Expenses",
  finance: "Finance management",
}[activePage];

  if (!authReady) return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "system-ui" }}>Verifying secure session…</div>;

  if (!currentUser) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "minmax(0, 0.9fr) minmax(320px, 1.1fr)", background: "#f4f7f5", fontFamily: "Inter, system-ui, sans-serif", color: "#18382c" }}>
        <section style={{ padding: "clamp(28px, 5vw, 64px)", display: "flex", flexDirection: "column", color: "#f4fff8", background: "linear-gradient(145deg,#102d23,#176b4d)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 44, height: 44, borderRadius: 13, display: "grid", placeItems: "center", background: "#baf4d3", color: "#12442f", fontSize: 25, fontWeight: 800 }}>C</span>
            <div><strong style={{ fontSize: 25 }}>CampusLedger</strong><div style={{ fontSize: 10, letterSpacing: 1.5, color: "#b9d9c8" }}>COLLEGE FINANCIAL INTELLIGENCE</div></div>
          </div>
          <div style={{ margin: "auto 0", maxWidth: 460 }}>
            <p style={{ color: "#baf4d3", fontSize: 12, letterSpacing: 2 }}>PRIVATE COLLEGE FINANCE</p>
            <h1 style={{ fontSize: "clamp(36px,4vw,54px)", lineHeight: 1.1, letterSpacing: -2 }}>Financial clarity.<br />Institutional trust.</h1>
            <p style={{ color: "#c7dfd2", lineHeight: 1.8 }}>A shared workspace for authorized college finance and administration teams.</p>
          </div>
          <small style={{ color: "#bad7c6" }}>AUTHORIZED PERSONNEL ONLY · CAMPUS ACCESS</small>
        </section>
        <section style={{ display: "grid", placeItems: "center", padding: 28 }}>
          <form onSubmit={async (event) => {
            event.preventDefault();
            if (!loginEmail.trim() || !loginPassword) { setLoginError("Enter your email and password."); return; }
            setLoginError("");
            try {
              await signInWithEmailAndPassword(firebaseAuth, loginEmail.trim(), loginPassword);
              const user = firebaseAuth.currentUser;
              const tokenResult = await user.getIdTokenResult(true);
              const role = tokenResult.claims.role;
              if (role !== "owner" && role !== "staff") {
                await signOut(firebaseAuth);
                throw new Error("This account has no CampusLedger role. Contact the Owner.");
              }
              setCurrentUser({ uid: user.uid, email: user.email, role });
            } catch (err) {
              setLoginError(err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/user-not-found" ? "Incorrect login ID or password." : (err.message || "Sign in failed."));
            }
          }} style={{ width: "100%", maxWidth: 420, padding: 12 }}>
            <span style={{ color: "#237750", fontSize: 10, letterSpacing: 1.7, fontWeight: 800 }}>STAFF PORTAL</span>
            <h2 style={{ fontSize: 32, margin: "14px 0 8px" }}>Welcome back</h2>
            <p style={{ color: "#75877c", fontSize: 13, marginBottom: 24 }}>Sign in with the account provided by your college Owner.</p>
            <label style={{ display: "block", fontSize: 12, fontWeight: 650, margin: "14px 0 8px" }}>College email</label>
            <input type="email" autoComplete="username" required value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="name@college.edu" style={{ width: "100%", padding: 13, border: "1px solid #dce6df", borderRadius: 9, boxSizing: "border-box", background: "white" }} />
            <label style={{ display: "block", fontSize: 12, fontWeight: 650, margin: "17px 0 8px" }}>Password</label>
            <input type="password" autoComplete="current-password" required value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="Enter your password" style={{ width: "100%", padding: 13, border: "1px solid #dce6df", borderRadius: 9, boxSizing: "border-box", background: "white" }} />
            {loginError && <p role="alert" style={{ color: "#b42318", fontSize: 12 }}>{loginError}</p>}
            <button type="submit" style={{ width: "100%", marginTop: 22, padding: 14, border: 0, borderRadius: 9, background: "#176b4d", color: "white", fontWeight: 750 }}>Sign in securely →</button>
            <p style={{ textAlign: "center", marginTop: 22, color: "#72857a", fontSize: 11 }}>🔒 Authorized college personnel only</p>

          </form>
        </section>
        <style>{`@media(max-width:700px){div[style*="grid-template-columns: minmax(0, 0.9fr)"]{grid-template-columns:1fr!important}div[style*="grid-template-columns: minmax(0, 0.9fr)"]>section:first-child{min-height:260px}div[style*="grid-template-columns: minmax(0, 0.9fr)"]>section:first-child>div:nth-child(2){margin:28px 0!important}}`}</style>
      </div>
    );
  }

  return (
    <div className={`app-shell ${mobileMenuOpen ? "mobile-menu-open" : ""}`}>
      <button
        type="button"
        className="mobile-menu-toggle"
        aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={mobileMenuOpen}
        onClick={() => setMobileMenuOpen((open) => !open)}
      >
        {mobileMenuOpen ? <X size={23} /> : <Menu size={23} />}
      </button>
      {mobileMenuOpen && (
        <button
          type="button"
          className="mobile-menu-backdrop"
          aria-label="Close navigation menu"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <aside className={`sidebar ${mobileMenuOpen ? "mobile-open" : ""}`}>
        <a className="brand" href="#departments" onClick={() => setActivePage("departments")}>
          <span className="brand-mark"><GraduationCap size={23} /></span>
          <span>
            Campus<span className="brand-light">Ledger</span>
            <small>COLLEGE FINANCE</small>
          </span>
        </a>

        <div className="nav-label">WORKSPACE</div>

        <button
          className={`nav-item ${activePage === "departments" ? "selected" : ""}`}
          onClick={() => { setActivePage("departments"); setError(""); setMobileMenuOpen(false); }}
        >
          <Building2 size={18} /> Departments
          <span className="nav-count">{departments.length}</span>
        </button>

        <button
          className={`nav-item ${activePage === "students" ? "selected" : ""}`}
          onClick={() => { setActivePage("students"); setError(""); setMobileMenuOpen(false); }}
        >
          <Users size={18} /> Students
          <span className="nav-count">{students.length}</span>
        </button>

        <button className={`nav-item ${activePage === "staff" ? "selected" : ""}`} onClick={() => { setActivePage("staff"); setError(""); setMobileMenuOpen(false); }}>
          <Users size={18} /> Staff
          <span className="nav-count">{staffRecords.length}</span>
        </button>
          <button
            type="button"
            className={`nav-item ${
              activePage === "college-expenses" ? "selected" : ""
            }`}
            onClick={() => {
              setActivePage("college-expenses");
              setError("");
              setNotice("");
              setMobileMenuOpen(false);
            }}
          >
            <Receipt size={18} /> College Expenses
          </button>
        <button
          className={`nav-item ${activePage === "finance" ? "selected" : ""}`}
          onClick={() => { setActivePage("finance"); setError(""); setNotice(""); setMobileMenuOpen(false); }}
        >
          <IndianRupee size={18} /> Finance
        </button>


        <div className="sidebar-bottom">
          <div className="secure-dot" /> Local development workspace
          <small>CampusLedger · Firebase</small>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <span className="breadcrumb">Workspace / </span>
            <strong>{pageTitle}</strong>
          </div>
          <div className="topbar-right">
            <span className="live-dot" /> API connection
            <span className="environment">DEVELOPMENT</span>
            <span className="environment">{isOwner ? "OWNER" : "STAFF"}</span>
            <button type="button" className="secondary-button" onClick={() => { setCurrentUser(null); setLoginPassword(""); setLoginError(""); }}>Log out</button>
          </div>
        </header>

        <div className="page-content">
          <section className="welcome-row">
            <div>
              <p className="eyebrow">COLLEGE ADMINISTRATION</p>
              <h1>{pageTitle}</h1>
                <p className="subtitle">
                  {activePage === "students"
                    ? "Register students and manage their academic records."
                    : activePage === "departments"
                      ? "Set up and maintain academic departments."
                      : activePage === "staff"
                        ? "Manage staff records, departments and employment status."
                        : activePage === "college-expenses"
                          ? "Record, track and manage college expenses."
                          : activePage === "finance"
                            ? "Manage student fees, donations, salary payments and expenses."
                            : ""}
                </p>
            </div>

          </section>

          {error && (
            <div className="alert error">
              <CircleAlert size={18} /><span>{error}</span>
              <button onClick={() => setError("")} aria-label="Dismiss"><X size={16} /></button>
            </div>
          )}

          {notice && (
            <div className="alert success">
              <span>{notice}</span>
              <button onClick={() => setNotice("")} aria-label="Dismiss"><X size={16} /></button>
            </div>
          )}

          {activePage === "staff" && (
            <StaffFinance departments={departments} students={students} initialTab="staff" />
          )}

          {activePage === "finance" && <Finance />}
          {activePage === "college-expenses" && <CollegeExpenses />}

          {activePage === "students" && (
            <>
              <section className="content-grid student-registration-layout" style={{ width: "100%" }}>
                <details className="student-register-accordion" open={editingStudentId ? true : undefined}>
                  <summary className="student-register-summary">
                    <span className="student-register-summary-icon"><UserRoundPlus size={18} /></span>
                    <span><strong>{editingStudentId ? "Edit student" : "Register student"}</strong><small>{editingStudentId ? "Update academic details and financial records" : "Click to open the student registration form"}</small></span>
                    <span className="student-register-chevron">⌄</span>
                  </summary>
                <article className="panel form-panel" id="student-form" style={{ width: "100%", maxWidth: "none", boxSizing: "border-box", scrollMarginTop: 24 }}>
                  <div className="panel-heading">
                    <div>
                      <h2>{editingStudentId ? "Edit student" : "Register student"}</h2>
                      <p>{editingStudentId ? "Update the student's academic details." : "Add a student to the college records."}</p>
                    </div>
                    <span className="form-icon"><UserRoundPlus size={18} /></span>
                  </div>

                  {!editingStudentId && (
                    <div className="form-actions" style={{ marginBottom: "18px" }}>
                      <button
                        type="button"
                        className={studentMode === "single" ? "primary-button" : "secondary-button"}
                        onClick={() => { setStudentMode("single"); setError(""); }}
                      >
                        <UserRoundPlus size={16} /> Single Student
                      </button>
                      <button
                        type="button"
                        className={studentMode === "bulk" ? "primary-button" : "secondary-button"}
                        onClick={() => {
                          setStudentMode("bulk");
                          setBulkForm((current) => ({
                            ...current,
                            department_id: current.department_id || activeDepartments[0]?.id || "",
                          }));
                          setError("");
                        }}
                      >
                        <UsersRound size={16} /> Multiple Students
                      </button>
                    </div>
                  )}

                  {studentMode === "single" || editingStudentId ? (
                  <form
                    id="student-entry-form"
                    className="student-form-grid"
                    noValidate
                    onSubmit={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      if (!studentSaveAllowed.current || studentStep !== 1) return;
                      submitStudent(event);
                    }}
                  >
                    {studentStep === 0 && <>
                    <label>
                      Admission number <span>*</span>
                      <input
                        name="admission_number"
                        value={studentForm.admission_number}
                        onChange={changeStudentField}
                        placeholder="e.g. 26IT001"
                        minLength="2"
                        maxLength="30"
                        required
                      />
                    </label>

                    <label>
                      Full name <span>*</span>
                      <input
                        name="full_name"
                        value={studentForm.full_name}
                        onChange={changeStudentField}
                        placeholder="Enter student's full name"
                        minLength="2"
                        maxLength="150"
                        required
                      />
                    </label>

                    <label>
                      Email
                      <input
                        name="email"
                        type="email"
                        value={studentForm.email}
                        onChange={changeStudentField}
                        placeholder="student@example.com"
                        maxLength="254"
                      />
                    </label>

                    <label>
                      Phone
                      <input
                        name="phone"
                        type="tel"
                        value={studentForm.phone}
                        onChange={changeStudentField}
                        placeholder="Enter phone number"
                        maxLength="20"
                      />
                    </label>

                    <label>
                      Department <span>*</span>
                      <select
                        name="department_id"
                        value={studentForm.department_id}
                        onChange={changeStudentField}
                        required
                        style={{ width: "100%", minHeight: "48px", padding: "12px 14px", border: "1px solid #dce3ef", borderRadius: "12px", background: "#fff", color: "#243047", font: "inherit", boxSizing: "border-box" }}
                      >
                        <option value="">Select a department</option>
                        {activeDepartments.map((department) => (
                          <option key={department.id} value={department.id}>
                            {department.name} ({department.code})
                          </option>
                        ))}
                      </select>
                      {activeDepartments.length === 0 && (
                        <small>Add an active department before registering students.</small>
                      )}
                    </label>

                    <label>
                      Course <span>*</span>
                      <input
                        name="course"
                        value={studentForm.course}
                        onChange={changeStudentField}
                        placeholder="e.g. B.E, B.Tech, B.Sc"
                        minLength="2"
                        maxLength="30"
                        required
                      />
                    </label>

                    <label>
                      Batch start year <span>*</span>
                      <input
                        type="number"
                        min="2000"
                        max="2099"
                        value={splitBatch(studentForm.batch).start}
                        onChange={(event) => changeBatchYear("start", event.target.value)}
                        placeholder="e.g. 2027"
                        required
                      />
                    </label>
                    <label>
                      Batch end year <span>*</span>
                      <input
                        type="number"
                        min="2001"
                        max="2100"
                        value={splitBatch(studentForm.batch).end}
                        onChange={(event) => changeBatchYear("end", event.target.value)}
                        placeholder="e.g. 2031"
                        required
                      />
                      <small>Batch will be saved as {studentForm.batch || "Start year-End year"}.</small>
                    </label>

                    <label>
                      Admission date <span>*</span>
                      <input
                        name="admission_date"
                        type="date"
                        value={studentForm.admission_date}
                        onChange={changeStudentField}
                        required
                      />
                    </label>

                    </>}
                    {studentStep === 1 && <>
                      <div className="student-step-heading" style={{ gridColumn: "1 / -1" }}><span>STEP 2 OF 2</span><h3>Fee and payment details</h3><p>Enter fee details on this page. You can go back without losing the student information.</p></div>
                      {editingStudentId && savedStudentFinance.loading && <p style={{ gridColumn: "1 / -1", color: "#64748b" }}>Loading saved financial values…</p>}
                      {editingStudentId && savedStudentFinance.error && <p role="alert" style={{ gridColumn: "1 / -1", color: "#b91c1c" }}>Could not load saved financial values: {savedStudentFinance.error}</p>}
                      {editingStudentId && !savedStudentFinance.loading && !savedStudentFinance.error && <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}><button type="button" className="secondary-button" onClick={() => loadSavedStudentFinance(editingStudentId)}>Refresh saved values</button></div>}
                      <div className="tip-box" style={{ gridColumn: "1 / -1", marginTop: 12 }}>
                        <strong>{editingStudentId ? "Saved financial details" : "Fee details"}</strong>
                        <p>{editingStudentId ? "These amounts are loaded from Firebase and shown for reference. Editing the student's academic details will not create duplicate fees, payments, or donations." : "Enter only amounts that should be recorded as new financial entries. Leave amounts at 0 to skip them."}</p>
                      </div>
                      <label>Academic year *
                        <input name="academic_year" value={studentFinanceForm.academic_year} onChange={changeStudentFinanceField} placeholder="2026-2027" minLength={4} required={Number(studentFinanceForm.assigned_amount || 0) > 0} />
                      </label>
                      <label>Fee category *
                        <select name="fee_category" value={studentFinanceForm.fee_category} onChange={changeStudentFinanceField} required={Number(studentFinanceForm.assigned_amount || 0) > 0}>
                          <option>Tuition Fee</option><option>Hostel Fee</option><option>Transport Fee</option><option>Exam Fee</option><option>Laboratory Fee</option><option>Other Fee</option>
                        </select>
                      </label>
                      <label>Assigned amount (₹)
                        <input name="assigned_amount" type="number" min="0" step="0.01" value={studentFinanceForm.assigned_amount} onChange={changeStudentFinanceField} placeholder="0" />
                      </label>
                      <label>Concession (₹)
                        <input name="concession_amount" type="number" min="0" step="0.01" max={studentFinanceForm.assigned_amount || undefined} value={studentFinanceForm.concession_amount} onChange={changeStudentFinanceField} />
                      </label>
                      <label>Fee due date
                        <input name="due_date" type="date" value={studentFinanceForm.due_date} onChange={changeStudentFinanceField} required={Number(studentFinanceForm.assigned_amount || 0) > 0} />
                      </label>
                      <label>Installment
                        <select name="installment" value={studentFinanceForm.installment} onChange={changeStudentFinanceField}>
                          <option>Full payment</option><option>Semester 1</option><option>Semester 2</option><option>Quarterly</option><option>Monthly</option><option>Custom installment</option>
                        </select>
                      </label>

                      <div className="tip-box" style={{ gridColumn: "1 / -1", marginTop: 12 }}>
                        <strong>Initial payment</strong>
                        <p>Only enter an amount here if money has actually been received. A payment requires an assigned fee.</p>
                      </div>
                      <label>Amount received (₹)
                        <input name="payment_amount" type="number" min="0" step="0.01" value={studentFinanceForm.payment_amount} onChange={changeStudentFinanceField} placeholder="0" />
                      </label>
                      <label>Payment date
                        <input name="paid_date" type="date" value={studentFinanceForm.paid_date} onChange={changeStudentFinanceField} required={Number(studentFinanceForm.payment_amount || 0) > 0 || Number(studentFinanceForm.donation_amount || 0) > 0} />
                      </label>
                      <label>Payment method
                        <select name="payment_method" value={studentFinanceForm.payment_method} onChange={changeStudentFinanceField}>
                          <option value="upi">UPI</option><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="card">Card</option><option value="cheque">Cheque</option><option value="other">Other</option>
                        </select>
                      </label>
                      <label>Receipt number (optional; generated if blank)
                        <input name="receipt_number" value={studentFinanceForm.receipt_number} onChange={changeStudentFinanceField} maxLength={60} placeholder="e.g. RCPT-2026-001" />
                      </label>

                      <div className="tip-box" style={{ gridColumn: "1 / -1", marginTop: 12 }}>
                        <strong>Donation (optional)</strong>
                        <p>Donations are recorded separately and do not reduce outstanding fees.</p>
                      </div>
                      <label>Donation amount (₹)
                        <input name="donation_amount" type="number" min="0" step="0.01" value={studentFinanceForm.donation_amount} onChange={changeStudentFinanceField} placeholder="0" />
                      </label>
                      <div className="finance-summary" style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
                        <article className="finance-card"><p>Net fee</p><h2>{money(netStudentFee)}</h2></article>
                        <article className="finance-card"><p>Amount collected</p><h2>{money(initialStudentPayment)}</h2></article>
                        <article className="finance-card"><p>Outstanding balance</p><h2>{money(studentOutstanding)}</h2></article>
                      </div>
                    </>}

                    {studentStep === 1 && editingStudentId && <label>
                      Status
                      <select name="status" value={studentForm.status} onChange={changeStudentField}>
                        <option value="active">Active</option><option value="graduated">Graduated</option><option value="discontinued">Discontinued</option>
                      </select>
                    </label>}

                    <div className="form-actions student-step-actions" style={{ gridColumn: "1 / -1" }}>
                      {studentStep === 1 && <button className="secondary-button" type="button" onClick={() => { studentSaveAllowed.current = false; setStudentStep(0); }} disabled={saving}>← Previous page</button>}
                      {studentStep === 0 ? (
                        <button
                          className="primary-button"
                          type="button"
                          disabled={activeDepartments.length === 0}
                          onClick={goToStudentFeeStep}
                        >
                          Next page: Fee details →
                        </button>
                      ) : (
                        <button
                          className="primary-button"
                          type="submit"
                          disabled={saving || activeDepartments.length === 0}
                          onClick={() => { studentSaveAllowed.current = true; }}
                        >
                          <Plus size={17} />
                          {saving
                            ? "Saving..."
                            : editingStudentId
                              ? "Save changes"
                              : "Register student"}
                        </button>
                      )}
                      {editingStudentId && <button className="secondary-button" type="button" onClick={resetStudentForm}>Cancel</button>}
                    </div>
                  </form>
                  ) : (
                    <form className="student-form-grid bulk-student-form" onSubmit={submitBulkStudents}>
                      <label>
                        Admission number prefix <span>*</span>
                        <input name="admission_prefix" value={bulkForm.admission_prefix} onChange={changeBulkField} placeholder="e.g. 26IT" minLength="1" maxLength="20" required />
                        <small>Example: prefix 26IT with range 1–10 creates 26IT001 to 26IT010 when padding is 3.</small>
                      </label>

                      <div className="bulk-number-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "14px 20px", gridColumn: "1 / -1" }}>
                        <label>
                          Start number <span>*</span>
                          <input name="start_number" type="number" min="1" value={bulkForm.start_number} onChange={changeBulkField} required />
                        </label>
                        <label>
                          End number <span>*</span>
                          <input name="end_number" type="number" min={bulkForm.start_number || "1"} value={bulkForm.end_number} onChange={changeBulkField} required />
                        </label>
                      </div>

                      <label>
                        Number padding <span>*</span>
                        <select name="number_padding" value={bulkForm.number_padding} onChange={changeBulkField} style={{ width: "100%", minHeight: "48px", padding: "12px 14px", border: "1px solid #dce3ef", borderRadius: "12px", background: "#fff", color: "#243047", font: "inherit", boxSizing: "border-box" }}>
                          <option value="2">2 digits (01)</option>
                          <option value="3">3 digits (001)</option>
                        </select>
                      </label>

                      <label>
                        Department <span>*</span>
                        <select name="department_id" value={bulkForm.department_id} onChange={changeBulkField} required style={{ width: "100%", minHeight: "48px", padding: "12px 14px", border: "1px solid #dce3ef", borderRadius: "12px", background: "#fff", color: "#243047", font: "inherit", boxSizing: "border-box" }}>
                          <option value="">Select a department</option>
                          {activeDepartments.map((department) => (
                            <option key={department.id} value={department.id}>{department.name} ({department.code})</option>
                          ))}
                        </select>
                      </label>

                      <label>
                        Course <span>*</span>
                        <input name="course" value={bulkForm.course} onChange={changeBulkField} placeholder="e.g. B.E, B.Tech, B.Sc" minLength="2" maxLength="30" required />
                      </label>

                      <div className="form-row" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                        <label>
                          Batch start year <span>*</span>
                          <input name="from_year" type="number" min="2000" max="2099" value={bulkForm.from_year} onChange={changeBulkField} placeholder="2027" required />
                        </label>
                        <label>
                          Batch end year <span>*</span>
                          <input name="to_year" type="number" min="2001" max="2100" value={bulkForm.to_year} onChange={changeBulkField} placeholder="2031" required />
                        </label>
                      </div>
                      <div className="tip-box" style={{ gridColumn: "1 / -1" }}><strong>Generated batch</strong><p>{generatedBatch}</p><p>Admission prefix: {generatedPrefix || "Choose department and start year"}</p></div>

                      <label>
                        Admission date <span>*</span>
                        <input name="admission_date" type="date" value={bulkForm.admission_date} onChange={changeBulkField} required />
                      </label>

                      <div className="form-actions" style={{ gridColumn: "1 / -1" }}>
                        <button className="primary-button" type="submit" disabled={saving || activeDepartments.length === 0}>
                          <UsersRound size={17} /> {saving ? "Creating records..." : "Generate student records"}
                        </button>
                      </div>
                      <div className="tip-box" style={{ gridColumn: "1 / -1" }}>
                        <strong>Bulk registration</strong>
                        <p>Creates up to 500 placeholder records. Names and contact details can be completed later. Batch start/end years are saved for every generated student.</p>
                      </div>
                    </form>
                  )}

                  <div className="tip-box">
                    <strong>Student records</strong>
                    <p>Admission numbers must be unique. Discontinuing a student preserves their historical record.</p>
                  </div>
                </article>
                </details>
              </section>

              <section className="panel departments-panel" id="students">
                <div className="panel-heading">
                  <div>
                    <h2>Students</h2>
                    <p>Search and manage registered students.</p>
                  </div>
                  <span className="record-count">{filteredStudents.length} records</span>
                </div>

                <div className="table-toolbar">
                  <div className="search-box">
                    <Search size={17} />
                    <input
                      value={studentSearch}
                      onChange={(event) => setStudentSearch(event.target.value)}
                      placeholder="Search name, admission number, course or batch..."
                    />
                  </div>
                  <details className="student-download-menu">
                    <summary className="primary-button student-download-trigger"><Download size={16} /> Download student lists <span aria-hidden="true">▾</span></summary>
                    <div className="student-download-options">
                      <div className="download-report-group">
                        <strong>1. Student list — name, roll number and batch</strong>
                        <button type="button" onClick={(event) => { downloadStudentReport("roster", "all"); event.currentTarget.closest("details")?.removeAttribute("open"); }}>Download all departments</button>
                        <details className="download-department-picker">
                          <summary>Choose a specific department ▸</summary>
                          <div className="download-department-options">
                            {departments.map((department) => <button key={department.id} type="button" onClick={(event) => { downloadStudentReport("roster", department.id); event.currentTarget.closest("details.student-download-menu")?.removeAttribute("open"); }}>{department.name} ({department.code})</button>)}
                          </div>
                        </details>
                      </div>
                      <div className="download-report-group">
                        <strong>2. Fees not fully paid / pending</strong>
                        <button type="button" onClick={(event) => { downloadStudentReport("unpaid", "all"); event.currentTarget.closest("details.student-download-menu")?.removeAttribute("open"); }}>Download all departments</button>
                        <details className="download-department-picker">
                          <summary>Choose a specific department ▸</summary>
                          <div className="download-department-options">
                            {departments.map((department) => <button key={department.id} type="button" onClick={(event) => { downloadStudentReport("unpaid", department.id); event.currentTarget.closest("details.student-download-menu")?.removeAttribute("open"); }}>{department.name} ({department.code})</button>)}
                          </div>
                        </details>
                      </div>
                    </div>
                  </details>
                  <button className="secondary-button" type="button" disabled={saving || selectedStudentIds.length === 0} onClick={() => openBulkEdit()}>Edit selected ({selectedStudentIds.length})</button>
                  {isOwner && <button className="secondary-button" type="button" disabled={saving || selectedStudentIds.length === 0} onClick={() => deleteStudents(selectedStudentIds)}>Delete selected ({selectedStudentIds.length})</button>}
                  <button className="secondary-button" type="button" disabled={saving || selectedStudentIds.length === 0} onClick={bulkGraduateStudents}>Graduate selected ({selectedStudentIds.length})</button>
                </div>

                {showBulkEdit && (
                  <section id="bulk-student-edit-form" className="panel form-panel" style={{ margin: "16px 0", width: "100%", maxWidth: "none", scrollMarginTop: 24 }}>
                    <div className="panel-heading"><div><h2>Edit {selectedStudentIds.length} selected students</h2><p>Changes apply to every selected student. Existing finance records are not changed.</p></div></div>
                    <form onSubmit={saveBulkEdit} className="form-grid">
                      <label>Batch start year *<input type="number" min="2000" max="2099" value={bulkEditForm.from_year} onChange={(e) => setBulkEditForm((v) => ({ ...v, from_year: e.target.value }))} required /></label>
                      <label>Batch end year *<input type="number" min="2001" max="2100" value={bulkEditForm.to_year} onChange={(e) => setBulkEditForm((v) => ({ ...v, to_year: e.target.value }))} required /></label>
                      <label>Department<select value={bulkEditForm.department_id} onChange={(e) => setBulkEditForm((v) => ({ ...v, department_id: e.target.value }))}><option value="">Keep each student's department</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}</select></label>
                      <label>Course<input value={bulkEditForm.course} onChange={(e) => setBulkEditForm((v) => ({ ...v, course: e.target.value }))} placeholder="Leave blank to keep each student's course" /></label>
                      <div className="form-actions"><button className="primary-button" type="submit" disabled={saving}>{saving ? "Saving..." : "Save selected changes"}</button><button className="secondary-button" type="button" disabled={saving} onClick={() => setShowBulkEdit(false)}>Cancel</button></div>
                    </form>
                  </section>
                )}

                {loadingStudents ? (
                  <div className="empty-state">Loading students...</div>
                ) : filteredStudents.length === 0 ? (
                  <div className="empty-state">
                    {studentSearch
                      ? "No matching students found."
                      : "No students registered yet. Use the form above to register the first student."}
                  </div>
                ) : (
                  <div className="department-student-groups">
                    {departments
                      .filter((department) =>
                        filteredStudents.some((student) => student.department_id === department.id)
                      )
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((department) => {
                        const departmentStudents = filteredStudents.filter(
                          (student) => student.department_id === department.id
                        );
                        const yearGroups = new Map();
                        const unclassified = [];
                        // Use one shared reference year across all departments so
                        // the same cohort year is classified consistently everywhere.
                        const batchStartYears = filteredStudents
                          .map((student) => {
                            const match = String(student.batch || "").trim().match(/^(20\d{2})\s*[-–—/]\s*(20\d{2})$/);
                            return match ? Number(match[1]) : null;
                          })
                          .filter((year) => year !== null);
                        const latestBatchStartYear = batchStartYears.length ? Math.max(...batchStartYears) : null;
                        departmentStudents.forEach((student) => {
                          const year = getYearOfStudy(student.batch, latestBatchStartYear);
                          if (year === null) {
                            unclassified.push(student);
                            return;
                          }
                          if (!yearGroups.has(year)) yearGroups.set(year, new Map());
                          const batches = yearGroups.get(year);
                          const rawBatch = String(student.batch || "").trim();
                          const match = rawBatch.match(/^(20\d{2})\s*[-–—/]\s*(20\d{2})$/);
                          const batchName = match
                            ? `${match[1]}-${match[2]}`
                            : (rawBatch || "Batch not specified");
                          if (!batches.has(batchName)) batches.set(batchName, []);
                          batches.get(batchName).push(student);
                        });
                        const sortedYears = [...yearGroups.keys()].sort((a, b) => {
                          if (a === "graduated") return 1;
                          if (b === "graduated") return -1;
                          return Number(a) - Number(b);
                        });
                        const sortStudents = (items) => [...items].sort((a, b) =>
                          (a.full_name || a.admission_number || "").localeCompare(
                            b.full_name || b.admission_number || "",
                            undefined,
                            { numeric: true, sensitivity: "base" }
                          )
                        );

                        return (
                          <details className="panel year-group-panel department-accordion" key={department.id}>
                            <summary className="panel-heading accordion-summary">
                              <div>
                                <h2>{department.name}</h2>
                                <p>{department.code} · {departmentStudents.length} student records</p>
                              </div>
                              <span className="record-count">View batches ▾</span>
                            </summary>

                            <div className="department-accordion-content">
                              {sortedYears.map((year) => (
                                <section className="year-student-group" key={year}>
                                  <div className="year-group-heading">
                                    <GraduationCap size={18} />
                                    <strong>{yearLabel(year)}</strong>
                                    <span className="record-count">
                                      {[...yearGroups.get(year).values()].reduce((total, list) => total + list.length, 0)} students
                                    </span>
                                  </div>

                                    <div className="year-group-heading">
                                      <strong>{year}</strong>

                                      <span className="record-count">
                                        {yearGroups.get(year).size} students
                                      </span>

                                      {Array.from(yearGroups.get(year).values()).every(
                                        (batchStudents) =>
                                          batchStudents.length > 0 &&
                                          batchStudents.every(
                                            (student) => student.status === "graduated"
                                          )
                                      ) && (
                                        <span className="status-badge graduated">
                                          Graduated
                                        </span>
                                      )}
                                    </div>


                                  {[...yearGroups.get(year).entries()]
                                    .sort(([batchA], [batchB]) => batchA.localeCompare(batchB, undefined, { numeric: true }))
                                    .map(([batchName, batchStudents]) => (
                                      <div className="batch-group" key={batchName}>
                                      <details
                                        className="batch-accordion"
                                        key={batchName}
                                      >
                                        <summary className="batch-accordion-summary">
                                          <span className="batch-title">
                                            <CalendarDays size={16} />
                                            <strong>{batchName}</strong>
                                          </span>

                                          <div className="batch-actions">
                                            <button
                                              type="button"
                                              className="secondary-button"
                                              disabled={saving}
                                              onClick={(event) => {
                                                event.preventDefault();
                                                event.stopPropagation();
                                                graduateBatch(batchStudents);
                                              }}
                                            >
                                              {saving ? "Processing..." : "Graduate batch"}
                                            </button>

                                            <button type="button" className="secondary-button" disabled={saving} onClick={(event) => { event.preventDefault(); event.stopPropagation(); openBulkEdit(batchStudents.map((student) => student.id)); }}>Edit batch</button>
                                            {isOwner && <button type="button" className="secondary-button" disabled={saving} onClick={(event) => { event.preventDefault(); event.stopPropagation(); deleteStudents(batchStudents.map((student) => student.id), `students in batch ${batchName}`); }}>Delete batch</button>}
                                            <span>{batchStudents.length} students · View details ▾</span>
                                          </div>
                                        </summary>
                                        <div className="table-wrap">
                                          <table>
                                            <thead><tr>
                                              <th>SELECT</th><th>STUDENT</th><th>COURSE</th><th>BATCH</th><th>STATUS</th><th>ACTIONS</th>
                                            </tr></thead>
                                            <tbody>
                                              {sortStudents(batchStudents).map((student) => (
                                                <StudentRow key={student.id} student={student} departments={departments} onEdit={editStudent} onDiscontinue={discontinueStudent} onGraduate={graduateStudent} onDelete={(item) => deleteStudents([item.id], item.full_name || item.admission_number)} isOwner={isOwner} selected={selectedStudentIds.includes(student.id)} onToggle={toggleStudentSelection} />
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </details>
                                      </div>
                                    ))}
                                </section>
                              ))}

                              {unclassified.length > 0 && (
                                <section className="year-student-group">
                                  <div className="year-group-heading">
                                    <CalendarDays size={18} />
                                    <strong>Year not determined</strong>
                                    <span className="record-count">{unclassified.length} students</span>
                                  </div>
                                  <details className="batch-accordion">
                                    <summary className="batch-accordion-summary">
                                      <span><CalendarDays size={16} /> <strong>Batch details unavailable</strong></span>
                                      <div className="batch-actions">
                                        <button
                                          type="button"
                                          className="secondary-button"
                                          disabled={saving}
                                          onClick={(event) => {
                                            event.preventDefault();
                                            event.stopPropagation();
                                            graduateBatch(unclassified);
                                          }}
                                        >
                                          {saving ? "Processing..." : "Graduate batch"}
                                        </button>
                                        <button type="button" className="secondary-button" disabled={saving} onClick={(event) => { event.preventDefault(); event.stopPropagation(); openBulkEdit(unclassified.map((student) => student.id)); }}>Edit group</button>
                                        {isOwner && <button type="button" className="secondary-button" disabled={saving} onClick={(event) => { event.preventDefault(); event.stopPropagation(); deleteStudents(unclassified.map((student) => student.id), "students with undetermined batches"); }}>Delete group</button>}
                                        <span>{unclassified.length} students · View details ▾</span>
                                      </div>
                                    </summary>
                                    <div className="table-wrap">
                                      <table><thead><tr>
                                        <th>SELECT</th><th>STUDENT</th><th>COURSE</th><th>BATCH</th><th>STATUS</th><th>ACTIONS</th>
                                      </tr></thead><tbody>
                                        {sortStudents(unclassified).map((student) => (
                                          <StudentRow key={student.id} student={student} departments={departments} onEdit={editStudent} onDiscontinue={discontinueStudent} onGraduate={graduateStudent} selected={selectedStudentIds.includes(student.id)} onToggle={toggleStudentSelection} />
                                        ))}
                                      </tbody></table>
                                    </div>
                                  </details>
                                </section>
                              )}
                            </div>
                          </details>
                        );
                      })}
                  </div>
                )}



                <style>{`
                  .student-registration-layout { display: block; width: 100%; }
                  .student-register-accordion { width: 100%; margin-bottom: 18px; }
                  .student-register-summary { display: flex; align-items: center; gap: 14px; padding: 18px 22px; background: #fff; border: 1px solid #e1e7f2; border-radius: 16px; cursor: pointer; list-style: none; box-shadow: 0 5px 20px rgba(25, 43, 80, .04); }
                  .student-register-summary::-webkit-details-marker { display: none; }
                  .student-register-summary-icon { width: 42px; height: 42px; border-radius: 12px; background: #eef2ff; color: #5365e8; display: grid; place-items: center; }
                  .student-register-summary strong, .student-register-summary small { display: block; }
                  .student-register-summary strong { color: #1d2939; font-size: 16px; }
                  .student-register-summary small { color: #8491a7; margin-top: 4px; }
                  .student-register-chevron { margin-left: auto; font-size: 24px; transition: transform .2s ease; }
                  .student-register-accordion[open] .student-register-chevron { transform: rotate(180deg); }
                  .student-register-accordion .form-panel { margin-top: 12px; width: 100%; max-width: none; }
                  .student-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 20px; align-items: start; }
                  .student-form-grid > label { min-width: 0; }
                  .bulk-student-form > label { min-width: 0; }
                  .bulk-student-form input, .bulk-student-form select { width: 100%; box-sizing: border-box; }
                  .bulk-student-form > label:first-child { grid-column: span 1; }
                  .student-step-heading h3 { margin: 5px 0; color: #1d2939; }
                  .student-step-heading p { margin: 0; color: #8491a7; }
                  .student-step-heading > span { color: #5365e8; font-size: 11px; font-weight: 800; letter-spacing: .08em; }
                  .student-step-actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 10px; }
                  @media (max-width: 850px) { .student-form-grid { grid-template-columns: minmax(0, 1fr); } .bulk-number-grid { grid-template-columns: minmax(0, 1fr) !important; } }
                  .student-registration-layout .form-panel { width: 100%; max-width: none; }
                  .overview-section { margin-bottom: 24px; }
                  .overview-section .panel-heading { margin-bottom: 14px; }
                  .overview-section .stats-grid { margin-top: 0; }
                  .department-accordion { margin-bottom: 12px; overflow: hidden; }
                  .accordion-summary, .batch-accordion-summary { cursor: pointer; list-style: none; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
                  .accordion-summary::-webkit-details-marker, .batch-accordion-summary::-webkit-details-marker { display: none; }
                  .department-accordion > .accordion-summary { padding: 18px 20px; margin: 0; }
                  .department-accordion-content { padding: 0 18px 18px; }
                  .batch-accordion { border: 1px solid #e6eaf2; border-radius: 10px; margin: 10px 0; overflow: hidden; background: #fff; }
                  .batch-accordion-summary { padding: 13px 15px; color: #344054; background: #f8faff; }
                  .batch-actions { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 8px; }
                  .batch-actions .secondary-button { white-space: nowrap; }
                  .batch-accordion-summary > span:first-child { display: inline-flex; align-items: center; gap: 8px; }
                  .batch-accordion[open] > .batch-accordion-summary { border-bottom: 1px solid #e6eaf2; }
                  .batch-accordion .table-wrap { padding: 0 12px; }
                  .year-student-group { margin-top: 12px; }
                  .departments-panel, .departments-panel .table-toolbar { overflow: visible !important; }
                  .student-download-menu { position: relative; display: inline-block; z-index: 1000; flex: 0 0 auto; }
                  .student-download-trigger { display: inline-flex; align-items: center; gap: 8px; list-style: none; border: 0; cursor: pointer; background: linear-gradient(135deg, #5968f2, #7656dc); color: #fff; box-shadow: 0 6px 16px rgba(83,101,232,.22); white-space: nowrap; }
                  .student-download-trigger::-webkit-details-marker { display: none; }
                  .student-download-trigger:hover { background: linear-gradient(135deg, #4656df, #6343c7); transform: translateY(-1px); }
                  .student-download-options { position: absolute; top: calc(100% + 8px); left: 0; right: auto; z-index: 10000; width: min(360px, calc(100vw - 40px)); box-sizing: border-box; background: #fff; border: 1px solid #dce4f3; border-radius: 14px; padding: 8px; box-shadow: 0 18px 45px rgba(30,50,90,.22); display: none; }
                  .student-download-menu[open] .student-download-options { display: grid; gap: 6px; }
                  .student-download-options button { text-align: left; white-space: normal; line-height: 1.4; border: 1px solid #e7eaff; border-radius: 9px; background: linear-gradient(110deg, #f4f6ff, #f8f5ff); color: #334155; padding: 10px 12px; font: inherit; font-size: 12px; font-weight: 650; cursor: pointer; transition: background .18s, border-color .18s, transform .18s; }
                  .student-download-options button:hover { background: #e8edff; border-color: #c5ceff; color: #3448c5; transform: translateX(2px); }
                  .download-report-group { display: grid; gap: 7px; padding: 10px; border: 1px solid #e3e9ff; border-radius: 12px; background: #fbfcff; }
                  .download-report-group > strong { color: #34415b; font-size: 12px; line-height: 1.45; padding: 2px 2px 4px; }
                  .download-department-picker { position: relative; }
                  .download-department-picker > summary { list-style: none; cursor: pointer; padding: 10px 12px; border: 1px solid #dfe5f4; border-radius: 9px; background: #fff; color: #475569; font-size: 12px; font-weight: 650; }
                  .download-department-picker > summary::-webkit-details-marker { display: none; }
                  .download-department-options { display: grid; gap: 5px; padding: 7px 0 0 10px; max-height: 220px; overflow-y: auto; }
                  .download-department-options button { background: #fff; }
                  .student-download-menu[open] .student-download-options button:focus-visible { outline: 2px solid #5365e8; outline-offset: 2px; }
                  @media (max-width: 850px) { .student-download-options { left: 0; right: auto; } .table-toolbar { flex-wrap: wrap; } }
                `}</style>

                <div className="panel-footer">
                  Student records are stored in Firebase Firestore through FastAPI.
                </div>
              </section>
            </>
          )}

          {activePage === "departments" && (
            <section className="content-grid">
              <article className="panel departments-panel" id="departments">
                <div className="panel-heading">
                  <div>
                    <h2>Departments</h2>
                    <p>Set up the college's academic departments.</p>
                  </div>
                  <span className="record-count">{departments.length} records</span>
                </div>

                <div className="table-toolbar">
                  <div className="search-box">
                    <Search size={17} />
                    <input
                      value={departmentSearch}
                      onChange={(event) => setDepartmentSearch(event.target.value)}
                      placeholder="Search name or code..."
                    />
                  </div>
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>DEPARTMENT</th>
                        <th>CODE</th>
                        <th>STATUS</th>
                        <th>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingDepartments ? (
                        <tr><td colSpan="4" className="empty-state">Loading departments...</td></tr>
                      ) : filteredDepartments.length === 0 ? (
                        <tr><td colSpan="4" className="empty-state">No matching departments.</td></tr>
                      ) : (
                        filteredDepartments.map((department) => (
                          <DepartmentRow
                            key={department.id}
                            department={department}
                            onEdit={editDepartment}
                            onDelete={deleteDepartment}
                            isOwner={isOwner}
                          />
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="panel-footer">
                  Department data is stored in Firebase Firestore through FastAPI.
                </div>
              </article>

              <article className="panel form-panel" id="department-form">
                <div className="panel-heading">
                  <div>
                    <h2>{editingDepartmentId ? "Edit department" : "Add department"}</h2>
                    <p>{editingDepartmentId ? "Update department details." : "Create a new department record."}</p>
                  </div>
                  <span className="form-icon"><Plus size={18} /></span>
                </div>

                <form onSubmit={submitDepartment}>
                  <label>
                    Department name <span>*</span>
                    <input
                      name="name"
                      value={departmentForm.name}
                      onChange={changeDepartmentField}
                      placeholder="e.g. Information Technology"
                      minLength="2"
                      maxLength="120"
                      required
                    />
                  </label>

                  <label>
                    Department code <span>*</span>
                    <input
                      name="code"
                      value={departmentForm.code}
                      onChange={changeDepartmentField}
                      placeholder="e.g. IT"
                      minLength="2"
                      maxLength="20"
                      pattern="[A-Za-z0-9_-]+"
                      required
                    />
                    <small>Must be unique. Letters, numbers, hyphens and underscores are allowed.</small>
                  </label>

                  <label>
                    Description
                    <textarea
                      name="description"
                      value={departmentForm.description}
                      onChange={changeDepartmentField}
                      placeholder="Short description (optional)"
                      maxLength="500"
                      rows="3"
                    />
                  </label>



                  <div className="form-actions">
                    <button className="primary-button" type="submit" disabled={saving}>
                      <Plus size={17} />
                      {saving ? "Saving..." : editingDepartmentId ? "Save changes" : "Add department"}
                    </button>
                    {editingDepartmentId && (
                      <button className="secondary-button" type="button" onClick={resetDepartmentForm}>
                        Cancel
                      </button>
                    )}
                  </div>
                </form>

                <div className="tip-box">
                  <strong>Good to know</strong>
                  <h5><p>Add active departments before registering students. Use a short unique code such as IT, CSE or MECH.</p></h5>
                </div>
              </article>
            </section>
          )}

          <footer className="footer">
            CampusLedger <span>•</span> College Financial Intelligence System
          </footer>
        </div>
      </main>
    </div>
  );
}
