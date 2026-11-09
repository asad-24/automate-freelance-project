import { LegalPage } from "@/components/marketing/legal-page";

export default function AiDisclosurePage() {
  return (
    <LegalPage title="AI Disclosure" updated="September 16, 2026">
      <p>
        Autopilot uses artificial intelligence throughout its workflows. In <strong>Compliance mode</strong>, we
        proactively disclose the use of AI in client communications. This page documents how AI is used across the
        platform.
      </p>
      <h2>Where AI is used</h2>
      <p>
        AI agents assist with lead discovery, proposal drafting, client communication, freelancer coordination,
        quality assurance, and delivery. A human-in-the-loop reviews escalations and approves payouts.
      </p>
      <h2>Stealth vs. Compliance mode</h2>
      <p>
        The platform offers two operating modes. <strong>Compliance mode</strong> (default) discloses AI
        assistance and disables human-impersonation behaviors. <strong>Stealth mode</strong> is an operator-
        selected configuration; operators are responsible for ensuring its use complies with applicable law and
        third-party terms in their jurisdiction.
      </p>
      <h2>Anti-hallucination safeguards</h2>
      <p>
        Retrieval-augmented generation is strictly bounded to verified context. Agents may only reference projects
        that exist in the provided portfolio and never promise delivery timelines without engineering review.
      </p>
      <h2>Human oversight</h2>
      <p>
        Sentiment monitoring automatically escalates frustrated conversations to a human administrator, and all
        capital movements require explicit human approval.
      </p>
    </LegalPage>
  );
}
