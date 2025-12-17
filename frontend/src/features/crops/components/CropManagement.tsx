import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Wheat,
  Calendar as CalendarIcon,
  MapPin,
  Droplets,
  Sun,
  TrendingUp,
  Plus,
  Edit,
  Eye,
  Sprout,
  ArrowRight,
} from 'lucide-react';

interface CropField {
  id: number;
  name: string;
  crop: string;
  acres: number;
  planted: string;
  expectedHarvest: string;
  status: string;
  progress: number;
  yieldPrediction: string;
  soilMoisture: number;
  lastWatered: string;
}

interface Task {
  id: number;
  task: string;
  field: string;
  date: string;
  priority: string;
  type: string;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Ready to Harvest':
      return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800';
    case 'Growing':
      return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800';
    case 'Flowering':
      return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800';
    case 'Ripening':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/30 dark:text-gray-400 dark:border-gray-800';
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'Critical':
      return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
    case 'High':
      return 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800';
    case 'Medium':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/30 dark:text-gray-400 dark:border-gray-800';
  }
};

export function CropManagement() {
  const [isAddFieldOpen, setIsAddFieldOpen] = useState(false);
  const [cropFields, setCropFields] = useState<CropField[]>([]);
  const [newField, setNewField] = useState({
    name: '',
    crop: '',
    acres: '',
    planted: '',
  });

  const hasFields = cropFields.length > 0;

  const addNewField = () => {
    if (newField.name && newField.crop && newField.acres && newField.planted) {
      const field: CropField = {
        id: Date.now(),
        name: newField.name,
        crop: newField.crop,
        acres: parseInt(newField.acres),
        planted: newField.planted,
        expectedHarvest: calculateExpectedHarvest(newField.planted, newField.crop),
        status: 'Growing',
        progress: 15,
        yieldPrediction: getDefaultYield(newField.crop),
        soilMoisture: 75,
        lastWatered: new Date().toISOString().split('T')[0],
      };

      setCropFields([...cropFields, field]);

      setNewField({ name: '', crop: '', acres: '', planted: '' });
      setIsAddFieldOpen(false);
    }
  };

  const calculateExpectedHarvest = (plantedDate: string, crop: string) => {
    const planted = new Date(plantedDate);
    const daysToAdd =
      crop === 'Corn' ? 180 : crop === 'Wheat' ? 150 : crop === 'Soybeans' ? 180 : 165;
    const harvest = new Date(planted.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    return harvest.toISOString().split('T')[0];
  };

  const getDefaultYield = (crop: string) => {
    const yields = {
      Corn: '180 bu/acre',
      Wheat: '65 bu/acre',
      Soybeans: '50 bu/acre',
      Barley: '70 bu/acre',
    };
    return yields[crop as keyof typeof yields] || '75 bu/acre';
  };

  if (!hasFields) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex flex-col space-y-2 md:flex-row md:justify-between md:items-center md:space-y-0">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">Crop Management</h1>
            <p className="text-muted-foreground">
              Monitor and manage your crop fields and planting schedules.
            </p>
          </div>
        </div>

        {/* Empty State */}
        <div className="flex flex-col items-center justify-center py-16 space-y-6">
          <div className="relative">
            <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center">
              <Wheat className="w-12 h-12 text-primary" />
            </div>
            <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-accent rounded-full flex items-center justify-center">
              <Sprout className="w-4 h-4 text-accent-foreground" />
            </div>
          </div>

          <div className="text-center space-y-2 max-w-md">
            <h2 className="text-2xl font-semibold text-foreground">No crop fields yet</h2>
            <p className="text-muted-foreground">
              Start by adding your first crop field to track planting schedules, monitor growth, and
              predict yields.
            </p>
          </div>

          <Dialog open={isAddFieldOpen} onOpenChange={setIsAddFieldOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="mt-4">
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Field
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Crop Field</DialogTitle>
                <DialogDescription>
                  Enter the details for your new crop field to start tracking.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="field-name">Field Name</Label>
                  <Input
                    id="field-name"
                    placeholder="e.g., North Field A"
                    value={newField.name}
                    onChange={(e) => setNewField({ ...newField, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="crop-type">Crop Type</Label>
                  <Select
                    value={newField.crop}
                    onValueChange={(value) => setNewField({ ...newField, crop: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select crop type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Corn">Corn</SelectItem>
                      <SelectItem value="Wheat">Wheat</SelectItem>
                      <SelectItem value="Soybeans">Soybeans</SelectItem>
                      <SelectItem value="Barley">Barley</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="acres">Acres</Label>
                  <Input
                    id="acres"
                    type="number"
                    placeholder="e.g., 25"
                    value={newField.acres}
                    onChange={(e) => setNewField({ ...newField, acres: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="planted-date">Planted Date</Label>
                  <Input
                    id="planted-date"
                    type="date"
                    value={newField.planted}
                    onChange={(e) => setNewField({ ...newField, planted: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddFieldOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={addNewField}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Field
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Getting Started Tips */}
          <Card className="w-full max-w-2xl bg-gradient-to-r from-accent/30 to-secondary/30 border-border">
            <CardHeader>
              <CardTitle className="text-card-foreground flex items-center gap-2">
                <Sun className="w-5 h-5 text-primary" />
                Getting Started with Crop Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-sm font-semibold text-primary">1</span>
                  </div>
                  <div>
                    <p className="font-medium text-card-foreground">Add Field Information</p>
                    <p className="text-sm text-muted-foreground">
                      Enter your field name, crop type, size, and planting date
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-sm font-semibold text-primary">2</span>
                  </div>
                  <div>
                    <p className="font-medium text-card-foreground">Track Growth Progress</p>
                    <p className="text-sm text-muted-foreground">
                      Monitor soil moisture, growth stages, and update regularly
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-sm font-semibold text-primary">3</span>
                  </div>
                  <div>
                    <p className="font-medium text-card-foreground">Schedule Tasks</p>
                    <p className="text-sm text-muted-foreground">
                      Set up watering, fertilizing, and harvesting schedules
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col space-y-2 md:flex-row md:justify-between md:items-center md:space-y-0">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Crop Management</h1>
          <p className="text-muted-foreground">
            Monitor and manage your crop fields and planting schedules.
          </p>
        </div>
        <Dialog open={isAddFieldOpen} onOpenChange={setIsAddFieldOpen}>
          <DialogTrigger asChild>
            <Button className="md:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Add New Field
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Crop Field</DialogTitle>
              <DialogDescription>
                Enter the details for your new crop field to start tracking.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="field-name">Field Name</Label>
                <Input
                  id="field-name"
                  placeholder="e.g., North Field A"
                  value={newField.name}
                  onChange={(e) => setNewField({ ...newField, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="crop-type">Crop Type</Label>
                <Select
                  value={newField.crop}
                  onValueChange={(value) => setNewField({ ...newField, crop: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select crop type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Corn">Corn</SelectItem>
                    <SelectItem value="Wheat">Wheat</SelectItem>
                    <SelectItem value="Soybeans">Soybeans</SelectItem>
                    <SelectItem value="Barley">Barley</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="acres">Acres</Label>
                <Input
                  id="acres"
                  type="number"
                  placeholder="e.g., 25"
                  value={newField.acres}
                  onChange={(e) => setNewField({ ...newField, acres: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="planted-date">Planted Date</Label>
                <Input
                  id="planted-date"
                  type="date"
                  value={newField.planted}
                  onChange={(e) => setNewField({ ...newField, planted: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddFieldOpen(false)}>
                Cancel
              </Button>
              <Button onClick={addNewField}>
                <Plus className="w-4 h-4 mr-2" />
                Add Field
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Field Overview</TabsTrigger>
          <TabsTrigger value="schedule">Planting Schedule</TabsTrigger>
          <TabsTrigger value="tracking">Growth Tracking</TabsTrigger>
          <TabsTrigger value="predictions">Yield Predictions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Fields</CardTitle>
                <MapPin className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{cropFields.length}</div>
                <p className="text-xs text-muted-foreground">
                  {cropFields.reduce((sum, field) => sum + field.acres, 0)} total acres
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Crops</CardTitle>
                <Wheat className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {new Set(cropFields.map((f) => f.crop)).size}
                </div>
                <p className="text-xs text-muted-foreground">
                  {Array.from(new Set(cropFields.map((f) => f.crop))).join(', ')}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ready to Harvest</CardTitle>
                <TrendingUp className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {cropFields.filter((f) => f.status === 'Ready to Harvest').length}
                </div>
                <p className="text-xs text-muted-foreground">
                  {cropFields.find((f) => f.status === 'Ready to Harvest')?.name ||
                    'None ready yet'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Soil Moisture</CardTitle>
                <Droplets className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {cropFields.length > 0
                    ? Math.round(
                        cropFields.reduce((sum, field) => sum + field.soilMoisture, 0) /
                          cropFields.length
                      )
                    : 0}
                  %
                </div>
                <p className="text-xs text-muted-foreground">Optimal range: 65-80%</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Field Status</CardTitle>
              <CardDescription>Current status of all crop fields</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Field Name</TableHead>
                    <TableHead>Crop</TableHead>
                    <TableHead>Acres</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Soil Moisture</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cropFields.map((field) => (
                    <TableRow key={field.id}>
                      <TableCell className="font-medium">{field.name}</TableCell>
                      <TableCell>{field.crop}</TableCell>
                      <TableCell>{field.acres}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getStatusColor(field.status)}>
                          {field.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Progress value={field.progress} className="h-2" />
                          <span className="text-xs text-muted-foreground">{field.progress}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Droplets className="w-3 h-3 text-blue-500" />
                          {field.soilMoisture}%
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm">
                            <Eye className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Edit className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Upcoming Tasks</CardTitle>
                <CardDescription>Scheduled crop management activities</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <CalendarIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No tasks scheduled yet</p>
                  <p className="text-sm">Add tasks using the form on the right</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Schedule New Task</CardTitle>
                <CardDescription>Add a new crop management task</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="task-type">Task Type</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select task type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="irrigation">Irrigation</SelectItem>
                      <SelectItem value="fertilization">Fertilization</SelectItem>
                      <SelectItem value="harvest">Harvest</SelectItem>
                      <SelectItem value="planting">Planting</SelectItem>
                      <SelectItem value="inspection">Inspection</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="field">Field</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent>
                      {cropFields.map((field) => (
                        <SelectItem key={field.id} value={field.name}>
                          {field.name} ({field.crop})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date">Scheduled Date</Label>
                  <Input type="date" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Schedule Task
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tracking" className="space-y-4">
          <div className="grid gap-4">
            {cropFields.map((field) => (
              <Card key={field.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{field.name}</CardTitle>
                      <CardDescription>
                        {field.crop} • {field.acres} acres
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className={getStatusColor(field.status)}>
                      {field.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-2">
                      <Label>Growth Progress</Label>
                      <Progress value={field.progress} className="h-3" />
                      <span className="text-sm text-muted-foreground">{field.progress}%</span>
                    </div>
                    <div className="space-y-2">
                      <Label>Soil Moisture</Label>
                      <div className="flex items-center gap-2">
                        <Droplets className="w-4 h-4 text-blue-500" />
                        <span>{field.soilMoisture}%</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Last watered: {field.lastWatered}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Expected Harvest</Label>
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-primary" />
                        <span>{field.expectedHarvest}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Yield Prediction</Label>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-green-500" />
                        <span>{field.yieldPrediction}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="predictions" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Yield Predictions</CardTitle>
                <CardDescription>
                  AI-powered harvest predictions based on current conditions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {cropFields.map((field) => (
                    <div
                      key={field.id}
                      className="flex justify-between items-center p-3 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{field.name}</p>
                        <p className="text-sm text-muted-foreground">{field.crop}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{field.yieldPrediction}</p>
                        <p className="text-sm text-muted-foreground">{field.acres} acres</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Market Predictions</CardTitle>
                <CardDescription>Expected market prices at harvest time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Corn</p>
                      <p className="text-sm text-muted-foreground">Current: $4.20/bu</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-600">$4.45/bu</p>
                      <p className="text-sm text-muted-foreground">+5.9% projected</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Wheat</p>
                      <p className="text-sm text-muted-foreground">Current: $6.80/bu</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-red-600">$6.50/bu</p>
                      <p className="text-sm text-muted-foreground">-4.4% projected</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Soybeans</p>
                      <p className="text-sm text-muted-foreground">Current: $13.20/bu</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-600">$13.85/bu</p>
                      <p className="text-sm text-muted-foreground">+4.9% projected</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
