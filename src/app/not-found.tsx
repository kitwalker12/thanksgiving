import Link from "next/link";
import { Hero } from "@/components/hero";

export default function NotFound() {
  return (
    <>
      <Hero eyebrow="Friendsgiving" title="That page isn't on the table." compact />
      <div className="sheet">
        <div className="sheet-inner">
          <Link className="btn" href="/">
            Back to the potluck
          </Link>
        </div>
      </div>
    </>
  );
}
