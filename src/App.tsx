import { GoogleGenAI } from "@google/genai";
import {Loader2} from 'lucide-react'
import { MainExperienceData } from "./data/MainExperienceData";
import { MyDocument } from "./pdf";
import { PDFViewer } from "@react-pdf/renderer";
import { SkillsData } from "./data/SkillsData";
import { SummaryData } from "./data/SummaryData";
import { config } from "./config";
import { generateResumeSection } from "./utils/AIResumeBuilder";
import { useState } from "react";
import { userData } from "./data/UserData";

function App() {
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [summaryData, setSummaryData] = useState(SummaryData);
  const [experienceData, setExperienceData] = useState<string[]>(MainExperienceData);
  const [skillsData, setSkillsData] = useState(SkillsData);
  const [jobDescription, setJobDescription] = useState<string>("");
  const aiCore = config.GeminiKey
    ? new GoogleGenAI({ apiKey: config.GeminiKey })
    : null;

  const genarateSummary = async () => {
    if(!aiCore) return;
    return generateResumeSection(aiCore, 'summary', jobDescription, userData)
  }

  const genarateExperienceData = async () => {
    if(!aiCore) return;
    return generateResumeSection(aiCore, 'experience', jobDescription, userData)
  }

  const genarateSkills = async () => {
    if(!aiCore) return;
    return generateResumeSection(aiCore, 'skills', jobDescription, userData)
  }

  const onGenerateClick = async () => {
    if(!aiCore) return;
    setIsPdfLoading(true);
    const summary = await genarateSummary();
    const skills = await genarateSkills();
    const experience = await genarateExperienceData();
    
    setSummaryData(summary['summary']);
    setSkillsData(skills?.['technicalSkills'])
    setExperienceData(experience['bulletPoints']);
    setIsPdfLoading(false);
  }


  return (
    <main className="bg-[#191919] h-screen w-screen text-white flex justify-center align-middle flex-row">
      <section className="flex-1 p-10 relative h-full flex flex-col gap-4">
        <h1 className="text-white text-4xl">Resume Builder</h1>
        <div className="flex flex-col my-2 gap-2">
          <label htmlFor="job-description">Job Description</label>
          <textarea
            name="job-description"
            id="job-description"
            className="border border-white p-1 outline-none resize-none h-100"
            onChange={(val) => {
              setJobDescription(val.target.value);
            }}
            value={jobDescription}
          />
        </div>
        <div>
          <button
            type="button"
            onClick={onGenerateClick}
            className="bg-violet-600 hover:bg-violet-400 p-2 rounded-md disabled:bg-gray-500"
            disabled={!jobDescription}
          >
            Generate
          </button>
        </div>
      </section>
      <section className="flex-1">
        {isPdfLoading && <div className="h-full w-full flex items-center justify-center">
          <Loader2 className="animate-spin"/>
          </div>
        }
        <PDFViewer className={`h-full w-full ${isPdfLoading ? "hidden" : ""}`}>
          <MyDocument
            summaryData={summaryData}
            mainExperienceData={experienceData}
            skillsData={skillsData}
          />
        </PDFViewer>
      </section>
    </main>
  );
}

export default App;
