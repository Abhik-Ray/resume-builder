import { GoogleGenAI } from "@google/genai";
import { Loader } from "lucide-react";
import { config } from "./config";
import { geminiTest } from "./utils/AIStudioHelpers";
import { useState } from "react";

function App() {
  const aiCore = config.GeminiKey
    ? new GoogleGenAI({ apiKey: config.GeminiKey })
    : null;

  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const onTestGenClick = () => {
    if (!aiCore) return;
    setIsLoading(true);
    geminiTest(aiCore)
      .then((resp) => setResponse(resp.text ?? "No Valid Response"))
      .finally(() => setIsLoading(false));
  };

  return (
    <main className="bg-[#191919] h-screen w-screen text-white flex justify-center align-middle flex-col gap-5 px-10">
      <h1 className="text-white text-4xl">Resume Builder</h1>
      <button
        type="button"
        className="border-white border hover:bg-white hover:text-black h-fit w-fit p-2"
        disabled={!aiCore}
        onClick={onTestGenClick}
      >
        Test GenAI
      </button>
      <div contentEditable role="textbox" className="bg-blue-500 user-bubble text-black p-2 rounded-b-md rounded-tr-md h-fit min-h-6 outline-none wrap-break-word relative">
        {/* <input className=" outline-none w-full"/> */}
      </div>
      <div className="w-full text-black bg-[#C4C7C7] rounded-b-md rounded-tl-md border outline-none p-5 flex justify-center font-mono text-right ai-bubble relative">
          {isLoading ? <Loader className="animate-spin h-5 w-5 self-center"/> : response}
        </div>
    </main>
  );
}

export default App;
