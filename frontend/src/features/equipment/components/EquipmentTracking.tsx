import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
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
  Tractor,
  Wrench,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  Plus,
  Edit,
  Eye,
  Fuel,
  MapPin,
  DollarSign,
  TrendingUp,
  Settings,
} from 'lucide-react';

interface Equipment {
  id: string;
  name: string;
  type: string;
  year: number;
  hours: number;
  status: string;
  location: string;
  lastMaintenance: string;
  nextMaintenance: string;
  fuelLevel: number;
  efficiency: number;
  dailyCost: number;
  make?: string;
  model?: string;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Operational':
      return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800';
    case 'In Use':
      return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800';
    case 'Maintenance Required':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800';
    case 'Out of Service':
      return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/30 dark:text-gray-400 dark:border-gray-800';
  }
};

export function EquipmentTracking() {
  const [isAddEquipmentOpen, setIsAddEquipmentOpen] = useState(false);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [newEquipment, setNewEquipment] = useState({
    name: '',
    type: '',
    make: '',
    model: '',
    year: '',
    location: '',
  });

  const hasEquipment = equipment.length > 0;

  const addNewEquipment = () => {
    if (newEquipment.name && newEquipment.type) {
      const equipmentItem: Equipment = {
        id: `E${String(Date.now()).slice(-3)}`,
        name: newEquipment.name,
        type: newEquipment.type,
        year: parseInt(newEquipment.year) || new Date().getFullYear(),
        hours: 0,
        status: 'Operational',
        location: newEquipment.location || 'Main Barn',
        lastMaintenance: new Date().toISOString().split('T')[0],
        nextMaintenance: getNextMaintenanceDate(),
        fuelLevel: 100,
        efficiency: 95,
        dailyCost: getDefaultDailyCost(newEquipment.type),
        make: newEquipment.make,
        model: newEquipment.model,
      };

      setEquipment([...equipment, equipmentItem]);

      setNewEquipment({ name: '', type: '', make: '', model: '', year: '', location: '' });
      setIsAddEquipmentOpen(false);
    }
  };

  const getNextMaintenanceDate = () => {
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 3, today.getDate());
    return nextMonth.toISOString().split('T')[0];
  };

  const getDefaultDailyCost = (type: string) => {
    const costs = {
      Tractor: 120,
      Harvester: 180,
      Seeder: 75,
      Cultivator: 65,
      Sprayer: 85,
      Mower: 55,
    };
    return costs[type as keyof typeof costs] || 100;
  };

  const getEquipmentIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'tractor':
        return <Tractor className="w-12 h-12 text-primary" />;
      case 'harvester':
        return <Settings className="w-12 h-12 text-primary" />;
      default:
        return <Wrench className="w-12 h-12 text-primary" />;
    }
  };

  if (!hasEquipment) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex flex-col space-y-2 md:flex-row md:justify-between md:items-center md:space-y-0">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">Equipment Tracking</h1>
            <p className="text-muted-foreground">
              Monitor machinery status, maintenance, and utilization.
            </p>
          </div>
        </div>

        {/* Empty State */}
        <div className="flex flex-col items-center justify-center py-16 space-y-6">
          <div className="relative">
            <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center">
              <Tractor className="w-12 h-12 text-primary" />
            </div>
            <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-accent rounded-full flex items-center justify-center">
              <Wrench className="w-4 h-4 text-accent-foreground" />
            </div>
          </div>

          <div className="text-center space-y-2 max-w-md">
            <h2 className="text-2xl font-semibold text-foreground">No equipment registered yet</h2>
            <p className="text-muted-foreground">
              Start by adding your farm equipment to track maintenance schedules, operating hours,
              and costs.
            </p>
          </div>

          <Dialog open={isAddEquipmentOpen} onOpenChange={setIsAddEquipmentOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="mt-4">
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Equipment
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Farm Equipment</DialogTitle>
                <DialogDescription>
                  Register a piece of equipment to start tracking its maintenance and usage.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="equipment-name">Equipment Name</Label>
                  <Input
                    id="equipment-name"
                    placeholder="e.g., John Deere 8320R"
                    value={newEquipment.name}
                    onChange={(e) => setNewEquipment({ ...newEquipment, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="equipment-type">Equipment Type</Label>
                  <Select
                    value={newEquipment.type}
                    onValueChange={(value) => setNewEquipment({ ...newEquipment, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select equipment type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Tractor">Tractor</SelectItem>
                      <SelectItem value="Harvester">Harvester</SelectItem>
                      <SelectItem value="Seeder">Seeder</SelectItem>
                      <SelectItem value="Cultivator">Cultivator</SelectItem>
                      <SelectItem value="Sprayer">Sprayer</SelectItem>
                      <SelectItem value="Mower">Mower</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="make">Make (Optional)</Label>
                    <Input
                      id="make"
                      placeholder="e.g., John Deere"
                      value={newEquipment.make}
                      onChange={(e) => setNewEquipment({ ...newEquipment, make: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="model">Model (Optional)</Label>
                    <Input
                      id="model"
                      placeholder="e.g., 8320R"
                      value={newEquipment.model}
                      onChange={(e) => setNewEquipment({ ...newEquipment, model: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="year">Year</Label>
                    <Input
                      id="year"
                      type="number"
                      placeholder="e.g., 2020"
                      value={newEquipment.year}
                      onChange={(e) => setNewEquipment({ ...newEquipment, year: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      placeholder="e.g., Main Barn"
                      value={newEquipment.location}
                      onChange={(e) =>
                        setNewEquipment({ ...newEquipment, location: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddEquipmentOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={addNewEquipment}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Equipment
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Getting Started Tips */}
          <Card className="w-full max-w-2xl bg-gradient-to-r from-accent/30 to-secondary/30 border-border">
            <CardHeader>
              <CardTitle className="text-card-foreground flex items-center gap-2">
                <Wrench className="w-5 h-5 text-primary" />
                Getting Started with Equipment Tracking
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-sm font-semibold text-primary">1</span>
                  </div>
                  <div>
                    <p className="font-medium text-card-foreground">Register Equipment</p>
                    <p className="text-sm text-muted-foreground">
                      Add your tractors, harvesters, and other farm machinery
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-sm font-semibold text-primary">2</span>
                  </div>
                  <div>
                    <p className="font-medium text-card-foreground">Track Maintenance</p>
                    <p className="text-sm text-muted-foreground">
                      Schedule regular maintenance and track operating hours
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-sm font-semibold text-primary">3</span>
                  </div>
                  <div>
                    <p className="font-medium text-card-foreground">Monitor Costs</p>
                    <p className="text-sm text-muted-foreground">
                      Keep track of fuel usage, repairs, and operating expenses
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

  const operationalCount = equipment.filter(
    (item) => item.status === 'Operational' || item.status === 'In Use'
  ).length;
  const maintenanceCount = equipment.filter(
    (item) => item.status === 'Maintenance Required'
  ).length;
  const totalDailyCost = equipment.reduce((sum, item) => sum + item.dailyCost, 0);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col space-y-2 md:flex-row md:justify-between md:items-center md:space-y-0">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Equipment Tracking</h1>
          <p className="text-muted-foreground">
            Monitor machinery status, maintenance, and utilization.
          </p>
        </div>
        <Dialog open={isAddEquipmentOpen} onOpenChange={setIsAddEquipmentOpen}>
          <DialogTrigger asChild>
            <Button className="md:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Add Equipment
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Farm Equipment</DialogTitle>
              <DialogDescription>
                Register a piece of equipment to start tracking its maintenance and usage.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="equipment-name">Equipment Name</Label>
                <Input
                  id="equipment-name"
                  placeholder="e.g., John Deere 8320R"
                  value={newEquipment.name}
                  onChange={(e) => setNewEquipment({ ...newEquipment, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="equipment-type">Equipment Type</Label>
                <Select
                  value={newEquipment.type}
                  onValueChange={(value) => setNewEquipment({ ...newEquipment, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select equipment type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Tractor">Tractor</SelectItem>
                    <SelectItem value="Harvester">Harvester</SelectItem>
                    <SelectItem value="Seeder">Seeder</SelectItem>
                    <SelectItem value="Cultivator">Cultivator</SelectItem>
                    <SelectItem value="Sprayer">Sprayer</SelectItem>
                    <SelectItem value="Mower">Mower</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="make">Make (Optional)</Label>
                  <Input
                    id="make"
                    placeholder="e.g., John Deere"
                    value={newEquipment.make}
                    onChange={(e) => setNewEquipment({ ...newEquipment, make: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">Model (Optional)</Label>
                  <Input
                    id="model"
                    placeholder="e.g., 8320R"
                    value={newEquipment.model}
                    onChange={(e) => setNewEquipment({ ...newEquipment, model: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="year">Year</Label>
                  <Input
                    id="year"
                    type="number"
                    placeholder="e.g., 2020"
                    value={newEquipment.year}
                    onChange={(e) => setNewEquipment({ ...newEquipment, year: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    placeholder="e.g., Main Barn"
                    value={newEquipment.location}
                    onChange={(e) => setNewEquipment({ ...newEquipment, location: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddEquipmentOpen(false)}>
                Cancel
              </Button>
              <Button onClick={addNewEquipment}>
                <Plus className="w-4 h-4 mr-2" />
                Add Equipment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="workorders">Work Orders</TabsTrigger>
          <TabsTrigger value="utilization">Utilization</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Equipment</CardTitle>
                <Tractor className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{equipment.length}</div>
                <p className="text-xs text-muted-foreground">
                  {equipment.filter((e) => e.type === 'Tractor').length} tractors,{' '}
                  {equipment.filter((e) => e.type !== 'Tractor').length} implements
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Operational</CardTitle>
                <CheckCircle className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{operationalCount}</div>
                <p className="text-xs text-muted-foreground">
                  {Math.round((operationalCount / equipment.length) * 100)}% availability
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Need Maintenance</CardTitle>
                <AlertTriangle className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{maintenanceCount}</div>
                <p className="text-xs text-muted-foreground">
                  {maintenanceCount === 0 ? 'All equipment operational' : 'Requires attention'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Daily Operating Cost</CardTitle>
                <DollarSign className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${totalDailyCost}</div>
                <p className="text-xs text-muted-foreground">Estimated daily operational cost</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Equipment Status</CardTitle>
              <CardDescription>Current status and location of all farm equipment</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Equipment</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Fuel Level</TableHead>
                    <TableHead>Next Maintenance</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {equipment.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{item.name}</div>
                          <div className="text-sm text-muted-foreground">{item.id}</div>
                        </div>
                      </TableCell>
                      <TableCell>{item.type}</TableCell>
                      <TableCell>{item.hours.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getStatusColor(item.status)}>
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-muted-foreground" />
                          {item.location}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Fuel className="w-3 h-3 text-blue-500" />
                          <span>{item.fuelLevel}%</span>
                        </div>
                      </TableCell>
                      <TableCell>{item.nextMaintenance}</TableCell>
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

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Equipment Efficiency</CardTitle>
                <CardDescription>Performance metrics for key equipment</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {equipment.slice(0, 4).map((item) => (
                  <div key={item.id} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-sm text-muted-foreground">{item.efficiency}%</span>
                    </div>
                    <Progress value={item.efficiency} className="h-2" />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Fuel Levels</CardTitle>
                <CardDescription>Current fuel status across fleet</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {equipment
                  .filter((item) => item.fuelLevel > 0)
                  .map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between items-center p-2 border rounded"
                    >
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-muted-foreground">{item.type}</p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          <Fuel className="w-4 h-4 text-blue-500" />
                          <span className={item.fuelLevel < 30 ? 'text-red-600 font-medium' : ''}>
                            {item.fuelLevel}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="maintenance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Maintenance Schedule</CardTitle>
                <CardDescription>Upcoming and scheduled maintenance tasks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No maintenance scheduled yet</p>
                  <p className="text-sm">Schedule maintenance using the form on the right</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Schedule Maintenance</CardTitle>
                <CardDescription>Plan new maintenance tasks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="equipment-select">Equipment</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select equipment" />
                    </SelectTrigger>
                    <SelectContent>
                      {equipment.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name} ({item.id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maintenance-type">Maintenance Type</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select maintenance type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="oil-change">Oil Change</SelectItem>
                      <SelectItem value="filter-replacement">Filter Replacement</SelectItem>
                      <SelectItem value="hydraulic-service">Hydraulic Service</SelectItem>
                      <SelectItem value="belt-replacement">Belt Replacement</SelectItem>
                      <SelectItem value="inspection">General Inspection</SelectItem>
                      <SelectItem value="repair">Repair Work</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="scheduled-date">Scheduled Date</Label>
                  <Input type="date" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="estimated-cost">Estimated Cost ($)</Label>
                  <Input type="number" placeholder="0.00" />
                </div>

                <Button className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Schedule Maintenance
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="workorders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Work Orders</CardTitle>
              <CardDescription>Equipment issues and repair requests</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Wrench className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No work orders at this time</p>
                <p className="text-sm">Equipment issues will appear here when reported</p>
              </div>
              <Button className="w-full mt-4" variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Create Work Order
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="utilization" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Equipment Utilization</CardTitle>
                <CardDescription>Hours of operation and efficiency metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {equipment.map((item) => (
                  <div key={item.id} className="p-3 border rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium">{item.name}</h4>
                      <span className="text-sm text-muted-foreground">
                        {item.hours.toLocaleString()} hrs
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Efficiency</span>
                        <span>{item.efficiency}%</span>
                      </div>
                      <Progress value={item.efficiency} className="h-2" />
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground mt-2">
                      <span>Daily Cost: ${item.dailyCost}</span>
                      <span>Year: {item.year}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cost Analysis</CardTitle>
                <CardDescription>Operating costs and ROI metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Total Daily Operating Cost</h4>
                  <div className="text-2xl font-bold">${totalDailyCost}</div>
                  <p className="text-sm text-muted-foreground">Estimated operational cost</p>
                </div>

                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Average Cost per Hour</h4>
                  <div className="text-2xl font-bold">
                    ${equipment.length > 0 ? Math.round(totalDailyCost / equipment.length) : 0}
                  </div>
                  <p className="text-sm text-muted-foreground">Across all equipment</p>
                </div>

                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Maintenance Cost (MTD)</h4>
                  <div className="text-2xl font-bold">$0</div>
                  <p className="text-sm text-muted-foreground">No maintenance costs yet</p>
                </div>

                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Fuel Cost (MTD)</h4>
                  <div className="text-2xl font-bold">$0</div>
                  <p className="text-sm text-muted-foreground">Track fuel expenses</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
