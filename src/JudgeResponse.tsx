import { ChartLine, Flag, MinusCircle, PlusCircle } from "lucide-react";

import type { FC } from "react";
import { Gauge } from "./Guage";
import type { JudgeResponseType } from "./utils/AIResumeJudge";

interface JudgeRespoonsePropsType {
  judgeResponse: JudgeResponseType;
}
export const JudgeResponse: FC<JudgeRespoonsePropsType> = ({
  judgeResponse,
}) => {
  return (
    <div className="flex flex-col w-full h-full justify-center items-center">
      <div className="w-3/4 h-3/4 overflow-none flex flex-col gap-4 border border-blue-500 pl-2 p-1 rounded-2xl">
        <div
          className=" flex flex-col gap-4 mb-4
       overflow-auto scrollbar
      [&::-webkit-scrollbar]:w-1.25 [&::-webkit-scrollbar-track]:bg-transparent
      [&::-webkit-scrollbar-thumb]:bg-slate-400 [&::-webkit-scrollbar-thumb]:rounded-full
      [&::-webkit-scrollbar-button]:display-none
      "
        >
          <div className="w-full flex flex-row justify-center">
            <Gauge value={judgeResponse.overallMatchScore} />
          </div>
          <div className="flex flex-row gap-1">
            <h2 className="font-bold">Remote Preference:</h2>
            <p>{judgeResponse.isRemote}</p>
          </div>
          <div>
            <div className="flex flex-row gap-1">
              <ChartLine className="stroke-blue-400" />{" "}
              <h2 className="font-bold">Match Analysis</h2>
            </div>
            <p>{judgeResponse.matchAnalysis}</p>
          </div>
          <div>
            <div className="flex flex-row gap-1">
              <PlusCircle className="stroke-green-400" />
              <h2 className="font-bold">Pros</h2>
            </div>
            <ol className="list-decimal pl-4">
              {judgeResponse.pros.map((pro, idx) => (
                <li key={idx}>{pro}</li>
              ))}
            </ol>
          </div>
          <div>
            <div className="flex flex-row gap-1">
              <MinusCircle className="stroke-red-400" />
              <h2 className="font-bold">Cons</h2>
            </div>
            <ol className="list-decimal pl-4">
              {judgeResponse.cons.map((con, idx) => (
                <li key={idx}>{con}</li>
              ))}
            </ol>
          </div>
          <div>
            <div className="flex flex-row gap-1">
              <Flag className="stroke-red-400" />
              <h2 className="font-bold">Red Flags</h2>
            </div>
            <ol>
              {judgeResponse.redFlags.map((redFlag, idx) => (
                <li key={idx}>{redFlag}</li>
              ))}
            </ol>
          </div>
          <div className="flex flex-row gap-1">
            <h2 className="font-bold">Final Verdict:</h2>
            <p>{judgeResponse.verdict}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
