import type { Copy } from "@/lib/onboarding/content";
import { CASES } from "@/lib/cases/fixtures";
import {
  ACTIVE_STAGES,
  partiesLabel,
  type ActiveStage,
  type CounselSide,
} from "@/lib/cases/types";
import {
  viewerAccess as recordViewerAccess,
  viewerRepresentation,
} from "@/lib/cases/viewer";

export { fill as fillCopy } from "@/lib/join/content";

/**
 * Case access management — content model and demo fixtures.
 *
 * The access model (17 Aug meeting, corrected 20 Aug): access is case-level and
 * all-or-nothing, and a person's ROLE LIVES ON THE (person × case) GRANT — the
 * vakalat nama is unique to each case, so the same person can be an on-nama
 * advocate in one case and nothing in another. There is therefore no role
 * toggle anywhere: advocates get access through each case's vakalat nama
 * (declared at join / vakalat upload), and the share flow only ever adds
 * office staff (clerks and junior advocates).
 *
 * "People" is a flat list of everyone on my side across cases; designations
 * appear per case ("Joined as Clerk"), never on the person.
 */

const t = (en: string, ml: string): Copy => ({ en, ml });

/* ------------------------------------------------------------------- demo data */

export type AccessRole = "vakalat" | "clerk" | "junior";

export type AccessCase = {
  id: string;
  /** "Complainant vs accused", as the court titles it. */
  title: string;
  caseNumber: string;
  court: string;
  /** Display date of the next hearing — wireframe-level fidelity only. */
  nextHearing: string;
  /**
   * How the signed-in advocate reaches THIS case: on its vakalatnama (may
   * add and remove people) or through office access a colleague shared
   * (sees who has access, touches nobody — the share dialog has said so
   * since Aug). Defaults to "vakalatnama"; the case screens derive the
   * same fact from the record's counsel lists (`lib/cases/viewer`).
   */
  viewerAccess?: "vakalatnama" | "office";
  /** An e-filing draft the advocate is on (OFC-04): shared like a case, but it
      has no case number or case page yet. */
  draft?: boolean;
  /** Where the case sits (PM, Oct 23: the person's case table filters on it).
      Absent on drafts, which have no stage yet. */
  stage?: ActiveStage | "disposed";
  /** The side the advocate represents in this case (owner, Oct 24: the
      person's case table shows and filters on it). A draft is a complaint
      being filed, so it is the complainant's. */
  side?: CounselSide;
};

/** How a case is named in a sentence: its number, or a draft's title. */
export function caseLabel(entry: Pick<AccessCase, "caseNumber" | "title">): string {
  return entry.caseNumber || entry.title;
}

/**
 * A case the advocate just joined, made known to the access world so office
 * access can be given to it at the end of the join flow (OFC-40). Prototype
 * only: the backend's case list replaces this.
 */
export function registerAccessCase(entry: AccessCase): void {
  const index = ACCESS_CASES.findIndex((c) => c.id === entry.id);
  // Known already: take the newer facts (a case the advocate just joined is now
  // theirs on the vakalatnama, whatever the demo docket said).
  if (index >= 0) ACCESS_CASES[index] = { ...ACCESS_CASES[index], ...entry };
  else ACCESS_CASES.unshift(entry);
}

/** May the signed-in advocate remove people from this case? Office access
    never may — removal belongs to the advocates on the vakalatnama. */
export function viewerHoldsVakalat(caseId: string): boolean {
  const entry = ACCESS_CASES.find((c) => c.id === caseId);
  return (entry?.viewerAccess ?? "vakalatnama") !== "office";
}

export type AccessGrant = {
  caseId: string;
  /** The person's role IN THIS CASE — vakalat nama is per-case. */
  role: AccessRole;
  /** Vakalat advocates may be declared on the nama but yet to join the system
      (join-a-case). Office access is immediate, so it is always "joined" (OFC-07). */
  status: "joined" | "invited";
  /** Display date access started. */
  since: string;
  /** Who granted administrative access for this specific case. */
  addedBy?: "self" | string;
};

export type AccessPerson = {
  id: string;
  name: string;
  phone: string;
  /** Bar Council enrolment number — advocates only. */
  barId?: string;
  /**
   * Who brought them in. "self" is the signed-in advocate; another name is a
   * fellow vakalat advocate; `null` means they came through a vakalat nama.
   */
  addedBy: "self" | string | null;
  grants: AccessGrant[];
  /** Gets office access to every case the signed-in advocate is later added
      to on a vakalatnama (OFC-25). */
  allCases?: boolean;
};

/** The signed-in advocate — rendered as "(you)" atop per-case access lists. */
export const SELF = {
  id: "self",
  name: "Adv. Anjali Nair",
  phone: "98460 00000",
} as const;

/** Demo docket — same world as the join-flow fixtures (NIA 138). */
export const ACCESS_CASES: AccessCase[] = [
  {
    id: "c-847",
    title: "South Indian Bank Ltd. vs Rajan Krishnan Nair and 1 other",
    caseNumber: "CC 847/2026",
    court: "JFCM I · Court No. 3",
    nextHearing: "28 Aug 2026",
    /* The demo's two office-access cases (owner, Sept 3): the viewer reads
       these but removes nobody, here or on the case's Parties tab. */
    viewerAccess: "office",
  },
  {
    id: "c-612",
    title: "Fathima Beevi vs Anil Kumar K.",
    caseNumber: "CC 612 / 2026",
    court: "24×7 ON Court",
    nextHearing: "25 Aug 2026",
  },
  {
    id: "c-533",
    title: "Anitha Joseph vs Latheef M.",
    caseNumber: "CC 533 / 2026",
    court: "24×7 ON Court",
    nextHearing: "2 Sep 2026",
    viewerAccess: "office",
  },
  {
    id: "c-410",
    title: "Kerala Traders Co-operative vs Suresh Babu P.",
    caseNumber: "CC 410 / 2026",
    court: "JFCM I · Court No. 3",
    nextHearing: "9 Sep 2026",
  },
  {
    id: "c-289",
    title: "Malabar Finance Ltd. vs Joseph Mathew",
    caseNumber: "CC 289 / 2026",
    court: "JFCM II",
    nextHearing: "16 Sep 2026",
  },
  {
    id: "c-721",
    title: "Federal Bank Ltd. vs Binu Varghese",
    caseNumber: "CC 721 / 2026",
    court: "JFCM I · Court No. 3",
    nextHearing: "18 Sep 2026",
  },
  {
    id: "c-698",
    title: "Sreelakshmi Chits Pvt. Ltd. vs Manoj Kumar",
    caseNumber: "CC 698 / 2026",
    court: "24×7 ON Court",
    nextHearing: "21 Sep 2026",
  },
  {
    id: "c-655",
    title: "Jaya Textiles vs Noufal A.",
    caseNumber: "CC 655 / 2026",
    court: "JFCM II",
    nextHearing: "23 Sep 2026",
  },
  {
    id: "c-590",
    title: "Coastal Credit Society vs Mini Thomas",
    caseNumber: "CC 590 / 2026",
    court: "JFCM I · Court No. 3",
    nextHearing: "25 Sep 2026",
  },
  {
    id: "c-564",
    title: "Lakeside Hardware Mart vs Shaji P.",
    caseNumber: "CC 564 / 2026",
    court: "24×7 ON Court",
    nextHearing: "28 Sep 2026",
  },
  {
    id: "c-501",
    title: "Unity Auto Finance vs Radhakrishnan Nair",
    caseNumber: "CC 501 / 2026",
    court: "JFCM II",
    nextHearing: "30 Sep 2026",
  },
  {
    id: "c-478",
    title: "Aiswarya Agencies vs Deepa Mohan",
    caseNumber: "CC 478 / 2026",
    court: "JFCM I · Court No. 3",
    nextHearing: "2 Oct 2026",
  },
  {
    id: "c-452",
    title: "Kerala Gramin Bank vs Sajan Philip",
    caseNumber: "CC 452 / 2026",
    court: "24×7 ON Court",
    nextHearing: "5 Oct 2026",
  },
  {
    id: "c-399",
    title: "Grand Motors vs Abdul Salam",
    caseNumber: "CC 399 / 2026",
    court: "JFCM II",
    nextHearing: "7 Oct 2026",
  },
  {
    id: "c-376",
    title: "Navodaya Enterprises vs Reni George",
    caseNumber: "CC 376 / 2026",
    court: "JFCM I · Court No. 3",
    nextHearing: "9 Oct 2026",
  },
  {
    id: "c-341",
    title: "Muthoot Traders vs Pradeep S.",
    caseNumber: "CC 341 / 2026",
    court: "24×7 ON Court",
    nextHearing: "12 Oct 2026",
  },
  {
    id: "c-318",
    title: "Bharath Distributors vs Latha Kumari",
    caseNumber: "CC 318 / 2026",
    court: "JFCM II",
    nextHearing: "14 Oct 2026",
  },
  {
    id: "c-266",
    title: "Sankars Hospital vs Arun Das",
    caseNumber: "CC 266 / 2026",
    court: "JFCM I · Court No. 3",
    nextHearing: "16 Oct 2026",
  },
  {
    id: "c-241",
    title: "Oceanic Exports vs Salim K.",
    caseNumber: "CC 241 / 2026",
    court: "24×7 ON Court",
    nextHearing: "19 Oct 2026",
  },
  {
    id: "c-218",
    title: "Devi Medicals vs Suresh Chandran",
    caseNumber: "CC 218 / 2026",
    court: "JFCM II",
    nextHearing: "21 Oct 2026",
  },
  {
    id: "c-194",
    title: "Punalur Service Bank vs Asha Roy",
    caseNumber: "CC 194 / 2026",
    court: "JFCM I · Court No. 3",
    nextHearing: "23 Oct 2026",
  },
  {
    id: "c-173",
    title: "Kairali Foods vs Navas M.",
    caseNumber: "CC 173 / 2026",
    court: "24×7 ON Court",
    nextHearing: "26 Oct 2026",
  },
  {
    id: "c-151",
    title: "Sree Narayana Stores vs Beena R.",
    caseNumber: "CC 151 / 2026",
    court: "JFCM II",
    nextHearing: "28 Oct 2026",
  },
  {
    id: "c-129",
    title: "Capitol Electronics vs Sunil Babu",
    caseNumber: "CC 129 / 2026",
    court: "JFCM I · Court No. 3",
    nextHearing: "30 Oct 2026",
  },
  {
    id: "c-108",
    title: "Travancore Ceramics vs Ramesh Pillai",
    caseNumber: "CC 108 / 2026",
    court: "24×7 ON Court",
    nextHearing: "2 Nov 2026",
  },
  {
    id: "c-087",
    title: "Greenline Logistics vs Sumi Rajan",
    caseNumber: "CC 087 / 2026",
    court: "JFCM II",
    nextHearing: "4 Nov 2026",
  },
  {
    id: "c-066",
    title: "Janatha Supermarket vs Faizal H.",
    caseNumber: "CC 066 / 2026",
    court: "JFCM I · Court No. 3",
    nextHearing: "6 Nov 2026",
  },
  {
    id: "c-045",
    title: "Maya Jewellery vs Vinod Krishnan",
    caseNumber: "CC 045 / 2026",
    court: "24×7 ON Court",
    nextHearing: "9 Nov 2026",
  },
  {
    id: "c-024",
    title: "Royal Furniture vs Sindhu Menon",
    caseNumber: "CC 024 / 2026",
    court: "JFCM II",
    nextHearing: "11 Nov 2026",
  },
  {
    id: "c-011",
    title: "Asramam Builders vs Nikhil Raj",
    caseNumber: "CC 011 / 2026",
    court: "JFCM I · Court No. 3",
    nextHearing: "13 Nov 2026",
  },
];

const joinedGrants = (
  caseIds: string[],
  role: AccessRole,
  since: string,
  inviters: Array<"self" | string> = ["self"],
): AccessGrant[] =>
  caseIds.map((caseId, index) => ({
    caseId,
    role,
    status: "joined",
    since,
    ...(role === "vakalat" ? {} : { addedBy: inviters[index % inviters.length] }),
  }));

/** My side across cases. Seed state — invites and removals mutate a copy. */
export const ACCESS_PEOPLE: AccessPerson[] = [
  {
    id: "p-thomas",
    name: "Adv. Thomas K. George",
    phone: "98470 12345",
    barId: "K/831/2011",
    addedBy: "self",
    grants: [
      ...joinedGrants(
        [
          "c-847", "c-612", "c-410", "c-721", "c-698", "c-655", "c-590", "c-564",
          "c-501", "c-478", "c-452", "c-399", "c-376", "c-341", "c-318",
        ],
        "vakalat",
        "3 Jul 2026",
      ),
      ...joinedGrants(
        [
          "c-533", "c-289", "c-266", "c-241", "c-218", "c-194", "c-173", "c-151",
          "c-129", "c-108", "c-087", "c-066", "c-045", "c-024", "c-011",
        ],
        "junior",
        "6 Aug 2026",
        ["self", "Adv. Priya Nair", "Adv. Meera Pillai", "Adv. Nisha Varghese"],
      ),
    ],
  },
  {
    // On the nama of one case but hasn't signed in — shows the yet-to-join state.
    id: "p-rajesh",
    name: "Adv. Rajesh Kurup",
    phone: "98470 98765",
    barId: "K/1204/2015",
    addedBy: null,
    grants: [{ caseId: "c-847", role: "vakalat", status: "invited", since: "3 Jul 2026" }],
  },
  {
    id: "p-anil",
    name: "Anil Raghavan",
    phone: "94470 88221",
    addedBy: "self",
    allCases: true,
    grants: joinedGrants(
      [
        "c-847", "c-612", "c-533", "c-410", "c-289", "c-721", "c-698", "c-655",
        "c-590", "c-564", "c-501", "c-478", "c-452", "c-399", "c-376", "c-341",
        "c-318", "c-266", "c-241", "c-218",
      ],
      "clerk",
      "4 Jul 2026",
      ["self", "Adv. Thomas K. George", "Adv. Priya Nair", "Adv. Meera Pillai"],
    ),
  },
  {
    // Mixed on purpose: on the nama of one case, administrative help on two
    // others — the panel's two groups exist for exactly this person.
    id: "p-priya",
    name: "Adv. Priya Nair",
    phone: "94950 33417",
    barId: "K/2988/2021",
    addedBy: "Adv. Thomas K. George",
    grants: [
      ...joinedGrants(
        ["c-533", "c-721", "c-655", "c-501", "c-452", "c-376", "c-318", "c-241"],
        "vakalat",
        "2 Aug 2026",
      ),
      ...joinedGrants(
        ["c-612", "c-410", "c-289", "c-698", "c-590", "c-564", "c-478", "c-399"],
        "junior",
        "18 Jun 2026",
        ["self", "Adv. Thomas K. George", "Adv. Meera Pillai", "Adv. Nisha Varghese"],
      ),
    ],
  },
  {
    id: "p-sameer",
    name: "Sameer K.",
    phone: "90720 55190",
    addedBy: "self",
    grants: [
      {
        caseId: "c-289",
        role: "clerk",
        status: "joined",
        since: "11 Apr 2026",
        addedBy: "Adv. Nisha Varghese",
      },
    ],
  },
  {
    id: "p-meera",
    name: "Adv. Meera Pillai",
    phone: "98462 45190",
    barId: "K/1742/2017",
    addedBy: null,
    grants: joinedGrants(
      [
        "c-847", "c-612", "c-533", "c-410", "c-721", "c-698", "c-655", "c-590",
        "c-564", "c-501", "c-478", "c-452", "c-399", "c-376", "c-341", "c-318",
        "c-266", "c-241",
      ],
      "vakalat",
      "9 May 2026",
    ),
  },
  {
    id: "p-arun",
    name: "Arun Das",
    phone: "94473 66218",
    addedBy: "self",
    grants: joinedGrants(
      [
        "c-847", "c-612", "c-533", "c-410", "c-289", "c-721", "c-698", "c-655",
        "c-590", "c-564", "c-501", "c-478", "c-452", "c-399",
      ],
      "clerk",
      "15 Jul 2026",
      ["self", "Adv. Thomas K. George", "Adv. Priya Nair", "Adv. Meera Pillai"],
    ),
  },
  {
    id: "p-nisha",
    name: "Adv. Nisha Varghese",
    phone: "98951 22764",
    barId: "K/2251/2019",
    addedBy: "self",
    grants: [
      ...joinedGrants(["c-847", "c-533", "c-721", "c-590", "c-501"], "vakalat", "7 Jun 2026"),
      ...joinedGrants(
        ["c-612", "c-410", "c-289", "c-698", "c-655"],
        "junior",
        "19 Jul 2026",
        ["self", "Adv. Thomas K. George", "Adv. Priya Nair", "Adv. Meera Pillai"],
      ),
    ],
  },
  {
    id: "p-ramesh",
    name: "Ramesh Chandran",
    phone: "98765 01234",
    addedBy: "self",
    grants: joinedGrants(
      ["c-847", "c-612", "c-533", "c-410", "c-289", "c-721", "c-698"],
      "clerk",
      "24 Jul 2026",
      ["self", "Adv. Thomas K. George", "Adv. Priya Nair"],
    ),
  },
  {
    id: "p-rahul",
    name: "Adv. Rahul Menon",
    phone: "94951 66778",
    barId: "K/3105/2022",
    addedBy: "self",
    grants: joinedGrants(
      ["c-847", "c-612", "c-533", "c-410", "c-289"],
      "junior",
      "28 Jul 2026",
      ["self", "Adv. Thomas K. George", "Adv. Meera Pillai"],
    ),
  },
  {
    id: "p-sreeja",
    name: "Adv. Sreeja Mohan",
    phone: "99614 72058",
    barId: "K/3311/2023",
    addedBy: "self",
    grants: [
      { caseId: "c-612", role: "junior", status: "joined", since: "19 Oct 2026", addedBy: "self" },
      { caseId: "c-410", role: "junior", status: "joined", since: "19 Oct 2026", addedBy: "self" },
    ],
  },
  {
    id: "p-leena",
    name: "Adv. Leena S. Nair",
    phone: "97461 40832",
    barId: "K/948/2014",
    addedBy: "Adv. Priya Nair",
    grants: [
      ...joinedGrants(["c-721", "c-698"], "vakalat", "2 Aug 2026"),
      ...joinedGrants(["c-655"], "junior", "5 Aug 2026", ["Adv. Thomas K. George"]),
    ],
  },
];

export type RegisteredUser = {
  name: string;
  /** Spaced, "94950 33417". */
  phone: string;
  /** Advocates only. */
  barId?: string;
  /** The account type — the only two types that can be in an office (OFC-02). */
  type: "advocate" | "clerk";
};

/**
 * Stand-in for DRISTI's registry of advocate and clerk accounts. Office
 * management adds registered users only (owner, 2026-10-21), searched by name,
 * mobile number or Bar ID (OFC-20). Unregistered numbers cannot be added.
 */
export const REGISTERED_USERS: RegisteredUser[] = [
  { name: "Anil Raghavan", phone: "94470 88221", type: "clerk" },
  { name: "Adv. Priya Nair", phone: "94950 33417", barId: "K/2988/2021", type: "advocate" },
  { name: "Adv. Rahul Menon", phone: "94951 66778", barId: "K/3105/2022", type: "advocate" },
  { name: "Sameer K.", phone: "90720 55190", type: "clerk" },
  { name: "Adv. Thomas K. George", phone: "98470 12345", barId: "K/831/2011", type: "advocate" },
  { name: "Adv. Rajesh Kurup", phone: "98470 98765", barId: "K/1204/2015", type: "advocate" },
  { name: "Ramesh Chandran", phone: "98765 01234", type: "clerk" },
  { name: "Arun Das", phone: "94473 66218", type: "clerk" },
  { name: "Adv. Nisha Varghese", phone: "98951 22764", barId: "K/2251/2019", type: "advocate" },
  { name: "Adv. Leena S. Nair", phone: "97461 40832", barId: "K/948/2014", type: "advocate" },
  { name: "Adv. Meera Pillai", phone: "98462 45190", barId: "K/1742/2017", type: "advocate" },
  { name: "Adv. Sreeja Mohan", phone: "99614 72058", barId: "K/3311/2023", type: "advocate" },
  { name: "Akhil Krishnan", phone: "80890 74136", type: "clerk" },
  { name: "Divya Prakash", phone: "70123 45678", type: "clerk" },
  { name: "Adv. Joseph Antony", phone: "94461 20934", barId: "K/1567/2016", type: "advocate" },
  { name: "Adv. Fathima Rasheed", phone: "98953 70412", barId: "K/2730/2020", type: "advocate" },
  { name: "Vishnu Mohan", phone: "81290 66135", type: "clerk" },
  /* The demo's clerk profile (sidebar, Viewing as): add him to see what the
     person added receives (OFC-08). */
  { name: "Vinod Kumar", phone: "94472 31508", type: "clerk" },
];

export function registeredUserByPhone(phone: string): RegisteredUser | undefined {
  const digits = phone.replace(/\D/g, "");
  return REGISTERED_USERS.find((user) => user.phone.replace(/\D/g, "") === digits);
}

export function registeredUserByName(name: string): RegisteredUser | undefined {
  return REGISTERED_USERS.find((user) => user.name === name);
}

/* ------------------------------------------------------------------------ copy */

/* The people field shared by Share access and the join-case team step (owner,
   2026-10-12). Malayalam drafted — needs review. */
export const inviteFieldCopy = {
  placeholder: t(
    "access_searchByNameMobileNumberOrBar",
    "പേര്, മൊബൈൽ നമ്പർ അല്ലെങ്കിൽ ബാർ ഐഡി ഉപയോഗിച്ച് തിരയുക",
  ),
  suggested: t("access_yourOffice", "നിങ്ങളുടെ ഓഫീസ്"),
  inOffice: t("access_inYourOffice", "നിങ്ങളുടെ ഓഫീസിൽ"),
  alreadyInOffice: t("access_alreadyInYourOffice", "ഇതിനകം നിങ്ങളുടെ ഓഫീസിൽ"),
  newNumber: t(
    "access_theyLlGetAnAccessLinkBy",
    "അവർക്ക് SMS വഴിയും DRISTI-യിലും ആക്‌സസ് ലിങ്ക് ലഭിക്കും.",
  ),
  keepTyping: t(
    "access_noRegisteredAdvocateOrClerkMatchesOnly",
    "രജിസ്റ്റർ ചെയ്ത അഭിഭാഷകരോ ക്ലർക്കുമാരോ പൊരുത്തപ്പെടുന്നില്ല. DRISTI-യിൽ രജിസ്റ്റർ ചെയ്തവരെ മാത്രമേ ചേർക്കാനാകൂ.",
  ),
  fullNumber: t(
    "access_typeTheFull10DigitMobileNumber",
    "മുഴുവൻ 10 അക്ക മൊബൈൽ നമ്പർ ടൈപ്പ് ചെയ്യുക.",
  ),
  typeAdvocate: t("access_advocate", "അഭിഭാഷകൻ"),
  typeClerk: t("access_clerk", "ക്ലർക്ക്"),
};

/* The end-of-join office step (OFC-40 to OFC-43). Malayalam drafted — needs review. */
export const joinOfficeCopy = {
  alreadyAdded: t(
    "access_alreadyHaveAccessAsTheyAreOn",
    "'എല്ലാ കേസുകളും' ആയതിനാൽ ഇതിനകം ആക്‌സസ് ഉണ്ട്:",
  ),
};

export const accessShell = {
  navPeople: t("access_people", "ആളുകൾ"),
};

export const shareCopy = {
  title: t("access_shareAccess", "ആക്‌സസ് പങ്കിടുക"),
  scopeManyTitle: t("access_countCasesSelected", "{count} കേസുകൾ തിരഞ്ഞെടുത്തു"),
  bodySingle: t(
    "access_peopleYouAddGetOfficeAccessThey",
    "നിങ്ങൾ ചേർക്കുന്നവർക്ക് ഓഫീസ് ആക്‌സസ് ലഭിക്കും: അവർക്ക് കേസിൽ പ്രവർത്തിക്കാം, പക്ഷേ വക്കാലത്ത്നാമയിൽ ഉണ്ടാകില്ല. പീപ്പിൾ പേജിൽ അവർ നിങ്ങളുടെ ഓഫീസിൽ ചേർക്കപ്പെടും.",
  ),
  phonePlaceholder: t("access_mobileNumber", "മൊബൈൽ നമ്പർ"),
  phoneAdd: t("access_addNumber", "നമ്പർ ചേർക്കുക"),
  phoneError: t("access_enterAValid10DigitMobileNumber", "സാധുവായ 10 അക്ക മൊബൈൽ നമ്പർ നൽകുക."),
  removeChip: t("access_remove", "നീക്കം ചെയ്യുക"),
  suggestionsLabel: t("access_peopleYouOftenAdd", "നിങ്ങൾ പതിവായി ചേർക്കുന്നവർ"),
  send: t("access_share", "പങ്കിടുക"),
  sentNote: t("access_accessGivenTo", "ഇവർക്ക് ആക്‌സസ് നൽകി"),
  /* Says an invite went, not how — SMS or in-app is not settled (owner, 2026-10-13). */
  inviteToast: t("access_accessGivenToNames", "{names} എന്നവർക്ക് ആക്‌സസ് നൽകി"),
  sentBulkNote: t(
    "access_addedToAddedOfTotalCasesAlready",
    "{total}-ൽ {added} കേസുകളിൽ ചേർത്തു · {skipped} കേസിൽ നേരത്തേ ആക്‌സസ് ഉണ്ടായിരുന്നു",
  ),
  sentBulkAllNote: t("access_addedToAllTotalCases", "എല്ലാ {total} കേസുകളിലും ചേർത്തു"),
  alreadyHadAllNote: t(
    "access_alreadyHadAccessToAllSelectedCases",
    "തിരഞ്ഞെടുത്ത എല്ലാ കേസുകളിലും നേരത്തേ ആക്‌സസ് ഉണ്ടായിരുന്നു",
  ),
  whoHasAccess: t("access_whoHasAccess", "ആർക്കൊക്കെ ആക്‌സസ് ഉണ്ട്"),
  accessSearchPlaceholder: t("access_searchPeople", "ആളുകളെ തിരയുക"),
  you: t("access_you", "(നിങ്ങൾ)"),
  statusInvited: t("access_yetToJoin", "ചേരാനുണ്ട്"),
  readOnlyNote: t(
    "access_youHoldOfficeAccessOnThisCase",
    "ഈ കേസിൽ നിങ്ങൾക്ക് ഓഫീസ് ആക്‌സസ് ആയതിനാൽ ആർക്കൊക്കെ ആക്‌സസ് ഉണ്ടെന്ന് കാണാം. ആളുകളെ ചേർക്കുന്നതും നീക്കുന്നതും വക്കാലത്ത്നാമയിലെ അഭിഭാഷകർക്കാണ്.",
  ),
  selfOfficeAccess: t("access_officeAccess", "ഓഫീസ് ആക്‌സസ്"),
};

export const roleCopy: Record<AccessRole, Copy> = {
  vakalat: t("access_throughVakalatnama", "വക്കാലത്ത്നാമ വഴി"),
  clerk: t("access_clerk", "ക്ലർക്ക്"),
  junior: t("access_juniorAdvocate", "ജൂനിയർ അഭിഭാഷക"),
};

export const listCopy = {
  remove: t("access_remove", "നീക്കം ചെയ്യുക"),
  vakalatLocked: t(
    "access_removingAnAdvocateOnTheVakalatnamaNeeds",
    "വക്കാലത്ത്നാമയിലുള്ള അഭിഭാഷകനെ നീക്കം ചെയ്യാൻ കോടതി അപേക്ഷ ആവശ്യമാണ്.",
  ),
  addedByYou: t("access_addedByYou", "നിങ്ങൾ ചേർത്തത്"),
  addedBy: t("access_addedByName", "{name} ചേർത്തത്"),
  otherAdvocateLocked: t(
    "access_addedByNameOnlyTheyCanRemove",
    "{name} ചേർത്തത്. അവർക്ക് മാത്രമേ ഈ ആക്‌സസ് നീക്കം ചെയ്യാനാകൂ.",
  ),
};

export const peopleCopy = {
  title: t("access_people", "ആളുകൾ"),
  subtitle: t(
    "access_yourOfficeTheAdvocatesAndClerksYou",
    "നിങ്ങളുടെ ഓഫീസ്: നിങ്ങളുടെ കേസുകളിലേക്ക് ആക്‌സസ് നൽകിയ അഭിഭാഷകരും ക്ലർക്കുമാരും. ഒരാളുടെ ആക്‌സസ് നിയന്ത്രിക്കാൻ അവരെ തുറക്കുക.",
  ),
  /* Several can be added at once (owner, Oct 26). */
  addPerson: t("access_addPeople", "ആളുകളെ ചേർക്കുക"),
  futureBadge: t("access_allCases", "എല്ലാ കേസുകളും"),
  searchPlaceholder: t("access_searchPeople_d2de656b", "ആളുകളെ തിരയുക…"),
  searchLabel: t("access_search", "തിരയുക"),
  sortLabel: t("access_sortBy", "ക്രമീകരിക്കുക"),
  sortNameAsc: t("access_nameAToZ", "പേര്: A മുതൽ Z വരെ"),
  sortNameDesc: t("access_nameZToA", "പേര്: Z മുതൽ A വരെ"),
  sortCasesDesc: t("access_casesMostToLeast", "കേസുകൾ: കൂടുതൽ മുതൽ കുറവ് വരെ"),
  sortCasesAsc: t("access_casesLeastToMost", "കേസുകൾ: കുറവ് മുതൽ കൂടുതൽ വരെ"),
  caseCount: t("access_countCases", "{count} കേസുകൾ"),
  caseCountOne: t("access_1Case", "1 കേസ്"),
  columnPerson: t("access_person", "വ്യക്തി"),
  columnDesignation: t("access_designation", "പദവി"),
  columnCases: t("access_cases", "കേസുകൾ"),
  designationAdvocate: t("access_advocate", "അഭിഭാഷകൻ"),
  designationClerk: t("access_clerk", "ക്ലർക്ക്"),
  emptyTitle: t("access_noOneInYourOfficeYet", "നിങ്ങളുടെ ഓഫീസിൽ ഇതുവരെ ആരുമില്ല"),
  emptyBody: t(
    "access_addTheAdvocatesAndClerksWhoWork",
    "നിങ്ങളോടൊപ്പം കേസുകളിൽ പ്രവർത്തിക്കുന്ന അഭിഭാഷകരെയും ക്ലർക്കുമാരെയും ചേർക്കുക.",
  ),
  noMatches: t("access_noOneMatchesYourSearch", "തിരച്ചിലിന് അനുയോജ്യമായ ആരുമില്ല."),
  detailCases: t("access_casesTheyCanAccess", "അവർക്ക് ആക്‌സസ് ഉള്ള കേസുകൾ"),
  caseSearchLabel: t("access_searchCases", "കേസുകൾ തിരയുക"),
  caseSearchPlaceholder: t("access_caseNameOrNumber", "കേസിന്റെ പേരോ നമ്പറോ"),
  noCaseMatches: t("access_noMatchingCases", "പൊരുത്തപ്പെടുന്ന കേസുകളില്ല."),
  vakalatCasesHeading: t("access_accessThroughVakalatnama", "വക്കാലത്ത്നാമ വഴിയുള്ള ആക്‌സസ്"),
  /* "Office access", never "administrative access" (user, Sept 2): admin
     reads as all-access elsewhere, which is the opposite of what this is. */
  staffCasesHeading: t("access_officeAccess", "ഓഫീസ് ആക്‌സസ്"),
  staffTooltipLabel: t(
    "access_whatOfficeAccessMeans",
    "ഓഫീസ് ആക്‌സസ് എന്നതിന്റെ അർത്ഥം",
  ),
  staffTooltip: t(
    "access_peopleWhoAreNotOnTheVakalatnama",
    "വക്കാലത്ത്നാമയിൽ ഇല്ലെങ്കിലും കേസിൽ പ്രവർത്തിക്കാൻ ആക്‌സസ് നൽകിയ ക്ലർക്കുമാരും ജൂനിയർ അഭിഭാഷകരും പോലുള്ള ആളുകൾ.",
  ),
  accessGivenOn: t("access_accessGivenOnDate", "{date}-ന് ആക്‌സസ് നൽകി"),
  draft: t("access_draft", "കരട്"),
  barIdLabel: t("access_barId", "ബാർ ഐഡി"),
  closePanel: t("access_closePanel", "പാനൽ അടയ്ക്കുക"),
  vakalatTooltipLabel: t(
    "access_whyVakalatnamaAccessCannotBeRemoved",
    "വക്കാലത്ത്നാമ ആക്‌സസ് നീക്കം ചെയ്യാൻ കഴിയാത്തത് എന്തുകൊണ്ട്",
  ),
  openCase: t("access_openCase", "കേസ് തുറക്കുക"),
  removeFromCase: t("access_remove", "നീക്കം ചെയ്യുക"),
  removeFromAll: t("access_removeFromOffice", "ഓഫീസിൽ നിന്ന് നീക്കം ചെയ്യുക"),
  moreCases: t("access_giveAccessToMoreCases", "കൂടുതൽ കേസുകളിലേക്ക് ആക്‌സസ് നൽകുക"),
  scopeLabel: t("access_access", "ആക്‌സസ്"),
  scopeAll: t("access_allCases", "എല്ലാ കേസുകളും"),
  scopeSpecific: t("access_specificCases", "തിരഞ്ഞെടുത്ത കേസുകൾ"),
  scopeAllHint: t(
    "access_everyCaseYouAreOnTheVakalatnama",
    "നിങ്ങൾ വക്കാലത്ത്നാമയിലുള്ള എല്ലാ കേസുകളും നിങ്ങളുടെ കരടുകളും, ഇപ്പോഴും ഭാവിയിലും. ഓരോ കേസായി നീക്കം ചെയ്യാൻ 'തിരഞ്ഞെടുത്ത കേസുകൾ' ആക്കുക.",
  ),
  scopeSpecificHint: t(
    "access_onlyTheCasesListedBelowNewCases",
    "താഴെ നൽകിയ കേസുകൾ മാത്രം. പുതിയ കേസുകൾ സ്വയമേവ പങ്കിടില്ല.",
  ),
  allCasesShareNote: t("access_allCases", "എല്ലാ കേസുകളും"),
  removeFromThese: t("access_removeFromTheseCases", "ഈ കേസുകളിൽ നിന്ന് നീക്കം ചെയ്യുക"),
  removeOneTitle: t("access_removeNameFromCase", "{name}-നെ {case}-ൽ നിന്ന് നീക്കം ചെയ്യണോ?"),
  removeTheseTitle: t("access_removeNameFromTheseCases", "{name}-നെ ഈ കേസുകളിൽ നിന്ന് നീക്കം ചെയ്യണോ?"),
  selectCaseAria: t("access_selectCasenumber", "{caseNumber} തിരഞ്ഞെടുക്കുക"),
  removeAllTitle: t("access_removeNameFromYourOffice", "{name}-നെ നിങ്ങളുടെ ഓഫീസിൽ നിന്ന് നീക്കം ചെയ്യണോ?"),
  removeAllBody: t(
    "access_theyWillLoseAccessToCountCases",
    "അവർക്ക് {count} കേസുകളിലെ ആക്‌സസ് ഉടൻ നഷ്ടപ്പെടും, അവർ നിങ്ങളുടെ ഓഫീസിൽ നിന്ന് പുറത്താകും. എപ്പോൾ വേണമെങ്കിലും വീണ്ടും ചേർക്കാം.",
  ),
  removeTheseBody: t(
    "access_theyWillLoseAccessToCountCases_7851d6a0",
    "അവർക്ക് {count} കേസുകളിലെ ആക്‌സസ് ഉടൻ നഷ്ടപ്പെടും. എപ്പോൾ വേണമെങ്കിലും വീണ്ടും ആക്‌സസ് പങ്കിടാം.",
  ),
  removeLastBody: t(
    "access_thisIsTheirLastCaseSoThey",
    "ഇത് അവരുടെ അവസാന കേസാണ്, അതിനാൽ അവർ നിങ്ങളുടെ ഓഫീസിൽ നിന്നും പുറത്താകും.",
  ),
  removeBodyOne: t(
    "access_theyWillLoseAccessToThisCase",
    "അവർക്ക് ഈ കേസിലെ ആക്‌സസ് ഉടൻ നഷ്ടപ്പെടും. എപ്പോൾ വേണമെങ്കിലും വീണ്ടും ആക്‌സസ് പങ്കിടാം.",
  ),
  removeAllConfirm: t("access_removeFromOffice", "ഓഫീസിൽ നിന്ന് നീക്കം ചെയ്യുക"),
  removeAllCancel: t("access_cancel", "റദ്ദാക്കുക"),
  removedNote: t("access_nameNoLongerHasAccessToCase", "{name}-ന് ഇനി {case}-ൽ ആക്‌സസ് ഇല്ല."),
  removedAllNote: t("access_nameIsNoLongerInYourOffice", "{name} ഇനി നിങ്ങളുടെ ഓഫീസിൽ ഇല്ല."),
  /* One removal flow, entered from here too: a vakalat row's Remove opens
     the same court-application dialog the Parties tab uses. */
  removalPending: t("access_removalRequested", "നീക്കം ചെയ്യാൻ അഭ്യർത്ഥിച്ചു"),
  /* On office-access cases the Remove stays visible but disabled, with this
     as its tooltip — an absent button reads as a bug, a locked one as a
     rule (owner, Sept 3). */
  officeLockedTooltip: t(
    "access_youHoldOfficeAccessOnThisCase_088d0965",
    "ഈ കേസിൽ നിങ്ങൾക്ക് ഓഫീസ് ആക്‌സസ് ആണ്. ആളുകളെ നീക്കം ചെയ്യുന്നത് വക്കാലത്ത്നാമയിലെ അഭിഭാഷകർക്കാണ്.",
  ),
};

/* One person's access dialog (PM, Oct 23): every case in one table, ticked where they
   have access, so giving and removing access is the same act. "All cases" is one
   choice: every case now and every new one (owner, Oct 24). */
export const personAccessCopy = {
  close: t("access_close", "അടയ്ക്കുക"),
  addTitle: t("access_addPeople", "ആളുകളെ ചേർക്കുക"),
  addIntro: t(
    "access_giveARegisteredAdvocateOrClerkAccess",
    "രജിസ്റ്റർ ചെയ്ത ഒരു അഭിഭാഷകനോ ക്ലർക്കിനോ നിങ്ങളുടെ കേസുകളിലേക്ക് ആക്‌സസ് നൽകുക. നിങ്ങൾ തിരഞ്ഞെടുക്കുന്ന കേസുകളിൽ അവർക്ക് പ്രവർത്തിക്കാം, പക്ഷേ വക്കാലത്ത്നാമയിൽ ഇല്ലാത്തതിനാൽ ഇ-സൈൻ ചെയ്യാനാകില്ല.",
  ),
  groupYourCases: t("access_yourCases", "നിങ്ങളുടെ കേസുകൾ"),
  addAction: t("access_addToOffice", "ഓഫീസിൽ ചേർക്കുക"),
  /* Add person in two steps (owner, Oct 26): who, then what they can access.
     Everyone added together gets the same access. */
  addProgress: t("access_addPersonProgress", "ആളെ ചേർക്കുന്നതിന്റെ പുരോഗതി"),
  stepPeople: t("access_addPeople", "ആളുകളെ ചേർക്കുക"),
  stepAccess: t("access_setAccess", "ആക്‌സസ് നിശ്ചയിക്കുക"),
  peopleHeading: t("access_choosePeople", "ആളുകളെ തിരഞ്ഞെടുക്കുക"),
  accessHeading: t("access_chooseAccess", "ആക്‌സസ് തിരഞ്ഞെടുക്കുക"),
  accessIntroOne: t(
    "access_chooseWhichOfYourCasesTheyCan",
    "അവർക്ക് നിങ്ങളുടെ ഏതൊക്കെ കേസുകളിൽ പ്രവർത്തിക്കാമെന്ന് തിരഞ്ഞെടുക്കുക.",
  ),
  accessIntro: t(
    "access_chooseWhichOfYourCasesTheyCan_7a0f0d62",
    "അവർക്ക് നിങ്ങളുടെ ഏതൊക്കെ കേസുകളിൽ പ്രവർത്തിക്കാമെന്ന് തിരഞ്ഞെടുക്കുക. നിങ്ങൾ ചേർക്കുന്ന എല്ലാവർക്കും ഒരേ ആക്‌സസ് ലഭിക്കും.",
  ),
  scopePlaceholder: t("access_select", "തിരഞ്ഞെടുക്കുക"),
  chooseAccessTitle: t("access_chooseAccessToContinue", "തുടരാൻ ആക്‌സസ് തിരഞ്ഞെടുക്കുക"),
  chooseAccessBody: t(
    "access_pickAllCasesOrSpecificCasesAbove",
    "മുകളിൽ നിന്ന് എല്ലാ കേസുകളും അല്ലെങ്കിൽ തിരഞ്ഞെടുത്ത കേസുകൾ തിരഞ്ഞെടുക്കുക.",
  ),
  noneSelected: t("access_noCasesSelectedYet", "ഇതുവരെ കേസുകളൊന്നും തിരഞ്ഞെടുത്തിട്ടില്ല"),
  futureNoteAdd: t(
    "access_theyLlAccessAllCountOfYour",
    "നിങ്ങളുടെ {count} കേസുകളും അവർക്ക് ആക്‌സസ് ചെയ്യാം. നിങ്ങൾക്ക് ലഭിക്കുന്ന ഓരോ പുതിയ കേസും അവരുമായി സ്വയമേവ പങ്കിടും.",
  ),
  continueAction: t("access_continue", "തുടരുക"),
  back: t("access_back", "തിരികെ"),
  needPerson: t("access_chooseAtLeastOnePerson", "ഒരാളെയെങ്കിലും തിരഞ്ഞെടുക്കുക."),
  needCases: t("access_selectAtLeastOneCase", "ഒരു കേസെങ്കിലും തിരഞ്ഞെടുക്കുക."),
  /* Counts, never names: one person or twenty, the line reads the same
     (owner, Oct 26). */
  addConfirmTitleOne: t("access_add1PersonToYourOffice", "1 ആളെ നിങ്ങളുടെ ഓഫീസിൽ ചേർക്കണോ?"),
  addConfirmTitle: t("access_addCountPeopleToYourOffice", "{count} പേരെ നിങ്ങളുടെ ഓഫീസിൽ ചേർക്കണോ?"),
  addedToastOne: t("access_1PersonAddedToYourOffice", "1 ആളെ നിങ്ങളുടെ ഓഫീസിൽ ചേർത്തു."),
  addedToast: t("access_countPeopleAddedToYourOffice", "{count} പേരെ നിങ്ങളുടെ ഓഫീസിൽ ചേർത്തു."),
  leaveBodyAdd: t(
    "access_thePeopleYouPickedHaveNotBeen",
    "നിങ്ങൾ തിരഞ്ഞെടുത്തവരെ ഇതുവരെ ചേർത്തിട്ടില്ല.",
  ),
  moreActions: t("access_moreActions", "കൂടുതൽ പ്രവർത്തനങ്ങൾ"),
  groupHeld: t("access_hasAccess", "ആക്‌സസ് ഉണ്ട്"),
  groupOther: t("access_noAccessYet", "ഇതുവരെ ആക്‌സസ് ഇല്ല"),
  casesSection: t("access_accessToCases", "കേസുകളിലേക്കുള്ള ആക്‌സസ്"),
  searchPlaceholder: t("access_searchCaseNameOrNumber", "കേസിന്റെ പേരോ നമ്പറോ തിരയുക"),
  casesIntro: t(
    "access_tickACaseToGiveAccessUntick",
    "ആക്‌സസ് നൽകാൻ കേസ് ടിക്ക് ചെയ്യുക. ആക്‌സസ് നീക്കാൻ ടിക്ക് മാറ്റുക.",
  ),
  allCases: t("access_allCases", "എല്ലാ കേസുകളും"),
  allCasesHint: t(
    "access_allCountOfYourCasesAndEvery",
    "നിങ്ങളുടെ {count} കേസുകളും, പിന്നീട് ലഭിക്കുന്ന എല്ലാ പുതിയ കേസുകളും.",
  ),
  specificCases: t("access_specificCases", "തിരഞ്ഞെടുത്ത കേസുകൾ"),
  specificCasesHint: t(
    "access_onlyTheCasesYouPickNewCases",
    "നിങ്ങൾ തിരഞ്ഞെടുക്കുന്ന കേസുകൾ മാത്രം. പുതിയ കേസുകൾ പങ്കിടില്ല.",
  ),
  needMode: t(
    "access_chooseAllCasesOrSpecificCases",
    "എല്ലാ കേസുകളും അല്ലെങ്കിൽ തിരഞ്ഞെടുത്ത കേസുകൾ തിരഞ്ഞെടുക്കുക.",
  ),
  sideLabel: t("access_representation", "പ്രതിനിധാനം"),
  sideAll: t("access_allRepresentations", "എല്ലാ പ്രതിനിധാനങ്ങളും"),
  sideComplainant: t("access_complainant", "പരാതിക്കാരൻ"),
  sideAccused: t("access_accused", "പ്രതി"),
  examplesLabel: t("access_demoTrySearching", "ഡെമോ: തിരഞ്ഞുനോക്കുക"),
  stageLabel: t("access_stage", "ഘട്ടം"),
  stageAll: t("access_allStages", "എല്ലാ ഘട്ടങ്ങളും"),
  stageDisposed: t("access_disposed", "തീർപ്പാക്കി"),
  columnCaseNumber: t("access_caseNumber", "കേസ് നമ്പർ"),
  columnCase: t("access_caseName", "കേസിന്റെ പേര്"),
  columnStage: t("access_stage", "ഘട്ടം"),
  notFiled: t("access_notFiledYet", "ഇതുവരെ ഫയൽ ചെയ്തിട്ടില്ല"),
  openDraft: t("access_openDraft", "കരട് തുറക്കുക"),
  willAdd: t("access_willBeAdded", "ചേർക്കും"),
  willRemove: t("access_willBeRemoved", "നീക്കം ചെയ്യും"),
  selectShown: t("access_tickTheCountCasesShown", "കാണിച്ച {count} കേസുകൾ ടിക്ക് ചെയ്യുക"),
  clearShown: t("access_untickTheCountCasesShown", "കാണിച്ച {count} കേസുകളുടെ ടിക്ക് മാറ്റുക"),
  selectCase: t("access_accessToCase", "{case}-ലേക്കുള്ള ആക്‌സസ്"),
  noCases: t("access_noCasesMatchTheseFilters", "ഈ ഫിൽട്ടറുകൾക്ക് അനുയോജ്യമായ കേസുകളില്ല."),
  pendingAddOne: t("access_1Case_82b8c4c8", "+1 കേസ്"),
  pendingAdd: t("access_countCases_e14ec555", "+{count} കേസുകൾ"),
  pendingRemoveOne: t("access_1Case_ac020c32", "−1 കേസ്"),
  pendingRemove: t("access_countCases_2bbb66d6", "−{count} കേസുകൾ"),
  save: t("access_saveChanges", "മാറ്റങ്ങൾ സേവ് ചെയ്യുക"),
  confirmTitle: t("access_saveChangesToNameSAccess", "{name}-ന്റെ ആക്‌സസിലെ മാറ്റങ്ങൾ സേവ് ചെയ്യണോ?"),
  pointAddAll: t("access_getsAccessToAllCasesCount", "എല്ലാ കേസുകളിലേക്കും ആക്‌സസ് ലഭിക്കും ({count})"),
  confirmFutureOn: t(
    "access_newCasesAreSharedAutomatically",
    "പുതിയ കേസുകൾ സ്വയമേവ പങ്കിടും",
  ),
  confirmOutsideFilter: t(
    "access_someFiltersWereOnSoNotEvery",
    "ചില ഫിൽട്ടറുകൾ ഓണായിരുന്നു, തിരഞ്ഞെടുക്കുമ്പോൾ എല്ലാ കേസുകളും കാണിച്ചിരുന്നില്ല. സ്ഥിരീകരിക്കുന്നതിന് മുമ്പ് ശ്രദ്ധയോടെ പരിശോധിക്കുക.",
  ),
  pointAddOne: t("access_getsAccessTo1Case", "1 കേസിലേക്ക് ആക്‌സസ് ലഭിക്കും"),
  pointAdd: t("access_getsAccessToCountCases", "{count} കേസുകളിലേക്ക് ആക്‌സസ് ലഭിക്കും"),
  pointRemoveOne: t("access_losesAccessTo1Case", "1 കേസിലെ ആക്‌സസ് നഷ്ടപ്പെടും"),
  pointRemove: t("access_losesAccessToCountCases", "{count} കേസുകളിലെ ആക്‌സസ് നഷ്ടപ്പെടും"),
  confirmFutureOff: t(
    "access_newCasesStopBeingSharedAutomatically",
    "പുതിയ കേസുകൾ സ്വയമേവ പങ്കിടുന്നത് നിർത്തും",
  ),
  confirmLeave: t(
    "access_leavesYourOfficeWithNoCasesLeft",
    "കേസുകളൊന്നും ബാക്കിയില്ലാത്തതിനാൽ നിങ്ങളുടെ ഓഫീസിൽ നിന്ന് പുറത്താകും",
  ),
  savedToast: t("access_accessUpdatedForName", "{name}-ന്റെ ആക്‌സസ് പുതുക്കി."),

  /* A person's own access (lead designer, Oct 26): the scope is a dropdown by the
     heading, All cases is a list to look at, Specific cases splits into two tabs,
     and a tick only selects. Every act applies on its own confirmation. */
  scopeLabel: t("access_access", "ആക്‌സസ്"),
  futureNote: t(
    "access_nameCanAccessAllCountOfYour",
    "നിങ്ങളുടെ {count} കേസുകളും {name}-ന് ആക്‌സസ് ചെയ്യാം. നിങ്ങൾക്ക് ലഭിക്കുന്ന ഓരോ പുതിയ കേസും അവരുമായി സ്വയമേവ പങ്കിടും.",
  ),
  casesTabs: t("access_casesByAccess", "ആക്‌സസ് അനുസരിച്ച് കേസുകൾ"),
  /* "Yet" softens it: access can still be given (owner, Oct 26). */
  tabOther: t("access_noAccessYet", "ഇതുവരെ ആക്‌സസ് ഇല്ല"),
  selectHintHeld: t(
    "access_selectCasesToRemoveAccess",
    "ആക്‌സസ് നീക്കാൻ കേസുകൾ തിരഞ്ഞെടുക്കുക.",
  ),
  selectHintOther: t(
    "access_selectCasesToGiveAccess",
    "ആക്‌സസ് നൽകാൻ കേസുകൾ തിരഞ്ഞെടുക്കുക.",
  ),
  selectedOne: t("access_1Selected", "1 തിരഞ്ഞെടുത്തു"),
  selectedMany: t("access_countSelected", "{count} തിരഞ്ഞെടുത്തു"),
  clearSelection: t("access_clear", "മായ്ക്കുക"),
  selectAllShown: t(
    "access_selectAllCount",
    "എല്ലാ {count} എണ്ണവും തിരഞ്ഞെടുക്കുക",
  ),
  selectRow: t("access_selectCase", "{case} തിരഞ്ഞെടുക്കുക"),
  removeAccess: t("access_removeAccess", "ആക്‌സസ് നീക്കുക"),
  giveAccess: t("access_giveAccess", "ആക്‌സസ് നൽകുക"),
  allAction: t(
    "access_giveAccessToAllCases",
    "എല്ലാ കേസുകളിലേക്കും ആക്‌സസ് നൽകുക",
  ),
  emptyOtherTitle: t(
    "access_nameHasEveryCaseYouHave",
    "നിങ്ങളുടെ എല്ലാ കേസുകളും {name}-ന് ഉണ്ട്",
  ),
  emptyOtherBody: t(
    "access_newCasesAreNotSharedWithThem",
    "പുതിയ കേസുകൾ അവരുമായി പങ്കിടില്ല. അവയും പങ്കിടാൻ, എല്ലാ കേസുകളും തിരഞ്ഞെടുക്കുക.",
  ),
  noMatchTitle: t("access_noCasesMatch", "അനുയോജ്യമായ കേസുകളില്ല"),
  noMatchBody: t(
    "access_tryAnotherNameOrNumberOrClear",
    "മറ്റൊരു പേരോ നമ്പറോ ശ്രമിക്കുക, അല്ലെങ്കിൽ ഫിൽട്ടറുകൾ മായ്ക്കുക.",
  ),
  clearFilters: t("access_clearFilters", "ഫിൽട്ടറുകൾ മായ്ക്കുക"),
  removeTitle: t("access_removeNameSAccess", "{name}-ന്റെ ആക്‌സസ് നീക്കണോ?"),
  giveTitle: t("access_giveNameAccess", "{name}-ന് ആക്‌സസ് നൽകണോ?"),
  allTitle: t(
    "access_giveNameAccessToAllCases",
    "{name}-ന് എല്ലാ കേസുകളിലേക്കും ആക്‌സസ് നൽകണോ?",
  ),
  specificTitle: t(
    "access_changeNameSAccessToSpecificCases",
    "{name}-ന്റെ ആക്‌സസ് തിരഞ്ഞെടുത്ത കേസുകളിലേക്ക് മാറ്റണോ?",
  ),
  pointKeep: t(
    "access_keepsAccessToTheCountCasesThey",
    "ഇപ്പോഴുള്ള {count} കേസുകളിലെ ആക്‌സസ് തുടരും",
  ),
  specificAction: t("access_changeToSpecificCases", "തിരഞ്ഞെടുത്ത കേസുകളിലേക്ക് മാറ്റുക"),
  leaveTitle: t("access_discardYourChanges", "നിങ്ങളുടെ മാറ്റങ്ങൾ ഉപേക്ഷിക്കണോ?"),
  leaveBody: t(
    "access_yourChangesToNameSAccessAre",
    "{name}-ന്റെ ആക്‌സസിലെ നിങ്ങളുടെ മാറ്റങ്ങൾ ഇതുവരെ സേവ് ചെയ്തിട്ടില്ല.",
  ),
  leaveConfirm: t("access_discardChanges", "മാറ്റങ്ങൾ ഉപേക്ഷിക്കുക"),
  leaveCancel: t("access_keepEditing", "എഡിറ്റിംഗ് തുടരുക"),
};

/* What the person added sees in their own notifications (OFC-08, N1 to N3).
   In-app only in the prototype; the SMS is not shown. */
export const officeNoticeCopy = {
  addedTitle: t("access_advocateAddedYouToTheirOffice", "{advocate} നിങ്ങളെ അവരുടെ ഓഫീസിൽ ചേർത്തു"),
  addedSpecificOne: t(
    "access_youCanNowWorkOn1Of",
    "അവരുടെ 1 കേസിൽ ഇനി നിങ്ങൾക്ക് പ്രവർത്തിക്കാം.",
  ),
  addedSpecific: t(
    "access_youCanNowWorkOnCountOf",
    "അവരുടെ {count} കേസുകളിൽ ഇനി നിങ്ങൾക്ക് പ്രവർത്തിക്കാം.",
  ),
  addedAll: t(
    "access_youCanNowWorkOnAllTheir",
    "അവരുടെ എല്ലാ കേസുകളിലും, ഇപ്പോഴും ഭാവിയിലും, നിങ്ങൾക്ക് പ്രവർത്തിക്കാം.",
  ),
  sharedTitle: t("access_advocateSharedCaseWithYou", "{advocate} {case} നിങ്ങളുമായി പങ്കിട്ടു"),
  sharedMany: t("access_countCases", "{count} കേസുകൾ"),
  draft: t("access_draft", "കരട്"),
  sharedBodyMany: t("access_theyAreInYourCasesNow", "അവ ഇപ്പോൾ നിങ്ങളുടെ കേസുകളിലുണ്ട്."),
};

export const casesCopy = {
  title: t("access_yourCases", "നിങ്ങളുടെ കേസുകൾ"),
  wireframeNote: t(
    "access_wireframeTheFullCasesScreenIsA",
    "വയർഫ്രെയിം — പൂർണ്ണമായ കേസുകളുടെ സ്ക്രീൻ പ്രത്യേക ഡിസൈനാണ്. പങ്കിടൽ എവിടെ തുടങ്ങുന്നു എന്ന് കാണിക്കാനാണ് ഇത്.",
  ),
  selectAria: t("access_selectCasenumber", "{caseNumber} തിരഞ്ഞെടുക്കുക"),
  selectedCount: t("access_countSelected", "{count} തിരഞ്ഞെടുത്തു"),
  clearSelection: t("access_clearSelection", "തിരഞ്ഞെടുപ്പ് മായ്ക്കുക"),
  shareAccess: t("access_shareAccess", "ആക്‌സസ് പങ്കിടുക"),
  nextHearing: t("access_nextHearingDate", "അടുത്ത വാദം {date}"),
  open: t("access_open", "തുറക്കുക"),
  backToCases: t("access_yourCases", "നിങ്ങളുടെ കേസുകൾ"),
  caseWireframeNote: t(
    "access_wireframeTheCaseFileIsASeparate",
    "വയർഫ്രെയിം — കേസ് ഫയൽ പ്രത്യേക ഡിസൈനാണ്. 'ആക്‌സസ് പങ്കിടുക' ആണ് യഥാർത്ഥ നിയന്ത്രണം.",
  ),
};

/* The Add person flow (OFC-20 to OFC-28). Malayalam drafted — needs review. */
/* Your cases joins the docket, so "All cases" means every case the advocate
   sees there (OFC-25, OFC-52), not only the access fixtures. Drafts arrive at
   run time from the filing store (`AccessProvider`). */
for (const record of CASES) {
  if (ACCESS_CASES.some((c) => c.id === record.id)) continue;
  ACCESS_CASES.push({
    id: record.id,
    title: partiesLabel(record),
    caseNumber: record.caseNumber,
    court: record.court,
    nextHearing: record.nextHearing?.on ?? "—",
    viewerAccess: recordViewerAccess(record).kind,
    stage: record.disposal ? "disposed" : record.stage,
    side: viewerRepresentation(record)[0],
  });
}

/* The access fixtures predate stages. They take one in turn down the active
   ladder so the stage filter has something to narrow; wireframe data only. */
ACCESS_CASES.forEach((entry, index) => {
  if (entry.stage || entry.draft) return;
  entry.stage = ACTIVE_STAGES[index % ACTIVE_STAGES.length].value;
});

/* The access fixtures predate sides too. Most are the complainant's, every
   third the accused's, so the representation filter has both; wireframe data
   only. */
ACCESS_CASES.forEach((entry, index) => {
  if (entry.side) return;
  entry.side = !entry.draft && index % 3 === 2 ? "accused" : "complainant";
});
