/**
 * One-time enrichment script — adds salary_ranges, approximate_fees,
 * scholarships_navigation, education_loans to each sector in career_details.json
 * Run: node scripts/enrich-career-json.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = join(__dirname, '..', 'career_details.json');

const data = JSON.parse(readFileSync(filePath, 'utf8'));

// ─── Shared across all sectors ────────────────────────────────────────────────

const STATE_PORTALS = {
  "Maharashtra":    "mahascholarship.gov.in",
  "Uttar Pradesh":  "scholarship.up.gov.in",
  "Karnataka":      "sevasindhu.karnataka.gov.in",
  "Tamil Nadu":     "tnscholarships.gov.in",
  "West Bengal":    "svmcm.wbhed.gov.in",
  "Rajasthan":      "sje.rajasthan.gov.in",
  "Madhya Pradesh": "scholarshipportal.mp.nic.in",
  "Gujarat":        "digitalgujarat.gov.in",
  "Andhra Pradesh": "apepass.apcfss.in",
  "Telangana":      "telanganaepass.cgg.gov.in",
  "Bihar":          "pmsonline.bih.nic.in",
  "Punjab":         "scholarships.punjab.gov.in",
  "Haryana":        "haryana.gov.in/scholarships",
  "Delhi":          "edistrict.delhigovt.nic.in",
  "Kerala":         "dcescholarships.kerala.gov.in"
};

const COMMON_NATIONAL_SCHEMES = [
  {
    name: "Central Sector Scheme of Scholarships",
    eligibility: "Top 20 percentile in Class 12 board exam, family income < ₹8L/year",
    amount: "₹12,000/year (day scholars), ₹20,000/year (hostellers)",
    apply_at: "scholarships.gov.in (NSP)"
  },
  {
    name: "Post-Matric Scholarship for SC Students",
    eligibility: "SC category, family income < ₹2.5L/year",
    amount: "Tuition fees + maintenance allowance (varies by state)",
    apply_at: "scholarships.gov.in (NSP)"
  },
  {
    name: "Post-Matric Scholarship for ST Students",
    eligibility: "ST category, any income limit",
    amount: "Tuition fees + maintenance allowance",
    apply_at: "scholarships.gov.in (NSP)"
  },
  {
    name: "Post-Matric Scholarship for OBC Students",
    eligibility: "OBC category, family income < ₹1L/year (central), varies by state",
    amount: "Maintenance allowance + fee reimbursement",
    apply_at: "scholarships.gov.in (NSP)"
  },
  {
    name: "Begum Hazrat Mahal National Scholarship (Minority Girls)",
    eligibility: "Muslim/Christian/Sikh/Buddhist/Parsi/Jain girls, class 9-12, income < ₹2L/year",
    amount: "₹5,000-₹6,000/year",
    apply_at: "minorityaffairs.gov.in"
  },
  {
    name: "PM Scholarship Scheme (CAPF/RPF Wards)",
    eligibility: "Wards of Central Armed Police Forces / RPF personnel",
    amount: "₹2,500-₹3,000/month",
    apply_at: "ksb.gov.in"
  }
];

const COMMON_EDUCATION_LOAN = {
  central_portal: "vidyalakshmi.co.in (compare all bank education loans in one place)",
  without_collateral_limit: "Up to ₹7.5 lakhs — no collateral required",
  interest_subsidy_scheme: {
    name: "CSIS (Central Scheme to provide Interest Subsidy)",
    eligibility: "EWS students (family income < ₹4.5L/year), studying in approved institutions",
    benefit: "100% interest subsidy during moratorium period (course + 1 year)",
    apply_at: "canara bank or SBI branch with CSIS form"
  },
  moratorium_period: "Course duration + 6 months to 1 year (no EMI during study)",
  tax_benefit: "Interest paid is deductible under Section 80E — no upper limit",
  key_lenders: [
    { name: "SBI Student Loan / SBI Scholar Loan", note: "Lowest interest rate for IIT/NIT/IIIT admissions (~8.5%)" },
    { name: "Vidya Lakshmi Portal (14+ banks)", note: "Apply to multiple banks via single form" },
    { name: "HDFC Credila", note: "Private lender, faster processing, up to ₹75L" },
    { name: "Avanse Financial Services", note: "Flexible repayment, no collateral up to ₹10L" },
    { name: "Axis Bank Education Loan", note: "Up to ₹75L with collateral" }
  ]
};

// ─── Per-sector enrichment data ───────────────────────────────────────────────

const ENRICHMENT = {

  ENG: {
    salary_ranges: {
      entry_level: {
        range: "₹3.5L–8L/year (tier-2 colleges) | ₹8L–20L/year (IIT/NIT/IIIT)",
        years: "0–3 years experience"
      },
      mid_level: {
        range: "₹15L–35L/year",
        years: "4–8 years experience"
      },
      senior_level: {
        range: "₹35L–80L+/year | Top companies (FAANG): ₹40L–2Cr+",
        years: "8+ years experience"
      },
      notes: "Salary varies hugely by company type. Startups may offer ESOPs. Government PSU engineers earn ₹50K–1.2L/month with job security."
    },
    approximate_fees: {
      iit_nit: "₹80K–2L/year (government subsidized)",
      state_govt_engineering: "₹20K–80K/year",
      private_approved: "₹1.2L–3L/year",
      deemed_private: "₹3L–8L/year",
      polytechnic_diploma: "₹10K–50K/year (govt) | ₹40K–1.2L/year (private)",
      notes: "IIT fee waiver: family income < ₹1L/year — fully free. < ₹5L/year — 2/3 fee waiver."
    },
    scholarships_navigation: {
      national_portal: "scholarships.gov.in",
      filter_tip: "Filter: State → Category (SC/ST/OBC/EWS/Minority) → Post-Matric → Engineering/Technical",
      sector_specific_schemes: [
        {
          name: "AICTE Pragati Scholarship (Girls in Technical Education)",
          eligibility: "Female students in AICTE-approved institutions, family income < ₹8L/year",
          amount: "₹50,000/year + ₹2,000 contingency (max 2 per family)",
          apply_at: "aicte-india.org/pragati"
        },
        {
          name: "AICTE Saksham Scholarship (Differently-abled)",
          eligibility: "Students with 40%+ disability in AICTE-approved institutions",
          amount: "₹50,000/year",
          apply_at: "aicte-india.org/saksham"
        },
        {
          name: "IIT Fee Waiver (Merit-cum-Means)",
          eligibility: "Admitted to IIT via JEE Advanced, family income < ₹5L/year",
          amount: "Full to partial fee waiver + ₹1,000/month stipend",
          apply_at: "Apply through respective IIT after admission"
        },
        {
          name: "IOCL, HPCL, BPCL Engineering Scholarships",
          eligibility: "Class 12 (PCM) with 60%+, family income < ₹1L/year (varies by PSU)",
          amount: "₹2,000–4,000/month for 4 years",
          apply_at: "Respective PSU websites — usually opens July-August"
        }
      ],
      key_national_schemes: COMMON_NATIONAL_SCHEMES,
      state_portals: STATE_PORTALS
    },
    education_loans: {
      ...COMMON_EDUCATION_LOAN,
      typical_loan_amount: "₹4L–20L for private colleges | ₹1L–5L for govt colleges (lower fees)",
      with_collateral_limit: "Up to ₹1.5Cr for top private/international institutions",
      special_note: "IIT/NIT admissions: SBI Scholar Loan at ~8.5% — best rate available. Most banks waive collateral for IIT/NIT/IIIT/BITS admissions."
    }
  },

  MED: {
    salary_ranges: {
      internship_house_surgeon: {
        range: "₹20K–45K/month stipend (varies by state/institution)",
        years: "Final year / 1 year post-MBBS"
      },
      junior_doctor_govt: {
        range: "₹60K–1L/month",
        years: "0–5 years, government hospital"
      },
      specialist_consultant: {
        range: "₹1.5L–5L/month (govt) | ₹3L–15L+/month (private)",
        years: "After MD/MS — 8–12 years total training"
      },
      senior_doctor_own_clinic: {
        range: "₹3L–20L+/month depending on speciality and location",
        years: "15+ years with established practice"
      },
      notes: "MBBS + MD/MS takes 8–9 years. High earning potential but delayed — serious long-term investment. Government doctors get pension + job security."
    },
    approximate_fees: {
      govt_mbbs: "₹10K–50K/year (state govt medical colleges)",
      aiims_jipmer: "Under ₹5,000/year (almost fully subsidized)",
      private_mbbs_india: "₹10L–25L/year (₹50L–1.25Cr total for 5.5 years)",
      deemed_medical: "₹12L–20L/year",
      bams_bhms_bums_govt: "₹10K–40K/year",
      bams_bhms_private: "₹1L–3L/year",
      notes: "Private MBBS in India is very expensive. Some students go to Russia, Ukraine, Bangladesh, Philippines — ₹25L–40L total but Indian recognition requires MCI screening test (FMGE/NExT)."
    },
    scholarships_navigation: {
      national_portal: "scholarships.gov.in",
      filter_tip: "Filter: State → Category → Post-Matric → Medical/Professional",
      sector_specific_schemes: [
        {
          name: "AIIMS Merit Scholarship",
          eligibility: "AIIMS students based on academic merit and financial need",
          amount: "Up to ₹1L/year",
          apply_at: "Apply through AIIMS academic section after admission"
        },
        {
          name: "MCI (NMC) Scholarship for MBBS Students",
          eligibility: "Merit-based, varies by state medical council",
          amount: "Varies",
          apply_at: "State Medical Council or NMC — nmc.org.in"
        },
        {
          name: "Rotary / Lions Club Medical Scholarships",
          eligibility: "NEET-qualified students from economically weaker families",
          amount: "₹25K–2L/year (varies by chapter)",
          apply_at: "Local Rotary/Lions Club or rotaryindia.org"
        },
        {
          name: "State-Level Medical Merit Scholarships",
          eligibility: "NEET rank-based in respective state",
          amount: "Varies by state — check DME (Directorate of Medical Education) website",
          apply_at: "State DME portal — search '[State name] DME scholarship'"
        }
      ],
      key_national_schemes: COMMON_NATIONAL_SCHEMES,
      state_portals: STATE_PORTALS
    },
    education_loans: {
      ...COMMON_EDUCATION_LOAN,
      typical_loan_amount: "₹10L–50L (private MBBS India) | ₹15L–50L (MBBS abroad)",
      with_collateral_limit: "Up to ₹1.5Cr for private medical colleges",
      special_note: "Private MBBS loans are among the highest education loans in India. Compare carefully — interest during 5.5 years study + 1 year internship adds significantly. CSIS subsidy helps EWS students greatly here."
    }
  },

  PARA: {
    salary_ranges: {
      entry_level: {
        range: "₹15K–30K/month (government) | ₹12K–22K/month (private hospital)",
        years: "0–3 years"
      },
      mid_level: {
        range: "₹30K–60K/month",
        years: "4–8 years, specialized roles"
      },
      senior_level: {
        range: "₹60K–1.5L/month (senior lab manager, radiologist technician, etc.)",
        years: "8+ years with specialization"
      },
      international: {
        range: "USD 3,000–6,000/month (Middle East, UK, Canada — high demand)",
        note: "Paramedical professionals are among highest-hired healthcare workers abroad"
      },
      notes: "Government jobs (AIIMS, ESIC, Railways) offer ₹35K–70K/month with 7th Pay Commission benefits + pension. Private hospitals in metros pay better than smaller cities."
    },
    approximate_fees: {
      govt_college: "₹10K–40K/year",
      private_college: "₹50K–2L/year",
      diploma_after_10th: "₹8K–30K/year (govt) | ₹30K–80K/year (private)",
      notes: "BMLT, BRIT, BOT, BPT are popular — available widely at govt colleges at low cost."
    },
    scholarships_navigation: {
      national_portal: "scholarships.gov.in",
      filter_tip: "Filter: State → Category → Post-Matric → Paramedical/Allied Health",
      sector_specific_schemes: [
        {
          name: "AICTE Pragati Scholarship (if AICTE-approved institution)",
          eligibility: "Female students in approved paramedical institutions, income < ₹8L/year",
          amount: "₹30,000–50,000/year",
          apply_at: "aicte-india.org"
        },
        {
          name: "ESIC Education Scholarship",
          eligibility: "Children of ESIC insured persons",
          amount: "₹2,000–5,000/month",
          apply_at: "esic.in"
        },
        {
          name: "State Allied Health Scholarships",
          eligibility: "Varies by state — check state Health Department",
          amount: "Varies",
          apply_at: "State Health Department / Medical Education portal"
        }
      ],
      key_national_schemes: COMMON_NATIONAL_SCHEMES,
      state_portals: STATE_PORTALS
    },
    education_loans: {
      ...COMMON_EDUCATION_LOAN,
      typical_loan_amount: "₹2L–8L (most paramedical courses are affordable)",
      with_collateral_limit: "Up to ₹20L",
      special_note: "Most paramedical courses are affordable enough that loans are small. Government college + scholarship often covers most costs."
    }
  },

  SCI: {
    salary_ranges: {
      research_fellowship: {
        range: "JRF: ₹31,000/month + HRA | SRF: ₹35,000/month + HRA (govt-funded)",
        years: "During PhD (4–6 years)"
      },
      scientist_govt: {
        range: "Scientist B: ₹56K–1.32L/month | Scientist G: ₹1.44L–2.18L/month (ISRO/DRDO/ICAR/CSIR)",
        years: "Entry to senior government scientist"
      },
      academic_faculty: {
        range: "Assistant Professor: ₹57,700–1.82L/month (UGC 7th CPC) | Professor: ₹1.44L–2.18L/month",
        years: "After PhD + post-doc"
      },
      industry_rd: {
        range: "₹6L–25L/year (pharma, biotech, data science, research firms)",
        years: "After B.Sc/M.Sc with specialization"
      },
      notes: "Pure science careers require patience — salaries during PhD/post-doc are modest but government scientist roles offer excellent long-term stability and prestige. ISRO/DRDO are dream employers."
    },
    approximate_fees: {
      iiser_iisc: "₹15K–50K/year (heavily subsidized + stipend for BS-MS programs)",
      central_university: "₹10K–40K/year",
      state_university: "₹5K–20K/year",
      private_deemed: "₹60K–2L/year",
      notes: "IISER/IISc students get ₹5,000–12,000/month scholarship during the integrated BS-MS/BS program — effectively free education. JAM exam gives access to M.Sc at IITs at very low fees."
    },
    scholarships_navigation: {
      national_portal: "scholarships.gov.in",
      filter_tip: "Filter: State → Category → Post-Matric → Science/Research",
      sector_specific_schemes: [
        {
          name: "DST INSPIRE Scholarship",
          eligibility: "Top 1% in Class 12 board OR top ranks in JEE/NEET choosing pure science",
          amount: "₹80,000/year for B.Sc, M.Sc + ₹20,000 summer research",
          apply_at: "online-inspire.gov.in"
        },
        {
          name: "KVPY (now IISER Aptitude Test pathway)",
          eligibility: "Class 11/12 students with science aptitude — leads to IISER admission",
          amount: "Monthly fellowship + research opportunities",
          apply_at: "iiseradmissions.in"
        },
        {
          name: "UGC JRF/SRF (for postgraduate research)",
          eligibility: "Post-graduation in science — qualify UGC-NET/CSIR-UGC NET",
          amount: "JRF: ₹31,000/month | SRF: ₹35,000/month",
          apply_at: "ugcnet.nta.ac.in / csirhrdg.res.in"
        },
        {
          name: "CSIR Research Associateship",
          eligibility: "PhD holders in science, age < 32 years",
          amount: "₹54,000–58,000/month",
          apply_at: "csirhrdg.res.in"
        }
      ],
      key_national_schemes: COMMON_NATIONAL_SCHEMES,
      state_portals: STATE_PORTALS
    },
    education_loans: {
      ...COMMON_EDUCATION_LOAN,
      typical_loan_amount: "₹1L–5L (govt college fees are low) | ₹4L–12L (private)",
      with_collateral_limit: "Up to ₹20L",
      special_note: "Most science students in govt colleges need minimal loans. DST INSPIRE and UGC fellowships often make the career self-funding. Focus on fellowships first — loans as last resort."
    }
  },

  COM: {
    salary_ranges: {
      ca_after_qualification: {
        range: "₹7L–15L/year (Big 4 — Deloitte/EY/PwC/KPMG) | ₹5L–8L (smaller firms)",
        years: "Entry after CA Final"
      },
      bcom_graduate: {
        range: "₹2.5L–5L/year (accounting, finance support roles)",
        years: "Entry level"
      },
      mba_finance: {
        range: "₹8L–20L/year (average B-school) | ₹25L–45L/year (IIM A/B/C)",
        years: "Post-MBA"
      },
      cfa_cma_professional: {
        range: "₹8L–20L/year entry | ₹30L–80L+ (senior finance roles, investment banking)",
        years: "After professional certification"
      },
      banking_govt: {
        range: "₹3L–8L/year (bank clerk/PO) | ₹8L–25L/year (RBI/SEBI officer)",
        years: "After IBPS/SBI PO exam"
      },
      notes: "CA is the gold standard — takes 4–5 years but offers excellent ROI. Commerce students have the widest range from ₹3L/year (basic roles) to ₹1Cr+ (senior finance, investment banking)."
    },
    approximate_fees: {
      bcom_govt_college: "₹5K–20K/year",
      bcom_private: "₹40K–1.5L/year",
      ca_icai_total: "₹25K–30K total program fees (ICAI) — extremely affordable professional course",
      mba_iim: "₹20L–25L total (2 years)",
      mba_average_private: "₹5L–15L total",
      cfa_exam_fees: "USD 700–1,200 per level (₹60K–1L per level) — 3 levels total",
      notes: "CA is one of the best ROI professional courses in India — ₹25K total fees, ₹7L+ starting salary."
    },
    scholarships_navigation: {
      national_portal: "scholarships.gov.in",
      filter_tip: "Filter: State → Category → Post-Matric → Commerce/Professional",
      sector_specific_schemes: [
        {
          name: "ICAI CA Scholarship (Merit-cum-Need)",
          eligibility: "CA Foundation/Intermediate students, family income < ₹2L/year",
          amount: "₹1,500–2,000/month",
          apply_at: "icai.org — scholarship section"
        },
        {
          name: "ICAI CA Foundation Merit Scholarship",
          eligibility: "Top 10 rank holders in CA Foundation exam",
          amount: "₹2,000/month during CA Intermediate",
          apply_at: "icai.org"
        },
        {
          name: "UGC Scholarship for Commerce PG",
          eligibility: "Post-graduation in Commerce, qualifying UGC-NET",
          amount: "JRF: ₹31,000/month",
          apply_at: "ugcnet.nta.ac.in"
        },
        {
          name: "HDFC Bank Educational Crisis Scholarship",
          eligibility: "Income < ₹3L/year, studying commerce/management",
          amount: "Up to ₹75,000/year",
          apply_at: "hdfcbank.com/scholarship (via Buddy4Study)"
        }
      ],
      key_national_schemes: COMMON_NATIONAL_SCHEMES,
      state_portals: STATE_PORTALS
    },
    education_loans: {
      ...COMMON_EDUCATION_LOAN,
      typical_loan_amount: "₹1L–5L (B.Com — fees are low) | ₹15L–25L (MBA/PGDM)",
      with_collateral_limit: "Up to ₹40L for top MBA programs",
      special_note: "IIM MBA loans from Axis Bank / HDFC Credila at 9–11% — repaid easily given ₹25L+ starting salary. CA articleship pays ₹2,000–15,000/month stipend — use it to manage living costs."
    }
  },

  BUS: {
    salary_ranges: {
      bba_graduate: {
        range: "₹2.5L–5L/year",
        years: "Entry level"
      },
      mba_average_bschool: {
        range: "₹5L–12L/year",
        years: "Post-MBA entry"
      },
      mba_top_iim: {
        range: "₹25L–35L/year average placement | ₹80L–1Cr+ (top roles, consulting/finance)",
        years: "Post-IIM (A/B/C/L/K) MBA"
      },
      entrepreneur: {
        range: "Highly variable — ₹0 to unlimited. Startup ecosystem: early founders often take ₹30K–60K/month",
        years: "Depends entirely on business"
      },
      corporate_manager_10yrs: {
        range: "₹15L–40L/year (mid-management, large companies)",
        years: "10+ years post-MBA"
      },
      notes: "Management is a multiplier career — entry salary depends on B-school tier. IIM A/B/C are transformational. CAT preparation (2 years) is worth it for long-term returns."
    },
    approximate_fees: {
      bba_govt_state: "₹15K–50K/year",
      bba_private: "₹80K–2.5L/year",
      ipm_iim_5year: "₹15L–20L total (integrated BBA+MBA at IIM Indore/Rohtak)",
      mba_iim_2year: "₹20L–25L total",
      mba_average_private: "₹5L–15L total",
      pgdm_top_private: "₹12L–20L (XLRI, MDI, SP Jain, IMT)",
      notes: "IIM fees seem high but ROI is among the best in India. Average IIM A graduate pays off ₹25L loan in under 18 months."
    },
    scholarships_navigation: {
      national_portal: "scholarships.gov.in",
      filter_tip: "Filter: State → Category → Post-Matric → Management/BBA",
      sector_specific_schemes: [
        {
          name: "IIM Scholarship / Fee Waiver (Need-cum-Merit)",
          eligibility: "Admitted students with family income < ₹3L/year",
          amount: "Up to 100% fee waiver",
          apply_at: "Apply through respective IIM after admission"
        },
        {
          name: "Tata Scholarship for Cornell University (for top management aspirants)",
          eligibility: "Indian students admitted to Cornell, income < ₹7.5L/year",
          amount: "Full tuition",
          apply_at: "tata-cornell.edu"
        },
        {
          name: "Narotam Sekhsaria Scholarship",
          eligibility: "Post-graduation students pursuing top programs, merit-based",
          amount: "Up to ₹20L (loan with low interest)",
          apply_at: "nsfoundation.co.in"
        },
        {
          name: "Aditya Birla Scholarship",
          eligibility: "Students joining IIT, IIM, BITS, NLU, Architecture top colleges",
          amount: "₹65,000–1,75,000/year",
          apply_at: "adityabirla.com/scholarship"
        }
      ],
      key_national_schemes: COMMON_NATIONAL_SCHEMES,
      state_portals: STATE_PORTALS
    },
    education_loans: {
      ...COMMON_EDUCATION_LOAN,
      typical_loan_amount: "₹3L–8L (BBA) | ₹15L–25L (MBA top colleges)",
      with_collateral_limit: "Up to ₹40L",
      special_note: "For IIM MBA: Axis Bank, HDFC Credila, and SBI have dedicated education loan products. Pre-admission loan sanction letters available — useful during admission process."
    }
  },

  ART: {
    salary_ranges: {
      graphic_designer: {
        range: "₹2.5L–6L/year (entry) | ₹10L–20L/year (senior) | ₹25L+ (UX/product design lead)",
        years: "0–3 years entry, 5–8 years senior"
      },
      architect: {
        range: "₹3L–7L/year (entry) | ₹15L–40L/year (senior) | ₹60L+ (own firm/international)",
        years: "Takes time — 5 years B.Arch + license"
      },
      fashion_designer: {
        range: "₹2.5L–5L/year (entry) | ₹8L–20L+ (established brand/own label)",
        years: "Highly variable — freelance income is common"
      },
      fine_artist_photographer: {
        range: "₹1.5L–4L/year (starting) | Uncapped (commissions, exhibitions, commercial work)",
        years: "Highly variable — reputation-driven"
      },
      ux_ui_designer: {
        range: "₹4L–10L/year (entry) | ₹15L–35L/year (senior, tech companies)",
        years: "High-growth field — demand outstrips supply"
      },
      notes: "Creative fields reward skill and portfolio over degrees. A strong portfolio beats a mediocre degree. Freelance/self-employment is common and can be very lucrative."
    },
    approximate_fees: {
      nid_nift_govt: "₹1L–2.5L/year (highly subsidized, quality institutions)",
      arch_govt_college: "₹20K–1L/year",
      arch_private_approved: "₹1.5L–4L/year",
      private_design_college: "₹2L–6L/year (Pearl, Symbiosis, MIT, etc.)",
      fine_arts_govt: "₹5K–25K/year",
      notes: "NID and NIFT are top-tier at affordable fees. Entrance exams are competitive — portfolio + aptitude test based."
    },
    scholarships_navigation: {
      national_portal: "scholarships.gov.in",
      filter_tip: "Filter: State → Category → Post-Matric → Design/Architecture/Arts",
      sector_specific_schemes: [
        {
          name: "NID Scholarship (Merit-cum-Means)",
          eligibility: "Admitted NID students with family income < ₹4.5L/year",
          amount: "Up to full fee waiver + ₹3,000/month stipend",
          apply_at: "nid.edu — apply after admission"
        },
        {
          name: "NIFT Scholarship (Financial Assistance Scheme)",
          eligibility: "Admitted NIFT students with family income < ₹4.5L/year",
          amount: "Up to full fee waiver",
          apply_at: "nift.ac.in — apply after admission"
        },
        {
          name: "JJ School of Art Scholarship (Mumbai)",
          eligibility: "Merit-based for admitted students",
          amount: "Partial to full fee support",
          apply_at: "sirjjschoolofart.com"
        },
        {
          name: "Lalit Kala Akademi Awards",
          eligibility: "Emerging artists showing exceptional work",
          amount: "₹20,000–50,000 + exhibition opportunity",
          apply_at: "lalitkala.gov.in"
        },
        {
          name: "CSIDC Design Scholarship (for SC/ST design students)",
          eligibility: "SC/ST students in approved design institutions",
          amount: "Tuition fee support + stipend",
          apply_at: "socialjustice.nic.in"
        }
      ],
      key_national_schemes: COMMON_NATIONAL_SCHEMES,
      state_portals: STATE_PORTALS
    },
    education_loans: {
      ...COMMON_EDUCATION_LOAN,
      typical_loan_amount: "₹2L–10L (design/arts)",
      with_collateral_limit: "Up to ₹20L",
      special_note: "NID/NIFT students often qualify for low/no-collateral loans given institutional reputation. Freelance and part-time income during study is common in creative fields — factor this in."
    }
  },

  MEDC: {
    salary_ranges: {
      journalist_print_tv: {
        range: "₹2.5L–6L/year (entry) | ₹8L–20L+ (senior journalist, anchor)",
        years: "0–3 years entry, 8+ years senior"
      },
      digital_content_creator: {
        range: "₹3L–8L/year (employed) | Uncapped (YouTube/Instagram monetization)",
        years: "Growing fastest — digital-first brands pay well"
      },
      pr_corporate_communications: {
        range: "₹4L–8L/year (entry) | ₹12L–30L+ (senior, large corporations)",
        years: "Strong growth with experience"
      },
      advertising_copywriter: {
        range: "₹3L–6L/year (entry) | ₹15L–35L (creative director at agencies)",
        years: "Portfolio and creativity-driven"
      },
      film_tv_production: {
        range: "₹1.5L–4L/year (entry assistant roles) | Highly variable (established)",
        years: "Takes time to establish in competitive industry"
      },
      notes: "Media salaries vary widely. Digital skills (SEO, social media, video editing) command premium in 2025. Freelancing is very common and often more lucrative than employment."
    },
    approximate_fees: {
      iimc_govt: "₹75K–1.5L/year (Indian Institute of Mass Communication — top govt institution)",
      jamia_du_amu: "₹20K–60K/year (central university media programs)",
      private_media_college: "₹1L–3L/year",
      film_school_ftii: "₹50K–1.5L/year (Film and Television Institute of India, Pune — highly subsidized)",
      notes: "IIMC and FTII are prestigious government institutions at very affordable fees. Entrance exam based."
    },
    scholarships_navigation: {
      national_portal: "scholarships.gov.in",
      filter_tip: "Filter: State → Category → Post-Matric → Mass Communication/Journalism",
      sector_specific_schemes: [
        {
          name: "IIMC Scholarship (Need-cum-Merit)",
          eligibility: "Admitted students, income-based",
          amount: "Partial to full fee waiver",
          apply_at: "iimc.nic.in — after admission"
        },
        {
          name: "FTII Fellowship / Scholarship",
          eligibility: "Admitted FTII students — merit-based",
          amount: "Fee concession + stipend",
          apply_at: "ftiindia.com"
        },
        {
          name: "Ramnath Goenka Foundation Scholarship (Journalism)",
          eligibility: "Journalism students with strong academic record",
          amount: "₹50,000–1,00,000/year",
          apply_at: "rng.foundation"
        },
        {
          name: "Press Council of India Scholarship",
          eligibility: "Students enrolled in journalism/mass comm programs",
          amount: "₹10,000–25,000/year",
          apply_at: "presscouncil.nic.in"
        }
      ],
      key_national_schemes: COMMON_NATIONAL_SCHEMES,
      state_portals: STATE_PORTALS
    },
    education_loans: {
      ...COMMON_EDUCATION_LOAN,
      typical_loan_amount: "₹1L–6L (media college fees are moderate)",
      with_collateral_limit: "Up to ₹15L",
      special_note: "Media/journalism is a skill-first field. Internships during college often convert to jobs. Keep loan amount minimal — ROI timeline is longer in creative fields."
    }
  },

  EDU: {
    salary_ranges: {
      government_school_teacher: {
        range: "₹35,000–75,000/month (7th Pay Commission — varies by state and grade)",
        years: "Entry level (PRT/TGT/PGT grades)"
      },
      govt_principal_headmaster: {
        range: "₹80,000–1,20,000/month",
        years: "After 15–20 years service"
      },
      college_lecturer_ugc: {
        range: "Assistant Professor: ₹57,700–1,31,400/month (UGC 7th CPC)",
        years: "After M.Ed/M.A. + NET/SLET"
      },
      ugc_professor: {
        range: "₹1,44,200–2,18,200/month",
        years: "15+ years, PhD mandatory"
      },
      private_school_teacher: {
        range: "₹20,000–50,000/month (varies hugely — CBSE private schools)",
        years: "Entry to mid level"
      },
      psychologist_counsellor: {
        range: "₹25,000–60,000/month (school/hospital) | ₹6L–20L/year (private practice)",
        years: "After M.A. Psychology + RCI registration"
      },
      notes: "Government teaching is one of the most stable careers in India with pension, job security, and regular salary revision. NET/SLET qualification opens college teaching."
    },
    approximate_fees: {
      bed_govt_college: "₹10K–30K/year",
      bed_private_college: "₹40K–1.5L/year",
      deled_govt: "₹5K–20K/year",
      ma_psychology_govt: "₹8K–25K/year",
      ma_psychology_private: "₹40K–1.5L/year",
      notes: "B.Ed is mandatory for school teaching. CTET/TET required for government jobs. Total investment is low — very high job security ROI."
    },
    scholarships_navigation: {
      national_portal: "scholarships.gov.in",
      filter_tip: "Filter: State → Category → Post-Matric → Education/B.Ed",
      sector_specific_schemes: [
        {
          name: "UGC JRF for Education/Psychology",
          eligibility: "Post-graduation in Education/Psychology — qualify UGC-NET",
          amount: "₹31,000/month (JRF) | ₹35,000/month (SRF)",
          apply_at: "ugcnet.nta.ac.in"
        },
        {
          name: "NCERT Doctoral Fellowship",
          eligibility: "PhD students in Education, merit-based",
          amount: "₹25,000/month",
          apply_at: "ncert.nic.in"
        },
        {
          name: "RIE (Regional Institute of Education) Scholarships",
          eligibility: "Students in RIE integrated B.Sc.Ed / B.A.Ed programs",
          amount: "Merit-based fee concession + stipend",
          apply_at: "Respective RIE — ncert.nic.in/rieajmer etc."
        },
        {
          name: "Indira Gandhi Scholarship for Single Girl Child",
          eligibility: "Only girl child of parent, pursuing post-graduation",
          amount: "₹36,200/year for 2 years",
          apply_at: "ugc.ac.in — UGC scholarship"
        }
      ],
      key_national_schemes: COMMON_NATIONAL_SCHEMES,
      state_portals: STATE_PORTALS
    },
    education_loans: {
      ...COMMON_EDUCATION_LOAN,
      typical_loan_amount: "₹1L–4L (B.Ed fees are low) | ₹3L–8L (M.A. Psychology, private)",
      with_collateral_limit: "Up to ₹15L",
      special_note: "Teaching careers have one of the lowest education costs and highest job security. Loan requirement is usually minimal — scholarships + family support often sufficient."
    }
  },

  AGRI: {
    salary_ranges: {
      govt_agriculture_officer: {
        range: "₹35,000–70,000/month (state AO/ADO) | ₹56,000–1.77L/month (ICAR Scientist)",
        years: "Entry via state PSC / ASRB (ICAR) exam"
      },
      agritech_startup: {
        range: "₹4L–15L/year (analyst/agronomist) | ₹20L+ (product/data roles)",
        years: "Growing sector — startups like DeHaat, Ninjacart, AgriBazaar"
      },
      agricultural_entrepreneur: {
        range: "Highly variable — progressive farmers earn ₹5L–50L+/year",
        years: "Depends on land, market access, value-add"
      },
      food_processing_industry: {
        range: "₹3L–8L/year (entry) | ₹12L–25L+ (senior technologist)",
        years: "Growing with Make in India push"
      },
      notes: "Agriculture is being transformed by technology. Agritech, food processing, and organic farming are creating new high-paying opportunities beyond traditional farming."
    },
    approximate_fees: {
      bsc_agri_state_agricultural_university: "₹15K–50K/year",
      bsc_agri_central_university_iari: "₹10K–30K/year",
      bsc_agri_private: "₹80K–2L/year",
      bvsc_animal_husbandry: "₹15K–60K/year (govt) | ₹1L–3L/year (private)",
      notes: "State Agricultural Universities (SAUs) like IARI, GBPUAT, PAU offer excellent education at subsidized rates. ICAR-AIEEA entrance exam opens central institutions."
    },
    scholarships_navigation: {
      national_portal: "scholarships.gov.in",
      filter_tip: "Filter: State → Category → Post-Matric → Agriculture/Veterinary",
      sector_specific_schemes: [
        {
          name: "ICAR JRF (Junior Research Fellowship)",
          eligibility: "Post-graduation in Agriculture — qualify ICAR-NET",
          amount: "₹31,000/month (JRF) | ₹35,000/month (SRF)",
          apply_at: "icar.org.in / asrb.org.in"
        },
        {
          name: "ICAR Merit Scholarship for B.Sc Agriculture",
          eligibility: "Top 10 students in first year of ICAR-affiliated colleges",
          amount: "₹2,000–3,000/month",
          apply_at: "Through respective agricultural university"
        },
        {
          name: "NABARD Rural Development Scholarship",
          eligibility: "Students from rural areas pursuing agriculture/rural management",
          amount: "₹5,000–15,000/month",
          apply_at: "nabard.org"
        },
        {
          name: "PM Kisan Scholarship for Agricultural Students",
          eligibility: "Children of farmers pursuing agriculture courses",
          amount: "Varies by state implementation",
          apply_at: "State Agriculture Department portal"
        }
      ],
      key_national_schemes: COMMON_NATIONAL_SCHEMES,
      state_portals: STATE_PORTALS
    },
    education_loans: {
      ...COMMON_EDUCATION_LOAN,
      typical_loan_amount: "₹2L–8L (govt SAU fees are low) | ₹5L–15L (private)",
      with_collateral_limit: "Up to ₹20L",
      special_note: "Agricultural education has high scholarship availability from ICAR and state governments. Govt SAU fees are very affordable — loans are often not needed for govt college students."
    }
  },

  HOSP: {
    salary_ranges: {
      hotel_management_entry: {
        range: "₹20K–35K/month (5-star property, metro) | ₹12K–20K/month (other)",
        years: "Entry — management trainee"
      },
      fb_manager_mid: {
        range: "₹50K–1L/month",
        years: "5–8 years experience"
      },
      general_manager_5star: {
        range: "₹3L–8L/month (Indian 5-star) | USD 8,000–20,000/month (international)",
        years: "15–20 years experience"
      },
      chef_culinary: {
        range: "₹20K–40K/month (entry sous chef) | ₹1L–4L/month (executive chef 5-star)",
        years: "7–10 years to reach executive level"
      },
      event_manager: {
        range: "₹3L–6L/year (entry) | ₹10L–25L/year (senior, large events firms)",
        years: "Project-based — grows with network"
      },
      notes: "Hospitality offers excellent global mobility — Indian hotel management graduates are in demand in UAE, UK, USA, Singapore, Australia. Starting salaries are modest but growth is rapid."
    },
    approximate_fees: {
      ihm_govt_nchmct: "₹50K–1.2L/year (National Council for Hotel Management — govt rate)",
      private_hotel_management: "₹1.5L–4L/year",
      culinary_academy: "₹2L–5L/year (WGSHA, ICE India, etc.)",
      notes: "NCHMCT JEE exam gives access to 21 central IHMs and 18 state IHMs at subsidized fees. Strong placement record."
    },
    scholarships_navigation: {
      national_portal: "scholarships.gov.in",
      filter_tip: "Filter: State → Category → Post-Matric → Hotel Management/Tourism",
      sector_specific_schemes: [
        {
          name: "NCHMCT Scholarship (Need-cum-Merit)",
          eligibility: "Admitted IHM students, family income < ₹4.5L/year",
          amount: "Up to full fee waiver",
          apply_at: "nchm.nic.in — after admission through NCHMCT JEE"
        },
        {
          name: "Ministry of Tourism Scholarship",
          eligibility: "Students in approved hotel management/tourism programs",
          amount: "₹10,000–25,000/year",
          apply_at: "tourism.gov.in"
        },
        {
          name: "AICTE Scholarship (for AICTE-approved hotel management)",
          eligibility: "Female students / SC/ST students in approved programs",
          amount: "₹30,000–50,000/year",
          apply_at: "aicte-india.org"
        }
      ],
      key_national_schemes: COMMON_NATIONAL_SCHEMES,
      state_portals: STATE_PORTALS
    },
    education_loans: {
      ...COMMON_EDUCATION_LOAN,
      typical_loan_amount: "₹3L–10L (IHM govt) | ₹8L–20L (private culinary/hospitality)",
      with_collateral_limit: "Up to ₹25L",
      special_note: "Hotel management graduates often get job offers before graduation (campus placements by Taj, Marriott, ITC, Hyatt). Loan repayment is manageable given early employment."
    }
  },

  GOV: {
    salary_ranges: {
      ias_ips_entry: {
        range: "₹56,100/month basic + DA + HRA + allowances = effective ₹1.2L–1.8L/month",
        years: "Level 10 start — Joint Secretary level after 15–20 years"
      },
      army_lieutenant: {
        range: "₹56,100 + MSP ₹15,500 + allowances = effective ₹80K–1L+/month",
        years: "After NDA/OTA/IMA commission"
      },
      army_colonel_20yrs: {
        range: "₹1.3L–1.7L/month + benefits",
        years: "After 20 years service"
      },
      state_pcs_officer: {
        range: "₹50K–1L/month + allowances (varies by state and position)",
        years: "Via state PCS exam"
      },
      police_inspector: {
        range: "₹35K–70K/month (state police) — varies widely",
        years: "Via state PSC/direct recruitment"
      },
      notes: "Government/defence salaries include non-monetary benefits: accommodation, medical for family, pension, children education allowance, LTA. Total compensation is much higher than basic salary suggests. Pension (for pre-2004 recruits) or NPS are major retirement benefits."
    },
    approximate_fees: {
      nda_ima_fully_govt_funded: "₹0 — fully funded by Government of India + monthly stipend during training",
      upsc_coaching: "₹1.5L–4L/year (optional — self-study is sufficient for many toppers)",
      graduation_prerequisite: "Any bachelor's degree required — fees as per chosen stream",
      notes: "NDA/IMA training is 100% government-funded. Students receive a stipend. UPSC preparation itself is free — books, online resources, and previous papers are enough. Coaching is optional."
    },
    scholarships_navigation: {
      national_portal: "scholarships.gov.in",
      filter_tip: "Filter: State → Category → Post-Matric → Any stream (graduation is the eligibility, not the field)",
      sector_specific_schemes: [
        {
          name: "Sainik School Scholarship (for defence aspirants)",
          eligibility: "Class 6 and 9 students — merit + means based entrance",
          amount: "Full scholarship for economically weaker sections",
          apply_at: "sainikschooladmission.in"
        },
        {
          name: "Army Wives Welfare Association (AWWA) Scholarships",
          eligibility: "Children of army personnel",
          amount: "₹1,500–12,000/year",
          apply_at: "Regimental center or local unit welfare officer"
        },
        {
          name: "PM Scholarship Scheme for CAPF",
          eligibility: "Wards of Central Armed Police Forces (CRPF, BSF, ITBP, CISF, SSB, NSG, Assam Rifles)",
          amount: "₹2,500–3,000/month",
          apply_at: "ksb.gov.in"
        },
        {
          name: "Ex-Servicemen Welfare Scholarship",
          eligibility: "Children of ex-servicemen and war widows",
          amount: "₹1,000–5,000/month (varies by state Sainik Board)",
          apply_at: "State Sainik Board / KSB — ksb.gov.in"
        }
      ],
      key_national_schemes: COMMON_NATIONAL_SCHEMES,
      state_portals: STATE_PORTALS
    },
    education_loans: {
      ...COMMON_EDUCATION_LOAN,
      typical_loan_amount: "₹1L–5L (graduation prerequisite — manageable fees)",
      with_collateral_limit: "Up to ₹20L",
      special_note: "Civil services / defence aspirants need loans mainly for their graduation degree (prerequisite) and optionally coaching. NDA students need NO loan — fully govt funded. Post-selection, government provides housing, medical, and subsidized loans for personal needs."
    }
  }

};

// ─── Apply enrichment ─────────────────────────────────────────────────────────

let enrichedCount = 0;
let skippedCount = 0;

data.sectors = data.sectors.map(sector => {
  const enrichment = ENRICHMENT[sector.sector_id];
  if (!enrichment) {
    console.log(`SKIP: sector_id="${sector.sector_id}" — no enrichment data (metadata or duplicate)`);
    skippedCount++;
    return sector;
  }
  enrichedCount++;
  console.log(`ENRICHED: [${sector.sector_id}] ${sector.sector_name}`);
  return {
    ...sector,
    salary_ranges: enrichment.salary_ranges,
    approximate_fees: enrichment.approximate_fees,
    scholarships_navigation: enrichment.scholarships_navigation,
    education_loans: enrichment.education_loans
  };
});

// Fix duplicate COM sector (remove exact duplicate, keep first)
const seenIds = new Set();
const beforeCount = data.sectors.length;
data.sectors = data.sectors.filter(s => {
  if (!s.sector_id) return true; // keep metadata entries
  if (seenIds.has(s.sector_id)) {
    console.log(`REMOVED DUPLICATE: [${s.sector_id}]`);
    return false;
  }
  seenIds.add(s.sector_id);
  return true;
});
const afterCount = data.sectors.length;

// Write output
writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');

const newSize = Math.round(JSON.stringify(data).length / 1024);
console.log(`\nDone. Enriched: ${enrichedCount} sectors | Skipped: ${skippedCount}`);
console.log(`Sectors before: ${beforeCount} | after: ${afterCount} (removed ${beforeCount - afterCount} duplicate)`);
console.log(`Output file size: ~${newSize} KB`);
