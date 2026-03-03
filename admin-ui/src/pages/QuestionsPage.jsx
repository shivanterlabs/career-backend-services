import { useState, useEffect } from "react";
import { adminApi } from "../api";

// ── Section config — drives question type + option structure ─────────────────
const SECTION_CONFIG = {
  A: { label: "A — Interests (RIASEC)",        type: "triad",   fixedOptions: 3,    desc: "Forced-Choice Triad · 8 min · Ipsative scoring" },
  B: { label: "B — Aptitude (MCQ)",            type: "mcq",     fixedOptions: null, desc: "Single correct answer · 20 min · 1 mark each" },
  C: { label: "C — Personality (Pair)",        type: "pair",    fixedOptions: 2,    desc: "A/B Choice Pair · 8 min · Trait weighting" },
  D: { label: "D — Work Values (Ranking)",     type: "ranking", fixedOptions: 5,    desc: "Rank in order (1–5) · 9 min · Weighted scoring" },
  E: { label: "E — Self-Declared Interest",    type: "text",    fixedOptions: 0,    desc: "Open-ended text response · Student types their own answer" },
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
    case "E": return [];
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
      <span className="options-label">5 Values — first 2 required · student ranks them in order of preference</span>
      {options.map((opt, i) => (
        <div className="option-row" key={opt.id}>
          <span style={{ fontSize: 13, color: i < 2 ? "#555" : "#aaa", width: 22, flexShrink: 0 }}>{i + 1}.</span>
          <input
            value={opt.label}
            onChange={e => update(i, e.target.value)}
            placeholder={i < 2 ? `Value ${i + 1} (required)` : `Value ${i + 1} (optional)`}
            required={i < 2}
            style={{ flex: 1 }}
          />
          {i >= 2 && <span style={{ fontSize: 11, color: "#bbb", flexShrink: 0 }}>optional</span>}
        </div>
      ))}
      <p style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
        Weighted scores: Rank 1 = 5 pts, Rank 2 = 4 pts … Rank 5 = 1 pt.
      </p>
    </div>
  );
}

const SUBTYPES = ["numerical", "logical", "verbal", "spatial"];

// ── Create Question Modal ─────────────────────────────────────────────────────
function CreateQuestionModal({ test, onClose, onCreated, initialSection = "A" }) {
  const [section, setSection]         = useState(initialSection);
  const [question, setQuestion]       = useState("");
  const [imageUrl, setImageUrl]       = useState("");
  const [level, setLevel]             = useState("medium");
  const [order, setOrder]             = useState(0);
  const [options, setOptions]         = useState(getInitialOptions(initialSection));
  const [correctAnswerIds, setCorrect] = useState([]);
  const [subType, setSubType]         = useState("");
  const [mirrorGroupId, setMirrorGroupId] = useState("");
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");

  const cfg = SECTION_CONFIG[section];

  // Re-initialise options when section changes
  const handleSectionChange = (s) => {
    setSection(s);
    setOptions(getInitialOptions(s));
    setCorrect([]);
    setSubType("");
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (cfg.type === "ranking") {
      const filled = options.filter(o => o.label.trim()).length;
      if (filled < 2) { setError("At least 2 ranking values are required"); return; }
    } else if (cfg.type !== "text" && options.some(o => !o.label.trim())) {
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
        mirrorGroupId:    mirrorGroupId.trim() || null,
        // ranking: strip empty optional slots; text: no options
        options: cfg.type === "ranking"
          ? options.filter(o => o.label.trim())
          : cfg.type === "text" ? [] : options,
      };
      if (cfg.type === "mcq") {
        payload.level   = level;
        payload.subType = subType || null;
      }

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
                section === "D" ? "e.g. Rank these work values in order of importance to you…" :
                                  "e.g. Which career are you currently thinking about?"
              }
              required={section !== "E"}
            />
          </div>

          {/* Section-specific option editor */}
          <div style={{ marginBottom: 16 }}>
            {section === "A" && <TriadOptionEditor options={options} onChange={setOptions} />}
            {section === "B" && (
              <>
                <MCQOptionEditor
                  options={options}
                  correctAnswerIds={correctAnswerIds}
                  onChange={setOptions}
                  onCorrectChange={setCorrect}
                />
                <div className="form-group" style={{ marginTop: 12 }}>
                  <label>Aptitude Sub-Type <span style={{ fontSize: 11, color: "#cf1322" }}>*required for scoring</span></label>
                  <select value={subType} onChange={e => setSubType(e.target.value)} required>
                    <option value="">— select sub-type —</option>
                    {SUBTYPES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                  {!subType && (
                    <p style={{ fontSize: 12, color: "#cf1322", marginTop: 4 }}>⚠ Sub-type is required to compute aptitude percentiles in the report.</p>
                  )}
                </div>
              </>
            )}
            {section === "C" && <PairOptionEditor options={options} onChange={setOptions} />}
            {section === "D" && <RankingOptionEditor options={options} onChange={setOptions} />}
            {section === "E" && (
              <div style={{ padding: "12px 14px", background: "#f5f0ff", border: "1.5px dashed #c4b5fd", borderRadius: 8, fontSize: 13, color: "#6b21a8" }}>
                📝 <strong>No options needed.</strong> The student will type their answer in a free-text box.
                <div style={{ marginTop: 6, color: "#7c3aed", fontSize: 12 }}>
                  Examples: "Which career are you thinking about?" · "What profession do your parents prefer?"
                </div>
              </div>
            )}
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
              <label>Mirror Group ID <span style={{ fontSize: 11, color: "#888", fontWeight: 400 }}>(optional)</span></label>
              <input
                value={mirrorGroupId}
                onChange={e => setMirrorGroupId(e.target.value)}
                placeholder="e.g. riasec-R-1 · consistency-pair-3"
              />
            </div>
            <div className="form-group">
              <label>Image URL <span style={{ fontSize: 11, color: "#888", fontWeight: 400 }}>(optional)</span></label>
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

// ── Edit Question Modal ───────────────────────────────────────────────────────
function EditQuestionModal({ q, onClose, onSaved }) {
  const cfg = SECTION_CONFIG[q.section];

  const [question,        setQuestion]        = useState(q.question || "");
  const [imageUrl,        setImageUrl]        = useState(q.imageUrl || "");
  const [level,           setLevel]           = useState(q.level || "medium");
  const [order,           setOrder]           = useState(q.order ?? 0);
  const [options,         setOptions]         = useState(q.options?.length ? q.options : getInitialOptions(q.section));
  const [correctAnswerIds, setCorrect]        = useState(q.correctAnswerIds || []);
  const [subType,         setSubType]         = useState(q.subType || "");
  const [mirrorGroupId,   setMirrorGroupId]   = useState(q.mirrorGroupId || "");
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (cfg.type === "ranking") {
      if (options.filter(o => o.label.trim()).length < 2) { setError("At least 2 ranking values are required"); return; }
    } else if (cfg.type !== "text" && options.some(o => !o.label.trim())) {
      setError("All options must have a label"); return;
    }
    if (cfg.type === "mcq" && correctAnswerIds.length === 0) {
      setError("Select the correct answer"); return;
    }

    setLoading(true);
    try {
      const payload = {
        question:         question.trim(),
        imageUrl:         imageUrl || null,
        order:            Number(order),
        mirrorGroupId:    mirrorGroupId.trim() || null,
        options: cfg.type === "ranking"
          ? options.filter(o => o.label.trim())
          : cfg.type === "text" ? [] : options,
        correctAnswerIds: cfg.type === "mcq" ? correctAnswerIds : [],
      };
      if (cfg.type === "mcq") {
        payload.level   = level;
        payload.subType = subType || null;
      }
      await adminApi.updateQuestion(q.questionId, payload);
      onSaved();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const sb = SECTION_BADGE[q.section];

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 620 }}>
        <h3>Edit Question</h3>

        {/* Section badge (read-only) */}
        <div style={{ background: sb.bg, border: `1.5px solid ${sb.border}`, borderRadius: 8, padding: "8px 12px", marginBottom: 16, fontSize: 12, color: sb.color }}>
          <strong>{cfg.label}</strong> &nbsp;·&nbsp; {cfg.desc}
        </div>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Question / Prompt</label>
            <textarea
              value={question}
              onChange={e => setQuestion(e.target.value)}
              required={q.section !== "E"}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            {q.section === "A" && <TriadOptionEditor options={options} onChange={setOptions} />}
            {q.section === "B" && (
              <>
                <MCQOptionEditor
                  options={options}
                  correctAnswerIds={correctAnswerIds}
                  onChange={setOptions}
                  onCorrectChange={setCorrect}
                />
                <div className="form-group" style={{ marginTop: 12 }}>
                  <label>Aptitude Sub-Type <span style={{ fontSize: 11, color: "#cf1322" }}>*required for scoring</span></label>
                  <select value={subType} onChange={e => setSubType(e.target.value)} required>
                    <option value="">— select sub-type —</option>
                    {SUBTYPES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
              </>
            )}
            {q.section === "C" && <PairOptionEditor options={options} onChange={setOptions} />}
            {q.section === "D" && <RankingOptionEditor options={options} onChange={setOptions} />}
            {q.section === "E" && (
              <div style={{ padding: "12px 14px", background: "#f5f0ff", border: "1.5px dashed #c4b5fd", borderRadius: 8, fontSize: 13, color: "#6b21a8" }}>
                📝 <strong>No options needed.</strong> Student types a free-text answer.
              </div>
            )}
          </div>

          <div className="inline-row">
            <div className="form-group">
              <label>Order #</label>
              <input type="number" value={order} onChange={e => setOrder(e.target.value)} min="0" />
            </div>
            {q.section === "B" && (
              <div className="form-group">
                <label>Difficulty</label>
                <select value={level} onChange={e => setLevel(e.target.value)}>
                  {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            )}
            <div className="form-group">
              <label>Mirror Group ID <span style={{ fontSize: 11, color: "#888", fontWeight: 400 }}>(optional)</span></label>
              <input
                value={mirrorGroupId}
                onChange={e => setMirrorGroupId(e.target.value)}
                placeholder="e.g. riasec-R-1"
              />
            </div>
            <div className="form-group">
              <label>Image URL <span style={{ fontSize: 11, color: "#888", fontWeight: 400 }}>(optional)</span></label>
              <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://…" />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Section colours ───────────────────────────────────────────────────────────
const SECTION_BADGE = {
  A: { bg: "#fff3e0", color: "#e65100", border: "#ffcc80" },
  B: { bg: "#e8f5e9", color: "#2e7d32", border: "#a5d6a7" },
  C: { bg: "#e3f2fd", color: "#1565c0", border: "#90caf9" },
  D: { bg: "#fce4ec", color: "#880e4f", border: "#f48fb1" },
  E: { bg: "#f5f0ff", color: "#6b21a8", border: "#c4b5fd" },
};

// ── Question card (type-aware option display) ─────────────────────────────────
function QuestionCard({ q, idx, sec, toggling, onToggle, onEdit }) {
  const sb = SECTION_BADGE[sec];

  const renderOptions = () => {
    if (!q.options?.length) return null;
    if (q.type === "triad") {
      return (
        <div style={opt.triadGrid}>
          {q.options.map(o => (
            <div key={o.id} style={opt.triadItem}>
              <span style={{ ...opt.riasecBadge, background: sb.bg, color: sb.color, border: `1px solid ${sb.border}` }}>
                {o.riasecCode}
              </span>
              <span style={opt.optText}>{o.label}</span>
            </div>
          ))}
        </div>
      );
    }
    if (q.type === "mcq") {
      return (
        <div style={opt.optGrid}>
          {q.options.map(o => {
            const correct = (q.correctAnswerIds || []).includes(o.id);
            return (
              <div key={o.id} style={{ ...opt.mcqItem, ...(correct ? opt.mcqCorrect : {}) }}>
                {o.emoji && <span>{o.emoji}</span>}
                <span style={opt.optText}>{o.label}</span>
                {correct && <span style={opt.correctMark}>✓</span>}
              </div>
            );
          })}
        </div>
      );
    }
    if (q.type === "pair") {
      return (
        <div style={opt.pairRow}>
          {q.options.map((o, i) => (
            <div key={o.id} style={opt.pairItem}>
              <span style={opt.pairLetter}>{["A","B"][i]}</span>
              <div>
                <div style={opt.optText}>{o.label}</div>
                {o.trait && <div style={opt.traitLabel}>→ {o.trait}</div>}
              </div>
            </div>
          ))}
        </div>
      );
    }
    if (q.type === "ranking") {
      return (
        <div style={opt.rankList}>
          {q.options.map((o, i) => (
            <div key={o.id} style={opt.rankItem}>
              <span style={opt.rankNum}>{i + 1}</span>
              <span style={opt.optText}>{o.label}</span>
            </div>
          ))}
        </div>
      );
    }
    if (q.type === "text") {
      return (
        <div style={{ fontSize: 13, color: "#7c3aed", fontStyle: "italic", display: "flex", alignItems: "center", gap: 6 }}>
          <span>📝</span> <span>Student types a free-text answer</span>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ ...qcard.wrap, opacity: q.isActive ? 1 : 0.55 }}>
      <div style={qcard.header}>
        <span style={qcard.num}>#{q.order ?? idx + 1}</span>
        <p style={qcard.question}>{q.question}</p>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          {sec === "B" && q.level && (
            <span style={{ ...qcard.levelBadge }}>{q.level}</span>
          )}
          {sec === "B" && q.subType && (
            <span style={{ ...qcard.levelBadge, background: "#e8f5e9", color: "#2e7d32" }}>{q.subType}</span>
          )}
          {q.mirrorGroupId && (
            <span style={{ ...qcard.levelBadge, background: "#fff3e0", color: "#e65100" }} title={`Mirror group: ${q.mirrorGroupId}`}>🔗 mirror</span>
          )}
          <span style={{ ...qcard.statusDot, background: q.isActive ? "#16a34a" : "#d1d5db" }} title={q.isActive ? "Active" : "Inactive"} />
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => onEdit(q)}
          >
            Edit
          </button>
          <button
            className={`btn btn-sm ${q.isActive ? "btn-danger" : "btn-secondary"}`}
            onClick={() => onToggle(q)}
            disabled={toggling[q.questionId]}
          >
            {toggling[q.questionId] ? "…" : q.isActive ? "Deactivate" : "Activate"}
          </button>
        </div>
      </div>
      <div style={qcard.body}>{renderOptions()}</div>
    </div>
  );
}

// Card / option styles (plain objects — no CSS-in-JS library needed)
const qcard = {
  wrap:       { background: "#fff", border: "1px solid #e8e8f0", borderRadius: 12, marginBottom: 12, overflow: "hidden" },
  header:     { display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px", borderBottom: "1px solid #f2f2f7" },
  num:        { fontSize: 11, fontWeight: 700, color: "#aaa", flexShrink: 0, marginTop: 2 },
  question:   { flex: 1, fontSize: 14, fontWeight: 600, color: "#1a1a2e", lineHeight: 1.5, margin: 0 },
  body:       { padding: "12px 16px", background: "#fafafe" },
  statusDot:  { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
  levelBadge: { fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: "#f0f0f5", color: "#555" },
};
const opt = {
  optText:    { fontSize: 13, color: "#374151" },
  triadGrid:  { display: "flex", flexDirection: "column", gap: 6 },
  triadItem:  { display: "flex", alignItems: "center", gap: 8 },
  riasecBadge:{ fontSize: 11, fontWeight: 800, padding: "2px 7px", borderRadius: 6 },
  optGrid:    { display: "flex", flexWrap: "wrap", gap: 6 },
  mcqItem:    { display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 8, background: "#f0f0f5", fontSize: 13 },
  mcqCorrect: { background: "#dcfce7", outline: "1.5px solid #16a34a" },
  correctMark:{ color: "#16a34a", fontWeight: 800, fontSize: 12 },
  pairRow:    { display: "flex", gap: 12, flexWrap: "wrap" },
  pairItem:   { flex: 1, minWidth: 200, display: "flex", gap: 8, alignItems: "flex-start", padding: "8px 10px", background: "#f0f0f5", borderRadius: 8 },
  pairLetter: { fontSize: 13, fontWeight: 800, color: "#6c63ff", flexShrink: 0 },
  traitLabel: { fontSize: 11, color: "#6c63ff", fontWeight: 600, marginTop: 2 },
  rankList:   { display: "flex", flexWrap: "wrap", gap: 6 },
  rankItem:   { display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", background: "#f0f0f5", borderRadius: 8 },
  rankNum:    { fontSize: 12, fontWeight: 800, color: "#6c63ff", minWidth: 16 },
};

// ── Questions Page ────────────────────────────────────────────────────────────
export default function QuestionsPage({ admin, test, onBack, onLogout }) {
  const [questions, setQuestions]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [activeTab, setActiveTab]   = useState("A");
  const [toggling, setToggling]     = useState({});
  const [modalSection, setModalSection] = useState("A");

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

  const openModal = () => { setModalSection(activeTab); setShowModal(true); };

  const tabQs   = questions.filter(q => q.section === activeTab);
  const tabCfg  = SECTION_CONFIG[activeTab];
  const tabSb   = SECTION_BADGE[activeTab];

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

        {/* ── Section Tabs ─────────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 0, marginBottom: 0, background: "#fff", borderRadius: "12px 12px 0 0", border: "1px solid #e8e8f0", borderBottom: "none", overflow: "hidden" }}>
          {Object.entries(SECTION_CONFIG).map(([sec, cfg]) => {
            const count   = questions.filter(q => q.section === sec).length;
            const active  = sec === activeTab;
            const sb      = SECTION_BADGE[sec];
            return (
              <button
                key={sec}
                onClick={() => setActiveTab(sec)}
                style={{
                  flex: 1,
                  padding: "14px 8px 12px",
                  border: "none",
                  borderBottom: active ? `3px solid ${sb.color}` : "3px solid transparent",
                  background: active ? sb.bg : "#fff",
                  cursor: "pointer",
                  transition: "background 0.15s",
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: active ? sb.color : "#aaa", letterSpacing: 1, marginBottom: 2 }}>
                  SECTION {sec}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: active ? sb.color : "#555" }}>
                  {cfg.label.split("—")[1]?.trim().split(" (")[0]}
                </div>
                <div style={{
                  marginTop: 5,
                  display: "inline-block",
                  background: active ? sb.color : "#e8e8f0",
                  color: active ? "#fff" : "#888",
                  fontSize: 11, fontWeight: 700,
                  padding: "1px 8px", borderRadius: 20,
                }}>
                  {count} {count === 1 ? "question" : "questions"}
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Active Section Panel ─────────────────────────────────────────── */}
        <div style={{ background: "#fff", border: "1px solid #e8e8f0", borderTop: "none", borderRadius: "0 0 12px 12px", padding: 20, marginBottom: 20 }}>

          {/* Section meta bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#1a1a2e" }}>{tabCfg.label}</div>
                <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{tabCfg.desc}</div>
              </div>
            </div>
            <button className="btn btn-primary" onClick={openModal}>
              + Add to Section {activeTab}
            </button>
          </div>

          {/* Questions */}
          {loading ? (
            <div className="spinner">Loading…</div>
          ) : tabQs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 24px", border: "2px dashed #e0e0f0", borderRadius: 12, color: "#aaa" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>
                {activeTab === "A" ? "💡" : activeTab === "B" ? "🧠" : activeTab === "C" ? "🎭" : "⚖️"}
              </div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>No questions in Section {activeTab} yet</div>
              <div style={{ fontSize: 13 }}>{tabCfg.desc}</div>
              <button className="btn btn-primary" onClick={openModal} style={{ marginTop: 14 }}>
                Add first question →
              </button>
            </div>
          ) : (
            tabQs.map((q, i) => (
              <QuestionCard
                key={q.questionId}
                q={q}
                idx={i}
                sec={activeTab}
                toggling={toggling}
                onToggle={toggleActive}
                onEdit={setEditingQuestion}
              />
            ))
          )}
        </div>
      </div>

      {showModal && (
        <CreateQuestionModal
          test={test}
          initialSection={modalSection}
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); load(); }}
        />
      )}

      {editingQuestion && (
        <EditQuestionModal
          q={editingQuestion}
          onClose={() => setEditingQuestion(null)}
          onSaved={() => { setEditingQuestion(null); load(); }}
        />
      )}
    </div>
  );
}
