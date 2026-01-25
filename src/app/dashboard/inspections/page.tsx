import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function InspectionsPage() {
  return (
    <div className="flex flex-col gap-6">
       <Card>
        <CardHeader>
          <CardTitle>Inspections</CardTitle>
          <CardDescription>
            Schedule and manage all your property inspections. This is a placeholder page.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
