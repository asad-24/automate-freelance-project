import { LegalPage } from "@/components/marketing/legal-page";

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="September 16, 2026">
      <p>
        This Privacy Policy describes how Autopilot collects, uses, and protects your information. This is
        placeholder content for the frontend phase.
      </p>
      <h2>1. Information We Collect</h2>
      <p>
        We collect account information, project data, communications routed through the platform, and usage
        analytics to operate the autonomous agents.
      </p>
      <h2>2. How We Use Data</h2>
      <p>
        Data is used to match jobs, generate proposals via RAG, coordinate freelancers, process payments, and
        improve platform performance.
      </p>
      <h2>3. Data Sharing</h2>
      <p>
        The platform acts as a strict intermediary. Client identities are shielded from freelancers and vice
        versa under our NDA-shielding model.
      </p>
      <h2>4. Data Security</h2>
      <p>
        We follow security best practices, never log secrets, and store credentials in a dedicated secrets
        manager. Placeholder text for demonstration.
      </p>
      <h2>5. Your Rights</h2>
      <p>You may request access to, correction of, or deletion of your personal data at any time.</p>
    </LegalPage>
  );
}
