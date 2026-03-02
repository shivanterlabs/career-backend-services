import { useState, useEffect } from "react";
import { adminApi } from "../api";

const SECTIONS  = ["Interests", "Strengths", "Work Style", "Values", "Goals"];
const LEVELS    = ["easy", "medium", "hard"];
const TYPES     = ["single", "multi"];

const uuid = () => crypto.randomUUID();

function OptionEditor({ options, onChange }) {
  const add = () => onChange([...options, { id: uuid(), label: "", emoji: "" }]);
  const remove = (id) => onChange(options.filter(o => o.id !== id));
  const update = (id, field, value) =>
    onChange(options.map(o => o.id === id ? { ...o, [field]: value } : o));

  return (
    <div>
      <span className="options-label">Answer Options (min 2)</span>
      {options.map((opt, i) => (
        <div className="option-row" key={opt.id}>
          <input
            className="emoji-input"
            value={opt.emoji}
            onChange={e => update(opt.id, "emoji", e.target.value)}
            placeholder="😊"
            maxLength={2}
          />
          <input
            value={opt.label}
            onChange={e => update(opt.id, "label", e.target.value)}
            placeholder={`Option ${i + 1}`}
            required
          />
          {options.length > 2 && (
            <button type="button" className="btn btn-sm btn-danger" onClick={() => remove(opt.id)} style={{ flexShrink: 0 }}>✕</button>
          )}
        </div>
      ))}
      <button type="button" className="btn btn-secondary btn-sm" onClick={add} style={{ marginTop: 4 }}>+ Add Option</button>
    </div>
  );
}

function CreateQuestionModal({ test, onClose, onCreated }) {
  const [form, setForm] = useState({
    section: SECTIONS[0],
    level: "medium",
    type: "single",
    question: "",
    imageUrl: "",
    correctAnswerIds: [],
    order: 0,
  });
  const [options, setOptions]   = useState([{ id: uuid(), label: "", emoji: "" }, { id: uuid(), label: "", emoji: "" }]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (options.some(o => !o.label.trim())) { setError("All options must have a label"); return; }
    setError("");
    setLoading(true);
    try {
      await adminApi.createQuestion({
        testId:     test.testId,
        testGroup:  test.testGroup,
        section:    form.section,
        level:      form.level,
        type:       form.type,
        question:   form.question,
        imageUrl:   form.imageUrl || null,
        options:    options.map(({ id, label, emoji }) => ({ id, label, emoji: emoji || null })),
        correctAnswerIds: form.correctAnswerIds,
        order:      Number(form.order),
      });
      onCreated();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const f = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h3>Add Question</h3>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="inline-row">
            <div className="form-group">
              <label>Section</label>
              <select value={form.section} onChange={e => f("section", e.target.value)}>
                {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Type</label>
              <select value={form.type} onChange={e => f("type", e.target.value)}>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Level</label>
              <select value={form.level} onChange={e => f("level", e.target.value)}>
                {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Question Text</label>
            <textarea
              value={form.question}
              onChange={e => f("question", e.target.value)}
              placeholder="Enter the question…"
              required
            />
          </div>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <OptionEditor options={options} onChange={setOptions} />
          </div>
          <div className="inline-row">
            <div className="form-group">
              <label>Order</label>
              <input
                type="number"
                value={form.order}
                onChange={e => f("order", e.target.value)}
                min="0"
              />
            </div>
            <div className="form-group">
              <label>Image URL (optional)</label>
              <input
                value={form.imageUrl}
                onChange={e => f("imageUrl", e.target.value)}
                placeholder="https://…"
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Saving…" : "Save Question"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function QuestionsPage({ admin, test, onBack, onLogout }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [toggling, setToggling]   = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getQuestions(test.testId);
      setQuestions(res.data.questions);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [test.testId]);

  const toggleActive = async (q) => {
    setToggling(t => ({ ...t, [q.questionId]: true }));
    try {
      await adminApi.updateQuestion(q.questionId, { isActive: !q.isActive });
      setQuestions(qs => qs.map(x => x.questionId === q.questionId ? { ...x, isActive: !x.isActive } : x));
    } catch {
      alert("Failed to update question");
    } finally {
      setToggling(t => ({ ...t, [q.questionId]: false }));
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
        <div className="breadcrumb">
          <a onClick={onBack}>Tests</a>
          <span>›</span>
          <span>{test.testName}</span>
          <span className={`badge badge-${test.testGroup}`} style={{ marginLeft: 4 }}>{test.testGroup}</span>
          <span className={`badge badge-${test.status}`} style={{ marginLeft: 4 }}>{test.status}</span>
        </div>

        <div className="card">
          <div className="section-header">
            <h2>Questions ({questions.length})</h2>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Question</button>
          </div>

          {loading ? (
            <div className="spinner">Loading…</div>
          ) : questions.length === 0 ? (
            <div className="empty-state">No questions yet. Add the first question.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Question</th>
                    <th>Section</th>
                    <th>Type</th>
                    <th>Options</th>
                    <th>Active</th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q, i) => (
                    <tr key={q.questionId}>
                      <td style={{ color: "#aaa", fontSize: 12 }}>{q.order ?? i + 1}</td>
                      <td style={{ maxWidth: 360 }}>
                        <div>{q.question}</div>
                      </td>
                      <td><span className="badge" style={{ background: "#f0f0f5", color: "#444" }}>{q.section || "—"}</span></td>
                      <td style={{ fontSize: 12, color: "#666" }}>{q.type}</td>
                      <td>
                        <div className="q-options">
                          {(q.options || []).map(o => (
                            <span key={o.id} style={{ marginRight: 6 }}>{o.emoji} {o.label}</span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <button
                          className={`btn btn-sm ${q.isActive ? "btn-danger" : "btn-secondary"}`}
                          onClick={() => toggleActive(q)}
                          disabled={toggling[q.questionId]}
                        >
                          {toggling[q.questionId] ? "…" : q.isActive ? "Deactivate" : "Activate"}
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
        <CreateQuestionModal
          test={test}
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}
