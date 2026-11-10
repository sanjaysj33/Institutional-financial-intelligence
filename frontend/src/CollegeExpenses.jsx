import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Receipt, RefreshCw, Wallet, MoreVertical, Pencil, Trash2, X } from "lucide-react";
import { financeApi } from "./api";

const today = () => new Date().toISOString().slice(0, 10);
const categories = [
  "Painting and renovation", "College appliances", "Bus service", "Fuel cost",
  "College maintenance", "Electricity", "Water supply", "Internet and telephone",
  "Furniture", "Laboratory equipment", "Computer and IT equipment", "Library expenses",
  "Cleaning and sanitation", "Security", "Events and functions", "Sports equipment",
  "Stationery and printing", "Repairs", "Insurance", "Other expenses",
];
const initialForm = {
  category: "College maintenance", amount: "", spent_date: today(),
  payment_method: "upi", receipt_number: "",
};
const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fieldStyle = { width: "100%", minHeight: 44, padding: "11px 12px", border: "1px solid #dce4f0", borderRadius: 10, background: "#fff", color: "#19243a", font: "inherit", boxSizing: "border-box" };
const labelStyle = { display: "flex", flexDirection: "column", gap: 7, fontSize: 13, fontWeight: 700, color: "#526079", minWidth: 0 };
const buttonStyle = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, border: 0, borderRadius: 10, background: "#5365e8", color: "#fff", padding: "11px 16px", fontWeight: 750, cursor: "pointer" };
const secondaryButtonStyle = { ...buttonStyle, background: "#e9edff", color: "#3f50c6", border: "1px solid #d7ddff" };
const panelStyle = { background: "#fff", border: "1px solid #e0e7f1", borderRadius: 16, padding: 22, marginBottom: 18, boxShadow: "0 5px 18px rgba(25,43,80,.035)" };

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}
function downloadExpensesCsv(expenses) {
  const headers = ["Date", "Category", "Payment method", "Receipt number", "Amount (INR)"];
  const rows = expenses.map((item) => [
    item.spent_date || item.date || "",
    item.category || "Other expenses",
    item.payment_method || "",
    item.receipt_number || "",
    Number(item.amount || 0),
  ]);
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `CampusLedger_College_Expense_History_${today()}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function CollegeExpenses() {
  const [form, setForm] = useState({ ...initialForm, spent_date: today() });
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingExpenseId, setEditingExpenseId] = useState(null);

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await financeApi.expenses();
      setExpenses(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Could not load college expenses.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadExpenses(); }, [loadExpenses]);

  const totalSpent = useMemo(() => expenses.reduce((sum, item) => sum + Math.max(0, Number(item.amount || 0)), 0), [expenses]);
  const updateForm = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  async function submitExpense(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (!form.spent_date) {
      setError("Select the date the expense was paid.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        category: form.category,
        amount,
        spent_date: form.spent_date,
        paid_date: form.spent_date,
        payment_method: form.payment_method,
        receipt_number: form.receipt_number.trim() || null,
      };
      if (editingExpenseId) {
        await financeApi.updateExpense(editingExpenseId, payload);
        setSuccess("College expense updated successfully.");
      } else {
        await financeApi.recordExpense(payload);
        setSuccess("College expense saved successfully.");
      }
      setEditingExpenseId(null);
      setForm({ ...initialForm, spent_date: today() });
      await loadExpenses();
    } catch (err) {
      setError(err.message || "Could not save the expense. Check the backend API.");
    } finally {
      setSaving(false);
    }
  }


  function editExpense(expense) {
    setEditingExpenseId(expense.id || expense.expense_id);
    setForm({
      category: expense.category || "Other expenses",
      amount: String(expense.amount ?? ""),
      spent_date: expense.spent_date || expense.paid_date || expense.date || today(),
      payment_method: String(expense.payment_method || "upi").toLowerCase(),
      receipt_number: expense.receipt_number || "",
    });
    setError("");
    setSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteExpense(expense) {
    const id = expense.id || expense.expense_id;
    if (!id) {
      setError("This expense has no record ID and cannot be deleted.");
      return;
    }
    if (!window.confirm(`Delete the ${expense.category || "expense"} record for ${money(expense.amount)}? This cannot be undone.`)) return;
    setError("");
    setSuccess("");
    try {
      await financeApi.deleteExpense(id);
      if (editingExpenseId === id) {
        setEditingExpenseId(null);
        setForm({ ...initialForm, spent_date: today() });
      }
      setSuccess("Expense deleted successfully.");
      await loadExpenses();
    } catch (err) {
      setError(err.message || "Could not delete this expense.");
    }
  }

  return (
    <main style={{ minHeight: "100vh", padding: "24px clamp(14px, 2.2vw, 32px)", background: "#f2f5fb", color: "#19243a", boxSizing: "border-box" }}>

      {error && <div role="alert" style={{ ...panelStyle, background: "#fff1f2", borderColor: "#fecdd3", color: "#be123c", padding: 14 }}>{error}</div>}
      {success && <div role="status" style={{ ...panelStyle, background: "#ecfdf5", borderColor: "#bbf7d0", color: "#047857", padding: 14 }}>{success}</div>}

      <section style={{ ...panelStyle, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 18 }}>
        <div style={{ borderRadius: 12, padding: 17, background: "linear-gradient(135deg,#eef2ff,#f7f8ff)" }}>
          <div style={{ color: "#697a99", fontSize: 13, marginBottom: 8 }}>Total recorded expenses</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#273b85" }}>{money(totalSpent)}</div>
        </div>
        <div style={{ borderRadius: 12, padding: 17, background: "linear-gradient(135deg,#e8fbf5,#f5fffb)" }}>
          <div style={{ color: "#697a99", fontSize: 13, marginBottom: 8 }}>Number of expense records</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#087f69" }}>{expenses.length}</div>
        </div>
      </section>

      <section style={panelStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7 }}><span style={{ display: "grid", placeItems: "center", width: 36, height: 36, borderRadius: 10, background: "#fff1db", color: "#b76b08" }}><Wallet size={18} /></span><h2 style={{ margin: 0, fontSize: 20 }}>{editingExpenseId ? "Edit college expense" : "Record college expense"}</h2></div>
        <p style={{ color: "#8290a8", margin: "0 0 18px" }}>Enter the category, amount, date and payment details.</p>
        <form onSubmit={submitExpense} style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }}>
          <label style={labelStyle}>Expense category
            <select className="expense-select" name="category" value={form.category} onChange={updateForm} style={fieldStyle} required>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select>
          </label>
          <label style={labelStyle}>Amount spent (₹)
            <input name="amount" type="number" min="0.01" step="0.01" value={form.amount} onChange={updateForm} placeholder="Enter amount" style={fieldStyle} required />
          </label>
          <label style={labelStyle}>Date spent
            <input name="spent_date" type="date" value={form.spent_date} onChange={updateForm} style={fieldStyle} required />
          </label>
          <label style={labelStyle}>Payment method
            <select className="expense-select" name="payment_method" value={form.payment_method} onChange={updateForm} style={fieldStyle} required>
              <option value="upi">UPI</option><option value="cash">Cash</option><option value="card">Card</option><option value="bank_transfer">Bank transfer</option><option value="cheque">Cheque</option><option value="other">Other</option>
            </select>
          </label>
          <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>Receipt number (optional)
            <input name="receipt_number" value={form.receipt_number} onChange={updateForm} placeholder="Enter receipt number" style={fieldStyle} />
          </label>
          <div style={{ gridColumn: "1 / -1" }}><button type="submit" style={buttonStyle} disabled={saving}><Receipt size={16} /> {saving ? "Saving..." : editingExpenseId ? "Save expense changes" : "Save college expense"}</button>
            {editingExpenseId && <button type="button" style={secondaryButtonStyle} onClick={() => { setEditingExpenseId(null); setForm({ ...initialForm, spent_date: today() }); }}>Cancel edit <X size={15} /></button>}
          </div>
        </form>
      </section>

      <section style={panelStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 6 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>College expense history</h2>
          <button type="button" style={buttonStyle} onClick={() => downloadExpensesCsv(expenses)} disabled={loading || expenses.length === 0}><Download size={16} /> Download expense history</button>
        </div>
        <p style={{ color: "#8290a8", margin: "7px 0 16px" }}>Download all recorded expense history as a CSV file that opens in Excel or Numbers.</p>
        <div style={{ overflowX: "auto", width: "100%" }}>
          <table style={{ width: "100%", minWidth: 680, borderCollapse: "collapse" }}>
            <thead><tr>{["Date", "Category", "Payment method", "Receipt number", "Amount", "Actions"].map((heading) => <th key={heading} style={{ padding: 13, textAlign: "left", background: "#f1f4ff", color: "#63728e", fontSize: 12, whiteSpace: "nowrap" }}>{heading}</th>)}</tr></thead>
            <tbody>
              {expenses.map((expense, index) => <tr key={expense.id || expense.expense_id || index}>
                <td style={{ padding: 13, borderBottom: "1px solid #edf0f6" }}>{expense.spent_date || expense.date || "—"}</td>
                <td style={{ padding: 13, borderBottom: "1px solid #edf0f6" }}>{expense.category || "Other expenses"}</td>
                <td style={{ padding: 13, borderBottom: "1px solid #edf0f6" }}>{String(expense.payment_method || "—").replaceAll("_", " ")}</td>
                <td style={{ padding: 13, borderBottom: "1px solid #edf0f6" }}>{expense.receipt_number || "—"}</td>
                <td style={{ padding: 13, borderBottom: "1px solid #edf0f6", fontWeight: 750 }}>{money(expense.amount)}</td>
                <td
                  className="expense-actions-cell"
                  style={{ padding: 10, borderBottom: "1px solid #edf0f6", textAlign: "center", position: "relative" }}
                >
                  <details className="row-action-menu expense-row-action-menu">
                    <summary
                      className="icon-button row-action-trigger"
                      aria-label={`Actions for ${expense.category || "expense"} dated ${expense.spent_date || expense.date || ""}`}
                      title="More actions"
                    >
                      <MoreVertical size={18} />
                    </summary>
                    <div className="row-action-popover">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.currentTarget.closest("details")?.removeAttribute("open");
                          editExpense(expense);
                        }}
                      >
                        <Pencil size={15} /> Edit expense
                      </button>
                      <button
                        type="button"
                        className="menu-danger"
                        onClick={(event) => {
                          event.currentTarget.closest("details")?.removeAttribute("open");
                          void deleteExpense(expense);
                        }}
                      >
                        <Trash2 size={15} /> Delete expense
                      </button>
                    </div>
                  </details>
                </td>
              </tr>)}
              {!loading && expenses.length === 0 && <tr><td colSpan={6} style={{ padding: 22, textAlign: "center", color: "#8290a8" }}>No college expenses recorded yet.</td></tr>}
              {loading && <tr><td colSpan={6} style={{ padding: 22, textAlign: "center", color: "#8290a8" }}>Loading expense history...</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <style>{`.expense-row-action-menu{position:relative;display:inline-block;vertical-align:middle}.expense-row-action-menu>.row-action-trigger{display:inline-flex;align-items:center;justify-content:center;list-style:none;width:36px;height:36px;border:1px solid #e1e6f0;border-radius:10px;background:#fff;color:#526079;cursor:pointer}.expense-row-action-menu>.row-action-trigger::-webkit-details-marker{display:none}.expense-row-action-menu>.row-action-trigger::marker{content:""}.expense-row-action-menu[open]>.row-action-trigger{background:#eef1ff;color:#4f60d7;border-color:#cfd6ff}.expense-row-action-menu>.row-action-popover{position:absolute;z-index:1005;top:calc(100% + 6px);right:0;width:175px;padding:6px;border:1px solid #e5e9f1;border-radius:12px;background:#fff;box-shadow:0 14px 35px rgba(23,32,51,.18);text-align:left;white-space:normal}.expense-row-action-menu>.row-action-popover button{width:100%;min-height:40px;display:flex;align-items:center;gap:10px;padding:10px 11px;border:0;border-radius:8px;background:transparent;color:#344054;text-align:left;font-size:12px;font-weight:650;white-space:nowrap}.expense-row-action-menu>.row-action-popover button:hover{background:#f4f6ff;color:#4f60d7}.expense-row-action-menu>.row-action-popover button.menu-danger{color:#c53e4b}.expense-row-action-menu>.row-action-popover button.menu-danger:hover{background:#fff0f1;color:#b42332}@media(max-width:700px){form[style*="grid-template-columns"]{grid-template-columns:minmax(0,1fr)!important}form[style*="grid-template-columns"] label{grid-column:1/-1!important}} button{transition:background .16s ease,transform .16s ease} button:not(:disabled):hover{filter:brightness(.97);transform:translateY(-1px)} button:focus-visible,select:focus-visible,input:focus-visible{outline:3px solid #c7d2fe;outline-offset:2px}`}</style>
    </main>
  );
}
