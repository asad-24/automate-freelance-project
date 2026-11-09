import { SignupShell } from "@/components/auth/signup-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export default function FreelancerSignupPage() {
  return (
    <SignupShell
      role="freelancer"
      title="Join the freelancer pool"
      subtitle="Get matched to specs, bid in blind auctions, and get paid on delivery."
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="first">First name</Label>
          <Input id="first" placeholder="Priya" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="last">Last name</Label>
          <Input id="last" placeholder="Sharma" required />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" placeholder="priya@devpool.io" required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="country">Country / Region</Label>
          <Input id="country" placeholder="India" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rate">Hourly rate (USD)</Label>
          <Input id="rate" type="number" placeholder="28" required />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="skills">Primary skills</Label>
        <Input id="skills" placeholder="React, Next.js, Node, Python" required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="experience">Years of experience</Label>
          <Select id="experience" defaultValue="">
            <option value="" disabled>Select</option>
            <option>0–2</option>
            <option>3–5</option>
            <option>6–10</option>
            <option>10+</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="availability">Availability</Label>
          <Select id="availability" defaultValue="">
            <option value="" disabled>Select</option>
            <option>Full-time</option>
            <option>Part-time</option>
            <option>Occasional</option>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="portfolio">Portfolio / GitHub URL</Label>
        <Input id="portfolio" type="url" placeholder="https://github.com/priya" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="bio">Short bio</Label>
        <Textarea id="bio" rows={3} placeholder="Tell us about your experience..." />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" placeholder="At least 8 characters" minLength={8} required />
      </div>
    </SignupShell>
  );
}
