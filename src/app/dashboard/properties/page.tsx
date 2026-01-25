import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function PropertiesPage() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Properties</CardTitle>
          <CardDescription>
            A list of all properties in your portfolio. This is a placeholder page.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
