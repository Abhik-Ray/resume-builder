import { ChartLine, Flag, MinusCircle, PlusCircle, type LucideIcon } from "lucide-react";

import type { FC, ReactNode } from "react";
import { Gauge } from "./Gauge";
import type { JudgeResponseType } from "../../utils/AIResumeJudge";

interface JudgeResponsePropsType {
  judgeResponse: JudgeResponseType;
}

const Card = ({
  title,
  icon: Icon,
  iconClassName,
  children,
}: {
  title: string;
  icon: LucideIcon;
  iconClassName: string;
  children: ReactNode;
}) => (
  <section className="flex flex-col gap-2 rounded-lg border p-4">
    <h3 className="flex items-center gap-2 text-sm font-semibold">
      <Icon className={`size-4 ${iconClassName}`} />
      {title}
    </h3>
    {children}
  </section>
);

const List = ({ items, empty }: { items: string[]; empty: string }) =>
  items.length ? (
    <ul className="flex list-disc flex-col gap-1 pl-4 text-sm">
      {items.map((item, idx) => (
        <li key={idx}>{item}</li>
      ))}
    </ul>
  ) : (
    <p className="text-sm text-muted-foreground">{empty}</p>
  );

export const JudgeResponse: FC<JudgeResponsePropsType> = ({ judgeResponse }) => (
  <div className="flex flex-col gap-4">
    <section className="flex flex-col items-center gap-4 rounded-lg border p-4 sm:flex-row sm:gap-8">
      <Gauge value={judgeResponse.overallMatchScore} size={200} />
      <dl className="flex flex-col gap-3 text-sm">
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Verdict</dt>
          <dd className="text-base font-semibold">{judgeResponse.verdict}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Remote</dt>
          <dd>{judgeResponse.isRemote}</dd>
        </div>
      </dl>
    </section>
    <Card title="Match analysis" icon={ChartLine} iconClassName="text-blue-500">
      <p className="text-sm">{judgeResponse.matchAnalysis}</p>
    </Card>
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="Pros" icon={PlusCircle} iconClassName="text-green-600">
        <List items={judgeResponse.pros} empty="None found" />
      </Card>
      <Card title="Cons" icon={MinusCircle} iconClassName="text-red-500">
        <List items={judgeResponse.cons} empty="None found" />
      </Card>
    </div>
    <Card title="Red flags" icon={Flag} iconClassName="text-red-500">
      <List items={judgeResponse.redFlags} empty="No red flags found" />
    </Card>
  </div>
);
