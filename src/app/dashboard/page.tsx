import Link from 'next/link';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Home,
  Wrench,
  CalendarCheck,
  Files,
  PlusCircle,
  Activity,
  ListTodo,
  FileText,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { recentActivities, upcomingTasks } from '@/data/mock-data';
import { Button } from '@/components/ui/button';

const infoCards = [
  {
    title: 'Total Properties',
    value: '12',
    icon: Home,
    change: '+2 this month',
  },
  {
    title: 'Open Maintenance',
    value: '5',
    icon: Wrench,
    change: '3 pending',
  },
  {
    title: 'Upcoming Inspections',
    value: '3',
    icon: CalendarCheck,
    change: 'in next 7 days',
  },
  {
    title: 'Documents',
    value: '28',
    icon: Files,
    change: '+4 new',
  },
];

const actionCards = [
  {
    title: 'Add Property',
    href: '/dashboard/properties/add',
    icon: PlusCircle,
    description: 'Onboard a new rental property.',
  },
  {
    title: 'Log Maintenance',
    href: '/dashboard/maintenance',
    icon: Wrench,
    description: 'Report a new maintenance issue.',
  },
  {
    title: 'Schedule Inspection',
    href: '/dashboard/inspections',
    icon: CalendarCheck,
    description: 'Book a new property inspection.',
  },
  {
    title: 'Upload Document',
    href: '/dashboard/documents',
    icon: FileText,
    description: 'Add agreements or certificates.',
  },
];

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {infoCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground">{card.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {actionCards.map((action) => (
          <Card
            key={action.title}
            className="group hover:bg-accent/50 transition-colors"
          >
            <Link href={action.href} className="block h-full">
              <CardHeader>
                <action.icon className="h-8 w-8 text-primary mb-2" />
                <CardTitle>{action.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{action.description}</CardDescription>
              </CardContent>
            </Link>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" /> Recent Activity
            </CardTitle>
            <CardDescription>
              A log of recent maintenance and tenant communications.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Activity</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentActivities.map((activity) => (
                  <TableRow key={activity.id}>
                    <TableCell className="font-medium">
                      {activity.property}
                    </TableCell>
                    <TableCell>{activity.activity}</TableCell>
                    <TableCell className="text-right">{activity.date}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListTodo className="h-5 w-5" /> Upcoming Tasks
            </CardTitle>
            <CardDescription>
              Inspections and maintenance tasks that are due soon.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Due Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcomingTasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell>
                      <div className="font-medium">{task.task}</div>
                      <div className="text-sm text-muted-foreground">
                        {task.property}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={task.status === 'Pending' ? 'secondary' : 'outline'}>
                        {task.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{task.dueDate}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
