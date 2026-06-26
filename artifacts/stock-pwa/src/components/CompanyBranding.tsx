import { useCompany } from "@/contexts/CompanyContext";
import { Building2 } from "lucide-react";

type CompanyBrandingProps = {
  compact?: boolean;
  className?: string;
};

export function CompanyBranding({ compact = false, className = "" }: CompanyBrandingProps) {
  const company = useCompany();

  if (!company) {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div className="h-10 w-10 rounded-sm bg-muted flex items-center justify-center shrink-0">
          <Building2 className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <div className="font-bold uppercase tracking-tight">Mon Entreprise</div>
        </div>
      </div>
    );
  }

  const details = [company.address, company.phone, company.email].filter(Boolean);

  return (
    <div className={`flex items-start gap-3 ${className}`}>
      {company.logoUrl ? (
        <img
          src={company.logoUrl}
          alt={`Logo ${company.name}`}
          className={`rounded-sm object-contain bg-white/5 border border-border shrink-0 ${compact ? "h-10 w-10" : "h-14 w-14"}`}
        />
      ) : (
        <div className={`rounded-sm bg-primary/10 flex items-center justify-center shrink-0 ${compact ? "h-10 w-10" : "h-14 w-14"}`}>
          <Building2 className={`text-primary ${compact ? "h-5 w-5" : "h-7 w-7"}`} />
        </div>
      )}
      <div className="min-w-0">
        <div className={`font-bold uppercase tracking-tight ${compact ? "text-sm" : "text-base"}`}>
          {company.name}
        </div>
        {!compact && details.length > 0 && (
          <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
            {company.address && <div>{company.address}</div>}
            {(company.phone || company.email) && (
              <div>{[company.phone, company.email].filter(Boolean).join(" · ")}</div>
            )}
            {company.taxNumber && <div>N° TVA : {company.taxNumber}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
