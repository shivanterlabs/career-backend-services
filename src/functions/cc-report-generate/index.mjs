import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "crypto";

// ── Clients ───────────────────────────────────────────────────────────────────

const dynamo = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION || "eu-west-1" }),
  { marshallOptions: { removeUndefinedValues: true } }
);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const TEST_SESSIONS_TABLE = process.env.TEST_SESSIONS_TABLE;
const QUESTIONS_TABLE     = process.env.QUESTIONS_TABLE;
const USERS_TABLE         = process.env.USERS_TABLE;
const REPORTS_TABLE       = process.env.REPORTS_TABLE;

// ── Career Database ───────────────────────────────────────────────────────────
// riasecWeights: importance of each RIASEC code for this career (sum = 1)
// aptitudeWeights: importance of each aptitude sub-type (sum = 1)
// personalityFit: Big5 dimension weights — O=Openness C=Conscientiousness E=Extraversion A=Agreeableness S=Stability
// topValues: work values that fit this career
// relevantSubjects: subjects from student's subjectRatings map
// stream: recommended educational stream

const CAREERS = [
  {
    id: "software-engineer",
    name: "Software Engineer",
    description: "Design and build the applications and systems that power modern technology",
    riasecWeights:   { R:0.1,  I:0.45, A:0.05, S:0.05, E:0.1,  C:0.25 },
    aptitudeWeights: { logical:0.45, numerical:0.3, verbal:0.15, spatial:0.1 },
    personalityFit:  { O:0.25, C:0.4,  E:0.1,  A:0.1,  S:0.15 },
    topValues:       ["Problem Solving","Continuous Learning","Financial Security","Independence","Innovation"],
    relevantSubjects:["maths","computer_science"],
    stream:          "Science",
    pathway:         "B.Tech (CS/IT) → Junior Developer → Senior Engineer → Tech Lead / Architect",
  },
  {
    id: "data-scientist",
    name: "Data Scientist",
    description: "Extract patterns from complex data to drive strategic decisions and products",
    riasecWeights:   { R:0.05, I:0.5,  A:0.05, S:0.05, E:0.1,  C:0.25 },
    aptitudeWeights: { numerical:0.45, logical:0.35, verbal:0.1, spatial:0.1 },
    personalityFit:  { O:0.3,  C:0.35, E:0.1,  A:0.1,  S:0.15 },
    topValues:       ["Problem Solving","Intellectual Stimulation","Continuous Learning","Independence"],
    relevantSubjects:["maths","computer_science"],
    stream:          "Science",
    pathway:         "B.Tech/B.Sc (Statistics/CS) → Data Analyst → Data Scientist → Lead DS",
  },
  {
    id: "doctor",
    name: "Doctor / Physician",
    description: "Diagnose and treat patients, combining deep science knowledge with compassionate care",
    riasecWeights:   { R:0.1,  I:0.35, A:0.05, S:0.35, E:0.05, C:0.1 },
    aptitudeWeights: { verbal:0.35, logical:0.3, numerical:0.25, spatial:0.1 },
    personalityFit:  { O:0.2,  C:0.3,  E:0.15, A:0.25, S:0.1 },
    topValues:       ["Helping Others","Social Impact","Intellectual Stimulation","Prestige","Financial Security"],
    relevantSubjects:["biology","chemistry","physics"],
    stream:          "Science",
    pathway:         "NEET → MBBS (5.5 yrs) → MD/MS Specialization → Practice / Research",
  },
  {
    id: "civil-engineer",
    name: "Civil Engineer",
    description: "Plan and oversee construction of the infrastructure that shapes cities and nations",
    riasecWeights:   { R:0.4,  I:0.3,  A:0.05, S:0.05, E:0.1,  C:0.1 },
    aptitudeWeights: { spatial:0.4, numerical:0.3, logical:0.2, verbal:0.1 },
    personalityFit:  { O:0.15, C:0.4,  E:0.15, A:0.15, S:0.15 },
    topValues:       ["Problem Solving","Visible Impact","Financial Security","Stability","Teamwork"],
    relevantSubjects:["maths","physics"],
    stream:          "Science",
    pathway:         "JEE → B.Tech (Civil) → Junior Engineer → Senior Engineer → Project Manager",
  },
  {
    id: "architect",
    name: "Architect",
    description: "Design beautiful, functional buildings and spaces that enrich human life",
    riasecWeights:   { R:0.2,  I:0.15, A:0.45, S:0.05, E:0.05, C:0.1 },
    aptitudeWeights: { spatial:0.5, logical:0.2, numerical:0.2, verbal:0.1 },
    personalityFit:  { O:0.45, C:0.25, E:0.1,  A:0.1,  S:0.1 },
    topValues:       ["Creativity","Aesthetic Expression","Visible Impact","Independence"],
    relevantSubjects:["maths","art"],
    stream:          "Science",
    pathway:         "NATA → B.Arch (5 yrs) → Junior Architect → Senior Architect → Own Practice",
  },
  {
    id: "biotechnologist",
    name: "Biotechnologist / Life Sciences Researcher",
    description: "Apply biology and technology to create medicines, food innovations and sustainable solutions",
    riasecWeights:   { R:0.15, I:0.55, A:0.05, S:0.1,  E:0.05, C:0.1 },
    aptitudeWeights: { logical:0.35, numerical:0.25, verbal:0.25, spatial:0.15 },
    personalityFit:  { O:0.35, C:0.35, E:0.1,  A:0.1,  S:0.1 },
    topValues:       ["Scientific Discovery","Social Impact","Intellectual Stimulation","Continuous Learning"],
    relevantSubjects:["biology","chemistry"],
    stream:          "Science",
    pathway:         "B.Sc Biotechnology → M.Sc → PhD or Pharma / AgriTech Industry",
  },
  {
    id: "psychologist",
    name: "Psychologist / Counsellor",
    description: "Understand human behaviour and support people through mental health challenges",
    riasecWeights:   { R:0.0,  I:0.3,  A:0.15, S:0.45, E:0.05, C:0.05 },
    aptitudeWeights: { verbal:0.5, logical:0.3, numerical:0.1, spatial:0.1 },
    personalityFit:  { O:0.25, C:0.2,  E:0.15, A:0.35, S:0.05 },
    topValues:       ["Helping Others","Social Impact","Intellectual Stimulation","Work-Life Balance"],
    relevantSubjects:["biology","english"],
    stream:          "Science",
    pathway:         "B.Sc Psychology → M.Sc / MA Psychology → RCI Registration → Practice / Research",
  },
  {
    id: "ux-designer",
    name: "UX / Product Designer",
    description: "Create intuitive and delightful digital experiences that millions of users rely on",
    riasecWeights:   { R:0.1,  I:0.2,  A:0.45, S:0.1,  E:0.05, C:0.1 },
    aptitudeWeights: { spatial:0.4, logical:0.3, verbal:0.2, numerical:0.1 },
    personalityFit:  { O:0.45, C:0.2,  E:0.15, A:0.15, S:0.05 },
    topValues:       ["Creativity","Innovation","User Impact","Continuous Learning"],
    relevantSubjects:["art","computer_science"],
    stream:          "Any",
    pathway:         "B.Des / B.Tech → UX Designer → Senior Designer → Design Lead / Head of Design",
  },
  {
    id: "chartered-accountant",
    name: "Chartered Accountant",
    description: "Manage finances, audits and tax strategy for businesses and high-net-worth individuals",
    riasecWeights:   { R:0.05, I:0.2,  A:0.0,  S:0.1,  E:0.3,  C:0.35 },
    aptitudeWeights: { numerical:0.5, logical:0.3, verbal:0.15, spatial:0.05 },
    personalityFit:  { O:0.1,  C:0.5,  E:0.15, A:0.1,  S:0.15 },
    topValues:       ["Financial Security","Prestige","Stability","Problem Solving","Independence"],
    relevantSubjects:["maths","accountancy","economics"],
    stream:          "Commerce",
    pathway:         "CA Foundation → CA Intermediate → CA Final → Big 4 / Own Practice",
  },
  {
    id: "financial-analyst",
    name: "Financial Analyst",
    description: "Analyse markets and financial data to guide high-stakes investment decisions",
    riasecWeights:   { R:0.0,  I:0.35, A:0.0,  S:0.05, E:0.3,  C:0.3 },
    aptitudeWeights: { numerical:0.5, logical:0.35, verbal:0.1, spatial:0.05 },
    personalityFit:  { O:0.2,  C:0.4,  E:0.2,  A:0.05, S:0.15 },
    topValues:       ["Financial Security","Intellectual Stimulation","High Performance","Independence"],
    relevantSubjects:["maths","economics","accountancy"],
    stream:          "Commerce",
    pathway:         "B.Com / BBA → MBA Finance / CFA → Analyst → Portfolio Manager / CFO",
  },
  {
    id: "marketing-manager",
    name: "Marketing Manager",
    description: "Build brands and craft campaigns that connect products with millions of customers",
    riasecWeights:   { R:0.0,  I:0.1,  A:0.2,  S:0.2,  E:0.45, C:0.05 },
    aptitudeWeights: { verbal:0.45, logical:0.25, numerical:0.2, spatial:0.1 },
    personalityFit:  { O:0.3,  C:0.2,  E:0.35, A:0.15, S:0.0 },
    topValues:       ["Creativity","Recognition","Social Impact","Financial Security","Teamwork"],
    relevantSubjects:["english","economics","business_studies"],
    stream:          "Commerce",
    pathway:         "BBA / B.Com → MBA Marketing → Brand Manager → CMO / Marketing Director",
  },
  {
    id: "entrepreneur",
    name: "Entrepreneur",
    description: "Build your own business from a bold idea and scale it into a lasting venture",
    riasecWeights:   { R:0.05, I:0.2,  A:0.1,  S:0.1,  E:0.5,  C:0.05 },
    aptitudeWeights: { logical:0.35, verbal:0.35, numerical:0.2, spatial:0.1 },
    personalityFit:  { O:0.35, C:0.25, E:0.3,  A:0.05, S:0.05 },
    topValues:       ["Independence","Innovation","Financial Security","Recognition","Impact"],
    relevantSubjects:["economics","business_studies","maths"],
    stream:          "Any",
    pathway:         "Any strong degree → Incubator / Self-started venture → Series A / Scale",
  },
  {
    id: "human-resources",
    name: "HR Manager",
    description: "Attract, develop and retain talent to build high-performing organisations",
    riasecWeights:   { R:0.0,  I:0.1,  A:0.1,  S:0.45, E:0.3,  C:0.05 },
    aptitudeWeights: { verbal:0.5, logical:0.25, numerical:0.15, spatial:0.1 },
    personalityFit:  { O:0.15, C:0.25, E:0.3,  A:0.3,  S:0.0 },
    topValues:       ["Helping Others","Teamwork","Stability","Financial Security","Recognition"],
    relevantSubjects:["english","economics"],
    stream:          "Commerce",
    pathway:         "BBA / BA Psychology → MBA HR → HR Executive → CHRO / HR Director",
  },
  {
    id: "lawyer",
    name: "Lawyer / Advocate",
    description: "Represent clients and uphold justice through deep knowledge of law and sharp argumentation",
    riasecWeights:   { R:0.0,  I:0.25, A:0.1,  S:0.3,  E:0.3,  C:0.05 },
    aptitudeWeights: { verbal:0.55, logical:0.35, numerical:0.05, spatial:0.05 },
    personalityFit:  { O:0.2,  C:0.25, E:0.3,  A:0.15, S:0.1 },
    topValues:       ["Justice","Prestige","Intellectual Stimulation","Social Impact","Financial Security"],
    relevantSubjects:["english","history","political_science"],
    stream:          "Arts",
    pathway:         "BA / B.Com → LLB (3 yr) or BA LLB integrated (5 yr) → Advocate → Senior Counsel / Judge",
  },
  {
    id: "journalist",
    name: "Journalist / Content Creator",
    description: "Research and tell stories that inform, inspire and hold power accountable",
    riasecWeights:   { R:0.0,  I:0.2,  A:0.35, S:0.25, E:0.15, C:0.05 },
    aptitudeWeights: { verbal:0.6, logical:0.25, numerical:0.1, spatial:0.05 },
    personalityFit:  { O:0.4,  C:0.15, E:0.25, A:0.15, S:0.05 },
    topValues:       ["Creativity","Social Impact","Independence","Recognition","Continuous Learning"],
    relevantSubjects:["english","history","political_science"],
    stream:          "Arts",
    pathway:         "BA (Journalism / Mass Comm / English) → Reporter → Senior Journalist → Editor / Anchor",
  },
  {
    id: "teacher",
    name: "Educator / Teacher",
    description: "Inspire the next generation through knowledge, mentoring and transformative teaching",
    riasecWeights:   { R:0.0,  I:0.2,  A:0.15, S:0.5,  E:0.1,  C:0.05 },
    aptitudeWeights: { verbal:0.5, logical:0.25, numerical:0.15, spatial:0.1 },
    personalityFit:  { O:0.2,  C:0.25, E:0.25, A:0.3,  S:0.0 },
    topValues:       ["Social Impact","Helping Others","Stability","Work-Life Balance","Recognition"],
    relevantSubjects:["english","maths","history"],
    stream:          "Any",
    pathway:         "BA / B.Sc → B.Ed → School Teacher → Principal or University Professor",
  },
  {
    id: "graphic-designer",
    name: "Graphic Designer",
    description: "Communicate ideas visually through logos, illustrations, branding and digital art",
    riasecWeights:   { R:0.1,  I:0.1,  A:0.55, S:0.1,  E:0.05, C:0.1 },
    aptitudeWeights: { spatial:0.5, verbal:0.2, logical:0.2, numerical:0.1 },
    personalityFit:  { O:0.5,  C:0.2,  E:0.1,  A:0.1,  S:0.1 },
    topValues:       ["Creativity","Independence","Aesthetic Expression","Recognition"],
    relevantSubjects:["art","computer_science"],
    stream:          "Any",
    pathway:         "B.Des (Graphic / Visual Comm) → Junior Designer → Senior Designer → Creative Director",
  },
  {
    id: "social-worker",
    name: "Social Worker / NGO Professional",
    description: "Advocate for vulnerable communities and drive meaningful systemic social change",
    riasecWeights:   { R:0.0,  I:0.1,  A:0.15, S:0.6,  E:0.1,  C:0.05 },
    aptitudeWeights: { verbal:0.5, logical:0.25, numerical:0.15, spatial:0.1 },
    personalityFit:  { O:0.2,  C:0.15, E:0.2,  A:0.45, S:0.0 },
    topValues:       ["Social Impact","Helping Others","Justice","Work-Life Balance"],
    relevantSubjects:["english","political_science"],
    stream:          "Arts",
    pathway:         "BSW (Bachelor of Social Work) → MSW → NGO / Government / International Organisations",
  },
  {
    id: "fashion-designer",
    name: "Fashion Designer",
    description: "Create clothing and accessories that express culture, personality and contemporary style",
    riasecWeights:   { R:0.1,  I:0.05, A:0.55, S:0.1,  E:0.15, C:0.05 },
    aptitudeWeights: { spatial:0.45, verbal:0.2, logical:0.15, numerical:0.2 },
    personalityFit:  { O:0.5,  C:0.2,  E:0.2,  A:0.05, S:0.05 },
    topValues:       ["Creativity","Aesthetic Expression","Recognition","Independence","Entrepreneurship"],
    relevantSubjects:["art"],
    stream:          "Any",
    pathway:         "NIFT / NID / B.Des (Fashion) → Assistant Designer → Head Designer → Own Label",
  },
  {
    id: "film-director",
    name: "Film Director / Creative Director",
    description: "Tell compelling stories through visual media and lead creative teams to artistic excellence",
    riasecWeights:   { R:0.05, I:0.1,  A:0.55, S:0.1,  E:0.15, C:0.05 },
    aptitudeWeights: { verbal:0.4, spatial:0.3, logical:0.2, numerical:0.1 },
    personalityFit:  { O:0.5,  C:0.15, E:0.25, A:0.05, S:0.05 },
    topValues:       ["Creativity","Recognition","Innovation","Independence","Aesthetic Expression"],
    relevantSubjects:["english","art"],
    stream:          "Any",
    pathway:         "FTII / SRFTI / Mass Comm → Assistant Director → Director → Production House",
  },
  {
    id: "pilot",
    name: "Commercial Pilot",
    description: "Fly aircraft and ensure safe travel for passengers across the globe",
    riasecWeights:   { R:0.45, I:0.2,  A:0.05, S:0.05, E:0.15, C:0.1 },
    aptitudeWeights: { spatial:0.4, numerical:0.3, logical:0.2, verbal:0.1 },
    personalityFit:  { O:0.15, C:0.4,  E:0.2,  A:0.1,  S:0.15 },
    topValues:       ["Adventure","Prestige","Financial Security","Stability","High Performance"],
    relevantSubjects:["maths","physics"],
    stream:          "Science",
    pathway:         "10+2 PCM → CPL (Commercial Pilot Licence) → Co-Pilot → Captain",
  },
  {
    id: "game-developer",
    name: "Game Developer",
    description: "Design and build interactive games and immersive digital experiences loved by millions",
    riasecWeights:   { R:0.15, I:0.35, A:0.3,  S:0.05, E:0.05, C:0.1 },
    aptitudeWeights: { logical:0.4, spatial:0.3, numerical:0.2, verbal:0.1 },
    personalityFit:  { O:0.4,  C:0.3,  E:0.1,  A:0.1,  S:0.1 },
    topValues:       ["Creativity","Innovation","Problem Solving","Continuous Learning"],
    relevantSubjects:["maths","computer_science"],
    stream:          "Science",
    pathway:         "B.Tech CS / BCA / B.Sc CS → Game Programmer → Lead Developer → Game Director",
  },
];

// ── Personality trait → Big5 dimension mapping ────────────────────────────────
const TRAIT_TO_BIG5 = {
  // Openness
  Openness:"O", Creativity:"O", Curiosity:"O", Artistic:"O", Imagination:"O", Innovation:"O",
  // Conscientiousness
  Conscientiousness:"C", Organization:"C", Discipline:"C", Responsibility:"C", Planning:"C", Structure:"C",
  // Extraversion
  Extraversion:"E", Sociability:"E", Leadership:"E", Enthusiasm:"E", Assertiveness:"E", Ambition:"E",
  // Agreeableness
  Agreeableness:"A", Empathy:"A", Cooperation:"A", Harmony:"A", Compassion:"A", Kindness:"A",
  // Stability (Neuroticism inverted)
  Stability:"S", Resilience:"S", Calm:"S", Equanimity:"S", Adaptability:"S", Patience:"S",
};

// ── Section A: RIASEC scoring ─────────────────────────────────────────────────
function scoreRiasec(questions, answers) {
  const scores = { R:0, I:0, A:0, S:0, E:0, C:0 };
  let answered = 0;
  for (const q of questions) {
    const ans = answers[q.questionId];
    if (!ans?.mostLiked) continue;
    answered++;
    for (const opt of (q.options || [])) {
      if (opt.id === ans.mostLiked)  scores[opt.riasecCode] = (scores[opt.riasecCode] ?? 0) + 1;
      else if (opt.id === ans.leastLiked) scores[opt.riasecCode] = (scores[opt.riasecCode] ?? 0) - 1;
    }
  }
  const ranked = Object.entries(scores).sort((a,b) => b[1]-a[1]).map(([code,score]) => ({ code, score }));
  return { scores, ranked, answered, total: questions.length };
}

// ── Section B: Aptitude scoring ───────────────────────────────────────────────
function ratioToPercentile(ratio) {
  if (ratio >= 0.95) return 98;
  if (ratio >= 0.80) return 85;
  if (ratio >= 0.65) return 70;
  if (ratio >= 0.50) return 55;
  if (ratio >= 0.35) return 40;
  if (ratio >= 0.20) return 25;
  return 10;
}

function scoreAptitude(questions, answers) {
  const stats = {};
  for (const q of questions) {
    const st = q.subType || "general";
    if (!stats[st]) stats[st] = { correct:0, total:0 };
    stats[st].total++;
    const ans = answers[q.questionId];
    const studentId = Array.isArray(ans) ? ans[0] : null;
    if (studentId && (q.correctAnswerIds || []).includes(studentId)) stats[st].correct++;
  }
  let totalQ = 0, totalC = 0;
  const subTypePercentiles = {};
  for (const [st, s] of Object.entries(stats)) {
    const ratio = s.total > 0 ? s.correct / s.total : 0;
    subTypePercentiles[st] = { correct:s.correct, total:s.total, ratio, percentile: ratioToPercentile(ratio) };
    totalQ += s.total;
    totalC += s.correct;
  }
  const overallRatio = totalQ > 0 ? totalC / totalQ : 0;
  return { subTypePercentiles, overallPercentile: ratioToPercentile(overallRatio), overallRatio };
}

// ── Section C: Personality scoring ───────────────────────────────────────────
function scorePersonality(questions, answers) {
  const traits = { O:0, C:0, E:0, A:0, S:0 };
  const traitCounts = {};
  let answered = 0;
  for (const q of questions) {
    const ans = answers[q.questionId];
    const selectedId = Array.isArray(ans) ? ans[0] : null;
    if (!selectedId) continue;
    answered++;
    const opt = (q.options || []).find(o => o.id === selectedId);
    if (!opt?.trait) continue;
    traitCounts[opt.trait] = (traitCounts[opt.trait] || 0) + 1;
    const dim = TRAIT_TO_BIG5[opt.trait];
    if (dim) traits[dim]++;
  }
  const profile = Object.entries(traits)
    .map(([dim, count]) => ({ dimension: dim, count, pct: answered > 0 ? Math.round(count/answered*100) : 0 }))
    .sort((a,b) => b.count - a.count);
  return { traits, traitCounts, profile, answered, total: questions.length };
}

// ── Section D: Work Values scoring ───────────────────────────────────────────
function scoreWorkValues(questions, answers) {
  const valueScores = {};
  for (const q of questions) {
    const ans = answers[q.questionId]; // ["optId1","optId2",...] ordered by preference
    if (!Array.isArray(ans)) continue;
    ans.forEach((optId, rank) => {
      const pts = 5 - rank; // rank 0 → 5pts, rank 4 → 1pt
      const opt = (q.options || []).find(o => o.id === optId);
      if (opt?.label) valueScores[opt.label] = (valueScores[opt.label] || 0) + pts;
    });
  }
  const ranked = Object.entries(valueScores).sort((a,b) => b[1]-a[1]).map(([value,score]) => ({ value, score }));
  return { valueScores, ranked, total: questions.length };
}

// ── Section E: Self-Declared ──────────────────────────────────────────────────
function extractSelfDeclared(questions, answers) {
  return questions
    .filter(q => answers[q.questionId])
    .map(q => ({ question: q.question, answer: String(answers[q.questionId]) }));
}

// ── Consistency flag ──────────────────────────────────────────────────────────
function computeConsistency(questions, answers) {
  const groups = {};
  for (const q of questions) {
    if (!q.mirrorGroupId) continue;
    if (!groups[q.mirrorGroupId]) groups[q.mirrorGroupId] = [];
    groups[q.mirrorGroupId].push(q);
  }
  let consistent = 0, total = 0;
  for (const qs of Object.values(groups)) {
    if (qs.length < 2) continue;
    for (let i = 0; i < qs.length - 1; i++) {
      for (let j = i + 1; j < qs.length; j++) {
        const q1 = qs[i], q2 = qs[j];
        const a1 = answers[q1.questionId], a2 = answers[q2.questionId];
        if (!a1 || !a2) continue;
        total++;
        let ok = false;
        if (q1.type === "triad" && q2.type === "triad") {
          const c1 = (q1.options || []).find(o => o.id === a1.mostLiked)?.riasecCode;
          const c2 = (q2.options || []).find(o => o.id === a2.mostLiked)?.riasecCode;
          ok = !!c1 && c1 === c2;
        } else if (q1.type === "pair" && q2.type === "pair") {
          const t1 = (q1.options || []).find(o => o.id === (Array.isArray(a1) ? a1[0] : null))?.trait;
          const t2 = (q2.options || []).find(o => o.id === (Array.isArray(a2) ? a2[0] : null))?.trait;
          const d1 = TRAIT_TO_BIG5[t1], d2 = TRAIT_TO_BIG5[t2];
          ok = !!d1 && d1 === d2;
        } else {
          ok = true; // MCQ mirror pairs: treat as consistent (less meaningful signal)
        }
        if (ok) consistent++;
      }
    }
  }
  const ratio = total > 0 ? consistent / total : 1;
  return {
    consistentPairs: consistent,
    totalPairs:      total,
    ratio,
    reliabilityLevel: ratio >= 0.70 ? "gold" : ratio >= 0.50 ? "silver" : "caution",
    flagged: ratio < 0.50,
  };
}

// ── Speed risk flag ───────────────────────────────────────────────────────────
const SECTION_MIN_AVG_TIME = { A:4, B:5, C:3, D:8, E:2 };

function computeSpeedRisk(questions, timings) {
  const sectionTimes = { A:[], B:[], C:[], D:[], E:[] };
  for (const q of questions) {
    const sec = q.section, t = timings?.[q.questionId];
    if (sec && t != null) sectionTimes[sec].push(Number(t));
  }
  let speedRisk = false;
  const details = {};
  for (const [sec, times] of Object.entries(sectionTimes)) {
    if (!times.length) continue;
    const avg = times.reduce((s,t) => s+t, 0) / times.length;
    const min = SECTION_MIN_AVG_TIME[sec] ?? 3;
    const risky = avg < min;
    details[sec] = { avg: Math.round(avg * 10) / 10, min, risky };
    if (risky) speedRisk = true;
  }
  return { speedRisk, sectionDetails: details };
}

// ── Career matching ───────────────────────────────────────────────────────────
function normalizeRiasec(scores) {
  const vals = Object.values(scores);
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const out = {};
  for (const [code, v] of Object.entries(scores)) out[code] = (v - min) / range;
  return out;
}

function matchCareers(riasecResult, aptitudeResult, personalityResult, workValuesResult, userProfile) {
  const normRiasec = normalizeRiasec(riasecResult.scores);
  const totalTraits = Object.values(personalityResult.traits).reduce((s,v) => s+v, 0) || 1;
  const studentTop5Values = workValuesResult.ranked.slice(0, 5).map(v => v.value.toLowerCase());

  const results = [];
  for (const career of CAREERS) {
    // RIASEC match (40%)
    let riasecScore = 0;
    for (const [code, w] of Object.entries(career.riasecWeights)) riasecScore += (normRiasec[code] ?? 0) * w;

    // Aptitude match (25%)
    let aptScore = 0, aptWeightSum = 0;
    for (const [st, w] of Object.entries(career.aptitudeWeights)) {
      const pct = aptitudeResult.subTypePercentiles[st]?.percentile ?? 55;
      aptScore += (pct / 100) * w;
      aptWeightSum += w;
    }
    if (aptWeightSum > 0) aptScore /= aptWeightSum;

    // Personality match (20%)
    let persScore = 0, persWeightSum = 0;
    for (const [dim, w] of Object.entries(career.personalityFit)) {
      const ratio = (personalityResult.traits[dim] || 0) / totalTraits;
      persScore += ratio * w;
      persWeightSum += w;
    }
    if (persWeightSum > 0) persScore /= persWeightSum;

    // Values match (15%)
    const matchedValues = career.topValues.filter(v => studentTop5Values.includes(v.toLowerCase()));
    const valScore = matchedValues.length / Math.max(career.topValues.length, 1);

    // Subject bonus (5%)
    let subjBonus = 0.5; // default neutral
    const ratings = userProfile.subjectRatings || {};
    const relSubjs = career.relevantSubjects.filter(s => ratings[s] != null);
    if (relSubjs.length > 0) {
      const avgRating = relSubjs.reduce((s,sub) => s + (ratings[sub] || 2), 0) / relSubjs.length;
      subjBonus = (avgRating - 1) / 3; // 1-4 → 0-1
    }

    const finalScore = (riasecScore * 0.40) + (aptScore * 0.25) + (persScore * 0.20) + (valScore * 0.15) + (subjBonus * 0.05);

    results.push({
      id:         career.id,
      career:     career.name,
      matchScore: Math.round(finalScore * 100),
      pathway:    career.pathway,
      stream:     career.stream,
      description: career.description, // will be enriched by Claude narrative
      scores: { riasec: Math.round(riasecScore*100), aptitude: Math.round(aptScore*100), personality: Math.round(persScore*100), values: Math.round(valScore*100) },
    });
  }

  return results.sort((a,b) => b.matchScore - a.matchScore);
}

// ── Recommend stream ──────────────────────────────────────────────────────────
function recommendStream(careerMatches, userProfile) {
  // Count by stream in top 5
  const streamCount = {};
  for (const c of careerMatches.slice(0, 5)) {
    if (c.stream && c.stream !== "Any") streamCount[c.stream] = (streamCount[c.stream] || 0) + 1;
  }
  const sorted = Object.entries(streamCount).sort((a,b) => b[1]-a[1]);
  if (sorted.length > 0) return sorted[0][0];
  return userProfile.stream || "Science";
}

// ── Claude AI narrative generation ────────────────────────────────────────────
async function generateNarrative(userProfile, scoring, careerMatches, selfDeclared) {
  const { riasec, aptitude, personality, workValues, consistency, speedRisk } = scoring;

  const top5Careers  = careerMatches.slice(0, 5).map(c => c.career).join(", ");
  const top3Riasec   = riasec.ranked.slice(0, 3).map(r => r.code).join(", ");
  const top3BigFive  = personality.profile.slice(0, 3).map(p => p.dimension).join(", ");
  const top3Values   = workValues.ranked.slice(0, 3).map(v => v.value).join(", ");

  const subjectSummary = Object.entries(userProfile.subjectRatings || {})
    .map(([s, r]) => `${s}: ${["struggles","OK","good","loves"][r-1] ?? r}`)
    .join(", ");

  const selfDeclaredText = selfDeclared.length > 0
    ? selfDeclared.map(sd => `Q: ${sd.question} → A: ${sd.answer}`).join("; ")
    : "Not provided";

  const aptSummary = Object.entries(aptitude.subTypePercentiles)
    .map(([st, d]) => `${st} ${d.percentile}th%ile`)
    .join(", ");

  const prompt = `You are a career counsellor for Indian students aged 13-18. Analyse this student's psychometric results and write a personalised career report.

STUDENT PROFILE:
- Name: ${userProfile.firstName || "Student"}, Class: ${userProfile.studentClass}, Stream: ${userProfile.stream || "Not decided"}
- City: ${userProfile.city || "India"}, State: ${userProfile.state || ""}

TEST RESULTS:
- RIASEC (interests): Top codes ${top3Riasec} — full: ${JSON.stringify(riasec.scores)}
- Aptitude: ${aptSummary} (overall ${aptitude.overallPercentile}th percentile)
- Personality (Big Five): Top dimensions ${top3BigFive} — ${JSON.stringify(personality.traits)}
- Work values: ${top3Values}
- Subject feelings: ${subjectSummary || "Not available"}
- Self-declared aspirations: ${selfDeclaredText}
- Test reliability: ${consistency.reliabilityLevel} (${Math.round(consistency.ratio*100)}% consistent)
- Speed behaviour: ${speedRisk.speedRisk ? "Some sections answered quickly — may indicate intuitive decision style" : "Thoughtful pace throughout"}

TOP CAREER MATCHES: ${top5Careers}

Generate a JSON response with EXACTLY these fields (no extra text, valid JSON only):
{
  "personalitySummary": "2-3 sentences describing this student's unique personality and learning style. Be specific and encouraging.",
  "strengthsSummary": "2-3 sentences highlighting their key strengths based on RIASEC interests and aptitude scores. Name specific abilities.",
  "behaviourNarrative": "1-2 sentences about their decision-making and study style based on timing and consistency data.",
  "workValuesNarrative": "1 sentence summarising what motivates and drives this student at work.",
  "streamJustification": "1 sentence explaining why the recommended stream suits this student specifically.",
  "careerDescriptions": {
    "${careerMatches[0]?.id}": "2 sentences on why this specific student would thrive in this career.",
    "${careerMatches[1]?.id}": "2 sentences on why this specific student would thrive in this career.",
    "${careerMatches[2]?.id}": "2 sentences on why this specific student would thrive in this career.",
    "${careerMatches[3]?.id}": "2 sentences on why this specific student would thrive in this career.",
    "${careerMatches[4]?.id}": "2 sentences on why this specific student would thrive in this career."
  },
  "subjectInsights": {
    ${Object.keys(userProfile.subjectRatings || {}).slice(0,6).map(s => `"${s}": "1 sentence advice for this subject"`).join(",\n    ")}
  },
  "roadmap": [
    { "milestone": "Short title", "description": "1-2 sentence action", "timeframe": "e.g. Next 6 months" },
    { "milestone": "Short title", "description": "1-2 sentence action", "timeframe": "e.g. Class 11-12" },
    { "milestone": "Short title", "description": "1-2 sentence action", "timeframe": "e.g. After Class 12" },
    { "milestone": "Short title", "description": "1-2 sentence action", "timeframe": "e.g. College Years" },
    { "milestone": "Short title", "description": "1-2 sentence action", "timeframe": "e.g. First Job" }
  ],
  "selfDeclaredAlignmentNote": "1 sentence on how the student's declared aspirations align (or diverge) from their test results."
}`;

  const msg = await anthropic.messages.create({
    model:      "claude-sonnet-4-6",
    max_tokens: 1800,
    messages:   [{ role: "user", content: prompt }],
  });

  const raw = msg.content[0].text.trim();
  // Strip markdown code fences if present
  const jsonStr = raw.startsWith("```") ? raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "") : raw;
  return JSON.parse(jsonStr);
}

// ── Handler ───────────────────────────────────────────────────────────────────
export const handler = async (event) => {
  console.log("Report generate event:", JSON.stringify(event));

  const { sessionId, userId } = event;
  if (!sessionId || !userId) {
    console.error("Missing sessionId or userId in event");
    return;
  }

  try {
    // ── 1. Fetch session ─────────────────────────────────────────────────────
    const sessionRes = await dynamo.send(new GetCommand({ TableName: TEST_SESSIONS_TABLE, Key: { sessionId } }));
    if (!sessionRes.Item) { console.error("Session not found:", sessionId); return; }
    const session = sessionRes.Item;

    // ── 2. Fetch user ────────────────────────────────────────────────────────
    const userRes = await dynamo.send(new GetCommand({ TableName: USERS_TABLE, Key: { userId } }));
    if (!userRes.Item) { console.error("User not found:", userId); return; }
    const user = userRes.Item;

    // ── 3. Fetch all questions for this testId ───────────────────────────────
    const questionsRes = await dynamo.send(
      new QueryCommand({
        TableName:                 QUESTIONS_TABLE,
        IndexName:                 "testId-index",
        KeyConditionExpression:    "#testId = :testId",
        ExpressionAttributeNames:  { "#testId": "testId" },
        ExpressionAttributeValues: { ":testId": session.testId },
      })
    );
    const allQuestions = questionsRes.Items || [];
    const answers      = session.answers  || {};
    const timings      = session.timings  || {};

    // Split by section
    const bySection = (sec) => allQuestions.filter(q => q.section === sec);

    // ── 4. Score each section ────────────────────────────────────────────────
    const riasec       = scoreRiasec(bySection("A"), answers);
    const aptitude     = scoreAptitude(bySection("B"), answers);
    const personality  = scorePersonality(bySection("C"), answers);
    const workValues   = scoreWorkValues(bySection("D"), answers);
    const selfDeclared = extractSelfDeclared(bySection("E"), answers);

    // ── 5. Reliability flags ─────────────────────────────────────────────────
    const consistency  = computeConsistency(allQuestions, answers);
    const speedRisk    = computeSpeedRisk(allQuestions, timings);

    const scoring = { riasec, aptitude, personality, workValues, consistency, speedRisk };

    // ── 6. Match careers ─────────────────────────────────────────────────────
    const careerMatches   = matchCareers(riasec, aptitude, personality, workValues, user);
    const streamRec       = recommendStream(careerMatches, user);

    // ── 7. Claude AI narrative ───────────────────────────────────────────────
    let narrative;
    try {
      narrative = await generateNarrative(user, scoring, careerMatches, selfDeclared);
    } catch (aiErr) {
      console.error("Claude API error (non-fatal):", aiErr.message);
      narrative = {
        personalitySummary:      "Based on your test results, you show a unique blend of interests and abilities.",
        strengthsSummary:        "Your profile indicates strong potential in areas aligned with your top career matches.",
        behaviourNarrative:      "Your response patterns suggest a thoughtful approach to decision-making.",
        workValuesNarrative:     "You are motivated by a combination of personal growth and meaningful impact.",
        streamJustification:     `The ${streamRec} stream aligns well with your interests and aptitude scores.`,
        careerDescriptions:      {},
        subjectInsights:         {},
        roadmap:                 [],
        selfDeclaredAlignmentNote: "Your aspirations show clear direction — continue exploring these interests.",
      };
    }

    // ── 8. Build full report ─────────────────────────────────────────────────
    const top10Careers = careerMatches.slice(0, 10).map((c, i) => ({
      rank:        i + 1,
      id:          c.id,
      career:      c.career,
      matchScore:  c.matchScore,
      description: narrative.careerDescriptions?.[c.id] || c.description,
      pathway:     c.pathway,
      stream:      c.stream,
      scores:      c.scores,
    }));

    const now      = new Date().toISOString();
    const reportId = randomUUID();

    const reportItem = {
      reportId,
      userId,
      sessionId,
      isPartial: false,

      // Partial teaser (shown before payment)
      partialReport: {
        topCareers:         top10Careers.slice(0, 2).map(c => ({ rank: c.rank, career: c.career, matchScore: c.matchScore })),
        personalitySummary: narrative.personalitySummary?.split(".")[0] + ".",
      },

      // Full report
      careerMatches:        top10Careers,
      personalityProfile: {
        riasec: {
          scores: riasec.scores,
          ranked: riasec.ranked,
        },
        bigFive: {
          traits:  personality.traits,
          profile: personality.profile,
        },
        summary: narrative.personalitySummary,
      },
      streamRecommendation: streamRec,
      strengthsSummary:     narrative.strengthsSummary,
      behaviourInsights: {
        consistency: {
          reliabilityLevel: consistency.reliabilityLevel,
          ratio:            Math.round(consistency.ratio * 100),
        },
        speedRisk: speedRisk.speedRisk,
        sections:  speedRisk.sectionDetails,
        narrative: narrative.behaviourNarrative,
      },
      workValuesProfile: {
        ranked:    workValues.ranked.slice(0, 8),
        narrative: narrative.workValuesNarrative,
      },
      subjectInsights:      narrative.subjectInsights || {},
      selfDeclared: {
        responses:     selfDeclared,
        alignmentNote: narrative.selfDeclaredAlignmentNote,
      },
      streamJustification: narrative.streamJustification,
      roadmap:             narrative.roadmap || [],
      aptitudeSummary: {
        overallPercentile: aptitude.overallPercentile,
        bySubType:         aptitude.subTypePercentiles,
      },
      pdfUrl:        null, // generated separately on demand
      generatedAt:   now,
      modelVersion:  "claude-sonnet-4-6",
    };

    // ── 9. Store report ──────────────────────────────────────────────────────
    await dynamo.send(new PutCommand({ TableName: REPORTS_TABLE, Item: reportItem }));
    console.log("Report stored:", reportId);

    // ── 10. Mark user reportReady ────────────────────────────────────────────
    await dynamo.send(
      new UpdateCommand({
        TableName:                 USERS_TABLE,
        Key:                       { userId },
        UpdateExpression:          "SET reportReady = :true, updatedAt = :now",
        ExpressionAttributeValues: { ":true": true, ":now": now },
      })
    );

    console.log("Report generation complete for userId:", userId, "reportId:", reportId);
  } catch (err) {
    console.error("Report generation failed:", err);
  }
};
