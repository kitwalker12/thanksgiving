import { Board } from "./board";
import { getPotluck } from "@/lib/potluck";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const potluck = await getPotluck();
  return <Board initial={potluck} />;
}
