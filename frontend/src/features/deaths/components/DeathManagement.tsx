import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/context/AuthContext';
import { apiFetch, ApiError, downloadFile, resolveAssetUrl, type Page } from '@/services/api';
import { enqueueDeath } from '@/services/outbox';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, Upload, ImageIcon, Download } from 'lucide-react';

interface Animal {
  id: number;
  name: string;
  animal_type: string;
  tag_number: string | null;
  status: 'alive' | 'dead';
}

interface DeathRecord {
  id: number;
  animal_id: number;
  reported_by_user_id: number;
  cause_of_death: string;
  date_of_death: string;
  image_path: string;
  notes: string | null;
  created_at: string;
}

export const DeathManagement: React.FC = () => {
  const { user } = useAuth();
  const isManager = user?.role === 'manager';
  const online = useOnlineStatus();

  const [animals, setAnimals] = useState<Animal[]>([]);
  const [deaths, setDeaths] = useState<DeathRecord[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  // Form state
  const [selectedAnimalId, setSelectedAnimalId] = useState('');
  const [cause, setCause] = useState('');
  const [dateOfDeath, setDateOfDeath] = useState('');
  const [notes, setNotes] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitQueued, setSubmitQueued] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const aliveAnimals = animals.filter((a) => a.status === 'alive');

  const fetchData = useCallback(async () => {
    try {
      const [animalsData, deathsData] = await Promise.all([
        apiFetch<Page<Animal>>('/api/animals?limit=200'),
        apiFetch<Page<DeathRecord>>('/api/deaths?limit=200'),
      ]);
      setAnimals(animalsData.items);
      setDeaths(deathsData.items);
    } catch (e) {
      setDataError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setImagePreview(url);
    } else {
      setImagePreview(null);
    }
  };

  const resetForm = () => {
    setSelectedAnimalId('');
    setCause('');
    setDateOfDeath('');
    setNotes('');
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAnimalId || !cause || !dateOfDeath || !imageFile) return;

    const fields: Record<string, string> = {
      animal_id: selectedAnimalId,
      cause_of_death: cause,
      date_of_death: dateOfDeath,
    };
    if (notes) fields.notes = notes;
    const label = getAnimalName(Number(selectedAnimalId));

    const queueOffline = async () => {
      await enqueueDeath(fields, imageFile, label);
      resetForm();
      setSubmitSuccess(false);
      setSubmitQueued(true);
    };

    if (!online) {
      await queueOffline();
      return;
    }

    setSubmitLoading(true);
    setSubmitError(null);
    setSubmitSuccess(false);
    setSubmitQueued(false);

    try {
      const formData = new FormData();
      Object.entries(fields).forEach(([k, v]) => formData.append(k, v));
      formData.append('file', imageFile);

      await apiFetch<DeathRecord>('/api/deaths', {
        method: 'POST',
        body: formData,
      });

      resetForm();
      setSubmitSuccess(true);
      await fetchData();
    } catch (e) {
      // Network failure mid-submit: queue it (with its hashed image) instead.
      if (e instanceof ApiError && e.isOffline) {
        await queueOffline();
      } else {
        setSubmitError(
          e instanceof ApiError
            ? e.message
            : 'Failed to submit — this report was NOT saved. Please try again.'
        );
      }
    } finally {
      setSubmitLoading(false);
    }
  };

  const getAnimalName = (id: number) => {
    const a = animals.find((a) => a.id === id);
    return a ? `${a.name}${a.tag_number ? ` (${a.tag_number})` : ''}` : `Animal #${id}`;
  };

  if (loadingData) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const thisMonth = deaths.filter((d) => {
    const dt = new Date(d.date_of_death);
    const now = new Date();
    return dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-destructive" /> Death Reports
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {deaths.length} total reports &mdash; {thisMonth} this month
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => downloadFile('/api/deaths/export.csv', 'deaths.csv')}
          disabled={!online || deaths.length === 0}
        >
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </div>

      {dataError && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
          {dataError}
        </div>
      )}

      <Tabs defaultValue={isManager ? 'all' : 'report'}>
        <TabsList>
          <TabsTrigger value="report">Report Death</TabsTrigger>
          {isManager ? (
            <TabsTrigger value="all">All Reports</TabsTrigger>
          ) : (
            <TabsTrigger value="mine">My Reports</TabsTrigger>
          )}
        </TabsList>

        {/* Report Form Tab */}
        <TabsContent value="report">
          <Card className="max-w-lg">
            <CardHeader>
              <CardTitle className="text-base">Submit Death Report</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {submitSuccess && (
                  <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
                    Death report submitted successfully.
                  </div>
                )}
                {submitQueued && (
                  <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-700">
                    Saved offline — this report will sync automatically when you reconnect. Track it
                    from the cloud icon in the header.
                  </div>
                )}
                {submitError && (
                  <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                    {submitError}
                  </div>
                )}

                <div className="space-y-1">
                  <Label>Animal *</Label>
                  <Select value={selectedAnimalId} onValueChange={setSelectedAnimalId} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select alive animal..." />
                    </SelectTrigger>
                    <SelectContent>
                      {aliveAnimals.length === 0 ? (
                        <SelectItem value="" disabled>
                          No alive animals
                        </SelectItem>
                      ) : (
                        aliveAnimals.map((a) => (
                          <SelectItem key={a.id} value={String(a.id)}>
                            {a.name}
                            {a.tag_number ? ` — ${a.tag_number}` : ''}{' '}
                            <span className="capitalize text-muted-foreground">
                              ({a.animal_type})
                            </span>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Cause of Death *</Label>
                  <Input
                    value={cause}
                    onChange={(e) => setCause(e.target.value)}
                    placeholder="e.g. Disease, Injury, Natural causes"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label>Date of Death *</Label>
                  <Input
                    type="date"
                    value={dateOfDeath}
                    onChange={(e) => setDateOfDeath(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label>Notes</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Additional details..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Photo Evidence *</Label>
                  <p className="text-xs text-muted-foreground">
                    A unique photo is required. Previously used images will be rejected.
                  </p>
                  <div
                    className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="mx-auto max-h-40 rounded object-contain"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <ImageIcon className="h-8 w-8" />
                        <span className="text-sm">Click to select image</span>
                        <span className="text-xs">JPG, PNG, WebP up to 10MB</span>
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                  {imageFile && <p className="text-xs text-muted-foreground">{imageFile.name}</p>}
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  variant="destructive"
                  disabled={
                    submitLoading || !selectedAnimalId || !cause || !dateOfDeath || !imageFile
                  }
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {submitLoading
                    ? 'Submitting...'
                    : online
                      ? 'Submit Death Report'
                      : 'Save offline'}
                </Button>
                {!online && (
                  <p className="text-xs text-amber-600 text-center">
                    You&rsquo;re offline. This report will be queued and synced automatically when
                    you reconnect.
                  </p>
                )}
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* All Reports (manager) */}
        <TabsContent value="all">
          <DeathTable deaths={deaths} animals={animals} getAnimalName={getAnimalName} />
        </TabsContent>

        {/* My Reports (employee) */}
        <TabsContent value="mine">
          <DeathTable
            deaths={deaths.filter((d) => d.reported_by_user_id === user?.id)}
            animals={animals}
            getAnimalName={getAnimalName}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

interface DeathTableProps {
  deaths: DeathRecord[];
  animals: Animal[];
  getAnimalName: (id: number) => string;
}

const DeathTable: React.FC<DeathTableProps> = ({ deaths, getAnimalName }) => {
  if (deaths.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
        <AlertTriangle className="h-8 w-8 mb-2" />
        <p>No death reports yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Animal</th>
            <th className="px-4 py-3 text-left font-medium">Cause</th>
            <th className="px-4 py-3 text-left font-medium">Date</th>
            <th className="px-4 py-3 text-left font-medium">Photo</th>
            <th className="px-4 py-3 text-left font-medium">Reported</th>
          </tr>
        </thead>
        <tbody>
          {deaths.map((d) => (
            <tr key={d.id} className="border-t hover:bg-muted/30">
              <td className="px-4 py-3 font-medium">{getAnimalName(d.animal_id)}</td>
              <td className="px-4 py-3">{d.cause_of_death}</td>
              <td className="px-4 py-3">{new Date(d.date_of_death).toLocaleDateString()}</td>
              <td className="px-4 py-3">
                <a href={resolveAssetUrl(d.image_path)} target="_blank" rel="noopener noreferrer">
                  <img
                    src={resolveAssetUrl(d.image_path)}
                    alt="death evidence"
                    className="h-10 w-10 object-cover rounded cursor-pointer hover:opacity-80"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </a>
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground">
                {new Date(d.created_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
