import { LegalPage } from "@/components/marketing/legal-page";

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="September 16, 2026">
      <p>
        These Terms of Service govern your use of the Autopilot platform. By accessing or using the platform, you
        agree to be bound by these terms. This is placeholder content for the frontend phase.
      </p>
      <h2>1. Use of Service</h2>
      <p>
        You agree to use the platform in compliance with all applicable laws and third-party platform terms of
        service. Automated interactions with external marketplaces must respect their respective policies.
      </p>
      <h2>2. Accounts</h2>
      <p>
        You are responsible for maintaining the confidentiality of your account credentials and for all activity
        under your account across Admin, Freelancer, and Client roles.
      </p>
      <h2>3. Payments & Escrow</h2>
      <p>
        Client funds are held in escrow via Stripe and released to freelancers upon milestone approval. Platform
        margin is captured at the time of payout.
      </p>
      <h2>4. Freelancer Obligations</h2>
      <p>
        Freelancers agree to deliver work that passes automated quality gates and to comply with confidentiality
        and NDA-shielding requirements.
      </p>
      <h2>5. Limitation of Liability</h2>
      <p>
        The platform is provided "as is" without warranties of any kind. Placeholder legal text for demonstration
        purposes.
      </p>
    </LegalPage>
  );
}
