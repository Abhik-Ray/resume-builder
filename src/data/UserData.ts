import type { UserData } from "../types/input";

export const userData: UserData = {
    currentRole: "Software Developer",
    yearsOfExperience: "3.5",
    requireRemote: true,
    rawWorkHistory: [
      {
        projectName: "Nspace",
        companyName: "Arcadis IBI",
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
        companyName: "Arcadis IBI",
        tasks: [
          "Executed a strategic migration from Google Maps to MapLibre, significantly reducing operational costs while maintaining feature parity for budget-tier users",
          "Integrated HERE APIs to power advanced geospatial functionalities, including routing, geocoding, autocomplete, and Points of Interest (POI) visualization",
        ],
      },
      {
        projectName: "HotSpot Digital Solutions",
        companyName: "Arcadis IBI",
        tasks: [
          "Spearheaded a critical React Native framework upgrade across the entire mobile application suite, ensuring long-term platform stability",
          "Architected core improvements to state management and routing logic, which significantly reduced technical debt and minimized regression bugs for future features",
          "Enhanced backend reliability in CakePHP by implementing custom logging behaviors and establishing comprehensive unit testing coverage",
        ],
      },
      {
        projectName: "Lunch App",
        companyName: "Arcadis IBI",
        tasks: [
          "Accelerated the end-to-end development of a full-stack Next.js application by leveraging AI-driven workflows (GitHub Copilot), delivering a fully functional MVP under strict deadlines",
          "Engineered responsive frontend interfaces and refined backend architecture to ensure seamless application performance",
        ],
      },
      {
        projectName: "PA Alert Now",
        companyName: "Arcadis IBI",
        tasks: [
          "Co-led a frontend team of four within an Agile framework, orchestrating cross-functional collaboration with design, product, and backend stakeholders",
          "Architected and delivered a React application under strict deadlines, integrating Google reCAPTCHA v3, Snyk security scanning, and Google Analytics",
          "Utilized Unit Testing using Vitest which reduced the bugs considerably across sprints"
        ],
      },
      {
        projectName: "Event Management App",
        companyName: "Arcadis IBI",
        tasks: [
          "Developed a secure, server-side rendered (SSR) Next.js application featuring comprehensive admin dashboards and a real-time notification system",
          "Engineered a critical SOS feature within a Progressive Web App (PWA), utilizing Service Workers to guarantee instant execution and offline reliability",
        ],
      },
    ],
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
  };