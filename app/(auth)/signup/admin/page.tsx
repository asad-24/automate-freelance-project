import { SignupShell } from "@/components/auth/signup-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export default function AdminSignupPage() {
  return (
    <SignupShell role="admin" title="Create your agency account" subtitle="Set up your autonomous agency workspace.">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="first">First name</Label>
          <Input id="first" placeholder="Alex" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="last">Last name</Label>
          <Input id="last" placeholder="Morgan" required />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">Work email</Label>
        <Input id="email" type="email" placeholder="alex@agency.ai" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="agency">Agency name</Label>
        <Input id="agency" placeholder="Autopilot Agency" required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="size">Team size</Label>
          <Select id="size" defaultValue="">
            <option value="" disabled>Select</option>
            <option>Just me</option>
            <option>2–5</option>
            <option>6–20</option>
            <option>20+</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="country">Country</Label>
          <Input id="country" placeholder="United States" required />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" placeholder="At least 8 characters" minLength={8} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm">Confirm password</Label>
        <Input id="confirm" type="password" placeholder="••••••••" required />
      </div>
    </SignupShell>
  );
}
