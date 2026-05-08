import React, { useState, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Download, Upload, FileJson, FileSpreadsheet, FileArchive, Shield, Database, Users, Calendar, Package, DollarSign, CheckCircle2, AlertCircle, RefreshCw, CalendarDays, Filter } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { format, startOfMonth, endOfMonth, parseISO, isWithinInterval, subMonths, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import JSZip from 'jszip';

const fetchAllData = async () => {
  const [clients, products, appointments, sales, suppliers, installments, financialRecords] = await Promise.all([
    supabase.from('clients').select('*'),
    supabase.from('products').select('*'),
    supabase.from('appointments').select('*'),
    supabase.from('sales').select('*'),
    supabase.from('suppliers').select('*'),
    supabase.from('installments').select('*'),
    supabase.from('financial_records').select('*')
  ]);

  return {
    clients: clients.data || [],
    products: products.data || [],
    appointments: appointments.data || [],
    sales: sales.data || [],
    suppliers: suppliers.data || [],
    installments: installments.data || [],
    financialRecords: financialRecords.data || []
  };
};

interface DataBackupProps {
  className?: string;
}

const DataBackup: React.FC<DataBackupProps> = ({ className }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedTables, setSelectedTables] = useState<string[]>([
    'clients', 'products', 'appointments', 'sales', 'suppliers', 'installments', 'financialRecords'
  ]);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [importProgress, setImportProgress] = useState(0);
  const [importPreview, setImportPreview] = useState<any>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [exportFormat, setExportFormat] = useState<'json' | 'zip' | 'csv'>('json');

  const { data, refetch } = useQuery({
    queryKey: ['backup-data'],
    queryFn: fetchAllData,
    enabled: false
  });

  const tables = [
    { key: 'clients', label: 'Clientes', icon: Users, dbTable: 'clients', dateField: 'created_at', color: 'bg-blue-500' },
    { key: 'products', label: 'Serviços/Produtos', icon: Package, dbTable: 'products', dateField: 'created_at', color: 'bg-purple-500' },
    { key: 'appointments', label: 'Agendamentos', icon: Calendar, dbTable: 'appointments', dateField: 'appointment_date', color: 'bg-green-500' },
    { key: 'sales', label: 'Vendas', icon: DollarSign, dbTable: 'sales', dateField: 'sale_date', color: 'bg-amber-500' },
    { key: 'suppliers', label: 'Fornecedores', icon: Package, dbTable: 'suppliers', dateField: 'created_at', color: 'bg-pink-500' },
    { key: 'installments', label: 'Parcelas', icon: DollarSign, dbTable: 'installments', dateField: 'due_date', color: 'bg-red-500' },
    { key: 'financialRecords', label: 'Registros Financeiros', icon: DollarSign, dbTable: 'financial_records', dateField: 'record_date', color: 'bg-cyan-500' },
  ];

  // Generate months for filter (last 12 months + current)
  const monthOptions = useMemo(() => {
    const options = [{ value: 'all', label: 'Todos os meses' }];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = subMonths(now, i);
      options.push({
        value: format(date, 'yyyy-MM'),
        label: format(date, 'MMMM yyyy', { locale: ptBR })
      });
    }
    return options;
  }, []);

  const filterDataByMonth = (data: any[], dateField: string) => {
    if (selectedMonth === 'all') return data;
    
    const [year, month] = selectedMonth.split('-').map(Number);
    const start = startOfMonth(new Date(year, month - 1));
    const end = endOfMonth(new Date(year, month - 1));
    
    return data.filter(item => {
      if (!item[dateField]) return false;
      const itemDate = parseISO(item[dateField]);
      return isWithinInterval(itemDate, { start, end });
    });
  };

  const toggleTable = (tableKey: string) => {
    setSelectedTables(prev => 
      prev.includes(tableKey) ? prev.filter(t => t !== tableKey) : [...prev, tableKey]
    );
  };

  const selectAll = () => setSelectedTables(tables.map(t => t.key));
  const deselectAll = () => setSelectedTables([]);

  const downloadFile = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const executeExport = async () => {
    setIsExporting(true);
    setExportProgress(10);
    
    try {
      const result = await refetch();
      setExportProgress(30);
      if (!result.data) throw new Error('Nenhum dado para exportar');

      const monthLabel = selectedMonth === 'all' ? 'completo' : selectedMonth;
      const exportData: Record<string, any> = {
        exportDate: new Date().toISOString(),
        version: '2.0',
        appName: 'Sistema AC',
        period: selectedMonth,
        data: {}
      };

      selectedTables.forEach(tableKey => {
        const tableConfig = tables.find(t => t.key === tableKey);
        if (!tableConfig) return;
        
        let tableData = result.data[tableKey as keyof typeof result.data] || [];
        if (selectedMonth !== 'all') {
          tableData = filterDataByMonth(tableData, tableConfig.dateField);
        }
        exportData.data[tableKey] = tableData;
      });

      setExportProgress(60);

      if (exportFormat === 'json') {
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        downloadFile(blob, `backup-${monthLabel}-${format(new Date(), 'yyyy-MM-dd-HHmm')}.json`);
      } else if (exportFormat === 'zip') {
        const zip = new JSZip();
        const folder = zip.folder(`backup-${monthLabel}`);
        
        folder?.file('_metadata.json', JSON.stringify({
          exportDate: exportData.exportDate,
          version: exportData.version,
          period: exportData.period,
          tables: Object.keys(exportData.data)
        }, null, 2));
        
        Object.entries(exportData.data).forEach(([key, value]) => {
          if (Array.isArray(value) && value.length > 0) {
            folder?.file(`${key}.json`, JSON.stringify(value, null, 2));
          }
        });
        
        const content = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
        downloadFile(content, `backup-${monthLabel}-${format(new Date(), 'yyyy-MM-dd-HHmm')}.zip`);
      } else if (exportFormat === 'csv') {
        const zip = new JSZip();
        const folder = zip.folder(`csv-${monthLabel}`);
        
        Object.entries(exportData.data).forEach(([key, value]) => {
          if (!Array.isArray(value) || value.length === 0) return;
          
          const headers = Object.keys(value[0]).filter(h => 
            typeof value[0][h] !== 'object' || value[0][h] === null
          );
          
          const csvRows = [headers.join(',')];
          value.forEach((row: any) => {
            const values = headers.map(header => {
              let val = row[header];
              if (val === null || val === undefined) return '';
              if (typeof val === 'string') {
                val = val.replace(/"/g, '""');
                if (val.includes(',') || val.includes('"') || val.includes('\n')) {
                  val = `"${val}"`;
                }
              }
              return val;
            });
            csvRows.push(values.join(','));
          });
          
          folder?.file(`${key}.csv`, '\ufeff' + csvRows.join('\n'));
        });
        
        const content = await zip.generateAsync({ type: 'blob' });
        downloadFile(content, `csv-${monthLabel}-${format(new Date(), 'yyyy-MM-dd')}.zip`);
      }

      setExportProgress(100);
      toast({ title: "Backup realizado!", description: `Exportado com sucesso (${monthLabel})` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro no backup", description: error.message });
    } finally {
      setIsExporting(false);
      setTimeout(() => setExportProgress(0), 1000);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      if (file.name.endsWith('.json')) {
        const text = await file.text();
        const parsed = JSON.parse(text);
        
        if (!parsed.data || !parsed.version) {
          throw new Error('Arquivo de backup inválido');
        }
        
        setImportPreview({
          type: 'json',
          filename: file.name,
          date: parsed.exportDate,
          version: parsed.version,
          period: parsed.period || 'N/A',
          tables: Object.keys(parsed.data).map(key => ({
            key,
            count: Array.isArray(parsed.data[key]) ? parsed.data[key].length : 0
          })),
          rawData: parsed.data
        });
      } else if (file.name.endsWith('.zip')) {
        const zip = await JSZip.loadAsync(file);
        
        // Find the backup folder
        let folder: JSZip | null = null;
        let folderName = '';
        zip.forEach((path, entry) => {
          if (entry.dir && path.includes('backup')) {
            folder = zip.folder(path.replace('/', ''));
            folderName = path.replace('/', '');
          }
        });
        
        if (!folder) {
          folder = zip;
          folderName = '';
        }
        
        let metadata: any = null;
        const metaFile = folder.file(folderName ? `${folderName}/_metadata.json` : '_metadata.json') || 
                         folder.file('_metadata.json');
        
        if (metaFile) {
          const metaText = await metaFile.async('text');
          metadata = JSON.parse(metaText);
        }
        
        const tablesList: any[] = [];
        const rawData: Record<string, any[]> = {};
        
        const files = folder.filter((path, file) => path.endsWith('.json') && !path.includes('_metadata'));
        
        for (const file of files) {
          const content = await file.async('text');
          const tableKey = file.name.replace(/.*\//, '').replace('.json', '');
          const tableData = JSON.parse(content);
          rawData[tableKey] = tableData;
          tablesList.push({ key: tableKey, count: tableData.length });
        }
        
        setImportPreview({
          type: 'zip',
          filename: file.name,
          date: metadata?.exportDate,
          version: metadata?.version,
          period: metadata?.period || 'N/A',
          tables: tablesList,
          rawData
        });
      } else {
        throw new Error('Formato não suportado. Use .json ou .zip');
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao ler arquivo", description: error.message });
      setImportPreview(null);
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const executeImport = async () => {
    if (!importPreview?.rawData) return;
    
    const confirmed = window.confirm(
      '⚠️ ATENÇÃO: Esta ação irá ADICIONAR os dados do backup.\n\n' +
      'Dados duplicados podem ser criados. Deseja continuar?'
    );
    
    if (!confirmed) return;
    
    setIsImporting(true);
    setImportProgress(0);
    
    try {
      const { data: sessionData } = await supabase.auth.getSession(); const session = sessionData?.session;
      if (!session) throw new Error('Usuário não autenticado');
      
      const userId = session.user.id;
      const totalTables = Object.keys(importPreview.rawData).length;
      let processed = 0;
      
      const importOrder = ['suppliers', 'clients', 'products', 'appointments', 'sales', 'installments', 'financialRecords'];
      
      for (const tableKey of importOrder) {
        if (!importPreview.rawData[tableKey]) continue;
        
        const tableConfig = tables.find(t => t.key === tableKey);
        if (!tableConfig) continue;
        
        const tableData = importPreview.rawData[tableKey];
        if (!Array.isArray(tableData) || tableData.length === 0) continue;
        
        const dbTable = tableConfig.dbTable as 'clients' | 'products' | 'appointments' | 'sales' | 'suppliers' | 'installments' | 'financial_records';
        
        const preparedData = tableData.map((row: any) => {
          const { id, clients, products, ...rest } = row;
          return { ...rest, user_id: userId };
        });
        
        for (let i = 0; i < preparedData.length; i += 100) {
          const batch = preparedData.slice(i, i + 100);
          const { error } = await supabase.from(dbTable).insert(batch as any);
          if (error) console.error(`Error importing ${tableKey}:`, error);
        }
        
        processed++;
        setImportProgress(Math.round((processed / totalTables) * 100));
      }
      
      queryClient.invalidateQueries();
      toast({ title: "Importação concluída!", description: "Dados restaurados com sucesso." });
      setImportPreview(null);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro na importação", description: error.message });
    } finally {
      setIsImporting(false);
      setImportProgress(0);
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                <Shield className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{tables.length}</p>
                <p className="text-xs text-muted-foreground">Tabelas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-200 dark:border-green-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
                <Download className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">3</p>
                <p className="text-xs text-muted-foreground">Formatos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-200 dark:border-purple-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900">
                <CalendarDays className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">12</p>
                <p className="text-xs text-muted-foreground">Meses</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-200 dark:border-amber-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900">
                <Upload className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">✓</p>
                <p className="text-xs text-muted-foreground">Restaurar</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="export" className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-12">
          <TabsTrigger value="export" className="flex items-center gap-2 text-base">
            <Download className="w-4 h-4" />
            Exportar
          </TabsTrigger>
          <TabsTrigger value="import" className="flex items-center gap-2 text-base">
            <Upload className="w-4 h-4" />
            Importar
          </TabsTrigger>
        </TabsList>

        {/* EXPORT TAB */}
        <TabsContent value="export" className="mt-6">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Filters */}
            <Card className="xl:col-span-1">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Filter className="w-5 h-5" />
                  Filtros
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Período</Label>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione o mês" />
                    </SelectTrigger>
                    <SelectContent>
                      {monthOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          <span className="capitalize">{option.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Formato</Label>
                  <Select value={exportFormat} onValueChange={(v: any) => setExportFormat(v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="json">
                        <span className="flex items-center gap-2">
                          <FileJson className="w-4 h-4 text-amber-600" /> JSON
                        </span>
                      </SelectItem>
                      <SelectItem value="zip">
                        <span className="flex items-center gap-2">
                          <FileArchive className="w-4 h-4 text-purple-600" /> ZIP Comprimido
                        </span>
                      </SelectItem>
                      <SelectItem value="csv">
                        <span className="flex items-center gap-2">
                          <FileSpreadsheet className="w-4 h-4 text-green-600" /> CSV/Excel
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="pt-2">
                  <div className="flex justify-between mb-2">
                    <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs">
                      Todos
                    </Button>
                    <Button variant="ghost" size="sm" onClick={deselectAll} className="text-xs">
                      Limpar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tables Selection */}
            <Card className="xl:col-span-1">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Database className="w-5 h-5" />
                  Dados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-2">
                  {tables.map(table => {
                    const Icon = table.icon;
                    const isSelected = selectedTables.includes(table.key);
                    return (
                      <div key={table.key} onClick={() => toggleTable(table.key)}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all
                          ${isSelected ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:bg-muted/50'}`}>
                        <Checkbox checked={isSelected} onCheckedChange={() => toggleTable(table.key)} />
                        <div className={`p-1.5 rounded ${table.color}`}>
                          <Icon className="w-3.5 h-3.5 text-white" />
                        </div>
                        <span className="text-sm font-medium flex-1">{table.label}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Export Action */}
            <Card className="xl:col-span-1">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Download className="w-5 h-5" />
                  Exportar
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isExporting && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Exportando...</span>
                      <span>{exportProgress}%</span>
                    </div>
                    <Progress value={exportProgress} className="h-2" />
                  </div>
                )}

                <div className="p-4 rounded-lg bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20">
                  <div className="text-center space-y-2">
                    <Badge variant="outline" className="mb-2">
                      {selectedMonth === 'all' ? 'Todos os dados' : monthOptions.find(m => m.value === selectedMonth)?.label}
                    </Badge>
                    <p className="text-sm text-muted-foreground">
                      {selectedTables.length} tabela(s) selecionada(s)
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Formato: {exportFormat.toUpperCase()}
                    </p>
                  </div>
                </div>

                <Button 
                  onClick={executeExport} 
                  disabled={isExporting || selectedTables.length === 0}
                  className="w-full h-12 text-base"
                  size="lg"
                >
                  <Download className="w-5 h-5 mr-2" />
                  Gerar Backup
                </Button>

                <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-xs text-green-700 dark:text-green-300">
                    Use JSON ou ZIP para restauração posterior
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* IMPORT TAB */}
        <TabsContent value="import" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* File Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Selecionar Arquivo
                </CardTitle>
                <CardDescription>Escolha um backup para restaurar</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.zip"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-all group"
                >
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Upload className="w-8 h-8 text-primary" />
                  </div>
                  <p className="font-semibold text-lg">Clique para selecionar</p>
                  <p className="text-sm text-muted-foreground mt-1">Formatos: .json ou .zip</p>
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Atenção</AlertTitle>
                  <AlertDescription className="text-xs">
                    Os dados serão adicionados ao sistema. Dados existentes não serão apagados.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* Preview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5" />
                  Pré-visualização
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isImporting && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Importando...</span>
                      <span>{importProgress}%</span>
                    </div>
                    <Progress value={importProgress} className="h-2" />
                  </div>
                )}

                {importPreview ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-gradient-to-br from-muted/50 to-muted/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Arquivo:</span>
                        <Badge variant="outline">{importPreview.filename}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Período:</span>
                        <Badge>{importPreview.period}</Badge>
                      </div>
                      {importPreview.date && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Data:</span>
                          <span className="text-sm">{format(new Date(importPreview.date), 'dd/MM/yyyy HH:mm')}</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Dados encontrados:</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {importPreview.tables.map((table: any) => {
                          const config = tables.find(t => t.key === table.key);
                          return (
                            <div key={table.key} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 text-sm">
                              <span className="capitalize truncate">{config?.label || table.key}</span>
                              <Badge variant="secondary" className="ml-2">{table.count}</Badge>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" onClick={() => setImportPreview(null)} className="flex-1">
                        Cancelar
                      </Button>
                      <Button onClick={executeImport} disabled={isImporting} className="flex-1 bg-green-600 hover:bg-green-700">
                        <Upload className="w-4 h-4 mr-2" />
                        Restaurar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Database className="w-16 h-16 mb-4 opacity-30" />
                    <p className="font-medium">Nenhum arquivo selecionado</p>
                    <p className="text-sm">Selecione um backup para visualizar</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DataBackup;
