
import { useCallback, useEffect, useMemo, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { financeApi, staffApi } from "./api";

const today = () => new Date().toISOString().slice(0, 10);

const money = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const num = (value) => Math.max(0, Number(value || 0));

const expenseCategories = [
  "Painting and renovation",
  "College appliances",
  "Bus service",
  "Fuel cost",
  "College maintenance",
  "Electricity",
  "Water supply",
  "Internet and telephone",
  "Furniture",
  "Laboratory equipment",
  "Computer and IT equipment",
  "Library expenses",
  "Cleaning and sanitation",
  "Security",
  "Events and functions",
  "Sports equipment",
  "Stationery and printing",
  "Repairs",
  "Insurance",
  "Other expenses",
];

const styles = {
  page: {
    padding: 24,
    background: "#f3f6fb",
    minHeight: "100vh",
    color: "#182338",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 24,
  },
  subtitle: { color: "#8090a9", marginTop: 8 },
  section: {
    background: "#fff",
    border: "1px solid #e0e7f1",
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: 16,
  },
  card: {
    background: "#fff",
    border: "1px solid #dfe7f2",
    borderRadius: 16,
    padding: 22,
    minWidth: 0,
  },
  label: { color: "#8291aa", margin: "0 0 14px" },
  value: { fontSize: 27, margin: 0, overflowWrap: "anywhere" },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
    gap: 18,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    color: "#526079",
    fontSize: 14,
    fontWeight: 600,
  },
  input: {
    width: "100%",
    minHeight: 44,
    padding: "10px 12px",
    border: "1px solid #dce3ef",
    borderRadius: 10,
    boxSizing: "border-box",
    font: "inherit",
    background: "#fff",
    color: "#182338",
  },
  primary: {
    border: 0,
    borderRadius: 10,
    background: "#5365e8",
    color: "#fff",
    padding: "12px 20px",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondary: {
    border: "1px solid #dce3ef",
    borderRadius: 10,
    background: "#fff",
    color: "#526079",
    padding: "10px 16px",
    fontWeight: 600,
    cursor: "pointer",
  },
  tableWrap: { width: "100%", overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: 750 },
  th: {
    textAlign: "left",
    background: "#f6f8fc",
    color: "#7c8ba3",
    padding: 14,
    fontSize: 12,
    whiteSpace: "nowrap",
  },
  td: {
    padding: 14,
    borderBottom: "1px solid #edf0f6",
    fontSize: 14,
  },
};


function MetricCard({ label, value }) {
  const palettes = {
    "Total fees assigned": {
      background: "linear-gradient(135deg, #eef2ff, #c7d2fe)",
      border: "#818cf8",
      accent: "#4338ca",
    },
    "Total concessions": {
      background: "linear-gradient(135deg, #fff7ed, #fed7aa)",
      border: "#fb923c",
      accent: "#c2410c",
    },
    "Net fees after concessions": {
      background: "linear-gradient(135deg, #eff6ff, #bfdbfe)",
      border: "#60a5fa",
      accent: "#1d4ed8",
    },
    "Fees received": {
      background: "linear-gradient(135deg, #ecfdf5, #a7f3d0)",
      border: "#34d399",
      accent: "#047857",
    },
    "Donations received": {
      background: "linear-gradient(135deg, #faf5ff, #e9d5ff)",
      border: "#c084fc",
      accent: "#7e22ce",
    },
    "Pending fees": {
      background: "linear-gradient(135deg, #fff1f2, #fecdd3)",
      border: "#fb7185",
      accent: "#be123c",
    },
    "Total staff salary": {
      background: "linear-gradient(135deg, #ecfeff, #a5f3fc)",
      border: "#22d3ee",
      accent: "#0e7490",
    },
    "Teaching staff salary": {
      background: "linear-gradient(135deg, #eff6ff, #bfdbfe)",
      border: "#60a5fa",
      accent: "#1d4ed8",
    },
    "Non-teaching staff salary": {
      background: "linear-gradient(135deg, #f5f3ff, #ddd6fe)",
      border: "#a78bfa",
      accent: "#6d28d9",
    },
    "Fees and donations received": {
      background: "linear-gradient(135deg, #ecfdf5, #99f6e4)",
      border: "#2dd4bf",
      accent: "#0f766e",
    },
    "Salary paid and other expenses": {
      background: "linear-gradient(135deg, #fff7ed, #fed7aa)",
      border: "#fb923c",
      accent: "#c2410c",
    },
  };

  const colors = palettes[label] || {
    background: "linear-gradient(135deg, #f5f3ff, #e0e7ff)",
    border: "#a5b4fc",
    accent: "#4338ca",
  };

  return (
    <article
      style={{
        ...styles.card,
        background: colors.background,
        border: `1px solid ${colors.border}`,
        borderTop: `4px solid ${colors.accent}`,
        boxShadow: "0 8px 20px rgba(31, 41, 55, 0.06)",
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
      }}
    >
      <p
        style={{
          ...styles.label,
          color: colors.accent,
          fontWeight: 700,
        }}
      >
        {label}
      </p>
      <h2
        style={{
          ...styles.value,
          color: "#172033",
          fontWeight: 800,
        }}
      >
        {money(value)}
      </h2>
    </article>
  );
}


function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  required = true,
  children,
  ...extra
}) {
  return (
    <label style={styles.field}>
      {label}
      {children || (
        <input
          style={styles.input}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          required={required}
          {...extra}
        />
      )}
    </label>
  );
}

export default function Finance({ staff = [] }) {
  const [fees, setFees] = useState([]);
  const [payments, setPayments] = useState([]);
  const [donations, setDonations] = useState([]);
  const [payroll, setPayroll] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [fetchedStaff, setFetchedStaff] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [expenseForm, setExpenseForm] = useState({
    category: "College maintenance",
    description: "",
    amount: "",
    spent_date: today(),
    payment_method: "upi",
    vendor: "",
    receipt_number: "",
  });

  const loadFinance = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [
        feeData,
        paymentData,
        donationData,
        payrollData,
        expenseData,
        staffData,
      ] = await Promise.all([
        financeApi.fees(),
        financeApi.payments(),
        financeApi.donations(),
        financeApi.payroll(),
        financeApi.expenses(),
        staffApi.list(),
      ]);

      setFees(Array.isArray(feeData) ? feeData : []);
      setPayments(Array.isArray(paymentData) ? paymentData : []);
      setDonations(Array.isArray(donationData) ? donationData : []);
      setPayroll(Array.isArray(payrollData) ? payrollData : []);
      setExpenses(Array.isArray(expenseData) ? expenseData : []);
      setFetchedStaff(Array.isArray(staffData) ? staffData : []);
    } catch (err) {
      setError(err.message || "Unable to load financial records.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFinance();
  }, [loadFinance]);

  // Student financial totals.
  const studentTotals = useMemo(() => {
    const grossFees = fees.reduce(
      (sum, fee) => sum + num(fee.assigned_amount),
      0
    );

    const concessions = fees.reduce(
      (sum, fee) => sum + num(fee.concession_amount),
      0
    );

    const netFees = Math.max(0, grossFees - concessions);

    const received = payments.reduce(
      (sum, payment) => sum + num(payment.amount),
      0
    );

    const donationReceived = donations.reduce(
      (sum, donation) => sum + num(donation.amount),
      0
    );

    return {
      grossFees,
      concessions,
      netFees,
      received,
      donationReceived,
      pending: Math.max(0, netFees - received),
    };
  }, [fees, payments, donations]);

  // Staff salary cards are based on the monthly salary saved on each staff profile.
  // This does not treat salary as paid; it only shows the monthly salary structure.
  const staffTotals = useMemo(() => {
    const staffRecords = Array.isArray(staff) && staff.length > 0
      ? staff
      : fetchedStaff;

    return staffRecords.reduce(
      (totals, person) => {
        const salary = num(person.monthly_salary);
        totals.total += salary;

        const category = String(
          person.staff_type || person.category || "teaching"
        )
          .toLowerCase()
          .replace(/[\\s_-]/g, "");

        if (category === "teaching" || category === "teachingstaff") {
          totals.teaching += salary;
        } else if (
          category === "nonteaching" ||
          category === "nonteachingstaff"
        ) {
          totals.nonTeaching += salary;
        }

        return totals;
      },
      { total: 0, teaching: 0, nonTeaching: 0 }
    );
  }, [staff, fetchedStaff]);

  const expenseTotal = useMemo(
    () => expenses.reduce((sum, expense) => sum + num(expense.amount), 0),
    [expenses]
  );

  // Management cash-flow estimate:
  // money received - salary paid - other recorded college expenses.
  // Donations are displayed separately but included as received funds.
  const management = useMemo(() => {
    const income = studentTotals.received + studentTotals.donationReceived;
    const salaryPaid = payroll.reduce((sum, record) => sum + num(record.paid_amount), 0);
    const expenditure = salaryPaid + expenseTotal;

    return {
      income,
      expenditure,
      result: income - expenditure,
    };
  }, [studentTotals, payroll, expenseTotal]);

  function changeExpense(event) {
    const { name, value } = event.target;

    setExpenseForm((old) => ({
      ...old,
      [name]: value,
    }));
  }

  async function saveExpense(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    const amount = Number(expenseForm.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter an expense amount greater than zero.");
      return;
    }

    if (!expenseForm.description.trim()) {
      setError("Enter what the money was spent on.");
      return;
    }

    setSaving(true);

    try {
      await financeApi.recordExpense({
        category: expenseForm.category,
        description: expenseForm.description.trim(),
        amount,
        spent_date: expenseForm.spent_date,
        payment_method: expenseForm.payment_method,
        vendor: expenseForm.vendor.trim(),
        receipt_number: expenseForm.receipt_number.trim(),
      });

      setExpenseForm({
        category: "College maintenance",
        description: "",
        amount: "",
        spent_date: today(),
        payment_method: "upi",
        vendor: "",
        receipt_number: "",
      });

      setMessage("College expense saved successfully.");
      await loadFinance();
    } catch (err) {
      setError(
        err.message ||
          "Could not save the expense. Check the backend expense schema."
      );
    } finally {
      setSaving(false);
    }
  }

  const studentCards = [
    ["Total fees assigned", studentTotals.grossFees],
    ["Total concessions", studentTotals.concessions],
    ["Net fees after concessions", studentTotals.netFees],
    ["Fees received", studentTotals.received],
    ["Donations received", studentTotals.donationReceived],
    ["Pending fees", studentTotals.pending],
  ];

  const staffCards = [
    ["Total staff salary", staffTotals.total],
    ["Teaching staff salary", staffTotals.teaching],
    ["Non-teaching staff salary", staffTotals.nonTeaching],
  ];

  return (
    <main style={styles.page}>
     

      {message && (
        <div
          role="status"
          style={{
            padding: 14,
            marginBottom: 18,
            borderRadius: 10,
            background: "#eaf8ef",
            color: "#176b39",
          }}
        >
          {message}
        </div>
      )}

      {loading && (
        <p style={styles.subtitle}>Loading financial records...</p>
      )}

      {/* STUDENT FINANCES */}
      <section style={styles.section}>
        <h2>Student finances</h2>
        <p style={styles.subtitle}>
          Totals across all recorded fee categories, including tuition,
          hostel, mess, transport, examination, and other fees.
        </p>

        <div style={styles.grid}>
          {studentCards.map(([label, value]) => (
            <MetricCard key={label} label={label} value={value} />
          ))}
        </div>
      </section>

      {/* STAFF FINANCES */}
      <section style={styles.section}>
        <h2>Staff finances</h2>
        <p style={styles.subtitle}>
          Salary totals are calculated from saved payroll records.
        </p>

        <div style={styles.grid}>
          {staffCards.map(([label, value]) => (
            <MetricCard key={label} label={label} value={value} />
          ))}
        </div>

        {staffTotals.teaching === 0 &&
          staffTotals.nonTeaching === 0 &&
          payroll.length > 0 && (
            <p style={styles.subtitle}>
              Teaching and non-teaching totals require each payroll record
              to be linked to a staff record with a saved staff category.
            </p>
          )}
      </section>

      {/* MANAGEMENT */}
      <section style={styles.section}>
        <h2>Management overview</h2>
        <p style={styles.subtitle}>
          This estimate uses recorded collections and expenses, not
          assigned-but-unpaid fees or pending salaries.
        </p>

        <div style={styles.grid}>
          <MetricCard label="Fees and donations received" value={management.income} />
          <MetricCard label="Salary paid and other expenses" value={management.expenditure} />

            <article
              style={{
                ...styles.card,
                background:
                  management.result < 0
                    ? "linear-gradient(135deg, #fff1f2, #fecaca)"
                    : "linear-gradient(135deg, #ecfdf5, #a7f3d0)",
                border: `1px solid ${
                  management.result < 0 ? "#f87171" : "#34d399"
                }`,
                borderTop: `4px solid ${
                  management.result < 0 ? "#dc2626" : "#059669"
                }`,
                boxShadow: "0 8px 20px rgba(31, 41, 55, 0.06)",
              }}
            >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <p style={{ ...styles.label, color: management.result < 0 ? "#b91c1c" : "#15803d", fontWeight: 800 }}>
                {management.result < 0 ? "Management loss" : "Management surplus"}
              </p>
              <span
                aria-label={management.result < 0 ? "Loss" : "Profit"}
                title={management.result < 0 ? "Management loss" : "Management surplus"}
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 38, height: 38, borderRadius: 12,
                  color: management.result < 0 ? "#b91c1c" : "#15803d",
                  background: management.result < 0 ? "#fee2e2" : "#dcfce7",
                }}
              >
                {management.result < 0 ? <TrendingDown size={24} /> : <TrendingUp size={24} />}
              </span>
            </div>
            <h2 style={{ ...styles.value, color: management.result < 0 ? "#b91c1c" : "#15803d" }}>
              {management.result < 0 ? "-" : "+"}{money(Math.abs(management.result))}
            </h2>
            <p style={styles.subtitle}>
              {management.result < 0
                ? "Recorded expenditure exceeds recorded receipts."
                : "Recorded receipts cover recorded expenditure."}
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
