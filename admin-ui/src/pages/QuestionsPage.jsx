import { useState, useEffect } from "react";
import { adminApi } from "../api";

// ── Section config — drives question type + option structure ─────────────────
const SECTION_CONFIG = {
  A: { label: "A — Interests (RIASEC)",    type: "triad",   fixedOptions: 3,    desc: "Forced-Choice Triad · 8 min · Ipsative scoring" },
  B: { label: "B — Aptitude (MCQ)",        type: "mcq",     fixedOptions: null, desc: "Single correct answer · 20 min · 1 mark each" },
  C: { label: "C — Personality (Pair)",    type: "pair",    fixedOptions: 2,    desc: "A/B Choice Pair · 8 min · Trait weighting" },
  D: { label: "D — Work Values (Ranking)", type: "ranking", fixedOptions: 5,    desc: "Rank in order (1–5) · 9 min · Weighted scoring" },
};

const RIASEC_CODES   = ["R", "I", "A", "S", "E", "C"];
const RIASEC_LABELS  = { R: "Realistic", I: "Investigative", A: "Artistic", S: "Social", E: "Enterprising", C: "Conventional" };
const LEVELS         = ["easy", "medium", "hard"];

const uuid = () => crypto.randomUUID();

const getInitialOptions = (section) => {
  switch (section) {
    case "A": return [
      { id: uuid(), label: "", riasecCode: "R" },
      { id: uuid(), label: "", riasecCode: "I" },
      { id: uuid(), label: "", riasecCode: "A" },
    ];
    case "B": return [
      { id: uuid(), label: "", emoji: "" },
      { id: uuid(), label: "", emoji: "" },
    ];
    case "C": return [
      { id: uuid(), label: "", trait: "" },
      { id: uuid(), label: "", trait: "" },
    ];
    case "D": return Array.from({ length: 5 }, () => ({ id: uuid(), label: "" }));
    default:  return [];
  }
};

// ── Section A — Triad (3 fixed options with RIASEC codes) ────────────────────
function TriadOptionEditor({ options, onChange }) {
  const update = (idx, field, value) => {
    const next = [...options];
    next[idx] = { ...next[idx], [field]: value };
    onChange(next);
  };
  return (
    <div>
      <span className="options-label">3 Options — each mapped to a RIASEC code</span>
      {options.map((opt, i) => (
        <div key={opt.id} style={{ marginBottom: 10 }}>
          <div className="option-row">
            <span style={{ fontSize: 13, color: "#888", width: 22, flexShrink: 0 }}>{i + 1}.</span>
            <input
              value={opt.label}
              onChange={e => update(i, "label", e.target.value)}
              placeholder={`Option ${i + 1} (e.g. Build a machine)`}
              required
              style={{ flex: 1 }}
            />
            <select
              value={opt.riasecCode}
              onChange={e => update(i, "riasecCode", e.target.value)}
              style={{ width: 130, padding: "8px 10px", border: "1.5px solid #e0e0e0", borderRadius: 8, fontSize: 13, background: "#fff" }}
            >
              {RIASEC_CODES.map(c => (
                <option key={c} value={c}>{c} — {RIASEC_LABELS[c]}</option>
              ))}
            </select>
          </div>
        </div>
      ))}
      <p style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
        Student picks Most Liked (+1) and Least Liked (−1). Middle option scores 0.
      </p>
    </div>
  );
}

// ── Section B — MCQ (flexible options, mark correct) ─────────────────────────
function MCQOptionEditor({ options, correctAnswerIds, onChange, onCorrectChange }) {
  const add    = () => onChange([...options, { id: uuid(), label: "", emoji: "" }]);
  const remove = (id) => { onChange(options.filter(o => o.id !== id)); if (correctAnswerIds.includes(id)) onCorrectChange([]); };
  const update = (id, field, value) => onChange(options.map(o => o.id === id ? { ...o, [field]: value } : o));

  return (
    <div>
      <span className="options-label">Options — select the correct answer</span>
      {options.map((opt, i) => (
        <div className="option-row" key={opt.id} style={{ alignItems: "center" }}>
          <input
            type="radio"
            name="correct-answer"
            checked={correctAnswerIds.includes(opt.id)}
            onChange={() => onCorrectChange([opt.id])}
            title="Mark as correct"
            style={{ width: "auto", flexShrink: 0, cursor: "pointer" }}
          />
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
            style={{ flex: 1 }}
          />
          {options.length > 2 && (
            <button type="button" className="btn btn-sm btn-danger" onClick={() => remove(opt.id)} style={{ flexShrink: 0 }}>✕</button>
          )}
        </div>
      ))}
      <button type="button" className="btn btn-secondary btn-sm" onClick={add} style={{ marginTop: 4 }}>+ Add Option</button>
      {correctAnswerIds.length === 0 && (
        <p style={{ fontSize: 12, color: "#cf1322", marginTop: 6 }}>⚠ Select the correct answer using the radio button.</p>
      )}
    </div>
  );
}

// ── Section C — Pair (2 fixed options with trait mapping) ────────────────────
function PairOptionEditor({ options, onChange }) {
  const update = (idx, field, value) => {
    const next = [...options];
    next[idx] = { ...next[idx], [field]: value };
    onChange(next);
  };
  const letters = ["A", "B"];
  return (
    <div>
      <span className="options-label">2 Options (A/B) — each maps to a personality trait</span>
      {options.map((opt, i) => (
        <div key={opt.id} style={{ marginBottom: 12, padding: "12px 14px", border: "1.5px solid #e0e0e0", borderRadius: 8 }}>
          <p style={{ fontWeight: 700, fontSize: 12, color: "#6c63ff", marginBottom: 8 }}>Option {letters[i]}</p>
          <div className="form-group" style={{ marginBottom: 8 }}>
            <label>Statement</label>
            <textarea
              value={opt.label}
              onChange={e => update(i, "label", e.target.value)}
              placeholder={`e.g. "I prefer working in a team" (Option ${letters[i]})`}
              required
              rows={2}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Personality Trait</label>
            <input
              value={opt.trait || ""}
              onChange={e => update(i, "trait", e.target.value)}
              placeholder={`e.g. Extraversion, Agreeableness, Conscientiousness…`}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Section D — Ranking (5 fixed items) ──────────────────────────────────────
function RankingOptionEditor({ options, onChange }) {
  const update = (idx, value) => {
    const next = [...options];
    next[idx] = { ...next[idx], label: value };
    onChange(next);
  };
  return (
    <div>
      <span className="options-label">5 Values — student ranks them 1 (most) to 5 (least)</span>
      {options.map((opt, i) => (
        <div className="option-row" key={opt.id}>
          <span style={{ fontSize: 13, color: "#888", width: 22, flexShrink: 0 }}>{i + 1}.</span>
          <input
            value={opt.label}
            onChange={e => update(i, e.target.value)}
            placeholder={`Value ${i + 1} (e.g. Work-Life Balance)`}
            required
            style={{ flex: 1 }}
          />
        </div>
      ))}
      <p style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
        Weighted scores: Rank 1 = 5 pts, Rank 2 = 4 pts … Rank 5 = 1 pt.
      </p>
    </div>
  );
}

// ── Create Question Modal ─────────────────────────────────────────────────────
function CreateQuestionModal({ test, onClose, onCreated }) {
  const [section, setSection]         = useState("A");
  const [question, setQuestion]       = useState("");
  const [imageUrl, setImageUrl]       = useState("");
  const [level, setLevel]             = useState("medium");
  const [order, setOrder]             = useState(0);
  const [options, setOptions]         = useState(getInitialOptions("A"));
  const [correctAnswerIds, setCorrect] = useState([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");

  const cfg = SECTION_CONFIG[section];

  // Re-initialise options when section changes
  const handleSectionChange = (s) => {
    setSection(s);
    setOptions(getInitialOptions(s));
    setCorrect([]);
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (options.some(o => !o.label.trim())) {
      setError("All options must have a label"); return;
    }
    if (cfg.type === "mcq" && correctAnswerIds.length === 0) {
      setError("Select the correct answer for this MCQ"); return;
    }

    setLoading(true);
    try {
      const payload = {
        testId:           test.testId,
        testGroup:        test.testGroup,
        section,
        type:             cfg.type,
        question:         question.trim(),
        imageUrl:         imageUrl || null,
        correctAnswerIds: cfg.type === "mcq" ? correctAnswerIds : [],
        order:            Number(order),
        options,          // each type stores what it needs
      };
      if (cfg.type === "mcq") payload.level = level;

      await adminApi.createQuestion(payload);
      onCreated();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 620 }}>
        <h3>Add Question</h3>

        {/* Section selector */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {Object.entries(SECTION_CONFIG).map(([key, c]) => (
            <button
              key={key}
              type="button"
              onClick={() => handleSectionChange(key)}
              style={{
                padding: "6px 14px", borderRadius: 20, border: "1.5px solid",
                borderColor: section === key ? "#6c63ff" : "#ddd",
                background: section === key ? "#6c63ff" : "#fff",
                color: section === key ? "#fff" : "#555",
                cursor: "pointer", fontSize: 13, fontWeight: 600,
              }}
            >
              Section {key}
            </button>
          ))}
        </div>

        {/* Section desc */}
        <div style={{ background: "#f8f8fc", borderRadius: 8, padding: "8px 12px", marginBottom: 16, fontSize: 12, color: "#555" }}>
          <strong>{cfg.label}</strong> &nbsp;·&nbsp; {cfg.desc}
        </div>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Question / Prompt</label>
            <textarea
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder={
                section === "A" ? "e.g. Choose from these three activities…" :
                section === "B" ? "e.g. Which of the following is an example of…" :
                section === "C" ? "e.g. When starting a project, I prefer to…" :
                                  "e.g. Rank these work values in order of importance to you…"
              }
              required
            />
          </div>

          {/* Section-specific option editor */}
          <div style={{ marginBottom: 16 }}>
            {section === "A" && <TriadOptionEditor options={options} onChange={setOptions} />}
            {section === "B" && (
              <MCQOptionEditor
                options={options}
                correctAnswerIds={correctAnswerIds}
                onChange={setOptions}
                onCorrectChange={setCorrect}
              />
            )}
            {section === "C" && <PairOptionEditor options={options} onChange={setOptions} />}
            {section === "D" && <RankingOptionEditor options={options} onChange={setOptions} />}
          </div>

          <div className="inline-row">
            <div className="form-group">
              <label>Order #</label>
              <input
                type="number"
                value={order}
                onChange={e => setOrder(e.target.value)}
                min="0"
              />
            </div>
            {section === "B" && (
              <div className="form-group">
                <label>Difficulty</label>
                <select value={level} onChange={e => setLevel(e.target.value)}>
                  {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            )}
            <div className="form-group">
              <label>Image URL (optional)</label>
              <input
                value={imageUrl}
                onChange={e => setImageUrl(e.target.value)}
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

// ── Section badge colours ─────────────────────────────────────────────────────
const SECTION_BADGE = {
  A: { bg: "#fff3e0", color: "#e65100" },
  B: { bg: "#e8f5e9", color: "#2e7d32" },
  C: { bg: "#e3f2fd", color: "#1565c0" },
  D: { bg: "#fce4ec", color: "#880e4f" },
};

const TYPE_LABEL = { triad: "Triad", mcq: "MCQ", pair: "Pair", ranking: "Ranking" };

// ── Questions Page ────────────────────────────────────────────────────────────
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

  // Group questions by section for display
  const bySec = ["A", "B", "C", "D"].map(sec => ({
    sec,
    cfg: SECTION_CONFIG[sec],
    qs: questions.filter(q => q.section === sec),
  })).filter(g => g.qs.length > 0);

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

        {/* Section summary strip */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          {Object.entries(SECTION_CONFIG).map(([sec, cfg]) => {
            const count = questions.filter(q => q.section === sec).length;
            const sb = SECTION_BADGE[sec];
            return (
              <div key={sec} style={{ background: sb.bg, color: sb.color, borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600 }}>
                Section {sec} — {cfg.type.toUpperCase()} &nbsp;·&nbsp; {count} questions
              </div>
            );
          })}
        </div>

        <div className="card">
          <div className="section-header">
            <h2>Questions ({questions.length})</h2>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Question</button>
          </div>

          {loading ? (
            <div className="spinner">Loading…</div>
          ) : questions.length === 0 ? (
            <div className="empty-state">No questions yet. Add the first question to a section.</div>
          ) : (
            bySec.map(({ sec, cfg, qs }) => {
              const sb = SECTION_BADGE[sec];
              return (
                <div key={sec} style={{ marginBottom: 28 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <span style={{ background: sb.bg, color: sb.color, padding: "4px 12px", borderRadius: 20, fontSize: 13, fontWeight: 700 }}>
                      Section {sec}
                    </span>
                    <span style={{ fontSize: 13, color: "#888" }}>{cfg.label.split("—")[1]?.trim()} · {cfg.desc}</span>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Question / Prompt</th>
                          <th>Options / Items</th>
                          {sec === "B" && <th>Level</th>}
                          <th>Active</th>
                        </tr>
                      </thead>
                      <tbody>
                        {qs.map((q, i) => (
                          <tr key={q.questionId}>
                            <td style={{ color: "#aaa", fontSize: 12 }}>{q.order ?? i + 1}</td>
                            <td style={{ maxWidth: 320 }}>{q.question}</td>
                            <td>
                              <div className="q-options">
                                {(q.options || []).map(o => (
                                  <span key={o.id} style={{ display: "inline-block", marginRight: 6, marginBottom: 2 }}>
                                    {o.emoji && <>{o.emoji} </>}
                                    {o.label}
                                    {o.riasecCode && <span style={{ color: "#888", fontSize: 11 }}> [{o.riasecCode}]</span>}
                                    {o.trait && <span style={{ color: "#888", fontSize: 11 }}> → {o.trait}</span>}
                                  </span>
                                ))}
                              </div>
                            </td>
                            {sec === "B" && <td style={{ fontSize: 12, color: "#888" }}>{q.level || "—"}</td>}
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
                </div>
              );
            })
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
