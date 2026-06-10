import React, { useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/context/AuthContext';
import { apiFetch, ApiError } from '@/services/api';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PawPrint, Plus, Pencil, Trash2 } from 'lucide-react';

interface Animal {
  id: number;
  name: string;
  animal_type: string;
  tag_number: string | null;
  breed: string | null;
  date_of_birth: string | null;
  status: 'alive' | 'dead';
  notes: string | null;
  added_by_user_id: number;
  created_at: string;
  updated_at: string;
}

const ANIMAL_TYPES = ['cattle', 'sheep', 'goat', 'pig', 'horse', 'chicken', 'other'] as const;

const emptyForm = {
  name: '',
  animal_type: '' as string,
  tag_number: '',
  breed: '',
  date_of_birth: '',
  notes: '',
};

export const AnimalManagement: React.FC = () => {
  const { user } = useAuth();
  const online = useOnlineStatus();
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'alive' | 'dead'>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Add dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ ...emptyForm });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editAnimal, setEditAnimal] = useState<Animal | null>(null);
  const [editForm, setEditForm] = useState({ ...emptyForm });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const fetchAnimals = async () => {
    try {
      const data = await apiFetch<Animal[]>('/api/animals', {}, user?.token);
      setAnimals(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load animals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnimals();
  }, []);

  const filtered = animals.filter((a) => {
    if (filterStatus !== 'all' && a.status !== filterStatus) return false;
    if (filterType !== 'all' && a.animal_type !== filterType) return false;
    if (
      search &&
      !a.name.toLowerCase().includes(search.toLowerCase()) &&
      !(a.tag_number ?? '').toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.name || !addForm.animal_type) return;
    if (!online) {
      setAddError("You're offline — this animal was NOT saved. Reconnect and try again.");
      return;
    }
    setAddLoading(true);
    setAddError(null);
    try {
      await apiFetch<Animal>(
        '/api/animals',
        {
          method: 'POST',
          body: JSON.stringify({
            name: addForm.name,
            animal_type: addForm.animal_type,
            tag_number: addForm.tag_number || null,
            breed: addForm.breed || null,
            date_of_birth: addForm.date_of_birth || null,
            notes: addForm.notes || null,
          }),
        },
        user?.token
      );
      setAddForm({ ...emptyForm });
      setAddOpen(false);
      await fetchAnimals();
    } catch (e) {
      setAddError(e instanceof ApiError ? e.message : 'Failed to add animal');
    } finally {
      setAddLoading(false);
    }
  };

  const openEdit = (animal: Animal) => {
    setEditAnimal(animal);
    setEditForm({
      name: animal.name,
      animal_type: animal.animal_type,
      tag_number: animal.tag_number ?? '',
      breed: animal.breed ?? '',
      date_of_birth: animal.date_of_birth ?? '',
      notes: animal.notes ?? '',
    });
    setEditError(null);
    setEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAnimal) return;
    if (!online) {
      setEditError("You're offline — changes were NOT saved. Reconnect and try again.");
      return;
    }
    setEditLoading(true);
    setEditError(null);
    try {
      await apiFetch<Animal>(
        `/api/animals/${editAnimal.id}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            name: editForm.name || undefined,
            animal_type: editForm.animal_type || undefined,
            tag_number: editForm.tag_number || null,
            breed: editForm.breed || null,
            date_of_birth: editForm.date_of_birth || null,
            notes: editForm.notes || null,
          }),
        },
        user?.token
      );
      setEditOpen(false);
      await fetchAnimals();
    } catch (e) {
      setEditError(e instanceof ApiError ? e.message : 'Failed to update animal');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async (animal: Animal) => {
    if (!online) {
      alert("You're offline — cannot delete right now. Reconnect and try again.");
      return;
    }
    if (!confirm(`Delete ${animal.name}? This cannot be undone.`)) return;
    try {
      await apiFetch(`/api/animals/${animal.id}`, { method: 'DELETE' }, user?.token);
      await fetchAnimals();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete animal');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading animals...</p>
      </div>
    );
  }

  const alive = animals.filter((a) => a.status === 'alive').length;
  const dead = animals.filter((a) => a.status === 'dead').length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <PawPrint className="h-6 w-6" /> Animal Records
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {animals.length} total &mdash; {alive} alive, {dead} dead
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)} disabled={!online}>
          <Plus className="h-4 w-4 mr-2" /> Add Animal
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">All Animals</TabsTrigger>
          <TabsTrigger value="stats">Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <Input
              placeholder="Search by name or tag..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <Select
              value={filterStatus}
              onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="alive">Alive</SelectItem>
                <SelectItem value="dead">Dead</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {ANIMAL_TYPES.map((t) => (
                  <SelectItem key={t} value={t} className="capitalize">
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Tag #</th>
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Type</th>
                  <th className="px-4 py-3 text-left font-medium">Breed</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Added</th>
                  <th className="px-4 py-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      No animals found
                    </td>
                  </tr>
                ) : (
                  filtered.map((animal) => (
                    <tr key={animal.id} className="border-t hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono text-xs">
                        {animal.tag_number ?? <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 font-medium">{animal.name}</td>
                      <td className="px-4 py-3 capitalize">{animal.animal_type}</td>
                      <td className="px-4 py-3 text-muted-foreground">{animal.breed ?? '—'}</td>
                      <td className="px-4 py-3">
                        <Badge variant={animal.status === 'alive' ? 'default' : 'destructive'}>
                          {animal.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {new Date(animal.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEdit(animal)}
                            disabled={animal.status === 'dead'}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          {user?.role === 'manager' && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDelete(animal)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="stats">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {ANIMAL_TYPES.map((type) => {
              const count = animals.filter((a) => a.animal_type === type).length;
              return (
                <Card key={type}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm capitalize">{type}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{count}</p>
                    <p className="text-xs text-muted-foreground">
                      {animals.filter((a) => a.animal_type === type && a.status === 'alive').length}{' '}
                      alive
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Animal Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Animal</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            {addError && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                {addError}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Name *</Label>
                <Input
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Type *</Label>
                <Select
                  value={addForm.animal_type}
                  onValueChange={(v) => setAddForm({ ...addForm, animal_type: v })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {ANIMAL_TYPES.map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Tag Number</Label>
                <Input
                  value={addForm.tag_number}
                  onChange={(e) => setAddForm({ ...addForm, tag_number: e.target.value })}
                  placeholder="e.g. COW-001"
                />
              </div>
              <div className="space-y-1">
                <Label>Breed</Label>
                <Input
                  value={addForm.breed}
                  onChange={(e) => setAddForm({ ...addForm, breed: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Date of Birth</Label>
                <Input
                  type="date"
                  value={addForm.date_of_birth}
                  onChange={(e) => setAddForm({ ...addForm, date_of_birth: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea
                value={addForm.notes}
                onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                rows={2}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={addLoading || !online || !addForm.name || !addForm.animal_type}
              >
                {addLoading ? 'Adding...' : 'Add Animal'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Animal Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Animal</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            {editError && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                {editError}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Type</Label>
                <Select
                  value={editForm.animal_type}
                  onValueChange={(v) => setEditForm({ ...editForm, animal_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ANIMAL_TYPES.map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Tag Number</Label>
                <Input
                  value={editForm.tag_number}
                  onChange={(e) => setEditForm({ ...editForm, tag_number: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Breed</Label>
                <Input
                  value={editForm.breed}
                  onChange={(e) => setEditForm({ ...editForm, breed: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Date of Birth</Label>
                <Input
                  type="date"
                  value={editForm.date_of_birth}
                  onChange={(e) => setEditForm({ ...editForm, date_of_birth: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                rows={2}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={editLoading || !online}>
                {editLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
