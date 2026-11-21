import { Console } from "./console";
import { getPotluck } from "@/lib/potluck";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const potluck = await getPotluck();
  return <Console initial={potluck} />;
}
