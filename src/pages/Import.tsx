/**
 * Data Import Wizard
 * CSV import with smart field mapping and validation
 */

import { useState, useCallback, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Sparkles,
  Download,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

// CRM field definitions
const CRM_FIELDS = {
  contacts: [
    { value: 'first_name', label: 'First Name', required: true },
    { value: 'last_name', label: 'Last Name', required: true },
    { value: 'email', label: 'Email', required: true },
    { value: 'phone', label: 'Phone' },
    { value: 'mobile', label: 'Mobile Phone' },
    { value: 'company', label: 'Company' },
    { value: 'job_title', label: 'Job Title' },
    { value: 'address', label: 'Address' },
    { value: 'city', label: 'City' },
    { value: 'state', label: 'State' },
    { value: 'zip', label: 'ZIP Code' },
    { value: 'country', label: 'Country' },
    { value: 'linkedin_url', label: 'LinkedIn URL' },
    { value: 'notes', label: 'Notes' },
    { value: 'tags', label: 'Tags' },
    { value: 'source', label: 'Lead Source' },
  ],
  leads: [
    { value: 'name', label: 'Name', required: true },
    { value: 'email', label: 'Email', required: true },
    { value: 'phone', label: 'Phone' },
    { value: 'company', label: 'Company' },
    { value: 'source', label: 'Source' },
    { value: 'status', label: 'Status' },
    { value: 'score', label: 'Lead Score' },
    { value: 'notes', label: 'Notes' },
  ],
  companies: [
    { value: 'name', label: 'Company Name', required: true },
    { value: 'domain', label: 'Domain' },
    { value: 'industry', label: 'Industry' },
    { value: 'employee_count', label: 'Employee Count' },
    { value: 'annual_revenue', label: 'Annual Revenue' },
    { value: 'phone', label: 'Phone' },
    { value: 'address', label: 'Address' },
    { value: 'city', label: 'City' },
    { value: 'country', label: 'Country' },
    { value: 'website', label: 'Website' },
    { value: 'linkedin_url', label: 'LinkedIn URL' },
  ],
};

type ImportType = 'contacts' | 'leads' | 'companies';
type DuplicateAction = 'skip' | 'update';

interface FieldMapping {
  csvHeader: string;
  crmField: string | null;
  confidence: number;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
  value: string;
}

// Levenshtein distance for fuzzy matching
function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = b.charAt(i - 1) === a.charAt(j - 1)
        ? matrix[i - 1][j - 1]
        : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
    }
  }
  return matrix[b.length][a.length];
}

function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a.toLowerCase(), b.toLowerCase()) / maxLen;
}

// Auto-guess field mappings
function autoMapFields(csvHeaders: string[], crmFields: typeof CRM_FIELDS.contacts): FieldMapping[] {
  const commonAliases: Record<string, string[]> = {
    first_name: ['firstname', 'first', 'fname', 'given name'],
    last_name: ['lastname', 'last', 'lname', 'surname', 'family name'],
    email: ['e-mail', 'email address', 'mail'],
    phone: ['telephone', 'tel', 'phone number', 'work phone'],
    mobile: ['cell', 'cellphone', 'mobile phone', 'cell phone'],
    company: ['organization', 'org', 'company name', 'employer'],
    job_title: ['title', 'position', 'role', 'job'],
    linkedin_url: ['linkedin', 'linkedin profile'],
    address: ['street', 'street address', 'address1'],
    zip: ['postal', 'postal code', 'zipcode'],
  };

  return csvHeaders.map(header => {
    let bestMatch: string | null = null;
    let bestScore = 0;

    const normalizedHeader = header.toLowerCase().trim().replace(/[_\-]/g, ' ');

    for (const field of crmFields) {
      const fieldName = field.value.replace(/_/g, ' ');
      const aliases = commonAliases[field.value] || [];

      // Check exact match
      if (normalizedHeader === fieldName || aliases.includes(normalizedHeader)) {
        bestMatch = field.value;
        bestScore = 1;
        break;
      }

      // Check similarity
      let score = similarity(normalizedHeader, fieldName);
      for (const alias of aliases) {
        score = Math.max(score, similarity(normalizedHeader, alias));
      }

      if (score > bestScore && score > 0.5) {
        bestScore = score;
        bestMatch = field.value;
      }
    }

    return {
      csvHeader: header,
      crmField: bestMatch,
      confidence: bestScore,
    };
  });
}

// Validate email format
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Validate phone format
function isValidPhone(phone: string): boolean {
  return /^[\d\s\-\+\(\)]+$/.test(phone) && phone.replace(/\D/g, '').length >= 7;
}

export default function Import() {
  const [step, setStep] = useState<'upload' | 'mapping' | 'validation' | 'import'>('upload');
  const [importType, setImportType] = useState<ImportType>('contacts');
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [duplicateAction, setDuplicateAction] = useState<DuplicateAction>('skip');
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStats, setImportStats] = useState({ created: 0, updated: 0, skipped: 0, errors: 0 });
  const { toast } = useToast();

  const crmFields = CRM_FIELDS[importType];

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setCsvData(results.data);
        setCsvHeaders(results.meta.fields || []);
        const mappings = autoMapFields(results.meta.fields || [], crmFields);
        setFieldMappings(mappings);
        setStep('mapping');
        toast({
          title: 'File uploaded',
          description: `Found ${results.data.length} rows and ${results.meta.fields?.length} columns`,
        });
      },
      error: (error) => {
        toast({
          title: 'Parse error',
          description: error.message,
          variant: 'destructive',
        });
      },
    });
  }, [crmFields, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls', '.xlsx'],
    },
    maxFiles: 1,
  });

  const updateMapping = (csvHeader: string, crmField: string | null) => {
    setFieldMappings(prev =>
      prev.map(m =>
        m.csvHeader === csvHeader ? { ...m, crmField, confidence: crmField ? 1 : 0 } : m
      )
    );
  };

  const validateData = () => {
    const errors: ValidationError[] = [];
    const requiredFields = crmFields.filter(f => f.required).map(f => f.value);
    const mappedRequired = fieldMappings.filter(
      m => m.crmField && requiredFields.includes(m.crmField)
    );

    // Check if all required fields are mapped
    for (const reqField of requiredFields) {
      if (!mappedRequired.some(m => m.crmField === reqField)) {
        errors.push({
          row: 0,
          field: reqField,
          message: `Required field "${crmFields.find(f => f.value === reqField)?.label}" is not mapped`,
          value: '',
        });
      }
    }

    // Validate each row
    csvData.forEach((row, idx) => {
      fieldMappings.forEach(mapping => {
        if (!mapping.crmField) return;

        const value = row[mapping.csvHeader];

        // Check required fields
        if (requiredFields.includes(mapping.crmField) && !value) {
          errors.push({
            row: idx + 1,
            field: mapping.crmField,
            message: 'Required field is empty',
            value: '',
          });
        }

        // Validate email
        if (mapping.crmField === 'email' && value && !isValidEmail(value)) {
          errors.push({
            row: idx + 1,
            field: 'email',
            message: 'Invalid email format',
            value,
          });
        }

        // Validate phone
        if (['phone', 'mobile'].includes(mapping.crmField) && value && !isValidPhone(value)) {
          errors.push({
            row: idx + 1,
            field: mapping.crmField,
            message: 'Invalid phone format',
            value,
          });
        }
      });
    });

    setValidationErrors(errors);
    setStep('validation');
  };

  const startImport = async () => {
    setImporting(true);
    setImportProgress(0);
    setImportStats({ created: 0, updated: 0, skipped: 0, errors: 0 });

    const batchSize = 100;
    const totalRows = csvData.length;
    let stats = { created: 0, updated: 0, skipped: 0, errors: 0 };

    try {
      for (let i = 0; i < totalRows; i += batchSize) {
        const batch = csvData.slice(i, i + batchSize);
        const batchResult = await processBatch(batch);
        stats.created += batchResult.created;
        stats.updated += batchResult.updated;
        stats.skipped += batchResult.skipped;
        stats.errors += batchResult.errors;
        setImportStats({ ...stats });
        setImportProgress(Math.min(100, Math.round(((i + batch.length) / totalRows) * 100)));
      }

      setStep('import');
      toast({
        title: 'Import complete',
        description: `Created: ${stats.created}, Updated: ${stats.updated}, Skipped: ${stats.skipped}, Errors: ${stats.errors}`,
      });
    } catch (error) {
      toast({
        title: 'Import failed',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  const processBatch = async (batch: any[]): Promise<typeof importStats> => {
    const stats = { created: 0, updated: 0, skipped: 0, errors: 0 };

    for (const row of batch) {
      try {
        // Map CSV row to CRM record
        const record: Record<string, any> = {};
        fieldMappings.forEach(mapping => {
          if (mapping.crmField && row[mapping.csvHeader]) {
            record[mapping.crmField] = row[mapping.csvHeader];
          }
        });

        // Check for duplicates (by email)
        if (record.email) {
          const { data: existing } = await supabase
            .from(importType)
            .select('id')
            .eq('email', record.email)
            .single();

          if (existing) {
            if (duplicateAction === 'skip') {
              stats.skipped++;
              continue;
            } else {
              // Update existing
              const { error } = await supabase
                .from(importType)
                .update(record)
                .eq('id', existing.id);

              if (error) {
                stats.errors++;
              } else {
                stats.updated++;
              }
              continue;
            }
          }
        }

        // Create new record
        const { error } = await supabase.from(importType).insert(record);
        if (error) {
          stats.errors++;
        } else {
          stats.created++;
        }
      } catch (e) {
        stats.errors++;
      }
    }

    return stats;
  };

  const downloadTemplate = () => {
    const headers = crmFields.map(f => f.label).join(',');
    const blob = new Blob([headers + '\n'], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${importType}_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const mappedFieldsCount = fieldMappings.filter(m => m.crmField).length;
  const autoMappedCount = fieldMappings.filter(m => m.confidence > 0.8).length;
  const rowErrorCount = new Set(validationErrors.filter(e => e.row > 0).map(e => e.row)).size;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background">
      <Header
        title="Import Data"
        subtitle="Import contacts, leads, or companies from CSV"
      />

      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Progress Steps */}
        <div className="flex items-center justify-between">
          {['upload', 'mapping', 'validation', 'import'].map((s, idx) => (
            <div key={s} className="flex items-center">
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === s
                    ? 'bg-primary text-primary-foreground'
                    : ['upload', 'mapping', 'validation', 'import'].indexOf(step) > idx
                    ? 'bg-green-500 text-white'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {['upload', 'mapping', 'validation', 'import'].indexOf(step) > idx ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  idx + 1
                )}
              </div>
              <span className="ml-2 text-sm font-medium capitalize hidden sm:inline">{s}</span>
              {idx < 3 && <div className="w-12 sm:w-24 h-0.5 bg-muted mx-2" />}
            </div>
          ))}
        </div>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <Card>
            <CardHeader>
              <CardTitle>Upload CSV File</CardTitle>
              <CardDescription>
                Select what you're importing and upload your CSV file
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Import Type</Label>
                <RadioGroup
                  value={importType}
                  onValueChange={(v) => setImportType(v as ImportType)}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="contacts" id="contacts" />
                    <Label htmlFor="contacts">Contacts</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="leads" id="leads" />
                    <Label htmlFor="leads">Leads</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="companies" id="companies" />
                    <Label htmlFor="companies">Companies</Label>
                  </div>
                </RadioGroup>
              </div>

              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? 'border-primary bg-primary/5'
                    : 'border-muted-foreground/25 hover:border-primary/50'
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium">
                  {isDragActive ? 'Drop the file here' : 'Drag & drop your CSV file'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  or click to browse
                </p>
                <p className="text-xs text-muted-foreground mt-4">
                  Supported formats: .csv, .xls, .xlsx
                </p>
              </div>

              <div className="flex justify-between items-center pt-4 border-t">
                <Button variant="outline" onClick={downloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
                <p className="text-sm text-muted-foreground">
                  Need help? <a href="#" className="text-primary hover:underline">View import guide</a>
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Field Mapping */}
        {step === 'mapping' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Map Fields</CardTitle>
                  <CardDescription>
                    Match your CSV columns to CRM fields
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  {autoMappedCount} auto-mapped
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Sparkles className="h-4 w-4" />
                <AlertTitle>Smart Mapping</AlertTitle>
                <AlertDescription>
                  We've automatically mapped {autoMappedCount} of {csvHeaders.length} fields.
                  Review and adjust the mappings below.
                </AlertDescription>
              </Alert>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>CSV Column</TableHead>
                    <TableHead>Sample Data</TableHead>
                    <TableHead>CRM Field</TableHead>
                    <TableHead>Confidence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fieldMappings.map((mapping) => (
                    <TableRow key={mapping.csvHeader}>
                      <TableCell className="font-medium">{mapping.csvHeader}</TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                        {csvData[0]?.[mapping.csvHeader] || '-'}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={mapping.crmField || 'none'}
                          onValueChange={(v) => updateMapping(mapping.csvHeader, v === 'none' ? null : v)}
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Select field..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">-- Skip this field --</SelectItem>
                            {crmFields.map((field) => (
                              <SelectItem key={field.value} value={field.value}>
                                {field.label} {field.required && '*'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {mapping.confidence > 0.8 ? (
                          <Badge variant="default" className="bg-green-500">High</Badge>
                        ) : mapping.confidence > 0.5 ? (
                          <Badge variant="secondary">Medium</Badge>
                        ) : mapping.crmField ? (
                          <Badge variant="outline">Manual</Badge>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep('upload')}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button onClick={validateData} disabled={mappedFieldsCount === 0}>
                  Validate Data
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Validation */}
        {step === 'validation' && (
          <Card>
            <CardHeader>
              <CardTitle>Validation Results</CardTitle>
              <CardDescription>
                Review any issues before importing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">Valid Rows</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">{csvData.length - rowErrorCount}</p>
                </div>
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                    <AlertTriangle className="h-5 w-5" />
                    <span className="font-medium">Rows with Issues</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">{rowErrorCount}</p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <FileSpreadsheet className="h-5 w-5" />
                    <span className="font-medium">Total Rows</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">{csvData.length}</p>
                </div>
              </div>

              {validationErrors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">Issues Found:</h4>
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {validationErrors.slice(0, 50).map((error, idx) => (
                      <Alert key={idx} variant="destructive" className="py-2">
                        <XCircle className="h-4 w-4" />
                        <AlertDescription>
                          {error.row > 0 ? `Row ${error.row}: ` : ''}
                          {error.message}
                          {error.value && ` (value: "${error.value}")`}
                        </AlertDescription>
                      </Alert>
                    ))}
                    {validationErrors.length > 50 && (
                      <p className="text-sm text-muted-foreground">
                        ...and {validationErrors.length - 50} more issues
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-2 pt-4 border-t">
                <Label>Duplicate Handling</Label>
                <p className="text-sm text-muted-foreground">
                  What should we do when an email already exists?
                </p>
                <RadioGroup
                  value={duplicateAction}
                  onValueChange={(v) => setDuplicateAction(v as DuplicateAction)}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="skip" id="skip" />
                    <Label htmlFor="skip">Skip duplicates</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="update" id="update" />
                    <Label htmlFor="update">Update existing records</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep('mapping')}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button onClick={startImport} disabled={importing}>
                  {importing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      Start Import
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>

              {importing && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span>{importProgress}%</span>
                  </div>
                  <Progress value={importProgress} />
                  <div className="grid grid-cols-4 gap-2 text-sm text-center">
                    <div>
                      <span className="text-green-600 font-medium">{importStats.created}</span>
                      <p className="text-muted-foreground">Created</p>
                    </div>
                    <div>
                      <span className="text-blue-600 font-medium">{importStats.updated}</span>
                      <p className="text-muted-foreground">Updated</p>
                    </div>
                    <div>
                      <span className="text-yellow-600 font-medium">{importStats.skipped}</span>
                      <p className="text-muted-foreground">Skipped</p>
                    </div>
                    <div>
                      <span className="text-red-600 font-medium">{importStats.errors}</span>
                      <p className="text-muted-foreground">Errors</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 4: Complete */}
        {step === 'import' && !importing && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <CardTitle>Import Complete!</CardTitle>
                  <CardDescription>
                    Your data has been successfully imported
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                  <p className="text-2xl font-bold text-green-600">{importStats.created}</p>
                  <p className="text-sm text-muted-foreground">Created</p>
                </div>
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
                  <p className="text-2xl font-bold text-blue-600">{importStats.updated}</p>
                  <p className="text-sm text-muted-foreground">Updated</p>
                </div>
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-center">
                  <p className="text-2xl font-bold text-yellow-600">{importStats.skipped}</p>
                  <p className="text-sm text-muted-foreground">Skipped</p>
                </div>
                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-center">
                  <p className="text-2xl font-bold text-red-600">{importStats.errors}</p>
                  <p className="text-sm text-muted-foreground">Errors</p>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep('upload');
                    setCsvData([]);
                    setCsvHeaders([]);
                    setFieldMappings([]);
                    setValidationErrors([]);
                  }}
                >
                  Import More Data
                </Button>
                <Button onClick={() => window.location.href = `/${importType}`}>
                  View {importType.charAt(0).toUpperCase() + importType.slice(1)}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
