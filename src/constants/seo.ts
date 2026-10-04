export const SITE_NAME = "ScholarBase";
export const SITE_URL = "https://scholarbase.app";
export const DEFAULT_SEO_IMAGE = "/og-image.png";

export const formatPageTitle = (title: string): string => {
    const clean = title.trim();
    if (!clean) return SITE_NAME;

    const normalized = clean.replace(new RegExp(`\\s*\\|\\s*${SITE_NAME}$`, "i"), "").trim();
    if (!normalized) return SITE_NAME;

    return `${normalized} | ${SITE_NAME}`;
};

export const SEO_SITE = {
    name: SITE_NAME,
    url: SITE_URL,
    defaultImage: DEFAULT_SEO_IMAGE,
    imageAlt: `${SITE_NAME} - Academic community for scholars and researchers`,
    category: "Education",
    description:
        "Discover research communities, PhD supervisors, admissions, academic events, and opportunities on ScholarBase.",
    keywords: [
        "academic community",
        "research platform",
        "scholar network",
        "phd supervisors",
        "phd admissions",
        "research events",
        "academic jobs",
        "research publications",
        "scholars",
        "university",
    ],
    openGraphDescription:
        "Connect with scholars, share research, find supervisors, and discover new academic opportunities.",
    twitterDescription:
        "A research and academic community for scholars, supervisors, and institutions.",
    title: {
        default: "ScholarBase | Academic community for scholars and researchers",
        template: "%s | ScholarBase",
    },
    twitterTitle: "ScholarBase | Academic community",
    authors: [{ name: "ScholarBase Community" }],
};

export const SEO_PAGES = {
    home: {
        title: "ScholarBase | Academic community for scholars and researchers",
        description:
            "Join ScholarBase to share research, find PhD supervisors, and discover admissions, events, vacancies, and academic opportunities.",
        path: "/",
    },
    login: {
        title: "Sign in | ScholarBase",
        description: "Sign in to ScholarBase to join discussions, discover opportunities, and manage your research profile.",
        path: "/login",
    },
    requestInstitution: {
        title: "Request institution access | ScholarBase",
        description: "Request institution access on ScholarBase to verify your academic affiliation and unlock institutional features.",
        path: "/request-institution",
    },
    newMessage: {
        title: "New message | ScholarBase",
        description: "Send a new message to a scholar or collaborator on ScholarBase and keep your academic network connected.",
        path: "/messages/new",
    },
    about: {
        title: "About | ScholarBase",
        description:
            "Learn about ScholarBase, a community platform for researchers, scholars, faculty, and academic teams.",
        path: "/about",
        keywords: [
            "about ScholarBase",
            "academic networking platform",
            "research community",
            "academic platform",
            "scholars and researchers",
        ],
    },
    blog: {
        title: "Research Blog | ScholarBase",
        description:
            "Read essays, research reflections, and academic insights from the ScholarBase community.",
        path: "/blog",
        section: "Blog",
    },
    careers: {
        title: "Careers | ScholarBase",
        description:
            "Explore opportunities to help grow ScholarBase and contribute to a research-driven academic community.",
        path: "/careers",
        keywords: [
            "ScholarBase careers",
            "volunteer growth marketing",
            "software testing internship",
            "QA training for beginners",
            "early career opportunity",
            "research curation",
            "academic content curator",
        ],
    },
    feed: {
        title: "Research Feed | ScholarBase",
        description:
            "Follow research updates, academic discussions, and community posts from scholars on ScholarBase.",
        path: "/feed",
        section: "Community",
    },
    surveys: {
        title: "Research Surveys | ScholarBase",
        description:
            "Create or participate in academic surveys designed for scholars, students, and research communities.",
        path: "/surveys",
        section: "Surveys",
    },
    results: {
        title: "Academic Results | ScholarBase",
        description:
            "Track admissions, exam results, and academic updates shared by the ScholarBase community.",
        path: "/results",
        section: "Results",
    },
    researchTools: {
        title: "Research Tools | ScholarBase",
        description:
            "Discover software, workflows, and digital tools for academic research and scholarly work.",
        path: "/research-tools",
        section: "Research Tools",
    },
    scholars: {
        title: "Scholars | ScholarBase",
        description:
            "Explore scholars by expertise, reputation, and research interests on the ScholarBase network.",
        path: "/scholars",
        section: "Scholars",
    },
    contributions: {
        title: "Contributions | ScholarBase",
        description:
            "Support ScholarBase and help sustain the research community, infrastructure, and platform growth.",
        path: "/contributions",
        section: "Contributions",
    },
    help: {
        title: "Help & Feedback | ScholarBase",
        description:
            "Share feedback, report issues, or ask for help from the ScholarBase community.",
        path: "/help",
        section: "Help & Support",
    },
    publications: {
        title: "Academic Publications | ScholarBase",
        description:
            "Browse research papers, preprints, conference work, and academic publications on ScholarBase.",
        path: "/publications",
        section: "Publications",
    },
    admissions: {
        title: "Admissions | ScholarBase",
        description:
            "Discover PhD admissions, funding opportunities, and academic intake information from the academic community.",
        path: "/admissions",
        section: "Admissions",
    },
    vacancies: {
        title: "Academic Vacancies | ScholarBase",
        description:
            "Find research roles, academic jobs, and opportunities shared across the ScholarBase network.",
        path: "/vacancies",
        section: "Vacancies",
    },
    events: {
        title: "Academic Events | ScholarBase",
        description:
            "Discover conferences, workshops, calls for papers, and academic events from around the world.",
        path: "/events",
        section: "Events",
    },
    journals: {
        title: "Academic Journals | ScholarBase",
        description:
            "Browse journals, publication opportunities, and peer review information across academia.",
        path: "/journals",
        section: "Journals",
    },
    learn: {
        title: "Learn | ScholarBase",
        description:
            "Explore courses, learning resources, and research study material for scholars and academics.",
        path: "/learn",
        section: "Learn",
    },
    grants: {
        title: "Research Grants | ScholarBase",
        description:
            "Find funding opportunities and research grants for scholars, labs, and academic teams.",
        path: "/grants",
        section: "Grants",
    },
    supervisor: {
        title: "PhD Supervisors | ScholarBase",
        description:
            "Find supervisors, mentors, and research guidance by university, department, and academic expertise.",
        path: "/supervisor",
        section: "Supervisors",
    },
    privacy: {
        title: "Privacy Policy | ScholarBase",
        description: "Read the ScholarBase privacy policy and how your data is handled on the platform.",
        path: "/privacy",
    },
    terms: {
        title: "Terms & Conditions | ScholarBase",
        description: "Review the terms governing use of the ScholarBase platform and community.",
        path: "/terms",
    },
    contact: {
        title: "Contact | ScholarBase",
        description: "Get in touch with the ScholarBase team and community support channels.",
        path: "/contact",
    },
};

export const SEO_CREATE_PAGES = {
    blog: {
        title: "Write a blog post | ScholarBase",
        description:
            "Share your research insights, experiences, and academic perspectives with the ScholarBase community.",
    },
    contributions: {
        title: "Make a contribution | ScholarBase",
        description: "Support ScholarBase development and help grow a research-first academic community.",
    },
    admissions: {
        title: "Post a PhD admission | ScholarBase",
        description:
            "Share PhD admissions, calls for applications, and intake notices with researchers and scholars.",
    },
    events: {
        title: "List an academic event | ScholarBase",
        description:
            "Add conferences, calls for papers, and academic events that matter to researchers.",
    },
    grants: {
        title: "Add a research grant | ScholarBase",
        description:
            "Share a funding opportunity, application details, and research support with the community.",
    },
    help: {
        title: "Post help or feedback | ScholarBase",
        description:
            "Report bugs, request features, or share feedback to improve the ScholarBase platform.",
    },
    journals: {
        title: "Add a journal | ScholarBase",
        description: "Add an academic journal, publication details, and its impact information.",
    },
    learn: {
        title: "Add a course | ScholarBase",
        description:
            "Share a learning resource, course, provider, and key details with the research community.",
    },
    publications: {
        title: "Add a publication | ScholarBase",
        description:
            "Share a research paper, article, or academic publication with the ScholarBase community.",
    },
    researchTools: {
        title: "Add a research tool | ScholarBase",
        description:
            "Share a software tool, workflow, or scholarly resource with the academic community.",
    },
    results: {
        title: "Add a result | ScholarBase",
        description:
            "Share a research result, academic update, or milestone with the ScholarBase community.",
    },
    supervisor: {
        title: "Add a supervisor | ScholarBase",
        description:
            "Create a supervisor profile and highlight academic mentorship and research guidance.",
    },
    surveys: {
        title: "Create a survey | ScholarBase",
        description:
            "Launch a survey to gather responses and research insights from the ScholarBase community.",
    },
    vacancies: {
        title: "Post a vacancy | ScholarBase",
        description:
            "Share a research or academic opportunity with scholars, students, and faculty on ScholarBase.",
    },
} as const;

export const CREATE_PAGE_TEXT = {
    blog: {
        title: "Write a Blog Post",
        description:
            "Share your research insights, experiences, and academic perspectives with the ScholarBase community.",
    },
    contributions: {
        title: "Make a Contribution",
        description: "Support ScholarBase development and help grow a research-first academic community.",
    },
    admissions: {
        title: "Post a PhD Admission",
        description:
            "Share PhD admissions, calls for applications, and intake notices with researchers and scholars.",
    },
    events: {
        title: "List an Academic Event",
        description:
            "Add conferences, calls for papers, and academic events that matter to researchers.",
    },
    grants: {
        title: "Add a Research Grant",
        description:
            "Share a funding opportunity, application details, and research support with the community.",
    },
    help: {
        title: "Post Help or Feedback",
        description:
            "Report bugs, request features, or share feedback to improve the ScholarBase platform.",
    },
    journals: {
        title: "Add a Journal",
        description: "Add an academic journal, publication details, and its impact information.",
    },
    learn: {
        title: "Add a Course",
        description:
            "Share a learning resource, course, provider, and key details with the research community.",
    },
    publications: {
        title: "Add a Publication",
        description:
            "Share a research paper, article, or academic publication with the ScholarBase community.",
    },
    researchTools: {
        title: "Add a Research Tool",
        description:
            "Share a software tool, workflow, or scholarly resource with the academic community.",
    },
    results: {
        title: "Add a Result",
        description:
            "Share a research result, academic update, or milestone with the ScholarBase community.",
    },
    supervisor: {
        title: "Add a Supervisor",
        description:
            "Create a supervisor profile and highlight academic mentorship and research guidance.",
    },
    surveys: {
        title: "Create a Survey",
        description:
            "Launch a survey to gather responses and research insights from the ScholarBase community.",
    },
    vacancies: {
        title: "Post a Vacancy",
        description:
            "Share a research or academic opportunity with scholars, students, and faculty on ScholarBase.",
    },
} as const;

export const EDIT_PAGE_TEXT = {
    publications: {
        title: "Edit Publication",
        description:
            "Update the publication details, metadata, or abstract.",
    },
    researchTools: {
        title: "Edit Research Tool",
        description:
            "Update the description, use case, or website link for this tool.",
    },
    contributions: {
        title: "Edit Contribution",
        description: "Update your contribution details.",
    },
    learn: {
        title: "Edit Course",
        description:
            "Update the course details, learning outcomes, or link.",
    },
    vacancies: {
        title: "Edit Academic Vacancy",
        description:
            "Update the job details, application deadlines, or links.",
    },
    blog: {
        title: "Edit Article",
    },
    events: {
        title: "Edit Research Event",
        description:
            "Update the conference dates, links, or description.",
    },
    journals: {
        title: "Edit Journal Details",
        description:
            "Update metrics, descriptions, or links for this journal.",
    },
    results: {
        title: "Edit Result Information",
        description:
            "Update the result details, links, or description.",
    },
    grants: {
        title: "Edit Research Grant",
        description:
            "Update funding details, application guidance, or links.",
    },
    help: {
        title: "Edit Help Post",
        description:
            "Update your question, category, or message details.",
    },
    surveys: {
        title: "Edit Research Survey",
        description:
            "Update your survey questions and settings.",
    },
    supervisor: {
        title: "Edit Supervisor",
    },
    admissions: {
        title: "Edit PhD Admission Notification",
        description:
            "Update the admission criteria, deadlines, or seat matrix requirements.",
    },
    feed: {
        title: "Edit Post",
        description: "Edit your social post.",
    },
    journalReview: {
        title: "Edit your Journal Review",
        description: "Update your review for this journal.",
    },
    recommendation: {
        title: "Edit your Recommendation",
        description:
            "Update your mentorship feedback for this supervisor.",
    },
    settings: {
        title: "Account Settings",
        description: "Manage your profile and account security.",
    },
} as const;

export const LIST_PAGE_TEXT = {
    researchTools: {
        title: "Research Tools",
        description:
            "Discover and share tools that can help with your research.",
    },
    results: {
        title: "Results",
        description:
            "Admission results, vacancy outcomes, exam results, and other important notifications.",
    },
    blog: {
        title: "Research Blog",
        description:
            "Essays, notes, and longer-form research reflections.",
    },
    surveys: {
        title: "Research Survey",
        description:
            "Create and participate in research surveys. Better than Google Forms — built for the academic community.",
    },
    publications: {
        title: "Publications",
        description:
            "Browse and discover academic publications — research papers, conference proceedings, books, and more.",
    },
    vacancies: {
        title: "Academic Vacancies",
        description:
            "Contract, guest, and permanent openings across institutions.",
    },
    events: {
        title: "Research Events & Conference",
        description:
            "Conferences, calls, and academic gatherings worth tracking.",
    },
    scholars: {
        title: "Find Scholars",
        description:
            "Search researchers, collaborators, and peers across the community.",
    },
    journals: {
        title: "Journals",
        description:
            "Browse and discover academic journals reviewed by scholars.",
    },
    help: {
        title: "Scholar Suggest",
        description:
            "Share posts, suggestions, bug reports, or new feature ideas with the community.",
    },
    feed: {
        title: "Research Feed",
        description:
            "Short research updates from the community.",
    },
    admissions: {
        title: "PhD Admissions",
        description:
            "Admissions and seat notifications from universities.",
    },
    contributions: {
        title: "Contributions",
        description:
            "Support ScholarBase and see who's contributing to the community.",
    },
    learn: {
        title: "Courses",
        description:
            "Discover practical courses for research methods, writing, analysis, publishing, and scholarly skills.",
    },
    grants: {
        title: "Research Grants",
        description:
            "Share funding opportunities, application guidance, research scholarships, and useful grant information with scholars.",
    },
    supervisor: {
        title: "Find a Supervisor",
        description:
            "Read and share mentorship experiences from fellow scholars.",
    },
} as const;

export const SEO_NOINDEX = {
    admin: "Admin | ScholarBase",
    notifications: "Notifications | ScholarBase",
    authCodeError: "Authentication | ScholarBase",
    accountConfirmed: "Account Confirmed | ScholarBase",
    updatePassword: "Update Password | ScholarBase",
} as const;
