export const SITE_NAME = "ScholarBase";
export const SITE_URL = "https://scholarbase.app";
export const DEFAULT_SEO_IMAGE = "/og-image.png";

export const SEO_SITE = {
    name: SITE_NAME,
    url: SITE_URL,
    defaultImage: DEFAULT_SEO_IMAGE,
    imageAlt: `${SITE_NAME} - Academic Community Platform`,
    category: "Education",
    description:
        "Connect with peers, publish research, find PhD supervisors, discover admissions, academic events, and job vacancies. ScholarBase is the open-source academic community platform.",
    keywords: [
        "academic",
        "research",
        "phd",
        "supervisor",
        "phd admissions",
        "research community",
        "scholar platform",
        "academic jobs",
        "research publications",
        "conference",
        "university",
    ],
    openGraphDescription:
        "Connect with peers, publish your research, find PhD supervisors, and discover opportunities in academia.",
    twitterDescription:
        "Connect with peers, publish research, find supervisors and opportunities.",
    title: {
        default: "ScholarBase - The Academic Hub for Scholars & Researchers",
        template: "%s | ScholarBase",
    },
    twitterTitle: "ScholarBase - The Academic Hub",
    authors: [{ name: "ScholarBase Community" }],
};

export const SEO_PAGES = {
    home: {
        title: "ScholarBase: A Quiet Workspace for the Noisy Academic Life",
        description:
            "Post your research, find honest PhD supervisors, and track admissions, events, and vacancies — all in one free, community-run workspace with no ads or paywalls.",
        path: "/",
    },
    about: {
        title: "About Us | ScholarBase",
        description:
            "Learn about ScholarBase — a free, community-driven academic platform. Discover our motivation, our values, and how we help scholars and academia globally.",
        path: "/about",
        keywords: [
            "about ScholarBase",
            "academic networking platform",
            "free platform for researchers",
            "academic community",
            "PhD admissions and research opportunities",
        ],
    },
    blog: {
        title: "Research Blog - Insights, Guides & Essays",
        description:
            "Essays, guides, and longer-form research reflections on academia, publishing, and scholarly life.",
        path: "/blog",
        section: "Blog",
    },
    careers: {
        title: "Careers | ScholarBase",
        description:
            "Join ScholarBase — an unpaid early-career opportunity in growth marketing, software QA, or research curation on a live academic platform. Send your CV and grow with us.",
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
        title: "Research Feed - Community Research Updates",
        description:
            "Short research updates, news, and conversations from the academic community on ScholarBase.",
        path: "/feed",
        section: "Community",
    },
    surveys: {
        title: "Research Surveys - Participate & Contribute",
        description:
            "Create and participate in research surveys built for the academic community.",
        path: "/surveys",
        section: "Surveys",
    },
    results: {
        title: "Academic Results - Admissions, Exams & Notifications",
        description:
            "Admission results, exam outcomes, vacancy results, and other important academic notifications.",
        path: "/results",
        section: "Results",
    },
    researchTools: {
        title: "Research Tools & Software for Academics",
        description:
            "Discover and share software, apps, and digital tools that can help with your research.",
        path: "/research-tools",
        section: "Research Tools",
    },
    scholars: {
        title: "Scholars",
        description:
            "Discover, search, and connect with scholars by reputation, expertise, and activity.",
        path: "/scholars",
        section: "Scholars",
    },
    contributions: {
        title: "Contributions - Support ScholarBase",
        description:
            "Support ScholarBase and see how the community fuels its servers, infrastructure, and growth.",
        path: "/contributions",
        section: "Contributions",
    },
    help: {
        title: "Scholar Suggest - ScholarBase",
        description:
            "Share suggestions, bug reports, or new feature request for ScholarBase with the community.",
        path: "/help",
        section: "Help & Support",
    },
    publications: {
        title: "Academic Publications - Research, Preprints & Books",
        description:
            "Browse and discover academic publications — research papers, conference proceedings, preprints, books, and more.",
        path: "/publications",
        section: "Publications",
    },
    admissions: {
        title: "Admissions - PhD & Academic Programs",
        description:
            "Explore PhD and research opportunities, admissions deadlines, and application guidance from the academic community.",
        path: "/admissions",
        section: "Admissions",
    },
    vacancies: {
        title: "Academic Vacancies & Jobs",
        description:
            "Find research positions, academic jobs, fellowships, and vacancies shared by the scholar community.",
        path: "/vacancies",
        section: "Vacancies",
    },
    events: {
        title: "Academic Events & Conferences",
        description:
            "Conferences, workshops, calls for papers, and academic gatherings worth tracking around the world.",
        path: "/events",
        section: "Events",
    },
    journals: {
        title: "Academic Journals & Reviews",
        description:
            "Explore journals, read peer reviews, and discover publication opportunities in academia.",
        path: "/journals",
        section: "Journals",
    },
    learn: {
        title: "Learn - Academic Courses & Resources",
        description:
            "Find and share research learning courses from YouTube, Udemy, universities, and other learning platforms.",
        path: "/learn",
        section: "Learn",
    },
    grants: {
        title: "Research Grants & Funding",
        description:
            "Discover and apply for research grants, funding opportunities, and scholarly support.",
        path: "/grants",
        section: "Grants",
    },
    supervisor: {
        title: "Find PhD Supervisors & Mentors",
        description:
            "Search for PhD supervisors by university and department, and read student ratings and recommendations.",
        path: "/supervisor",
        section: "Supervisors",
    },
    privacy: {
        title: "Privacy Policy - ScholarBase",
        description: "Read the ScholarBase privacy policy and how data is handled on the platform.",
        path: "/privacy",
    },
    terms: {
        title: "Terms & Conditions - ScholarBase",
        description: "Review the terms that govern participation and use of the ScholarBase platform.",
        path: "/terms",
    },
    contact: {
        title: "Contact ScholarBase",
        description: "Get in touch with the ScholarBase team and community support channels.",
        path: "/contact",
    },
};

export const SEO_CREATE_PAGES = {
    blog: {
        title: "Write a Blog Post",
        description:
            "Share your research insights, experiences, and academic perspectives with the ScholarBase community.",
    },
    contributions: {
        title: "Make a Contribution",
        description: "Support ScholarBase development by making a contribution.",
    },
    admissions: {
        title: "Post PhD Admission Notification",
        description:
            "Share PhD admissions, call for applications, and academic intake notifications with researchers.",
    },
    events: {
        title: "List a Research Event / Conference",
        description:
            "Add conferences, calls for papers, and academic events that matter to researchers.",
    },
    grants: {
        title: "Add Research Grant",
        description:
            "Share a research grant, funding amount, application guidance, and useful links.",
    },
    help: {
        title: "Post Help / Feedback",
        description:
            "Report bugs, request features, or provide feedback to improve ScholarBase.",
    },
    journals: {
        title: "Add Journal",
        description: "Add an academic journal with its rankings and impact factor.",
    },
    learn: {
        title: "Add Course",
        description:
            "Share a research learning course and its outcomes, instructor, provider, and link.",
    },
    publications: {
        title: "Add a Publication",
        description:
            "Share a research paper, article, or academic publication with the ScholarBase community.",
    },
    researchTools: {
        title: "Add a Research Tool",
        description:
            "Share a research method, software, toolkit, or scholarly resource with the academic community.",
    },
    results: {
        title: "Add a Result",
        description:
            "Share a research result, outcome, or milestone with the ScholarBase community.",
    },
    supervisor: {
        title: "Add a Supervisor",
        description:
            "Create a supervisor profile and tell the academic community about your research mentorship interests.",
    },
    surveys: {
        title: "Create a Survey",
        description:
            "Launch a survey to gather responses and insights from the ScholarBase community.",
    },
    vacancies: {
        title: "Post a Vacancy",
        description:
            "Share an academic, research, or industry opportunity with the ScholarBase community.",
    },
} as const;

export const SEO_NOINDEX = {
    login: "Sign in - ScholarBase",
    admin: "Admin - ScholarBase",
    notifications: "Notifications - ScholarBase",
    newMessage: "New Message - ScholarBase",
    authCodeError: "Authentication - ScholarBase",
    accountConfirmed: "Account Confirmed - ScholarBase",
    updatePassword: "Update Password - ScholarBase",
    requestInstitution: "Request Institution - ScholarBase",
    reviewCreate: "Add Review - ScholarBase",
    articleCreate: "Write New Article - ScholarBase",
    publicationCreate: "Add Publication - ScholarBase",
    researchToolCreate: "Add Research Tool - ScholarBase",
    eventCreate: "Add Event - ScholarBase",
    resultCreate: "Add Result - ScholarBase",
    admissionCreate: "Add Admission - ScholarBase",
    scholarshipCreate: "Add Scholarship - ScholarBase",
    vacancyCreate: "Add Vacancy - ScholarBase",
    grantCreate: "Add Grant - ScholarBase",
    contributionCreate: "Support ScholarBase - ScholarBase",
    journalCreate: "Add Journal - ScholarBase",
    learnCreate: "Add Learning Resource - ScholarBase",
    helpCreate: "Create Help Post - ScholarBase",
} as const;
