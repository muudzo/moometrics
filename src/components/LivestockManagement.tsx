import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Progress } from "./ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { 
  PawPrint, 
  Heart, 
  Calendar,
  TrendingUp,
  AlertTriangle,
  Plus,
  Edit,
  Eye,
  Scale,
  Thermometer,
  Users,
  Baby,
  Beef,
  Bird,
  Rabbit
} from "lucide-react";

interface Animal {
  id: number;
  type: string;
  count: number;
  avgWeight: number;
  avgAge: number;
  healthStatus: string;
  feedingSchedule: string;
  lastHealthCheck: string;
  vaccinated: number;
  breeding: number;
  breed?: string;
  name?: string;
}

interface LivestockManagementProps {
  farmData: {
    crops: any[];
    livestock: Animal[];
    equipment: any[];
    transactions: any[];
  };
  setFarmData: (data: any) => void;
}

const getHealthColor = (status: string) => {
  switch (status) {
    case "Excellent":
      return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800";
    case "Good":
      return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800";
    case "Fair":
      return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800";
    case "Poor":
      return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/30 dark:text-gray-400 dark:border-gray-800";
  }
};

export function LivestockManagement({ farmData, setFarmData }: LivestockManagementProps) {
  const [isAddAnimalOpen, setIsAddAnimalOpen] = useState(false);
  const [newAnimal, setNewAnimal] = useState({
    type: '',
    count: '',
    breed: '',
    avgWeight: '',
    avgAge: ''
  });

  const livestock = farmData.livestock;
  const hasLivestock = livestock.length > 0;

  const addNewAnimal = () => {
    if (newAnimal.type && newAnimal.count) {
      const animal: Animal = {
        id: Date.now(),
        type: newAnimal.type,
        count: parseInt(newAnimal.count),
        avgWeight: parseInt(newAnimal.avgWeight) || getDefaultWeight(newAnimal.type),
        avgAge: parseInt(newAnimal.avgAge) || 12,
        healthStatus: "Good",
        feedingSchedule: getDefaultFeeding(newAnimal.type),
        lastHealthCheck: new Date().toISOString().split('T')[0],
        vaccinated: parseInt(newAnimal.count),
        breeding: 0,
        breed: newAnimal.breed
      };

      setFarmData({
        ...farmData,
        livestock: [...farmData.livestock, animal]
      });

      setNewAnimal({ type: '', count: '', breed: '', avgWeight: '', avgAge: '' });
      setIsAddAnimalOpen(false);
    }
  };

  const getDefaultWeight = (type: string) => {
    const weights = {
      'Cattle': 1200,
      'Pigs': 250,
      'Chickens': 5,
      'Sheep': 70,
      'Goats': 60
    };
    return weights[type as keyof typeof weights] || 100;
  };

  const getDefaultFeeding = (type: string) => {
    const schedules = {
      'Cattle': '2x daily',
      'Pigs': '3x daily',
      'Chickens': 'Continuous',
      'Sheep': '2x daily',
      'Goats': '2x daily'
    };
    return schedules[type as keyof typeof schedules] || '2x daily';
  };

  const getAnimalIcon = (type: string) => {
    switch (type) {
      case 'Cattle':
        return <Beef className="w-12 h-12 text-primary" />;
      case 'Chickens':
        return <Bird className="w-12 h-12 text-primary" />;
      case 'Sheep':
      case 'Goats':
        return <Rabbit className="w-12 h-12 text-primary" />;
      default:
        return <PawPrint className="w-12 h-12 text-primary" />;
    }
  };

  if (!hasLivestock) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex flex-col space-y-2 md:flex-row md:justify-between md:items-center md:space-y-0">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">Livestock Management</h1>
            <p className="text-muted-foreground">Monitor animal health, feeding, and breeding programs.</p>
          </div>
        </div>

        {/* Empty State */}
        <div className="flex flex-col items-center justify-center py-16 space-y-6">
          <div className="relative">
            <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center">
              <PawPrint className="w-12 h-12 text-primary" />
            </div>
            <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-accent rounded-full flex items-center justify-center">
              <Heart className="w-4 h-4 text-accent-foreground" />
            </div>
          </div>

          <div className="text-center space-y-2 max-w-md">
            <h2 className="text-2xl font-semibold text-foreground">No livestock registered yet</h2>
            <p className="text-muted-foreground">
              Start by adding your animals to track their health, feeding schedules, and breeding programs.
            </p>
          </div>

          <Dialog open={isAddAnimalOpen} onOpenChange={setIsAddAnimalOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="mt-4">
                <Plus className="w-4 h-4 mr-2" />
                Register Your First Animals
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Livestock Group</DialogTitle>
                <DialogDescription>
                  Register a group of animals to start tracking their health and management.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="animal-type">Animal Type</Label>
                  <Select value={newAnimal.type} onValueChange={(value) => setNewAnimal({ ...newAnimal, type: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select animal type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cattle">Cattle</SelectItem>
                      <SelectItem value="Pigs">Pigs</SelectItem>
                      <SelectItem value="Chickens">Chickens</SelectItem>
                      <SelectItem value="Sheep">Sheep</SelectItem>
                      <SelectItem value="Goats">Goats</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="count">Number of Animals</Label>
                  <Input
                    id="count"
                    type="number"
                    placeholder="e.g., 25"
                    value={newAnimal.count}
                    onChange={(e) => setNewAnimal({ ...newAnimal, count: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="breed">Breed (Optional)</Label>
                  <Input
                    id="breed"
                    placeholder="e.g., Holstein, Yorkshire"
                    value={newAnimal.breed}
                    onChange={(e) => setNewAnimal({ ...newAnimal, breed: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="avg-weight">Avg Weight (lbs)</Label>
                    <Input
                      id="avg-weight"
                      type="number"
                      placeholder="Optional"
                      value={newAnimal.avgWeight}
                      onChange={(e) => setNewAnimal({ ...newAnimal, avgWeight: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="avg-age">Avg Age (months)</Label>
                    <Input
                      id="avg-age"
                      type="number"
                      placeholder="Optional"
                      value={newAnimal.avgAge}
                      onChange={(e) => setNewAnimal({ ...newAnimal, avgAge: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddAnimalOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={addNewAnimal}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Animals
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Getting Started Tips */}
          <Card className="w-full max-w-2xl bg-gradient-to-r from-accent/30 to-secondary/30 border-border">
            <CardHeader>
              <CardTitle className="text-card-foreground flex items-center gap-2">
                <Heart className="w-5 h-5 text-primary" />
                Getting Started with Livestock Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-sm font-semibold text-primary">1</span>
                  </div>
                  <div>
                    <p className="font-medium text-card-foreground">Register Animal Groups</p>
                    <p className="text-sm text-muted-foreground">Add your cattle, pigs, chickens, or other livestock by type and count</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-sm font-semibold text-primary">2</span>
                  </div>
                  <div>
                    <p className="font-medium text-card-foreground">Monitor Health</p>
                    <p className="text-sm text-muted-foreground">Track vaccinations, health checks, and breeding status</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-sm font-semibold text-primary">3</span>
                  </div>
                  <div>
                    <p className="font-medium text-card-foreground">Manage Feeding</p>
                    <p className="text-sm text-muted-foreground">Set up feeding schedules and track feed consumption</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const totalAnimals = livestock.reduce((sum, group) => sum + group.count, 0);
  const totalBreeding = livestock.reduce((sum, group) => sum + group.breeding, 0);
  const avgHealthScore = livestock.length > 0 ? 
    livestock.reduce((sum, group) => sum + (group.healthStatus === 'Excellent' ? 100 : group.healthStatus === 'Good' ? 85 : group.healthStatus === 'Fair' ? 70 : 50), 0) / livestock.length : 0;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col space-y-2 md:flex-row md:justify-between md:items-center md:space-y-0">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Livestock Management</h1>
          <p className="text-muted-foreground">Monitor animal health, feeding, and breeding programs.</p>
        </div>
        <Dialog open={isAddAnimalOpen} onOpenChange={setIsAddAnimalOpen}>
          <DialogTrigger asChild>
            <Button className="md:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Add More Animals
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Livestock Group</DialogTitle>
              <DialogDescription>
                Register a group of animals to start tracking their health and management.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="animal-type">Animal Type</Label>
                <Select value={newAnimal.type} onValueChange={(value) => setNewAnimal({ ...newAnimal, type: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select animal type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cattle">Cattle</SelectItem>
                    <SelectItem value="Pigs">Pigs</SelectItem>
                    <SelectItem value="Chickens">Chickens</SelectItem>
                    <SelectItem value="Sheep">Sheep</SelectItem>
                    <SelectItem value="Goats">Goats</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="count">Number of Animals</Label>
                <Input
                  id="count"
                  type="number"
                  placeholder="e.g., 25"
                  value={newAnimal.count}
                  onChange={(e) => setNewAnimal({ ...newAnimal, count: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="breed">Breed (Optional)</Label>
                <Input
                  id="breed"
                  placeholder="e.g., Holstein, Yorkshire"
                  value={newAnimal.breed}
                  onChange={(e) => setNewAnimal({ ...newAnimal, breed: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="avg-weight">Avg Weight (lbs)</Label>
                  <Input
                    id="avg-weight"
                    type="number"
                    placeholder="Optional"
                    value={newAnimal.avgWeight}
                    onChange={(e) => setNewAnimal({ ...newAnimal, avgWeight: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="avg-age">Avg Age (months)</Label>
                  <Input
                    id="avg-age"
                    type="number"
                    placeholder="Optional"
                    value={newAnimal.avgAge}
                    onChange={(e) => setNewAnimal({ ...newAnimal, avgAge: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddAnimalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={addNewAnimal}>
                <Plus className="w-4 h-4 mr-2" />
                Add Animals
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="health">Health Monitoring</TabsTrigger>
          <TabsTrigger value="feeding">Feeding Schedule</TabsTrigger>
          <TabsTrigger value="breeding">Breeding Program</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Animals</CardTitle>
                <Users className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalAnimals}</div>
                <p className="text-xs text-muted-foreground">{livestock.length} groups registered</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Health Score</CardTitle>
                <Heart className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Math.round(avgHealthScore)}%</div>
                <p className="text-xs text-muted-foreground">Overall health rating</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Breeding</CardTitle>
                <Baby className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalBreeding}</div>
                <p className="text-xs text-muted-foreground">Animals in breeding program</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Animal Types</CardTitle>
                <TrendingUp className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{livestock.length}</div>
                <p className="text-xs text-muted-foreground">Different animal types</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Livestock Groups</CardTitle>
              <CardDescription>Overview of all animal groups on the farm</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Count</TableHead>
                    <TableHead>Avg Weight</TableHead>
                    <TableHead>Health Status</TableHead>
                    <TableHead>Vaccinated</TableHead>
                    <TableHead>Breeding</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {livestock.map((group) => (
                    <TableRow key={group.id}>
                      <TableCell className="font-medium">
                        {group.type} {group.breed && `(${group.breed})`}
                      </TableCell>
                      <TableCell>{group.count}</TableCell>
                      <TableCell>{group.avgWeight} lbs</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getHealthColor(group.healthStatus)}>
                          {group.healthStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>{group.vaccinated}/{group.count}</TableCell>
                      <TableCell>{group.breeding}</TableCell>
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
                <CardTitle>Health Alerts</CardTitle>
                <CardDescription>Animals requiring attention</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No health alerts at this time</p>
                  <p className="text-sm">All animals are healthy!</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Feeding Summary</CardTitle>
                <CardDescription>Daily feed consumption and costs</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {livestock.map((group) => (
                  <div key={group.id} className="flex justify-between items-center p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{group.type} Feed</p>
                      <p className="text-sm text-muted-foreground">
                        {group.count} animals • {group.feedingSchedule}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        ${Math.round(group.count * (group.type === 'Cattle' ? 0.75 : group.type === 'Pigs' ? 0.88 : group.type === 'Chickens' ? 0.24 : 0.65))}
                      </p>
                      <p className="text-sm text-muted-foreground">Daily cost</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Animal Health Records</CardTitle>
                <CardDescription>Health information for your livestock groups</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {livestock.map((group) => (
                    <div key={group.id} className="p-4 border rounded-lg space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium">{group.type} Group</h4>
                          <p className="text-sm text-muted-foreground">
                            {group.count} animals • {group.breed && `${group.breed} breed`}
                          </p>
                        </div>
                        <Badge variant="outline" className={getHealthColor(group.healthStatus)}>
                          {group.healthStatus}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Avg Weight:</span> {group.avgWeight} lbs
                        </div>
                        <div>
                          <span className="text-muted-foreground">Avg Age:</span> {group.avgAge} months
                        </div>
                        <div>
                          <span className="text-muted-foreground">Last checkup:</span> {group.lastHealthCheck}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Vaccinated:</span> {group.vaccinated}/{group.count}
                        </div>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button variant="outline" size="sm">
                          <Heart className="w-3 h-3 mr-1" />
                          Health Check
                        </Button>
                        <Button variant="outline" size="sm">
                          <Edit className="w-3 h-3 mr-1" />
                          Update
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Schedule Health Check</CardTitle>
                <CardDescription>Plan routine health inspections</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="animal-group">Animal Group</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select animal group" />
                    </SelectTrigger>
                    <SelectContent>
                      {livestock.map((group) => (
                        <SelectItem key={group.id} value={group.type.toLowerCase()}>
                          {group.type} ({group.count} animals)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="check-type">Check Type</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select check type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="routine">Routine Inspection</SelectItem>
                      <SelectItem value="vaccination">Vaccination</SelectItem>
                      <SelectItem value="weight">Weight Check</SelectItem>
                      <SelectItem value="breeding">Breeding Exam</SelectItem>
                      <SelectItem value="emergency">Emergency Check</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="scheduled-date">Scheduled Date</Label>  
                  <Input type="date" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="veterinarian">Veterinarian</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select veterinarian" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dr-smith">Dr. Smith</SelectItem>
                      <SelectItem value="dr-johnson">Dr. Johnson</SelectItem>
                      <SelectItem value="dr-wilson">Dr. Wilson</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button className="w-full">
                  <Calendar className="w-4 h-4 mr-2" />
                  Schedule Check
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="feeding" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Feeding Schedules</CardTitle>
                <CardDescription>Daily feeding routines for each animal group</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {livestock.map((group) => (
                  <div key={group.id} className="p-4 border rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium">{group.type}</h4>
                      <Badge variant="outline">{group.feedingSchedule}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>Count: {group.count} animals</p>
                      <p>Daily consumption: {Math.round(group.count * (group.type === 'Cattle' ? 10 : group.type === 'Pigs' ? 10 : group.type === 'Chickens' ? 0.3 : 7))} lbs</p>
                      <p>Cost per day: ${Math.round(group.count * (group.type === 'Cattle' ? 0.75 : group.type === 'Pigs' ? 0.88 : group.type === 'Chickens' ? 0.24 : 0.65))}</p>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button variant="outline" size="sm">
                        <Edit className="w-3 h-3 mr-1" />
                        Edit Schedule
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Feed Inventory</CardTitle>
                <CardDescription>Current feed stock levels</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center py-8 text-muted-foreground">
                  <Scale className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Set up feed inventory tracking</p>
                  <p className="text-sm">Add feed types and quantities</p>
                </div>
                <Button className="w-full" variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Set Up Feed Inventory
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="breeding" className="space-y-4">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Breeding Program</CardTitle>
                <CardDescription>Track breeding activities and expected births</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Baby className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No breeding records yet</p>
                  <p className="text-sm">Start tracking breeding programs and pregnancies</p>
                </div>
                <Button className="w-full mt-4" variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Breeding Record
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}