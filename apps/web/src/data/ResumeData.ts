import type { ResumeDataType, UserData } from "../types/input";

// Default personal resume content. Seeds the browser DB and is restored by
// "Reset to defaults" in Settings; the app reads the DB copy at runtime.
export const DEFAULT_RESUME_DATA: ResumeDataType = {
  profile: {
    name: "Abhik Ray",
    contacts: [
      "abhik.raya01@gmail.com",
      "+918584063964",
      "Hyderabad, TG",
      "https://www.linkedin.com/in/abhik-ray01/",
      "https://abhik-ray.github.io/portfolio/",
    ],
    education: {
      institute: "KIIT",
      degree: "Bachelor of Technology",
      field: "Computer Science",
    },
  },
  currentRole: "Software Developer",
  yearsOfExperience: "3.5",
  requireRemote: true,
  summary: "Seeking remote-first React or Next roles.",
  hardSkills: [
    "React",
    "Typescript",
    "React Native",
    "Nextjs",
    "Vite",
    "CakePHP",
    "Prisma",
    "Redux Toolkit",
    "Zustand",
    "Jotai",
    "Unit Testing",
    "Vitest",
    "Jest",
    "SSR",
    "Radix UI (shadcn/ui)",
    "TanStack Query",
    "Responsive Web Design",
    "TailwindCSS",
    "XCode",
    "IntelliJ",
    "Leaflet",
    "jQuery",
  ],
  featuredSkills: [
    "React",
    "Next",
    "Typescript",
    "React Native",
    "Prisma",
    "CakePHP",
  ],
  experience: [
    {
      companyName: "Arcadis IBI Group",
      position: "Software Developer II",
      range: "2022 - Present",
      canTweak: true,
      bullets: [
        "Front-end developer focused on Next.js, React, and TypeScript, experienced in building scalable applications, improving developer workflows, and leading small teams. Strong emphasis on clean code, performance, and remote collaboration.",
        "Built and maintained large-scale applications using React, Next.js, TypeScript, and modern tooling.",
        "Led and contributed to front-end architecture, reusable UI components, and performance optimization.",
        "Migrated bundling (Webpack → Vite) and improved developer experience using pre-commit hooks, code quality automation, advanced linting, and TypeScript best practices. Spearheaded transformations from legacy codebases to modern TypeScript + functional components, improving maintainability. Designed and implemented robust authentication flows (JWT access + refresh), role-based access, and scalable data strategies.",
        "Integrated React Leaflet, Google Maps, MapLibre, and geospatial tools to create cost-efficient and scalable mapping solutions.",
        "Improved Lighthouse performance scores to 90+ through code-splitting, memoization, caching, lazy loading, and other optimizations.",
        "Built real-time interactions using WebSockets and introduced Jest + RTL testing culture to reduce bugs by 30%.",
        "Strong contributor to developer experience: module bundlers, code linting, pre-commit workflows, peer reviews, quality checks.",
      ],
      projects: [
        {
          projectName: "Nspace",
          tasks: [
            "Orchestrated a migration from Webpack to Vite that reduced server start time by 80%, and implemented optimizations like code splitting to achieve a Google Lighthouse score above 90%",
            "Engineered a robust room booking system using React Big Calendar, recurring schedules, and 100% accurate timezone handling",
            "Developed an interactive floor plan interface using React Leaflet, enabling administrators to manage layouts and users to visually book desks",
            "Led a major refactoring initiative—converting Class components to Functional TypeScript and migrating Redux to Redux Toolkit—which reduced technical debt and improved task turnaround by 30%",
            "Architected a reusable component library (tables, forms, modals) that decreased code redundancy by 40% and standardized UI design",
            "Deployed the product as a Microsoft Teams App with SSO, a strategic integration that helped secure the retention of enterprise clients",
            "Improved developer experience and code consistency by configuring ESLint, Prettier, and Husky pre-commit hooks",
            "Implemented scalable internationalization (i18n) support and a translation portal to facilitate multi-language usage",
          ],
        },
        {
          projectName: "TravelIQ",
          tasks: [
            "Executed a strategic migration from Google Maps to MapLibre, significantly reducing operational costs while maintaining feature parity for budget-tier users",
            "Integrated HERE APIs to power advanced geospatial functionalities, including routing, geocoding, autocomplete, and Points of Interest (POI) visualization",
          ],
        },
        {
          projectName: "HotSpot Digital Solutions",
          tasks: [
            "Spearheaded a critical React Native framework upgrade across the entire mobile application suite, ensuring long-term platform stability",
            "Architected core improvements to state management and routing logic, which significantly reduced technical debt and minimized regression bugs for future features",
            "Enhanced backend reliability in CakePHP by implementing custom logging behaviors and establishing comprehensive unit testing coverage",
          ],
        },
        {
          projectName: "Lunch App",
          tasks: [
            "Accelerated the end-to-end development of a full-stack Next.js application by leveraging AI-driven workflows (GitHub Copilot), delivering a fully functional MVP under strict deadlines",
            "Engineered responsive frontend interfaces and refined backend architecture to ensure seamless application performance",
          ],
        },
        {
          projectName: "PA Alert Now",
          tasks: [
            "Co-led a frontend team of four within an Agile framework, orchestrating cross-functional collaboration with design, product, and backend stakeholders",
            "Architected and delivered a React application under strict deadlines, integrating Google reCAPTCHA v3, Snyk security scanning, and Google Analytics",
            "Utilized Unit Testing using Vitest which reduced the bugs considerably across sprints",
          ],
        },
        {
          projectName: "Event Management App",
          tasks: [
            "Developed a secure, server-side rendered (SSR) Next.js application featuring comprehensive admin dashboards and a real-time notification system",
            "Engineered a critical SOS feature within a Progressive Web App (PWA), utilizing Service Workers to guarantee instant execution and offline reliability",
          ],
        },
      ],
    },
    {
      companyName: "Arcadis IBI Group",
      position: "Internship",
      range: "2021 - 2022",
      bullets: [
        "Worked on building and maintaining UI features using React and modern JavaScript.",
        "Assisted in developing reusable components and improving overall code structure.",
        "Collaborated with designers and senior developers to implement responsive layouts.",
        "Debugged UI issues and helped improve performance and user experience.",
      ],
    },
    {
      companyName: "HighRadius",
      position: "Internship",
      range: "2021 - 2021",
      bullets: [
        "Contributed to developing a machine learning model aimed at predicting business-related outcomes.",
        "Assisted in data preprocessing, model training, and evaluating prediction results.",
        "Integrated ML outputs into a web interface for visualization and interaction.",
        "Worked on the front end using React to build UI components for the platform.",
        "Learned how ML systems connect with web applications in a production-like environment.",
      ],
    },
  ],
  jobPreferences: {
    desiredRoles: ["Front End Developer", "Software Developer"],
    targetSalary: "More than 15 LPA INR or more than 9 USD/hour",
    preferredWorkModel: "Remote",
    coreTechStack: ["React", "React Native", "Next.js", "Typescript", "Javascript"],
    dealBreakers: ["Hybrid Model", "Chance of layoffs", "Contractual role"],
    careerGoals: "Want to work from home in a stable job",
  },
};

// Bullets of the position the AI rewrites, used as the pre-generation default
export const getTweakableBullets = (data: ResumeDataType) =>
  data.experience.find((exp) => exp.canTweak)?.bullets ?? [];

// Candidate data in the shape the AI prompts expect
export const toUserData = (data: ResumeDataType): UserData => ({
  currentRole: data.currentRole,
  yearsOfExperience: data.yearsOfExperience,
  requireRemote: data.requireRemote,
  rawWorkHistory: data.experience.flatMap((exp) =>
    (exp.projects ?? []).map((project) => ({
      projectName: project.projectName,
      companyName: exp.companyName,
      tasks: project.tasks,
    })),
  ),
  hardSkills: data.hardSkills,
});
