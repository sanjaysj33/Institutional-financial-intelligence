import { useCallback, useEffect, useState } from "react";
import { MoreVertical, Pencil, Trash2, UserRoundX } from "lucide-react";
import { staffApi } from "./api";

const today = () => new Date().toISOString().slice(0, 10);

const WORK_ROLES = [
  "Electrician",
  "Plumber",
  "Mechanic",
  "Watchman / Security Guard",
  "Housekeeping / Cleaner",
  "Gardener",
  "Driver",
  "Bus Conductor",
  "Carpenter",
  "Painter",
  "Welder",
  "Mason",
  "AC / HVAC Technician",
  "Lift Operator / Technician",
  "Lab Assistant",
  "Office Assistant",
  "Clerk",
  "Accountant",
  "Store Keeper",
  "Canteen Staff",
  "Other",
];

const emptyForm = () => ({
  staff_id: "",
  name: "",
  email: "",
  phone: "",
  department_id: "",
  staff_type: "teaching",
  working_department: "",
  joined_date: today(),
  monthly_salary: "",
});

const money = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;

export default function StaffFinance({ departments = [], initialTab = "staff" }) {
  const [staff, setStaff] = useState([]);
  const [staffForm, setStaffForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const records = await staffApi.list();
      setStaff(Array.isArray(records) ? records : []);
      setError("");
    } catch (e) {
      setError(e.message || "Unable to load staff records.");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const change = (event) => {
    const { name, value } = event.target;
    const safeValue =
      name === "staff_id"
        ? value.replace(/[^A-Za-z0-9]/g, "")
        : name === "name"
          ? value.replace(/[^A-Za-z ]/g, "").replace(/\s{2,}/g, " ")
          : value;
    setStaffForm((current) => {
      const next = { ...current, [name]: safeValue };
      if (name === "staff_type" && value === "teaching") {
        next.working_department = "";
        if (next.department_id === "others") next.department_id = "";
      }
      if (name === "department_id" && value !== "others") {
        next.working_department = "";
      }
      if (name === "department_id" && value === "others") {
        next.working_department = "";
      }
      return next;
    });
  };

  const resetForm = () => {
    setStaffForm(emptyForm());
    setEditingId(null);
  };

  const editStaff = (member) => {
    if ((member.status || "active").toLowerCase() !== "active") return;
    setEditingId(member.id);
    setStaffForm({
      staff_id: member.staff_id || "",
      name: member.name || "",
      email: member.email || "",
      phone: member.phone || "",
      department_id: member.department_id || "",
      staff_type: member.staff_type || "teaching",
      working_department: member.working_department || "",
      joined_date: member.joined_date || today(),
      monthly_salary: String(member.monthly_salary ?? ""),
    });
    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  async function saveStaff(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const staffId = staffForm.staff_id.trim();
      const staffName = staffForm.name.trim();
      if (!/^[A-Za-z0-9]+$/.test(staffId)) {
        throw new Error("Staff ID can contain letters and numbers only.");
      }
      if (!/^[A-Za-z]+(?: [A-Za-z]+)*$/.test(staffName) || staffName.replace(/\s/g, "").length < 3) {
        throw new Error("Staff name must contain at least 3 letters and only letters/spaces.");
      }
      const isOtherRole =
        staffForm.staff_type === "non_teaching" &&
        staffForm.department_id === "others";

      if (staffForm.staff_type === "non_teaching" && !staffForm.department_id) {
        throw new Error("Select a handling department.");
      }
      if (isOtherRole && !staffForm.working_department) {
        throw new Error("Select the non-teaching work role.");
      }

      const payload = {
        ...staffForm,
        staff_id: staffForm.staff_id.trim(),
        name: staffForm.name.trim(),
        email: staffForm.email.trim() || null,
        phone: staffForm.phone.trim() || null,
        monthly_salary: Number(staffForm.monthly_salary || 0),
        // Only save a working role when Non-Teaching + Others is selected.
        working_department: isOtherRole ? staffForm.working_department : "",
      };

      if (editingId) {
        await staffApi.update(editingId, payload);
        setMessage("Staff details updated successfully.");
      } else {
        await staffApi.create(payload);
        setMessage("Staff member added successfully.");
      }

      resetForm();
      await refresh();
    } catch (e) {
      setError(e.message || "Unable to save staff.");
    } finally {
      setBusy(false);
    }
  }

  async function relieveStaff(member) {
    if (!window.confirm(`Mark ${member.name} as relieved?`)) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await staffApi.relieve(member.id);
      if (editingId === member.id) resetForm();
      await refresh();
      setMessage(`${member.name} has been relieved successfully.`);
    } catch (e) {
      setError(e.message || "Unable to relieve staff.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteStaff(member) {
    if (!window.confirm(`Permanently delete ${member.name}'s staff profile? This cannot be undone. Payroll history is not deleted.`)) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await staffApi.remove(member.id);
      if (editingId === member.id) resetForm();
      await refresh();
      setMessage("Staff profile deleted. Payroll history remains.");
    } catch (e) {
      setError(e.message || "Unable to delete staff.");
    } finally {
      setBusy(false);
    }
  }

  const isOtherRole =
    staffForm.staff_type === "non_teaching" &&
    staffForm.department_id === "others";

  return (
    <div className="staff-finance-page">
      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      <section className="panel form-panel">
        <div className="panel-heading">
          <div>
            <h2>{editingId ? "Edit staff member" : "Add staff member"}</h2>
            <p>Enter staff details, handling department, joining date and monthly salary.</p>
          </div>
        </div>

        <form className="staff-form-grid" onSubmit={saveStaff}>
          <label>
            Staff ID *
            <input name="staff_id" value={staffForm.staff_id} onChange={change} minLength={2} maxLength={30} pattern="[A-Za-z0-9]+" title="Letters and numbers only." required />
          </label>

          <label>
            Name *
            <input name="name" value={staffForm.name} onChange={change} minLength={3} maxLength={150} pattern="[A-Za-z]+( [A-Za-z]+)*" title="At least 3 letters; letters and spaces only." required />
          </label>

          <label>
            Staff category *
            <select name="staff_type" value={staffForm.staff_type} onChange={change} required>
              <option value="teaching">Teaching Staff</option>
              <option value="non_teaching">Non-Teaching Staff</option>
            </select>
          </label>

          <label>
            Email
            <input type="email" name="email" value={staffForm.email} onChange={change} maxLength={254} />
          </label>

          <label>
            Phone
            <input type="tel" name="phone" value={staffForm.phone} onChange={change} maxLength={20} />
          </label>

          <label>
            Handling department *
            <select name="department_id" value={staffForm.department_id} onChange={change} required>
              <option value="">Select department</option>
              {departments.filter((d) => d.is_active).map((d) => (
                <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
              ))}
              {staffForm.staff_type === "non_teaching" && (
                <option value="others">Others</option>
              )}
            </select>
          </label>

          {isOtherRole && (
            <label>
              Working department / work type *
              <select name="working_department" value={staffForm.working_department} onChange={change} required>
                <option value="">Select work type</option>
                {WORK_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
              </select>
            </label>
          )}

          <label>
            Joined date *
            <input type="date" name="joined_date" value={staffForm.joined_date} onChange={change} required />
          </label>

          <label>
            Monthly salary (₹) *
            <input type="number" name="monthly_salary" value={staffForm.monthly_salary} onChange={change} min="0" step="0.01" required />
          </label>

          <div className="form-actions" style={{ gridColumn: "1 / -1" }}>
            <button type="submit" className="primary-button" disabled={busy}>
              {busy ? "Please wait..." : editingId ? "Save changes" : "Add staff"}
            </button>
            {editingId && <button type="button" className="secondary-button" disabled={busy} onClick={resetForm}>Cancel edit</button>}
          </div>
        </form>
      </section>

      <section className="panel departments-panel">
        <div className="panel-heading">
          <div><h2>Staff records</h2><p>Active and relieved staff history.</p></div>
          <span className="record-count">{staff.length} records</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>STAFF</th><th>CATEGORY</th><th>HANDLING DEPARTMENT</th><th>WORK TYPE</th><th>JOINED</th><th>MONTHLY SALARY</th><th>STATUS</th><th>ACTIONS</th>
            </tr></thead>
            <tbody>
              {staff.map((member) => {
                const status = (member.status || "active").toLowerCase();
                const isOther = member.department_id === "others";
                const departmentName = isOther
                  ? "Others"
                  : departments.find((d) => d.id === member.department_id)?.name || member.department_name || "Unknown";
                return (
                  <tr key={member.id}>
                    <td className="staff-info-cell"><strong className="staff-name">{member.name}</strong><small className="staff-details">ID: {member.staff_id}</small><small className="staff-email">{member.email || "No email"}</small></td>
                    <td>{member.staff_type === "non_teaching" ? "Non-Teaching Staff" : "Teaching Staff"}</td>
                    <td>{departmentName}</td>
                    <td>{isOther ? member.working_department || "—" : "—"}</td>
                    <td>{member.joined_date || "—"}</td>
                    <td>{money(member.monthly_salary)}</td>
                    <td><span className={`status-badge ${status}`}><strong>{status === "relieved" ? "Relieved" : "Active"}</strong></span></td>
                    <td className="student-actions-cell">
                      <details className="row-action-menu">
                        <summary className="icon-button row-action-trigger" aria-label={`Actions for ${member.name}`} title="More actions"><MoreVertical size={18} /></summary>
                        <div className="row-action-popover">
                          {status === "active" && <>
                            <button type="button" disabled={busy} onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); editStaff(member); }}><Pencil size={15} /> Edit staff</button>
                            <button type="button" disabled={busy} onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); relieveStaff(member); }}><UserRoundX size={15} /> Relieve staff</button>
                          </>}
                          <button type="button" className="menu-danger" disabled={busy} onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); deleteStaff(member); }}><Trash2 size={15} /> Delete staff</button>
                        </div>
                      </details>
                    </td>
                  </tr>
                );
              })}
              {staff.length === 0 && <tr><td colSpan={8}>No staff records found.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <style>{`
        .staff-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 20px; align-items: start; }
        .staff-form-grid > label { min-width: 0; }
        .staff-form-grid input, .staff-form-grid select { width: 100%; box-sizing: border-box; }
        @media (max-width: 850px) { .staff-form-grid { grid-template-columns: minmax(0, 1fr); } }
      `}</style>
    </div>
  );
}
