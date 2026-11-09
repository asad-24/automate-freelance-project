import { SignupShell } from "@/components/auth/signup-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export default function ClientSignupPage() {
  return (
    <SignupShell
      role="client"
      title="Create your client account"
      subtitle="Get world-class software delivered on autopilot."
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="first">First name</Label>
          <Input id="first" placeholder="Jordan" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="last">Last name</Label>
          <Input id="last" placeholder="Blake" required />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">Work email</Label>
        <Input id="email" type="email" placeholder="jordan@company.com" required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="company">Company</Label>
          <Input id="company" placeholder="Bright Startup Inc." required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="size">Company size</Label>
          <Select id="size" defaultValue="">
            <option value="" disabled>Select</option>
            <option>1–10</option>
            <option>11–50</option>
            <option>51–200</option>
            <option>200+</option>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="type">Project type</Label>
          <Select id="type" defaultValue="">
            <option value="" disabled>Select</option>
            <option>Web app</option>
            <option>Mobile app</option>
            <option>AI / LLM</option>
            <option>E-commerce</option>
            <option>Other</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="budget">Budget range</Label>
          <Select id="budget" defaultValue="">
            <option value="" disabled>Select</option>
            <option>$500 – $2,000</option>
            <option>$2,000 – $10,000</option>
            <option>$10,000 – $50,000</option>
            <option>$50,000+</option>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="details">Project details</Label>
        <Textarea id="details" rows={3} placeholder="Briefly describe what you want to build..." />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" placeholder="At least 8 characters" minLength={8} required />
      </div>
    </SignupShell>
  );
}
