import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Wheat,
  PawPrint,
  Tractor,
  DollarSign,
  TrendingUp,
  CheckCircle,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { WeatherCard } from '@/features/weather/components/WeatherCard';

const sampleRevenueData = [{ month: 'This Month', revenue: 0, expenses: 1200 }];

const sampleLivestockData = [
  { name: 'Cattle', value: 25, color: '#4a5c2a' },
  { name: 'Chickens', value: 50, color: '#8ba155' },
];
interface FarmData {
  crops: Array<{ type: string; planted?: number; harvested?: number; yield?: number }>;
  livestock: Array<{ type: string; count?: number }>;
  equipment: Array<{ name: string; status?: string }>;
  transactions: Array<{ amount: number; type: string; date?: string }>;
}

interface DashboardProps {
  farmData?: FarmData;
  onNavigate?: (section: string) => void;
}

export function Dashboard({ farmData, onNavigate }: DashboardProps) {
  const [showWelcome] = useState(
    !farmData ||
      (farmData.crops.length === 0 &&
        farmData.livestock.length === 0 &&
        farmData.equipment.length === 0 &&
        farmData.transactions.length === 0)
  );

  const hasData =
    farmData &&
    (farmData.crops.length > 0 ||
      farmData.livestock.length > 0 ||
      farmData.equipment.length > 0 ||
      farmData.transactions.length > 0);

  if (showWelcome && !hasData) {
    return (
      <div className="space-y-6 p-6">
        {/* Welcome Header */}
        <div className="text-center space-y-4 py-8">
          <div className="flex justify-center">
            <div className="relative">
              <Sparkles className="w-16 h-16 text-primary animate-pulse" />
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-accent rounded-full flex items-center justify-center">
                <Wheat className="w-3 h-3 text-accent-foreground" />
              </div>
            </div>
          </div>
          <h1 className="text-4xl font-semibold text-foreground">Welcome to MooMetrics!</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Your comprehensive farm management system is ready to help you track crops, livestock,
            equipment, and finances all in one place.
          </p>
        </div>

        {/* Weather Card - Always show as it's external data */}
        <WeatherCard />

        {/* Empty State KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-card border-border border-dashed">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-card-foreground">
                Crop Fields
              </CardTitle>
              <Wheat className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">0</div>
              <p className="text-xs text-muted-foreground">Ready to plant your first field?</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border border-dashed">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-card-foreground">Livestock</CardTitle>
              <PawPrint className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">0</div>
              <p className="text-xs text-muted-foreground">Add your animals to track them</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border border-dashed">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-card-foreground">Equipment</CardTitle>
              <Tractor className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">0</div>
              <p className="text-xs text-muted-foreground">Track your farm equipment</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border border-dashed">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-card-foreground">Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">$0</div>
              <p className="text-xs text-muted-foreground">Start tracking finances</p>
            </CardContent>
          </Card>
        </div>

        {/* Getting Started Section */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-card-foreground flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Get Started with MooMetrics
            </CardTitle>
            <CardDescription>Set up your farm in just a few minutes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Button
                className="w-full justify-start h-auto p-4"
                variant="outline"
                onClick={() => onNavigate?.('crops')}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Wheat className="w-5 h-5 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium">Add Your First Field</p>
                      <p className="text-sm text-muted-foreground">
                        Start tracking crop planting and growth
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </Button>

              <Button
                className="w-full justify-start h-auto p-4"
                variant="outline"
                onClick={() => onNavigate?.('livestock')}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <PawPrint className="w-5 h-5 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium">Register Livestock</p>
                      <p className="text-sm text-muted-foreground">Add and monitor your animals</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </Button>

              <Button
                className="w-full justify-start h-auto p-4"
                variant="outline"
                onClick={() => onNavigate?.('equipment')}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Tractor className="w-5 h-5 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium">Add Equipment</p>
                      <p className="text-sm text-muted-foreground">Track machinery and tools</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </Button>

              <Button
                className="w-full justify-start h-auto p-4"
                variant="outline"
                onClick={() => onNavigate?.('finance')}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium">Set Up Finances</p>
                      <p className="text-sm text-muted-foreground">Record income and expenses</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tips Card */}
        <Card className="bg-gradient-to-r from-accent/50 to-secondary border-border">
          <CardHeader>
            <CardTitle className="text-card-foreground">Pro Tips</CardTitle>
            <CardDescription>Make the most of your farm management system</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-card-foreground">Start Small</p>
                  <p className="text-sm text-muted-foreground">
                    Begin with just one or two crops to get familiar with the system
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-card-foreground">Regular Updates</p>
                  <p className="text-sm text-muted-foreground">
                    Update your data regularly for accurate tracking and predictions
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-card-foreground">Use All Features</p>
                  <p className="text-sm text-muted-foreground">
                    Explore crops, livestock, equipment, and finance sections for complete
                    management
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show dashboard with data if available
  const cropData = farmData?.crops || [];
  const revenueData = sampleRevenueData;

  // Convert livestock data to chart format
  const livestockData =
    farmData?.livestock && farmData.livestock.length > 0
      ? farmData.livestock.map((group) => ({
          name: group.type,
          value: group.count || 0,
          color: '#4a5c2a',
        }))
      : sampleLivestockData;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col space-y-2 md:flex-row md:justify-between md:items-center md:space-y-0">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">MooMetrics Dashboard</h1>
          <p className="text-muted-foreground">
            {hasData
              ? "Here's what's happening on your farm today."
              : 'Welcome back! Start by adding your first data.'}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="bg-accent/50 text-accent-foreground border-accent">
            <CheckCircle className="w-3 h-3 mr-1" />
            All Systems Normal
          </Badge>
        </div>
      </div>

      {/* Weather Card */}
      <WeatherCard />

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">
              Total Crop Fields
            </CardTitle>
            <Wheat className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-card-foreground">{cropData.length}</div>
            <p className="text-xs text-muted-foreground">
              {cropData.length > 0 ? (
                <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  Great start!
                </span>
              ) : (
                'Ready to add your first field?'
              )}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">
              Livestock Count
            </CardTitle>
            <PawPrint className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-card-foreground">
              {livestockData.reduce(
                (sum: number, item: { value?: number }) => sum + (item.value || 0),
                0
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {livestockData.length > 0 ? (
                <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  Animals registered
                </span>
              ) : (
                'Add your animals to track them'
              )}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">
              Equipment Status
            </CardTitle>
            <Tractor className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-card-foreground">
              {farmData?.equipment?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {farmData?.equipment?.length ? 'Equipment tracked' : 'Add your equipment'}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">
              Monthly Revenue
            </CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-card-foreground">$0</div>
            <p className="text-xs text-muted-foreground">Start recording transactions</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row - Show basic charts if some data exists */}
      {hasData && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-card-foreground">Revenue vs Expenses</CardTitle>
              <CardDescription>Monthly financial overview</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--card-foreground))',
                    }}
                  />
                  <Bar dataKey="revenue" fill="var(--color-chart-1)" name="Revenue" />
                  <Bar dataKey="expenses" fill="var(--color-chart-2)" name="Expenses" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-card-foreground">Livestock Distribution</CardTitle>
              <CardDescription>Current animal population</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={livestockData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }: { name: string; value: number }) =>
                      `${name}: ${value}`
                    }
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {livestockData.map((entry: { color: string }, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--card-foreground))',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Actions */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-card-foreground">Quick Actions</CardTitle>
          <CardDescription>Common farm management tasks</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            className="w-full justify-start"
            variant="outline"
            onClick={() => onNavigate?.('crops')}
          >
            <Wheat className="w-4 h-4 mr-2" />
            {cropData.length === 0 ? 'Add Your First Crop Field' : 'Add New Crop Planting'}
          </Button>
          <Button
            className="w-full justify-start"
            variant="outline"
            onClick={() => onNavigate?.('livestock')}
          >
            <PawPrint className="w-4 h-4 mr-2" />
            {livestockData.length === 0
              ? 'Register Your First Animals'
              : 'Record Livestock Health Check'}
          </Button>
          <Button
            className="w-full justify-start"
            variant="outline"
            onClick={() => onNavigate?.('equipment')}
          >
            <Tractor className="w-4 h-4 mr-2" />
            {farmData?.equipment?.length === 0
              ? 'Add Farm Equipment'
              : 'Schedule Equipment Maintenance'}
          </Button>
          <Button
            className="w-full justify-start"
            variant="outline"
            onClick={() => onNavigate?.('finance')}
          >
            <DollarSign className="w-4 h-4 mr-2" />
            Log Sales Transaction
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
