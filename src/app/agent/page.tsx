import { redirect } from "next/navigation";

export const metadata = { title: "Workflow Lab" };

export default function AgentPage() {
  redirect("/debug/workflow");
}
