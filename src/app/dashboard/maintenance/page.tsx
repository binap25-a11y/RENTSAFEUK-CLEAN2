import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function MaintenancePage() {
  return (
    <div className="flex flex-col gap-6">
       <Card>
        <CardHeader>
          <CardTitle>Maintenance Log</CardTitle>
          <CardDescription>
            Log and track all maintenance issues for your properties. This is a placeholder page.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
