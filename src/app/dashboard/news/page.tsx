'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Gavel, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight, 
  Info, 
  Scale,
  ShieldCheck,
  Building2,
  Users
} from 'lucide-react';

/**
 * @fileOverview News and Law Updates Page
 * Provides professional briefings on UK rental legislation changes.
 * Initial Content: Renters’ Rights Act 2026.
 */

export default function NewsPage() {
  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto text-left animate-in fade-in duration-500">
      <div className="flex flex-col gap-2 p-6 rounded-3xl bg-primary/5 border border-primary/10">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary text-primary-foreground">
            <Gavel className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-bold font-headline text-primary tracking-tight">News & Law Updates</h1>
        </div>
        <p className="text-muted-foreground font-medium text-lg ml-1">Stay informed on legislative changes affecting the UK private rented sector.</p>
      </div>

      <Card className="border-none shadow-xl overflow-hidden">
        <CardHeader className="bg-muted/30 border-b pb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-bold uppercase text-[9px] tracking-widest mb-2 px-3">
                Major Reform
              </Badge>
              <CardTitle className="text-2xl font-headline">Renters’ Rights Act – Major Changes</CardTitle>
              <CardDescription className="text-base font-medium">Coming into effect from 1 May 2026</CardDescription>
            </div>
            <div className="flex flex-col gap-1 items-start sm:items-end">
              <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase">
                <Calendar className="h-3.5 w-3.5" />
                Effective: 1 May 2026
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase">
                <Scale className="h-3.5 w-3.5" />
                Scope: England (Private Sector)
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-8 space-y-10">
          <section className="bg-primary/5 p-6 rounded-2xl border border-primary/10">
            <div className="flex items-start gap-4">
              <Info className="h-6 w-6 text-primary shrink-0 mt-1" />
              <p className="text-sm font-medium leading-relaxed text-foreground/80">
                The Renters’ Rights Act introduces significant reforms to improve tenant protections and change how landlords manage tenancies. This represents the largest reform to the private rental sector in over 30 years.
              </p>
            </div>
          </section>

          <div className="grid gap-8">
            <div className="space-y-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs">1</span>
                End of Section 21 “No-Fault” Evictions
              </h3>
              <div className="pl-8 space-y-3">
                <p className="text-sm text-muted-foreground leading-relaxed font-medium">
                  The biggest change is the abolition of the Section 21 notice. Landlords will no longer be able to evict tenants without giving a reason.
                </p>
                <div className="bg-muted/30 p-4 rounded-xl space-y-2 border border-dashed">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Valid Legal Grounds Required:</p>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      'Selling the property',
                      'Moving in personally or with family',
                      'Tenant rent arrears',
                      'Anti-social behaviour'
                    ].map((item) => (
                      <li key={item} className="flex items-center gap-2 text-xs font-bold text-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs">2</span>
                Fixed-Term Tenancies Removed
              </h3>
              <div className="pl-8 space-y-3">
                <p className="text-sm text-muted-foreground leading-relaxed font-medium">
                  All Assured Shorthold Tenancies will move to rolling periodic tenancies.
                </p>
                <ul className="space-y-2">
                  {[
                    'Tenancies continue indefinitely',
                    'Tenants can leave with notice',
                    'Landlords must rely on legal possession grounds'
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-xs font-bold text-foreground">
                      <ArrowRight className="h-3.5 w-3.5 text-primary" /> {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs">3</span>
                Rent Increases Limited
              </h3>
              <div className="pl-8 space-y-3">
                <p className="text-sm text-muted-foreground leading-relaxed font-medium">
                  Rent increases will be restricted to once per year using a formal legal notice process. Tenants will also have the right to challenge excessive increases.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs">4</span>
                New Possession Grounds
              </h3>
              <div className="pl-8 space-y-3">
                <p className="text-sm text-muted-foreground leading-relaxed font-medium">
                  Landlords can still regain possession if they want to sell, move in themselves, or if the tenant has serious arrears or anti-social behaviour. 
                  <strong className="text-primary ml-1">Crucially, these grounds must now be proven in court.</strong>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
              <div className="space-y-4 p-6 rounded-2xl bg-muted/20 border">
                <h3 className="text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  5. PRS Ombudsman
                </h3>
                <p className="text-xs font-medium text-muted-foreground leading-relaxed">
                  A new independent ombudsman will be introduced to resolve disputes. All landlords will be required to join this scheme by law.
                </p>
              </div>
              <div className="space-y-4 p-6 rounded-2xl bg-muted/20 border">
                <h3 className="text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  6. New Property Portal
                </h3>
                <p className="text-xs font-medium text-muted-foreground leading-relaxed">
                  Landlords must register properties on a government database to improve transparency and enforce housing standards.
                </p>
              </div>
            </div>

            <div className="space-y-4 pt-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs">7</span>
                Stronger Tenant Rights
              </h3>
              <div className="pl-8 space-y-3">
                <ul className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    'Protection against unfair eviction',
                    'Right to request pets (must be considered reasonably)',
                    'Improved standards enforcement'
                  ].map((item) => (
                    <li key={item} className="p-4 rounded-xl bg-background border shadow-sm text-[10px] font-bold uppercase tracking-tight text-center flex flex-col items-center justify-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-8 bg-primary/5 p-8 border-t">
          <div className="w-full space-y-4 text-left">
            <h3 className="text-lg font-bold text-primary flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              What Landlords Should Do Before May 2026
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                'Review existing tenancy agreements',
                'Understand new legal possession grounds',
                'Ensure compliance with Decent Homes Standard',
                'Prepare for the end of Section 21 notices'
              ].map((step) => (
                <div key={step} className="flex items-center gap-3 p-3 rounded-xl bg-background border shadow-sm">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <span className="text-xs font-bold">{step}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="w-full border-t border-primary/10 pt-6">
            <h4 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground mb-2">Why This Matters</h4>
            <p className="text-sm italic font-medium text-muted-foreground leading-relaxed">
              "This legislation represents the largest reform to the private rental sector in over 30 years and will significantly change how landlords manage tenancies. Professional digital records and audit trails like those in RentSafeUK will become essential for legal compliance."
            </p>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
