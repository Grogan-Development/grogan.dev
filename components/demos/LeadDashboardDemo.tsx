"use client";

import { useState } from "react";
import { DemoWindow } from "./DemoWindow";
import { DemoStepper } from "./DemoStepper";
import { DemoPanel } from "./DemoPanel";
import { DemoButton, DemoMeta, DemoStat } from "./demoUi";

const LEADS = [
  { id: 1, name: "Mike R.", source: "Phone", action: "Call back", due: "Today" },
  { id: 2, name: "Sarah T.", source: "Website", action: "Send quote", due: "Tomorrow" },
  { id: 3, name: "ABC Corp", source: "Referral", action: "Follow up", due: "Overdue" },
];

const STEPS = ["Queue", "Act", "Clear"] as const;

export function LeadDashboardDemo() {
  const [leads, setLeads] = useState(LEADS);
  const overdue = leads.filter((l) => l.due === "Overdue").length;
  const step = leads.length === 0 ? 2 : leads.length < LEADS.length ? 1 : 0;

  function complete(id: number) {
    setLeads(leads.filter((l) => l.id !== id));
  }

  return (
    <DemoWindow
      title="Lead follow-up"
      subtitle="owner dashboard · this week"
      toolbar={<DemoStepper steps={STEPS} current={step} />}
    >
      <DemoPanel panelKey={leads.length}>
        <div className="grid grid-cols-3 gap-2">
          <DemoStat value={leads.length} label="Open leads" />
          <DemoStat value={overdue} label="Overdue" emphasize={overdue > 0} />
          <DemoStat value={3} label="This week" />
        </div>

        {leads.length === 0 ? (
          <div className="border border-dashed border-line bg-surface-alt/50 px-4 py-8 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
              Queue clear
            </p>
            <p className="mt-1 text-sm text-ink">All follow-ups marked done for this demo.</p>
            <DemoButton
              className="mt-4"
              variant="secondary"
              onClick={() => setLeads(LEADS)}
            >
              Reset demo leads
            </DemoButton>
          </div>
        ) : (
          <div className="overflow-x-auto border border-line">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-alt">
                  <th className="px-2.5 py-2 font-mono text-[10px] font-normal uppercase tracking-[0.1em] text-muted">
                    Lead
                  </th>
                  <th className="px-2.5 py-2 font-mono text-[10px] font-normal uppercase tracking-[0.1em] text-muted">
                    Source
                  </th>
                  <th className="px-2.5 py-2 font-mono text-[10px] font-normal uppercase tracking-[0.1em] text-muted">
                    Next action
                  </th>
                  <th className="px-2.5 py-2 font-mono text-[10px] font-normal uppercase tracking-[0.1em] text-muted">
                    Due
                  </th>
                  <th className="px-2.5 py-2" />
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-b border-line last:border-b-0">
                    <td className="px-2.5 py-2 text-ink">{lead.name}</td>
                    <td className="px-2.5 py-2 text-muted">{lead.source}</td>
                    <td className="px-2.5 py-2 text-ink">{lead.action}</td>
                    <td
                      className={`px-2.5 py-2 ${
                        lead.due === "Overdue" ? "font-medium text-accent" : "text-muted"
                      }`}
                    >
                      {lead.due}
                    </td>
                    <td className="px-2.5 py-2 text-right">
                      <DemoButton
                        variant="ghost"
                        className="px-1 py-0 text-xs"
                        onClick={() => complete(lead.id)}
                      >
                        Done
                      </DemoButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <DemoMeta>Mark actions done to clear the queue — state stays in this browser session.</DemoMeta>
      </DemoPanel>
    </DemoWindow>
  );
}
