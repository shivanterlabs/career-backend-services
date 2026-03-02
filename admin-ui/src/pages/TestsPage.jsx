import { useState, useEffect } from "react";
import { adminApi } from "../api";

const CLASS_OPTIONS = ["8th", "9th", "10th", "11th", "12th"];

function CreateTestModal({ onClose, onCreated }) {
  const [form, setForm]     = useState({ testName: "", testGroup: "school", targetClasses: [], durationMins: 45, description: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");

  const toggle = (cls) =>
    setForm(f => ({
      ...f,
      targetClasses: f.targetClasses.includes(cls)
        ? f.targetClasses.filter(c => c !== cls)
        : [...f.targetClasses, cls],
    }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await adminApi.createTest({ ...form, durationMins: Number(form.durationMins) });
      onCreated();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h3>Create New Test</h3>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Test Name</label>
            <input
              value={form.testName}
              onChange={e => setForm(f => ({ ...f, testName: e.target.value }))}
              placeholder="e.g. School Career Test v1"
              required
            />
          </div>
          <div className="inline-row">
            <div className="form-group">
              <label>Test Group</label>
              <select value={form.testGroup} onChange={e => setForm(f => ({ ...f, testGroup: e.target.value }))}>
                <option value="school">School (8–10)</option>
                <option value="college">College (11–12)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Duration (mins)</label>
              <input
                type="number"
                value={form.durationMins}
                onChange={e => setForm(f => ({ ...f, durationMins: e.target.value }))}
                min="5" max="180"
              />
            </div>
          </div>
          <div className="form-group">
            <label>Target Classes</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
              {CLASS_OPTIONS.map(cls => (
                <label key={cls} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={form.targetClasses.includes(cls)}
                    onChange={() => toggle(cls)}
                    style={{ width: "auto" }}
                  />
                  {cls}
                </label>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label>Description (optional)</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Short description"
            />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Creating…" : "Create Test"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TestsPage({ admin, onSelectTest, onLogout }) {
  const [tests, setTests]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [toggling, setToggling]   = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getTests();
      setTests(res.data.tests);
    } catch {
      // error silently — table stays empty
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleStatus = async (test, e) => {
    e.stopPropagation();
    const newStatus = test.status === "active" ? "inactive" : "active";
    setToggling(t => ({ ...t, [test.testId]: true }));
    try {
      await adminApi.updateTest(test.testId, { status: newStatus });
      setTests(ts => ts.map(t => t.testId === test.testId ? { ...t, status: newStatus } : t));
    } catch {
      alert("Failed to update status");
    } finally {
      setToggling(t => ({ ...t, [test.testId]: false }));
    }
  };

  return (
    <div className="page">
      <div className="topbar">
        <h1>ChillCareer Admin</h1>
        <div className="topbar-right">
          <span>{admin.name} ({admin.role})</span>
          <button onClick={onLogout}>Logout</button>
        </div>
      </div>

      <div className="content">
        <div className="card">
          <div className="section-header">
            <h2>Tests</h2>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ New Test</button>
          </div>

          {loading ? (
            <div className="spinner">Loading…</div>
          ) : tests.length === 0 ? (
            <div className="empty-state">No tests yet. Create your first test.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Test Name</th>
                    <th>Group</th>
                    <th>Classes</th>
                    <th>Questions</th>
                    <th>Duration</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {tests.map(test => (
                    <tr key={test.testId} className="row-link" onClick={() => onSelectTest(test)}>
                      <td>
                        <button className="test-name-btn" onClick={e => { e.stopPropagation(); onSelectTest(test); }}>
                          {test.testName}
                        </button>
                      </td>
                      <td><span className={`badge badge-${test.testGroup}`}>{test.testGroup}</span></td>
                      <td>{(test.targetClasses || []).join(", ") || "—"}</td>
                      <td>{test.totalQuestions ?? 0}</td>
                      <td>{test.durationMins} min</td>
                      <td><span className={`badge badge-${test.status}`}>{test.status}</span></td>
                      <td>
                        <button
                          className={`btn btn-sm ${test.status === "active" ? "btn-danger" : "btn-secondary"}`}
                          onClick={e => toggleStatus(test, e)}
                          disabled={toggling[test.testId]}
                        >
                          {toggling[test.testId] ? "…" : test.status === "active" ? "Deactivate" : "Activate"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <CreateTestModal
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}
